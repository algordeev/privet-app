// Records the real app (native layout, as on the iPhone) as frame sequences for the promo video.
// Bluetooth is faked the way the interaction checks do it: the app's own hooks, transports and
// screens run, only the radio drivers are replaced, so "connected" robot, Mini and printer states
// and the print buttons are the app's real UI. Chrome's screencast records every painted frame
// with its timestamp while the app runs in real time; the frames are then resampled to exactly 30 fps.
//
//   node promo/capture-app.mjs [clip ...]     (default: all clips; output in promo/out/app/<clip>/)
import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {clips} from './clips.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const outDir=join(root,'promo','out','app');
const FPS=30,SCALE=2,WIDTH=390,HEIGHT=844;
const chromePath=process.env.PRIVET_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const fakeBle=`export function createNativeBleDriver(){let notify;const log=(...a)=>(window.__bleLog||=[]).push(a.join(' '));return new Proxy({
 async initialize(){},async isEnabled(){return true;},async connected(){return true;},async watchEnabled(){},
 async scan(_service,found){setTimeout(()=>found({deviceId:'promo-companion',name:localStorage.getItem('promo-mini')?'Privet-Mini':'Privet-ESP32'}),80);},async stopScan(){},
 async connect(_id,_disconnected){},async disconnect(){},async discover(){},async mtu(){return 185;},
 async subscribe(_id,callback){notify=callback;},
 async write(_id,packet){
  const bytes=Array.from(new Uint8Array(packet.buffer,packet.byteOffset,packet.byteLength));(window.__bleFrames||=[]).push(bytes);
  if(packet.getUint8(0)===2){
   const type=packet.getUint8(1),id=packet.getUint32(2,true);
   if(type===0x12){const ack=new DataView(new ArrayBuffer(8));ack.setUint8(0,2);ack.setUint8(1,0x90);ack.setUint32(2,id,true);ack.setUint8(7,packet.getUint8(7));notify(ack);}
   return;
  }
  (window.__reactions||=[]).push({code:packet.getUint8(6),at:performance.now()});
  const ack=new DataView(packet.buffer.slice(packet.byteOffset,packet.byteOffset+8));ack.setUint8(1,2);
  if(packet.getUint8(6)===10){ack.setUint8(7,0);
   const caps=new DataView(new ArrayBuffer(20));[2,0x80,0,0,0,0,23,20,96,0,64,32,77,0,0,0,0x88,0x13].forEach((v,i)=>caps.setUint8(i,v));caps.setUint32(2,packet.getUint32(2,true),true);notify(caps);}
  notify(ack);
 },async cleanup(){}},{get(t,k){if(typeof k==='string'&&!(k in t)){log('missing',k);return async()=>{};}const f=t[k];return typeof f==='function'?(...a)=>{log(k);return f(...a);}:f;}});}`;
const fakePrinter=`export function createNativePrinterDriver(){return {
 async initialize(){},async isEnabled(){return true;},
 async scan(callback){setTimeout(()=>callback({deviceId:'promo-printer',name:'SC03h'}),30);},async stopScan(){},
 async connect(){},async subscribe(){},
 async write(_id,value){window.__printed=(window.__printed||0)+value.length;},async cleanup(){}};}`;

const server=await createServer({root,mode:'native',appType:'custom',logLevel:'error',cacheDir:join(root,'promo','out','.vite'),
 plugins:[{name:'promo-fake-radios',enforce:'pre',transform(_code,id){
  if(id.endsWith('/src/bleDriver.ts'))return fakeBle;
  if(id.endsWith('/src/printerDriver.ts'))return fakePrinter;
 }}],server:{host:'127.0.0.1',port:0,strictPort:false,hmr:false}});
let seedJson='{}';
server.middlewares.use('/__promo_app',(req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(`<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module">
 window.CapacitorCustomPlatform={name:'ios'};window.Capacitor={PluginHeaders:[{name:'BluetoothLe',methods:[]}]};
 localStorage.clear();for(const [key,value] of Object.entries(${'${seed}'}))localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));
 window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'ru-RU',name:'Promo voice'}],addEventListener(){},removeEventListener(){},cancel(){},speak(u){setTimeout(()=>u.onend?.(),900);}}});
 await import('/src/main.tsx');
 </script></body></html>`.replace('${seed}',seedJson));
});
await server.listen();
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;

const profile=join(root,'promo','out','.chrome');fs.rmSync(profile,{recursive:true,force:true});
const chrome=spawn(chromePath,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--force-color-profile=srgb','about:blank'],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let devPort;for(let i=0;i<400&&!devPort;i++){try{devPort=fs.readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];}catch{await wait(100);}}
let ws,id=0;const pending=new Map(),listeners=new Set(),errors=[];
const send=(method,params={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));}).then(m=>{if(m.error)throw Error(method+': '+m.error.message);return m.result;});
const once=method=>new Promise(r=>{const l=m=>{if(m.method===method){listeners.delete(l);r(m.params);}};listeners.add(l);});
const js=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
// A fresh tab per clip, so nothing carries over between sessions.
async function openTab(){
 if(ws)ws.close();
 const target=await (await fetch(`http://127.0.0.1:${devPort}/json/new?about:blank`,{method:'PUT'})).json();
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);for(const l of listeners)l(m);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:WIDTH,height:HEIGHT,deviceScaleFactor:SCALE,mobile:true});
}

