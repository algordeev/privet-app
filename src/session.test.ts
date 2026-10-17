import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSession,restoreSession,loadSession,NATIVE_SESSION_KEY} from './session.ts';
import {progressReducer} from './engine.ts';
import {lesson} from './lesson.ts';
import {PRODUCT} from './config.ts';

test('restores wrong answers, retries, and first-attempt history across reloads',()=>{
 let s=freshSession();
 s.progress=progressReducer(s.progress,{type:'check',value:'ready'});
 s.progress=progressReducer(s.progress,{type:'continue'});
 s.selected='tea';
 s.progress=progressReducer(s.progress,{type:'check',value:s.selected});
 s=restoreSession(JSON.stringify(s));
 assert.equal(s.progress.feedback,'incorrect');
 assert.equal(s.selected,'tea');
 assert.deepEqual(s.progress.results,[true]);
 s.progress=progressReducer(s.progress,{type:'retry'});
 s=restoreSession(JSON.stringify(s));
 assert.equal(s.progress.attempts,1);
 assert.equal(s.progress.feedback,null);
 s.selected='coffee';
 s.progress=progressReducer(s.progress,{type:'check',value:s.selected});
 s.progress=progressReducer(s.progress,{type:'continue'});
 s=restoreSession(JSON.stringify(s));
 assert.deepEqual(s.progress.results,[true,false]);
});
test('preserves partial vocabulary, sentence, typed input, and explicit hints',()=>{
 const vocabulary={...freshSession(),revealed:['hi','tea'],vocabularyWord:'чай'};
 assert.deepEqual(restoreSession(JSON.stringify(vocabulary)),vocabulary);
 const sentence={...freshSession(),progress:{...freshSession().progress,index:2,results:[true,true]},tokens:['Я','хочу'],hintAt:2};
 assert.deepEqual(restoreSession(JSON.stringify(sentence)),sentence);
 const typed={...freshSession(),progress:{...freshSession().progress,index:4,results:[true,true,true,true]},selected:'спа'};
 assert.deepEqual(restoreSession(JSON.stringify(typed)),typed);
});
test('completed sessions and reset snapshots round-trip',()=>{
 let s=freshSession();
 for(const exercise of lesson){s.progress=progressReducer(s.progress,{type:'check',value:exercise.answer});s.progress=progressReducer(s.progress,{type:'continue'});}
 s=restoreSession(JSON.stringify(s));
 assert.equal(s.progress.complete,true);
 s.progress=progressReducer(s.progress,{type:'reset'});
 assert.deepEqual(restoreSession(JSON.stringify(s)),freshSession());
});
test('invalid or incompatible storage falls back safely',()=>{
 for(const raw of [null,'not json','null','{}',JSON.stringify({...freshSession(),progress:{index:99}}),JSON.stringify({...freshSession(),hintAt:4}),JSON.stringify({...freshSession(),tokens:['answer']}),JSON.stringify({...freshSession(),revealed:['unknown']}),JSON.stringify({...freshSession(),progress:{...freshSession().progress,feedback:'correct'}})])assert.deepEqual(restoreSession(raw),freshSession());
});
test('only native mode loads resumable sessions and migrates existing completion',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const data=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null}});
 try{
  const s={...freshSession(),revealed:['hi']};data.set(NATIVE_SESSION_KEY,JSON.stringify(s));
  assert.deepEqual(loadSession(true),s);
  assert.deepEqual(loadSession(false),freshSession());
  data.delete(NATIVE_SESSION_KEY);
  data.set(PRODUCT.storageKey,JSON.stringify({completion:{results:[true,false,true,true,true],date:'2026-10-17'}}));
  assert.equal(loadSession(true).progress.complete,true);
  assert.deepEqual(loadSession(true).progress.results,[true,false,true,true,true]);
  assert.deepEqual(loadSession(false),freshSession());
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});
