import test from 'node:test';
import assert from 'node:assert/strict';
import {batches,createPrinterTransport,PRINTER_BUSY_HINT,PRINTER_TIMEOUTS,ROWS_PER_WRITE,type PrinterDriver,type PrinterState} from './printerTransport.ts';
import {CMD,LATTICE_END,isRowPacket,printJob} from './printerProtocol.ts';
const flush=async()=>{for(let i=0;i<5;i++)await new Promise<void>(resolve=>setImmediate(resolve));};
const PAUSE=new DataView(new Uint8Array([0x51,0x78,0xAE,0,1,0,0x10,0x70,0xFF]).buffer);
const RESUME=new DataView(new Uint8Array([0x51,0x78,0xAE,0,1,0,0x00,0x00,0xFF]).buffer);
const isEnd=(p:Uint8Array)=>p[2]===CMD.LATTICE&&p[6]===LATTICE_END[0]&&p[9]===0x00;
const rows=(n:number)=>Array.from({length:n},()=>new Uint8Array(48));
function harness(overrides:Partial<PrinterDriver>={},supported=true,rowsPerWrite=1){
 let now=0,nextTimer=0,initializations=0,cleanups=0;
 let found!:(d:{deviceId:string;name?:string})=>void,notified!:(v:DataView)=>void,dropped!:()=>void;
 const timers=new Map<number,{at:number;fn:()=>void}>(),writes:{at:number;value:Uint8Array}[]=[],states:PrinterState[]=[];
 const driver:PrinterDriver={
  async initialize(){initializations++;await overrides.initialize?.();},
  isEnabled:overrides.isEnabled??(async()=>true),
  async scan(cb){found=cb;await overrides.scan?.(cb);},
  async stopScan(){},
  async connect(id,cb,timeout){dropped=cb;await overrides.connect?.(id,cb,timeout);},
  async subscribe(id,cb,timeout){notified=cb;await overrides.subscribe?.(id,cb,timeout);},
  async write(id,value){writes.push({at:now,value});await overrides.write?.(id,value);},
  async cleanup(id){cleanups++;await overrides.cleanup?.(id);},
 };
 const actor=createPrinterTransport(driver,s=>states.push(s),{supported:()=>supported,rowsPerWrite,clock:{
  set(fn,ms){const id=++nextTimer;timers.set(id,{at:now+ms,fn});return id as unknown as ReturnType<typeof setTimeout>;},
  clear(id){timers.delete(id as unknown as number);},
 }});
 const h={actor,writes,states,timers,get state(){return actor.getState();},get initializations(){return initializations;},get cleanups(){return cleanups;},
  found:(id='printer-a',name='SC03h-438F')=>found({deviceId:id,name}),notify:(v:DataView)=>notified(v),drop:()=>dropped(),
  async tick(ms:number){const end=now+ms;while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=Math.max(now,due[1].at);timers.delete(due[0]);due[1].fn();await flush();}now=end;await flush();},
  async ready(){await actor.scan();h.found();await actor.connect('printer-a');await flush();assert.equal(h.state.phase,'connected');},
  // Advances the clock in pace steps until the job settles.
  async run(job:Promise<unknown>,limit=100000){let settled=false;void job.then(()=>{settled=true;});for(let t=0;t<limit&&!settled;t+=PRINTER_TIMEOUTS.pace)await h.tick(PRINTER_TIMEOUTS.pace);assert.equal(settled,true);return job;},
 };
 return h;
}

