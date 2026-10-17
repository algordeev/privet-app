import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAnswer, checkAnswer, progressReducer, initialProgress, companionReaction, lessonCompanionEvent} from './engine.ts';
import {lesson} from './lesson.ts';
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
