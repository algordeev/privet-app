import {decodeFlowControl,isRowPacket,latticeEnd} from './printerProtocol.ts';

// The thermal printer's own connection, separate from the companion's (src/bleTransport.ts), so both
// can be connected at once. It connects only when the user asks: Connect, or Print while disconnected.
export type PrinterDevice={deviceId:string;name?:string};
export interface PrinterDriver {
 initialize():Promise<void>;
 isEnabled():Promise<boolean>;
 // Unfiltered scan, already narrowed to printer names (see isCatPrinter).
 scan(callback:(device:PrinterDevice)=>void):Promise<void>;
 stopScan():Promise<void>;
 connect(id:string,disconnected:()=>void,timeout:number):Promise<void>;
 subscribe(id:string,callback:(value:DataView)=>void,timeout:number):Promise<void>;
 // Without response; resolves once handed to the system.
 write(id:string,value:Uint8Array):Promise<void>;
 cleanup(id?:string):Promise<void>;
}
export type PrinterPhase='disconnected'|'scanning'|'connecting'|'connected'|'printing'|'unavailable'|'permission-denied'|'error';
// quiet: the app's own background look for the remembered printer; it shows nothing and ends silently.
// offer: that quiet look may show a printer it finds in the "printer found" card (home only).
// auto: the connection was started by the app itself (from a quiet look), not by the user.
export type PrinterState={phase:PrinterPhase;message:string;devices:PrinterDevice[];device?:PrinterDevice;progress?:{sent:number;total:number};busy:boolean;paused?:boolean;quiet?:boolean;offer?:boolean;auto?:boolean};
export type PrintResult='done'|'cancelled'|'failed';
export const PRINTER_IDLE='No printer connected.';
// The printer takes one connection at a time: while iPrint (or another phone) holds it, it can't be
// found or won't connect.
export const PRINTER_BUSY_HINT='If iPrint or another phone is connected to the printer, disconnect it there, then try again.';
export const initialPrinterState=():PrinterState=>({phase:'disconnected',message:PRINTER_IDLE,devices:[],busy:false});
// pace: the gap after each packet, so iOS doesn't drop writes without response.
// stall: how long a flow-control pause may last before the job gives up.
// lookup: the shorter window of a quiet look for the remembered printer.
export const PRINTER_TIMEOUTS={initialize:15000,scan:12000,lookup:5000,connect:10000,subscribe:5000,write:3000,stall:8000,pace:10};
// Consecutive row packets sent together in one write (the printer parses a byte stream). Higher is
// faster; the printer's pause/resume still holds us back if it can't keep up. 1 = one row per write.
export const ROWS_PER_WRITE=2;
type Clock={set:(fn:()=>void,ms:number)=>ReturnType<typeof setTimeout>;clear:(id:ReturnType<typeof setTimeout>)=>void};
const clock:Clock={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)};
class Stalled extends Error {}
// Only the latest few rows' progress is emitted, so a 600-row card doesn't re-render 600 times.
const PROGRESS_EVERY=4;

