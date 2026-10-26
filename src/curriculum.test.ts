import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons,nextLesson,lessonById} from './curriculum/catalog.ts';
import {curriculumForMotivation} from './curriculum/motivation.ts';
import {normalizeAnswer,checkAnswer,initialProgress,progressReducer,isPair,matchValue} from './engine.ts';
import {matchOrder} from './matchOrder.ts';
import type {Exercise} from './curriculum/types.ts';
const correctValue=(e:Exercise)=>e.kind==='match'?matchValue(e.pairs!.map(p=>p[0]),e):e.answer;
import {freshSession,restoreSession,sessionKey,savedKey,lessonPassed,readSaved,recordLessonCompletion} from './session.ts';
import {emptyStats,recordFinish,restoreStats} from './nativeStats.ts';
import {createPhysicalLessonEvents} from './physicalLessonEvents.ts';
import {stressPairs,stressText} from './stress.ts';
import {safeBeforeAnswer} from './companionDisplay.ts';

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
   if(e.kind==='listen'){const word=l.words.find(w=>w.id===e.wordId)!;assert.ok(word.pronunciation);assert.equal(normalizeAnswer(word.text),normalizeAnswer(e.answer));assert.ok(e.choices?.includes(e.answer)&&e.choices.every(c=>/[а-яё]/iu.test(c)));}
   if(e.kind==='match'){const pairs=e.pairs!;assert.ok(pairs.length>=3&&pairs.length<=5);for(const side of [0,1])assert.equal(new Set(pairs.map(p=>p[side])).size,pairs.length);
    assert.notDeepEqual(matchOrder(pairs).map(p=>p[1]),pairs.map(p=>p[1]),`${l.id}/${e.id}: English column must be scrambled`);
    assert.ok(isPair(e,pairs[0][0],pairs[0][1])&&!isPair(e,pairs[0][0],pairs[1][1]));
    assert.ok(checkAnswer(i,matchValue(pairs.map(p=>p[0]),e),l.exercises));assert.ok(!checkAnswer(i,matchValue(pairs.slice(1).map(p=>p[0]),e),l.exercises));}
   else assert.ok(checkAnswer(i,`  ${e.answer.toUpperCase()}?!  `,l.exercises));
   assert.ok(!checkAnswer(i,'wrong answer',l.exercises));
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
   const right={type:'check' as const,value:correctValue(e)};next=progressReducer(p,right,l.exercises);emit(p,next,right,l.id);p=next;
   next=progressReducer(p,{type:'continue'},l.exercises);emit(p,next,{type:'continue'},l.id);p=next;
   // Avoid spending all hearts across this mapping test: each exercise gets its own attempt budget.
   if(!p.complete)p={...p,hearts:3};
  }
  assert.deepEqual(sent,Array.from({length:l.exercises.length},(_,i)=>[2,6,1,i===l.exercises.length-1?3:6]).flat());
  emit(p,p,{type:'continue'},l.id);assert.equal(sent.filter(c=>c===3).length,1);
 }
});

test('passed status survives unfinished and failed replays in every lesson, until local reset',()=>{
 for(const definition of nativeLessons){
  const saved={preferences:{stress:false,pronunciation:true},completion:{results:Array(definition.exercises.length).fill(true),date:'2026-10-23'}};
  const completed={...initialProgress(),index:definition.exercises.length,results:saved.completion.results,complete:true};
  assert.equal(lessonPassed(completed,saved),true);
  const restarted=progressReducer(completed,{type:'reset'},definition.exercises);
  assert.equal(restarted.complete,false);assert.equal(lessonPassed(restarted,saved),true);
  const restored=restoreSession(JSON.stringify({...freshSession(),progress:restarted}),definition);
  assert.deepEqual(restored.progress,restarted);assert.equal(lessonPassed(restored.progress,saved),true);
  assert.equal(lessonPassed({...restarted,failed:true,hearts:0},saved),true);
  assert.equal(lessonPassed(restarted,{preferences:saved.preferences}),false,'Explicit local reset clears completion');
 }
});

test('best and latest scores stay separate across better/worse replays and old-save migration',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const storage=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null}});
 try{for(const definition of nativeLessons){
  const completion=(score:number)=>({results:Array.from({length:definition.exercises.length},(_,i)=>i<score),date:'2026-10-23'});
  storage.set(savedKey(definition),JSON.stringify({preferences:{stress:false,pronunciation:true},completion:completion(3)}));
  let saved=readSaved(definition);assert.equal(saved.bestFirstTry,3,'Old latest score initializes best');
  saved=recordLessonCompletion(saved,completion(5));assert.equal(saved.bestFirstTry,5);
  saved=recordLessonCompletion(saved,completion(2));assert.equal(saved.bestFirstTry,5);assert.equal(saved.completion!.results.filter(Boolean).length,2);
  storage.set(savedKey(definition),JSON.stringify(saved));assert.deepEqual(readSaved(definition),saved);
  for(const invalid of [-1,99,'5',null]){storage.set(savedKey(definition),JSON.stringify({...saved,bestFirstTry:invalid}));const restored=readSaved(definition);assert.equal(restored.bestFirstTry,2);assert.deepEqual(restored.completion,saved.completion);}
 }}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('stress marks cover any display string via other lessons and every bare word has exactly one stressed form',()=>{
 const forms=new Map<string,string>();
 for(const l of nativeLessons)for(const w of l.words){
  assert.equal(w.text.split(' ').length,w.stressed.split(' ').length,w.text);
  for(const [token,stressed] of stressPairs([w])){const key=token.toLowerCase(),form=stressed.toLowerCase();
   assert.equal(forms.get(key)??form,form,`${token} has two stressed forms`);forms.set(key,form);}
 }
 const culture=lessonById('culture');
 assert.ok(!stressPairs(culture.words).some(([token])=>token==='завтра'));
 assert.equal(stressText('завтра',culture.words),'за́втра');
 // Mixed English/Russian strings: punctuation, capitals and existing marks are preserved.
 assert.equal(stressText('Привет! Давай в музей! Потом чай?',culture.words),'Приве́т! Дава́й в музе́й! Пото́м чай?');
 assert.equal(stressText('That works: Давай в музей завтра.',culture.words),'That works: Дава́й в музе́й за́втра.');
 assert.equal(stressText('ПОКА дава́й нечто'),'ПОКА́ дава́й нечто');
});
test('alternative word orders reuse the same tiles, grade correct and stay hidden from the companion',()=>{
 for(const l of nativeLessons)for(const [i,e] of l.exercises.entries())for(const alternative of e.alsoAccepted??[]){
  assert.equal(e.kind,'sentence');assert.notEqual(normalizeAnswer(alternative),normalizeAnswer(e.answer));
  assert.deepEqual([...e.tokens!].sort(),alternative.split(' ').sort());
  assert.ok(checkAnswer(i,alternative,l.exercises));assert.ok(!safeBeforeAnswer(e,alternative));
 }
 const culture=lessonById('culture'),index=culture.exercises.findIndex(e=>e.kind==='sentence');
 for(const value of ['Давай в музей завтра','Давай завтра в музей'])assert.ok(checkAnswer(index,value,culture.exercises));
 assert.ok(!checkAnswer(index,'в Давай музей завтра',culture.exercises));
 const plans=lessonById('making-plans');
 assert.ok(checkAnswer(plans.exercises.findIndex(e=>e.kind==='sentence'),'Давай завтра гулять',plans.exercises));
});
