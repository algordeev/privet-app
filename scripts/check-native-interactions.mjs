// Real React interaction checks in isolated headless Chromium, with test-only
// native-platform/voice shims. No device, radio, billing or simulator claims.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';

const executable=[process.env.PRIVET_CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(path=>path&&existsSync(path));
assert.ok(executable,'Install Chrome/Chromium or set PRIVET_CHROME_PATH to run interaction checks.');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let seed={},initialTime=new Date(2026,9,17,12).getTime();
const server=await createServer({mode:'native',appType:'custom',server:{host:'127.0.0.1',port:0,strictPort:false,hmr:false}});
server.middlewares.use('/__privet_native_checks',(req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 const reset=!req.url.includes('resume');
 res.end(`<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module">
 window.CapacitorCustomPlatform={name:'ios'};
 window.__realDate=Date;window.__now=${initialTime};
 window.Date=class extends window.__realDate{constructor(...args){super(...(args.length?args:[window.__now]));}static now(){return window.__now;}};
 ${reset?`localStorage.clear();for(const [key,value] of Object.entries(${JSON.stringify(seed)}))localStorage.setItem(key,JSON.stringify(value));`:''}
 Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'en-US',name:'Test English voice'}],addEventListener:()=>{},removeEventListener:()=>{},cancel:()=>{},speak:()=>{throw Error('No speech expected in interaction checks');}}});
 await import('/src/main.tsx');
 </script></body></html>`);
});
let chrome,ws,profile;
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 const {nativeLessons}=await server.ssrLoadModule('/src/lessons.ts');
 const {sessionKey}=await server.ssrLoadModule('/src/session.ts');
 const {freshSession,NATIVE_SESSION_KEY}=await server.ssrLoadModule('/src/session.ts');
 const {emptyStats,NATIVE_STATS_KEY,localDay}=await server.ssrLoadModule('/src/nativeStats.ts');
 const {SUBSCRIPTION_KEY}=await server.ssrLoadModule('/src/subscription.ts');
 profile=await mkdtemp(join(tmpdir(),'privet-native-checks-'));
 chrome=spawn(executable,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 let port;for(let n=0;n<100;n++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(100);}}
 assert.ok(port,'Chrome did not start its isolated debugging endpoint.');
 const tab=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json());
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let nextId=0;const pending=new Map();const browserErrors=[];
 ws.onmessage=event=>{
  const message=JSON.parse(event.data);
  if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails.text);
  if(message.id){const request=pending.get(message.id);if(!request)return;pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(Error(JSON.stringify(message.error))):request.resolve(message.result);}
 };
 const call=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++nextId;const timer=setTimeout(()=>{pending.delete(id);reject(Error(`Browser command timed out: ${method} ${params.expression?.slice(0,180)??''}`));},30000);
  pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
 });
 const evaluate=async(fn,arg)=>{
  const result=await call('Runtime.evaluate',{expression:`(${fn.toString()})(${JSON.stringify(arg)})`,awaitPromise:true,returnByValue:true});
  assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;
 };
 const until=async(fn,arg)=>{for(let n=0;n<120;n++){if(await evaluate(fn,arg))return;await pause(50);}throw Error(`UI condition timed out: ${fn}`);};
 async function assertNativeLayout(){
  const panes=await evaluate(()=>[...document.querySelectorAll('.native-app,.native-home-scroll,.native-profile-scroll,.native-app .lesson-scroll')].map(el=>{
   el.scrollLeft=1000;
   return {name:el.className,width:el.clientWidth,content:el.scrollWidth,left:el.scrollLeft};
  }));
  for(const pane of panes){assert.ok(pane.content<=pane.width,`Horizontal overflow: ${JSON.stringify(pane)}`);assert.equal(pane.left,0,`Sideways scrolling: ${pane.name}`);}
  const clipped=await evaluate(()=>[...document.querySelectorAll('.native-home-header button,.native-home-header .wordmark')].filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth;}).map(el=>el.textContent));
  assert.deepEqual(clipped,[],'Header controls must fit, not merely be clipped');
 }
 const click=async(selector,text)=>{
  if(process.env.PRIVET_INTERACTION_DEBUG)console.log(`CLICK ${selector} ${text??''}`);
  await until(({selector,text})=>[...document.querySelectorAll(selector)].some(el=>!el.disabled&&(!text||el.textContent.trim().replace(/\s*[→↻∞]\s*$/,'').trim()===text)),{selector,text});
  await evaluate(({selector,text})=>{const el=[...document.querySelectorAll(selector)].find(el=>!el.disabled&&(!text||el.textContent.trim().replace(/\s*[→↻∞]\s*$/,'').trim()===text));el.scrollIntoView({block:'nearest'});el.click();},{selector,text});await pause(60);await assertNativeLayout();
 };
 const stored=key=>evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 async function open(nextSeed={},time=new Date(2026,9,17,12).getTime(),resume=false){
  if(process.env.PRIVET_INTERACTION_DEBUG)console.log(`OPEN ${resume?'resume':'seed'} ${new Date(time).toISOString()}`);
  seed=nextSeed;initialTime=time;await evaluate(()=>{window.__oldDocument=true;});
  await call('Page.navigate',{url:origin+'/__privet_native_checks'+(resume?'?resume=1':'')});
  await until(()=>!window.__oldDocument&&!!document.querySelector('.native-app'));
  await until(()=>document.querySelectorAll('.native-lesson-card').length===2);
  await pause(80);await assertNativeLayout();
 }
 const startCafe=()=>click('#native-card-cafe ~ .button');
 function meaning(){const s=freshSession();s.progress.index=1;s.progress.results=[true];return s;}
 function finalStep(){const s=freshSession();s.progress={...s.progress,index:4,results:[true,true,true,true],attempts:1,feedback:'correct',bestCombo:5};s.selected='спасибо';return s;}
 const today=localDay(new Date(2026,9,17,12));
 await call('Page.enable');await call('Runtime.enable');
 for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:430,height:932}]){
  await call('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await open({[NATIVE_SESSION_KEY]:meaning()});await startCafe();
  for(let n=0;n<3;n++){
   await click('.choice','1tea');await click('.lesson-bottom .button','Check answer');
   if(n<2)await click('.lesson-bottom .button','Try again');
  }
  await until(()=>!!document.querySelector('.failure-screen'));
  assert.equal((await stored(NATIVE_SESSION_KEY)).progress.hearts,0);
  await click('.failure-screen .button','Get unlimited hearts');
  await until(()=>!!document.querySelector('#native-plus-title'));
  assert.ok(await evaluate(()=>document.querySelector('.native-plus-demo').textContent.includes('No payment processing')));
  await click('[aria-label="Back"]');assert.ok(await evaluate(()=>!!document.querySelector('.failure-screen')));
  assert.equal((await stored(NATIVE_SESSION_KEY)).progress.failed,true);
  await click('.failure-screen .button','Get unlimited hearts');await click('.native-plus-start','Activate Plus demo');
  await until(()=>!!document.querySelector('.lesson-bottom'));
  assert.equal((await stored(SUBSCRIPTION_KEY)).plan,'monthly');
  assert.equal((await stored(NATIVE_SESSION_KEY)).progress.hearts,3);assert.equal((await stored(NATIVE_SESSION_KEY)).progress.failed,false);
  assert.ok(await evaluate(()=>document.querySelector('.lesson-vitals').textContent.includes('Unlimited hearts')));
  await click('.lesson-bottom .button','Try again');await click('.choice','1tea');await click('.lesson-bottom .button','Check answer');
  assert.equal((await stored(NATIVE_SESSION_KEY)).progress.hearts,3,'Plus wrong answer must not consume a heart');
  await click('[aria-label="Return to app home"]');await click('[aria-label="Open your profile and statistics"]');
  assert.ok(await evaluate(()=>!!document.querySelector('.native-profile-avatar.is-plus')));
  await click('#native-profile-plus-open','Manage Plus');await click('.native-plus-card .button','Cancel Plus');
  await until(()=>!!document.querySelector('.native-plus-start'));
  assert.equal((await stored(SUBSCRIPTION_KEY)).plan,null);
  await click('[aria-label="Back"]');assert.equal(await evaluate(()=>!!document.querySelector('.native-profile-avatar.is-plus')),false);
  await click('[aria-label="Back to home"]');assert.equal(await evaluate(()=>!!document.querySelector('#native-profile-open.is-plus')),false);await startCafe();
  await click('.lesson-bottom .button','Try again');await click('.choice','1tea');await click('.lesson-bottom .button','Check answer');
  assert.equal((await stored(NATIVE_SESSION_KEY)).progress.hearts,2,'After cancellation mistakes consume hearts again');
  await open({},undefined,true);assert.equal((await stored(SUBSCRIPTION_KEY)).plan,null,'Cancellation persists on reload');
  await click('[aria-label="Open your profile and statistics"]');await click('#native-profile-plus-open','Get Plus');await click('.native-plus-plans button','Yearly$39.99 / year · example price');await click('.native-plus-start','Activate Plus demo');
  await open({},undefined,true);assert.equal((await stored(SUBSCRIPTION_KEY)).plan,'yearly');assert.ok(await evaluate(()=>!!document.querySelector('#native-profile-open.is-plus')));assert.equal(await evaluate(()=>document.querySelector('#native-plus-open')),null);

  // Profile activation must recover an already failed selected lesson without
  // routing through the failure screen's upgrade button or resetting its work.
  const paused=meaning();paused.progress={...paused.progress,hearts:0,failed:true,attempts:3,feedback:'incorrect'};paused.selected='tea';
  await open({[NATIVE_SESSION_KEY]:paused});
  assert.equal((await stored(NATIVE_SESSION_KEY)).progress.failed,true,'Without Plus a paused lesson stays paused');
  await click('[aria-label="Open your profile and statistics"]');await click('#native-profile-plus-open','Get Plus');await click('.native-plus-start','Activate Plus demo');
  await until(key=>JSON.parse(localStorage.getItem(key)).progress.failed===false,NATIVE_SESSION_KEY);
  let recovered=await stored(NATIVE_SESSION_KEY);
  assert.equal(recovered.progress.hearts,3);assert.equal(recovered.progress.index,1);assert.equal(recovered.progress.attempts,3);assert.deepEqual(recovered.progress.results,[true]);assert.equal(recovered.selected,'tea');
  assert.ok(await evaluate(()=>!!document.querySelector('#native-plus-title')),'Profile activation must not unexpectedly navigate into a lesson');
  await click('[aria-label="Back"]');await click('[aria-label="Back to home"]');await startCafe();
  assert.equal(await evaluate(()=>!!document.querySelector('.failure-screen')),false);
  assert.equal(await evaluate(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Get unlimited hearts'))),false);
  await click('.lesson-bottom .button','Try again');await click('.choice','1tea');await click('.lesson-bottom .button','Check answer');
  assert.equal((await stored(NATIVE_SESSION_KEY)).progress.hearts,3);

  // Restored Plus also recovers the selected failed lesson. Selecting another
  // paused lesson while Plus is active must recover that one as well.
  const secondPaused=freshSession();secondPaused.progress={...secondPaused.progress,index:1,results:[true],hearts:0,failed:true,attempts:3,feedback:'incorrect'};
  await open({[SUBSCRIPTION_KEY]:{version:1,plan:'monthly',since:'2026-10-17'},[NATIVE_SESSION_KEY]:paused,[sessionKey(nativeLessons[1])]:secondPaused});
  await until(key=>!JSON.parse(localStorage.getItem(key)).progress.failed,sessionKey(nativeLessons[1]));
  assert.equal((await stored(NATIVE_SESSION_KEY)).progress.failed,true,'Only the selected lesson is recovered');
  await startCafe();await until(key=>!JSON.parse(localStorage.getItem(key)).progress.failed,NATIVE_SESSION_KEY);
  recovered=await stored(NATIVE_SESSION_KEY);assert.equal(recovered.progress.hearts,3);assert.equal(recovered.progress.attempts,3);
  assert.equal(await evaluate(()=>!!document.querySelector('.failure-screen')),false);

  // The hook must consume a freeze after mount, then finish from that same state.
  const freezeStats={...emptyStats(),days:{'2026-10-15':1},gems:{...emptyStats().gems,balance:60,freezes:1}};
  await open({[NATIVE_STATS_KEY]:freezeStats,[NATIVE_SESSION_KEY]:finalStep()},new Date(2026,9,16,12).getTime());
  await evaluate(()=>{window.__now=new window.__realDate(2026,9,17,12).getTime();document.dispatchEvent(new Event('visibilitychange'));});
  await until(key=>JSON.parse(localStorage.getItem(key)).gems.freezes===0,NATIVE_STATS_KEY);
  await startCafe();await click('.lesson-bottom .button','Continue');await until(()=>!!document.querySelector('.completion:not(.failure-screen)'));
  let stats=await stored(NATIVE_STATS_KEY);assert.equal(stats.gems.freezes,0);assert.deepEqual(stats.frozen,['2026-10-16']);assert.equal(stats.days[today],1);
  assert.equal(stats.gems.balance,70);assert.deepEqual(stats.latest.gemAward,{finish:5,perfect:5,streakWeek:0});
  assert.ok(await evaluate(()=>document.querySelector('.native-gem-award').textContent.includes('+5 lesson')));
  await click('.native-next-lesson','Continue to Lesson 2');
  assert.equal(await evaluate(()=>document.querySelector('.app-navigation strong').textContent),'Nice to meet you');
  assert.ok(await evaluate(()=>document.querySelector('h3').textContent.includes('From hello')));
  assert.equal((await stored(NATIVE_SESSION_KEY)).progress.complete,true);
  assert.equal((await stored(NATIVE_STATS_KEY)).days[today],1,'Moving to Lesson 2 must not record another finish');
  assert.equal((await stored(sessionKey(nativeLessons[1]))).progress.index,0);

  const resumed=freshSession();resumed.progress.index=2;resumed.progress.results=[true,true];resumed.tokens=['Меня'];
  await open({[NATIVE_SESSION_KEY]:finalStep(),[sessionKey(nativeLessons[1])]:resumed});await startCafe();await click('.lesson-bottom .button','Continue');await click('.native-next-lesson','Continue to Lesson 2');
  assert.equal((await stored(sessionKey(nativeLessons[1]))).progress.index,2,JSON.stringify(await stored(sessionKey(nativeLessons[1]))));
  await until(()=>!!document.querySelector('.sentence-answer'));
  assert.ok(await evaluate(()=>document.querySelector('.sentence-answer').textContent.includes('Меня')),'Existing Lesson 2 work must be preserved');


  // Replaying a previously rewarded lesson must not repeat the old result reward.
  const daily={finish:5,perfect:5,streakWeek:0};
  const awarded={...emptyStats(),days:{[today]:1},gems:{...emptyStats().gems,balance:10,awarded:{[today]:['cafe']},awards:{[today]:{cafe:daily}}},latest:{day:today,firstTry:5,lessonId:'cafe',gemAward:daily}};
  await open({[NATIVE_STATS_KEY]:awarded,[NATIVE_SESSION_KEY]:finalStep()});await startCafe();await click('.lesson-bottom .button','Continue');
  await until(()=>!!document.querySelector('.native-gem-award'));
  stats=await stored(NATIVE_STATS_KEY);assert.equal(stats.gems.balance,10);assert.deepEqual(stats.gems.awards[today].cafe,daily);assert.deepEqual(stats.latest.gemAward,{finish:0,perfect:0,streakWeek:0});
  assert.equal(await evaluate(()=>document.querySelector('.native-gem-award').textContent),'No new gems this attempt');

  // A real refill interaction uses the 20-gem price; a freeze purchase uses 30.
  const failed=meaning();failed.progress={...failed.progress,hearts:0,failed:true,attempts:3,feedback:'incorrect'};
  await open({[NATIVE_SESSION_KEY]:failed,[NATIVE_STATS_KEY]:{...emptyStats(),gems:{...emptyStats().gems,balance:50}}});
  await startCafe();await click('.failure-screen .button','Refill hearts · 20 gems');
  assert.equal((await stored(NATIVE_STATS_KEY)).gems.balance,30);assert.equal((await stored(NATIVE_SESSION_KEY)).progress.hearts,3);
  await click('[aria-label="Return to app home"]');await click('#native-gems-open');await click('.native-gem-shop-card .button','Get freeze');
  assert.equal((await stored(NATIVE_STATS_KEY)).gems.balance,0);assert.equal((await stored(NATIVE_STATS_KEY)).gems.freezes,1);
  assert.ok(await evaluate(()=>document.querySelector('.native-gem-shop-card .button').disabled));
  assert.equal(await evaluate(()=>document.querySelector('.native-app').scrollWidth<=innerWidth),true,'native shell fits viewport');
  // Cover every exercise layout, not just the meaning/paused screens above.
  for(const definition of nativeLessons){for(let index=0;index<definition.exercises.length;index++){
   const snapshot=freshSession();snapshot.progress.index=index;snapshot.progress.results=Array(index).fill(true);
   await open({[sessionKey(definition)]:snapshot});await click(`#native-card-${definition.id} ~ .button`);
  }}
  await open();
  const vertical=await evaluate(()=>{const pane=document.querySelector('.native-home-scroll');pane.scrollTop=1000;return {top:pane.scrollTop,height:pane.clientHeight,content:pane.scrollHeight};});
  assert.ok(vertical.top>0,'Home must remain vertically scrollable');
  await call('Input.synthesizeScrollGesture',{x:viewport.width/2,y:viewport.height/2,xDistance:-120,yDistance:0,gestureSourceType:'touch'});
  await assertNativeLayout();
  await click('[aria-label="Open your profile and statistics"]');
  await click('[aria-label="Back to home"]');await click('#native-physical-open');
  await assertNativeLayout();
  console.log(`PASS ${viewport.width}×${viewport.height}: Plus activate/cancel/reload/zero-heart recovery via lesson and Profile, restored heart consumption, freeze lifecycle→finish, replay reward separation, refill/freeze prices; native panes cannot scroll sideways, all exercises/header controls fit, vertical scroll retained.`);
 }
 assert.deepEqual(browserErrors,[],'No uncaught browser exceptions');
 console.log('PASS: interaction checks use isolated Chromium shims; no real iPhone, ESP32, speech or payment verification.');
}finally{
 ws?.close();
 if(chrome&&chrome.exitCode===null){chrome.kill('SIGTERM');await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');}
 await server.close();
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
