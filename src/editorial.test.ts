import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeLessons,cafeLesson,introductionsLesson} from './curriculum/catalog.ts';
import {definitionForSaved,legacyLesson} from './curriculum/compatibility.ts';
import {stressedToken} from './curriculum/display.ts';
import {initialProgress,checkAnswer,normalizeAnswer,progressReducer} from './engine.ts';
import {freshSession,restoreSession,recordLessonCompletion,lessonPassed} from './session.ts';
import {CYRILLIC,contextualLetters,referenceExample} from './cyrillic.ts';
const revised=nativeLessons.slice(2);
// Hashes of the shipped v1 words/exercises, not copies of six legacy lessons.
const originalHashes:Record<string,string>={"around-town": "c73e24bd9b0dfd387ccc8f452bf8bc522755a3aa9d3a6b47ae838f500d61e95e", "shopping": "fab4bfa3df78d1c997fedc3a88918f81e66d12bfa3333f927aace880ba4e05a7", "daily-life": "65fb50730714948b06e38a7bfd6fa1215cf6b0cb20f097a7b980b9f6efebe78d", "making-plans": "1a14d8d4d38b446e35281b00404efc89703881377da968efc1c191aa68e9429f", "studies": "370056fe42b64bcf4acdfeee080dae3f3b4cf0ec9d30914554689c7349ef5fea", "culture": "3b9ede4a4c67658ab3af27fdcba294a80c4034d416f6183a3f1313740a1d45aa"};

