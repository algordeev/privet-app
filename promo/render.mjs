// Renders the promo stage (promo/stage.html) frame by frame in headless Chrome (GPU WebGL).
//   node promo/render.mjs stills 3.5 9 22 ...   → promo/out/stills/<seconds>.png
//   node promo/render.mjs video [from] [to]     → promo/out/video.mp4 (silent) + out/cues.json
import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const out=join(root,'promo','out');fs.mkdirSync(out,{recursive:true});
const [mode='stills',...args]=process.argv.slice(2);
const chromePath=process.env.PRIVET_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const server=await createServer({root,appType:'mpa',logLevel:'error',cacheDir:join(out,'.vite-stage'),server:{host:'127.0.0.1',port:0,strictPort:false,hmr:false}});
await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const profile=join(out,'.chrome-stage');fs.rmSync(profile,{recursive:true,force:true});
const chrome=spawn(chromePath,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'--hide-scrollbars','--force-color-profile=srgb','--use-angle=metal','about:blank'],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let devPort;for(let i=0;i<400&&!devPort;i++){try{devPort=fs.readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];}catch{await wait(100);}}
const target=await (await fetch(`http://127.0.0.1:${devPort}/json/new?about:blank`,{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));}).then(m=>{if(m.error)throw Error(method+': '+m.error.message);return m.result;});
const js=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
await send('Runtime.enable');await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:`${origin}/promo/stage.html`});
let title='';for(let i=0;i<600;i++){title=await js('document.title').catch(()=>'');if(title==='ready')break;await wait(100);}
if(title!=='ready'){console.log('stage did not load:',errors.slice(0,5).join('\n'));process.exit(1);}
const info=await js('({frames:window.promo.frames,fps:window.promo.fps})');
const shot=async(format,quality)=>Buffer.from((await send('Page.captureScreenshot',{format,quality,clip:{x:0,y:0,width:1920,height:1080,scale:1}})).data,'base64');

try{
 fs.writeFileSync(join(out,'cues.json'),JSON.stringify(await js('({cues:window.promo.cues,subtitles:window.promo.subtitles,duration:window.promo.frames/window.promo.fps})'),null,1));
 if(mode==='stills'){
  const dir=join(out,'stills');fs.mkdirSync(dir,{recursive:true});
  for(const s of args.map(Number).sort((a,b)=>a-b)){
   await js(`window.renderFrame(${Math.round(s*info.fps)})`);await wait(50);
   fs.writeFileSync(join(dir,`${s}.png`),await shot('png'));console.log('still',s);
  }
 }else{
  const from=Number(args[0]??0),to=Number(args[1]??info.frames/info.fps);
  const first=Math.round(from*info.fps),last=Math.round(to*info.fps);
  const file=join(out,from===0&&last===info.frames?'video.mp4':`video-${from}-${to}.mp4`);
  const ffmpeg=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(info.fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',file],{stdio:['pipe','inherit','inherit']});
  const started=Date.now();
  for(let n=first;n<last;n++){
   await js(`window.renderFrame(${n})`);
   const image=await shot('jpeg',95);
   if(!ffmpeg.stdin.write(image))await new Promise(r=>ffmpeg.stdin.once('drain',r));
   if(n%60===0)console.log(`frame ${n}/${last} · ${((Date.now()-started)/(n-first+1)).toFixed(0)} ms/frame`);
  }
  ffmpeg.stdin.end();await new Promise(r=>ffmpeg.on('close',r));
  console.log('wrote',file);
 }
 if(errors.length)console.log('page errors:\n'+errors.slice(0,8).join('\n'));
}finally{ws.close();chrome.kill();await server.close();}
