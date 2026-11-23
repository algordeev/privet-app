import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons} from './curriculum/catalog.ts';
import {alphabetStrip,exampleFor,letterStrip,RECALL_LETTERS,recallStrip,practiceStrip,progressReceipt,reviewStrip,wordOfTheDay} from './printContent.ts';
import {emptyReview,type ReviewState} from './review.ts';
import {emptyStats} from './nativeStats.ts';
import {localDay} from './days.ts';
import {CYRILLIC,QUICK_LETTERS,QUICK_TITLES,READING_WORDS} from './cyrillic.ts';
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
test('a review strip puts the missed words first, traces the first one missed and uses only lesson lines',()=>{
 const strip=reviewStrip([{key:'cafe/w/tea',correct:true},{key:'cafe/w/coffee',correct:false},{key:'cafe/w/thanks',correct:false},{key:'around-town/w/excuse',correct:true}],'2026-11-19');
 assert.equal(strip.lesson.number,'');assert.match(strip.lesson.title,/^Review · /);
 const answers=strip.items.map(i=>plain(i.options[i.answer]));
 assert.deepEqual(answers.slice(0,2),['кофе','спасибо']);
 assert.equal(strip.trace?.russian,'кофе');
 assert.equal(strip.items.length,3);
 for(const item of strip.items){assert.equal(new Set(item.options.map(plain)).size,3);assert.ok(item.english);}
 // Every blanked line is a real line of one of the reviewed lessons.
 for(const item of strip.items.filter(i=>i.before||i.after))assert.ok([...nativeLessons].some(l=>[...l.words.map(w=>plain(w.text)),...l.exercises.map(e=>plain(e.prompt)),...l.exercises.map(e=>plain(e.exchange?.text??''))].includes(plain(item.before+item.options[item.answer]+item.after))),item.before+'…'+item.after);
 const allRight=reviewStrip([{key:'shopping/w/bread',correct:true},{key:'daily-life/w/morning',correct:true}],'2026-11-19');
 assert.equal(allRight.trace?.russian,'хлеб');assert.ok(allRight.items.length>=2);
 assert.equal(reviewStrip([],'2026-11-19').items.length,0);
});

test('alphabet strips: one per quick start page, built only from the quick start\'s own letters and words',()=>{
 const strips=[0,1,2,3].map(alphabetStrip);
 assert.deepEqual(strips.map(s=>s.title),QUICK_TITLES.map(t=>t.replace(/\.$/,'')));
 strips.forEach((strip,page)=>{assert.equal(strip.page,page);assert.equal(strip.pages,4);});
 // Pages 1-3: that page's letters in its order, each with its small letter and sound.
 QUICK_LETTERS.forEach((group,page)=>{
  assert.deepEqual(strips[page].letters.map(l=>l.upper),[...group]);
  assert.equal(strips[page].words.length,0);
  for(const letter of strips[page].letters){
   const source=CYRILLIC.find(item=>item.upper===letter.upper)!;
   assert.equal(letter.lower,source.lower);assert.equal(letter.sound,source.sound);
  }
 });
 // The look-alike notes appear on the look-alikes page only, and all of its letters have one.
 assert.ok(strips[1].letters.every(l=>l.note===CYRILLIC.find(item=>item.upper===l.upper)!.note&&l.note));
 assert.ok([strips[0],strips[2]].every(s=>s.letters.every(l=>l.note===undefined)));
 // Page 4: the reading words with their reading guides.
 assert.deepEqual(strips[3].letters,[]);
 assert.deepEqual(strips[3].words.map(w=>w.russian),READING_WORDS.map(w=>w.text));
 // Spelt as written, to copy letter by letter (not the reading guide, which says how it sounds).
 assert.deepEqual(strips[3].words.map(w=>[w.spelling,w.english,w.reading]),[['kofe','coffee',undefined],['chay','tea',undefined],['privet','Hi!',undefined],['poka','Bye!',undefined]]);
 // Out of range pages fall back to the nearest real page.
 assert.equal(alphabetStrip(-1).page,0);assert.equal(alphabetStrip(9).page,3);assert.equal(alphabetStrip(Number.NaN).page,0);
});

