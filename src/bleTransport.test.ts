import test from 'node:test';
import assert from 'node:assert/strict';
import {createBleTransport,BLE_TIMEOUTS,type BleDriver,type BleState,type PhysicalDevice} from './bleTransport.ts';
import {CARD_LIMITS,type LearningCard} from './learningProtocol.ts';
import {encodeCommand,BLE_SERVICE,COMMAND,type CommandCode} from './bleProtocol.ts';
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function acknowledgement(id:number,result=0,command:CommandCode=COMMAND.HAPPY){const packet=encodeCommand(id,command);packet.setUint8(1,2);packet.setUint8(7,result);return packet;}
function harness(overrides:Partial<BleDriver>={},supported=true,freshResult=0,capable:boolean|'silent'|'ack-only'|'malformed'=false){
 let now=0,nextTimer=0,initializations=0,connections=0,cleanups=0,stopScans=0,syncing=false,activeWrites=0,maxWrites=0,subscriptions=0,watches=0,queries=0;
 let found!:(device:PhysicalDevice)=>void,notified!:(value:DataView)=>void,disconnected!:()=>void,enabled!:(value:boolean)=>void;
 const timers=new Map<number,{at:number;fn:()=>void}>(),writes:DataView[]=[],allWrites:DataView[]=[],snapshots:BleState[]=[];
 const driver:BleDriver={
  async initialize(){initializations++;await overrides.initialize?.();},
  isEnabled:overrides.isEnabled??(async()=>true),
  async connected(id){queries++;return overrides.connected?overrides.connected(id):true;},
  async watchEnabled(fn){watches++;enabled=fn;await overrides.watchEnabled?.(fn);},
  async scan(service,callback){assert.equal(service,BLE_SERVICE);found=callback;await overrides.scan?.(service,callback);},
  async stopScan(){stopScans++;await overrides.stopScan?.();},
  async connect(id,callback,timeout){connections++;disconnected=callback;syncing=true;await overrides.connect?.(id,callback,timeout);},
  async subscribe(id,callback,timeout){subscriptions++;notified=callback;await overrides.subscribe?.(id,callback,timeout);},
  async write(id,packet,timeout){
   allWrites.push(packet);
   if(packet.getUint8(0)===1&&packet.getUint8(6)===10){
    const ack=new DataView(packet.buffer.slice(0));ack.setUint8(1,2);ack.setUint8(7,capable?0:1);
    if(capable===true||capable==='malformed'){const caps=new DataView(new ArrayBuffer(20));[2,0x80,0,0,0,0,7,20,96,0,64,32,77,0,0,0,0x88,0x13].forEach((v,i)=>caps.setUint8(i,v));caps.setUint32(2,packet.getUint32(2,true),true);if(capable==='malformed')caps.setUint8(10,65);notified(caps);}
    if(capable!=='silent')notified(ack);return;
   }
   writes.push(packet);activeWrites++;maxWrites=Math.max(maxWrites,activeWrites);
   try{
    if(syncing&&packet.getUint8(6)===COMMAND.CONNECTED){syncing=false;notified(acknowledgement(packet.getUint32(2,true),freshResult,COMMAND.CONNECTED));}
    else await overrides.write?.(id,packet,timeout);
   }finally{activeWrites--;}
  },
  async cleanup(id){cleanups++;await overrides.cleanup?.(id);}
 };
 const actor=createBleTransport(driver,s=>snapshots.push(s),{supported:()=>supported,clock:{
  now:()=>now,
  set(fn,ms){const id=++nextTimer;timers.set(id,{at:now+ms,fn});return id as unknown as ReturnType<typeof setTimeout>;},clear(id){timers.delete(id as unknown as number);}
 }});
 return {actor,driver,writes,allWrites,timers,snapshots,get state(){return actor.getState();},get initializations(){return initializations;},get connections(){return connections;},get cleanups(){return cleanups;},get stopScans(){return stopScans;},get maxWrites(){return maxWrites;},get subscriptions(){return subscriptions;},get watches(){return watches;},get queries(){return queries;},
  codes:()=>writes.filter(p=>p.getUint8(0)===1).map(p=>p.getUint8(6)),found:(id='device-a')=>found({deviceId:id,name:'Privet-ESP32'}),notify:(p:DataView)=>notified(p),disconnect:()=>disconnected(),disable:()=>enabled(false),
  oldCallbacks:()=>({found,notified,disconnected,enabled}),
  async ackLatest(result=0){const p=writes.at(-1)!;notified(acknowledgement(p.getUint32(2,true),result,p.getUint8(6) as CommandCode));await flush();},
  async ready(keepSync=false){actor.navigate('physical');await actor.scan();this.found();await actor.connect('device-a');await flush();assert.equal(this.state.ready,true);assert.equal(this.state.pending,false);if(!keepSync)writes.length=0;},
  async tick(ms:number){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}await flush();}
 };
}
test('mount, background, unsupported environments and disconnected reactions never initialize Bluetooth',async()=>{
 const h=harness();h.actor.request(COMMAND.CELEBRATE);h.actor.navigate('lesson');h.actor.setActive(false);h.actor.setActive(true);assert.equal(h.initializations,0);
 const unsupported=harness({},false);await unsupported.actor.scan();assert.equal(unsupported.state.phase,'unavailable');assert.equal(unsupported.initializations,0);
 await h.ready(true);assert.deepEqual(h.codes(),[COMMAND.CONNECTED]);h.actor.dispose();
});
test('scan filters service, deduplicates devices, bounds scanning and cleans callbacks',async()=>{
 const h=harness();await h.actor.scan();h.found();h.found();assert.equal(h.state.devices.length,1);const old=h.oldCallbacks();await h.tick(BLE_TIMEOUTS.scan);
 assert.equal(h.state.phase,'disconnected');assert.ok(h.cleanups>0);old.found({deviceId:'late'});assert.equal(h.state.devices.length,0);assert.equal(h.timers.size,0);
});
test('permission denied, disabled Bluetooth, simulator unsupported and general errors remain distinct',async()=>{
 for(const [message,phase] of [['BLE permission denied','permission-denied'],['BLE unsupported','unavailable'],['Unexpected failure','error']] as const){const h=harness({async initialize(){throw new Error(message);}});await h.actor.scan();await flush();assert.equal(h.state.phase,phase);assert.equal(h.state.ready,false);}
 const off=harness({async isEnabled(){return false;}});await off.actor.scan();assert.equal(off.state.phase,'unavailable');
});
test('no command before connect AND subscription succeed; fresh subscription sends CONNECTED exactly once',async()=>{
 const connection=deferred(),subscription=deferred(),h=harness({connect:()=>connection.promise,subscribe:()=>subscription.promise});
 await h.actor.scan();h.found();const operation=h.actor.connect('device-a');await flush();h.actor.testHappy();assert.equal(h.state.ready,false);assert.equal(h.writes.length,0);
 connection.resolve();await flush();h.actor.request(COMMAND.HAPPY);assert.equal(h.writes.length,0);subscription.resolve();await operation;await flush();
 assert.equal(h.state.ready,true);assert.deepEqual(h.codes(),[COMMAND.CONNECTED]);await flush();assert.deepEqual(h.codes(),[COMMAND.CONNECTED]);h.actor.dispose();
});
test('only matching ID AND command AND connection generation finish an ACK; duplicate and malformed ACKs ignored',async()=>{
 const h=harness();await h.ready();h.actor.testHappy();await flush();const id=h.writes[0].getUint32(2,true);
 h.notify(acknowledgement(id+1));h.notify(new DataView(new ArrayBuffer(2)));h.notify(acknowledgement(id,0,COMMAND.ENCOURAGE));assert.equal(h.state.pending,true);
 await h.ackLatest();assert.equal(h.state.message,'Reaction accepted.');assert.equal(h.state.pending,false);h.notify(acknowledgement(id,1));assert.equal(h.state.message,'Reaction accepted.');h.actor.dispose();
});
test('early ACK before write response retained; rapid happy test taps never queue',async()=>{
 const write=deferred(),h=harness({write:()=>write.promise});await h.ready();h.actor.testHappy();await flush();h.actor.testHappy();await h.ackLatest();assert.equal(h.state.pending,true);assert.equal(h.writes.length,1);
 write.resolve();await flush();assert.equal(h.state.pending,false);assert.equal(h.state.message,'Reaction accepted.');h.actor.dispose();
});
test('unsupported reaction ACK is clear, does not disconnect, retry or block another command',async()=>{
 const h=harness();await h.ready();h.actor.request(COMMAND.ENCOURAGE);await flush();await h.ackLatest(1);
 assert.match(h.state.message,/needs an update/);assert.match(h.state.notice!,/update needed/);assert.equal(h.state.ready,true);assert.equal(h.writes.length,1);
 h.actor.request(COMMAND.HAPPY);await flush();await h.ackLatest();assert.deepEqual(h.codes(),[2,1]);assert.equal(h.state.phase,'connected');assert.ok(h.state.notice);h.actor.dispose();
});
test('invalid argument ACK is visible and leaves connection usable without retries',async()=>{
 const h=harness();await h.ready();h.actor.request(COMMAND.CELEBRATE);await flush();await h.ackLatest(2);assert.match(h.state.message,/could not accept/);assert.equal(h.state.ready,true);assert.equal(h.writes.length,1);h.actor.dispose();
});
test('ACK timeout drops connection; late ACK cannot resurrect or replay command',async()=>{
 const h=harness();await h.ready();h.actor.testHappy();await flush();const old=h.oldCallbacks(),id=h.writes[0].getUint32(2,true);await h.tick(BLE_TIMEOUTS.ack);
 assert.equal(h.state.phase,'error');assert.match(h.state.message,/No reply/);old.notified(acknowledgement(id));h.actor.testHappy();assert.equal(h.writes.length,1);assert.equal(h.state.ready,false);assert.equal(h.timers.size,0);
});
test('new context IDLE cancels old ACK wait immediately and ignores its late ACK',async()=>{
 const h=harness();await h.ready();h.actor.request(COMMAND.ENCOURAGE);await flush();const old=h.writes[0];
 h.actor.request(COMMAND.IDLE);await flush();assert.deepEqual(h.codes(),[2,4]);assert.equal(h.maxWrites,1);
 h.notify(acknowledgement(old.getUint32(2,true),1,COMMAND.ENCOURAGE));assert.equal(h.state.pending,true);assert.equal(h.state.notice,undefined);
 await h.ackLatest();await h.tick(BLE_TIMEOUTS.ack);assert.equal(h.state.phase,'connected');assert.equal(h.state.pending,false);h.actor.dispose();
});
test('new context waits for actual write to finish but not its ACK; one replaceable slot bounds rapid navigation',async()=>{
 const write=deferred(),h=harness({write:(_id,p)=>p.getUint8(6)===1?write.promise:Promise.resolve()});await h.ready();h.actor.request(COMMAND.HAPPY);await flush();
 for(let i=0;i<100;i++){h.actor.request(COMMAND.ENCOURAGE);h.actor.navigate(i%2?'home':'lesson');}
 assert.deepEqual(h.codes(),[1]);assert.equal(h.maxWrites,1);write.resolve();await flush();assert.deepEqual(h.codes(),[1,4]);assert.equal(h.maxWrites,1);await h.ackLatest();h.actor.dispose();
});
test('completion replaces unsent earlier reactions; no IDLE inserted after celebration',async()=>{
 const write=deferred(),h=harness({write:(_id,p)=>p.getUint8(6)===1?write.promise:Promise.resolve()});await h.ready();h.actor.request(COMMAND.HAPPY);await flush();
 h.actor.request(COMMAND.ENCOURAGE);h.actor.request(COMMAND.IDLE);h.actor.request(COMMAND.CELEBRATE);assert.deepEqual(h.codes(),[1]);write.resolve();await flush();assert.deepEqual(h.codes(),[1,3]);await h.ackLatest();await flush();assert.deepEqual(h.codes(),[1,3]);h.actor.dispose();
});
test('IDLE drops unsent reactions and cannot be overwritten by a fleeting new reaction',async()=>{
 const write=deferred(),h=harness({write:(_id,p)=>p.getUint8(6)===1?write.promise:Promise.resolve()});await h.ready();h.actor.request(COMMAND.HAPPY);await flush();
 h.actor.request(COMMAND.ENCOURAGE);h.actor.request(COMMAND.IDLE);assert.equal(h.actor.request(COMMAND.HAPPY),false);write.resolve();await flush();assert.deepEqual(h.codes(),[1,4]);h.actor.dispose();
});
test('one in-flight plus latest pending: rapid same-context reactions replace rather than form a FIFO',async()=>{
 const h=harness();await h.ready();h.actor.request(COMMAND.HAPPY);await flush();for(let i=0;i<100;i++)h.actor.request(i%2?COMMAND.ENCOURAGE:COMMAND.HAPPY);
 assert.deepEqual(h.codes(),[1]);await h.ackLatest();assert.deepEqual(h.codes(),[1,2]);await h.ackLatest();assert.equal(h.state.pending,false);assert.equal(h.maxWrites,1);h.actor.dispose();
});
test('screen navigation preserves established connection, synchronizes neutral and never initializes again',async()=>{
 const h=harness();await h.ready();const cleanups=h.cleanups;
 for(const screen of ['home','profile','home','lesson','home','physical'] as const){h.actor.navigate(screen);await flush();await h.ackLatest();assert.equal(h.state.phase,'connected');assert.equal(h.state.ready,true);}
 h.actor.leaveSettings();assert.equal(h.cleanups,cleanups);assert.equal(h.connections,1);assert.equal(h.initializations,1);h.actor.dispose();
});
test('leaving settings stops scan/cancels unfinished connection/subscription, without dropping a ready connection',async()=>{
 const scan=harness();scan.actor.navigate('physical');await scan.actor.scan();const old=scan.oldCallbacks();scan.actor.navigate('home');await flush();old.found({deviceId:'late'});assert.equal(scan.state.phase,'disconnected');assert.ok(scan.cleanups>0);assert.equal(scan.state.devices.length,0);
 for(const stage of ['connect','subscribe'] as const){const late=deferred(),h=harness({[stage]:()=>late.promise});h.actor.navigate('physical');await h.actor.scan();h.found();const operation=h.actor.connect('device-a');await flush();h.actor.navigate('home');await operation;late.resolve();await flush();assert.equal(h.state.ready,false);assert.equal(h.writes.length,0);assert.ok(h.cleanups>0);}
 const connected=harness();await connected.ready();connected.actor.navigate('home');await flush();assert.equal(connected.state.phase,'connected');assert.equal(connected.cleanups,0);connected.actor.dispose();
});
test('disconnect clears all work; old callbacks cannot affect a fresh connection or its new IDs',async()=>{
 const h=harness();await h.ready();h.actor.request(COMMAND.HAPPY);await flush();const old=h.oldCallbacks(),oldId=h.writes[0].getUint32(2,true);h.actor.request(COMMAND.ENCOURAGE);h.disconnect();await flush();
 await h.ready();h.actor.request(COMMAND.HAPPY);await flush();const nextId=h.writes[0].getUint32(2,true);assert.notEqual(oldId,nextId);old.notified(acknowledgement(nextId));old.disconnected();old.enabled(false);assert.equal(h.state.phase,'connected');assert.equal(h.state.pending,true);
 h.notify(acknowledgement(oldId));assert.equal(h.state.pending,true);await h.ackLatest();h.actor.dispose();
});
test('background retains established link but drops reactions/ACK waits; resume checks then only synchronizes IDLE',async()=>{
 const h=harness();await h.ready();h.actor.request(COMMAND.HAPPY);await flush();h.actor.request(COMMAND.ENCOURAGE);const old=h.oldCallbacks(),id=h.writes[0].getUint32(2,true);
 h.actor.setActive(false);await flush();assert.equal(h.state.phase,'suspended');assert.equal(h.state.ready,false);assert.equal(h.state.pending,false);assert.equal(h.cleanups,0);assert.equal(h.timers.size,0);
 old.notified(acknowledgement(id));assert.equal(h.actor.request(COMMAND.CELEBRATE),false);await h.tick(120000);assert.deepEqual(h.codes(),[1]);
 h.actor.setActive(true);assert.equal(h.state.phase,'reconciling');assert.equal(h.actor.request(COMMAND.HAPPY),false);await flush();assert.deepEqual(h.codes(),[1,4]);assert.equal(h.state.ready,false);
 old.notified(acknowledgement(id));assert.equal(h.state.ready,false);await h.ackLatest();assert.equal(h.state.phase,'connected');assert.equal(h.state.ready,true);assert.equal(h.connections,1);assert.equal(h.queries,1);assert.equal(h.cleanups,0);h.actor.dispose();
});
test('delayed initialization after cancellation cannot scan; new attempts wait until old native work drains',async()=>{
 const initialization=deferred();let scans=0;const h=harness({initialize:()=>initialization.promise,async scan(){scans++;}});const operation=h.actor.scan();await flush();h.actor.disconnect();await operation;await h.actor.scan();assert.equal(h.state.busy,true);
 initialization.resolve();await flush();assert.equal(scans,0);assert.equal(h.state.phase,'disconnected');assert.equal(h.state.busy,false);
});
test('initialize, scan-start, connection and subscription timeouts reject late callbacks without enabling commands',async()=>{
 for(const stage of ['initialize','scan','connect','subscribe'] as const){
  const delay=deferred(),h=harness({[stage]:()=>delay.promise});let operation:Promise<void>;
  if(stage==='initialize'||stage==='scan')operation=h.actor.scan();else{await h.actor.scan();h.found();operation=h.actor.connect('device-a');}
  await flush();await h.tick(stage==='initialize'?BLE_TIMEOUTS.initialize:stage==='connect'?BLE_TIMEOUTS.connect:BLE_TIMEOUTS.subscribe);await operation;assert.equal(h.state.phase,'error');assert.equal(h.state.ready,false);
  delay.resolve();await flush();h.actor.testHappy();assert.equal(h.writes.length,0);assert.equal(h.state.busy,false);assert.equal(h.timers.size,0);
 }
});
test('obsolete write timeout must not allow an overlapping IDLE write or replay after reconnect',async()=>{
 const write=deferred(),h=harness({write:()=>write.promise});await h.ready();h.actor.request(COMMAND.HAPPY);await flush();h.actor.request(COMMAND.IDLE);await h.tick(BLE_TIMEOUTS.write);
 assert.equal(h.state.phase,'error');assert.equal(h.state.ready,false);assert.deepEqual(h.codes(),[1]);write.resolve();await flush();assert.equal(h.state.busy,false);assert.equal(h.maxWrites,1);
 await h.ready(true);assert.deepEqual(h.codes(),[1,9]);h.actor.dispose();
});
test('immediate navigation/disconnect drops commands not yet handed to native bridge',async()=>{
 const h=harness();await h.ready();h.actor.request(COMMAND.HAPPY);h.actor.request(COMMAND.IDLE);await flush();assert.deepEqual(h.codes(),[4]);await h.ackLatest();h.writes.length=0;
 h.actor.testHappy();h.actor.disconnect();await flush();assert.equal(h.writes.length,0);
});
test('Bluetooth off and disposal clear timers/listeners and silence captured callbacks',async()=>{
 const h=harness();await h.ready();h.disable();await flush();assert.equal(h.state.phase,'unavailable');await h.ready();const old=h.oldCallbacks();h.actor.testHappy();await flush();h.actor.dispose();await flush();const count=h.snapshots.length;
 old.disconnected();old.enabled(false);old.notified(acknowledgement(h.writes[0].getUint32(2,true)));await h.tick(100000);assert.equal(h.snapshots.length,count);assert.equal(h.timers.size,0);assert.ok(h.cleanups>0);
});

