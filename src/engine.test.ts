import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAnswer, checkAnswer, progressReducer, initialProgress, companionReaction, lessonCompanionEvent,lessonXp,MAX_HEARTS,isPair,matchValue} from './engine.ts';
import {lesson} from './lesson.ts';
import {lessonById} from './curriculum/catalog.ts';
test('normalizes case, stress, surrounding spaces and terminal punctuation',()=>{
 for(const input of [' Спасибо! ','СПАСИБО','спаси́бо…','спасибо?!']) assert.equal(normalizeAnswer(input),'спасибо');
 assert.equal(checkAnswer(4,'Спаси́бо!'),true);
 assert.equal(normalizeAnswer('чай'), 'чай');
 assert.equal(checkAnswer(2,'Я хочу чаи.'),false);
 assert.equal(checkAnswer(2,'  Я   хочу́ чай! '),true);
 for(const input of ['спасиба','спасибо вам','спа сибо','thank you','']) assert.equal(checkAnswer(4,input),false);
});
test('wrong answers require retry and preserve first-attempt result',()=>{
 let s={...initialProgress(),index:1};
 s=progressReducer(s,{type:'check',value:'tea'}); assert.equal(s.feedback,'incorrect');
 assert.deepEqual(progressReducer(s,{type:'continue'}),s);
 assert.deepEqual(progressReducer(s,{type:'check',value:'coffee'}),s);
 s=progressReducer(s,{type:'retry'}); s=progressReducer(s,{type:'check',value:'coffee'});
 s=progressReducer(s,{type:'continue'}); assert.equal(s.index,2); assert.deepEqual(s.results,[false]);
});
test('complete lesson, explicit continue, and reset',()=>{
 let s=initialProgress();
 assert.deepEqual(progressReducer(s,{type:'continue'}),s);
 for(const exercise of lesson) { s=progressReducer(s,{type:'check',value:exercise.answer}); assert.equal(s.complete,false); s=progressReducer(s,{type:'continue'}); }
 assert.equal(s.complete,true); assert.deepEqual(s.results,[true,true,true,true,true]);
 assert.deepEqual(progressReducer(s,{type:'check',value:'x'}),s);
 assert.deepEqual(progressReducer(s,{type:'reset'}),initialProgress());
});
test('hearts decrement, failure is terminal until reset, and first try combos persist',()=>{
 let s=initialProgress();
 s=progressReducer(s,{type:'check',value:'ready'});assert.equal(s.combo,1);s=progressReducer(s,{type:'continue'});
 s=progressReducer(s,{type:'check',value:'wrong'});assert.equal(s.hearts,2);assert.equal(s.combo,0);assert.equal(s.failed,false);s=progressReducer(s,{type:'retry'});s=progressReducer(s,{type:'check',value:'tea'});assert.equal(s.combo,0);s=progressReducer(s,{type:'continue'});
 s=progressReducer(s,{type:'check',value:'wrong'});assert.equal(s.hearts,1);s=progressReducer(s,{type:'retry'});s=progressReducer(s,{type:'check',value:'wrong'});assert.equal(s.hearts,0);assert.equal(s.failed,true);assert.deepEqual(lessonCompanionEvent(s),{type:'incorrect'});
 for(const action of [{type:'retry'},{type:'continue'},{type:'check',value:'coffee'}] as const)assert.deepEqual(progressReducer(s,action),s);
 assert.equal(progressReducer(s,{type:'reset'}).hearts,MAX_HEARTS);
 let combo=initialProgress();for(let i=0;i<3;i++){combo=progressReducer(combo,{type:'check',value:lesson[combo.index].answer});combo=progressReducer(combo,{type:'continue'});}
 assert.equal(combo.combo,3);assert.equal(combo.bestCombo,3);
});
test('lesson XP follows lesson, remaining hearts and best combo formula',()=>{
 assert.equal(lessonXp({...initialProgress(),bestCombo:5},5),18);
 assert.equal(lessonXp({...initialProgress(),hearts:2,bestCombo:4},5),16);
 assert.equal(lessonXp({...initialProgress(),hearts:1,bestCombo:1},5),12);
 assert.equal(lessonXp({...initialProgress(),failed:true},5),0);
});
test('unlimited hearts keep hearts full after mistakes and never fail',()=>{
 let s=initialProgress();
 for(let i=0;i<8;i++){s=progressReducer(s,{type:'check',value:'wrong'},lesson,{unlimitedHearts:true});assert.equal(s.hearts,MAX_HEARTS);assert.equal(s.failed,false);assert.equal(s.feedback,'incorrect');assert.equal(s.combo,0);s=progressReducer(s,{type:'retry'},lesson,{unlimitedHearts:true});}
});
test('revive only restores a failed state when unlimited hearts are enabled',()=>{
 const failed={...initialProgress(),index:1,hearts:1};const ended=progressReducer(failed,{type:'check',value:'wrong'});assert.equal(ended.failed,true);
 assert.deepEqual(progressReducer(ended,{type:'revive'}),ended);
 const revived=progressReducer(ended,{type:'revive'},lesson,{unlimitedHearts:true});assert.equal(revived.failed,false);assert.equal(revived.hearts,MAX_HEARTS);assert.equal(revived.feedback,'incorrect');assert.equal(revived.index,1);assert.equal(revived.attempts,1);
 assert.deepEqual(progressReducer(initialProgress(),{type:'revive'},lesson,{unlimitedHearts:true}),initialProgress());
});
test('Plus mistakes preserve the full-hearts XP bonus and first-try combo',()=>{
 let s=initialProgress();
 for(let i=0;i<2;i++){s=progressReducer(s,{type:'check',value:lesson[i].answer},lesson,{unlimitedHearts:true});s=progressReducer(s,{type:'continue'},lesson,{unlimitedHearts:true});}
 s=progressReducer(s,{type:'check',value:'wrong'},lesson,{unlimitedHearts:true});s=progressReducer(s,{type:'retry'},lesson,{unlimitedHearts:true});s=progressReducer(s,{type:'check',value:lesson[2].answer},lesson,{unlimitedHearts:true});s=progressReducer(s,{type:'continue'},lesson,{unlimitedHearts:true});
 for(let i=3;i<lesson.length;i++){s=progressReducer(s,{type:'check',value:lesson[i].answer},lesson,{unlimitedHearts:true});s=progressReducer(s,{type:'continue'},lesson,{unlimitedHearts:true});}
 assert.equal(s.hearts,MAX_HEARTS);assert.equal(s.bestCombo,2);assert.equal(lessonXp(s,lesson.length),15);
});
test('companion events map to all six reusable states',()=>{
 assert.equal(companionReaction({type:'reset'}).state,'idle');
 assert.equal(companionReaction({type:'prompt',text:'чай'}).text,'чай');
 assert.equal(companionReaction({type:'thinking'}).state,'thinking');
 assert.equal(companionReaction({type:'correct'}).state,'correct');
 assert.equal(companionReaction({type:'incorrect'}).state,'try-again');
 assert.equal(companionReaction({type:'complete'}).state,'celebrating');
});

