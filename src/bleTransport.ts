import {BLE_SERVICE,COMMAND,decodeAcknowledgement,encodeCommand,nextRequestId,type CommandCode} from './bleProtocol.ts';

export type PhysicalDevice={deviceId:string;name?:string};
export interface BleDriver {
 initialize():Promise<void>;
 isEnabled():Promise<boolean>;
 connected(id:string):Promise<boolean>;
 watchEnabled(callback:(enabled:boolean)=>void):Promise<void>;
 scan(service:string,callback:(device:PhysicalDevice)=>void):Promise<void>;
 stopScan():Promise<void>;
 connect(id:string,disconnected:()=>void,timeout:number):Promise<void>;
 subscribe(id:string,callback:(value:DataView)=>void,timeout:number):Promise<void>;
 write(id:string,value:DataView,timeout:number):Promise<void>;
 cleanup(id?:string):Promise<void>;
}
export type BlePhase='disconnected'|'suspended'|'reconciling'|'scanning'|'connecting'|'connected'|'unavailable'|'permission-denied'|'error';
export type BleState={phase:BlePhase;message:string;devices:PhysicalDevice[];device?:PhysicalDevice;ready:boolean;pending:boolean;busy:boolean;notice?:string};
export const initialBleState=():BleState=>({phase:'disconnected',message:'Not connected. The virtual companion works independently.',devices:[],ready:false,pending:false,busy:false});
export const BLE_TIMEOUTS={initialize:15000,scan:12000,connect:10000,subscribe:5000,write:4000,ack:5000};
type Clock={set:(fn:()=>void,ms:number)=>ReturnType<typeof setTimeout>;clear:(id:ReturnType<typeof setTimeout>)=>void};
const clock:Clock={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)};
class Cancelled extends Error {}
export function createBleTransport(driver:BleDriver,emit:(state:BleState)=>void,options:{supported?:()=>boolean;clock?:Clock;timeouts?:Partial<typeof BLE_TIMEOUTS>}={}){
 const time={...BLE_TIMEOUTS,...options.timeouts},timer=options.clock??clock;
 let state=initialBleState(),generation=0,activityRevision=0,alive=true,active=true,touched=false,rawPending=0,cleaning=0;
 let scanTimer:ReturnType<typeof setTimeout>|undefined;
 const cancelWaits=new Set<()=>void>();
 type AckResult=0|1|2|'cancelled';
 type Flight={id:number;generation:number;command:CommandCode;revision:number;resume:boolean;obsolete:boolean;ack:(result:AckResult)=>void};
 let flight:Flight|undefined,latest:CommandCode|undefined;
 let screen:'home'|'profile'|'lesson'|'physical'='home';
 let submittedWrite:Promise<void>|undefined;
 const sameConnection=(g:number)=>alive&&generation===g;
 const current=(g:number)=>sameConnection(g)&&active;
 function update(patch:Partial<BleState>={}){state={...state,...patch,busy:rawPending>0||cleaning>0};if(alive)emit(state);}
 // Track native promises even after our bounded wait expires. Never let a new
 // session race late cleanup of the same peripheral or the plugin's listeners.
 function raw<T>(fn:()=>Promise<T>){
  const g=generation,r=activityRevision,id=state.device?.deviceId;
  rawPending++;update();
  return Promise.resolve().then(()=>{if(!current(g)||r!==activityRevision)throw new Cancelled();return fn();}).finally(()=>{
   rawPending--;if(!sameConnection(g))cleanup(id);update();
  });
 }
 function wait<T>(promise:Promise<T>,g:number,ms:number,message:string):Promise<T>{
  const r=activityRevision;
  return new Promise((resolve,reject)=>{
   let finished=false;
   const finish=(fn:()=>void)=>{if(finished)return;finished=true;timer.clear(deadline);cancelWaits.delete(cancel);fn();};
   const cancel=()=>finish(()=>reject(new Cancelled()));
   const deadline=timer.set(()=>finish(()=>reject(new Error(message))),ms);
   cancelWaits.add(cancel);
   promise.then(value=>finish(()=>(current(g)&&r===activityRevision)?resolve(value):reject(new Cancelled())),error=>finish(()=>reject(error)));
   if(!current(g))cancel();
  });
 }
 function clearScanTimer(){if(scanTimer!==undefined)timer.clear(scanTimer);scanTimer=undefined;}
 function cleanup(id?:string){
  if(!touched)return;
  cleaning++;update();
  void driver.cleanup(id).catch(()=>{/* Already disconnected/unavailable. */}).finally(()=>{cleaning--;update();});
 }
 function invalidate(phase:BlePhase,message:string){
  generation++;clearScanTimer();latest=undefined;
  if(flight){flight.obsolete=true;flight.ack('cancelled');}flight=undefined;
  for(const cancel of [...cancelWaits])cancel();
  const id=state.device?.deviceId;
  update({phase,message,ready:false,pending:false,device:undefined,devices:[]});cleanup(id);
 }
 function failure(error:unknown,g:number){
  if(!current(g)||error instanceof Cancelled)return;
  const message=error instanceof Error?error.message:String(error);
  if(/permission|unauthoriz|denied/i.test(message))invalidate('permission-denied','Allow Bluetooth for Privet in iPhone Settings, then try again.');
  else if(/unsupported|unavailable|not enabled|powered off/i.test(message))invalidate('unavailable','Bluetooth is unavailable. Use a real iPhone with Bluetooth turned on.');
  else invalidate('error',(/timed out|too long|did not respond|No reply|Could not start scanning|Could not stop scanning/i.test(message))?message:'Could not reach the companion. Try connecting again.');
 }
 async function scan(){
  if(!alive||!active||state.busy||state.phase==='scanning'||state.phase==='connecting'||state.phase==='connected'||state.phase==='suspended'||state.phase==='reconciling')return;
  if(options.supported&&!options.supported()){update({phase:'unavailable',message:'Physical Bluetooth is available only in the native iPhone app on a real device.'});return;}
  const g=++generation;touched=true;update({phase:'scanning',message:'Preparing Bluetooth…',devices:[],ready:false,notice:undefined});
  try{
   await wait(raw(()=>driver.initialize()),g,time.initialize,'Bluetooth took too long. Try connecting again.');
   if(!current(g))return;
   const enabled=await wait(raw(()=>driver.isEnabled()),g,time.subscribe,'Bluetooth did not respond. Try again.');
   if(!current(g))return;
   if(!enabled){invalidate('unavailable','Bluetooth is off. Turn it on in iPhone Settings, then connect again.');return;}
   await wait(raw(()=>driver.watchEnabled(enabled=>{if(sameConnection(g)&&!enabled)invalidate('unavailable','Bluetooth is off or unavailable. Turn it on, then connect again.');})),g,time.subscribe,'Bluetooth did not respond. Try again.');
   if(!current(g))return;
   update({message:'Scanning for companions… Choose a device below.'});
   // Both the scan window and the scan-start call are bounded.
   scanTimer=timer.set(()=>{if(current(g))invalidate('disconnected','Scan finished. Tap Connect to scan again.');},time.scan);
   const started=raw(()=>driver.scan(BLE_SERVICE,device=>{
    if(!current(g)||state.phase!=='scanning')return;
    update({devices:[...state.devices.filter(d=>d.deviceId!==device.deviceId),device]});
   }));
   await wait(started,g,time.subscribe,'Could not start scanning. Try again.');
  }catch(error){failure(error,g);}
 }
 async function connect(deviceId:string){
  if(!alive||!active||state.phase!=='scanning'||state.busy)return;
  const device=state.devices.find(d=>d.deviceId===deviceId);if(!device)return;
  clearScanTimer();const g=generation;update({phase:'connecting',device,message:'Connecting and subscribing to status…',ready:false});
  try{
   await wait(raw(()=>driver.stopScan()),g,time.subscribe,'Could not stop scanning. Try again.');
   if(!current(g))return;
   const connected=raw(()=>driver.connect(deviceId,()=>{if(sameConnection(g))invalidate('disconnected','Companion disconnected. Tap Connect when you’re ready.');},time.connect));
   await wait(connected,g,time.connect,'Connection timed out. Try again.');
   if(!current(g))return;
   const subscribed=raw(()=>driver.subscribe(deviceId,value=>{
    if(!current(g)||!flight||flight.obsolete||flight.generation!==g)return;
    const ack=decodeAcknowledgement(value);
    if(ack&&ack.requestId===flight.id&&ack.command===flight.command)flight.ack(ack.result);
   },time.subscribe));
   await wait(subscribed,g,time.subscribe,'Companion setup timed out. Try again.');
   if(!current(g))return;
   update({phase:'connected',message:'Connected. Ready for your lesson.',ready:true});
   request(COMMAND.CONNECTED); // Fresh subscription only; foreground reconciliation still uses IDLE.
  }catch(error){failure(error,g);}
 }
 // Context changes cancel ACK waits, never an active native write. The next
 // command may run only once that write resolves (or its bounded timeout drops
 // the connection). There is one replaceable slot, never a reaction FIFO.
 const contextCommands:ReadonlySet<CommandCode>=new Set([COMMAND.IDLE,COMMAND.THINKING,COMMAND.STREAK,COMMAND.CONNECTED,COMMAND.CELEBRATE]);
 function request(command:CommandCode){
  if(!alive||!active||!state.ready||!state.device)return false;
  // Preserve a pending context change ahead of fleeting same-context reactions.
  // A newer context (including completion) may replace it.
  if(latest!==undefined&&contextCommands.has(latest)&&!contextCommands.has(command))return false;
  if(contextCommands.has(command)){
   latest=undefined;
   if(flight){flight.obsolete=true;flight.ack('cancelled');}
  }
  latest=command;update({pending:true});pump();return true;
 }
 function pump(resume=false){
  if(flight||submittedWrite||latest===undefined||(!state.ready&&!(resume&&state.phase==='reconciling'))||!state.device||!active||!alive)return;
  const command=latest;latest=undefined;
  const g=generation,id=state.device.deviceId;
  let requestId:number;
  try{requestId=nextRequestId();}catch(error){failure(error,g);return;}
  let resultReceived=false;
  let resolveAck!:(result:AckResult)=>void;
  const ackPromise=new Promise<AckResult>(resolve=>{resolveAck=resolve;});
  const job:Flight={id:requestId,generation:g,command,revision:activityRevision,resume,obsolete:false,ack:result=>{
   if(resultReceived&&result!=='cancelled')return;
   resultReceived=true;resolveAck(result);
  }};
  flight=job;
  update({pending:true,message:'Sending reaction…'});
  void (async()=>{
   try{
    // A context change before the bridge call drops an unsent stale command.
    const writing=raw(()=>{if(job.obsolete)throw new Cancelled();return driver.write(id,encodeCommand(requestId,command),time.write);});
    submittedWrite=writing;
    // Retain the actual native promise across a pause. Canceling our wait does
    // not recall the write, and a resumed IDLE must never overlap it.
    void writing.finally(()=>{if(submittedWrite===writing)submittedWrite=undefined;}).catch(()=>{});
    await wait(writing,g,time.write,'Command timed out. Connect again to try later.');
    if(!current(g)||job.obsolete)return;
    update({message:'Waiting for companion…'});
    const result=await wait(ackPromise,g,time.ack,'No reply from the companion. Connect again to try later.');
    if(!current(g)||job.obsolete||result==='cancelled')return;
    if(job.resume){
     if(result!==0){invalidate('error','Could not synchronize the companion. Connect again.');return;}
     update({phase:'connected',ready:true,message:'Connected. Ready for your lesson.'});
     return;
    }
    const notice=result===1?'Companion update needed for all lesson reactions.':state.notice;
    update({notice,message:result===0?'Reaction accepted.':result===1?'Your companion needs an update for this reaction.':'The companion could not accept this reaction.'});
   }catch(error){
    // Obsolescence may cancel an unsent write. Genuine write failures/timeouts
    // still invalidate the link: starting a second native write would be unsafe.
    if(job.revision===activityRevision&&!(error instanceof Cancelled&&job.obsolete))failure(error,g);
   }finally{
    if(flight===job){flight=undefined;update({pending:latest!==undefined});pump();}
   }
  })();
 }
 function testHappy(){
  // Repeated test taps do not fill the pending slot. Lesson events may replace it.
  if(state.pending||state.busy)return;
  request(COMMAND.HAPPY);
 }
 function leaveSettings(){
  if(state.phase==='scanning'||state.phase==='connecting')invalidate('disconnected','Connection cancelled.');
 }
 function navigate(next:typeof screen){
  if(next===screen)return;
  if(screen==='physical')leaveSettings();
  screen=next;
  // Profile entry is silent: no face change or movement. Other navigation
  // establishes a neutral context. Code STREAK remains protocol-compatible only.
  if(next!=='profile')request(COMMAND.IDLE);
 }
 // Unlike ordinary same-screen navigation, direct lesson switches must replace
 // the old question context even while the lesson view is already open.
 function enterLesson(hasActiveQuestion:boolean){
  if(screen==='physical')leaveSettings();
  screen='lesson';
  return request(hasActiveQuestion?COMMAND.THINKING:COMMAND.IDLE);
 }
 function pause(){
  if(!state.device||!['connected','suspended','reconciling'].includes(state.phase)){
   if(state.phase==='scanning'||state.phase==='connecting')invalidate('disconnected','Connection cancelled while Privet was inactive.');
   return;
  }
  clearScanTimer();latest=undefined;
  if(flight){flight.obsolete=true;flight.ack('cancelled');}
  // Drop ACK waits and JS deadlines. The native write promise remains tracked.
  for(const cancel of [...cancelWaits])cancel();
  update({phase:'suspended',ready:false,pending:false,message:'Reactions paused. Connection will be checked when you return.'});
 }
 async function reconcile(){
  if(!state.device||state.phase!=='suspended')return;
  const g=generation,r=activityRevision,id=state.device.deviceId;
  const valid=()=>current(g)&&r===activityRevision;
  update({phase:'reconciling',ready:false,message:'Checking companion…'});
  try{
   if(submittedWrite)await wait(submittedWrite.then(()=>{},()=>{}),g,time.write,'The previous command has not finished. Connect again.');
   if(!valid())return;
   const enabled=await wait(raw(()=>driver.isEnabled()),g,time.subscribe,'Could not confirm Bluetooth. Connect again.');
   if(!valid())return;
   if(!enabled){invalidate('unavailable','Bluetooth is off. Turn it on, then connect again.');return;}
   const connected=await wait(raw(()=>driver.connected(id)),g,time.subscribe,'Could not confirm the connection. Connect again.');
   if(!valid())return;
   if(!connected){invalidate('disconnected','Companion is no longer connected. Tap Connect to reconnect.');return;}
   // Keep the existing subscription/listener. A fresh IDLE ACK proves the
   // notification path still works before any lesson-generated command resumes.
   latest=COMMAND.IDLE;update({pending:true,message:'Synchronizing companion…'});pump(true);
  }catch(error){
   if(valid()&&!(error instanceof Cancelled))invalidate('error','Could not confirm the connection. Connect again.');
  }
 }
 return {scan,connect,testHappy,request,leaveSettings,navigate,enterLesson,getState:()=>state,
  disconnect:()=>invalidate('disconnected','Disconnected. No commands are queued.'),
  setActive(value:boolean){if(!alive||active===value)return;active=value;activityRevision++;if(!value)pause();else void reconcile();},
  dispose(){alive=false;active=false;invalidate('disconnected','Disconnected.');}
 };
}
export type BleTransport=ReturnType<typeof createBleTransport>;