test('background stops scan and cancels unfinished connection/subscription with late cleanup',async()=>{
 const scan=harness();await scan.actor.scan();const old=scan.oldCallbacks();scan.actor.setActive(false);await flush();old.found({deviceId:'late'});assert.equal(scan.state.phase,'disconnected');assert.equal(scan.state.devices.length,0);assert.ok(scan.cleanups>0);assert.equal(scan.timers.size,0);
 for(const stage of ['connect','subscribe'] as const){
  const pending=deferred(),h=harness({[stage]:()=>pending.promise});await h.actor.scan();h.found();const operation=h.actor.connect('device-a');await flush();h.actor.setActive(false);await operation;
  pending.resolve();await flush();h.actor.setActive(true);await flush();assert.equal(h.state.phase,'disconnected');assert.equal(h.writes.length,0);assert.ok(h.cleanups>0);assert.equal(h.queries,0);
 }
});
test('foreground cannot overlap a submitted pre-lock write; late ACK belongs to cancelled request',async()=>{
 const write=deferred(),h=harness({write:(_id,p)=>p.getUint8(6)===1?write.promise:Promise.resolve()});await h.ready();h.actor.testHappy();await flush();const id=h.writes[0].getUint32(2,true);
 h.actor.setActive(false);await flush();h.actor.setActive(true);await flush();assert.deepEqual(h.codes(),[1]);assert.equal(h.state.ready,false);assert.equal(h.queries,0);assert.equal(h.cleanups,0);
 write.resolve();await flush();assert.deepEqual(h.codes(),[1,4]);assert.equal(h.maxWrites,1);h.notify(acknowledgement(id));assert.equal(h.state.ready,false);await h.ackLatest();assert.equal(h.state.ready,true);assert.equal(h.cleanups,0);h.actor.dispose();
});
test('pre-lock unsent bridge call is discarded without dropping the retained link',async()=>{
 const h=harness();await h.ready();h.actor.testHappy();h.actor.setActive(false);await flush();assert.equal(h.writes.length,0);assert.equal(h.cleanups,0);
 h.actor.setActive(true);await flush();assert.deepEqual(h.codes(),[4]);await h.ackLatest();assert.equal(h.state.ready,true);h.actor.dispose();
});
test('foreground reports lost, disabled or unconfirmable native connection honestly; no reconnect',async()=>{
 for(const outcome of ['lost','disabled','error'] as const){
  let returning=false;const h=harness({isEnabled:async()=>!(returning&&outcome==='disabled'),connected:async()=>{if(outcome==='error')throw new Error('native query failed');return false;}});
  await h.ready();h.actor.setActive(false);returning=true;h.actor.setActive(true);await flush();
  assert.equal(h.state.phase,outcome==='lost'?'disconnected':outcome==='disabled'?'unavailable':'error');assert.equal(h.state.ready,false);assert.equal(h.writes.length,0);assert.equal(h.connections,1);assert.ok(h.cleanups>0);h.actor.dispose();
 }
});
test('explicit Disconnect during reconciliation cannot be undone by late success',async()=>{
 const query=deferred<boolean>(),h=harness({connected:()=>query.promise});await h.ready();h.actor.setActive(false);h.actor.setActive(true);await flush();assert.equal(h.state.phase,'reconciling');
 h.actor.disconnect();query.resolve(true);await flush();assert.equal(h.state.phase,'disconnected');assert.equal(h.writes.length,0);assert.equal(h.state.ready,false);assert.ok(h.cleanups>0);h.actor.setActive(false);h.actor.setActive(true);await flush();assert.equal(h.queries,1);assert.equal(h.connections,1);
});
test('delayed native disconnect callback during pause/reconciliation defeats stale live query',async()=>{
 for(const phase of ['suspended','reconciling'] as const){const query=deferred<boolean>(),h=harness({connected:()=>query.promise});await h.ready();h.actor.setActive(false);const old=h.oldCallbacks();
  if(phase==='reconciling'){h.actor.setActive(true);await flush();}old.disconnected();query.resolve(true);h.actor.setActive(true);await flush();assert.equal(h.state.phase,'disconnected');assert.equal(h.state.ready,false);assert.equal(h.writes.length,0);assert.equal(h.connections,1);
 }
});
test('Bluetooth off callback while paused clears the retained link even if JS receives it late',async()=>{
 const h=harness();await h.ready();h.actor.setActive(false);h.disable();await flush();h.actor.setActive(true);await flush();assert.equal(h.state.phase,'unavailable');assert.equal(h.state.ready,false);assert.equal(h.writes.length,0);assert.equal(h.queries,0);
});
test('another background invalidates reconciliation without disconnecting or letting its late success resume commands',async()=>{
 const first=deferred<boolean>();let calls=0;const h=harness({connected:async()=>++calls===1?first.promise:true});await h.ready();h.actor.setActive(false);h.actor.setActive(true);await flush();assert.equal(h.queries,1);
 h.actor.setActive(false);first.resolve(true);await flush();assert.equal(h.state.phase,'suspended');assert.equal(h.writes.length,0);assert.equal(h.cleanups,0);
 h.actor.setActive(true);await flush();assert.deepEqual(h.codes(),[4]);await h.ackLatest();assert.equal(h.state.ready,true);assert.equal(h.queries,2);h.actor.dispose();
});
test('repeated lifecycle events reuse listeners/subscription and issue exactly one foreground IDLE per return',async()=>{
 const h=harness();await h.ready();for(let i=0;i<5;i++){
  h.actor.setActive(false);h.actor.setActive(false);await flush();h.actor.setActive(true);h.actor.setActive(true);await flush();assert.equal(h.state.ready,false);await h.ackLatest();assert.equal(h.state.ready,true);
 }
 assert.deepEqual(h.codes(),[4,4,4,4,4]);assert.equal(h.connections,1);assert.equal(h.initializations,1);assert.equal(h.subscriptions,1);assert.equal(h.watches,1);assert.equal(h.cleanups,0);h.actor.dispose();
});
test('foreground IDLE acknowledgement timeout or rejected sync never reports Connected or enables lesson commands',async()=>{
 for(const result of [undefined,1,2]){const h=harness();await h.ready();h.actor.setActive(false);h.actor.setActive(true);await flush();assert.equal(h.state.phase,'reconciling');
  if(result===undefined)await h.tick(BLE_TIMEOUTS.ack);else await h.ackLatest(result);
  assert.equal(h.state.phase,'error');assert.equal(h.state.ready,false);assert.equal(h.actor.request(COMMAND.HAPPY),false);assert.equal(h.connections,1);assert.equal(h.writes.length,1);
 }
});
test('bounded foreground query and unresolved native write failures offer manual connection, without replay',async()=>{
 const query=deferred<boolean>(),h=harness({connected:()=>query.promise});await h.ready();h.actor.setActive(false);h.actor.setActive(true);await flush();await h.tick(BLE_TIMEOUTS.subscribe);assert.equal(h.state.phase,'error');query.resolve(true);await flush();assert.equal(h.writes.length,0);
 const writing=deferred(),w=harness({write:()=>writing.promise});await w.ready();w.actor.testHappy();await flush();w.actor.setActive(false);w.actor.setActive(true);await flush();await w.tick(BLE_TIMEOUTS.write);assert.equal(w.state.phase,'error');assert.equal(w.queries,0);writing.resolve();await flush();assert.deepEqual(w.codes(),[1]);assert.equal(w.maxWrites,1);
});

