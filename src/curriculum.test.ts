import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons,nextLesson,lessonById} from './curriculum/catalog.ts';
import {curriculumForMotivation} from './curriculum/motivation.ts';
import {normalizeAnswer,checkAnswer,initialProgress,progressReducer} from './engine.ts';
import {freshSession,restoreSession,sessionKey,savedKey} from './session.ts';
import {emptyStats,recordFinish,restoreStats} from './nativeStats.ts';
import {createPhysicalLessonEvents} from './physicalLessonEvents.ts';

test('eight unique ordered lessons have valid acyclic prerequisites and metadata',()=>{
 assert.equal(nativeLessons.length,8);assert.equal(new Set(nativeLessons.map(l=>l.id)).size,8);
 assert.deepEqual(nativeLessons.map(l=>l.number),['01','02','03','04','05','06','07','08']);
 const seen=new Set<string>();
 for(const l of nativeLessons){assert.ok(l.title&&l.description&&l.summary&&l.completionTip&&l.icon);assert.ok(l.skills.length&&l.motivationTags.length);for(const id of l.prerequisiteIds)assert.ok(seen.has(id));seen.add(l.id);}
});
test('all curriculum exercises validate vocabulary, canonical answers and display aids',()=>{
 for(const l of nativeLessons){
  assert.ok(l.exercises.length>=5&&l.exercises.length<=6);assert.equal(new Set(l.exercises.map(e=>e.id)).size,l.exercises.length);
  assert.equal(new Set(l.words.map(w=>w.id)).size,l.words.length);
  for(const w of l.words){assert.ok(w.meaning&&w.pronunciation);assert.equal(normalizeAnswer(w.text),normalizeAnswer(w.stressed));}
  for(const [i,e] of l.exercises.entries()){
   assert.ok(e.answer&&e.review&&e.success&&e.instruction);if(e.kind!=='vocabulary')assert.ok(e.hint&&e.retryFeedback);
   if(e.wordId)assert.ok(l.words.some(w=>w.id===e.wordId));
   if(e.kind==='choice')assert.ok(e.choices?.includes(e.answer));
   if(e.kind==='sentence')assert.deepEqual([...e.tokens!].sort(),e.answer.split(' ').sort());
   if(e.kind==='typed')for(const c of e.answer)assert.ok(e.letters?.includes(c));
   assert.ok(checkAnswer(i,`  ${e.answer.toUpperCase()}?!  `,l.exercises));assert.ok(!checkAnswer(i,'wrong answer',l.exercises));
  }
 }
});
test('every lesson saves/restores independently and catalog supplies completion navigation',()=>{
 const keys=new Set<string>();
 for(const [i,l] of nativeLessons.entries()){
  keys.add(sessionKey(l));keys.add(savedKey(l));
  const sentenceIndex=l.exercises.findIndex(e=>e.kind==='sentence');
  const snapshot={...freshSession(),progress:{...initialProgress(),index:sentenceIndex,results:Array(sentenceIndex).fill(true)},tokens:[l.exercises[sentenceIndex].tokens![0]],revealed:[l.words[0].id]};
  assert.deepEqual(restoreSession(JSON.stringify(snapshot),l),snapshot);
  assert.equal(nextLesson(l.id),nativeLessons[i+1]);assert.equal(lessonById(l.id),l);
 }
 assert.equal(keys.size,16);assert.equal(nextLesson('not-a-lesson'),undefined);
});
test('statistics preserve every curriculum title and award ID through restoration',()=>{
 let stats=emptyStats();
 for(const l of nativeLessons){stats=recordFinish(stats,Array(l.exercises.length).fill(true),new Date(2026,9,23),l.id,18);assert.equal(lessonById(stats.latest?.lessonId).title,l.title);assert.deepEqual(restoreStats(JSON.stringify(stats)),stats);}
 assert.equal(stats.days['2026-10-23'],8);assert.equal(stats.gems.awarded['2026-10-23'].length,8);
});
test('motivation rankings are stable, complete and prerequisite-respecting without altering visible order',()=>{
 const canonical=nativeLessons.map(l=>l.id);
 for(const reason of [null,'Travel','Conversations','Studies','Culture'] as const){
  const ranked=curriculumForMotivation(reason);assert.deepEqual(ranked,curriculumForMotivation(reason));assert.equal(new Set(ranked.map(l=>l.id)).size,8);
  const done=new Set<string>();for(const l of ranked){for(const id of l.prerequisiteIds)assert.ok(done.has(id));done.add(l.id);}
 }
 assert.deepEqual(curriculumForMotivation(null),nativeLessons);assert.deepEqual(nativeLessons.map(l=>l.id),canonical);
});
test('new lessons retain accepted physical events, retry, final celebration and no restored replay',()=>{
 for(const l of nativeLessons.slice(2)){
  const sent:number[]=[];const emit=createPhysicalLessonEvents(code=>sent.push(code));let p=initialProgress();
  for(const e of l.exercises){
   const wrong={type:'check' as const,value:'wrong'};let next=progressReducer(p,wrong,l.exercises);emit(p,next,wrong,l.id);p=next;
   next=progressReducer(p,{type:'retry'},l.exercises);emit(p,next,{type:'retry'},l.id);p=next;
   const right={type:'check' as const,value:e.answer};next=progressReducer(p,right,l.exercises);emit(p,next,right,l.id);p=next;
   next=progressReducer(p,{type:'continue'},l.exercises);emit(p,next,{type:'continue'},l.id);p=next;
   // Avoid spending all hearts across this mapping test: each exercise gets its own attempt budget.
   if(!p.complete)p={...p,hearts:3};
  }
  assert.deepEqual(sent,Array.from({length:5},(_,i)=>[2,6,1,i===4?3:6]).flat());
  emit(p,p,{type:'continue'},l.id);assert.equal(sent.filter(c=>c===3).length,1);
 }
});
