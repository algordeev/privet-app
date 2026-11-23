import {CMD,decodeFlowControl,isRowPacket,latticeEnd,notificationCommand} from './printerProtocol.ts';
import {DEVICE} from './device.ts';

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
 // Without response; resolves once handed to the system, not once the link has room for it.
 write(id:string,value:Uint8Array):Promise<void>;
 // The largest single write the link takes. Bigger writes go out in pieces, back to back.
 maxWrite?():number;
 cleanup(id?:string):Promise<void>;
}
export type PrinterPhase='disconnected'|'scanning'|'connecting'|'connected'|'printing'|'unavailable'|'permission-denied'|'error';
// quiet: the app's own background look for the remembered printer; it shows nothing and ends silently.
// offer: that quiet look may show a printer it finds in the "printer found" card (home only).
// auto: the connection was started by the app itself (from a quiet look), not by the user.
// held: the print is waiting while Privet is in the background; it continues when the app is back.
// finishing: everything is sent and the printer is still printing what it has; the print ends when the
// printer answers the status request that closes every job (see print).
// printStartedAt: when the running print started (wall clock), to estimate how far the paper is.
// lastPrint: how the last print went (kept until the app closes).
// outcome: how the print ended (a print that stopped early is recorded too, with the rows sent so far).
// sentMs: until the last write. finishedMs: until the printer said it had finished, when it did.
export type PrintOutcome='done'|'cancelled'|'stalled'|'failed';
export type PrintStats={outcome:PrintOutcome;rows:number;sent:number;ms:number;sentMs:number;finishedMs?:number;heldMs:number;pausedMs:number;pauses:number;writes:number;rowsPerWrite:number;pace:number;label?:string};
export type PrinterState={phase:PrinterPhase;message:string;devices:PrinterDevice[];device?:PrinterDevice;progress?:{sent:number;total:number};busy:boolean;paused?:boolean;held?:boolean;finishing?:boolean;printStartedAt?:number;lastPrint?:PrintStats;quiet?:boolean;offer?:boolean;auto?:boolean};
export type PrintResult='done'|'cancelled'|'failed';
export const PRINTER_IDLE='No printer connected.';
// The printer takes one connection at a time: while another app or phone holds it, it can't be
// found or won't connect.
export const PRINTER_BUSY_HINT='If another app or phone is connected to the printer, disconnect it there, then try again.';
export const initialPrinterState=():PrinterState=>({phase:'disconnected',message:PRINTER_IDLE,devices:[],busy:false});
// pace: the gap after each packet, so iOS doesn't drop writes without response.
// stall: how long a flow-control pause may last before the job gives up.
// hold: how long a print waits while Privet is in the background before it ends cleanly and frees the printer.
// finish: the shortest wait for the printer to say it has finished, once everything is sent (it grows
// with the rows, see SLOWEST_PRINT_ROWS_PER_SECOND). A printer that never says ends the print then.
// lookup: the shorter window of a quiet look for the remembered printer.
export const PRINTER_TIMEOUTS={initialize:15000,scan:12000,lookup:5000,connect:10000,subscribe:5000,write:3000,stall:8000,pace:10,hold:30000,finish:5000};
// The printer prints far slower than we send (an SC03h: about 32 rows a second, measured 2026-11-23), so
// most of a print sits in its buffer when the last write goes out. Waiting for it to finish allows this slow.
export const SLOWEST_PRINT_ROWS_PER_SECOND=20;
// Consecutive row packets sent together in one write (the printer parses a byte stream). Higher is
// faster; the printer's pause/resume still holds us back if it can't keep up. 1 = one row per write.
export const ROWS_PER_WRITE=2;
export const BACKGROUND_MESSAGE='Printer disconnected while Privet was in the background.';
export const AWAY_TOO_LONG_MESSAGE='Printing stopped: Privet was in the background for too long.';
export const HELD_MESSAGE='Paused while Privet is in the background. It continues when you come back.';
// The last print in two short lines: how long it took on paper (or to send, if the printer didn't say), and
// who was waiting for whom.
export function describePrint(s:PrintStats){
 const seconds=(ms:number)=>(ms/1000).toFixed(1),times=(n:number)=>`${n} ${n===1?'time':'times'}`;
 const rate=(ms:number)=>Math.round(s.rows*1000/Math.max(1,ms-s.heldMs));
 const summary=s.outcome!=='done'?(s.outcome==='cancelled'?`Cancelled after ${s.sent} of ${s.rows} rows`:`Stopped after ${s.sent} of ${s.rows} rows: ${s.outcome==='stalled'?'the printer stopped responding':'the connection was lost'}`)
  :s.finishedMs!==undefined?`${s.rows} rows printed in ${seconds(s.finishedMs-s.heldMs)} s · ${rate(s.finishedMs)} rows/s`
  :`${s.rows} rows sent in ${seconds(s.sentMs-s.heldMs)} s · the printer didn’t say when it finished`;
 const sending=`Sent in ${seconds(s.sentMs-s.heldMs)} s, ${s.rowsPerWrite} rows per write with a ${s.pace} ms gap. The printer made us wait ${seconds(s.pausedMs)} s (${times(s.pauses)}).`;
 return {summary,detail:sending};
}
// The printer prints far slower than we send, and it doesn't report rows as it prints them, so how far the
// paper is comes from its speed: rows per second, learnt from finished prints (learnRate), starting from
// what an SC03h does (measured 2026-11-23: about 32 rows, 4 mm, a second, whatever is printed).
export const DEFAULT_PRINT_ROWS_PER_SECOND=32;
// How far the paper probably is: never ahead of what was sent, and never "done" before the printer says so.
export function printEstimate({sent,total,elapsedMs,rowsPerSecond}:{sent:number;total:number;elapsedMs:number;rowsPerSecond:number}){
 const printed=Math.max(0,Math.min(sent,total,Math.floor(elapsedMs*rowsPerSecond/1000)));
 return {printed,secondsLeft:Math.max(0,Math.ceil((total-printed)/rowsPerSecond))};
}
// The printer's speed after a print it said it finished: half the old value, half this print's, within
// sensible bounds. Prints without that answer, or that didn't finish, change nothing.
export function learnRate(previous:number|undefined,stats:PrintStats){
 if(stats.outcome!=='done'||stats.finishedMs===undefined||stats.rows<1)return previous;
 const measured=stats.rows*1000/Math.max(1,stats.finishedMs);
 const next=previous===undefined?measured:(previous+measured)/2;
 return Math.round(Math.min(200,Math.max(5,next))*10)/10;
}
type Clock={set:(fn:()=>void,ms:number)=>ReturnType<typeof setTimeout>;clear:(id:ReturnType<typeof setTimeout>)=>void};
const clock:Clock={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)};
class Stalled extends Error {}
// Only the latest few rows' progress is emitted, so a 600-row card doesn't re-render 600 times.
const PROGRESS_EVERY=4;