async function runClip(name,clip){
 const dir=join(outDir,name);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
 seedJson=JSON.stringify(clip.seed());
 await openTab();
 await send('Page.navigate',{url:`${origin}/__promo_app`});
 let ready=false;for(let i=0;i<300&&!ready;i++){ready=await js("!!document.querySelector('.native-app')").catch(()=>false);if(!ready)await wait(100);}
 if(!ready)throw Error(`${name}: the app did not start. ${errors.join('\n').slice(0,800)}`);
 await wait(clip.settle??2500);// modules, fonts, auto-reconnect to the fake devices
 // Every painted frame arrives with its timestamp; resampled to exactly FPS at the end.
 const raw=[],now=()=>Date.now()/1000;let start=now();
 const keep=(data,ts)=>{const file=join(dir,`raw-${String(raw.length).padStart(5,'0')}.jpg`);fs.writeFileSync(file,Buffer.from(data,'base64'));raw.push({ts,file});};
 const first=await send('Page.captureScreenshot',{format:'jpeg',quality:93});keep(first.data,start);
 const onFrame=m=>{if(m.method!=='Page.screencastFrame')return;keep(m.params.data,m.params.metadata.timestamp);ws.send(JSON.stringify({id:++id,method:'Page.screencastFrameAck',params:{sessionId:m.params.sessionId}}));};
 listeners.add(onFrame);
 await send('Page.startScreencast',{format:'jpeg',quality:93,maxWidth:WIDTH*SCALE,maxHeight:HEIGHT*SCALE,everyNthFrame:1});
 const taps=[];const at=()=>Math.round((now()-start)*FPS);
 const hold=seconds=>wait(seconds*1000);
 const step=()=>wait(1000/FPS);
 step.labels=async note=>{throw Error(note+': '+await js(`[...document.querySelectorAll('button,input')].filter(b=>b.offsetParent).map(b=>JSON.stringify((b.getAttribute('aria-label')||b.textContent||b.tagName).trim().slice(0,30))).join(' | ')`));};
 // Finds a visible control by its accessible name or text, scrolls it into view and returns its centre.
 const locate=async(text,{exact=false,nth=0}={})=>js(`(()=>{const t=${JSON.stringify(text)};const all=[...document.querySelectorAll('button,a,[role=button],[role=tab]')].filter(b=>b.offsetParent&&!b.disabled);
  const hits=all.filter(b=>{const l=(b.getAttribute('aria-label')||b.textContent||'').trim();return ${exact}?l===t:l.includes(t);});const b=hits[${nth}];if(!b)return null;
  b.scrollIntoView({block:'center',behavior:'instant'});const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
 const tap=async(text,options)=>{
  const point=await locate(text,options);if(!point)throw Error(`${name}: no control "${text}"\n`+await js(`[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>(b.getAttribute('aria-label')||b.textContent).trim().slice(0,40)).join(' | ')`));
  await hold(.25);taps.push({frame:at(),x:point.x,y:point.y});
  // One real press: the browser turns it into exactly one click.
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:'left',clickCount:1});
 };
 const type=async text=>{await js(`document.querySelector('input,textarea')?.focus()`);for(const ch of text){await send('Input.insertText',{text:ch});await hold(.12);}};
 const scroll=async(dy,seconds=.6)=>{const n=Math.round(seconds*FPS);for(let i=0;i<n;i++){const k=(1-Math.cos(Math.PI*(i+1)/n))/2-(1-Math.cos(Math.PI*i/n))/2;await js(`document.querySelectorAll('*').forEach(e=>{if(e.scrollHeight>e.clientHeight+20&&getComputedStyle(e).overflowY.match(/auto|scroll/))e.scrollTop+=${dy*k};})`);await step();}};
 await clip.run({hold,tap,scroll,type,js,step});
 await hold(.2);await send('Page.stopScreencast');listeners.delete(onFrame);
 // Resample: frame n shows the latest paint at or before n/FPS.
 raw.sort((x,y)=>x.ts-y.ts);const end=now(),frames=Math.round((end-start)*FPS);let k=0;
 for(let n=0;n<frames;n++){const t=start+n/FPS;while(k+1<raw.length&&raw[k+1].ts<=t)k++;fs.copyFileSync(raw[k].file,join(dir,String(n).padStart(5,'0')+'.jpg'));}
 for(const r of raw)fs.rmSync(r.file);
 const frame=frames;
 fs.writeFileSync(join(dir,'clip.json'),JSON.stringify({fps:FPS,frames,width:WIDTH*SCALE,height:HEIGHT*SCALE,scale:SCALE,paints:raw.length,taps},null,1));
 console.log(`${name}: ${frame} frames from ${raw.length} paints, ${taps.length} taps`);
}

try{
 const wanted=process.argv.slice(2);
 for(const [name,clip] of Object.entries(clips))if(!wanted.length||wanted.includes(name))await runClip(name,clip);
 if(errors.length)console.log('page errors:',errors.slice(0,5).join('\n'));
}finally{ws?.close();chrome.kill();await server.close();}
