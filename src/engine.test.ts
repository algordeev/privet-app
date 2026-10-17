import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAnswer, checkAnswer, progressReducer, initialProgress, companionReaction} from './engine.ts';
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