export function createPrinterTransport(driver:PrinterDriver,emit:(state:PrinterState)=>void,options:{supported?:()=>boolean;clock?:Clock;timeouts?:Partial<typeof PRINTER_TIMEOUTS>;rowsPerWrite?:number}={}){
 const time={...PRINTER_TIMEOUTS,...options.timeouts},timer=options.clock??clock,rowsPerWrite=Math.max(1,Math.floor(options.rowsPerWrite??ROWS_PER_WRITE));
 let state=initialPrinterState(),generation=0,alive=true,active=true,touched=false,cleaning=0;
 let scanTimer:ReturnType<typeof setTimeout>|undefined;
 type Job={generation:number;cancelled:boolean;paused:boolean;wake?:()=>void;done?:Promise<PrintResult>};
 let job:Job|undefined;
 function update(patch:Partial<PrinterState>={}){state={...state,...patch,busy:cleaning>0};if(alive)emit(state);}
 const current=(g:number)=>alive&&generation===g;
 const sleep=(ms:number)=>new Promise<void>(resolve=>{timer.set(resolve,ms);});
 function bounded<T>(promise:Promise<T>,ms:number,message:string):Promise<T>{
  return new Promise((resolve,reject)=>{
   const deadline=timer.set(()=>reject(new Error(message)),ms);
   promise.then(value=>{timer.clear(deadline);resolve(value);},error=>{timer.clear(deadline);reject(error);});
  });
 }
 function clearScanTimer(){if(scanTimer!==undefined)timer.clear(scanTimer);scanTimer=undefined;}
 function cleanup(id?:string){
  if(!touched)return;
  cleaning++;update();
  void driver.cleanup(id).catch(()=>{/* Already gone. */}).finally(()=>{cleaning--;update();});
 }
 function invalidate(phase:PrinterPhase,message:string){
  generation++;clearScanTimer();
  // A running job sees the new generation and stops before its next packet.
  if(job){job.cancelled=true;job.wake?.();}
  const id=state.device?.deviceId;
  update({phase,message,devices:[],device:undefined,progress:undefined,paused:false,quiet:false,offer:false,auto:false});cleanup(id);
 }
 function failure(error:unknown,g:number,fallback:string){
  if(!current(g))return;
  const message=error instanceof Error?error.message:String(error);
  if(/permission|unauthoriz|denied/i.test(message))invalidate('permission-denied','Allow Bluetooth for Privet in iPhone Settings, then try again.');
  else if(/unsupported|unavailable|not enabled|powered off/i.test(message))invalidate('unavailable','Bluetooth is unavailable. Use a real iPhone with Bluetooth turned on.');
  else invalidate('error',fallback);
 }
 // target: the remembered printer, connected to as soon as it's seen.
 // quiet: the app's own background look (see discover); it shows nothing, never reports errors (except
 // a permission denial) and ends silently after a short window.
 async function scan({target,quiet=false,offer=false}:{target?:string;quiet?:boolean;offer?:boolean}={}){
  // Connect or Print during a quiet look: the same scan becomes the visible one, keeping what it found.
  if(!quiet&&alive&&state.phase==='scanning'&&state.quiet){
   const g=generation;clearScanTimer();
   scanTimer=timer.set(()=>{if(current(g)&&state.phase==='scanning')invalidate('disconnected',state.devices.length?'Scan finished. Tap Connect to look again.':`No printer found. Turn it on and keep it close. ${PRINTER_BUSY_HINT}`);},time.scan);
   update({quiet:false,offer:false,message:'Looking for your printer…'});
   return;
  }
  if(!alive||(quiet&&!active)||state.busy||['scanning','connecting','connected','printing'].includes(state.phase))return;
  if(options.supported&&!options.supported()){if(!quiet)update({phase:'unavailable',message:'Printing works only in the Privet iPhone app on a real device.'});return;}
  const g=++generation;touched=true;
  const stop=(phase:PrinterPhase,message:string)=>invalidate(quiet?'disconnected':phase,quiet?PRINTER_IDLE:message);
  update({phase:'scanning',message:quiet?PRINTER_IDLE:'Preparing Bluetooth…',devices:[],device:undefined,progress:undefined,quiet,offer:quiet&&offer,auto:false});
  try{
   await bounded(driver.initialize(),time.initialize,'Bluetooth took too long. Try again.');
   if(!current(g))return;
   const enabled=await bounded(driver.isEnabled(),time.subscribe,'Bluetooth did not respond. Try again.');
   if(!current(g))return;
   if(!enabled){stop('unavailable','Bluetooth is off. Turn it on in iPhone Settings, then try again.');return;}
   if(!quiet)update({message:'Looking for your printer…'});
   scanTimer=timer.set(()=>{
    if(!current(g)||state.phase!=='scanning')return;
    if(state.quiet){invalidate('disconnected',PRINTER_IDLE);return;}
    invalidate('disconnected',state.devices.length?'Scan finished. Tap Connect to look again.':`No printer found. Turn it on and keep it close. ${PRINTER_BUSY_HINT}`);
   },quiet&&!offer?time.lookup:time.scan);
   await bounded(driver.scan(device=>{
    if(!current(g)||state.phase!=='scanning')return;
    const devices=[...state.devices.filter(d=>d.deviceId!==device.deviceId),device];
    update({devices});
    if(target&&device.deviceId===target)void connect(device.deviceId,!!state.quiet);
   }),time.subscribe,'Could not start scanning. Try again.');
  }catch(error){
   const message=error instanceof Error?error.message:String(error);
   if(state.quiet&&current(g)&&!/permission|unauthoriz|denied/i.test(message)){invalidate('disconnected',PRINTER_IDLE);return;}
   failure(error,g,/timed out|too long|did not respond|Could not start/i.test(message)?message:'Could not use Bluetooth. Try again.');
  }
 }
 // The app's own look for the remembered printer, only while nothing else is under way and the app is
 // in the foreground. The caller decides that Bluetooth was granted before (a printer is remembered).
 // - target: the remembered printer, connected to as soon as it is seen.
 // - offer: home's look for any other printer, for the "printer found" card.
 function discover({target,offer=false}:{target?:string;offer?:boolean}){
  if(!alive||!active||state.busy||!['disconnected','error','unavailable'].includes(state.phase)||(!target&&!offer))return Promise.resolve();
  return scan({target,quiet:true,offer});
 }
 // While the "printer found" card is showing, the scan window must not expire under it.
 function holdScan(){if(state.phase==='scanning')clearScanTimer();}
 // "Not now" on the card, or leaving home: end a quiet look without a trace.
 function stopDiscovery(){if(state.phase==='scanning'&&state.quiet)invalidate('disconnected',PRINTER_IDLE);}
 // auto: started by the app itself (a quiet look found the remembered printer); its failures end quietly.
 async function connect(deviceId:string,auto=false){
  const device=state.devices.find(d=>d.deviceId===deviceId);
  if(!alive||state.phase!=='scanning'||!device)return;
  clearScanTimer();const g=generation;
  update({phase:'connecting',device,message:auto?'Reconnecting to the printer…':'Connecting to the printer…',quiet:false,auto});
  try{
   await bounded(driver.stopScan(),time.subscribe,'Could not stop scanning.');
   if(!current(g))return;
   await bounded(driver.connect(deviceId,()=>{
    if(!current(g))return;
    invalidate('disconnected',state.phase==='printing'?'The printer disconnected while printing.':'Printer disconnected.');
   },time.connect),time.connect,'Connection timed out.');
   if(!current(g))return;
   await bounded(driver.subscribe(deviceId,value=>{
    if(!current(g)||!job||job.generation!==g)return;
    const flow=decodeFlowControl(value);
    if(flow==='pause'){job.paused=true;update({paused:true});}
    else if(flow==='resume'){job.paused=false;update({paused:false});job.wake?.();}
   },time.subscribe),time.subscribe,'Printer setup timed out.');
   if(!current(g))return;
   update({phase:'connected',message:'Printer ready.'});
  }catch(error){
   const message=error instanceof Error?error.message:String(error);
   if(auto&&current(g)&&!/permission|unauthoriz|denied/i.test(message)){invalidate('disconnected',PRINTER_IDLE);return;}
   failure(error,g,`Couldn’t connect to the printer. ${PRINTER_BUSY_HINT}`);
  }
 }
 // Waits out a flow-control pause: until resume, cancellation or the stall limit.
 function untilResumed(j:Job){
  return new Promise<void>((resolve,reject)=>{
   const deadline=timer.set(()=>{j.wake=undefined;reject(new Stalled());},time.stall);
   j.wake=()=>{timer.clear(deadline);j.wake=undefined;resolve();};
  });
 }
 // Best effort: closes the lattice so the printer doesn't wait for more rows.
 async function sendEnd(g:number,id:string){
  if(!current(g))return;
  try{await bounded(driver.write(id,latticeEnd()),time.write,'Write timed out.');}catch{/* Still connected or not, nothing more to do. */}
 }
 // Packets from printJob(). Rows sent / total is reported as progress.
 function print(packets:readonly Uint8Array[]):Promise<PrintResult>{
  if(!alive||state.phase!=='connected'||!state.device||job)return Promise.resolve('failed');
  const g=generation,id=state.device.deviceId,total=packets.filter(isRowPacket).length;
  const j:Job={generation:g,cancelled:false,paused:false};job=j;
  update({phase:'printing',message:'Printing…',progress:{sent:0,total},paused:false});
  j.done=(async():Promise<PrintResult>=>{
   let sent=0;
   try{
    for(const {value,rows} of batches(packets,rowsPerWrite)){
     while(j.paused&&!j.cancelled)await untilResumed(j);
     if(j.cancelled||!current(g))break;
     await bounded(driver.write(id,value),time.write,'Write timed out.');
     if(!current(g))break;
     if(rows){const before=sent;sent+=rows;if(Math.floor(sent/PROGRESS_EVERY)>Math.floor(before/PROGRESS_EVERY)||sent===total)update({progress:{sent,total}});}
     await sleep(time.pace);
    }
    if(!current(g))return 'failed';
    if(j.cancelled){
     update({message:'Cancelling…'});
     await sendEnd(g,id);
     if(current(g))update({phase:'connected',message:'Printing cancelled.',progress:undefined,paused:false});
     return 'cancelled';
    }
    update({phase:'connected',message:'Printed.',progress:undefined,paused:false});
    return 'done';
   }catch(error){
    if(!current(g))return 'failed';
    if(error instanceof Stalled){
     await sendEnd(g,id);
     if(current(g))update({phase:'connected',message:'The printer stopped responding. Check the paper and the lid, then try again.',progress:undefined,paused:false});
     return 'failed';
    }
    invalidate('error','Lost the printer while printing. Connect again to retry.');
    return 'failed';
   }finally{if(job===j)job=undefined;}
  })();
  return j.done;
 }
 function cancel(){
  if(job){job.cancelled=true;job.wake?.();return;}
  if(state.phase==='scanning'||state.phase==='connecting')invalidate('disconnected','Cancelled.');
 }
 // A running job is cancelled first, so the lattice is closed before the link goes.
 async function disconnect(message='Printer disconnected.'){
  const running=job;
  if(running){running.cancelled=true;running.wake?.();await running.done;}
  if(state.phase!=='disconnected'||state.device)invalidate('disconnected',message);
 }
 return {scan,discover,holdScan,stopDiscovery,connect:(deviceId:string)=>connect(deviceId),print,cancel,disconnect,getState:()=>state,
  // In the background iOS suspends the web view, so a job would stall: finish it cleanly and release
  // the printer (it takes one connection, e.g. for iPrint).
  setActive(value:boolean){
   active=value;
   if(value)return;
   if(state.quiet&&state.phase==='scanning'){invalidate('disconnected',PRINTER_IDLE);return;}
   if(state.phase!=='disconnected'&&state.phase!=='error')void disconnect('Printer disconnected while Privet was in the background.');
  },
  dispose(){if(job){job.cancelled=true;job.wake?.();}invalidate('disconnected',PRINTER_IDLE);alive=false;},
 };
}
export type PrinterTransport=ReturnType<typeof createPrinterTransport>;
// Joins up to `size` consecutive row packets into one write; every other packet goes on its own.
export function batches(packets:readonly Uint8Array[],size:number){
 const out:{value:Uint8Array;rows:number}[]=[];let group:Uint8Array[]=[];
 const flush=()=>{if(!group.length)return;const value=new Uint8Array(group.reduce((n,p)=>n+p.length,0));let at=0;for(const p of group){value.set(p,at);at+=p.length;}out.push({value,rows:group.length});group=[];};
 for(const value of packets){
  if(isRowPacket(value)){group.push(value);if(group.length>=size)flush();}
  else{flush();out.push({value,rows:0});}
 }
 flush();return out;
}
