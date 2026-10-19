import test from 'node:test';
import assert from 'node:assert/strict';
import {moveSentenceWord} from './sentenceOrder.ts';
import {checkAnswer} from './engine.ts';
import {restoreSession,freshSession} from './session.ts';
import {cafeLesson,introductionsLesson} from './lessons.ts';

test('moving words in both directions preserves canonical text and leaves the original untouched',()=>{
 const words=['чай','Я','хочу'];const moved=moveSentenceWord(words,0,2);
 assert.deepEqual(moved,['Я','хочу','чай']);assert.deepEqual(words,['чай','Я','хочу']);
 assert.deepEqual(moveSentenceWord(moved,2,0),words);
 for(const [from,to] of [[-1,1],[0,3],[NaN,1],[1,.5],[1,1]])assert.equal(moveSentenceWord(words,from,to),words);
 assert.deepEqual(moveSentenceWord([],0,1),[]);
});
test('reordered answers still check and persist through existing lesson sessions',()=>{
 for(const [definition,words,from,to] of [[cafeLesson,['чай','Я','хочу'],0,2],[introductionsLesson,['Анна','Меня','зовут'],0,2]] as const){
  const tokens=moveSentenceWord([...words],from,to);assert.equal(checkAnswer(2,tokens.join(' '),definition.exercises),true);
  const session=freshSession();session.progress.index=2;session.progress.results=[true,true];session.tokens=tokens;
  assert.deepEqual(restoreSession(JSON.stringify(session),definition).tokens,tokens);
 }
});
