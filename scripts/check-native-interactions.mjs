// Real React interaction checks in isolated headless Chromium, with test-only
// native-platform/voice shims. No device, radio, billing or simulator claims.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';

const executable=[process.env.PRIVET_CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',...[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).map(dir=>join(dir,'Google','Chrome','Application','chrome.exe'))].find(path=>path&&existsSync(path));
assert.ok(executable,'Install Chrome/Chromium or set PRIVET_CHROME_PATH to run interaction checks.');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browserPreview=false,russianAudio=false,skipQuickStart=true,repeatedSentence=false,firstTime=false,learningCards=false;
let seed={},initialTime=new Date(2026,9,17,12).getTime();
// Test-only driver substitution: exercise real root hook, scheduler and UI without radio.
const server=await createServer({plugins:[{name:'privet-test-ble-driver',enforce:'pre',transform(_source,id){
 if(!id.endsWith('/src/bleDriver.ts'))return;
 return `export function createNativeBleDriver(){let notify;return {
 async initialize(){},async isEnabled(){return true;},async connected(){return true;},async watchEnabled(){},
 async scan(_service,found){found({deviceId:'test-companion',name:'Privet-ESP32'});},async stopScan(){},async connect(){},
 async subscribe(_id,callback){notify=callback;},async write(_id,packet){
 window.__bleFrames.push(Array.from(new Uint8Array(packet.buffer,packet.byteOffset,packet.byteLength)));
 if(packet.getUint8(0)===2){
  const type=packet.getUint8(1),id=packet.getUint32(2,true);
  if(type===0x10)window.__card={id,mode:packet.getUint8(14),primary:packet.getUint8(15),body:[]};
  if(type===0x11)window.__card.body.push(...new Uint8Array(packet.buffer,packet.byteOffset+8,packet.getUint8(7)));
  if(type===0x12){const c=window.__card,bytes=new Uint8Array(c.body),decoder=new TextDecoder();window.__cards.push({mode:c.mode,primary:decoder.decode(bytes.slice(0,c.primary)),secondary:decoder.decode(bytes.slice(c.primary))});
   const ack=new DataView(new ArrayBuffer(8));ack.setUint8(0,2);ack.setUint8(1,0x90);ack.setUint32(2,id,true);ack.setUint8(7,c.mode);notify(ack);}
  return;
 }
 if(packet.getUint8(6)!==10)window.__bleCommands.push(packet.getUint8(6));
 const ack=new DataView(packet.buffer.slice(packet.byteOffset,packet.byteOffset+8));ack.setUint8(1,2);
 if(packet.getUint8(6)===10){ack.setUint8(7,window.__learningCards?0:1);
  if(window.__learningCards){const caps=new DataView(new ArrayBuffer(20));[2,0x80,0,0,0,0,7,20,96,0,64,32,77,0,0,0,0x88,0x13].forEach((v,i)=>caps.setUint8(i,v));caps.setUint32(2,packet.getUint32(2,true),true);notify(caps);}}
 notify(ack);},async cleanup(){}

 };}`;
}}],mode:'native',appType:'custom',server:{host:'127.0.0.1',port:0,strictPort:false,hmr:false}});
server.middlewares.use('/__privet_native_checks',(req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 const reset=!req.url.includes('resume');
 res.end(`<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module">
 ${browserPreview?'':`window.CapacitorCustomPlatform={name:'ios'};window.Capacitor={PluginHeaders:[{name:'BluetoothLe',methods:[]}]};`}
 window.__learningCards=${learningCards};window.__bleFrames=[];window.__cards=[];window.__bleCommands=[];window.__speechTaps=[];window.__utterances=[];window.__holdSpeech=false;window.__russianAudio=${russianAudio};window.__voiceListeners=new Set();window.__openCalls=[];window.open=(...args)=>{window.__openCalls.push(args);};
 window.__realDate=Date;window.__now=${initialTime};
 window.Date=class extends window.__realDate{constructor(...args){super(...(args.length?args:[window.__now]));}static now(){return window.__now;}};
 ${reset?`localStorage.clear();for(const [key,value] of Object.entries(${JSON.stringify(seed)}))localStorage.setItem(key,JSON.stringify(value));`:''}
 window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:window.__russianAudio?'ru-RU':'en-US',name:'Test voice'}],addEventListener:(_event,fn)=>window.__voiceListeners.add(fn),removeEventListener:(_event,fn)=>window.__voiceListeners.delete(fn),cancel:()=>{},speak:utterance=>{window.__speechTaps.push(utterance.text);window.__utterances.push(utterance);if(!window.__holdSpeech)queueMicrotask(()=>{utterance.onstart?.();utterance.onend?.();});}}});
 ${repeatedSentence?`const {cafeLesson}=await import('/src/lessons.ts');cafeLesson.exercises=cafeLesson.exercises.map((exercise,index)=>index===2?{...exercise,tokens:['я','знаю','что','я'],answer:'я знаю что я'}:exercise);`:''}
 await import('/src/main.tsx');
 </script></body></html>`);
});
let chrome,ws,profile;
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 const {nativeLessons}=await server.ssrLoadModule('/src/lessons.ts');
 const {FIRST_RUN_KEY,initialFirstRun}=await server.ssrLoadModule('/src/firstRun.ts');
 const {firstRunLesson}=await server.ssrLoadModule('/src/firstRunLesson.ts');
 const {REASONS,LEVELS}=await server.ssrLoadModule('/src/firstRun.ts');
 const {sessionKey,savedKey}=await server.ssrLoadModule('/src/session.ts');
 const {freshSession,NATIVE_SESSION_KEY}=await server.ssrLoadModule('/src/session.ts');
 const {emptyStats,NATIVE_STATS_KEY,localDay}=await server.ssrLoadModule('/src/nativeStats.ts');
 const {SUBSCRIPTION_KEY,PLUS_MONTHLY_PRICE}=await server.ssrLoadModule('/src/subscription.ts');
 const {CYRILLIC_KEY}=await server.ssrLoadModule('/src/cyrillicProgress.ts');
 const {CYRILLIC,contextualLetters}=await server.ssrLoadModule('/src/cyrillic.ts');
 const {russianReading}=await server.ssrLoadModule('/src/pronunciation.ts');
 profile=await mkdtemp(join(tmpdir(),'privet-native-checks-'));
 chrome=spawn(executable,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 let port;for(let n=0;n<100;n++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(100);}}
 assert.ok(port,'Chrome did not start its isolated debugging endpoint.');
 const tab=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json());
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let nextId=0;const pending=new Map();const browserErrors=[];
 ws.onmessage=event=>{
  const message=JSON.parse(event.data);
  if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);
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
 const until=async(fn,arg)=>{for(let n=0;n<120;n++){if(await evaluate(fn,arg))return;await pause(50);}throw Error(`UI condition timed out: ${fn}; browser exceptions: ${JSON.stringify(browserErrors)}`);};
 async function assertNativeLayout(){
  const panes=await evaluate(()=>[...document.querySelectorAll('.native-app,.native-home-scroll,.native-profile-scroll,.native-app .lesson-scroll,.native-sheet,.native-sheet-panel,.native-sheet-scroll,.native-quick-scroll,.first-scroll')].map(el=>{
   el.scrollLeft=1000;
   return {name:el.className,width:el.clientWidth,content:el.scrollWidth,left:el.scrollLeft};
  }));
  for(const pane of panes){assert.ok(pane.content<=pane.width,`Horizontal overflow: ${JSON.stringify(pane)}`);assert.equal(pane.left,0,`Sideways scrolling: ${pane.name}`);}
  const firstActions=await evaluate(()=>[...document.querySelectorAll('.first-actions > .button')].map(button=>{const r=button.getBoundingClientRect(),parent=button.parentElement;return {width:r.width,expected:parent.clientWidth-parseFloat(getComputedStyle(parent).paddingLeft)-parseFloat(getComputedStyle(parent).paddingRight),bottom:r.bottom,viewport:innerHeight,height:r.height};}));
  for(const action of firstActions){assert.ok(Math.abs(action.width-action.expected)<2,'First-run primary action fills its footer');assert.ok(action.bottom<=action.viewport&&action.height>=44,'First-run action stays reachable');}
  const firstHeader=await evaluate(()=>{const header=document.querySelector('.first-navigation');if(!header)return null;const r=header.getBoundingClientRect();return {top:r.top,bottom:r.bottom};});
  if(firstHeader)assert.ok(firstHeader.top>=0&&firstHeader.bottom<=await evaluate(()=>innerHeight),'Onboarding branding stays visible');
  const clipped=await evaluate(()=>[...document.querySelectorAll('.native-home-header button,.native-home-header .wordmark')].filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth;}).map(el=>el.textContent));
  assert.deepEqual(clipped,[],'Header controls must fit, not merely be clipped');
 }
 const click=async(selector,text)=>{
  if(process.env.PRIVET_INTERACTION_DEBUG)console.log(`CLICK ${selector} ${text??''}`);
  await until(({selector,text})=>[...document.querySelectorAll(selector)].some(el=>!el.disabled&&(!text||(el.matches('.choice')?(el.querySelector('.native-choice-copy')?el.querySelector('.choice-number').textContent+el.querySelector('.native-choice-copy > span').textContent:el.textContent):el.textContent).trim().replace(/\s*[→↻∞]\s*$/,'').trim()===text)),{selector,text});
  await evaluate(({selector,text})=>{const el=[...document.querySelectorAll(selector)].find(el=>!el.disabled&&(!text||(el.matches('.choice')?(el.querySelector('.native-choice-copy')?el.querySelector('.choice-number').textContent+el.querySelector('.native-choice-copy > span').textContent:el.textContent):el.textContent).trim().replace(/\s*[→↻∞]\s*$/,'').trim()===text));el.scrollIntoView({block:'nearest'});el.click();},{selector,text});await pause(60);await assertNativeLayout();
 };
 async function assertLetterExamples(){
  const cards=await evaluate(()=>[...document.querySelectorAll('.native-letter-card')].map(el=>{
   const example=el.querySelector('.native-letter-example'),visual=example.firstElementChild,target=example.querySelector('.native-target-letter'),style=getComputedStyle(target);
   return {letter:el.querySelector('.native-letter-heading strong').firstChild.textContent.trim(),visual:visual.textContent,word:example.querySelector('.native-sr-only').textContent,reading:el.querySelector('.native-example-reading')?.textContent,readingLang:el.querySelector('.native-example-reading')?.lang,target:target.textContent,hidden:visual.getAttribute('aria-hidden'),lang:example.lang,weight:Number(style.fontWeight),decoration:style.textDecorationLine};
  }));
  assert.ok(cards.length>0);
  const columns=await evaluate(()=>[...document.querySelectorAll('.native-letter-card')].map(card=>{const letter=card.querySelector('.native-letter-heading').getBoundingClientRect(),copy=card.querySelector('.native-letter-copy').getBoundingClientRect(),sound=card.querySelector('.native-letter-copy > b').getBoundingClientRect(),word=card.querySelector('.native-letter-example').getBoundingClientRect();return {letterRight:letter.right,copyLeft:copy.left,soundTop:sound.top,wordTop:word.top};}));
  for(const column of columns){assert.ok(column.copyLeft>=column.letterRight,'Cyrillic letters stay in the left column');assert.ok(column.soundTop<column.wordTop,'Latin sound guide stays above the example in the adjacent column');}
  for(const card of cards){
   assert.equal(card.reading,russianReading(card.word),'Latin reading belongs to the actual safe example');assert.equal(card.readingLang,'en');
   assert.equal(card.visual,card.word,'Visual emphasis preserves the complete word');assert.equal(card.lang,'ru');assert.equal(card.hidden,'true');
   assert.equal(card.target.toLowerCase(),card.letter.toLowerCase());assert.ok(card.weight>=700&&card.decoration.includes('underline'),'Target emphasis does not rely on color');
   if(!['Ъ','Ы','Ь'].includes(card.letter))assert.ok(card.word.toLowerCase().startsWith(card.target.toLowerCase()),card.letter);
   else assert.ok(card.word.toLowerCase().indexOf(card.target.toLowerCase())>0,card.letter);
  }
  const clipped=await evaluate(()=>[...document.querySelectorAll('.native-letter-card')].flatMap(card=>{const bounds=card.getBoundingClientRect();return [...card.querySelectorAll('button')].filter(button=>{const r=button.getBoundingClientRect();return r.width<44||r.height<44||r.left<bounds.left||r.right>bounds.right;}).map(button=>button.getAttribute('aria-label'));}));
  assert.deepEqual(clipped,[],'Letter and word speakers have comfortable targets and stay within their cards');
  assert.equal(await evaluate(()=>document.querySelectorAll('.native-letter-sound svg,.native-letter-silent').length),0,'Letter playback uses the green letters, without another icon or No sound badge');
  return cards;
 }
 const capture=async(name)=>{if(process.env.PRIVET_CYRILLIC_SCREENSHOTS){const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(process.env.PRIVET_SCREENSHOT_DIR??'/private/tmp',`privet-cyrillic-${name}.png`),Buffer.from(shot.data,'base64'));}};
 const stored=key=>evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 async function open(nextSeed={},time=new Date(2026,9,17,12).getTime(),resume=false){
  if(process.env.PRIVET_INTERACTION_DEBUG)console.log(`OPEN ${resume?'resume':'seed'} ${new Date(time).toISOString()}`);
  seed={...(!firstTime?{[FIRST_RUN_KEY]:{...initialFirstRun(),stage:'done',completed:true}}:{}),...(skipQuickStart?{[CYRILLIC_KEY]:{version:1,status:'skipped',page:0}}:{}),...nextSeed};initialTime=time;await evaluate(()=>{window.__oldDocument=true;});
  await call('Page.navigate',{url:origin+'/__privet_native_checks'+(browserPreview?'?native=1&onboarding=1'+(resume?'&resume=1':''):(resume?'?resume=1':''))});
  await until(()=>!window.__oldDocument&&!!document.querySelector('.native-app'));
  if(firstTime)await until(()=>!!document.querySelector('.native-first-run,.native-first-lesson'));else await until(()=>document.querySelectorAll('.native-lesson-card').length===8);
  await pause(80);await assertNativeLayout();
 }
 const startCafe=()=>click('#native-card-cafe ~ .button');
 const storageSnapshot=()=>evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)])));
 async function confirmReplay(){const before=await storageSnapshot();await click('#native-replay-onboarding');assert.ok(await evaluate(()=>document.querySelector('#settings-confirmation[open]')?.textContent.includes('Restart onboarding?')));assert.deepEqual(await storageSnapshot(),before,'Opening replay confirmation does not restart or alter saved data');await click('.native-confirmation-cancel');assert.deepEqual(await storageSnapshot(),before,'Cancel keeps all data and the tour position');assert.equal(await evaluate(()=>document.activeElement?.id),'native-replay-onboarding');await click('#native-replay-onboarding');await click('.native-confirmation-confirm','Restart onboarding');}

 async function openPhysicalSettings(){await click('#native-settings-open');
  assert.ok(await evaluate(()=>{const root=document.querySelector('.native-settings-screen'),family=getComputedStyle(root).fontFamily;return !root.textContent.includes('Revisit the introduction')&&Array.from(root.querySelectorAll('.native-settings-card h2')).every(h=>{const s=getComputedStyle(h);return s.fontFamily===family&&parseFloat(s.fontSize)<=22&&parseFloat(s.letterSpacing)>-1;})&&Array.from(root.querySelectorAll('.native-settings-card button')).every(b=>{const s=getComputedStyle(b);return s.fontFamily===family&&s.textDecorationLine==='none'&&b.getBoundingClientRect().height>=44;});}),'Settings has consistent headings and full touch-target buttons, without the removed replay description');
  await assertNativeLayout();await click('#native-physical-open');}

 async function physicalBackHome(){await click('[aria-label="Back to settings"]');await click('[aria-label="Back to home"]');}
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
  await click('[aria-label="Open your profile and statistics"]');await click('#native-profile-plus-open','Get Plus');await click('.native-plus-plans button','Yearly$39.99 / year · Concept pricing');await click('.native-plus-start','Activate Plus demo');
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
  await click('[aria-label="Back to home"]');await openPhysicalSettings();
  await assertNativeLayout();
  console.log(`PASS ${viewport.width}×${viewport.height}: Plus activate/cancel/reload/zero-heart recovery via lesson and Profile, restored heart consumption, freeze lifecycle→finish, replay reward separation, refill/freeze prices; native panes cannot scroll sideways, all exercises/header controls fit, vertical scroll retained.`);
 }

 // Whole-word readings follow the existing switch without altering answers.
 for(const viewport of [{width:320,height:568},{width:430,height:932}]){
  await call('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true});
  const exchange=freshSession();exchange.progress.index=3;exchange.progress.results=[true,true,true];
  await open({[NATIVE_SESSION_KEY]:exchange});await startCafe();
  assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.native-russian-reading')].map(node=>node.textContent)),['vash chai','spa-SEE-ba','pree-VYET','ya kha-CHOO chai']);
  await capture(`latin-exchange-${viewport.width}`);
  await click('.choice','1Спасибо!');const before=await stored(NATIVE_SESSION_KEY);
  await click('[aria-label="Lesson display settings"]');await click('[aria-label="Pronunciation help"]');await click('[aria-label="Lesson display settings"]');
  assert.equal(await evaluate(()=>document.querySelectorAll('.native-russian-reading').length),0);
  await click('[aria-label="Open Cyrillic guide"]');await assertLetterExamples();await click('[aria-label="Close Cyrillic guide"]');
  assert.deepEqual(await stored(NATIVE_SESSION_KEY),before,'Guide and pronunciation toggles preserve selection, progress and rewards');
  await open({},initialTime,true);await startCafe();assert.equal(await evaluate(()=>document.querySelectorAll('.native-russian-reading').length),0,'Reading preference survives reload');
  await click('[aria-label="Lesson display settings"]');await click('[aria-label="Pronunciation help"]');await click('[aria-label="Lesson display settings"]');
  assert.equal(await evaluate(()=>document.querySelectorAll('.native-russian-reading').length),4);
  assert.equal((await stored(NATIVE_SESSION_KEY)).selected,'Спасибо!','Persist the canonical Russian choice, never its Latin reading');
  console.log(`PASS ${viewport.width}×${viewport.height}: dialogue/choice Latin readings follow pronunciation settings and reload, preserve answers/session, and alphabet readings stay available with help off.`);
 }

 // Explicit native UI actions go through the real root controller and transport.
 russianAudio=true;
 await open();await openPhysicalSettings();await click('.native-physical-actions .button','Connect');
 await click('.native-physical-devices button');
 await until(()=>document.querySelector('.native-physical-status').textContent.includes('Reaction accepted'));
 assert.deepEqual(await evaluate(()=>window.__bleCommands),[9],'Fresh subscription sends CONNECTED once');
 await physicalBackHome();await startCafe();
 assert.deepEqual(await evaluate(()=>window.__bleCommands),[9,4,6],'Fresh Lesson 1 enters THINKING after CONNECTED/home IDLE');
 const codes=()=>evaluate(()=>window.__bleCommands);
 await evaluate(()=>{window.__bleCommands=[];});
 await click('.word-audio');await until(()=>window.__bleCommands.length===2);
 assert.deepEqual(await codes(),[5,6]);assert.equal((await evaluate(()=>window.__speechTaps)).length,1);
 // Voice refresh and unrelated settings renders never emit physical commands.
 await evaluate(()=>{for(const fn of window.__voiceListeners)fn();});
 await click('[aria-label="Lesson display settings"]');await click('[aria-label="Stress marks"]');await click('[aria-label="Lesson display settings"]');
 assert.deepEqual(await codes(),[5,6]);
 await evaluate(()=>{window.__russianAudio=false;for(const fn of window.__voiceListeners)fn();});
 await until(()=>!document.querySelector('.word-audio'));assert.deepEqual(await codes(),[5,6]);
 await evaluate(()=>{window.__russianAudio=true;for(const fn of window.__voiceListeners)fn();});
 for(let n=0;n<5;n++)await evaluate(n=>document.querySelectorAll('.vocab-reveal')[n].click(),n);
 await click('.lesson-bottom .button','Check answer');await click('.lesson-bottom .button','Continue');
 assert.deepEqual((await codes()).slice(-2),[1,6]);
 await evaluate(()=>{window.__bleCommands=[];});await click('.round-audio');await click('.lesson-hint-button');
 assert.deepEqual(await codes(),[5,6,7]);assert.equal(await evaluate(()=>document.querySelector('.lesson-hint-button').disabled),true);
 await evaluate(()=>document.querySelector('.lesson-hint-button').click());assert.deepEqual(await codes(),[5,6,7]);
 await click('.choice','1tea');await click('.lesson-bottom .button','Check answer');await click('.lesson-bottom .button','Try again');
 assert.deepEqual((await codes()).slice(-2),[2,6]);

 // Successful completion restores the unanswered-question context, while a
 // late WebKit callback after submission or navigation must remain silent.
 await evaluate(()=>{window.__bleCommands=[];window.__holdSpeech=true;});
 await click('.round-audio');await evaluate(()=>{const u=window.__utterances.at(-1);window.__lateAudioEnd=u.onend;u.onstart?.();});
 await click('.choice','2coffee');await click('.lesson-bottom .button','Check answer');
 assert.deepEqual(await codes(),[5,1]);await evaluate(()=>window.__lateAudioEnd?.());assert.deepEqual(await codes(),[5,1],'Old audio completion cannot overwrite answer feedback');
 await evaluate(()=>{window.__holdSpeech=false;});await click('.round-audio');
 assert.deepEqual(await codes(),[5,1,5],'Audio on correct feedback must not enter THINKING');
 await click('[aria-label="Return to app home"]');await click('#native-profile-open');
 assert.equal((await codes()).at(-1),4);assert.ok(!(await codes()).includes(8),'Profile entry must not trigger STREAK');
 const beforeOverlay=await codes();await click('#native-profile-plus-open');await click('[aria-label="Back"]');
 assert.deepEqual(await codes(),beforeOverlay,'Returning to already-open profile must remain silent');
 await click('[aria-label="Back to home"]');assert.equal((await codes()).at(-1),4);
 // Disconnect remains effective; audio still works independently of hardware.
 await openPhysicalSettings();await click('.native-physical-disconnect','Disconnect');await physicalBackHome();await startCafe();
 const disconnectedCodes=await codes();await click('.round-audio');assert.deepEqual(await codes(),disconnectedCodes);
 console.log('PASS: native pronunciation taps→LISTENING, first hint tap→HINT, Continue/retry→THINKING, profile entry stays silent, fresh subscription→CONNECTED; audio completion restores THINKING only for unanswered questions; stale completion after submission is ignored; settings/voices/overlays do not replay; audio works disconnected. Mock BLE/voice only.');

 // Resolve the target lesson before changing selection, including when a
 // different saved lesson was selected at mount. Drive the actual home cards.
 async function connectAtHome(){
  await openPhysicalSettings();await click('.native-physical-actions .button','Connect');await click('.native-physical-devices button');
  await until(()=>document.querySelector('.native-physical-status').textContent.includes('Reaction accepted'));
  await physicalBackHome();await evaluate(()=>{window.__bleCommands=[];});
 }
 const complete=freshSession();complete.progress={...complete.progress,index:5,results:[true,true,true,true,true],complete:true};
 const paused=meaning();paused.progress={...paused.progress,hearts:0,failed:true,attempts:3,feedback:'incorrect'};
 const answered=meaning();answered.progress={...answered.progress,attempts:1,feedback:'correct'};answered.selected='coffee';
 const lesson2Key=sessionKey(nativeLessons[1]);
 for(const scenario of [
  {name:'fresh Lesson 1',seed:{},id:'cafe',command:6},
  {name:'fresh Lesson 2',seed:{},id:nativeLessons[1].id,command:6},
  {name:'resume Lesson 1 while completed Lesson 2 was selected',seed:{[NATIVE_SESSION_KEY]:meaning(),[lesson2Key]:complete},id:'cafe',command:6},
  {name:'completed Lesson 1 results while active Lesson 2 was selected',seed:{[NATIVE_SESSION_KEY]:complete,[lesson2Key]:meaning()},id:'cafe',command:4},
  {name:'completed Lesson 2 results',seed:{[lesson2Key]:complete},id:nativeLessons[1].id,command:4},
  {name:'failed Lesson 1 while active Lesson 2 was selected',seed:{[NATIVE_SESSION_KEY]:paused,[lesson2Key]:meaning()},id:'cafe',command:4},
  {name:'already-answered feedback',seed:{[NATIVE_SESSION_KEY]:answered},id:'cafe',command:4},
 ]){
  await open(scenario.seed);await connectAtHome();await click(`#native-card-${scenario.id} ~ .button`);
  assert.deepEqual(await codes(),[scenario.command],scenario.name);
  assert.equal(await evaluate(()=>document.querySelector('.app-navigation strong').textContent),nativeLessons.find(lesson=>lesson.id===scenario.id).title);
  assert.ok(!(await codes()).includes(3),'Saved completion must never replay CELEBRATE');
  const expected=[scenario.command];
  if(scenario.name.startsWith('completed')){
   await click('.completion button','Replay the lesson');expected.push(6);
   assert.deepEqual(await codes(),expected,'Replay replaces the reset with THINKING, with no intermediate IDLE write');
   assert.ok(await evaluate(()=>document.querySelector('.lesson-step-count').textContent.includes('STEP 1 OF 5')));
  }
  await click('[aria-label="Return to app home"]');assert.deepEqual(await codes(),[...expected,4],`${scenario.name}: close sends IDLE`);
 }
 for(const definition of nativeLessons.slice(2)){
  await open();await connectAtHome();await click(`#native-card-${definition.id} ~ .button`);assert.deepEqual(await codes(),[6]);
  await click('[aria-label="Return to app home"]');assert.equal((await codes()).at(-1),4);
 }
 // Latest finished practice can be lower without reducing the Home high score.
 const lowerResult={...complete,progress:{...complete.progress,results:[true,true,false,false,false]}};
 await open({[NATIVE_SESSION_KEY]:lowerResult,[savedKey(nativeLessons[0])]:{preferences:{stress:false,pronunciation:true},bestFirstTry:5,completion:{results:Array(5).fill(true),date:'2026-10-23'}}});
 await startCafe();assert.ok(await evaluate(()=>document.querySelector('.completion .score').textContent.includes('2/ 5')));
 assert.ok(await evaluate(()=>document.querySelector('.completion .score').textContent.includes('Correct on firstsubmission')));
 await click('[aria-label="Return to app home"]');
 assert.ok(await evaluate(()=>document.querySelector('#native-card-cafe').closest('.native-lesson-card').querySelector('.native-card-progress').textContent.includes('Best: 5/5')));
 const latestPractice=await stored(savedKey(nativeLessons[0]));assert.equal(latestPractice.bestFirstTry,5);assert.equal(latestPractice.completion.results.filter(Boolean).length,2);
 // A replay is a new attempt, not a revocation of previously earned completion.
 for(const definition of [nativeLessons[0],nativeLessons[2]]){
  const steps=definition.exercises.length,finished={...complete,progress:{...complete.progress,index:steps,results:Array(steps).fill(true)}};
  await open({[sessionKey(definition)]:finished});await click(`#native-card-${definition.id} ~ .button`);
  await click('.completion button','Replay the lesson');await click('[aria-label="Return to app home"]');
  for(let reload=0;reload<2;reload++){
   const card=await evaluate(id=>{const el=document.querySelector(`#native-card-${id}`).closest('.native-lesson-card');return {state:el.querySelector('.native-path-state').textContent,action:el.querySelector('.button').textContent,progress:el.querySelector('progress').value};},definition.id);
   assert.equal(card.state,'Passed');assert.ok(card.action.includes('Continue practice'));assert.equal(card.progress,steps);
   if(reload===0)await open({},initialTime,true);
  }
  await click(`#native-card-${definition.id} ~ .button`);assert.ok(await evaluate(steps=>document.querySelector('.lesson-step-count').textContent.includes(`STEP 1 OF ${steps}`),steps));
 }
 await open({[lesson2Key]:complete});await connectAtHome();await click(`#native-card-${nativeLessons[1].id} ~ .button`);
 assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.completion > button')].map(el=>({label:el.textContent.replace(/[→↻]/g,'').trim(),primary:el.classList.contains('teal')}))),[{label:'Continue to Lesson 3',primary:true},{label:'Replay the lesson',primary:false}],'Lesson 2 offers the next catalogue lesson and replay underneath');
 await click('[aria-label="Return to app home"]');assert.ok(await evaluate(()=>!!document.querySelector('.native-home-scroll')));
 assert.deepEqual(await codes(),[4,4],'Completion home action uses the existing close/IDLE path');
 assert.equal((await stored(lesson2Key)).progress.complete,true,'Returning home preserves completed results');
 await open({[NATIVE_SESSION_KEY]:complete,[lesson2Key]:meaning()});await connectAtHome();await startCafe();
 assert.deepEqual(await codes(),[4]);await click('.native-next-lesson','Continue to Lesson 2');
 assert.deepEqual(await codes(),[4,6],'Direct lesson-view switch uses active target, not completed previous lesson');
 await open();await startCafe();await click('[aria-label="Return to app home"]');await click(`#native-card-${nativeLessons[1].id} ~ .button`);
 assert.deepEqual(await codes(),[],'Disconnected lesson entries/close must send nothing');
 console.log('PASS: connected Lesson 1/2 start, saved resume and direct target switch→THINKING; completed/failed/answered target→IDLE without celebration; close→IDLE; disconnected entry sends nothing. Mock BLE only.');

 // Optional Cyrillic onboarding has no lesson/reward side effects. Existing
 // scenarios above explicitly seed it as skipped; test first-run behavior here.
 skipQuickStart=false;russianAudio=false;
 const rewardKeys=[NATIVE_STATS_KEY,NATIVE_SESSION_KEY,sessionKey(nativeLessons[1])];
 const rewardSnapshot=()=>evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),rewardKeys);
 for(const viewport of [{width:375,height:667},{width:430,height:932}]){
  await call('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true});
  await open();assert.ok(await evaluate(()=>!!document.querySelector('.native-quick-card')));await capture(`home-${viewport.width}`);
  const expandedCardHeight=await evaluate(()=>document.querySelector('.native-quick-card').getBoundingClientRect().height);
  await click('.native-quick-card .native-text-button','Skip for now');
  const compactCard=await evaluate(()=>({height:document.querySelector('.native-quick-card').getBoundingClientRect().height,collapsed:document.querySelector('.native-quick-card').classList.contains('is-collapsed')}));
  assert.equal(compactCard.collapsed,true);assert.ok(compactCard.height<expandedCardHeight/2,'Skip visibly collapses the card');await capture(`skipped-${viewport.width}`);
  await open({},initialTime,true);assert.ok(await evaluate(()=>!!document.querySelector('.native-quick-card.is-collapsed')),'Skip persists across reload');
  await click('#native-quick-open','Open');assert.ok(await evaluate(()=>!!document.querySelector('.native-quick-screen')),'Compact card remains reopenable');
  await click('[aria-label="Back to home"]');await open();

  await startCafe();await until(()=>!!document.querySelector('#native-cyrillic-recommendation:modal'));
  await click('#native-cyrillic-recommendation button','Start Lesson 1 anyway');
  assert.equal((await stored(CYRILLIC_KEY)).status,'skipped');
  await click('[aria-label="Return to app home"]');await startCafe();
  assert.equal(await evaluate(()=>!!document.querySelector('#native-cyrillic-recommendation')),false);
  await click('[aria-label="Return to app home"]');

  await open();await startCafe();await click('#native-cyrillic-recommendation button','Try the quick start');
  assert.ok(await evaluate(()=>!!document.querySelector('.native-quick-screen')));
  await click('[aria-label="Back to home"]');
  assert.ok(await evaluate(()=>!!document.querySelector('.native-quick-card.is-collapsed')),'Opening quick start keeps the home card compact afterwards');
  const before=await rewardSnapshot();await click('#native-quick-open');
  assert.equal(await evaluate(()=>document.querySelectorAll('.native-letter-card').length),5);await assertLetterExamples();
  assert.equal(await evaluate(()=>document.querySelectorAll('.native-letter-audio,.native-letter-sound').length),0);
  assert.ok(await evaluate(()=>document.querySelector('.native-alphabet-note:last-child').textContent.includes('unavailable')));
  await click('.native-quick-actions .button','Continue');
  assert.equal((await stored(CYRILLIC_KEY)).page,1);assert.equal(await evaluate(()=>document.querySelectorAll('.is-tricky .native-letter-card').length),6);await capture(`tricky-${viewport.width}`);
  await click('[aria-label="Back to home"]');await open({},initialTime,true);await click('#native-quick-open','Continue');
  assert.ok(await evaluate(()=>document.querySelector('.native-quick-progress').textContent.includes('Page 2')));
  await click('.native-quick-actions .button','Continue');await click('.native-quick-actions .button','Continue');
  await click('.native-reading-reveal');assert.ok(await evaluate(()=>document.querySelector('.native-reading-reveal').textContent.includes('coffee')));
  await click('.native-quick-actions .button','Finish quick start');
  assert.equal((await stored(CYRILLIC_KEY)).status,'completed');
  assert.deepEqual(await rewardSnapshot(),before,'Quick start must not change lesson progress, stats, hearts, XP, gems or streaks');
  assert.ok(await evaluate(()=>document.querySelector('.native-quick-scroll').textContent.includes('You don’t need to memorize everything.')));
  assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.native-quick-actions button')].map(button=>({label:button.textContent.replace('→','').trim(),primary:button.classList.contains('teal')}))),[{label:'Start Lesson 1',primary:true},{label:'Go back home',primary:false}]);
  await click('.native-quick-actions .native-text-button','Go back home');assert.ok(await evaluate(()=>!!document.querySelector('.native-quick-card.is-collapsed')),'Completed quick start keeps its compact card');await capture(`completed-card-${viewport.width}`);await click('#native-quick-open','Review');
  assert.ok(await evaluate(()=>document.querySelector('.native-quick-progress').textContent.includes('Page 1')));
  await click('[aria-label="Back to home"]');assert.equal((await stored(CYRILLIC_KEY)).status,'completed');
  await click('#native-quick-open');for(let n=0;n<3;n++)await click('.native-quick-actions .button','Continue');
  await click('.native-quick-actions .button','Finish quick start');await click('.native-quick-actions .button','Start Lesson 1');
  assert.ok(await evaluate(()=>document.querySelector('.lesson-step-count').textContent.includes('STEP 1')));
  assert.equal(await evaluate(()=>!!document.querySelector('#native-cyrillic-recommendation')),false);
  await click('[aria-label="Return to app home"]');await click('#native-settings-open');await click('.native-profile-scroll .native-text-button','Reset saved lesson & preferences');
  const beforeReset=await storageSnapshot();assert.equal((await stored(CYRILLIC_KEY)).status,'completed','Opening reset confirmation preserves progress');await click('.native-confirmation-cancel');assert.deepEqual(await storageSnapshot(),beforeReset,'Cancel reset removes nothing');
  await click('.native-settings-reset');await click('[aria-label="Close Reset saved data?"]');assert.deepEqual(await storageSnapshot(),beforeReset,'Close resets nothing');
  await click('.native-settings-reset');await click('.native-confirmation-confirm','Reset saved data');
  assert.equal(await stored(CYRILLIC_KEY),null,'Full reset removes onboarding storage');

  for(const [index,value] of [[1,'tea'],[2,'Я'],[4,'спа']]){
   const session=freshSession();session.progress.index=index;session.progress.results=Array(index).fill(true);
   if(index===2)session.tokens=[value];else session.selected=value;
   await open({[NATIVE_SESSION_KEY]:session});await startCafe();
   const saved=await stored(NATIVE_SESSION_KEY);
   const top=await evaluate(()=>{const pane=document.querySelector('.lesson-scroll');pane.scrollTop=45;return pane.scrollTop;});
   await click('[aria-label="Open Cyrillic guide"]');await until(()=>!!document.querySelector('#native-alphabet-guide:modal'));
   const visibleSheet=await evaluate(()=>{const panel=document.querySelector('#native-alphabet-guide .native-sheet-panel'),scroll=document.querySelector('#native-alphabet-guide .native-sheet-scroll');const r=panel.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,body:scroll.clientHeight};});
   assert.ok(visibleSheet.top>=0&&visibleSheet.bottom<=viewport.height+1&&visibleSheet.height>viewport.height*.75&&visibleSheet.body>200,`Guide body must fit and be readable: ${JSON.stringify(visibleSheet)}`);

   if(index===1)await capture(`guide-${viewport.width}`);
   const expected=contextualLetters(nativeLessons[0],nativeLessons[0].exercises[index]).map(item=>`${item.upper} ${item.lower}`);
   assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('#native-alphabet-guide .native-letter-heading strong')].map(el=>el.textContent)),expected);
   await click('.native-guide-tabs button','See full alphabet');assert.equal(await evaluate(()=>document.querySelectorAll('#native-alphabet-guide .native-letter-card').length),33);
   assert.ok(await evaluate(()=>document.querySelector('#native-alphabet-guide').textContent.includes('Ё')));
   await click('.native-guide-tabs button','Current exercise');
   await click('[aria-label="Close Cyrillic guide"]');
   assert.deepEqual(await stored(NATIVE_SESSION_KEY),saved,'Guide preserves choice, sentence or typed input');
   assert.equal(await evaluate(()=>document.querySelector('.lesson-scroll').scrollTop),top,'Lesson scroll is preserved');
   assert.equal(await evaluate(()=>document.activeElement.getAttribute('aria-label')),'Open Cyrillic guide');
   // The reference remains available with inline pronunciation disabled.
   await click('[aria-label="Lesson display settings"]');await click('[aria-label="Pronunciation help"]');await click('[aria-label="Lesson display settings"]');
   await click('[aria-label="Open Cyrillic guide"]');assert.ok(await evaluate(()=>!!document.querySelector('#native-alphabet-guide:modal')));await click('[aria-label="Close Cyrillic guide"]');
  }
  console.log(`PASS ${viewport.width}×${viewport.height}: optional recommendation/skip, persisted quick-start resume/review/reset, no rewards/progress changes; contextual/full alphabet and unchanged choice/sentence/typed input, scroll/focus; no-audio fallback.`);
 }

 // WebKit can expose a visual viewport smaller/offset from the layout viewport
 // when keyboard dismissal or browser chrome changes. A max-height alone is insufficient.
 await open({[NATIVE_SESSION_KEY]:meaning()});await startCafe();
 await evaluate(()=>{
  window.__realVisualViewportDescriptor=Object.getOwnPropertyDescriptor(window,'visualViewport');
  window.__sheetViewport=Object.assign(new EventTarget(),{height:420,offsetTop:35});
  Object.defineProperty(window,'visualViewport',{configurable:true,value:window.__sheetViewport});
 });
 await click('[aria-label="Open Cyrillic guide"]');
 const sheetBounds=()=>evaluate(()=>{const r=document.querySelector('.native-sheet-panel').getBoundingClientRect();return {top:r.top,bottom:r.bottom,body:document.querySelector('.native-sheet-scroll').clientHeight};});
 let bounds=await sheetBounds();assert.ok(bounds.top>=35&&bounds.bottom<=455&&bounds.body>150,JSON.stringify(bounds));
 await evaluate(()=>{window.__sheetViewport.height=300;window.__sheetViewport.offsetTop=20;window.__sheetViewport.dispatchEvent(new Event('resize'));});
 bounds=await sheetBounds();assert.ok(bounds.top>=20&&bounds.bottom<=321&&bounds.body>80,JSON.stringify(bounds));
 await click('.native-guide-tabs button','See full alphabet');
 const scrolls=await evaluate(()=>{const node=document.querySelector('.native-sheet-scroll');node.scrollTop=node.scrollHeight;return {top:node.scrollTop,height:node.clientHeight,total:node.scrollHeight};});
 assert.ok(scrolls.top>0&&scrolls.total>scrolls.height,'Full alphabet scrolls inside bounded sheet');
 await click('[aria-label="Close Cyrillic guide"]');await evaluate(()=>{if(window.__realVisualViewportDescriptor)Object.defineProperty(window,'visualViewport',window.__realVisualViewportDescriptor);else delete window.visualViewport;});
 console.log('PASS: sheet bounds/scrolling track offset and resized visual viewports; Skip produces a persistent compact, reopenable card.');
 // Guide audio shares the real pronunciation lifecycle and semantic callbacks.
 russianAudio=true;await open({[NATIVE_SESSION_KEY]:meaning()});await connectAtHome();await startCafe();
 await evaluate(()=>{window.__bleCommands=[];});await click('[aria-label="Open Cyrillic guide"]');await click('#native-alphabet-guide .native-letter-audio');
 assert.deepEqual(await codes(),[5,6],'Guide audio uses LISTENING then successful-end THINKING');
 await evaluate(()=>{window.__bleCommands=[];});await click('#native-alphabet-guide .native-letter-sound');assert.deepEqual(await codes(),[5,6],'Letter speech shares the guide LISTENING/THINKING callbacks');
 await evaluate(()=>{window.__bleCommands=[];window.__holdSpeech=true;});await click('#native-alphabet-guide .native-letter-audio');
 await evaluate(()=>{const u=window.__utterances.at(-1);window.__lateGuideEnd=u.onend;u.onstart?.();});
 await click('[aria-label="Close Cyrillic guide"]');await evaluate(()=>window.__lateGuideEnd?.());assert.deepEqual(await codes(),[5],'Closing guide invalidates pending speech completion');
 await click('.choice','2coffee');await click('.lesson-bottom .button','Check answer');await evaluate(()=>window.__lateGuideEnd?.());assert.deepEqual(await codes(),[5,1],'Stale guide audio cannot overwrite correct feedback');
 // The second lesson has the same header/reference without changing its session.
 await open({[sessionKey(nativeLessons[1])]:meaning()});await click(`#native-card-${nativeLessons[1].id} ~ .button`);await click('[aria-label="Open Cyrillic guide"]');await click('[aria-label="Close Cyrillic guide"]');
 console.log('PASS: guide audio uses the shared controller and guarded LISTENING/THINKING callbacks; closing cancels stale completion; both lessons expose the reference.');
 // Exercise real pointer capture with mouse and touch, not synthetic .click().
 for(const [lesson,words,input] of [[nativeLessons[0],['чай','Я','хочу'],'mouse'],[nativeLessons[1],['Анна','Меня','зовут'],'touch']]){
  await call('Emulation.setDeviceMetricsOverride',{width:375,height:667,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:input==='touch',maxTouchPoints:1});
  const session=freshSession();session.progress.index=2;session.progress.results=[true,true];session.tokens=words;
  const key=sessionKey(lesson);await open({[key]:session});await click(`#native-card-${lesson.id} ~ .button`);
  await evaluate(()=>{document.querySelector('.sentence-answer').scrollIntoView({block:'center'});});await pause(80);
  const points=await evaluate(()=>[...document.querySelectorAll('.sentence-answer button')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}));
  const [from,,to]=points;
  if(input==='mouse'){
   await call('Input.dispatchMouseEvent',{type:'mouseMoved',...from});
   await call('Input.dispatchMouseEvent',{type:'mousePressed',...from,button:'left',clickCount:1});
   await call('Input.dispatchMouseEvent',{type:'mouseMoved',...to,button:'left',buttons:1});
  }else{
   await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});
   await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...to,id:1}]});
  }
  await until(()=>!!document.querySelector('.sentence-drag-ghost'));
  if(input==='mouse')await call('Input.dispatchMouseEvent',{type:'mouseReleased',...to,button:'left',clickCount:1});
  else await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const expected=[words[1],words[2],words[0]];
  await until(expected=>JSON.stringify([...document.querySelectorAll('.sentence-answer button')].map(el=>el.dataset.word))===JSON.stringify(expected),expected);
  assert.deepEqual((await stored(key)).tokens,expected,'Dragging reorders without removing a token');
  assert.equal(await evaluate(()=>!!document.querySelector('.sentence-drag-ghost')),false);
  // Keyboard users can reorder without dragging; ordinary taps still remove.
  await evaluate(()=>{const el=document.querySelectorAll('.sentence-answer button')[2];el.focus();el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,bubbles:true}));});
  assert.deepEqual((await stored(key)).tokens,[words[1],words[0],words[2]]);
  assert.equal(await evaluate(()=>document.activeElement.dataset.word),words[0]);
  await click('.sentence-answer button');assert.deepEqual((await stored(key)).tokens,[words[0],words[2]]);
  // Reload restores reordered canonical words through the existing session format.
  await open({},undefined,true);await click(`#native-card-${lesson.id} ~ .button`);
  assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.sentence-answer button')].map(el=>el.dataset.word)),[words[0],words[2]]);
  await click('.word-bank button',words[1]);await click('.lesson-bottom .button','Check answer');
  assert.ok(await evaluate(()=>[...document.querySelectorAll('.sentence-answer button')].every(el=>el.disabled)),'Submitted answers cannot be rearranged');
  await assertNativeLayout();
  console.log(`PASS: ${input} sentence drag, keyboard reorder/focus, tap removal, persistence and feedback locking in ${lesson.id}.`);
 }
 await call('Emulation.setTouchEmulationEnabled',{enabled:false});
 // Safe examples are used in both reference views, not just by the data helper.
 for(const [definition,index] of [[nativeLessons[0],2],[nativeLessons[0],3],[nativeLessons[0],4],[nativeLessons[1],3],[nativeLessons[1],4]]){
  const session=freshSession();session.progress.index=index;session.progress.results=Array(index).fill(true);
  await open({[sessionKey(definition)]:session});await click(`#native-card-${definition.id} ~ .button`);
  await click('[aria-label="Open Cyrillic guide"]');
  for(const full of [false,true]){
   if(full)await click('.native-guide-tabs button','See full alphabet');
   await assertLetterExamples();
   const examples=await evaluate(()=>[...document.querySelectorAll('#native-alphabet-guide .native-letter-card')].map(el=>({letter:el.querySelector('.native-letter-heading strong').textContent.trim().split(' ')[0],example:el.querySelector('.native-letter-example > .native-sr-only').textContent})));
   const normalize=text=>text.normalize('NFD').replace(/\u0301/g,'').normalize('NFC').toLowerCase().replace(/[^а-яё]/g,'');
   for(const item of examples)assert.ok(!normalize(item.example).includes(normalize(definition.exercises[index].answer)),`${definition.id}/${index}/${item.letter} leaked answer`);
   if(full)assert.equal(examples.length,33);
   if(definition.id==='cafe'&&index===4)assert.equal(examples.find(item=>item.letter==='Б').example,'банк');
  }
  await click('[aria-label="Close Cyrillic guide"]');
 }
 console.log('PASS: contextual and full 33-letter reference views conceal Russian sentence, choice and typed answers in both lessons.');
 // A test-only sentence fixture exercises the real shared controls and native
 // persistence. No shipped lesson content, correct answer or storage format changes.
 repeatedSentence=true;
 for(const input of ['mouse','touch']){
  await call('Emulation.setTouchEmulationEnabled',{enabled:input==='touch',maxTouchPoints:1});
  const session=freshSession();session.progress.index=2;session.progress.results=[true,true];
  await open({[NATIVE_SESSION_KEY]:session});await startCafe();
  await click('.word-bank button:nth-child(1)');
  assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.word-bank button')].map(el=>el.disabled)),[true,false,false,false]);
  await click('.word-bank button:nth-child(4)');await click('.word-bank button:nth-child(2)');await click('.word-bank button:nth-child(3)');
  const identities=await evaluate(()=>[...document.querySelectorAll('.sentence-answer button')].map(el=>el.dataset.tokenKey));
  assert.equal(new Set(identities).size,4,'Repeated words have unique render identities');
  await evaluate(()=>{document.querySelector('.sentence-answer').scrollIntoView({block:'center'});});await pause(80);
  const points=await evaluate(()=>[...document.querySelectorAll('.sentence-answer button')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}));
  const from=points[1],to=points[3];
  if(input==='mouse'){
   await call('Input.dispatchMouseEvent',{type:'mouseMoved',...from});await call('Input.dispatchMouseEvent',{type:'mousePressed',...from,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseMoved',...to,button:'left',buttons:1});
  }else{
   await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...to,id:1}]});
  }
  await until(()=>!!document.querySelector('.sentence-drag-ghost'));
  assert.equal(await evaluate(()=>document.querySelectorAll('.sentence-answer [data-dragging="true"]').length),1,'Only the dragged occurrence is highlighted');
  if(input==='mouse')await call('Input.dispatchMouseEvent',{type:'mouseReleased',...to,button:'left',clickCount:1});else await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await until(()=>[...document.querySelectorAll('.sentence-answer button')].map(el=>el.dataset.word).join(' ')==='я знаю что я');
  assert.deepEqual((await stored(NATIVE_SESSION_KEY)).tokens,['я','знаю','что','я']);
  await evaluate(()=>{document.querySelectorAll('.sentence-answer button')[3].focus();});
  for(const position of [2,1,0]){
   await evaluate(()=>{document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,bubbles:true}));});
   await until(position=>document.activeElement.dataset.position===String(position),position);
  }
  await evaluate(()=>{document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',altKey:true,bubbles:true}));});
  await until(()=>document.activeElement.dataset.position==='1');
  assert.deepEqual((await stored(NATIVE_SESSION_KEY)).tokens,['я','я','знаю','что']);
  await click('.sentence-answer button:nth-child(2)');assert.deepEqual((await stored(NATIVE_SESSION_KEY)).tokens,['я','знаю','что']);
  assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.word-bank button')].map(el=>el.disabled)),[true,true,true,false]);
  await click('.word-bank button:nth-child(4)');
  await open({},undefined,true);await startCafe();
  assert.deepEqual((await stored(NATIVE_SESSION_KEY)).tokens,['я','знаю','что','я'],'Duplicate tokens survive reload in the existing string-array session');
  assert.equal(await evaluate(()=>document.querySelectorAll('.sentence-answer button').length),4);
  await click('.lesson-bottom .button','Check answer');assert.equal((await stored(NATIVE_SESSION_KEY)).progress.feedback,'correct','Canonical sentence text remains the checked answer');
  console.log(`PASS: repeated words via ${input}: independent selection, unique keys, single-occurrence drag/removal, position-based keyboard focus, canonical checking and saved-session restoration.`);
 }
 repeatedSentence=false;await call('Emulation.setTouchEmulationEnabled',{enabled:false});
 // Whole-word speech and accessible names remain independent of visual fragments.
 russianAudio=true;skipQuickStart=true;
 await open({[CYRILLIC_KEY]:{version:1,status:'started',page:0}});
 const unchangedKeys=[NATIVE_STATS_KEY,...nativeLessons.map(sessionKey)];
 const beforeAlphabetAudio=await Promise.all(unchangedKeys.map(stored));
 await click('#native-quick-open');
 for(let page=0;page<3;page++){
  const cards=await assertLetterExamples();
  if(page===2)assert.ok(await evaluate(()=>document.querySelector('.native-quick-scroll').textContent.includes('Meet a few more useful Russian letters. You can look them up any time.')));
  if(page===0)await capture('quick-dual-audio');
  for(let index=0;index<cards.length;index++){
   if(!['Ъ','Ь'].includes(cards[index].letter)){
    await click(`.native-letter-card:nth-child(${index+1}) .native-letter-sound`);
    assert.equal(await evaluate(()=>window.__speechTaps.at(-1)),cards[index].letter.toLowerCase(),'Tapping the green letter sends Russian letter text, not its word or English sound guide');
   }else assert.equal(await evaluate(index=>document.querySelectorAll('.native-letter-card')[index].querySelectorAll('.native-letter-sound').length,index),0,'Silent signs have no standalone playback');
   await click(`.native-letter-card:nth-child(${index+1}) .native-letter-audio`);
   assert.equal(await evaluate(()=>window.__speechTaps.at(-1)),cards[index].word,'Quick-start speech gets the full original example');
  }
  if(page<2)await click('.native-quick-actions .button','Continue');
 }
 assert.deepEqual(await Promise.all(unchangedKeys.map(stored)),beforeAlphabetAudio,'Alphabet audio has no rewards or lesson progress side effects');
 await click('[aria-label="Back to home"]');
 for(const definition of nativeLessons){
  const viewport=definition.id==='cafe'?{width:320,height:568}:{width:430,height:932};
  await call('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true});
  await open();await click(`#native-card-${definition.id} ~ .button`);await click('[aria-label="Open Cyrillic guide"]');
  await assertLetterExamples();await click('.native-guide-tabs button','See full alphabet');
  const cards=await assertLetterExamples();assert.equal(cards.length,33);await capture(`guide-dual-audio-${viewport.width}`);
  assert.equal(await evaluate(()=>document.querySelectorAll('.native-letter-sound').length),31,'All speaking letters have their own control, excluding Ъ and Ь');
  assert.deepEqual(new Set(cards.map(card=>card.word)),new Set(CYRILLIC.map(item=>item.example)));
  const tree=await call('Accessibility.getFullAXTree');
  assert.equal(tree.nodes.filter(node=>!node.ignored&&node.role?.value==='StaticText'&&node.name?.value==='Анна').length,1,'The accessibility tree exposes the complete word once, not highlighted fragments');
  for(let index=0;index<cards.length;index++){
   if(!['Ъ','Ь'].includes(cards[index].letter)){
    await click(`.native-letter-sound[aria-label=${JSON.stringify(`Hear letter ${cards[index].letter} (device speech)`)}]`);
    assert.equal(await evaluate(()=>window.__speechTaps.at(-1)),cards[index].letter.toLowerCase(),'Guide letter playback uses the shared Russian speech controller');
   }
   await click(`.native-letter-card .native-letter-audio[aria-label=${JSON.stringify(`Listen to ${cards[index].word}: ${CYRILLIC.find(item=>item.upper===cards[index].letter).meaning}`)}]`);
   assert.equal(await evaluate(()=>window.__speechTaps.at(-1)),cards[index].word,'Guide speech gets the full original example');
  }
  await click('[aria-label="Close Cyrillic guide"]');
 }
 console.log('PASS: all 33 examples have correct non-color target emphasis, one complete accessible Russian word, and unmodified whole-word speech in quick start and both lesson guides; no reward/progress changes.');
 // Quick-start audio uses the root physical companion without becoming a lesson.
 russianAudio=true;await open({[CYRILLIC_KEY]:{version:1,status:'started',page:0}});await connectAtHome();await click('#native-quick-open');
 assert.deepEqual(await codes(),[],'Opening quick start does not autoplay speech or a listening reaction');
 await click('.native-letter-audio');assert.deepEqual(await codes(),[5,4],'Quick-start letter pronunciation sends LISTENING, then IDLE on actual speech completion');
 await evaluate(()=>{window.__bleCommands=[];});await click('.native-letter-sound');assert.deepEqual(await codes(),[5,4],'Standalone letter audio also sends LISTENING then IDLE');
 await evaluate(()=>{window.__bleCommands=[];window.__holdSpeech=true;});await click('.native-letter-audio');
 await evaluate(()=>{const u=window.__utterances.at(-1);window.__oldQuickEnd=u.onend;u.onstart?.();});
 await click('.native-letter-card:nth-child(2) .native-letter-sound');await evaluate(()=>window.__oldQuickEnd?.());
 assert.deepEqual(await codes(),[5,5],'A replaced pronunciation cannot end the new listening reaction');
 await evaluate(()=>{const u=window.__utterances.at(-1);u.onstart?.();u.onend?.();});assert.deepEqual(await codes(),[5,5,4]);
 await evaluate(()=>{window.__bleCommands=[];});await click('.native-letter-audio');
 await evaluate(()=>{const u=window.__utterances.at(-1);window.__oldQuickEnd=u.onend;u.onstart?.();});
 await click('.native-quick-actions .button','Continue');await evaluate(()=>window.__oldQuickEnd?.());
 assert.deepEqual(await codes(),[5,4],'Changing quick-start page cancels speech and restores idle, without a stale completion');
 await click('.native-quick-actions .button','Continue');await click('.native-quick-actions .button','Continue');
 await evaluate(()=>{window.__bleCommands=[];window.__holdSpeech=false;});await click('.native-reading-card .native-letter-audio');
 assert.deepEqual(await codes(),[5,4],'The reading-word pronunciation buttons share LISTENING and IDLE');
 await evaluate(()=>{window.__bleCommands=[];window.__holdSpeech=true;});await click('.native-reading-card .native-letter-audio');
 await evaluate(()=>{const u=window.__utterances.at(-1);window.__oldQuickEnd=u.onend;u.onstart?.();});
 await click('[aria-label="Back to home"]');await evaluate(()=>window.__oldQuickEnd?.());assert.deepEqual(await codes(),[5,4],'Closing while speech is pending cancels its late completion');
 await click('#native-quick-open');await click('.native-reading-card .native-letter-audio');
 await click('.native-quick-actions .button','Finish quick start');await evaluate(()=>{window.__bleCommands=[];});
 await click('.native-quick-actions .button','Start Lesson 1');assert.deepEqual(await codes(),[6],'Quick-start cleanup cannot overwrite the new lesson THINKING context');
 russianAudio=false;await open();await connectAtHome();await click('#native-quick-open');
 assert.equal(await evaluate(()=>document.querySelectorAll('.native-letter-audio,.native-letter-sound').length),0);assert.deepEqual(await codes(),[],'Unavailable speech never emits LISTENING');
 console.log('PASS: connected quick-start letter and reading audio sends LISTENING→IDLE, with replacement/page/close cancellation, no unavailable-audio reaction and no stale cleanup overriding lesson entry.');
 // Reset requires explicit confirmation and keeps Plus and the established BLE link.
 const resetDay=localDay(new Date(initialTime));
 const resetStats={...emptyStats(),days:{[resetDay]:2},xp:{[resetDay]:36},gems:{...emptyStats().gems,balance:60,freezes:1},frozen:[]};
 await open({[NATIVE_STATS_KEY]:resetStats,[NATIVE_SESSION_KEY]:meaning(),[sessionKey(nativeLessons[1])]:meaning(),[CYRILLIC_KEY]:{version:1,status:'completed',page:3},[SUBSCRIPTION_KEY]:{version:1,plan:'monthly',since:resetDay}});await connectAtHome();await click('#native-settings-open');
 const keptPlus=await stored(SUBSCRIPTION_KEY),beforeConnectedReset=await storageSnapshot();
 await click('.native-settings-reset');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until(()=>!document.querySelector('#settings-confirmation'));assert.deepEqual(await storageSnapshot(),beforeConnectedReset,'Escape cancels reset');
 await click('.native-settings-reset');await click('.native-confirmation-confirm','Reset saved data');
 assert.equal((await stored(NATIVE_STATS_KEY)).gems.balance,0);assert.equal((await stored(NATIVE_STATS_KEY)).gems.freezes,0);assert.deepEqual((await stored(NATIVE_STATS_KEY)).days,{});assert.deepEqual((await stored(NATIVE_STATS_KEY)).xp,{});
 for(const key of [NATIVE_SESSION_KEY,sessionKey(nativeLessons[1])])assert.equal((await stored(key))?.progress.index??0,0);
 assert.equal(await stored(CYRILLIC_KEY),null);assert.deepEqual(await stored(SUBSCRIPTION_KEY),keptPlus);assert.ok(await evaluate(()=>document.querySelector('.native-physical-home-status').textContent.includes('Connected')));
 console.log('PASS: reset/replay confirmation, Cancel/Close/Escape, focus restoration, confirmed reset of learning data, preserved Plus and connected BLE.');

 // First-time vertical slice: real lesson engine, isolated onboarding storage,
 // existing subscription/stats hooks and the same root BLE controller.
 async function finishWelcomeLesson(makeMistake=false){
  await until(()=>!!document.querySelector('.native-first-lesson .vocab-grid'));
  if(await evaluate(()=>!!document.querySelector('.native-lesson-tour[open]'))){
   assert.ok(await evaluate(()=>document.querySelector('#lesson-tour-title').textContent==='Meet a word'));
   await evaluate(()=>{const style=document.createElement('style');style.id='tour-large-text-check';style.textContent='.native-tour-card h2{font-size:36px!important}.native-tour-card p{font-size:28px!important}.native-tour-card button{font-size:22px!important}';document.head.append(style);});
   await pause(300);
   assert.ok(await evaluate(()=>{const card=document.querySelector('.native-tour-card'),r=card.getBoundingClientRect(),v=window.visualViewport;return r.top>=(v?.offsetTop??0)&&r.bottom<=(v?.offsetTop??0)+(v?.height??innerHeight)&&r.left>=0&&r.right<=innerWidth&&getComputedStyle(card).overflowY==='auto';}),'Large-text tour card fits the visible viewport and allows scrolling');
   await evaluate(()=>document.querySelector('#tour-large-text-check').remove());

   await click('.native-tour-next','Next');
   if(russianAudio){assert.ok(await evaluate(()=>document.querySelector('#lesson-tour-title').textContent==='Hear it in Russian'));await click('.native-tour-next','Next');}
   assert.ok(await evaluate(()=>document.querySelector('#lesson-tour-title').textContent==='A little letter help'));
   await click('.native-tour-next','Got it');
   assert.equal(await evaluate(()=>document.querySelectorAll('.vocab-card.revealed').length),0,'Tour never changes vocabulary progress');
  }
  await click('[aria-label="Open Cyrillic guide"]');await click('[aria-label="Close Cyrillic guide"]');
  if(russianAudio)await click('.vocab-card .word-audio');
  for(let i=1;i<=3;i++)await click(`.vocab-card:nth-child(${i}) .vocab-reveal`);
  await click('.lesson-bottom .button','Check answer');await click('.lesson-bottom .button','Continue');
  if(makeMistake){await click('.choice','1tea');await click('.lesson-bottom .button','Check answer');await click('.lesson-bottom .button','Try again');}
  await click('.choice','2coffee');await click('.lesson-bottom .button','Check answer');await click('.lesson-bottom .button','Continue');
  await click('.choice','2please');await click('.lesson-bottom .button','Check answer');await click('.lesson-bottom .button','Continue');
  await click('.word-bank button','Кофе,');await click('.word-bank button','пожалуйста');await click('.lesson-bottom .button','Check answer');await click('.lesson-bottom .button','Continue');
  await click('.choice','2Спасибо!');await click('.lesson-bottom .button','Check answer');await click('.lesson-bottom .button','Continue');
  await until(()=>!!document.querySelector('.native-first-lesson .completion'));
 }
 russianAudio=true;firstTime=true;
 for(const viewport of [{width:375,height:667},{width:430,height:932}]){
  await call('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true});
  await open();await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.ok(await evaluate(()=>document.querySelector('.first-scroll h1').textContent.includes('Meet your Russian learning companion')));await capture('welcome');
  assert.equal(await evaluate(()=>document.querySelectorAll('.first-offer').length),0,'No offer before a completed lesson');
  await click('.first-actions .button','Get started');
  for(let story=0;story<3;story++)await click('.first-actions .button','Continue');
  assert.ok(await evaluate(()=>document.querySelector('[data-stage=connection]')?.textContent.includes('Have a physical companion?')));
  const beforeSetup=await codes();await click('.first-connect-button','Connect companion');
  assert.deepEqual(await codes(),beforeSetup,'Opening connection settings does not request access or send a command');
  await click('.native-physical-actions .button','Connect');await until(()=>!!document.querySelector('.native-physical-devices button'));
  await click('[aria-label="Back to companion setup"]');assert.ok(await evaluate(()=>!document.querySelector('.native-physical-devices')),'Leaving setup stops discovery');
  await click('.first-actions .button','Continue with virtual companion');
  for(const reason of REASONS)await click(`.first-options button[aria-label=${JSON.stringify(reason)}]`);
  await click('.first-actions .button','Continue');
  for(const level of LEVELS)await click(`.first-options button[aria-label=${JSON.stringify(level)}]`);
  await click('.first-actions button','Back');assert.ok(await evaluate(()=>document.querySelector('.first-options button[aria-label="Culture"]').getAttribute('aria-pressed')==='true'),'Back from level preserves purpose');
  await click('.first-actions .button','Continue');assert.ok(await evaluate(()=>document.querySelector('.first-options button[aria-label="I know some Russian"]').getAttribute('aria-pressed')==='true'),'Back preserves selected level');
  assert.equal((await stored(FIRST_RUN_KEY)).reason,'Culture');assert.equal((await stored(FIRST_RUN_KEY)).level,'I know some Russian');
  await open({},undefined,true);assert.ok(await evaluate(()=>!!document.querySelector('.first-options button[aria-label="Culture"][aria-pressed="true"]')),'Reload returns to purpose with the saved selection');
  await capture('personalize');await click('.first-actions .button','Continue');assert.ok(await evaluate(()=>!!document.querySelector('.first-options button[aria-label="I know some Russian"][aria-pressed="true"]')),'Stored level remains selected');await click('.first-actions .button','Continue');
  assert.deepEqual(await codes(),[],'Disconnected greeting never initializes or writes Bluetooth');
  await capture('handoff');await click('.first-actions .button','Start lesson');
  const mistake=viewport.width===375;await finishWelcomeLesson(mistake);
  assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.first-result-metrics dd')].map(el=>el.textContent)),mistake?['80%','2/3','3']:['100%','3/3','5']);
  const earned=await stored(NATIVE_STATS_KEY);assert.equal(Object.values(earned.days).reduce((a,b)=>a+b,0),1);assert.equal(earned.onboardingAwarded,true);await capture('completion');
  assert.equal((await stored(NATIVE_SESSION_KEY)).progress.complete,true,'Guided completion credits existing Lesson 1');await capture(`first-result-${viewport.width}`);
  await open({},undefined,true);assert.deepEqual(await stored(NATIVE_STATS_KEY),earned,'Reopening completion cannot duplicate XP, gems or statistics');
  await click('.native-next-lesson','Choose how to continue');assert.equal(await evaluate(()=>document.querySelectorAll('.first-offer').length),3);
  assert.equal(await evaluate(()=>document.querySelectorAll('.first-offer a[href]').length),0);await capture('offer-hero');
  await evaluate(()=>document.querySelector('.first-offer-companion').scrollIntoView({block:'center'}));await capture('offer-companion');
  await evaluate(()=>document.querySelector('.first-offer-free .button').scrollIntoView({block:'center'}));await assertNativeLayout();assert.ok(await evaluate(()=>{const r=document.querySelector('.first-offer-free .button').getBoundingClientRect();return r.height>=44&&r.top>=0&&r.bottom<=innerHeight;}),'Free choice fits the current viewport');await capture('free');assert.equal(await evaluate(()=>window.__openCalls.length),0);
  if(viewport.width===375)await click('.first-offer-free .button','Continue with Free');
  else {await click('.first-plan-options button','Annual Save 33%');await capture('plus-selected');await click('.first-offer-plus .button','Try Privet Plus');assert.equal((await stored(SUBSCRIPTION_KEY)).plan,null,'Paid choice first shows confirmation, without activation');assert.equal(await evaluate(()=>document.querySelectorAll('.first-scroll a[href]').length),0);assert.equal(await evaluate(()=>window.__openCalls.length),0);await capture('confirmation');await click('.first-actions .button','Continue');assert.equal((await stored(SUBSCRIPTION_KEY)).plan,'yearly');}
  assert.ok(await evaluate(()=>document.querySelector('#native-card-cafe').closest('section').textContent.includes('Passed')));
  assert.ok(await evaluate(()=>document.querySelector('#native-card-introductions').closest('section').textContent.includes('Up next')));
  assert.equal((await stored(FIRST_RUN_KEY)).completed,true);firstTime=false;await open({},undefined,true);assert.ok(await evaluate(()=>!!document.querySelector('.native-home-scroll')));firstTime=true;
  assert.deepEqual(await stored(NATIVE_STATS_KEY),earned,'Offer/home/normal relaunch do not grant more rewards');
  console.log(`PASS ${viewport.width}×${viewport.height}: fresh welcome→all personalization selections/reload→companion→guided café with Cyrillic/audio/hearts→completion/reload→concept offer→home/next lesson; one reward receipt, no hardware required.`);
 }
 // Existing paired controller stays mounted during replay, and no learner data
 // or paid entitlement is erased or awarded again by the classroom demonstration.
 firstTime=false;await connectAtHome();
 const preservedKeys=[NATIVE_STATS_KEY,NATIVE_SESSION_KEY,sessionKey(nativeLessons[1]),SUBSCRIPTION_KEY];const preserved=await Promise.all(preservedKeys.map(stored));
 await click('#native-settings-open');await confirmReplay();await evaluate(()=>{window.__bleCommands=[];});
 await click('.first-actions .button','Get started');for(let story=0;story<3;story++)await click('.first-actions .button','Continue');
 assert.ok(await evaluate(()=>document.querySelector('.first-scroll').textContent.includes('Your companion is ready.')));
 await click('.first-actions .button','Continue');assert.deepEqual(await codes(),[1],'Connected setup greets without reconnecting');
 await click('.first-actions .button','Continue');await click('.first-actions .button','Continue');
 await click('.first-actions .button','Start lesson');assert.deepEqual(await codes(),[1,6],'First unanswered onboarding question enters THINKING');
 await finishWelcomeLesson();assert.equal((await codes()).filter(code=>code===3).length,1,'Accepted final Continue sends CELEBRATE exactly once');
 assert.ok(await evaluate(()=>document.querySelector('.xp-breakdown').textContent.includes('practice score')));
 await click('.native-next-lesson','Choose how to continue');await click('.first-offer-companion .button','Explore Companion');
 assert.ok(await evaluate(()=>document.querySelector('.first-scroll').textContent.includes('Nothing was ordered, charged or sent')));
 await click('.first-actions .button','Continue');
 assert.deepEqual(await Promise.all(preservedKeys.map(stored)),preserved,'Replay/companion confirmation preserve all lessons, statistics and Plus');
 await click('#native-settings-open');
 assert.equal(await evaluate(()=>document.querySelector('.native-physical-home-status')?.textContent.includes('Connected')??document.querySelector('#native-physical-open').textContent.includes('Connected')),true,'Established link survives onboarding replay');
 await evaluate(()=>window.privetResetOnboarding());await until(()=>!!document.querySelector('.native-first-run[data-stage="welcome"]'));
 assert.deepEqual(await Promise.all(preservedKeys.map(stored)),preserved,'Developer reset changes only the onboarding flag');
 console.log('PASS: connected replay greeting/THINKING/CELEBRATE, local Companion confirmation, no duplicate rewards or erased data, retained connection and onboarding-only developer reset.');
 // Monthly confirmation uses the same existing subscription demo, with no checkout.
 firstTime=true;
 const restoredResult={...freshSession(),progress:{...freshSession().progress,index:5,complete:true,results:[true,true,true,true,true]}};
 await open({[FIRST_RUN_KEY]:{...initialFirstRun(),stage:'offer',reason:'Travel',level:'New to Russian'},[sessionKey(firstRunLesson)]:restoredResult});
 await click('.first-offer-plus .button','Try Privet Plus');assert.deepEqual(await evaluate(()=>Array.from(document.querySelectorAll('.first-review dl>div')).map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])),[['Selected plan','Monthly'],['Concept price',PLUS_MONTHLY_PRICE+' / month'],['Hearts','Unlimited'],['Payment today','None · local demo']]);
 assert.equal((await stored(SUBSCRIPTION_KEY)).plan,null,'Review must not activate Plus before Continue');
 await click('.first-actions .button','Continue');assert.equal((await stored(SUBSCRIPTION_KEY)).plan,'monthly');
 // The narrower iPhone viewport also keeps choices and the primary action usable.
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
 await open({[FIRST_RUN_KEY]:{...initialFirstRun(),stage:'offer',reason:'Travel',level:'New to Russian'},[sessionKey(firstRunLesson)]:restoredResult});await assertNativeLayout();await evaluate(()=>document.querySelector('.first-offer-free .button').scrollIntoView({block:'center'}));await assertNativeLayout();assert.ok(await evaluate(()=>{const r=document.querySelector('.first-offer-free .button').getBoundingClientRect();return r.width>0&&r.height>=44&&r.top>=0&&r.bottom<=innerHeight;}));assert.equal(await evaluate(()=>document.querySelectorAll('.first-offer a[href]').length),0);await capture('free');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await open();await evaluate(()=>document.querySelector('.first-actions .button').click());assert.ok(await evaluate(()=>document.querySelector('.first-scroll h1').textContent.includes('Listen and repeat')),'No-preference entrance keeps Continue immediately clickable');await capture('reduced-motion');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await open();await click('.first-actions .button','Get started');await click('.first-actions .button','Continue');await click('.first-actions .button','Continue');await click('.first-actions .button','Continue');await click('.first-actions .button','Continue with virtual companion');await click('.first-options button[aria-label="Conversations"]');await click('.first-actions .button','Continue');await click('.first-options button[aria-label="New to Russian"]');await click('.first-actions .button','A little Cyrillic first');assert.ok(await evaluate(()=>!!document.querySelector('[data-stage=alphabet]')));await assertNativeLayout();await click('.first-actions .button','Continue');assert.ok(await evaluate(()=>document.body.textContent.includes('Same shape. Different sound.')));await click('.first-actions .button','Ready for the mini-class');await capture('handoff');await capture('reduced-motion');await assertNativeLayout();
 console.log('PASS: monthly local confirmation, reduced-motion/no-preference entrance interaction, and offer/onboarding controls at 320×568 and 430×932.');

 // A first-time owner can pair before personalization, without leaving onboarding.
 await open({[FIRST_RUN_KEY]:{...initialFirstRun(),stage:'connection'}});
 await click('.first-connect-button','Connect companion');await click('.native-physical-actions .button','Connect');
 await until(()=>!!document.querySelector('.native-physical-devices button'));await click('.native-physical-devices button');
 await until(()=>document.querySelector('.native-physical-status strong')?.textContent==='Connected');
 await click('[aria-label="Back to companion setup"]');assert.ok(await evaluate(()=>document.querySelector('.first-scroll').textContent.includes('Your companion is ready.')));
 await click('.first-actions .button','Continue');await click('.first-options button[aria-label="Travel"]');await click('.first-actions .button','Continue');await click('.first-options button[aria-label="I know some Russian"]');await click('.first-actions .button','Continue');
 assert.ok(await evaluate(()=>document.querySelector('.first-scroll h1').textContent.includes('A little Russian at the café.')),'No product introduction between personalization and mini-class');
 await click('.first-actions .button','Start lesson');assert.deepEqual(await codes(),[9,4,1,6],'Fresh subscription, neutral return from settings, ready greeting, then first-question THINKING without reconnect');
 console.log('PASS: first-time companion setup, scan cancellation, virtual fallback, retained connection and direct mini-class handoff.');
 // Real browser runtime: no native-platform shim, isolated demo storage and no BLE.
 browserPreview=true;russianAudio=false;firstTime=true;
 const originalBrowserData={[NATIVE_SESSION_KEY]:meaning(),[NATIVE_STATS_KEY]:emptyStats(),[SUBSCRIPTION_KEY]:{version:1,plan:'monthly',since:'2026-10-17'}};
 await open(originalBrowserData);
 assert.ok(await evaluate(()=>document.querySelector('.first-scroll h1').textContent.includes('Meet your Russian learning companion')));
 await click('.first-actions .button','Get started');for(let i=0;i<3;i++)await click('.first-actions .button','Continue');
 await click('.first-connect-button','Connect companion');await click('.native-physical-actions .button','Connect');
 await until(()=>document.querySelector('.native-physical-status strong')?.textContent==='Bluetooth unavailable');assert.deepEqual(await codes(),[]);
 await click('.first-actions .button','Continue with virtual companion');await click('.first-options button[aria-label="Travel"]');await click('.first-actions .button','Continue');await click('.first-options button[aria-label="I know some Russian"]');await click('.first-actions .button','Continue');await click('.first-actions .button','Start lesson');await finishWelcomeLesson();await click('.native-next-lesson','Choose how to continue');await click('.first-offer-free .button','Continue with Free');
 for(const [key,value] of Object.entries(originalBrowserData))assert.deepEqual(await stored(key),value,'Browser onboarding must not overwrite ordinary progress or Plus');
 const previewFirstRunKey='privet-demo-v1-onboarding-preview:'+FIRST_RUN_KEY;assert.equal((await stored(previewFirstRunKey)).completed,true);
 firstTime=false;await open({},undefined,true);await click('#native-settings-open');await confirmReplay();await until(()=>!!document.querySelector('.native-first-run[data-stage=welcome]'));
 for(const [key,value] of Object.entries(originalBrowserData))assert.deepEqual(await stored(key),value,'Replay must remain isolated');
 console.log('PASS: browser onboarding URL, unavailable Bluetooth fallback, no-audio full lesson/offers/home, isolated rewards/subscription, reload and Settings replay.');
 // Touch-restored focus is retained without a ring; keyboard navigation is visible.
 browserPreview=false;firstTime=false;await open({[NATIVE_SESSION_KEY]:meaning()});
 await evaluate(()=>document.querySelector('#native-settings-open').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'})));
 await click('#native-settings-open');await click('#native-replay-onboarding');await click('.native-confirmation-cancel');
 assert.ok(await evaluate(()=>{const b=document.querySelector('#native-replay-onboarding');return document.activeElement===b&&getComputedStyle(b).outlineStyle==='none';}),'Touch cancellation restores focus without an outline');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert.ok(await evaluate(()=>{const b=document.activeElement,s=getComputedStyle(b);return b.matches('button:focus-visible')&&s.outlineStyle==='solid'&&s.outlineColor==='rgb(36, 102, 83)';}),'Keyboard Tab has a visible brand-green focus ring');
 await click('[aria-label="Back to home"]');await startCafe();
 await evaluate(()=>document.querySelector('.native-alphabet-trigger').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'})));
 await click('.native-alphabet-trigger');await click('[aria-label="Close Cyrillic guide"]');
 assert.ok(await evaluate(()=>{const b=document.querySelector('.native-alphabet-trigger');return document.activeElement===b&&getComputedStyle(b).outlineStyle==='none';}),'Closing АБВ after touch retains focus without a lingering ring');
 console.log('PASS: pointer-restored Settings/АБВ focus has no ring; real keyboard Tab retains a visible green indicator.');
 // Home chip is discoverable beside the virtual robot and shares the existing BLE controller.
 await open();assert.equal(await evaluate(()=>document.querySelector('#native-companion-chip [role=status]').textContent),'Have a physical companion? Let’s connect it.');
 assert.ok(await evaluate(()=>{const chip=document.querySelector('#native-companion-chip'),r=chip.getBoundingClientRect();return !!chip.closest('.native-companion-bubble')&&getComputedStyle(chip).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(chip).borderTopWidth==='0px'&&!chip.closest('.native-companion-bubble').querySelector('p')&&r.height>=44&&r.width<=innerWidth;}));
 await click('#native-companion-chip');await click('.native-physical-actions .button','Connect');await click('.native-physical-devices button');await until(()=>document.querySelector('.native-physical-status strong')?.textContent==='Connected');
 await click('[aria-label="Back to home"]');assert.equal(await evaluate(()=>document.querySelector('#native-companion-chip [role=status]').textContent),'Companion connected');assert.equal(await evaluate(()=>document.activeElement?.id),'native-companion-chip');
 assert.ok(await evaluate(()=>{const chip=document.querySelector('#native-companion-chip'),r=chip.getBoundingClientRect();return !!chip.querySelector('svg')&&r.width===44&&r.height>=44&&chip.closest('.native-companion-bubble').querySelector('p').textContent==='Привет! Ready for a little Russian?'&&chip.querySelector('[role=status]').classList.contains('native-sr-only');}));
 await click('#native-companion-chip');await click('[aria-label="Back to home"]');assert.ok(await evaluate(()=>document.querySelector('#native-companion-chip').dataset.connected==='true'));
 assert.equal((await codes()).filter(code=>code===9).length,1,'Home chip never creates a second subscription/reconnect');
 await openPhysicalSettings();await click('.native-physical-disconnect','Disconnect');await physicalBackHome();assert.equal(await evaluate(()=>document.querySelector('#native-companion-chip [role=status]').textContent),'Have a physical companion? Let’s connect it.');
 console.log('PASS: Home companion chip placement, real status, direct settings shortcut, return focus, connection continuity and explicit disconnect.');
 // Capable peripheral: exercise actual native semantic wiring and app-owned
 // card generation; the rest of the suite above deliberately tests legacy v1.
 learningCards=true;russianAudio=true;await open();await openPhysicalSettings();await click('.native-physical-actions .button','Connect');await click('.native-physical-devices button');
 await until(()=>window.__bleFrames.some(p=>p[0]===1&&p[6]===10));await physicalBackHome();await startCafe();
 await until(()=>window.__cards.length>0);assert.equal(await evaluate(()=>window.__cards.at(-1).primary),'Tap a word');
 await click('.vocab-reveal');assert.equal(await evaluate(()=>window.__cards.at(-1).primary),'Привет!');assert.equal(await evaluate(()=>window.__cards.at(-1).secondary),'Hi!');
 await evaluate(()=>document.querySelectorAll('.vocab-reveal').forEach(el=>el.click()));await click('.lesson-bottom .button','Check answer');await click('.lesson-bottom .button','Continue');
 await until(()=>window.__cards.at(-1)?.primary==='кофе');assert.equal(await evaluate(()=>window.__cards.at(-1).secondary),'Choose on phone');
 await click('.choice','1tea');await click('.lesson-bottom .button','Check answer');assert.equal(await evaluate(()=>window.__cards.at(-1).secondary),'Choose on phone');
 await click('.lesson-bottom .button','Try again');await click('.lesson-hint-button');assert.equal(await evaluate(()=>window.__cards.at(-1).primary),'See phone hint');
 await click('.choice','2coffee');await click('.lesson-bottom .button','Check answer');assert.equal(await evaluate(()=>window.__cards.at(-1).mode),5);assert.equal(await evaluate(()=>window.__cards.at(-1).secondary),'coffee');
 await click('[aria-label="Return to app home"]');assert.equal((await codes()).filter(code=>code===9).length,1);
 assert.ok((await evaluate(()=>window.__bleFrames)).every(p=>p.length<=20),'Every native card frame stays within conservative BLE payload');
 console.log('PASS: capable native companion negotiates after CONNECTED, shows explicitly discovered vocabulary, safe prompts/incorrect feedback, hint cue and correctly graded answer; v1 legacy tests remain independent.');
 // New exercise kinds with a capable companion: listening keeps the spoken word off the OLED until graded;
 // matching grades each pair at once, shows progress only, and a slip costs no heart but the first try.
 {
  const town=nativeLessons.find(l=>l.id==='around-town'),plans=nativeLessons.find(l=>l.id==='making-plans');
  const at=(l,kind)=>{const index=l.exercises.findIndex(e=>e.kind===kind),s=freshSession();s.progress={...s.progress,index,results:Array(index).fill(true)};return s;};
  learningCards=true;russianAudio=true;await open({[sessionKey(town)]:at(town,'listen'),[sessionKey(plans)]:at(plans,'match')});
  await openPhysicalSettings();await click('.native-physical-actions .button','Connect');await click('.native-physical-devices button');
  await until(()=>window.__bleFrames.some(p=>p[0]===1&&p[6]===10));await physicalBackHome();
  await click('#native-card-around-town ~ .button');await until(()=>window.__cards.at(-1)?.primary==='Listen on phone');
  const listenStart=await evaluate(()=>window.__cards.length);
  assert.ok(await evaluate(()=>!document.querySelector('.question-word')&&!!document.querySelector('.listen-play')&&!document.querySelector('.choices .native-russian-reading')),'Listening shows a player, no written word and no option readings');
  await click('.listen-play');await until(()=>window.__speechTaps.at(-1)==='Налево.');assert.equal(await evaluate(()=>window.__utterances.at(-1).rate),.8);
  await until(()=>window.__bleCommands.includes(5));
  await click('.listen-slow');await until(()=>window.__utterances.at(-1).rate===.3);
  await click('.listen-skip');assert.ok(await evaluate(()=>document.querySelector('.listen-fallback')?.textContent.includes('na-LYE-va')&&!document.querySelector('.listen-play')),'Can’t listen now shows the written sound guide');
  await click('.choice','3Прямо.');await click('.lesson-bottom .button','Check answer');await until(()=>window.__bleCommands.at(-1)===2);
  await click('.lesson-bottom .button','Try again');await click('.lesson-hint-button');await click('.choice','2Налево.');await click('.lesson-bottom .button','Check answer');
  await until(()=>window.__cards.at(-1)?.mode===5);assert.deepEqual(await evaluate(()=>{const c=window.__cards.at(-1);return [c.primary,c.secondary];}),['Налево.','To the left.']);
  assert.ok((await evaluate(n=>window.__cards.slice(n,-1),listenStart)).every(c=>!/налево/i.test(c.primary+c.secondary)),'The spoken word never reached the OLED before grading');
  assert.equal(await evaluate(()=>document.querySelectorAll('.choices .native-russian-reading').length),3,'Readings return after a correct answer');
  await click('[aria-label="Return to app home"]');
  const pick=text=>evaluate(text=>{const b=[...document.querySelectorAll('.match-item')].find(b=>(b.querySelector('span')?.textContent??b.textContent)===text&&!b.disabled);b.click();return true;},text);
  await click('#native-card-making-plans ~ .button');await until(()=>window.__cards.at(-1)?.primary==='Match the pairs');
  const matchStart=await evaluate(()=>window.__cards.length);
  // Hold speech like a real utterance, so its pronunciation card lands before the end-of-speech context.
  await evaluate(()=>{window.__holdSpeech=true;});await pick('завтра');await until(()=>window.__speechTaps.at(-1)==='завтра');await until(()=>window.__cards.some(c=>c.mode===3&&c.primary==='завтра'&&c.secondary===''));
  await evaluate(()=>{window.__holdSpeech=false;const u=window.__utterances.at(-1);u.onstart?.();u.onend?.();});
  await pick('See you tomorrow!');assert.equal(await evaluate(()=>document.querySelectorAll('.match-item.mismatch').length),2,'A wrong pair flags both sides');
  await until(()=>window.__bleCommands.at(-1)===2);
  const midSession=await stored(sessionKey(plans));assert.deepEqual([midSession.progress.hearts,midSession.progress.attempts,midSession.progress.feedback,midSession.matches],[3,0,null,[]],'A slip costs no heart and nothing is matched');
  await pick('завтра');await pick('tomorrow');await until(()=>window.__cards.at(-1)?.secondary==='1 of 4');
  await pick('today');await pick('сегодня');await until(()=>window.__cards.at(-1)?.secondary==='2 of 4');
  assert.deepEqual((await stored(sessionKey(plans))).matches,['завтра','сегодня'],'Correct pairs persist');
  await pick('Давай гулять!');await pick('Let’s go for a walk!');await until(()=>window.__cards.at(-1)?.secondary==='3 of 4');
  await pick('До завтра!');await pick('See you tomorrow!');
  await until(()=>window.__cards.at(-1)?.primary==='All pairs matched');await until(()=>window.__bleCommands.at(-1)===1);
  assert.ok(await evaluate(()=>document.querySelector('.feedback.correct')&&document.querySelectorAll('.match-item.matched').length===8),'The last pair submits the exercise');
  for(const card of await evaluate(n=>window.__cards.slice(n),matchStart))for(const [ru,en] of plans.exercises.find(e=>e.kind==='match').pairs)assert.ok(!(card.primary.includes(ru)&&card.secondary.includes(en)),`OLED leaked a pair: ${JSON.stringify(card)}`);
  await click('.lesson-bottom .button','Continue');assert.equal((await stored(sessionKey(plans))).progress.results.at(-1),false,'A slipped match is not a first try');
  await click('[aria-label="Return to app home"]');
  // Without a Russian voice, the listening question is still fully answerable from the written sound guide.
  learningCards=false;russianAudio=false;await open({[sessionKey(town)]:at(town,'listen')});await click('#native-card-around-town ~ .button');
  await until(()=>!!document.querySelector('.listen-fallback'));
  assert.ok(await evaluate(()=>document.querySelector('.listen-fallback').textContent.includes('Audio isn’t available')&&document.querySelector('.listen-fallback').textContent.includes('na-LYE-va')&&!document.querySelector('.listen-play')));
  await click('.choice','2Налево.');await click('.lesson-bottom .button','Check answer');await until(()=>!!document.querySelector('.feedback.correct'));
  await assertNativeLayout();
  console.log('PASS: listen-and-choose plays at normal/slow rate, falls back without a voice or on request, and keeps the word off the OLED until graded; match pairs grade per pair, show progress-only cards, cost no heart for a slip and auto-submit.');
 }
 assert.deepEqual(browserErrors,[],'No uncaught browser exceptions');
 console.log('PASS: interaction checks use isolated Chromium shims; no real iPhone, ESP32, speech or payment verification.');
}finally{
 ws?.close();
 if(chrome&&chrome.exitCode===null){chrome.kill('SIGTERM');await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');}
 await server.close();
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