const contexts=[COMMAND.IDLE,COMMAND.THINKING,COMMAND.STREAK,COMMAND.CONNECTED,COMMAND.CELEBRATE];
const fleeting=[COMMAND.HAPPY,COMMAND.ENCOURAGE,COMMAND.LISTENING,COMMAND.HINT];
test('every context cancels obsolete ACK waits immediately and rejects late ID/command matches',async()=>{
 for(const context of contexts){
  const h=harness();await h.ready();h.actor.request(COMMAND.LISTENING);await flush();const old=h.writes[0];
  h.actor.request(context);await flush();assert.deepEqual(h.codes(),[COMMAND.LISTENING,context]);assert.equal(h.maxWrites,1);
  h.notify(acknowledgement(old.getUint32(2,true),1,COMMAND.LISTENING));assert.equal(h.state.pending,true);assert.equal(h.state.notice,undefined);
  const current=h.writes[1];h.notify(acknowledgement(current.getUint32(2,true),0,COMMAND.HINT));assert.equal(h.state.pending,true);
  await h.ackLatest();await h.tick(BLE_TIMEOUTS.ack);assert.equal(h.state.pending,false);assert.equal(h.state.ready,true);h.actor.dispose();
 }
});
test('all pending contexts resist fleeting reactions; latest context replaces them without overlapping native writes',async()=>{
 for(const context of contexts){
  const write=deferred(),h=harness({write:(_id,p)=>p.getUint8(6)===COMMAND.LISTENING?write.promise:Promise.resolve()});await h.ready();
  h.actor.request(COMMAND.LISTENING);await flush();h.actor.request(context);
  for(let i=0;i<100;i++)assert.equal(h.actor.request(fleeting[i%fleeting.length]),false);
  assert.deepEqual(h.codes(),[COMMAND.LISTENING]);h.actor.request(COMMAND.THINKING);h.actor.request(COMMAND.STREAK);h.actor.request(COMMAND.CELEBRATE);
  write.resolve();await flush();assert.deepEqual(h.codes(),[COMMAND.LISTENING,COMMAND.CELEBRATE]);assert.equal(h.maxWrites,1);await h.ackLatest();assert.equal(h.state.pending,false);h.actor.dispose();
 }
});
test('new context never hides a genuine submitted-write rejection or timeout',async()=>{
 for(const context of contexts)for(const outcome of ['reject','timeout']){
  const write=deferred(),h=harness({write:()=>write.promise});await h.ready();h.actor.request(COMMAND.HINT);await flush();h.actor.request(context);
  if(outcome==='reject'){write.reject(new Error('Native write failed'));await flush();}else await h.tick(BLE_TIMEOUTS.write);
  assert.equal(h.state.phase,'error');assert.equal(h.state.ready,false);assert.deepEqual(h.codes(),[COMMAND.HINT]);assert.equal(h.maxWrites,1);
  if(outcome==='timeout')write.resolve();await flush();assert.equal(h.state.pending,false);h.actor.dispose();
 }
});
test('unsupported new reactions show update notice and leave link usable without retries',async()=>{
 for(const command of [COMMAND.LISTENING,COMMAND.THINKING,COMMAND.HINT,COMMAND.STREAK]){
  const h=harness();await h.ready();h.actor.request(command);await flush();await h.ackLatest(1);
  assert.equal(h.state.ready,true);assert.match(h.state.notice!,/update needed/);assert.match(h.state.message,/needs an update/);
  h.actor.request(COMMAND.HAPPY);await flush();await h.ackLatest();assert.deepEqual(h.codes(),[command,COMMAND.HAPPY]);h.actor.dispose();
 }
});
test('unsupported fresh CONNECTED keeps link usable and surfaces firmware update notice',async()=>{
 const h=harness({},true,1);await h.actor.scan();h.found();await h.actor.connect('device-a');await flush();
 assert.deepEqual(h.codes(),[COMMAND.CONNECTED]);assert.equal(h.state.ready,true);assert.equal(h.state.pending,false);assert.match(h.state.notice!,/update needed/);
 h.actor.testHappy();await flush();await h.ackLatest();assert.deepEqual(h.codes(),[COMMAND.CONNECTED,COMMAND.HAPPY]);h.actor.dispose();
});
test('profile entry and repeated profile navigation send nothing; home still sends IDLE',async()=>{
 const h=harness();await h.ready();h.actor.navigate('home');await flush();await h.ackLatest();h.writes.length=0;
 h.actor.navigate('profile');await flush();for(let n=0;n<20;n++)h.actor.navigate('profile');
 assert.deepEqual(h.codes(),[]);h.actor.navigate('home');await flush();await h.ackLatest();assert.deepEqual(h.codes(),[COMMAND.IDLE]);
 assert.equal(h.connections,1);assert.equal(h.subscriptions,1);assert.equal(h.cleanups,0);h.actor.dispose();
});
test('new reactions are dropped disconnected, inactive and reconciling, never replayed on foreground',async()=>{
 const query=deferred<boolean>(),h=harness({connected:()=>query.promise});
 for(const command of Object.values(COMMAND))assert.equal(h.actor.request(command),false);
 await h.ready();h.actor.request(COMMAND.HINT);await flush();h.actor.request(COMMAND.LISTENING);h.actor.setActive(false);await flush();
 for(const command of Object.values(COMMAND))assert.equal(h.actor.request(command),false);
 h.actor.setActive(true);await flush();for(const command of Object.values(COMMAND))assert.equal(h.actor.request(command),false);
 query.resolve(true);await flush();assert.deepEqual(h.codes(),[COMMAND.HINT,COMMAND.IDLE]);await h.ackLatest();await flush();assert.deepEqual(h.codes(),[COMMAND.HINT,COMMAND.IDLE]);h.actor.dispose();
});

