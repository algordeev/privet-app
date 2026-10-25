import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons,cafeLesson,introductionsLesson} from './curriculum/catalog.ts';
import {stressedToken} from './curriculum/display.ts';
import {initialProgress,checkAnswer,normalizeAnswer} from './engine.ts';
import {freshSession,restoreSession,lessonPassed} from './session.ts';
import {CYRILLIC,contextualLetters,referenceExample} from './cyrillic.ts';
const revised=nativeLessons.slice(2);

test('a saved session from a different content revision is discarded; a saved completion still counts as passed',()=>{
 const definition=revised[0];
 const progress={...initialProgress(),index:2,results:[true,false],attempts:1,feedback:'correct' as const,hearts:2};
 const inProgress={...freshSession(),progress};
 // Missing or stale contentRevision: the saved session belongs to
 // since-changed content and is discarded in favor of a fresh start.
 for(const contentRevision of [undefined,1] as const){
  const raw=JSON.stringify({...inProgress,...(contentRevision!==undefined?{contentRevision}:{})});
  assert.deepEqual(restoreSession(raw,definition),freshSession(),`contentRevision ${String(contentRevision)}`);
 }
 // The matching current revision restores normally.
 assert.deepEqual(restoreSession(JSON.stringify({...inProgress,contentRevision:2}),definition),inProgress);
 // A saved completion is a separate, untouched path: still counts as
 // passed even though an in-progress session for the same lesson would be
 // discarded above.
 const saved={preferences:{stress:false,pronunciation:true},completion:{results:[true,false,true,false,true],date:'2026-10-23'}};
 assert.ok(lessonPassed(initialProgress(),saved));
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
test('revised alphabet references conceal assessed Russian answers',()=>{
 const norm=(text:string)=>text.normalize('NFD').replace(/́/g,'').normalize('NFC').toLowerCase().replace(/[^а-яё]/g,'');
 for(const l of revised)for(const e of l.exercises){
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
 // normalizeAnswer strips stress marks, so the round-trip check above alone
 // cannot catch a token silently rendered unstressed (e.g. завтра: taught as
 // its own Word only in making-plans, reused in culture's sentence exercise
 // without being re-taught there). Separately confirm every token carries a
 // stress mark whenever that bare token has one anywhere in the curriculum
 // -- the exact scope stressedToken's lesson-then-global-fallback search
 // covers -- across all six revised lessons, not only the three above.
 const bare=(text:string)=>text.normalize('NFD').replace(/́/g,'').normalize('NFC').replace(/[.,!?…]+$/u,'').toLowerCase();
 const hasStress=(text:string)=>/́/.test(text.normalize('NFD'));
 const stressedTokens=new Set<string>();
 for(const l of [...revised,cafeLesson,introductionsLesson])for(const w of l.words){
  const canonical=w.text.split(' '),stressed=w.stressed.split(' ');
  canonical.forEach((token,i)=>{if(hasStress(stressed[i]))stressedTokens.add(bare(token));});
 }
 for(const l of revised)for(const e of l.exercises.filter(e=>e.kind==='sentence'))for(const token of e.answer.split(' ')){
  if(!stressedTokens.has(bare(token)))continue;
  assert.ok(hasStress(stressedToken(token,l.words)),`${l.id}/${e.id}: "${token}" has no stress mark`);
 }
});
test('one bare Russian token never maps to two different stressed forms anywhere in the curriculum',()=>{
 // Guards stressedToken's global fallback: if the same bare token were
 // taught with two different stress placements in different lessons, which
 // one wins would depend on lesson iteration order -- silently inconsistent.
 const bare=(text:string)=>text.normalize('NFD').replace(/́/g,'').normalize('NFC').replace(/[.,!?…]+$/u,'').toLowerCase();
 const seen=new Map<string,string>();
 for(const l of nativeLessons)for(const w of l.words){
  const canonical=w.text.split(' '),stressed=w.stressed.split(' ');
  canonical.forEach((token,i)=>{
   // stressedToken only reuses the stress placement, then reapplies the
   // input token's own case -- so two entries differing only by case (e.g.
   // sentence-initial "Спасибо!" vs mid-sentence "спасибо") are not a real
   // conflict; compare case-insensitively too.
   const key=bare(token),value=stressed[i].replace(/[.,!?…]+$/u,'').toLowerCase();
   const existing=seen.get(key);
   assert.ok(!existing||existing===value,`"${key}" stressed both "${existing}" and "${value}" (${l.id})`);
   seen.set(key,value);
  });
 }
});
