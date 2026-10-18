import test from 'node:test';
import assert from 'node:assert/strict';
import {cafeLesson,introductionsLesson,nativeLessons} from './lessons.ts';
import {checkAnswer,initialProgress,progressReducer,lessonCompanionEvent,normalizeAnswer} from './engine.ts';
import {freshSession,loadSession,restoreSession,sessionKey,savedKey,NATIVE_SESSION_KEY} from './session.ts';
import {PRODUCT} from './config.ts';
import {createStatsTracker,emptyStats,restoreStats,type NativeStats} from './nativeStats.ts';
import {createPhysicalLessonEvents} from './physicalLessonEvents.ts';
import {homeGreeting} from './nativeCompanion.ts';

test('both lessons have complete, consistent content and separate canonical display aids',()=>{
 for(const definition of nativeLessons){
  assert.equal(definition.exercises.length,5);assert.equal(definition.words.length,5);
  for(const w of definition.words)assert.equal(normalizeAnswer(w.text),normalizeAnswer(w.stressed));
  for(const exercise of definition.exercises){
   assert.ok(exercise.instruction&&exercise.success&&exercise.review);
   if(exercise.kind!=='vocabulary')assert.ok(exercise.hint&&exercise.retryFeedback);
   if(exercise.kind==='choice')assert.ok(exercise.choices?.includes(exercise.answer));
   if(exercise.kind==='sentence')assert.deepEqual([...exercise.tokens!].sort(),exercise.answer.split(' ').sort());
   if(exercise.kind==='typed')for(const letter of exercise.answer)assert.ok(exercise.letters?.includes(letter));
  }
 }
 assert.deepEqual(introductionsLesson.exercises.map(e=>e.kind),['vocabulary','choice','sentence','choice','typed']);
 assert.equal(checkAnswer(4,' ПОКА́?! ',introductionsLesson.exercises),true);
 for(const value of ['покаа','пака','bye','спасибо',''])assert.equal(checkAnswer(4,value,introductionsLesson.exercises),false);
 assert.equal(checkAnswer(4,'пока'),false);
});

test('second lesson supports wrong answers, retry, explicit continue, results, replay and no companion leakage',()=>{
 let p=initialProgress();const exercises=introductionsLesson.exercises;
 for(const [index,exercise] of exercises.entries()){
  assert.equal(p.index,index);
  if(index>0){
   assert.deepEqual(lessonCompanionEvent(p,{},exercises),{type:'prompt',text:'?'});
   p=progressReducer(p,{type:'check',value:'incorrect'},exercises);
   assert.equal(p.feedback,'incorrect');assert.deepEqual(lessonCompanionEvent(p,{},exercises),{type:'incorrect'});
   assert.equal(progressReducer(p,{type:'continue'},exercises),p);
   p=progressReducer(p,{type:'retry'},exercises);
   assert.deepEqual(lessonCompanionEvent(p,{},exercises),{type:'prompt',text:'?'});
  }
  p=progressReducer(p,{type:'check',value:exercise.answer},exercises);
  assert.equal(p.feedback,'correct');assert.equal(p.complete,false);
  p=progressReducer(p,{type:'continue'},exercises);
 }
 assert.equal(p.complete,true);assert.deepEqual(p.results,[true,false,false,false,false]);
 assert.deepEqual(progressReducer(p,{type:'reset'},exercises),initialProgress());
 assert.equal(homeGreeting({...freshSession(),progress:p},introductionsLesson.title),'Молодец! You finished Nice to meet you.');
});

test('second lesson snapshots restore its vocabulary, hints and partial sentence without accepting café tokens',()=>{
 const s={...freshSession(),progress:{...initialProgress(),index:2,results:[true,false]},tokens:['Меня','зовут'],revealed:['name','ask-name'],vocabularyWord:'Как тебя зовут?',hintAt:2};
 assert.deepEqual(restoreSession(JSON.stringify(s),introductionsLesson),s);
 assert.deepEqual(restoreSession(JSON.stringify({...s,tokens:['Я','хочу']}),introductionsLesson),freshSession());
 assert.deepEqual(restoreSession(JSON.stringify(s)),freshSession());
});

test('independent native storage preserves the existing café session and completion keys',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const data=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null}});
 try{
  assert.equal(sessionKey(cafeLesson),NATIVE_SESSION_KEY);assert.equal(savedKey(cafeLesson),PRODUCT.storageKey);
  const cafe={...freshSession(),revealed:['hi']};const next={...freshSession(),revealed:['name']};
  data.set(sessionKey(cafeLesson),JSON.stringify(cafe));data.set(sessionKey(introductionsLesson),JSON.stringify(next));
  assert.deepEqual(loadSession(true),cafe);assert.deepEqual(loadSession(true,introductionsLesson),next);
  assert.deepEqual(loadSession(false,introductionsLesson),freshSession());
  data.delete(sessionKey(introductionsLesson));assert.deepEqual(loadSession(true,introductionsLesson),freshSession());
  data.set(savedKey(introductionsLesson),JSON.stringify({completion:{results:[true,true,false,true,true],date:'2026-10-18'}}));
  assert.equal(loadSession(true,introductionsLesson).progress.complete,true);assert.deepEqual(loadSession(true),cafe);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});

test('finishing both lessons counts each once; results identify the lesson and old statistics still restore',()=>{
 const saved:NativeStats[]=[];const tracker=createStatsTracker(emptyStats(),s=>saved.push(s),()=>new Date(2026,9,18,12));
 const before={...initialProgress(),index:4,attempts:1,results:[true,true,true,true],feedback:'correct' as const};
 const after=progressReducer(before,{type:'continue'});
 for(const definition of nativeLessons){
  tracker.transition(before,after,{type:'continue'},definition.id);
  tracker.transition(before,after,{type:'continue'},definition.id);
 }
 assert.equal(saved.length,2);assert.equal(saved[1].days['2026-10-18'],2);assert.equal(saved[1].latest?.lessonId,'introductions');
 assert.deepEqual(restoreStats(JSON.stringify(saved[1])),saved[1]);
 const legacy={...saved[0],latest:{day:'2026-10-18',firstTry:5}};assert.deepEqual(restoreStats(JSON.stringify(legacy)),legacy);
 tracker.transition(after,initialProgress(),{type:'reset'},'introductions');tracker.transition(before,after,{type:'continue'},'introductions');
 assert.equal(saved[2].days['2026-10-18'],3);
});

test('physical companion deduplication does not suppress an identical accepted event in a different lesson',()=>{
 const sent:number[]=[];const emit=createPhysicalLessonEvents(code=>sent.push(code));
 const p=initialProgress(),action={type:'check' as const,value:'ready'},next=progressReducer(p,action);
 emit(p,next,action,'cafe');emit(p,next,action,'cafe');emit(p,next,action,'introductions');
 assert.deepEqual(sent,[1,1]);
});