test('nothing touches Bluetooth until the user scans; unsupported platforms never initialize',async()=>{
 const h=harness();assert.equal(h.initializations,0);h.actor.setActive(false);assert.equal(h.cleanups,0);
 const web=harness({},false);await web.actor.scan();assert.equal(web.state.phase,'unavailable');assert.equal(web.initializations,0);
});
test('a scan lists printers once each and connects to the remembered printer as soon as it is seen',async()=>{
 const h=harness();await h.actor.scan();h.found('a');h.found('a');h.found('b','GB03');
 assert.deepEqual(h.state.devices.map(d=>d.deviceId),['a','b']);
 const auto=harness();await auto.actor.scan({target:'printer-a'});auto.found('other','MX10');auto.found();await flush();
 assert.equal(auto.state.phase,'connected');assert.equal(auto.state.device?.deviceId,'printer-a');
});
test('no printer found, or a failed connection, explains the one-connection limit (iPrint)',async()=>{
 const h=harness();await h.actor.scan();await h.tick(PRINTER_TIMEOUTS.scan);
 assert.equal(h.state.phase,'disconnected');assert.match(h.state.message,/No printer found/);assert.ok(h.state.message.includes(PRINTER_BUSY_HINT));
 const never=harness({connect:()=>new Promise(()=>{})});await never.actor.scan();never.found();void never.actor.connect('printer-a');await flush();await never.tick(PRINTER_TIMEOUTS.connect);
 assert.equal(never.state.phase,'error');assert.ok(never.state.message.includes(PRINTER_BUSY_HINT));
 const refused=harness({async connect(){throw new Error('Peripheral rejected');}});await refused.actor.scan();refused.found();await refused.actor.connect('printer-a');
 assert.equal(refused.state.phase,'error');assert.ok(refused.state.message.includes(PRINTER_BUSY_HINT));
});
test('a job sends every packet in order, paced, one at a time, and reports rows sent / total',async()=>{
 let active=0,max=0;
 const h=harness({async write(){active++;max=Math.max(max,active);await Promise.resolve();active--;}});await h.ready();
 const packets=printJob(rows(10));
 const result=await h.run(h.actor.print(packets));
 assert.equal(result,'done');assert.equal(max,1);
 assert.deepEqual(h.writes.map(w=>w.value),packets);
 for(let i=1;i<h.writes.length;i++)assert.ok(h.writes[i].at-h.writes[i-1].at>=PRINTER_TIMEOUTS.pace);
 const progress=h.states.filter(s=>s.progress).map(s=>s.progress!.sent);
 assert.equal(progress[0],0);assert.equal(progress.at(-1),10);assert.ok(progress.every((n,i)=>i===0||n>=progress[i-1]));
 assert.equal(h.state.phase,'connected');assert.equal(h.state.progress,undefined);
});
test('only one job at a time',async()=>{
 const h=harness();await h.ready();const first=h.actor.print(printJob(rows(3)));
 assert.equal(await h.actor.print(printJob(rows(3))),'failed');await h.run(first);
});
test('flow control: a pause holds sending until resume',async()=>{
 const h=harness();await h.ready();const job=h.actor.print(printJob(rows(20)));
 await h.tick(PRINTER_TIMEOUTS.pace*10);
 h.notify(PAUSE);const held=h.writes.length;
 await h.tick(2000);assert.equal(h.writes.length,held);assert.equal(h.state.paused,true);
 h.notify(RESUME);assert.equal(await h.run(job),'done');assert.equal(h.writes.length,printJob(rows(20)).length);
});
test('a pause that never resumes ends the job: the lattice is closed and the link stays up',async()=>{
 const h=harness();await h.ready();const job=h.actor.print(printJob(rows(20)));
 await h.tick(PRINTER_TIMEOUTS.pace*10);h.notify(PAUSE);
 await h.tick(PRINTER_TIMEOUTS.stall);
 assert.equal(await h.run(job),'failed');assert.equal(isEnd(h.writes.at(-1)!.value),true);
 assert.equal(h.state.phase,'connected');assert.match(h.state.message,/stopped responding/);
});
test('cancel stops sending at once (even while paused) and still closes the lattice',async()=>{
 const h=harness();await h.ready();const job=h.actor.print(printJob(rows(50)));
 await h.tick(PRINTER_TIMEOUTS.pace*12);h.actor.cancel();
 assert.equal(await h.run(job),'cancelled');
 const sent=h.writes.map(w=>w.value);assert.equal(isEnd(sent.at(-1)!),true);assert.ok(sent.filter(isRowPacket).length<50);
 assert.equal(sent.filter(p=>p[2]===CMD.FEED).length,0);
 assert.equal(h.state.phase,'connected');assert.equal(h.state.message,'Printing cancelled.');
 const paused=harness();await paused.ready();const second=paused.actor.print(printJob(rows(50)));
 await paused.tick(PRINTER_TIMEOUTS.pace*12);paused.notify(PAUSE);paused.actor.cancel();
 assert.equal(await paused.run(second),'cancelled');assert.equal(isEnd(paused.writes.at(-1)!.value),true);
});
test('a dropped link mid-job stops sending with no end packet and says what happened',async()=>{
 const h=harness();await h.ready();const job=h.actor.print(printJob(rows(50)));
 await h.tick(PRINTER_TIMEOUTS.pace*12);const before=h.writes.length;h.drop();
 assert.equal(await h.run(job),'failed');await h.tick(100);
 assert.equal(h.writes.length,before);assert.equal(h.state.phase,'disconnected');assert.match(h.state.message,/disconnected while printing/);
 assert.ok(h.cleanups>0);
});
test('a failed write drops the connection; disconnect and background end a job cleanly first',async()=>{
 let fail=false;const h=harness({async write(){if(fail)throw new Error('Not connected');}});await h.ready();
 const job=h.actor.print(printJob(rows(20)));await h.tick(PRINTER_TIMEOUTS.pace*5);fail=true;
 assert.equal(await h.run(job),'failed');assert.equal(h.state.phase,'error');
 for(const leave of [(t:ReturnType<typeof harness>)=>t.actor.disconnect(),(t:ReturnType<typeof harness>)=>t.actor.setActive(false)]){
  const t=harness();await t.ready();const running=t.actor.print(printJob(rows(50)));await t.tick(PRINTER_TIMEOUTS.pace*12);
  void leave(t);assert.equal(await t.run(running),'cancelled');await flush();
  assert.equal(isEnd(t.writes.at(-1)!.value),true);assert.equal(t.state.phase,'disconnected');assert.ok(t.cleanups>0);
 }
});
test('rows go two per write by default: same bytes in the same order, half the row writes, progress still counts rows',async()=>{
 assert.equal(ROWS_PER_WRITE,2);
 const packets=printJob(rows(5)),grouped=batches(packets,2);
 assert.deepEqual(grouped.map(b=>b.rows),[0,0,0,0,0,0,0,2,2,1,0,0,0]);
 const joined=(list:Uint8Array[])=>list.flatMap(p=>[...p]);
 assert.deepEqual(joined(grouped.map(b=>b.value)),joined(packets));
 const h=harness({},true,ROWS_PER_WRITE);await h.ready();
 assert.equal(await h.run(h.actor.print(printJob(rows(9)))),'done');
 assert.equal(h.writes.length,7+5+3);
 assert.deepEqual(joined(h.writes.map(w=>w.value)),joined(printJob(rows(9))));
 const progress=h.states.filter(s=>s.progress).map(s=>s.progress!.sent);assert.equal(progress.at(-1),9);
 for(let i=1;i<h.writes.length;i++)assert.ok(h.writes[i].at-h.writes[i-1].at>=PRINTER_TIMEOUTS.pace);
});
