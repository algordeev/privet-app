import test from 'node:test';
import assert from 'node:assert/strict';
import {createBleTransport,BLE_TIMEOUTS,type BleDriver,type BleState,type PhysicalDevice} from './bleTransport.ts';
import {encodeCommand,BLE_SERVICE,COMMAND,type CommandCode} from './bleProtocol.ts';
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function acknowledgement(id:number,result=0,command:CommandCode=COMMAND.HAPPY){const packet=encodeCommand(id,command);packet.setUint8(1,2);packet.setUint8(7,result);return packet;}
function harness(overrides:Partial<BleDriver>={},supported=true){
 let now=0,nextTimer=0,initializations=0,connections=0,cleanups=0,stopScans=0,syncing=false,activeWrites=0,maxWrites=0,subscriptions=0,watches=0,queries=0;
 let found!:(device:PhysicalDevice)=>void,notified!:(value:DataView)=>void,disconnected!:()=>void,enabled!:(value:boolean)=>void;
 const timers=new Map<number,{at:number;fn:()=>void}>(),writes:DataView[]=[],snapshots:BleState[]=[];
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
   writes.push(packet);activeWrites++;maxWrites=Math.max(maxWrites,activeWrites);
   try{
    if(syncing&&packet.getUint8(6)===COMMAND.IDLE){syncing=false;notified(acknowledgement(packet.getUint32(2,true),0,COMMAND.IDLE));}
    else await overrides.write?.(id,packet,timeout);
   }finally{activeWrites--;}
  },
  async cleanup(id){cleanups++;await overrides.cleanup?.(id);}
 };
 const actor=createBleTransport(driver,s=>snapshots.push(s),{supported:()=>supported,clock:{
  set(fn,ms){const id=++nextTimer;timers.set(id,{at:now+ms,fn});return id as unknown as ReturnType<typeof setTimeout>;},clear(id){timers.delete(id as unknown as number);}
 }});
 return {actor,driver,writes,timers,snapshots,get state(){return actor.getState();},get initializations(){return initializations;},get connections(){return connections;},get cleanups(){return cleanups;},get stopScans(){return stopScans;},get maxWrites(){return maxWrites;},get subscriptions(){return subscriptions;},get watches(){return watches;},get queries(){return queries;},
  codes:()=>writes.map(p=>p.getUint8(6)),found:(id='device-a')=>found({deviceId:id,name:'Privet-ESP32'}),notify:(p:DataView)=>notified(p),disconnect:()=>disconnected(),disable:()=>enabled(false),
  oldCallbacks:()=>({found,notified,disconnected,enabled}),
  async ackLatest(result=0){const p=writes.at(-1)!;notified(acknowledgement(p.getUint32(2,true),result,p.getUint8(6) as CommandCode));await flush();},
  async ready(keepSync=false){actor.navigate('physical');await actor.scan();this.found();await actor.connect('device-a');await flush();assert.equal(this.state.ready,true);assert.equal(this.state.pending,false);if(!keepSync)writes.length=0;},
  async tick(ms:number){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}await flush();}
 };
}
test('mount, background, unsupported environments and disconnected reactions never initialize Bluetooth',async()=>{
 const h=harness();h.actor.request(COMMAND.CELEBRATE);h.actor.navigate('lesson');h.actor.setActive(false);h.actor.setActive(true);assert.equal(h.initializations,0);
 const unsupported=harness({},false);await unsupported.actor.scan();assert.equal(unsupported.state.phase,'unavailable');assert.equal(unsupported.initializations,0);
 await h.ready(true);assert.deepEqual(h.codes(),[COMMAND.IDLE]);h.actor.dispose();
});
test('scan filters service, deduplicates devices, bounds scanning and cleans callbacks',async()=>{
 const h=harness();await h.actor.scan();h.found();h.found();assert.equal(h.state.devices.length,1);const old=h.oldCallbacks();await h.tick(BLE_TIMEOUTS.scan);
 assert.equal(h.state.phase,'disconnected');assert.ok(h.cleanups>0);old.found({deviceId:'late'});assert.equal(h.state.devices.length,0);assert.equal(h.timers.size,0);
});
test('permission denied, disabled Bluetooth, simulator unsupported and general errors remain distinct',async()=>{
 for(const [message,phase] of [['BLE permission denied','permission-denied'],['BLE unsupported','unavailable'],['Unexpected failure','error']] as const){const h=harness({async initialize(){throw new Error(message);}});await h.actor.scan();await flush();assert.equal(h.state.phase,phase);assert.equal(h.state.ready,false);}
 const off=harness({async isEnabled(){return false;}});await off.actor.scan();assert.equal(off.state.phase,'unavailable');
});
test('no command before connect AND subscription succeed; fresh subscription sends IDLE exactly once',async()=>{
 const connection=deferred(),subscription=deferred(),h=harness({connect:()=>connection.promise,subscribe:()=>subscription.promise});
 await h.actor.scan();h.found();const operation=h.actor.connect('device-a');await flush();h.actor.testHappy();assert.equal(h.state.ready,false);assert.equal(h.writes.length,0);
 connection.resolve();await flush();h.actor.request(COMMAND.HAPPY);assert.equal(h.writes.length,0);subscription.resolve();await operation;await flush();
 assert.equal(h.state.ready,true);assert.deepEqual(h.codes(),[COMMAND.IDLE]);await flush();assert.deepEqual(h.codes(),[COMMAND.IDLE]);h.actor.dispose();
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
 await h.ready(true);assert.deepEqual(h.codes(),[1,4]);h.actor.dispose();
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