test('every assessed exercise hides answers while prompting, thinking, wrong, and retrying',()=>{
 for(let index=1;index<lesson.length;index++) {
  let state={...initialProgress(),index};
  assert.deepEqual(lessonCompanionEvent(state),{type:'prompt',text:'?'},lesson[index].id);
  assert.deepEqual(lessonCompanionEvent(state,{thinking:true}),{type:'thinking'});
  // A vocabulary preview must not be able to override the assessed prompt.
  assert.deepEqual(lessonCompanionEvent(state,{vocabularyWord:lesson[index].answer}),{type:'prompt',text:'?'});
  state=progressReducer(state,{type:'check',value:'wrong'});
  assert.deepEqual(lessonCompanionEvent(state),{type:'incorrect'});
  assert.equal(companionReaction(lessonCompanionEvent(state)).state,'try-again');
  assert.notEqual(normalizeAnswer(companionReaction(lessonCompanionEvent(state)).text),normalizeAnswer(lesson[index].answer));
  state=progressReducer(state,{type:'retry'});
  assert.deepEqual(lessonCompanionEvent(state),{type:'prompt',text:'?'});
  const exercise=lesson[index];
  if('retryFeedback' in exercise) assert.ok(!normalizeAnswer(exercise.retryFeedback).includes(normalizeAnswer(exercise.answer)));
 }
});
test('only an explicit hint or correct submission reveals each assessed answer',()=>{
 for(let index=1;index<lesson.length;index++) {
  let state={...initialProgress(),index};
  assert.deepEqual(lessonCompanionEvent(state,{hintRequested:true}),{type:'prompt',text:lesson[index].answer});
  state=progressReducer(state,{type:'check',value:lesson[index].answer});
  assert.deepEqual(lessonCompanionEvent(state),{type:'correct',text:lesson[index].answer});
  state=progressReducer(state,{type:'continue'});
  assert.deepEqual(lessonCompanionEvent(state),state.complete?{type:'complete'}:{type:'prompt',text:'?'});
 }
});
test('incorrect submissions react gently even after a hint, and reset returns to vocabulary',()=>{
 let state={...initialProgress(),index:4};
 state=progressReducer(state,{type:'check',value:'спасиба'});
 assert.deepEqual(lessonCompanionEvent(state,{hintRequested:true}),{type:'incorrect'});
 state=progressReducer(state,{type:'reset'});
 assert.deepEqual(lessonCompanionEvent(state),{type:'prompt',text:'Привет!'});
});
test('vocabulary introduction still displays its prompts and clicked words',()=>{
 const state=initialProgress();
 assert.deepEqual(lessonCompanionEvent(state),{type:'prompt',text:lesson[0].prompt});
 for(const text of ['чай','кофе','Спасибо!']) assert.deepEqual(lessonCompanionEvent(state,{vocabularyWord:text}),{type:'prompt',text});
 const correct=progressReducer(state,{type:'check',value:'ready'});
 assert.deepEqual(lessonCompanionEvent(correct),{type:'correct'});
});
test('gem refill restores hearts from failure and leaves incorrect feedback for Try again',()=>{
 const failed={...initialProgress(),index:2,attempts:1,hearts:0,failed:true,feedback:'incorrect' as const};
 const refilled=progressReducer(failed,{type:'refill'});assert.equal(refilled.failed,false);assert.equal(refilled.hearts,MAX_HEARTS);assert.equal(refilled.feedback,'incorrect');
 assert.deepEqual(progressReducer(initialProgress(),{type:'refill'}),initialProgress());
});
test('listen grades like a choice; match grades pairs at once and a slipped final check is not a first try',()=>{
 const town=lessonById('around-town'),li=town.exercises.findIndex(e=>e.kind==='listen');
 assert.ok(checkAnswer(li,'налево',town.exercises));assert.ok(!checkAnswer(li,'Направо.',town.exercises));
 const plans=lessonById('making-plans'),mi=plans.exercises.findIndex(e=>e.kind==='match'),match=plans.exercises[mi];
 assert.ok(isPair(match,'завтра','tomorrow'));assert.ok(!isPair(match,'завтра','See you tomorrow!'));assert.ok(!isPair(match,'tomorrow','завтра'));
 const all=matchValue(['До завтра!','сегодня','завтра','Давай гулять!'],match);assert.ok(checkAnswer(mi,all,plans.exercises));assert.ok(!checkAnswer(mi,'matched',plans.exercises));
 const start={...initialProgress(),index:mi,combo:1,bestCombo:1};
 const clean=progressReducer(start,{type:'check',value:all},plans.exercises);
 assert.deepEqual([clean.attempts,clean.combo,clean.hearts],[1,2,MAX_HEARTS]);assert.equal(progressReducer(clean,{type:'continue'},plans.exercises).results.at(-1),true);
 const slipped=progressReducer(start,{type:'check',value:all,slipped:true},plans.exercises);
 assert.deepEqual([slipped.feedback,slipped.attempts,slipped.combo,slipped.hearts],['correct',2,1,MAX_HEARTS]);assert.equal(progressReducer(slipped,{type:'continue'},plans.exercises).results.at(-1),false);
 // The companion never receives a whole matching solution, even after a hint.
 assert.deepEqual(lessonCompanionEvent({...start,feedback:'correct',attempts:1},{},plans.exercises),{type:'correct'});
 assert.deepEqual(lessonCompanionEvent(start,{hintRequested:true},plans.exercises),{type:'prompt',text:'?'});
});
