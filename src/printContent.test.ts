import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons} from './curriculum/catalog.ts';
import {exampleFor,practiceStrip,progressReceipt,wordOfTheDay} from './printContent.ts';
import {emptyReview,type ReviewState} from './review.ts';
import {emptyStats,localDay} from './nativeStats.ts';
import {normalizedDisplay} from './companionDisplay.ts';
const cafe=nativeLessons[0];
const plain=(text:string)=>normalizedDisplay(text);

test('word of the day: a learned word chosen by the date, weak or due first; the first lesson before anything is learned',()=>{
 const none=wordOfTheDay(emptyReview(),'2026-11-18');
 assert.equal(none.lesson.id,cafe.id);
 assert.equal(wordOfTheDay(emptyReview(),'2026-11-18').key,none.key);
 const review:ReviewState={...emptyReview(),items:{
  'cafe/w/coffee':{box:4,due:'2026-12-30',lapses:0,reviews:5},
  'cafe/w/tea':{box:0,due:'2026-11-19',lapses:1,reviews:1},
 }};
 for(const day of ['2026-11-18','2026-11-19','2026-11-20'])assert.equal(wordOfTheDay(review,day).key,'cafe/w/tea');
 const card=wordOfTheDay(review,'2026-11-18');
 assert.equal(card.word.stressed,'чай');assert.match(card.date,/2026/);
});
test('example sentences come from the same lesson, contain the word, and are never the word itself',()=>{
 const tea=cafe.words.find(w=>w.id==='tea')!;
 assert.deepEqual(exampleFor(cafe,tea),{russian:'Я хочу́ чай.',english:'I want tea.'});
 const want=cafe.words.find(w=>w.id==='want')!;
 assert.equal(exampleFor(cafe,want),undefined);
 for(const lesson of nativeLessons)for(const word of lesson.words){
  const example=exampleFor(lesson,word);if(!example)continue;
  assert.notEqual(plain(example.russian),plain(word.text));
  assert.ok(` ${plain(example.russian)} `.includes(` ${plain(word.text)} `),`${word.text} in ${example.russian}`);
 }
});
test('every lesson gets three practice items with three distinct options, one correct, and no names lowercased',()=>{
 for(const lesson of nativeLessons){
  const strip=practiceStrip(lesson);
  assert.equal(strip.items.length,3,lesson.id);
  for(const item of strip.items){
   assert.equal(item.options.length,3);
   assert.equal(new Set(item.options.map(plain)).size,3,item.options.join());
   assert.ok(item.answer>=0&&item.answer<3);
   assert.ok(item.english);
   for(const option of item.options)assert.doesNotMatch(option,/^(а́нна|алекс|анна)$/u);
  }
  assert.equal(new Set(strip.items.map(i=>plain(i.options[i.answer]))).size,3,`${lesson.id} repeats an answer`);
  assert.deepEqual(strip.answers,strip.items.map((item,i)=>`${i+1} ${item.options[item.answer]}`));
  assert.ok(strip.trace?.russian,lesson.id);
 }
 // Café: the blank and the line put back together are the lesson's own sentence.
 const first=practiceStrip(cafe).items[0];
 assert.equal(first.before+first.options[first.answer]+first.after,'Я хочу́ чай.');
 assert.equal(practiceStrip(cafe).trace?.russian,'Спасибо');
 for(const lesson of nativeLessons)assert.doesNotMatch(practiceStrip(lesson).trace?.russian??'',/\u0301/u,lesson.id);
});
test('the receipt counts today only: streak week Mon–Sun, new words, reviews, accuracy, stars and XP',()=>{
 const now=new Date('2026-11-18T15:30:00'),today=localDay(now);
 const stats={...emptyStats(),days:{[today]:1,'2026-11-17':1,'2026-11-16':1,'2026-11-10':1},xp:{[today]:20,'2026-11-17':15}};
 const review:ReviewState={version:1,items:{'cafe/w/tea':{box:4,due:'2026-12-01',lapses:0,reviews:4},'introductions/w/hello':{box:2,due:'2026-11-25',lapses:0,reviews:2}},
  log:[{key:'cafe/w/tea',day:today,correct:true,format:'meaning'},{key:'cafe/w/coffee',day:today,correct:false,format:'meaning'},{key:'cafe/w/tea',day:'2026-11-17',correct:true,format:'meaning'}]};
 const receipt=progressReceipt(stats,review,[{lessonId:'cafe',date:now.toISOString(),results:[true,true,false,true,true]},{lessonId:'introductions',date:'2026-11-01T10:00:00Z',results:[true]}],now);
 assert.equal(receipt.streak,3);
 assert.deepEqual(receipt.week.map(d=>d.done),[true,true,true,false,false,false,false]); // 18 Nov 2026 is a Wednesday.
 assert.equal(receipt.week[2].today,true);assert.equal(receipt.week[3].future,true);
 assert.equal(receipt.newWords,cafe.words.length);
 assert.equal(receipt.reviewed,2);
 assert.equal(receipt.accuracy,Math.round(5/7*100));
 assert.equal(receipt.words.find(w=>w.russian==='чай')?.stars,3);
 assert.equal(receipt.words.find(w=>w.russian==='ко́фе')?.stars,1);
 assert.equal(new Set(receipt.words.map(w=>w.russian)).size,receipt.words.length);
 assert.equal(receipt.xp.length,7);assert.equal(receipt.xp.at(-1)?.xp,20);assert.equal(receipt.xp.at(-1)?.today,true);
 assert.equal(receipt.todayXp,20);assert.equal(receipt.totalXp,35);
 const empty=progressReceipt(emptyStats(),emptyReview(),[],now);
 assert.equal(empty.accuracy,null);assert.equal(empty.words.length,0);assert.equal(empty.streak,0);
});
