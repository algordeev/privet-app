import test from 'node:test';
import assert from 'node:assert/strict';
import {INTERVALS,applyPocketAnswers,buildPocketDeck,emptyReview,restorePocketDeck,restoreReview,reviewSource,reviewSources,type ReviewState} from './review.ts';
import {dayKey,dayNumber,pocketBody} from './pocketProtocol.ts';
import {validText} from './learningProtocol.ts';

const today='2026-11-06';
const at=(box:number,due='2026-11-01',reviews=0)=>({box,due,lapses:0,reviews});
const words=reviewSources().filter(s=>s.word),exercises=reviewSources().filter(s=>!s.word);
const state=(entries:[string,ReturnType<typeof at>][]):ReviewState=>({...emptyReview(),items:Object.fromEntries(entries)});

test('the pocket deck holds up to 20 due words, never exercises or words not yet due, most overdue first',()=>{
 const s=state([...words.map((w,i)=>[w.key,at(0,i<25?'2026-11-0'+(1+i%5):'2026-11-09')] as [string,ReturnType<typeof at>]),...exercises.map(e=>[e.key,at(0,'2026-10-01')] as [string,ReturnType<typeof at>])]);
 const built=buildPocketDeck(s,today,77)!;
 assert.equal(built.deck.id,77);assert.equal(built.deck.day,today);assert.equal(built.deck.items.length,20);assert.equal(built.entries.length,20);
 assert.ok(built.deck.items.every(i=>reviewSource(i.key)?.word&&s.items[i.key].due<=today));
 assert.ok(built.deck.items.every((item,i,all)=>i===0||s.items[all[i-1].key].due<=s.items[item.key].due));
 assert.doesNotThrow(()=>pocketBody(built.entries));
 assert.ok(built.entries.every(e=>validText(e.russian)&&validText(e.meaning)));
 assert.equal(buildPocketDeck(state([[words[0].key,at(0,'2026-11-09')]]),today,1),null,'nothing due: no deck');
 assert.equal(buildPocketDeck(state(exercises.map(e=>[e.key,at(0)])),today,1),null,'only exercises due: no deck');
});
test('new words show Russian first; words from box 2 show the meaning first and ask for the Russian',()=>{
 const [a,b]=words;
 const built=buildPocketDeck(state([[a.key,at(1,'2026-11-01')],[b.key,at(2,'2026-11-02')]]),today,1)!;
 assert.equal(built.entries[0].russian,a.word!.text.normalize('NFD').replace(/\u0301/g,'').normalize('NFC'));
 assert.match(built.entries[0].meaning,/[a-z]/i);assert.equal(built.entries[0].englishFirst,false);
 assert.equal(built.entries[1].englishFirst,true);assert.match(built.entries[1].russian,/[а-яё]/i);
});
test('answers promote or drop each card once, logged as pocket reviews on the Mini’s day',()=>{
 const [a,b,c]=words;
 const s=state([[a.key,at(0)],[b.key,at(3)],[c.key,at(1)]]);
 const {deck}=buildPocketDeck(s,today,9)!;
 const card=(key:string)=>deck.items.findIndex(i=>i.key===key);
 const yesterday=dayNumber('2026-11-05'),todayN=dayNumber(today);
 const {state:next,applied}=applyPocketAnswers(s,{...deck,day:'2026-11-04'},[
  {card:card(a.key),knew:true,day:yesterday},{card:card(a.key),knew:false,day:todayN},
  {card:card(b.key),knew:false,day:todayN},
 ],today,dayKey);
 assert.deepEqual(applied.map(x=>[x.key,x.knew,x.day]),[[a.key,true,'2026-11-05'],[b.key,false,today]]);
 assert.deepEqual(next.items[a.key],{box:1,due:'2026-11-08',lapses:0,reviews:1},'knew on the 5th: box 1, due 3 days later');
 assert.equal(INTERVALS[1],3);
 assert.deepEqual(next.items[b.key],{box:1,due:'2026-11-07',lapses:1,reviews:1},'didn’t: down two boxes, tomorrow');
 assert.deepEqual(next.items[c.key],s.items[c.key],'unanswered cards are untouched');
 assert.deepEqual(next.log.map(l=>l.format),['pocket','pocket']);
 assert.equal(restoreReview(JSON.stringify(next)).log.length,2,'pocket log entries survive a restore');
});
test('a word reviewed in the app since the deck was copied ignores the Mini’s answer; days are kept in range',()=>{
 const [a,b]=words;
 const s=state([[a.key,at(0)],[b.key,at(0)]]);
 const {deck}=buildPocketDeck(s,today,9)!;
 const reviewed={...s,items:{...s.items,[a.key]:{...s.items[a.key],reviews:1,due:'2026-11-07',box:1}}};
 const r=applyPocketAnswers(reviewed,deck,[{card:0,knew:true,day:0},{card:1,knew:true,day:0}],today,dayKey);
 assert.deepEqual(r.applied.map(x=>x.key),[deck.items[1].key===a.key?deck.items[0].key:deck.items[1].key]);
 const future=applyPocketAnswers(s,deck,[{card:0,knew:true,day:dayNumber('2026-12-01')}],today,dayKey);
 assert.equal(future.applied[0].day,today,'a clock running ahead counts as today');
 const before=applyPocketAnswers(s,deck,[{card:0,knew:true,day:dayNumber('2026-10-01')}],today,dayKey);
 assert.equal(before.applied[0].day,deck.day,'never before the deck was copied');
 const none=applyPocketAnswers(s,deck,[{card:5,knew:true,day:0}],today,dayKey);
 assert.equal(none.state,s);assert.deepEqual(none.applied,[]);
});
test('a saved deck restores only when every field is valid',()=>{
 const deck={id:3,day:today,items:[{key:words[0].key,box:0,reviews:2}]};
 assert.deepEqual(restorePocketDeck(JSON.stringify(deck)),deck);
 for(const bad of [{...deck,id:0},{...deck,day:'2026-13-01'},{...deck,items:[]},{...deck,items:[{key:'gone/w/x',box:0,reviews:0}]},{...deck,items:[{...deck.items[0],box:9}]}])assert.equal(restorePocketDeck(JSON.stringify(bad)),undefined);
 assert.equal(restorePocketDeck('{'),undefined);assert.equal(restorePocketDeck(null),undefined);
});
import {emptyStats,recordPocketReviews,statsSummary} from './nativeStats.ts';
test('Mini answers keep the streak (one practice day per day) and give 1 XP per known card, no gems',()=>{
 const now=new Date(2026,10,6,18);
 const stats=recordPocketReviews(emptyStats(),[{day:'2026-11-05',knew:true},{day:'2026-11-05',knew:false},{day:'2026-11-06',knew:true},{day:'2026-11-06',knew:true},{day:'2026-11-09',knew:true}],now);
 assert.deepEqual(stats.days,{'2026-11-05':1,'2026-11-06':1});assert.deepEqual(stats.xp,{'2026-11-05':1,'2026-11-06':2});
 assert.equal(stats.gems.balance,0);assert.equal(stats.latest,null);
 const summary=statsSummary(stats,now);assert.equal(summary.current,2);assert.equal(summary.todayXp,2);
 const missed=recordPocketReviews(emptyStats(),[{day:'2026-11-06',knew:false}],now);assert.deepEqual(missed.xp,{});assert.deepEqual(missed.days,{'2026-11-06':1});
 const none=emptyStats();assert.equal(recordPocketReviews(none,[],now),none);
});
test('every word in the course fits a pocket card whole, without "..."',()=>{
 for(const box of [0,2]){
  const all=state(words.map(w=>[w.key,at(box)]));
  for(let start=0;start<words.length;start+=20){
   const slice=state(words.slice(start,start+20).map(w=>[w.key,all.items[w.key]]));
   const built=buildPocketDeck(slice,today,1)!;
   assert.equal(built.entries.length,Math.min(20,words.length-start));
   for(const e of built.entries)assert.ok(!e.russian.endsWith('...')&&!e.meaning.endsWith('...'),`${e.russian} = ${e.meaning}`);
  }
 }
});
