import test from 'node:test';
import assert from 'node:assert/strict';
import {FIRST_RUN_KEY,initialFirstRun,restoreFirstRun,updateFirstRun,REASONS,LEVELS,validFirstLessonResult} from './firstRun.ts';
import {firstRunLesson} from './firstRunLesson.ts';
import {initialProgress,progressReducer,lessonXp} from './engine.ts';
import {emptyStats,recordOnboardingFinish,restoreStats,statsSummary} from './nativeStats.ts';
import {freshSession,restoreSession,sessionKey} from './session.ts';
import {cafeLesson} from './lessons.ts';
import {CYRILLIC,referenceExample} from './cyrillic.ts';
const date=new Date(2026,9,22,12);
function completed(){let p=initialProgress();for(const exercise of firstRunLesson.exercises){p=progressReducer(p,{type:'check',value:exercise.answer},firstRunLesson.exercises);p=progressReducer(p,{type:'continue'},firstRunLesson.exercises);}return p;}
function offer(){let s=updateFirstRun(initialFirstRun(),{type:'start'});s=updateFirstRun(s,{type:'reason',value:'Travel'});s=updateFirstRun(s,{type:'level',value:'New to Russian'});s=updateFirstRun(s,{type:'personalized'});s=updateFirstRun(s,{type:'alphabetDone'});s=updateFirstRun(s,{type:'lesson'});return updateFirstRun(s,{type:'offer'});}
test('first-run defaults, legacy learner migration and malformed data are safe',()=>{
 assert.ok(FIRST_RUN_KEY.startsWith('privet-demo-v1'));assert.deepEqual(restoreFirstRun(null),initialFirstRun());
 assert.equal(restoreFirstRun(null,true).stage,'done');
 for(const raw of ['{}','null','bad',JSON.stringify({...initialFirstRun(),stage:'offer'}),JSON.stringify({...initialFirstRun(),reason:'secret'}),JSON.stringify({...initialFirstRun(),completed:1})])assert.deepEqual(restoreFirstRun(raw),initialFirstRun());
});
test('every motivation and level persists, with progression gated on both selections',()=>{
 for(const reason of REASONS)for(const level of LEVELS){
  let s=updateFirstRun(initialFirstRun(),{type:'start'});assert.equal(updateFirstRun(s,{type:'personalized'}),s);
  s=updateFirstRun(s,{type:'reason',value:reason});s=updateFirstRun(s,{type:'level',value:level});s=restoreFirstRun(JSON.stringify(s));
  assert.equal(s.reason,reason);assert.equal(s.level,level);assert.equal(updateFirstRun(s,{type:'personalized'}).stage,level===LEVELS[0]?'alphabet':'companion');
 }
});
test('free finishes and paid choices require local confirmation, with valid completion persistence',()=>{
 const s=offer();assert.equal(s.stage,'offer');
 const free=updateFirstRun(s,{type:'choose',choice:'free'});assert.equal(free.stage,'done');assert.equal(free.completed,true);
 for(const choice of ['plus-monthly','plus-yearly','companion'] as const){const confirmation=updateFirstRun(s,{type:'choose',choice});assert.equal(confirmation.stage,'confirmation');assert.equal(confirmation.completed,false);const done=updateFirstRun(confirmation,{type:'finish'});assert.equal(done.completed,true);assert.deepEqual(restoreFirstRun(JSON.stringify(done)),done);}
 assert.equal(updateFirstRun(initialFirstRun(),{type:'choose',choice:'free'}).stage,'welcome');
});
test('replay and developer reset touch only onboarding state, retaining personalization',()=>{
 const done=updateFirstRun(offer(),{type:'choose',choice:'free'}),before=JSON.stringify(done);
 const replay=updateFirstRun(done,{type:'replay'});assert.equal(replay.stage,'welcome');assert.equal(replay.replay,true);assert.equal(replay.completed,true);assert.equal(replay.reason,'Travel');assert.equal(replay.level,'New to Russian');assert.equal(JSON.stringify(done),before);
 const reset=updateFirstRun(done,{type:'resetFlag'});assert.equal(reset.completed,false);assert.equal(reset.replay,true);assert.equal(reset.reason,done.reason);
});
test('guided café reuses answer checking/hearts/retry and has its own restorable session',()=>{
 assert.notEqual(sessionKey(firstRunLesson),sessionKey(cafeLesson));
 let p=progressReducer(initialProgress(),{type:'check',value:'wrong'},firstRunLesson.exercises);assert.equal(p.hearts,2);p=progressReducer(p,{type:'retry'},firstRunLesson.exercises);assert.equal(p.feedback,null);
 assert.equal(validFirstLessonResult(p),false);const result=completed();assert.equal(result.complete,true);assert.equal(lessonXp(result,5),18);
 assert.deepEqual(restoreSession(JSON.stringify({...freshSession(),progress:result}),firstRunLesson).progress,result);
});
test('onboarding rewards have one durable receipt across rerenders, reopening, replay and storage restoration',()=>{
 const result=completed(),first=recordOnboardingFinish(emptyStats(),result,date),again=recordOnboardingFinish(first,result,date);
 assert.equal(again,first);assert.equal(statsSummary(first,date).totalXp,18);assert.equal(statsSummary(first,date).finishes,1);assert.equal(first.onboardingAwarded,true);
 const restored=restoreStats(JSON.stringify(first));assert.equal(recordOnboardingFinish(restored,result,date),restored);
 assert.equal(recordOnboardingFinish(emptyStats(),initialProgress(),date).onboardingAwarded,undefined);
 const legacy=restoreStats(JSON.stringify(emptyStats()));assert.equal(legacy.onboardingAwarded,undefined);assert.equal(recordOnboardingFinish(legacy,result,date).onboardingAwarded,true);
});
test('new café references retain every letter and never reveal assessed Russian answers',()=>{
 const normalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/\u0301/g,'').normalize('NFC').replace(/[^а-яё]/g,'');
 for(const exercise of firstRunLesson.exercises)for(const letter of CYRILLIC){const resolved=referenceExample(letter,firstRunLesson,exercise);assert.equal(resolved.upper,letter.upper);if(/[а-яё]/iu.test(exercise.answer))assert.ok(!normalize(resolved.example).includes(normalize(exercise.answer)),letter.upper);}
});

test('brief Cyrillic bridge is new-learner only, restorable, skippable and separate from rewards',()=>{
 let s=updateFirstRun(initialFirstRun(),{type:'start'});s=updateFirstRun(s,{type:'reason',value:'Culture'});s=updateFirstRun(s,{type:'level',value:LEVELS[0]});s=updateFirstRun(s,{type:'personalized'});
 assert.equal(s.stage,'alphabet');assert.deepEqual(restoreFirstRun(JSON.stringify(s)),s);assert.equal(s.completed,false);
 assert.equal(updateFirstRun(s,{type:'back'}).stage,'personalize');const next=updateFirstRun(s,{type:'alphabetDone'});assert.equal(next.stage,'companion');assert.equal(next.completed,false);assert.equal(next.choice,null);
 assert.equal(updateFirstRun(next,{type:'back'}).stage,'alphabet');assert.equal(updateFirstRun(initialFirstRun(),{type:'alphabetDone'}).stage,'welcome');
});