test('legacy differences reconstruct every original assessment and word without six duplicated definitions',()=>{
 for(const definition of revised){const legacy=legacyLesson(definition);
  assert.equal(legacy.contentRevision,1);assert.equal(legacy.id,definition.id);
  const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value;
  assert.equal(createHash('sha256').update(JSON.stringify(canonical({words:legacy.words,exercises:legacy.exercises}))).digest('hex'),originalHashes[definition.id]);
 }
});
test('legacy sessions at every position retain input, hints, feedback, hearts and first-try results',()=>{
 for(const definition of revised){const legacy=legacyLesson(definition);
  for(const [index,exercise] of legacy.exercises.entries())for(const feedback of [null,'correct','incorrect'] as const){
   const s={...freshSession(),progress:{...initialProgress(),index,results:Array.from({length:index},(_,i)=>i%2===0),attempts:feedback?1:0,feedback,hearts:feedback==='incorrect'?2:3},revealed:legacy.words.map(w=>w.id),vocabularyWord:legacy.words[0].text,hintAt:index,
    selected:exercise.kind==='choice'?exercise.choices![0]:exercise.kind==='typed'?exercise.answer.slice(0,2):'',tokens:exercise.kind==='sentence'?[exercise.tokens![0]]:[]};
   for(const marker of [undefined,1]){
    const raw=JSON.stringify({...s,...(marker?{contentRevision:marker}:{})});const target=definitionForSaved(definition,raw,null);
    assert.equal(target.contentRevision,1);assert.deepEqual(restoreSession(raw,target),s);
   }
  }
  const completed={...freshSession(),progress:{...initialProgress(),index:5,results:[true,false,true,false,true],complete:true}};
  const completion={results:completed.progress.results,date:'2026-10-23',contentRevision:1 as const};
  assert.equal(definitionForSaved(definition,JSON.stringify(completed),null).contentRevision,1);
  assert.equal(definitionForSaved(definition,null,JSON.stringify({completion})).contentRevision,1);
  assert.deepEqual(restoreSession(JSON.stringify(completed),legacy).progress,completed.progress);
  const saved={preferences:{stress:false,pronunciation:true},bestFirstTry:5,completion};
  assert.ok(lessonPassed(initialProgress(),saved));
  const latest=recordLessonCompletion(saved,{results:[true,true,false,false,false],date:'2026-10-24',contentRevision:2});
  assert.equal(latest.bestFirstTry,5);assert.equal(latest.completion!.contentRevision,2);
 }
});
test('fresh and revision-2 attempts use current content, while café/introduction definitions are unchanged',()=>{
 for(const definition of revised){assert.equal(definitionForSaved(definition,null,null),definition);assert.equal(definitionForSaved(definition,JSON.stringify({...freshSession(),contentRevision:2}),null),definition);assert.equal(definitionForSaved(definition,'not json',null),definition);
  for(const [index,e] of definition.exercises.entries())assert.ok(checkAnswer(index,e.answer,definition.exercises));
 }
 for(const definition of [cafeLesson,introductionsLesson]){assert.equal(legacyLesson(definition),definition);assert.equal(definitionForSaved(definition,JSON.stringify(freshSession()),null),definition);}
});
test('revised episodes have intentional sequences and specific communication goals',()=>{
 assert.deepEqual(revised.map(l=>l.exercises.map(e=>e.kind)),[
  ['vocabulary','sentence','choice','choice','typed'],['vocabulary','sentence','choice','choice','typed'],
  ['vocabulary','choice','sentence','choice','sentence'],['vocabulary','choice','sentence','typed','choice'],
  ['vocabulary','choice','sentence','sentence','choice'],['vocabulary','choice','sentence','choice','choice'],
 ]);
 const find=(id:string)=>revised.find(l=>l.id===id)!;
 assert.equal(find('shopping').exercises[1].answer,'Хлеб, пожалуйста.');
 assert.equal(find('around-town').exercises[1].answer,'Где метро?');
 assert.equal(find('making-plans').exercises[2].answer,'Давай завтра погуляем!');
 assert.equal(find('making-plans').exercises[4].answer,'До завтра!');
 assert.equal(find('culture').exercises[2].answer,'Давай завтра в музей!');
 assert.match(find('daily-life').description,/relaxing evening/);assert.doesNotMatch(find('daily-life').description,/busy evening/);
 const study=find('studies');assert.ok(study.exercises.some(e=>e.answer==='Где ты учишься?'));assert.ok(study.exercises.some(e=>e.answer==='Где ты работаешь?'));assert.ok(study.exercises.some(e=>e.answer==='Я работаю дома.'));assert.equal(study.exercises[1].answer,'А я работаю.');
});
test('revised wording avoids generated punctuation, answer-bearing instructions and unrelated hints',()=>{
 const forbidden=['You have the expressions for this visit','Look at the word in the first step','The words are right; try a different order','Choose a reply that fits the invitation or question','A useful word for this story','Давай гулять завтра','Хлеб пожалуйста','.”.','!”.','?”.'];
 for(const l of revised){
  const text=JSON.stringify(l);for(const phrase of forbidden)assert.ok(!text.includes(phrase),`${l.id}: ${phrase}`);
  for(const e of l.exercises){
   if(e.kind==='vocabulary')continue;
   if(/[а-яё]/iu.test(e.answer))assert.ok(!normalizeAnswer(e.instruction).includes(normalizeAnswer(e.answer)),`${l.id}/${e.id} gives answer in instruction`);
   assert.ok(e.retryFeedback&&e.hint);assert.ok(!e.success.startsWith('Yes:')&&!e.success.startsWith('That works:'));
  }
 }
});
test('both legacy and revised alphabet references conceal assessed Russian answers',()=>{
 const norm=(text:string)=>text.normalize('NFD').replace(/\u0301/g,'').normalize('NFC').toLowerCase().replace(/[^а-яё]/g,'');
 for(const current of revised)for(const l of [current,legacyLesson(current)])for(const e of l.exercises){
  const letters=contextualLetters(l,e);assert.ok(letters.length);assert.equal(new Set(letters.map(i=>i.upper)).size,letters.length);
  for(const item of CYRILLIC){const result=referenceExample(item,l,e);assert.ok(result.example&&norm(result.example).includes(item.lower),`${l.id}/${e.id}/${item.upper}`);if(/[а-яё]/iu.test(e.answer))assert.ok(!norm(result.example).includes(norm(e.answer)));}
 }
});
test('native stress presentation preserves token punctuation, capitalization and canonical answers',()=>{
 const shop=revised.find(l=>l.id==='shopping')!,plans=revised.find(l=>l.id==='making-plans')!,day=revised.find(l=>l.id==='daily-life')!;
 assert.equal(stressedToken('пожалуйста.',shop.words),'пожа́луйста.');
 assert.equal(stressedToken('Пожалуйста,',shop.words),'Пожа́луйста,');
 assert.equal(stressedToken('погуляем!',plans.words),'погуля́ем!');
 assert.equal(stressedToken('Утром',day.words),'У́тром');
 for(const l of revised)for(const e of l.exercises.filter(e=>e.kind==='sentence')){
  const rendered=e.answer.split(' ').map(t=>stressedToken(t,l.words)).join(' ');
  assert.equal(normalizeAnswer(rendered),normalizeAnswer(e.answer));assert.ok(checkAnswer(l.exercises.indexOf(e),rendered,l.exercises));
 }
});