export function createPrinterTransport(driver:PrinterDriver,emit:(state:PrinterState)=>void,options:{supported?:()=>boolean;clock?:Clock;timeouts?:Partial<typeof PRINTER_TIMEOUTS>;rowsPerWrite?:number;now?:()=>number;hidden?:()=>boolean}={}){
 const time={...PRINTER_TIMEOUTS,...options.timeouts},timer=options.clock??clock,rowsPerWrite=Math.max(1,Math.floor(options.rowsPerWrite??ROWS_PER_WRITE));
 // now: the wall clock, which keeps counting while iOS has the web view frozen. hidden: whether the app is
 // really in the background (not just covered for a moment).
 const now=options.now??Date.now,hidden=options.hidden??(()=>true);
 let state=initialPrinterState(),generation=0,alive=true,active=true,touched=false,cleaning=0;
 let scanTimer:ReturnType<typeof setTimeout>|undefined;
 // finalSentAt: when the job's closing status request went out; stateReplies: when the printer answered one.
 type Job={generation:number;cancelled:boolean;paused:boolean;pausedAt?:number;pausedMs:number;pauses:number;writes:number;held:boolean;heldAt?:number;heldMs:number;holdWake?:()=>void;holdTimer?:ReturnType<typeof setTimeout>;finishing:boolean;finishWake?:()=>void;finalSentAt?:number;stateReplies:number[];wake?:()=>void;done?:Promise<PrintResult>};
 let job:Job|undefined;
 // Ends every wait of a job: flow-control pause, background hold and its timer.
 function wakeJob(j:Job){j.wake?.();j.holdWake?.();j.finishWake?.();if(j.holdTimer!==undefined){timer.clear(j.holdTimer);j.holdTimer=undefined;}}
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
  if(job){job.cancelled=true;wakeJob(job);}
  const id=state.device?.deviceId;
  update({phase,message,devices:[],device:undefined,progress:undefined,paused:false,held:false,finishing:false,printStartedAt:undefined,quiet:false,offer:false,auto:false});cleanup(id);
 }
 function failure(error:unknown,g:number,fallback:string){
  if(!current(g))return;
  const message=error instanceof Error?error.message:String(error);
  if(/permission|unauthoriz|denied/i.test(message))invalidate('permission-denied',`Allow Bluetooth for Privet in ${DEVICE} Settings, then try again.`);
  else if(/unsupported|unavailable|not enabled|powered off/i.test(message))invalidate('unavailable',`Bluetooth is unavailable. Use a real ${DEVICE} with Bluetooth turned on.`);
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
   if(!enabled){stop('unavailable',`Bluetooth is off. Turn it on in ${DEVICE} Settings, then try again.`);return;}
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
    if(notificationCommand(value)===CMD.STATE){job.stateReplies.push(now());if(job.finishing)job.finishWake?.();}
    const flow=decodeFlowControl(value);
    if(flow==='pause'){if(!job.paused){job.paused=true;job.pausedAt=now();job.pauses++;}update({paused:true});}
    else if(flow==='resume'){if(job.paused){job.paused=false;job.pausedMs+=now()-(job.pausedAt??now());}update({paused:false});job.wake?.();}
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
   // While the app is in the background the printer can't be answered: the stall limit waits.
   const arm=():ReturnType<typeof setTimeout>=>timer.set(()=>{if(j.held){deadline=arm();return;}j.wake=undefined;reject(new Stalled());},time.stall);
   let deadline=arm();
   j.wake=()=>{timer.clear(deadline);j.wake=undefined;resolve();};
  });
 }
 // Waits while the print is held for the background, until the app is back, or the job is cancelled.
 function untilReleased(j:Job){
  return new Promise<void>(resolve=>{j.holdWake=()=>{j.holdWake=undefined;resolve();};});
 }
 // Privet went to the background mid-print: keep the connection and stop sending. If the app is back soon
 // the print carries on from the next row; if not, it ends cleanly and frees the printer.
 function hold(){
  const j=job;if(!j||j.held)return;
  j.held=true;j.heldAt=now();
  update({held:true,message:HELD_MESSAGE});
  j.holdTimer=timer.set(()=>{
   j.holdTimer=undefined;
   // Back on screen after the web view was frozen: the app's "active" event is on its way and decides.
   if(job!==j||!j.held||!hidden())return;
   void disconnect(AWAY_TOO_LONG_MESSAGE);
  },time.hold);
 }
 function release(){
  const j=job;if(!j||!j.held)return;
  const away=now()-(j.heldAt??now());
  if(j.holdTimer!==undefined){timer.clear(j.holdTimer);j.holdTimer=undefined;}
  if(away>time.hold){void disconnect(AWAY_TOO_LONG_MESSAGE);return;}
  j.held=false;j.heldMs+=away;
  update({held:false,message:'Printing…'});
  j.holdWake?.();
 }
 // Waits for the printer to answer the closing status request, which it does once it has printed
 // everything (if it answers in order), or until the wait runs out, or the job is cancelled.
 function untilFinished(j:Job,ms:number){
  return new Promise<void>(resolve=>{
   const deadline=timer.set(()=>{j.finishWake=undefined;resolve();},ms);
   j.finishWake=()=>{timer.clear(deadline);j.finishWake=undefined;resolve();};
  });
 }
 // Best effort: closes the lattice so the printer doesn't wait for more rows.
 async function sendEnd(g:number,id:string){
  if(!current(g))return;
  try{await bounded(driver.write(id,latticeEnd()),time.write,'Write timed out.');}catch{/* Still connected or not, nothing more to do. */}
 }
 // Packets from printJob(). Rows sent / total is reported as progress. Sending is far ahead of the paper,
 // so once everything is sent the print stays on "printing" (finishing) until the printer answers the
 // status request that closes the job: then it has really finished.
 // tuning: rows per write and the gap after each write; label names the print; onOutcome hears how it ended,
 // before the state is published. A write never holds more rows than the link takes at once.
 function print(packets:readonly Uint8Array[],tuning:{rowsPerWrite?:number;pace?:number;label?:string;onOutcome?:(stats:PrintStats)=>void}={}):Promise<PrintResult>{
  if(!alive||state.phase!=='connected'||!state.device||job)return Promise.resolve('failed');
  const g=generation,id=state.device.deviceId,total=packets.filter(isRowPacket).length,startedAt=now();
  const rowBytes=packets.find(isRowPacket)?.length??56,fits=Math.max(1,Math.floor((driver.maxWrite?.()??Infinity)/rowBytes));
  const perWrite=Math.min(fits,Math.max(1,Math.floor(tuning.rowsPerWrite??rowsPerWrite))),pace=Math.max(0,tuning.pace??time.pace);
  const j:Job={generation:g,cancelled:false,paused:false,pausedMs:0,pauses:0,writes:0,held:false,heldMs:0,finishing:false,stateReplies:[]};job=j;
  update({phase:'printing',message:'Printing…',progress:{sent:0,total},paused:false,finishing:false,printStartedAt:startedAt});
  j.done=(async():Promise<PrintResult>=>{
   let sent=0,sentMs:number|undefined,finishedMs:number|undefined;
   const record=(outcome:PrintOutcome):PrintStats=>{
    const stats:PrintStats={outcome,rows:total,sent,ms:now()-startedAt,sentMs:sentMs??now()-startedAt,finishedMs,heldMs:j.heldMs,pausedMs:j.pausedMs,pauses:j.pauses,writes:j.writes,rowsPerWrite:perWrite,pace,label:tuning.label};
    tuning.onOutcome?.(stats);return stats;
   };
   const writes=batches(packets,perWrite);
   try{
    for(let index=0;index<writes.length;index++){
     const {value,rows}=writes[index];
     while((j.paused||j.held)&&!j.cancelled){if(j.held)await untilReleased(j);else await untilResumed(j);}
     if(j.cancelled||!current(g))break;
     const wroteAt=now();
     await bounded(driver.write(id,value),time.write,'Write timed out.');
     if(!current(g))break;
     j.writes++;
     if(index===writes.length-1)j.finalSentAt=wroteAt;
     if(rows){const before=sent;sent+=rows;if(Math.floor(sent/PROGRESS_EVERY)>Math.floor(before/PROGRESS_EVERY)||sent===total)update({progress:{sent,total}});}
     await sleep(pace);
    }
    if(!current(g)){update({lastPrint:record('failed')});return 'failed';}
    if(j.cancelled){
     update({message:'Cancelling…'});
     await sendEnd(g,id);
     if(current(g))update({phase:'connected',message:'Printing cancelled.',progress:undefined,paused:false,held:false,finishing:false,printStartedAt:undefined,lastPrint:record('cancelled')});
     return 'cancelled';
    }
    // Everything is sent; the printer is still printing what it has. Its answer to the closing status
    // request (sent last, after the lattice end) marks the end. One already in (a printer that answers at
    // once) counts; with none, wait for one, allowing for a slow printer.
    sentMs=now()-startedAt;
    const replied=()=>j.finalSentAt===undefined?undefined:j.stateReplies.find(at=>at>=j.finalSentAt!);
    if(replied()===undefined&&j.finalSentAt!==undefined){
     j.finishing=true;update({finishing:true,progress:{sent:total,total}});
     await untilFinished(j,Math.max(time.finish,total*1000/SLOWEST_PRINT_ROWS_PER_SECOND));
     j.finishing=false;
    }
    const finishedAt=replied();
    if(finishedAt!==undefined)finishedMs=finishedAt-startedAt;
    // Lost or let go while finishing: everything had reached the printer, so the print itself is done.
    if(!current(g)){update({lastPrint:record('done')});return 'done';}
    update({phase:'connected',message:'Printed.',progress:undefined,paused:false,held:false,finishing:false,printStartedAt:undefined,lastPrint:record('done')});
    return 'done';
   }catch(error){
    if(!current(g)){update({lastPrint:record('failed')});return 'failed';}
    if(error instanceof Stalled){
     const stats=record('stalled');
     await sendEnd(g,id);
     if(current(g))update({phase:'connected',message:'The printer stopped responding. Check the paper and the lid, then try again.',progress:undefined,paused:false,held:false,finishing:false,printStartedAt:undefined,lastPrint:stats});
     return 'failed';
    }
    update({lastPrint:record('failed')});
    invalidate('error','Lost the printer while printing. Connect again to retry.');
    return 'failed';
   }finally{if(job===j)job=undefined;wakeJob(j);}
  })();
  return j.done;
 }
 function cancel(){
  if(job){job.cancelled=true;wakeJob(job);return;}
  if(state.phase==='scanning'||state.phase==='connecting')invalidate('disconnected','Cancelled.');
 }
 // A running job is cancelled first, so the lattice is closed before the link goes.
 async function disconnect(message='Printer disconnected.'){
  const running=job;
  if(running){running.cancelled=true;wakeJob(running);await running.done;}
  if(state.phase!=='disconnected'||state.device)invalidate('disconnected',message);
 }
 return {scan,discover,holdScan,stopDiscovery,connect:(deviceId:string)=>connect(deviceId),print,cancel,disconnect,getState:()=>state,
  // Going to the background: a running print is held (see hold) and carries on when the app is back.
  // Otherwise the printer is released (it takes one connection, e.g. for another app).
  // background=false: the app is only covered for a moment (Control Center, a banner, a system prompt) and
  // still runs, so a running print just keeps going; with no print, the printer is released as before.
  setActive(value:boolean,background=true){
   if(!value&&job&&!background)return;
   active=value;
   if(value){release();return;}
   if(state.quiet&&state.phase==='scanning'){invalidate('disconnected',PRINTER_IDLE);return;}
   // Nothing left to send while the printer finishes: no need to hold anything.
   if(job){if(!job.finishing)hold();return;}
   if(state.phase!=='disconnected'&&state.phase!=='error')void disconnect(BACKGROUND_MESSAGE);
  },
  dispose(){if(job){job.cancelled=true;wakeJob(job);}invalidate('disconnected',PRINTER_IDLE);alive=false;},
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
