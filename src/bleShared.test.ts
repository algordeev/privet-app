import test from 'node:test';
import assert from 'node:assert/strict';
import {createBleShared,type BlePlugin,type ScanResult} from './bleShared.ts';
const ROBOT='7b5e0001-6d8a-4f3b-9c2e-1a0d8f6b4c91';
function fakePlugin(){
 const calls:string[]=[];let scanCallback:((r:ScanResult)=>void)|undefined,enabled:((v:boolean)=>void)|undefined,initializations=0;
 const plugin:BlePlugin={
  disableQueue(){calls.push('disableQueue');},
  async initialize(){initializations++;calls.push('initialize');},
  // Like iOS: one native scan; a new request replaces the previous callback.
  async requestLEScan(options,callback){calls.push(`scan:${options.services?.join(',')??'all'}`);scanCallback=callback;},
  async stopLEScan(){calls.push('stopScan');scanCallback=undefined;},
  async startEnabledNotifications(callback){calls.push('watch');enabled=callback;},
  async stopEnabledNotifications(){calls.push('unwatch');enabled=undefined;},
 };
 return {plugin,calls,see:(r:ScanResult)=>scanCallback?.(r),setEnabled:(v:boolean)=>enabled?.(v),get initializations(){return initializations;}};
}
const robotLease=(seen:ScanResult[])=>({services:[ROBOT],accept:(r:ScanResult)=>!!r.uuids?.includes(ROBOT)||!!r.name?.startsWith('Privet-'),callback:(r:ScanResult)=>seen.push(r)});
const printerLease=(seen:ScanResult[])=>({accept:(r:ScanResult)=>!!r.name?.startsWith('SC03'),callback:(r:ScanResult)=>seen.push(r)});

test('initialization runs once and disables the plugin queue once, even when requested together',async()=>{
 const f=fakePlugin(),shared=createBleShared(f.plugin);
 await Promise.all([shared.initialize(),shared.initialize()]);await shared.initialize();
 assert.equal(f.initializations,1);assert.deepEqual(f.calls,['disableQueue','initialize']);
});
test('robot and printer share one native scan; each lease only receives its own devices',async()=>{
 const f=fakePlugin(),shared=createBleShared(f.plugin),robot:ScanResult[]=[],printer:ScanResult[]=[];
 const releaseRobot=await shared.acquireScan(robotLease(robot));
 assert.equal(shared.scanning(),ROBOT);
 const releasePrinter=await shared.acquireScan(printerLease(printer));
 assert.equal(shared.scanning(),'unfiltered');
 f.see({deviceId:'p',name:'SC03h-438F'});f.see({deviceId:'r',name:'Privet-ESP32',uuids:[ROBOT]});f.see({deviceId:'x',name:'Headphones'});
 assert.deepEqual(robot.map(r=>r.deviceId),['r']);assert.deepEqual(printer.map(r=>r.deviceId),['p']);
 // Robot cleanup never ends the printer's scan...
 await releaseRobot();
 assert.equal(shared.scanning(),'unfiltered');f.see({deviceId:'p2',name:'SC03h-1111'});assert.deepEqual(printer.map(r=>r.deviceId),['p','p2']);
 await releaseRobot();assert.equal(shared.scanning(),'unfiltered');
 await releasePrinter();assert.equal(shared.scanning(),'off');assert.equal(f.calls.at(-1),'stopScan');
});
test('…and printer cleanup never ends the robot scan; it narrows back to the robot filter',async()=>{
 const f=fakePlugin(),shared=createBleShared(f.plugin),robot:ScanResult[]=[];
 const releasePrinter=await shared.acquireScan(printerLease([]));
 await shared.acquireScan(robotLease(robot));
 await releasePrinter();
 assert.equal(shared.scanning(),ROBOT);
 f.see({deviceId:'r',name:'Privet-Mini',uuids:[ROBOT]});assert.equal(robot.length,1);
 assert.deepEqual(f.calls,['scan:all','stopScan',`scan:${ROBOT}`]);
});
test('a failed native scan start rejects only that lease and leaves the others running',async()=>{
 const f=fakePlugin(),shared=createBleShared(f.plugin);
 await shared.acquireScan(robotLease([]));
 const request=f.plugin.requestLEScan;let fail=true;
 f.plugin.requestLEScan=async(options,cb)=>{if(fail&&!options.services){fail=false;throw new Error('Could not start');}return request(options,cb);};
 await assert.rejects(shared.acquireScan(printerLease([])),/Could not start/);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(shared.scanning(),ROBOT);
});
test('the Bluetooth-enabled listener fans out; one watcher leaving never silences another',async()=>{
 const f=fakePlugin(),shared=createBleShared(f.plugin),a:boolean[]=[],b:boolean[]=[];
 const removeA=await shared.watchEnabled(v=>a.push(v));const removeB=await shared.watchEnabled(v=>b.push(v));
 assert.equal(f.calls.filter(c=>c==='watch').length,1);
 f.setEnabled(false);assert.deepEqual([a,b],[[false],[false]]);
 await removeA();await removeA();f.setEnabled(true);assert.deepEqual([a,b],[[false],[false,true]]);
 assert.equal(f.calls.includes('unwatch'),false);
 await removeB();assert.equal(f.calls.at(-1),'unwatch');
});
