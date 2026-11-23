import test from 'node:test';
import assert from 'node:assert/strict';
import {AWAY_TOO_LONG_MESSAGE,batches,BACKGROUND_MESSAGE,createPrinterTransport,DEFAULT_PRINT_ROWS_PER_SECOND,describePrint,HELD_MESSAGE,learnRate,printEstimate,PRINTER_BUSY_HINT,PRINTER_TIMEOUTS,ROWS_PER_WRITE,SLOWEST_PRINT_ROWS_PER_SECOND,type PrinterDriver,type PrinterState} from './printerTransport.ts';
import {CMD,LATTICE_END,isRowPacket,printJob} from './printerProtocol.ts';
const flush=async()=>{for(let i=0;i<5;i++)await new Promise<void>(resolve=>setImmediate(resolve));};
const PAUSE=new DataView(new Uint8Array([0x51,0x78,0xAE,0,1,0,0x10,0x70,0xFF]).buffer);
const RESUME=new DataView(new Uint8Array([0x51,0x78,0xAE,0,1,0,0x00,0x00,0xFF]).buffer);
const isEnd=(p:Uint8Array)=>p[2]===CMD.LATTICE&&p[6]===LATTICE_END[0]&&p[9]===0x00;
const rows=(n:number)=>Array.from({length:n},()=>new Uint8Array(48));
function harness(overrides:Partial<PrinterDriver>={},supported=true,rowsPerWrite=1){
 let now=0,nextTimer=0,initializations=0,cleanups=0,hiddenNow=true;
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
  maxWrite:overrides.maxWrite,
  async cleanup(id){cleanups++;await overrides.cleanup?.(id);},
 };
 const actor=createPrinterTransport(driver,s=>states.push(s),{supported:()=>supported,rowsPerWrite,now:()=>now,hidden:()=>hiddenNow,clock:{
  set(fn,ms){const id=++nextTimer;timers.set(id,{at:now+ms,fn});return id as unknown as ReturnType<typeof setTimeout>;},
  clear(id){timers.delete(id as unknown as number);},
 }});
 const h={actor,writes,states,timers,setHidden:(value:boolean)=>{hiddenNow=value;},get state(){return actor.getState();},get initializations(){return initializations;},get cleanups(){return cleanups;},
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
test('no printer found, or a failed connection, explains the one-connection limit',async()=>{
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
test('a failed write drops the connection; disconnect ends a job cleanly first, and the background still frees an idle printer',async()=>{
 let fail=false;const h=harness({async write(){if(fail)throw new Error('Not connected');}});await h.ready();
 const job=h.actor.print(printJob(rows(20)));await h.tick(PRINTER_TIMEOUTS.pace*5);fail=true;
 assert.equal(await h.run(job),'failed');assert.equal(h.state.phase,'error');
 const t=harness();await t.ready();const running=t.actor.print(printJob(rows(50)));await t.tick(PRINTER_TIMEOUTS.pace*12);
 void t.actor.disconnect();assert.equal(await t.run(running),'cancelled');await flush();
 assert.equal(isEnd(t.writes.at(-1)!.value),true);assert.equal(t.state.phase,'disconnected');assert.ok(t.cleanups>0);
 // Nothing printing: going to the background still releases the printer for other apps.
 const idle=harness();await idle.ready();idle.actor.setActive(false);await flush();
 assert.equal(idle.state.phase,'disconnected');assert.equal(idle.state.message,BACKGROUND_MESSAGE);
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
test('a quiet look shows nothing, connects to the remembered printer as soon as it is seen, and marks it automatic',async()=>{
 const h=harness();await h.actor.discover({target:'printer-a'});
 assert.equal(h.state.phase,'scanning');assert.equal(h.state.quiet,true);assert.equal(h.state.message,'No printer connected.');
 h.found('other','MX10');assert.equal(h.state.phase,'scanning');
 h.found();await flush();
 assert.equal(h.state.phase,'connected');assert.equal(h.state.auto,true);assert.equal(h.state.quiet,false);
 assert.ok(h.states.every(s=>!/Looking|Preparing/.test(s.message)));
});
test('a quiet look ends silently after the short window, and its failures stay silent (except a permission denial)',async()=>{
 const h=harness();await h.actor.discover({target:'printer-a'});await h.tick(PRINTER_TIMEOUTS.lookup);
 assert.equal(h.state.phase,'disconnected');assert.equal(h.state.message,'No printer connected.');assert.equal(h.state.quiet,false);
 const off=harness({async isEnabled(){return false;}});await off.actor.discover({target:'printer-a'});assert.equal(off.state.phase,'disconnected');assert.equal(off.state.message,'No printer connected.');
 const broken=harness({async scan(){throw new Error('Could not start');}});await broken.actor.discover({target:'printer-a'});assert.equal(broken.state.phase,'disconnected');assert.equal(broken.state.message,'No printer connected.');
 const refused=harness({async connect(){throw new Error('Peripheral rejected');}});await refused.actor.discover({target:'printer-a'});refused.found();await flush();
 assert.equal(refused.state.phase,'disconnected');assert.equal(refused.state.message,'No printer connected.');
 const denied=harness({async initialize(){throw new Error('BLE permission denied');}});await denied.actor.discover({target:'printer-a'});assert.equal(denied.state.phase,'permission-denied');
});
test('Connect during a quiet look turns it into the visible scan, keeping what it found',async()=>{
 const h=harness();await h.actor.discover({target:'printer-a'});h.found('other','GB01');
 await h.actor.scan();
 assert.equal(h.state.quiet,false);assert.equal(h.state.message,'Looking for your printer…');assert.deepEqual(h.state.devices.map(d=>d.deviceId),['other']);
 await h.tick(PRINTER_TIMEOUTS.lookup);assert.equal(h.state.phase,'scanning');
 await h.actor.connect('other');await flush();assert.equal(h.state.phase,'connected');assert.equal(h.state.auto,false);
});
test('no quiet look while connected, already looking, or in the background',async()=>{
 const h=harness();await h.ready();const before=h.initializations;await h.actor.discover({target:'printer-a'});assert.equal(h.state.phase,'connected');assert.equal(h.initializations,before);
 const away=harness();away.actor.setActive(false);await away.actor.discover({target:'printer-a'});assert.equal(away.state.phase,'disconnected');assert.equal(away.initializations,0);
 away.actor.setActive(true);await away.actor.discover({target:'printer-a'});assert.equal(away.state.phase,'scanning');
 away.actor.setActive(false);assert.equal(away.state.phase,'disconnected');assert.equal(away.state.message,'No printer connected.');
});
test('home offer: a quiet look collects other printers for the card, holds while it shows and ends silently on Not now',async()=>{
 const h=harness();await h.actor.discover({offer:true});
 assert.equal(h.state.quiet,true);assert.equal(h.state.offer,true);
 h.found('new','GB03');assert.equal(h.state.phase,'scanning');assert.deepEqual(h.state.devices.map(d=>d.deviceId),['new']);
 h.actor.holdScan();await h.tick(PRINTER_TIMEOUTS.scan*2);assert.equal(h.state.phase,'scanning');
 h.actor.stopDiscovery();assert.equal(h.state.phase,'disconnected');assert.equal(h.state.message,'No printer connected.');
 const plain=harness();await plain.actor.discover({});assert.equal(plain.initializations,0);
 const picked=harness();await picked.actor.discover({offer:true});picked.found('new','GB03');await picked.actor.connect('new');await flush();
 assert.equal(picked.state.phase,'connected');assert.equal(picked.state.auto,false);
});

test('going to the background mid-print holds it and the print carries on from the next row when the app is back',async()=>{
 const h=harness();await h.ready();
 const packets=printJob(rows(40));const job=h.actor.print(packets);
 await h.tick(PRINTER_TIMEOUTS.pace*10);
 h.actor.setActive(false);
 assert.equal(h.state.held,true);assert.equal(h.state.phase,'printing');assert.equal(h.state.message,HELD_MESSAGE);
 await h.tick(PRINTER_TIMEOUTS.pace*3);
 const heldAt=h.writes.length;
 await h.tick(PRINTER_TIMEOUTS.hold-1000);
 assert.equal(h.writes.length,heldAt,'nothing is sent while held');assert.equal(h.state.phase,'printing');
 h.actor.setActive(true);
 assert.equal(h.state.held,false);assert.equal(h.state.message,'Printing…');
 assert.equal(await h.run(job),'done');
 assert.deepEqual(h.writes.map(w=>w.value),packets,'every packet once, in order, none skipped or repeated');
 assert.ok(h.state.lastPrint!.heldMs>=PRINTER_TIMEOUTS.hold-1000);
});
test('a brief interruption you can still see (Control Center, a banner) does not touch a running print',async()=>{
 const h=harness();await h.ready();
 const packets=printJob(rows(30));const job=h.actor.print(packets);
 await h.tick(PRINTER_TIMEOUTS.pace*8);
 h.actor.setActive(false,false);assert.notEqual(h.state.held,true);
 assert.equal(await h.run(job),'done');h.actor.setActive(true);
 assert.deepEqual(h.writes.map(w=>w.value),packets);
 // Without a print, being covered still releases the printer, as before.
 const idle=harness();await idle.ready();idle.actor.setActive(false,false);await flush();assert.equal(idle.state.phase,'disconnected');
});
test('a print held in the background ends cleanly and frees the printer after the hold time',async()=>{
 const h=harness();await h.ready();
 const job=h.actor.print(printJob(rows(60)));await h.tick(PRINTER_TIMEOUTS.pace*8);
 h.actor.setActive(false);await h.tick(PRINTER_TIMEOUTS.hold);
 assert.equal(await h.run(job),'cancelled');await flush();
 assert.equal(isEnd(h.writes.at(-1)!.value),true);assert.equal(h.state.phase,'disconnected');assert.equal(h.state.message,AWAY_TOO_LONG_MESSAGE);assert.ok(h.cleanups>0);
});
test('a web view frozen by iOS: back on screen, the app’s own return decides, by the wall clock',async()=>{
 const short=harness();await short.ready();
 const jobA=short.actor.print(printJob(rows(40)));await short.tick(PRINTER_TIMEOUTS.pace*8);
 short.actor.setActive(false);short.setHidden(false); // timers fire late, once the app is visible again
 await short.tick(PRINTER_TIMEOUTS.hold+5000);
 assert.equal(short.state.phase,'printing','a late timer does not end a print the app is about to return to');
 short.actor.setActive(true);
 assert.equal(await short.run(jobA),'cancelled','away longer than the hold time: the print ends cleanly');await flush();
 assert.equal(short.state.phase,'disconnected');assert.equal(short.state.message,AWAY_TOO_LONG_MESSAGE);
 // Back within the hold time, even if the timer is late: the print carries on.
 const quick=harness();await quick.ready();
 const packets=printJob(rows(40));const jobB=quick.actor.print(packets);await quick.tick(PRINTER_TIMEOUTS.pace*8);
 quick.actor.setActive(false);quick.setHidden(false);await quick.tick(5000);quick.actor.setActive(true);
 assert.equal(await quick.run(jobB),'done');assert.deepEqual(quick.writes.map(w=>w.value),packets);
});
test('the stall limit waits while the app is in the background, so a paused printer is not given up on', async()=>{
 const h=harness();await h.ready();
 const packets=printJob(rows(30));const job=h.actor.print(packets);
 await h.tick(PRINTER_TIMEOUTS.pace*6);h.notify(PAUSE);await h.tick(PRINTER_TIMEOUTS.pace*2);
 h.actor.setActive(false);await h.tick(PRINTER_TIMEOUTS.stall*2);
 assert.equal(h.state.phase,'printing','held for twice the stall limit without failing');
 h.actor.setActive(true);h.notify(RESUME);
 assert.equal(await h.run(job),'done');assert.deepEqual(h.writes.map(w=>w.value),packets);
});
test('cancel works while held, and a dropped link while held ends the job',async()=>{
 const a=harness();await a.ready();const jobA=a.actor.print(printJob(rows(40)));await a.tick(PRINTER_TIMEOUTS.pace*6);
 a.actor.setActive(false);a.actor.cancel();assert.equal(await a.run(jobA),'cancelled');
 const b=harness();await b.ready();const jobB=b.actor.print(printJob(rows(40)));await b.tick(PRINTER_TIMEOUTS.pace*6);
 b.actor.setActive(false);b.drop();assert.equal(await b.run(jobB),'failed');assert.equal(b.state.phase,'disconnected');
});
test('a finished print reports its time, rows per second and how long the printer made us wait',async()=>{
 const h=harness();await h.ready();
 const job=h.actor.print(printJob(rows(20)));await h.tick(PRINTER_TIMEOUTS.pace*4);
 h.notify(PAUSE);await h.tick(500);h.notify(RESUME);h.notify(PAUSE);await h.tick(250);h.notify(RESUME);
 await h.run(job);
 const stats=h.state.lastPrint!;
 assert.equal(stats.outcome,'done');assert.equal(stats.rows,20);assert.equal(stats.sent,20);assert.equal(stats.pauses,2);assert.equal(stats.pausedMs,750);assert.equal(stats.heldMs,0);
 assert.equal(stats.rowsPerWrite,1);assert.equal(stats.pace,PRINTER_TIMEOUTS.pace);assert.ok(stats.writes>=20);assert.ok(stats.ms>=750);
 const sample={outcome:'done' as const,rows:600,sent:600,ms:10400,sentMs:3900,finishedMs:10000,heldMs:0,pausedMs:3100,pauses:4,writes:300,rowsPerWrite:2,pace:10};
 assert.deepEqual(describePrint(sample),{
  summary:'600 rows printed in 10.0 s · 60 rows/s',
  detail:'Sent in 3.9 s, 2 rows per write with a 10 ms gap. The printer made us wait 3.1 s (4 times).',
 });
 assert.equal(describePrint({...sample,finishedMs:undefined}).summary,'600 rows sent in 3.9 s · the printer didn’t say when it finished');
 assert.equal(describePrint({...sample,finishedMs:9000,heldMs:5000}).summary,'600 rows printed in 4.0 s · 150 rows/s','time held in the background is not counted');
 assert.match(describePrint({...sample,pausedMs:200,pauses:1}).detail,/\(1 time\)/);
 assert.equal(describePrint({...sample,outcome:'stalled',sent:212}).summary,'Stopped after 212 of 600 rows: the printer stopped responding');
 assert.equal(describePrint({...sample,outcome:'failed',sent:90}).summary,'Stopped after 90 of 600 rows: the connection was lost');
 assert.equal(describePrint({...sample,outcome:'cancelled',sent:40}).summary,'Cancelled after 40 of 600 rows');
});
test('tuning one print: bigger batches and a shorter gap send the same bytes in the same order',async()=>{
 const base=harness();await base.ready();const packets=printJob(rows(24));
 await base.run(base.actor.print(packets,{rowsPerWrite:2,pace:10}));
 const fast=harness();await fast.ready();
 assert.equal(await fast.run(fast.actor.print(packets,{rowsPerWrite:6,pace:2})),'done');
 const join=(writes:{value:Uint8Array}[])=>Buffer.concat(writes.map(w=>w.value)).toString('hex');
 assert.equal(join(fast.writes),join(base.writes),'identical byte stream');
 assert.ok(fast.writes.length<base.writes.length,'fewer writes');
 assert.equal(fast.state.lastPrint!.rowsPerWrite,6);assert.equal(fast.state.lastPrint!.pace,2);
});
test('a write never holds more rows than the link takes at once, so a faster speed never sends back-to-back pieces',async()=>{
 const packets=printJob(rows(30));
 const base=harness();await base.ready();await base.run(base.actor.print(packets,{rowsPerWrite:2,pace:10}));
 // The link takes 182 bytes: three 56-byte rows. Asking for six gives three.
 const h=harness({maxWrite:()=>182});await h.ready();
 assert.equal(await h.run(h.actor.print(packets,{rowsPerWrite:6,pace:2})),'done');
 assert.equal(h.state.lastPrint!.rowsPerWrite,3);
 assert.ok(h.writes.every(w=>w.value.length<=182),'no write is larger than the link takes');
 assert.equal(Buffer.concat(h.writes.map(w=>w.value)).toString('hex'),Buffer.concat(base.writes.map(w=>w.value)).toString('hex'),'identical byte stream');
 // A tiny link still sends, one row at a time. A request under the limit stands.
 const tiny=harness({maxWrite:()=>20});await tiny.ready();await tiny.run(tiny.actor.print(packets,{rowsPerWrite:3,pace:2}));assert.equal(tiny.state.lastPrint!.rowsPerWrite,1);
 const wide=harness({maxWrite:()=>512});await wide.ready();await wide.run(wide.actor.print(packets,{rowsPerWrite:3,pace:2}));assert.equal(wide.state.lastPrint!.rowsPerWrite,3);
});
test('a print that stops early is recorded with the rows sent, and the speed hears about it before the state is published',async()=>{
 const heard:string[]=[];
 // The printer pauses and never resumes: the stall limit ends the print partway.
 const h=harness();await h.ready();
 const job=h.actor.print(printJob(rows(60)),{rowsPerWrite:2,label:'Fast',onOutcome:stats=>heard.push(`${stats.outcome}:${stats.sent}:${h.state.lastPrint?.outcome??'none'}`)});
 await flush();await h.tick(PRINTER_TIMEOUTS.pace*10);h.notify(PAUSE);
 assert.equal(await h.run(job),'failed');await flush();
 const stats=h.state.lastPrint!;
 assert.equal(stats.outcome,'stalled');assert.ok(stats.sent>0&&stats.sent<60);assert.equal(stats.rows,60);assert.equal(stats.label,'Fast');assert.equal(stats.pauses,1);
 assert.deepEqual(heard,[`stalled:${stats.sent}:none`],'heard before it is published');
 // A lost connection mid-print is recorded too.
 const lost=harness({async write(){if(lostNow)throw new Error('Not connected');}});let lostNow=false;await lost.ready();
 const lostJob=lost.actor.print(printJob(rows(40)));await flush();await lost.tick(PRINTER_TIMEOUTS.pace*12);lostNow=true;
 assert.equal(await lost.run(lostJob),'failed');assert.equal(lost.state.lastPrint!.outcome,'failed');assert.ok(lost.state.lastPrint!.sent>0);
 // And a cancelled one.
 const stop=harness();await stop.ready();const stopJob=stop.actor.print(printJob(rows(40)));await flush();await stop.tick(PRINTER_TIMEOUTS.pace*12);stop.actor.cancel();
 assert.equal(await stop.run(stopJob),'cancelled');assert.equal(stop.state.lastPrint!.outcome,'cancelled');assert.ok(stop.state.lastPrint!.sent>0&&stop.state.lastPrint!.sent<40);
});
// The printer's answer to a status request (A3).
const STATE_REPLY=new DataView(new Uint8Array([0x51,0x78,0xA3,0x00,0x03,0x00,0x00,0x00,0x00,0x00,0xFF]).buffer);
async function untilFinishing(h:ReturnType<typeof harness>){for(let n=0;n<5000&&!h.state.finishing;n++)await h.tick(PRINTER_TIMEOUTS.pace);assert.equal(h.state.finishing,true,'everything sent, the printer still printing');}
test('once everything is sent the print stays on "printing" until the printer answers the closing status request',async()=>{
 const h=harness();await h.ready();
 const packets=printJob(rows(40));const job=h.actor.print(packets);await flush();
 // The answer to the opening status request comes early and does not count.
 await h.tick(PRINTER_TIMEOUTS.pace*2);h.notify(STATE_REPLY);
 await untilFinishing(h);
 assert.equal(h.state.phase,'printing');assert.deepEqual(h.state.progress,{sent:40,total:40});
 assert.deepEqual(h.writes.map(w=>w.value),packets,'everything was sent');
 await h.tick(3000);assert.equal(h.state.phase,'printing','still printing on paper');
 h.notify(STATE_REPLY);
 assert.equal(await h.run(job),'done');
 const stats=h.state.lastPrint!;
 assert.equal(h.state.phase,'connected');assert.equal(h.state.finishing,false);assert.equal(h.state.message,'Printed.');
 assert.ok(stats.finishedMs!==undefined&&stats.finishedMs>=stats.sentMs+3000,`${stats.sentMs} → ${stats.finishedMs}`);
});
test('a printer that answers the closing status request at once is not waited for',async()=>{
 const h=harness({async write(_id,value){if(value[2]===CMD.STATE&&h.writes.length>3)queueMicrotask(()=>h.notify(STATE_REPLY));}});await h.ready();
 const job=h.actor.print(printJob(rows(20)));await flush();
 assert.equal(await h.run(job,400),'done','no long wait');
 assert.notEqual(h.state.lastPrint!.finishedMs,undefined);
});
test('a printer that never says it has finished ends the print after a wait that allows for a slow printer',async()=>{
 const h=harness();await h.ready();
 const job=h.actor.print(printJob(rows(300)));await flush();
 await untilFinishing(h);
 const wait=Math.max(PRINTER_TIMEOUTS.finish,300*1000/SLOWEST_PRINT_ROWS_PER_SECOND);
 await h.tick(wait-100);assert.equal(h.state.phase,'printing');
 await h.tick(200);await flush();
 assert.equal(await job,'done');assert.equal(h.state.phase,'connected');assert.equal(h.state.lastPrint!.finishedMs,undefined);
 assert.match(describePrint(h.state.lastPrint!).summary,/didn’t say when it finished/);
});
test('while the printer finishes, cancel stops waiting, the background holds nothing, and a lost link still counts as printed',async()=>{
 const a=harness();await a.ready();const jobA=a.actor.print(printJob(rows(30)));await flush();await untilFinishing(a);
 a.actor.cancel();assert.equal(await a.run(jobA),'done','everything had reached the printer');assert.equal(a.state.phase,'connected');
 const b=harness();await b.ready();const jobB=b.actor.print(printJob(rows(30)));await flush();await untilFinishing(b);
 b.actor.setActive(false);assert.notEqual(b.state.held,true,'nothing left to hold');b.actor.setActive(true);b.notify(STATE_REPLY);
 assert.equal(await b.run(jobB),'done');
 const c=harness();await c.ready();const jobC=c.actor.print(printJob(rows(30)));await flush();await untilFinishing(c);
 c.drop();assert.equal(await c.run(jobC),'done');assert.equal(c.state.lastPrint!.outcome,'done');assert.equal(c.state.phase,'disconnected');
});

test('the running print carries its start time, for the paper estimate, and drops it when it ends',async()=>{
 const h=harness();await h.ready();await h.tick(1234);
 const job=h.actor.print(printJob(rows(10)));
 assert.equal(h.state.printStartedAt,1234);
 await flush();await untilFinishing(h);h.notify(STATE_REPLY);
 assert.equal(await h.run(job),'done');assert.equal(h.state.printStartedAt,undefined);
});
test('the paper estimate follows the printer’s speed, never runs ahead of what was sent, and is never done early',()=>{
 const rate=DEFAULT_PRINT_ROWS_PER_SECOND;
 assert.deepEqual(printEstimate({sent:600,total:600,elapsedMs:0,rowsPerSecond:rate}),{printed:0,secondsLeft:19});
 assert.deepEqual(printEstimate({sent:600,total:600,elapsedMs:10000,rowsPerSecond:rate}),{printed:320,secondsLeft:9});
 assert.equal(printEstimate({sent:100,total:600,elapsedMs:10000,rowsPerSecond:rate}).printed,100,'not ahead of what was sent');
 assert.deepEqual(printEstimate({sent:600,total:600,elapsedMs:60000,rowsPerSecond:rate}),{printed:600,secondsLeft:0});
 assert.equal(printEstimate({sent:10,total:10,elapsedMs:-50,rowsPerSecond:rate}).printed,0);
});
test('the printer’s speed is learnt from prints it said it finished, half old and half new, within bounds',()=>{
 const done={outcome:'done' as const,rows:607,sent:607,ms:20000,sentMs:3900,finishedMs:19600,heldMs:0,pausedMs:0,pauses:0,writes:310,rowsPerWrite:2,pace:10};
 assert.equal(learnRate(undefined,done),31);
 assert.equal(learnRate(35,done),33);
 assert.equal(learnRate(32,{...done,finishedMs:undefined}),32,'no answer from the printer: nothing learnt');
 assert.equal(learnRate(32,{...done,outcome:'stalled'}),32);
 assert.equal(learnRate(undefined,{...done,finishedMs:1}),200,'an implausible answer is bounded');
 assert.equal(learnRate(undefined,{...done,rows:0}),undefined);
});