test('active lesson entry/resume and direct active lesson switches send THINKING; closing sends IDLE',async()=>{
 const h=harness();await h.ready();
 // Lesson 1, resumed Lesson 1, Lesson 2 and a direct switch back share the
 // semantic entry method. No same-screen deduplication may suppress a switch.
 for(let n=0;n<4;n++){
  assert.equal(h.actor.enterLesson(true),true);await flush();await h.ackLatest();
  assert.deepEqual(h.codes(),Array(n+1).fill(COMMAND.THINKING));
 }
 h.actor.navigate('home');await flush();await h.ackLatest();assert.equal(h.codes().at(-1),COMMAND.IDLE);
 assert.equal(h.connections,1);assert.equal(h.subscriptions,1);assert.equal(h.cleanups,0);h.actor.dispose();
});
test('entering completed, failed or feedback-only lesson views sends IDLE, never CELEBRATE',async()=>{
 const h=harness();await h.ready();
 for(let n=0;n<3;n++){h.actor.enterLesson(false);await flush();await h.ackLatest();}
 assert.deepEqual(h.codes(),[COMMAND.IDLE,COMMAND.IDLE,COMMAND.IDLE]);h.actor.dispose();
});
test('lesson entry replaces an obsolete ACK without overlapping a write and drops disconnected/paused entry',async()=>{
 const write=deferred(),h=harness({write:(_id,p)=>p.getUint8(6)===COMMAND.HAPPY?write.promise:Promise.resolve()});
 assert.equal(h.actor.enterLesson(true),false);assert.equal(h.actor.enterLesson(false),false);assert.deepEqual(h.codes(),[]);
 await h.ready();h.actor.request(COMMAND.HAPPY);await flush();const old=h.writes[0];
 h.actor.enterLesson(false);h.actor.enterLesson(true);assert.deepEqual(h.codes(),[COMMAND.HAPPY]);
 write.resolve();await flush();assert.deepEqual(h.codes(),[COMMAND.HAPPY,COMMAND.THINKING]);assert.equal(h.maxWrites,1);
 h.notify(acknowledgement(old.getUint32(2,true),1,COMMAND.HAPPY));assert.equal(h.state.pending,true);assert.equal(h.state.notice,undefined);
 await h.ackLatest();h.actor.setActive(false);assert.equal(h.actor.enterLesson(true),false);assert.equal(h.actor.enterLesson(false),false);
 h.actor.disconnect();assert.equal(h.actor.enterLesson(true),false);assert.equal(h.connections,1);h.actor.dispose();
});