test('letter strips: any of the 33 letters, in alphabet position, with the example its guide card shows',()=>{
 CYRILLIC.forEach((letter,i)=>{
  const strip=letterStrip(letter);
  assert.equal(strip.position,i+1);assert.equal(strip.letters,33);
  assert.deepEqual([strip.upper,strip.lower,strip.sound,strip.note],[letter.upper,letter.lower,letter.sound,letter.note]);
  assert.equal(strip.example?.russian,letter.example);assert.equal(strip.example?.english,letter.meaning);
  assert.ok(strip.example?.reading,`${letter.example} has a reading guide`);
 });
 const zhe=letterStrip(CYRILLIC.find(l=>l.upper==='Ж')!);
 assert.equal(zhe.position,8);assert.equal(zhe.example?.russian,'журнал');
 // During an exercise the guide may swap the example (or leave it out); the strip prints what the card shows.
 const tea=CYRILLIC.find(l=>l.upper==='Ч')!;
 assert.equal(letterStrip({...tea,example:'часы',meaning:'clock'}).example?.russian,'часы');
 assert.equal(letterStrip({...tea,example:'',meaning:'Example omitted for this question.'}).example,undefined);
 assert.throws(()=>letterStrip({...tea,upper:'Q'}));
});

test('write from memory: one section of 20 letters (the look-alikes always in), then the words, shuffled per print',()=>{
 const sound=(lower:string)=>CYRILLIC.find(l=>l.lower===lower)!.sound;
 // A seeded random, so each run is repeatable.
 const seeded=(seed:number)=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
 const strip=recallStrip(seeded(7));
 assert.deepEqual(strip.sections.map(s=>[s.title,s.kind]),[['Letters','letter'],[QUICK_TITLES[3].replace(/\.$/,''),'word']]);
 const quick=QUICK_LETTERS.flat().map(u=>u.toLowerCase()),lookalikes=QUICK_LETTERS[1].map(u=>u.toLowerCase());
 for(const seed of [1,2,3,7,42,99]){
  const items=recallStrip(seeded(seed)).sections[0].items;
  assert.equal(items.length,RECALL_LETTERS);
  assert.equal(new Set(items.map(i=>i.answer)).size,RECALL_LETTERS,'no letter twice');
  for(const item of items){assert.ok(quick.includes(item.answer),item.answer);assert.equal(item.prompt,sound(item.answer));}
  for(const l of lookalikes)assert.ok(items.some(i=>i.answer===l),`look-alike ${l} is always asked (seed ${seed})`);
 }
 // The two left out change from print to print.
 const leftOut=(seed:number)=>quick.filter(l=>!recallStrip(seeded(seed)).sections[0].items.some(i=>i.answer===l)).sort().join('');
 assert.ok(new Set([1,2,3,7,42,99].map(leftOut)).size>1);
 assert.deepEqual(strip.sections[1].items.map(item=>item.answer).sort(),READING_WORDS.map(w=>w.text).sort());
 // Words are prompted by their spelling, as written, not by how they sound.
 assert.deepEqual(strip.sections[1].items.map(item=>item.prompt).sort(),['chay  ·  tea','kofe  ·  coffee','poka  ·  Bye!','privet  ·  Hi!']);
 // Shuffled: the same random numbers give the same strip, different ones a different one.
 const order=(s:typeof strip)=>s.sections.map(x=>x.items.map(i=>i.answer).join('')).join('|');
 assert.equal(order(recallStrip(seeded(7))),order(strip));
 assert.notEqual(order(recallStrip(seeded(8))),order(strip));
 // Even an edge-case random (always 0, or just under 1) gives 20 letters and the 4 words.
 for(const edge of [()=>0,()=>0.9999999])assert.equal(recallStrip(edge).sections.flatMap(x=>x.items).length,RECALL_LETTERS+4);
});
