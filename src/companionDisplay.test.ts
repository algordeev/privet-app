import {companionCardFixtures} from '../scripts/companion-card-fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons} from './curriculum/catalog.ts';
import {firstRunLesson} from './firstRunLesson.ts';
import {initialProgress} from './engine.ts';
import {companionDisplay,safeBeforeAnswer,normalizedDisplay,compactMeaning} from './companionDisplay.ts';
import {validateCard} from './learningProtocol.ts';
test('all eight lessons and onboarding have answer-safe pre-answer cards, hints, and incorrect states',()=>{
 assert.equal(nativeLessons.length,8);
 for(const definition of [...nativeLessons,firstRunLesson])for(const [index,e] of definition.exercises.entries()){
  for(const feedback of [null,'incorrect'] as const){const state={...initialProgress(),index,feedback};
   for(const action of [{kind:'state'},{kind:'hint'},...definition.words.map(w=>({kind:'listen',text:w.text})),{kind:'listen',text:e.answer}] as const){
    const card=companionDisplay(definition,state,action);if(card){assert.ok(validateCard(card),`${definition.id}/${e.id}`);if(e.kind!=='vocabulary'&&/[а-яё]/iu.test(e.answer)){const answer=normalizedDisplay(e.answer);for(const text of [card.primary,card.secondary,card.primary+' '+card.secondary])assert.ok(!normalizedDisplay(text).includes(answer),`${definition.id}/${e.id}: leaked ${e.answer}`);}
     assert.ok(safeBeforeAnswer(e,card.primary,card.secondary),`${definition.id}/${e.id}: ${JSON.stringify(card)}`);}
   }
  }
  const correct=companionDisplay(definition,{...initialProgress(),index,feedback:'correct'});if(e.kind!=='vocabulary'){assert.ok(correct,`${definition.id}/${e.id}: missing correct-answer card`);assert.ok(validateCard(correct));}
 }
});
test('vocabulary reveals only the requested known word and discovery meaning',()=>{
 const l=nativeLessons[0],p=initialProgress();assert.equal(companionDisplay(l,p)?.primary,'Tap a word');assert.equal(companionDisplay(l,p,{kind:'reveal',word:'coffee'})?.primary,'кофе');assert.equal(companionDisplay(l,p,{kind:'reveal',word:'coffee'})?.secondary,'coffee');assert.equal(companionDisplay(l,p,{kind:'reveal',word:'unknown'}),undefined);
});
test('meaning prompt hides its English answer; grading permits it, incorrect does not',()=>{
 const l=nativeLessons[0],p={...initialProgress(),index:1};assert.equal(companionDisplay(l,p)?.primary,'кофе');assert.equal(companionDisplay(l,p)?.secondary,'Choose on phone');assert.equal(companionDisplay(l,{...p,feedback:'correct'})?.secondary,'coffee');assert.equal(companionDisplay(l,{...p,feedback:'incorrect'})?.secondary,'Choose on phone');
});
test('typed and sentence answers are hidden even during attempted pronunciation; completed/failed contexts have no card',()=>{
 for(const l of nativeLessons)for(const [index,e] of l.exercises.entries())if(e.kind==='typed'||e.kind==='sentence'){
  const p={...initialProgress(),index};assert.equal(companionDisplay(l,p,{kind:'listen',text:e.answer}),undefined);assert.equal(companionDisplay(l,{...p,complete:true}),undefined);assert.equal(companionDisplay(l,{...p,failed:true}),undefined);
 }
});

test('curated reply metadata fails closed if separately edited lesson content changes its answer',()=>{
 const definition=nativeLessons.find(l=>l.id==='studies')!,index=definition.exercises.findIndex(e=>e.id==='exchange');
 const state={...initialProgress(),index,feedback:'correct' as const};assert.equal(companionDisplay(definition,state)?.secondary,'And I work.');
 const edited={...definition,exercises:definition.exercises.map((e,i)=>i===index?{...e,answer:'Другая фраза.'}:e)};assert.equal(companionDisplay(edited,state),undefined);
});

test('OLED meanings retain complete useful words without phone-only register notes',()=>{
 assert.equal(compactMeaning('Let’s go for a walk! (informal)'),'Let’s go for a walk!');
 assert.equal(compactMeaning('And you? (your name)'),'And your name?');
 const l=nativeLessons.find(l=>l.id==='making-plans')!,index=l.exercises.findIndex(e=>e.kind==='vocabulary');
 const card=companionDisplay(l,{...initialProgress(),index},{kind:'reveal',word:'walk'})!;
 assert.equal(card.secondary,"Let's go for a walk!");assert.equal(l.words.find(w=>w.id==='walk')!.meaning,'Let’s go for a walk! (informal)');
});
test('every current vocabulary, prompt, answer and available guide-audio card fits wire limits without ellipsis',()=>{
 const cards=companionCardFixtures();assert.ok(cards.length>200);
 for(const card of cards){assert.ok(!card.primary.includes('...')&&!card.secondary.includes('...'),JSON.stringify(card));assert.ok(new TextEncoder().encode(card.primary).length<=64,card.context);assert.ok(new TextEncoder().encode(card.secondary).length<=32,card.context);}
});