test('explicit replay replaces the unsent reset with THINKING before native write',async()=>{
 const h=harness();await h.ready();h.actor.enterLesson(false);await flush();await h.ackLatest();h.writes.length=0;
 h.actor.request(COMMAND.IDLE); // Existing restart/reset semantics stay unchanged.
 h.actor.enterLesson(true); // Explicit replay opens the fresh first exercise.
 await flush();assert.deepEqual(h.codes(),[COMMAND.THINKING]);assert.equal(h.maxWrites,1);await h.ackLatest();
 h.actor.disconnect();assert.equal(h.actor.enterLesson(true),false);h.actor.dispose();
});

const learningCard:LearningCard={mode:2,primary:'Где метро?',secondary:'Choose on phone'};
function contentAck(p:DataView,result=0,mode=2){const ack=new DataView(new ArrayBuffer(8));ack.setUint8(0,2);ack.setUint8(1,0x90);ack.setUint32(2,p.getUint32(2,true),true);ack.setUint8(6,result);ack.setUint8(7,mode);return ack;}
test('fresh connection negotiates once, after authoritative CONNECTED, and foreground only reconciles IDLE',async()=>{
 const h=harness({},true,0,true);await h.ready(true);assert.deepEqual(h.allWrites.map(p=>p.getUint8(6)),[9,10]);
 h.actor.setActive(false);h.actor.setActive(true);await flush();await h.ackLatest();assert.deepEqual(h.allWrites.map(p=>p.getUint8(6)),[9,10,4]);h.actor.dispose();
});
test('face ACK gates card transaction; early content ACK retained with exact ID/mode matching',async()=>{
 const h=harness({async write(_id,p){if(p.getUint8(0)===2&&p.getUint8(1)===0x12)h.notify(contentAck(p));}},true,0,true);await h.ready();
 h.actor.request(COMMAND.THINKING,learningCard);await flush();assert.equal(h.writes.length,1);await h.ackLatest();
 assert.deepEqual(h.writes.map(p=>p.getUint8(1)),[1,0x10,0x11,0x11,0x11,0x12]);assert.equal(h.state.pending,false);assert.equal(h.maxWrites,1);h.actor.dispose();
});
test('content rejection or final ACK timeout disables only cards, with no extra reaction or offline replay',async()=>{
 for(const outcome of ['reject','timeout']){
  const h=harness({},true,0,true);await h.ready();h.actor.request(COMMAND.THINKING,learningCard);await flush();await h.ackLatest();
  const commit=h.writes.at(-1)!;assert.equal(commit.getUint8(1),0x12);
  if(outcome==='reject')h.notify(contentAck(commit,6));else await h.tick(CARD_LIMITS.ack);
  await flush();assert.equal(h.state.ready,true);assert.deepEqual(h.codes(),[6]);
  h.actor.request(COMMAND.HAPPY,{...learningCard,mode:5});await flush();await h.ackLatest();assert.equal(h.writes.at(-1)!.getUint8(0),1);assert.deepEqual(h.codes(),[6,1]);h.actor.dispose();
 }
});
test('transfer deadline includes BEGIN native response; no late COMMIT and no overlapping writes',async()=>{
 const begin=deferred();const h=harness({write:(_id,p)=>p.getUint8(0)===2&&p.getUint8(1)===0x10?begin.promise:Promise.resolve()},true,0,true);await h.ready();
 h.actor.request(COMMAND.THINKING,learningCard);await flush();await h.ackLatest();assert.equal(h.writes.at(-1)!.getUint8(1),0x10);
 await h.tick(3500);begin.resolve();await flush();assert.ok(!h.writes.some(p=>p.getUint8(1)===0x12));assert.equal(h.state.ready,true);assert.equal(h.maxWrites,1);assert.deepEqual(h.codes(),[6]);h.actor.dispose();
});
test('context cancellation drops remaining fragments and obsolete content ACK, retaining submitted write slot',async()=>{
 const data=deferred();const h=harness({write:(_id,p)=>p.getUint8(0)===2&&p.getUint8(1)===0x11?data.promise:Promise.resolve()},true,0,true);await h.ready();
 h.actor.request(COMMAND.THINKING,learningCard);await flush();await h.ackLatest();const old=h.writes.at(-1)!;
 for(let i=0;i<100;i++)h.actor.request(COMMAND.THINKING,learningCard);h.actor.request(COMMAND.CELEBRATE);await flush();assert.deepEqual(h.codes(),[6]);
 data.resolve();await flush();assert.deepEqual(h.codes(),[6,3]);assert.equal(h.maxWrites,1);assert.ok(!h.writes.some(p=>p.getUint8(1)===0x12));
 h.notify(contentAck(old,6));await h.ackLatest();assert.equal(h.state.ready,true);assert.equal(h.state.notice,undefined);h.actor.dispose();
});
test('content wait is cancelled by background; resume sends only IDLE and ignores old completion',async()=>{
 const h=harness({},true,0,true);await h.ready();h.actor.request(COMMAND.THINKING,learningCard);await flush();await h.ackLatest();const old=h.writes.at(-1)!;
 h.actor.setActive(false);await flush();assert.equal(h.timers.size,0);assert.equal(h.actor.request(COMMAND.HINT,learningCard),false);
 h.actor.setActive(true);await flush();h.notify(contentAck(old));assert.equal(h.state.ready,false);await h.ackLatest();assert.deepEqual(h.codes(),[6,4]);assert.equal(h.cleanups,0);h.actor.dispose();
});
test('content ACK requires both transaction and display mode',async()=>{
 const h=harness({},true,0,true);await h.ready();h.actor.request(COMMAND.THINKING,learningCard);await flush();await h.ackLatest();const commit=h.writes.at(-1)!;
 const wrong=contentAck(commit);wrong.setUint32(2,commit.getUint32(2,true)+1,true);h.notify(wrong);h.notify(contentAck(commit,0,5));await flush();assert.equal(h.state.pending,true);
 h.notify(contentAck(commit));await flush();assert.equal(h.state.pending,false);h.actor.dispose();
});
test('canceling a card ACK wait preserves negotiated cards for the next context',async()=>{
 const h=harness({},true,0,true);await h.ready();h.actor.request(COMMAND.THINKING,learningCard);await flush();await h.ackLatest();const old=h.writes.at(-1)!;
 h.actor.request(COMMAND.THINKING,{...learningCard,primary:'Next question'});await flush();await h.ackLatest();const commit=h.writes.at(-1)!;
 assert.equal(commit.getUint8(1),0x12);assert.notEqual(commit.getUint32(2,true),old.getUint32(2,true));h.notify(contentAck(old,6));assert.equal(h.state.pending,true);h.notify(contentAck(commit));await flush();assert.equal(h.state.ready,true);assert.equal(h.state.pending,false);h.actor.dispose();
});
test('native content-write errors remain fatal even when a newer context replaces the job',async()=>{
 for(const outcome of ['reject','timeout']){
  const write=deferred();const h=harness({write:(_id,p)=>p.getUint8(0)===2?write.promise:Promise.resolve()},true,0,true);await h.ready();h.actor.request(COMMAND.THINKING,learningCard);await flush();await h.ackLatest();h.actor.request(COMMAND.IDLE);
  if(outcome==='reject'){write.reject(new Error('Native content write failed'));await flush();}else await h.tick(BLE_TIMEOUTS.write);
  assert.equal(h.state.phase,'error');assert.equal(h.state.ready,false);assert.deepEqual(h.codes(),[6]);assert.equal(h.maxWrites,1);if(outcome==='timeout')write.resolve();await flush();h.actor.dispose();
 }
});

