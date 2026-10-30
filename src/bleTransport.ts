import {CAPABILITIES,CARD_LIMITS,encodeControl,decodeControlAck,decodeCapabilities,decodeContentAck,cardFrames,validateCard,type Capabilities,type LearningCard} from './learningProtocol.ts';
import {BLE_SERVICE,COMMAND,EXTENDED_FALLBACK,decodeAcknowledgement,encodeCommand,nextRequestId,type CommandCode} from './bleProtocol.ts';

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
// quiet: a background discovery scan on home. It keeps the ordinary disconnected message and status
// (no "Scanning" anywhere), ends silently, and only fills `devices` for the "companion found" card.
export type BleState={phase:BlePhase;message:string;devices:PhysicalDevice[];device?:PhysicalDevice;ready:boolean;pending:boolean;busy:boolean;notice?:string;quiet?:boolean};
export const initialBleState=():BleState=>({phase:'disconnected',message:'Not connected. The virtual companion works independently.',devices:[],ready:false,pending:false,busy:false});
export const BLE_TIMEOUTS={initialize:15000,scan:12000,connect:10000,subscribe:5000,write:4000,ack:5000};
type Clock={now?:()=>number;set:(fn:()=>void,ms:number)=>ReturnType<typeof setTimeout>;clear:(id:ReturnType<typeof setTimeout>)=>void};
const clock:Clock={now:()=>performance.now(),set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)};
class Cancelled extends Error {}
class TransferExpired extends Error {}
export function createBleTransport(driver:BleDriver,emit:(state:BleState)=>void,options:{supported?:()=>boolean;clock?:Clock;timeouts?:Partial<typeof BLE_TIMEOUTS>}={}){
 const time={...BLE_TIMEOUTS,...options.timeouts},timer=options.clock??clock;
 let state=initialBleState(),generation=0,activityRevision=0,alive=true,active=true,touched=false,rawPending=0,cleaning=0;
 let scanTimer:ReturnType<typeof setTimeout>|undefined;
 const cancelWaits=new Set<()=>void>();
 type AckResult=0|1|2|'cancelled';
 type Flight={id:number;generation:number;command:CommandCode;revision:number;resume:boolean;obsolete:boolean;waitingCapabilities?:boolean;sendingCard?:boolean;reply?:(packet:DataView|null)=>void;ack:(result:AckResult)=>void};
 type Job={command:CommandCode;card?:LearningCard;argument?:number};
 let flight:Flight|undefined,latest:Job|undefined;
 let capabilities:Capabilities|undefined;
 // Kept separately: a paused card transfer clears `capabilities`, not the firmware's reaction set.
 let extendedReactions=false;
 type Probe={generation:number;revision:number;attempts:number;phase:'deferred'|'writing'|'waiting'|'ready'|'disabled';reply?:(packet:DataView)=>void;done:Promise<void>;finish:()=>void};
 let probe:Probe|undefined;
 function newProbe(attempts=0){let finish!:()=>void;const done=new Promise<void>(resolve=>{finish=resolve;});return {generation,revision:activityRevision,attempts,phase:'deferred' as const,done,finish};}
 function stopProbe(){if(probe){probe.reply=undefined;probe.finish();}probe=undefined;}
 // Independent connection control state, using the SAME native write slot.
 // Reaction replacement never touches this matcher or its bounded ACK wait.
 function startProbe(){
  const p=probe;
  if(!p||p.generation!==generation||p.phase!=='deferred'||submittedWrite||latest||!active||!state.ready||!state.device)return;
  const g=generation,id=state.device.deviceId;
  p.phase='writing';p.attempts++;
  void (async()=>{
   try{
    const probeId=nextRequestId();let acked=false,offer:Capabilities|undefined;
    let finish!:(value:Capabilities|undefined)=>void;
    const response=new Promise<Capabilities|undefined>(resolve=>{finish=resolve;});
    p.reply=packet=>{
     if(probe!==p||!current(g)||p.revision!==activityRevision)return;
     const ack=decodeControlAck(packet),caps=decodeCapabilities(packet);
     if(ack?.id===probeId){if(ack.result!==0){finish(undefined);return;}acked=true;}
     if(caps?.id===probeId)offer={nonce:caps.nonce,reactions:caps.reactions};
     if(acked&&offer)finish(offer);
    };
    const writing=raw(()=>driver.write(id,encodeControl(probeId,CAPABILITIES),time.write));
    submittedWrite=writing;
    void writing.then(()=>{if(submittedWrite===writing)submittedWrite=undefined;pump();startProbe();},()=>{if(submittedWrite===writing)submittedWrite=undefined;});
    await wait(writing,g,time.write,'Command timed out. Connect again to try later.');
    if(probe!==p||!current(g)||p.revision!==activityRevision)return;
    p.phase='waiting';
    let accepted:Capabilities|undefined;
    try{accepted=await wait(response,g,CARD_LIMITS.ack,'Capability reply timed out.');}
    catch(error){if(error instanceof Cancelled)throw error;}
    if(probe===p&&current(g)&&p.revision===activityRevision){capabilities=accepted;extendedReactions=!!accepted?.reactions;p.phase=accepted?'ready':'disabled';p.reply=undefined;p.finish();}
   }catch(error){if(p.revision===activityRevision)failure(error,g);}
  })();
 }
 const now=()=>timer.now?.()??performance.now();
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
  generation++;clearScanTimer();latest=undefined;capabilities=undefined;extendedReactions=false;stopProbe();
  if(flight){flight.obsolete=true;flight.ack('cancelled');flight.reply?.(null);}flight=undefined;
  for(const cancel of [...cancelWaits])cancel();
  const id=state.device?.deviceId;
  update({phase,message,ready:false,pending:false,device:undefined,devices:[],quiet:false});cleanup(id);
 }
 function failure(error:unknown,g:number){
  if(!current(g)||error instanceof Cancelled)return;
  const message=error instanceof Error?error.message:String(error);
  if(/permission|unauthoriz|denied/i.test(message))invalidate('permission-denied','Allow Bluetooth for Privet in iPhone Settings, then try again.');
  else if(/unsupported|unavailable|not enabled|powered off/i.test(message))invalidate('unavailable','Bluetooth is unavailable. Use a real iPhone with Bluetooth turned on.');
  else invalidate('error',(/timed out|too long|did not respond|No reply|Could not start scanning|Could not stop scanning/i.test(message))?message:'Could not reach the companion. Try connecting again.');
 }
 async function scan(quiet=false){
  if(!alive||!active||state.busy||state.phase==='scanning'||state.phase==='connecting'||state.phase==='connected'||state.phase==='suspended'||state.phase==='reconciling')return;
  if(options.supported&&!options.supported()){if(!quiet)update({phase:'unavailable',message:'Physical Bluetooth is available only in the native iPhone app on a real device.'});return;}
  // A quiet discovery never surfaces its own errors or end: it just returns to the ordinary disconnected state.
  const idle=initialBleState().message;
  const stop=(phase:BlePhase,message:string)=>quiet?invalidate('disconnected',idle):invalidate(phase,message);
  const g=++generation;touched=true;update({phase:'scanning',message:quiet?idle:'Preparing Bluetooth…',devices:[],ready:false,notice:undefined,quiet});
  try{
   await wait(raw(()=>driver.initialize()),g,time.initialize,'Bluetooth took too long. Try connecting again.');
   if(!current(g))return;
   const enabled=await wait(raw(()=>driver.isEnabled()),g,time.subscribe,'Bluetooth did not respond. Try again.');
   if(!current(g))return;
   if(!enabled){stop('unavailable','Bluetooth is off. Turn it on in iPhone Settings, then connect again.');return;}
   await wait(raw(()=>driver.watchEnabled(enabled=>{if(sameConnection(g)&&!enabled)stop('unavailable','Bluetooth is off or unavailable. Turn it on, then connect again.');})),g,time.subscribe,'Bluetooth did not respond. Try again.');
   if(!current(g))return;
   if(!quiet)update({message:'Scanning for companions… Choose a device below.'});
   // Both the scan window and the scan-start call are bounded.
   scanTimer=timer.set(()=>{if(current(g))stop('disconnected','Scan finished. Tap Connect to scan again.');},time.scan);
   const started=raw(()=>driver.scan(BLE_SERVICE,device=>{
    if(!current(g)||state.phase!=='scanning')return;
    update({devices:[...state.devices.filter(d=>d.deviceId!==device.deviceId),device]});
   }));
   await wait(started,g,time.subscribe,'Could not start scanning. Try again.');
  }catch(error){if(quiet){if(current(g)&&!(error instanceof Cancelled))invalidate('disconnected',idle);}else failure(error,g);}
 }
 // Background discovery for the "companion found" card: home only, never while anything else is under way.
 // The caller decides whether Bluetooth permission was already granted; this never runs from mount alone.
 // It also runs after an error or with Bluetooth off: a quiet scan ends silently, so home just keeps looking.
 function discover(){if(screen==='home'&&['disconnected','error','unavailable'].includes(state.phase))return scan(true);return Promise.resolve();}
 function stopDiscovery(){if(state.quiet&&state.phase==='scanning')invalidate('disconnected',initialBleState().message);}
 // While the "companion found" card is showing, the scan window must not expire under it.
 function holdScan(){if(state.phase==='scanning')clearScanTimer();}
 // "Not now" on the card: end the scan without an error; a quiet one leaves no trace at all.
 function cancelScan(){if(state.phase==='scanning')invalidate('disconnected',state.quiet?initialBleState().message:'Scan stopped. Tap Connect to scan again.');}
 async function connect(deviceId:string){
  if(!alive||!active||state.phase!=='scanning'||state.busy)return;
  const device=state.devices.find(d=>d.deviceId===deviceId);if(!device)return;
  clearScanTimer();const g=generation;update({phase:'connecting',device,message:'Connecting and subscribing to status…',ready:false,quiet:false});
  try{
   await wait(raw(()=>driver.stopScan()),g,time.subscribe,'Could not stop scanning. Try again.');
   if(!current(g))return;
   const connected=raw(()=>driver.connect(deviceId,()=>{if(sameConnection(g))invalidate('disconnected','Companion disconnected. Tap Connect when you’re ready.');},time.connect));
   await wait(connected,g,time.connect,'Connection timed out. Try again.');
   if(!current(g))return;
   const subscribed=raw(()=>driver.subscribe(deviceId,value=>{
    if(!current(g))return;
    probe?.reply?.(value);
    if(!flight||flight.obsolete||flight.generation!==g)return;
    flight.reply?.(value);
    const ack=decodeAcknowledgement(value);
    if(ack&&ack.requestId===flight.id&&ack.command===flight.command)flight.ack(ack.result);
   },time.subscribe));
   await wait(subscribed,g,time.subscribe,'Companion setup timed out. Try again.');
   if(!current(g))return;
   update({phase:'connected',message:'Connected. Ready for your lesson.',ready:true});
   probe=newProbe();
   request(COMMAND.CONNECTED); // Fresh subscription only; foreground reconciliation still uses IDLE.
  }catch(error){failure(error,g);}
 }
 // Context changes cancel ACK waits, never an active native write. The next
 // command may run only once that write resolves (or its bounded timeout drops
 // the connection). There is one replaceable slot, never a reaction FIFO.
 // NOD keeps the open question's context (firmware returns it to THINKING), like the THINKING it replaces.
 const contextCommands:ReadonlySet<CommandCode>=new Set([COMMAND.IDLE,COMMAND.THINKING,COMMAND.STREAK,COMMAND.CONNECTED,COMMAND.CELEBRATE,COMMAND.NOD]);
 function request(command:CommandCode,card?:LearningCard,argument=0){
  if(!Object.values(COMMAND).includes(command))return false;
  if(!Number.isInteger(argument)||argument<0||argument>255||(argument!==0&&command!==COMMAND.ON_FIRE))argument=0;
  if(card&&!validateCard(card))card=undefined;
  if(!alive||!active||!state.ready||!state.device)return false;
  // Preserve a pending context change ahead of fleeting same-context reactions.
  // A newer context (including completion) may replace it.
  if(latest!==undefined&&contextCommands.has(latest.command)&&!contextCommands.has(command))return false;
  // Any new request — not only a context change — must cut short a card
  // transfer already under way (or still negotiating capabilities): its
  // accepted face already landed, so the remaining frames/final ACK wait are
  // just added latency the firmware will discard anyway once this new
  // request's own face replaces it. The in-flight native write itself is
  // never recalled; only unsent frames and JS-side ACK waits are dropped.
  if(contextCommands.has(command)||flight?.waitingCapabilities||flight?.sendingCard){
   latest=undefined;
   if(flight){flight.obsolete=true;flight.ack('cancelled');flight.reply?.(null);}
  }
  latest={command,card,argument};update({pending:true});pump();return true;
 }
 function pump(resume=false){
  if(latest===undefined){startProbe();return;}
  if(flight||submittedWrite||(!state.ready&&!(resume&&state.phase==='reconciling'))||!state.device||!active||!alive)return;
  const {card}=latest;
  // Resolved at send time: firmware without the extended reactions gets their
  // fallback, always with argument 0 (older firmware rejects any other).
  const fallback=!extendedReactions&&EXTENDED_FALLBACK[latest.command];
  const command=fallback||latest.command,argument=fallback?0:latest.argument??0;
  latest=undefined;
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
    // This helper retains the actual submitted bridge promise, even after
    // cancellation. A content timeout must never release the native write slot.
    const write=async(packet:DataView,deadline?:number)=>{
     while(submittedWrite){await wait(submittedWrite,g,time.write,'Command timed out. Connect again to try later.');}
     const writing=raw(()=>{if(job.obsolete)throw new Cancelled();if(deadline!==undefined&&now()>=deadline)throw new TransferExpired();return driver.write(id,packet,time.write);});
     submittedWrite=writing;
     void writing.then(()=>{if(submittedWrite===writing)submittedWrite=undefined;pump();startProbe();},()=>{if(submittedWrite===writing)submittedWrite=undefined;});
     await wait(writing,g,time.write,'Command timed out. Connect again to try later.');
    };
    await write(encodeCommand(requestId,command,argument));
    startProbe();
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
    if(result!==0)return;
    if(card&&probe&&['deferred','writing','waiting'].includes(probe.phase)){
     job.waitingCapabilities=true;
     const cancelled=new Promise<void>(resolve=>{job.reply=packet=>{if(!packet)resolve();};});
     await Promise.race([probe.done,cancelled]);job.reply=undefined;job.waitingCapabilities=false;
    }
    if(!capabilities||!card||job.obsolete)return;
    const transaction=nextRequestId(),frames=cardFrames(transaction,capabilities.nonce,requestId,card);
    let finish!:(result:number)=>void;let rejected=false;
    const response=new Promise<number>(resolve=>{finish=resolve;});
    job.reply=packet=>{if(!packet){finish(-1);return;}const ack=decodeContentAck(packet);if(ack?.id===transaction&&(ack.mode===card.mode||ack.result!==0&&ack.mode===0)){if(ack.result!==0)rejected=true;finish(ack.result);}};
    // Start before BEGIN submission, not after its response. No COMMIT can be
    // submitted after 3500 ms, irrespective of a slower native write response.
    const deadline=now()+CARD_LIMITS.transfer;
    // The face reaction itself already landed; this flag marks only the
    // optional, slower BEGIN/DATA/COMMIT card transfer that follows it. A new
    // request (an instant reaction or a context change) arriving during this
    // window obsoletes it immediately instead of queuing behind up to ~5.5s
    // of card frames the firmware would discard anyway once a newer face/card
    // request is accepted.
    job.sendingCard=true;
    for(const frame of frames){
     if(job.obsolete)return;
     if(rejected||now()>=deadline){capabilities=undefined;update({message:'Learning cards paused. Reactions remain available.'});return;}
     try{await write(frame,deadline);}catch(error){if(!(error instanceof TransferExpired))throw error;capabilities=undefined;update({message:'Learning cards paused. Reactions remain available.'});return;}
    }
    if(job.obsolete)return;
    try{const accepted=await wait(response,g,CARD_LIMITS.ack,'Learning card reply timed out.');if(job.obsolete)return;if(accepted!==0){capabilities=undefined;update({message:'Learning cards paused. Reactions remain available.'});}}
    catch(error){if(error instanceof Cancelled)throw error;capabilities=undefined;update({message:'Learning cards paused. Reactions remain available.'});}

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
 // homeCard: an optional status card (e.g. reviews due) shown with the neutral home face.
 function navigate(next:typeof screen,homeCard?:LearningCard){
  if(next===screen)return;
  if(screen==='physical')leaveSettings();
  // Discovery and a connection started from the home card both belong to home.
  if(screen==='home'&&(state.quiet||state.phase==='connecting'))leaveSettings();
  screen=next;
  // Profile entry is silent: no face change or movement. Other navigation
  // establishes a neutral context. Code STREAK remains protocol-compatible only.
  if(next!=='profile')request(COMMAND.IDLE,next==='home'?homeCard:undefined);
 }
 // Unlike ordinary same-screen navigation, direct lesson switches must replace
 // the old question context even while the lesson view is already open.
 function enterLesson(hasActiveQuestion:boolean,card?:LearningCard){
  if(screen==='physical'||screen==='home')leaveSettings();
  screen='lesson';
  return request(hasActiveQuestion?COMMAND.THINKING:COMMAND.IDLE,card);
 }
 function pause(){
  if(!state.device||!['connected','suspended','reconciling'].includes(state.phase)){
   if(state.phase==='scanning'||state.phase==='connecting')invalidate('disconnected','Connection cancelled while Privet was inactive.');
   return;
  }
  clearScanTimer();latest=undefined;
  if(probe&&['deferred','writing','waiting'].includes(probe.phase)){const attempts=probe.attempts;stopProbe();probe=newProbe(attempts);if(attempts>=2){probe.phase='disabled';probe.finish();}}
  if(flight){flight.obsolete=true;flight.ack('cancelled');flight.reply?.(null);}
  // Drop ACK waits and JS deadlines. The native write promise remains tracked.
  for(const cancel of [...cancelWaits])cancel();
  update({phase:'suspended',ready:false,pending:false,message:'Reactions paused. Connection will be checked when you return.'});
 }
 async function reconcile(){
  if(!state.device||state.phase!=='suspended')return;
  const g=generation,r=activityRevision,id=state.device.deviceId;
  if(probe?.phase==='deferred')probe.revision=activityRevision;
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
   latest={command:COMMAND.IDLE};update({pending:true,message:'Synchronizing companion…'});pump(true);
  }catch(error){
   if(valid()&&!(error instanceof Cancelled))invalidate('error','Could not confirm the connection. Connect again.');
  }
 }
 return {scan:()=>scan(),discover,stopDiscovery,holdScan,cancelScan,connect,testHappy,request,leaveSettings,navigate,enterLesson,getState:()=>state,connectionToken:()=>generation,
  disconnect:()=>invalidate('disconnected','Disconnected. No commands are queued.'),
  setActive(value:boolean){if(!alive||active===value)return;active=value;activityRevision++;if(!value)pause();else void reconcile();},
  dispose(){alive=false;active=false;invalidate('disconnected','Disconnected.');}
 };
}
export type BleTransport=ReturnType<typeof createBleTransport>;
