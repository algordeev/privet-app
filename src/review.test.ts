import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons} from './curriculum/catalog.ts';
import {checkAnswer,initialProgress,progressReducer,type Progress} from './engine.ts';
import {normalizedDisplay} from './companionDisplay.ts';
import {validateCard,DISPLAY_MODE} from './learningProtocol.ts';
import {emptyStats,createStatsTracker,statsSummary,type NativeStats} from './nativeStats.ts';
import {INTERVALS,MAX_BOX,LOG_LIMIT,SESSION_SIZE,buildReviewSession,dueKeys,emptyReview,lessonItemResults,nextDue,promote,recordLesson,recordReview,restoreReview,reviewFormat,reviewHomeCard,reviewSource,reviewSources,syncLessons,type ReviewState} from './review.ts';

const today='2026-10-28',tomorrow='2026-10-29';
const allCorrect=(id:string)=>({lessonId:id,results:nativeLessons.find(l=>l.id===id)!.exercises.map(()=>true)});
const at=(box:number,due='2026-10-01')=>({box,due,lapses:0,reviews:0});
const everything=(box:number):ReviewState=>({...emptyReview(),items:Object.fromEntries(reviewSources().map(s=>[s.key,at(box)]))});

test('review items: unique keys, no vocabulary steps, repeated phrases and word-practice exercises fold into one word item',()=>{
 const keys=reviewSources().map(s=>s.key);
 assert.equal(new Set(keys).size,keys.length);
 assert.ok(reviewSources().every(s=>s.exercise?.kind!=='vocabulary'));
 assert.ok(keys.includes('cafe/w/thanks')&&!keys.includes('around-town/w/thanks'),'Спасибо! is one item');
 assert.ok(!keys.some(k=>/\/e\/(type|meaning|listen)$/.test(k)),'typed/meaning/listen exercises count for their word');
 assert.equal(new Set(reviewSources().filter(s=>s.word).map(s=>normalizedDisplay(s.word!.text))).size,reviewSources().filter(s=>s.word).length);
});
test('lesson results map to items; a word is correct only when every exercise practising it was',()=>{
 const cafe=nativeLessons[0],results=cafe.exercises.map(e=>e.id!=='type');
 const items=lessonItemResults(cafe,results);
 assert.equal(items.get('cafe/w/thanks'),false);assert.equal(items.get('cafe/w/tea'),true);assert.equal(items.get('cafe/e/exchange'),true);
 assert.equal(lessonItemResults(cafe,[true]).size,0,'mismatched results are ignored');
 // around-town's own Спасибо! word is the cafe item; its typed exercise (прямо) belongs to "straight".
 const town=nativeLessons.find(l=>l.id==='around-town')!;
 assert.equal(lessonItemResults(town,town.exercises.map(e=>e.id!=='type')).get('around-town/w/straight'),false);
});
test('sync seeds passed lessons once: first-try items tomorrow, mistakes today; existing items are never changed',()=>{
 const cafe=nativeLessons[0],results=cafe.exercises.map(e=>e.id!=='meaning');
 const s=syncLessons(emptyReview(),[{lessonId:'cafe',results}],today);
 assert.deepEqual(s.items['cafe/w/coffee'],at(0,today));assert.deepEqual(s.items['cafe/w/hi'],at(0,tomorrow));
 assert.equal(syncLessons(s,[{lessonId:'cafe',results}],today),s,'unchanged state is returned as-is');
 const moved={...s,items:{...s.items,'cafe/w/hi':at(3,'2026-11-20')}};
 assert.deepEqual(syncLessons(moved,[allCorrect('cafe'),{lessonId:'unknown',results:[]}],'2026-12-01').items['cafe/w/hi'],at(3,'2026-11-20'));
});
test('a replayed lesson pulls its new mistakes forward to today without demoting anything',()=>{
 const s={...emptyReview(),items:{'cafe/w/coffee':at(2,'2026-11-10'),'cafe/w/tea':at(2,'2026-11-10')}};
 const next=recordLesson(s,'cafe',nativeLessons[0].exercises.map(e=>e.id!=='meaning'),today);
 assert.deepEqual(next.items['cafe/w/coffee'],at(2,today));assert.deepEqual(next.items['cafe/w/tea'],at(2,'2026-11-10'));
 assert.ok(next.items['cafe/e/sentence'],'missing items are added');
});
test('ladder: correct climbs one box with growing gaps; a lapse drops two boxes and returns tomorrow',()=>{
 let item=at(0,today);const gaps:number[]=[];
 for(let i=0;i<MAX_BOX+2;i++){item=promote(item,true,today);gaps.push((Date.parse(item.due)-Date.parse(today))/864e5);}
 assert.deepEqual(gaps,[...INTERVALS.slice(1),INTERVALS[MAX_BOX],INTERVALS[MAX_BOX]]);
 assert.deepEqual(promote(at(4),false,today),{box:2,due:tomorrow,lapses:1,reviews:1});
 assert.equal(promote(at(1),false,today).box,0);
});
test('due order: most overdue then weakest; sessions cap at ten and skip retired keys',()=>{
 const s={...emptyReview(),items:{'cafe/w/tea':at(0,'2026-10-20'),'cafe/w/hi':at(3,'2026-10-10'),'cafe/w/coffee':at(1,'2026-10-20'),'cafe/w/want':at(0,tomorrow)}};
 assert.deepEqual(dueKeys(s,today),['cafe/w/hi','cafe/w/tea','cafe/w/coffee']);
 assert.equal(nextDue(s,today),tomorrow);
 assert.equal(buildReviewSession(everything(0),today)!.items.length,SESSION_SIZE);
 assert.equal(buildReviewSession({...emptyReview(),items:{'gone/w/x':at(0)}},today),null);
 assert.equal(buildReviewSession(emptyReview(),today),null);
});
test('format follows the box: meaning, listen, recall, then typing for single words; lesson exercises stay as written',()=>{
 const word=reviewSource('around-town/w/left')!,phrase=reviewSource('around-town/w/where')!,exercise=reviewSource('cafe/e/sentence')!;
 assert.deepEqual([0,1,2,3,5].map(b=>reviewFormat(word,b)),['meaning','listen','recall','typed','typed']);
 assert.deepEqual([2,3,5].map(b=>reviewFormat(phrase,b)),['recall','recall','recall']);
 assert.equal(reviewFormat(exercise,4),'original');
});
test('every generated exercise is gradable, has three distinct choices with one answer, and resolves its word in the session',()=>{
 for(let box=0;box<=MAX_BOX;box++){
  const {definition,items}=buildReviewSession(everything(box),today,Infinity)!;
  assert.equal(items.length,reviewSources().length);
  assert.equal(new Set(definition.exercises.map(e=>e.id)).size,definition.exercises.length);
  assert.equal(new Set(definition.words.map(w=>w.id)).size,definition.words.length);
  definition.exercises.forEach((e,i)=>{
   if(items[i].format==='original'){assert.deepEqual({...e,id:''},{...reviewSource(items[i].key)!.exercise!,id:''});return;}
   assert.ok(checkAnswer(i,e.answer,definition.exercises),e.id);
   if(e.wordId)assert.ok(definition.words.some(w=>w.id===e.wordId),e.id);
   if(e.choices){assert.equal(e.choices.length,3,e.id);assert.equal(new Set(e.choices.map(c=>normalizedDisplay(c.replace(/\([^)]*\)/g,'')))).size,3,e.id);assert.equal(e.choices.filter(c=>checkAnswer(i,c,definition.exercises)).length,1,e.id);
    for(const choice of e.choices)if(/[а-яё]/iu.test(choice))assert.ok(definition.words.some(w=>w.text===choice),`${e.id}: ${choice} needs its reading`);}
   if(e.kind==='typed'){assert.ok(Array.from(e.answer).every(c=>e.letters!.includes(c)),e.id);assert.equal(e.wordId,undefined);}
   if(items[i].format==='recall')assert.equal(e.wordId,undefined,'recall must not show the Russian answer as the question word');
  });
 }
});
test('a review session is deterministic for a day and orders answers differently across items',()=>{
 const a=buildReviewSession(everything(0),today,Infinity)!,b=buildReviewSession(everything(0),today,Infinity)!;
 assert.deepEqual(a,b);
 assert.ok(new Set(a.definition.exercises.filter(e=>e.choices).map(e=>e.choices!.indexOf(e.answer))).size>1);
});
test('finishing a review records each first-try result, appends to a bounded log, and ignores mismatched results',()=>{
 const s={...emptyReview(),items:{'cafe/w/tea':at(1,today),'cafe/w/hi':at(3,today)}};
 const session=buildReviewSession(s,today)!;
 const results=session.items.map(i=>i.key==='cafe/w/tea');
 const next=recordReview(s,session.items,results,today);
 assert.deepEqual(next.items['cafe/w/tea'],{box:2,due:'2026-11-04',lapses:0,reviews:1});
 assert.deepEqual(next.items['cafe/w/hi'],{box:1,due:tomorrow,lapses:1,reviews:1});
 assert.equal(next.log.length,2);assert.deepEqual(next.log.map(l=>l.correct).sort(),[false,true]);
 assert.equal(recordReview(s,session.items,[true],today),s);
 const full={...s,log:Array.from({length:LOG_LIMIT},()=>({key:'cafe/w/tea',day:today,correct:true,format:'meaning' as const}))};
 assert.equal(recordReview(full,session.items,results,today).log.length,LOG_LIMIT);
});
test('restore validates each entry and falls back to empty on unreadable data',()=>{
 for(const raw of [null,'not JSON','null','{}',JSON.stringify({version:2,items:{},log:[]}),JSON.stringify({version:1,items:[],log:[]})])assert.deepEqual(restoreReview(raw),emptyReview());
 const stored={version:1,items:{'cafe/w/tea':at(2,today),'cafe/w/hi':{...at(1),box:MAX_BOX+1},'cafe/w/coffee':{...at(1),due:'2026-02-30'},'retired/w/x':at(1),'cafe/w/want':{...at(1),extra:true}},log:[{key:'cafe/w/tea',day:today,correct:true,format:'meaning'},{key:'cafe/w/tea',day:today,correct:'yes',format:'meaning'},{key:'cafe/w/tea',day:today,correct:true,format:'other'}]};
 assert.deepEqual(restoreReview(JSON.stringify(stored)),{version:1,items:{'cafe/w/tea':at(2,today),'cafe/w/want':at(1)},log:[stored.log[0]]});
});
test('the OLED home card shows only a count, fits the wire format, and is absent when nothing is due',()=>{
 for(const n of [0,-1,1.5,NaN])assert.equal(reviewHomeCard(n),undefined);
 for(const n of [1,10,999999]){const card=reviewHomeCard(n)!;assert.ok(validateCard(card));assert.equal(card.mode,DISPLAY_MODE.DISCOVERY);assert.match(card.primary,/^\d+ to review$/);}
});
test('a finished review session counts for the streak and XP but awards no gems and keeps the lesson receipt',()=>{
 const changes:NativeStats[]=[];const tracker=createStatsTracker(emptyStats(),s=>changes.push(s),()=>new Date(2026,9,28,12));
 const {definition}=buildReviewSession(everything(0),today,2)!;
 let p:Progress=initialProgress(),last:[Progress,Progress]|undefined;
 for(const e of definition.exercises){const before=progressReducer(p,{type:'check',value:e.answer},definition.exercises);const after=progressReducer(before,{type:'continue'},definition.exercises);tracker.transition(before,after,{type:'continue'},'review:1');p=after;last=[before,after];}
 assert.equal(p.complete,true);assert.equal(changes.length,1);
 const summary=statsSummary(changes[0],new Date(2026,9,28,12));
 assert.equal(summary.current,1);assert.ok(summary.todayXp>0);assert.equal(summary.gems,0);assert.equal(changes[0].latest,null);
 tracker.transition(...last!,{type:'continue'},'review:1');
 assert.equal(changes.length,1,'one session records once');
});