test('missing, malformed, or incomplete capability offers quietly retain face-only connection without retry',async()=>{
 for(const capability of ['silent','ack-only','malformed'] as const){
  const h=harness({},true,0,capability);await h.actor.scan();h.found();await h.actor.connect('device-a');await flush();assert.equal(h.state.ready,true);
  await h.tick(CARD_LIMITS.ack);assert.equal(h.state.pending,false);assert.equal(h.state.notice,undefined);assert.equal(h.state.ready,true);
  h.actor.request(COMMAND.THINKING,learningCard);await flush();await h.ackLatest();assert.deepEqual(h.codes(),[9,6]);assert.equal(h.allWrites.filter(p=>p.getUint8(0)===1&&p.getUint8(6)===10).length,1);assert.ok(!h.writes.some(p=>p.getUint8(0)===2));h.actor.dispose();
 }
});
test('new lesson context cancels capability ACK wait immediately and never renegotiates or sends stale cards',async()=>{
 const h=harness({},true,0,'silent');await h.actor.scan();h.found();await h.actor.connect('device-a');await flush();
 h.actor.request(COMMAND.THINKING,learningCard);await flush();assert.deepEqual(h.codes(),[9,6]);await h.ackLatest();assert.equal(h.state.pending,false);await h.tick(10000);assert.equal(h.state.ready,true);assert.equal(h.state.notice,undefined);h.actor.dispose();
});
