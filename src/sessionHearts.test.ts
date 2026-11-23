import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSession,loadSession,readSaved,restoreSession} from './session.ts';
import {initialProgress,type Progress} from './engine.ts';
import {PRODUCT} from './config.ts';
import {websiteCafeLesson as cafe} from './curriculum/catalog.ts';

// The original café lesson (without speaking steps) has 5 steps. A valid saved attempt on step 2 after one right answer:
const onStep2:Progress={...initialProgress(),index:1,results:[true],hearts:2,combo:1,bestCombo:1};
const saved=(progress:object)=>JSON.stringify({...freshSession(),progress});
const restored=(progress:object)=>restoreSession(saved(progress),cafe).progress;

// loadSession/readSaved read localStorage; give them one key at a time.
function withStorage(entries:Record<string,unknown>,run:()=>void){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const data=new Map(Object.entries(entries).map(([key,value])=>[key,JSON.stringify(value)]));
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null}});
 try{run();}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
}
const results=[true,false,true,true,true];

test('a valid saved attempt comes back as it was, including a failed one waiting on Try again',()=>{
 assert.deepEqual(restored(onStep2),onStep2);
 const failed={...onStep2,attempts:1,feedback:'incorrect',hearts:0,combo:0,failed:true};
 assert.deepEqual(restored(failed),failed);
});

test('an attempt saved without its heart and run values starts the lesson fresh',()=>{
 const {hearts,combo,bestCombo,failed,...old}=onStep2;
 for(const progress of [old,{...old,hearts:2}])assert.deepEqual(restoreSession(saved(progress),cafe),freshSession(),JSON.stringify(progress));
});

test('loading and saving again leaves the stored text unchanged',()=>{
 for(const progress of [initialProgress(),onStep2]){const text=saved(progress);assert.equal(JSON.stringify(restoreSession(text,cafe)),text);}
});

test('heart, run and failure values that break the rules start the lesson fresh',()=>{
 const broken:object[]=[
  {...onStep2,hearts:4},{...onStep2,hearts:-1},{...onStep2,hearts:1.5},{...onStep2,hearts:null},
  {...onStep2,combo:-1},{...onStep2,combo:6,bestCombo:6},{...onStep2,combo:2,bestCombo:1},{...onStep2,bestCombo:6},
  {...onStep2,failed:'no'},{...onStep2,failed:true},{...onStep2,hearts:0},
  {...onStep2,attempts:1,feedback:null,hearts:0,failed:true},
  {...initialProgress(),index:5,results,complete:true,hearts:0,failed:true},
 ];
 for(const progress of broken)assert.deepEqual(restoreSession(saved(progress),cafe),freshSession(),JSON.stringify(progress));
});

test('a finished lesson is rebuilt from its completion record with the hearts and best run saved there',()=>{
 withStorage({[PRODUCT.storageKey]:{completion:{results,date:'2026-11-20',hearts:1,bestCombo:3}}},()=>{
  const progress=loadSession(true,cafe).progress;
  assert.deepEqual(progress,{...initialProgress(),index:5,results,complete:true,hearts:1,bestCombo:3});
 });
});

test('a completion record with missing or impossible hearts or best run is ignored',()=>{
 for(const extra of [{hearts:undefined},{bestCombo:undefined},{hearts:null},{hearts:4},{hearts:-1},{hearts:2.5},{bestCombo:6},{bestCombo:-1},{bestCombo:'3'}]){
  withStorage({[PRODUCT.storageKey]:{completion:{results,date:'2026-11-20',hearts:1,bestCombo:3,...extra}}},()=>{
   assert.equal(readSaved(cafe).completion,undefined,JSON.stringify(extra));
   assert.equal(loadSession(true,cafe).progress.complete,false);
  });
 }
 withStorage({[PRODUCT.storageKey]:{completion:{results,date:'2026-11-20',hearts:0,bestCombo:5}}},()=>{
  assert.deepEqual(readSaved(cafe).completion,{results,date:'2026-11-20',hearts:0,bestCombo:5},'edge values are fine');
 });
});
