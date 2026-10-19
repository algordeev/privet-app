import test from 'node:test';
import assert from 'node:assert/strict';
import {moveSentenceWord,sentenceOccurrences,sentenceBank,selectSentenceWord,removeSentenceWord,validSentenceTokens} from './sentenceOrder.ts';
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

const repeatedSource=['я','знаю','что','я'];
test('repeated source occurrences have unique keys and are independently selectable within their counts',()=>{
 let selected:string[]=[];
 const identities=sentenceOccurrences(repeatedSource);
 assert.equal(new Set(identities.map(item=>item.key)).size,4);
 assert.deepEqual(identities.filter(item=>item.word==='я').map(item=>item.occurrence),[0,1]);
 assert.deepEqual(sentenceOccurrences(repeatedSource),identities,'Identities are deterministic, not persisted IDs');
 selected=selectSentenceWord(selected,repeatedSource,0);
 assert.deepEqual(sentenceBank(repeatedSource,selected).map(item=>item.selected),[true,false,false,false]);
 assert.equal(selectSentenceWord(selected,repeatedSource,0),selected,'A consumed source occurrence cannot be selected again');
 selected=selectSentenceWord(selected,repeatedSource,3);
 assert.deepEqual(selected,['я','я']);
 assert.equal(selectSentenceWord(selected,repeatedSource,3),selected,'No third copy can be added');
 assert.equal(selectSentenceWord(selected,repeatedSource,99),selected);
});
test('drag/keyboard index moves and occurrence removal preserve repeated-word counts',()=>{
 assert.deepEqual(moveSentenceWord([...repeatedSource],0,2),['знаю','что','я','я'],'Dragging the first repeated occurrence preserves both copies');
 const dragged=moveSentenceWord([...repeatedSource],3,1);
 assert.deepEqual(dragged,['я','я','знаю','что']);
 assert.equal(new Set(sentenceOccurrences(dragged).map(item=>item.key)).size,4);
 const keyboard=moveSentenceWord(dragged,1,0);
 assert.deepEqual(keyboard,dragged,'Moving identical neighbors keeps canonical text and count');
 assert.notEqual(keyboard,dragged,'A valid position move still provides the UI a focus-restoration update');
 assert.deepEqual(removeSentenceWord(keyboard,1),['я','знаю','что']);
 assert.deepEqual(removeSentenceWord(keyboard,0),['я','знаю','что']);
 assert.deepEqual(removeSentenceWord(dragged,2),['я','я','что']);
 assert.equal(removeSentenceWord(dragged,-1),dragged);
 assert.equal(validSentenceTokens(dragged,repeatedSource),true);
 assert.equal(validSentenceTokens([...dragged,'я'],repeatedSource),false);
 assert.equal(validSentenceTokens(['я',42],repeatedSource),false);
});
test('repeated canonical answers serialize/restore without migration or extra token IDs',()=>{
 const exercise={...cafeLesson.exercises[2],tokens:repeatedSource,answer:'я знаю что я'};
 const definition={...cafeLesson,exercises:cafeLesson.exercises.map((item,index)=>index===2?exercise:item)};
 const session=freshSession();session.progress.index=2;session.progress.results=[true,true];
 session.tokens=moveSentenceWord(['я','я','знаю','что'],1,3);
 assert.equal(checkAnswer(2,session.tokens.join(' '),definition.exercises),true);
 const restored=restoreSession(JSON.stringify(session),definition);
 assert.deepEqual(restored,session);assert.deepEqual(restored.tokens,repeatedSource);
 const partial={...session,tokens:['я','я']};assert.deepEqual(restoreSession(JSON.stringify(partial),definition),partial);
 assert.deepEqual(restoreSession(JSON.stringify({...session,tokens:[...repeatedSource,'я']}),definition),freshSession(),'Over-counts are rejected');
 assert.deepEqual(restoreSession(JSON.stringify({...session,tokens:['Я','Я']}),cafeLesson),freshSession(),'Existing unique-token lessons still reject duplicates');
});
