import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSession,restoreSession,loadSession,NATIVE_SESSION_KEY} from './session.ts';
import {progressReducer} from './engine.ts';
import {lesson} from './lesson.ts';
import {PRODUCT} from './config.ts';
import {lessonById} from './curriculum/catalog.ts';

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
 for(const raw of [null,'not json','null','{}',JSON.stringify({...freshSession(),progress:{index:99}}),JSON.stringify({...freshSession(),hintAt:4}),JSON.stringify({...freshSession(),tokens:['answer']}),JSON.stringify({...freshSession(),revealed:['unknown']}),JSON.stringify({...freshSession(),progress:{...freshSession().progress,feedback:'correct'}}),JSON.stringify({...freshSession(),progress:{...freshSession().progress,hearts:null}})])assert.deepEqual(restoreSession(raw),freshSession());
});
test('upgrades old progress snapshots with default hearts, combo and failure fields',()=>{
 const old={...freshSession(),progress:{index:1,attempts:0,results:[true],feedback:null,complete:false}};
 const restored=restoreSession(JSON.stringify(old));assert.deepEqual(restored.progress,{...old.progress,hearts:3,combo:0,bestCombo:0,failed:false});
 assert.deepEqual(restoreSession(JSON.stringify({...old,progress:{...old.progress,hearts:4}})),freshSession());
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
  data.set(PRODUCT.storageKey,JSON.stringify({completion:{results:[true,false,true,true,true],date:'2026-10-17',hearts:null}}));
  assert.equal(loadSession(true).progress.complete,false);
  assert.deepEqual(loadSession(false),freshSession());
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('matched pairs persist only for the current match exercise; older snapshots restore with none',()=>{
 const plans=lessonById('making-plans'),index=plans.exercises.findIndex(e=>e.kind==='match');
 const partial={...freshSession(),progress:{...freshSession().progress,index,results:Array(index).fill(true)},matches:['завтра','До завтра!']};
 assert.deepEqual(restoreSession(JSON.stringify(partial),plans),partial);
 const {matches:_,...older}=partial;assert.deepEqual(restoreSession(JSON.stringify(older),plans),{...partial,matches:[]});
 for(const matches of [['завтра','завтра'],['tomorrow'],['Пока!'],'завтра',[1]])assert.deepEqual(restoreSession(JSON.stringify({...partial,matches}),plans),freshSession());
 assert.deepEqual(restoreSession(JSON.stringify({...partial,progress:{...partial.progress,index:index+1,results:Array(index+1).fill(true)}}),plans),freshSession());
});
