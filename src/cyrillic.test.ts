import test from 'node:test';
import assert from 'node:assert/strict';
import {CYRILLIC,QUICK_LETTERS,READING_WORDS,contextualLetters,referenceExample,targetLetterParts,letterAudioText} from './cyrillic.ts';
import {cafeLesson,introductionsLesson,nativeLessons} from './lessons.ts';

test('all 33 Russian letters have unique correct forms, rough sounds and matching examples',()=>{
 assert.equal(CYRILLIC.map(item=>item.upper).join(''),'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ');
 assert.equal(new Set(CYRILLIC.map(item=>item.lower)).size,33);
 for(const item of CYRILLIC){assert.match(item.upper,/^[А-ЯЁ]$/u);assert.equal(item.lower,item.upper.toLowerCase());assert.ok(item.sound&&item.meaning);assert.ok(item.example.toLowerCase().includes(item.lower),item.upper);}
 assert.match(CYRILLIC.find(item=>item.upper==='Ё')!.note!,/different from Е/);
 for(const sign of ['Ь','Ъ'])assert.match(CYRILLIC.find(item=>item.upper===sign)!.note!,/No sound of its own/);
});
test('context letters use visible material, deduplicate and follow alphabet order rather than answer order',()=>{
 assert.equal(contextualLetters(cafeLesson,cafeLesson.exercises[1]).map(item=>item.upper).join(''),'ЕКОФ');
 assert.equal(contextualLetters(cafeLesson,cafeLesson.exercises[2]).map(item=>item.upper).join(''),'АЙОУХЧЯ');
 assert.equal(contextualLetters(introductionsLesson,introductionsLesson.exercises[4]).map(item=>item.upper).join(''),'АКОП');
 for(const definition of nativeLessons)for(const exercise of definition.exercises){
  const items=contextualLetters(definition,exercise);assert.ok(items.length>0);assert.equal(new Set(items).size,items.length);
  assert.deepEqual(items,CYRILLIC.filter(item=>items.includes(item)));
 }
});
test('quick start stays focused and reference examples avoid printing assessed targets',()=>{
 assert.deepEqual(QUICK_LETTERS[1],['В','Н','Р','С','У','Х']);assert.equal(QUICK_LETTERS.length,3);assert.equal(READING_WORDS.length,4);
 const letter=CYRILLIC.find(item=>item.upper==='П')!;
 assert.notEqual(referenceExample(letter,introductionsLesson,introductionsLesson.exercises[4]).example,'Пока!');
 assert.equal(referenceExample(letter,cafeLesson,cafeLesson.exercises[0]),letter);
 assert.equal(referenceExample(CYRILLIC.find(item=>item.upper==='Ф')!,cafeLesson,cafeLesson.exercises[1]).example,'фото');
});

test('every exercise resolves every contextual and full-reference letter without exposing a Russian assessed answer',()=>{
 const normalize=(text:string)=>text.normalize('NFD').replace(/\u0301/g,'').normalize('NFC').toLowerCase().replace(/[^а-яё]/g,'');
 for(const definition of nativeLessons)for(const exercise of definition.exercises){
  const contextual=contextualLetters(definition,exercise);
  for(const item of [...contextual,...CYRILLIC]){
   const resolved=referenceExample(item,definition,exercise);
   const label=`${definition.id}/${exercise.id}/${item.upper}`;
   assert.equal(resolved.upper,item.upper,label);assert.equal(resolved.lower,item.lower,label);
   assert.ok(resolved.example&&resolved.meaning,label);
   assert.ok(normalize(resolved.example).includes(item.lower),label);
   if(!['Ъ','Ы','Ь'].includes(item.upper))assert.ok(normalize(resolved.example).startsWith(item.lower),label);
   if(/[а-яё]/iu.test(exercise.answer))assert.ok(!normalize(resolved.example).includes(normalize(exercise.answer)),`${label}: ${resolved.example}`);
  }
  assert.deepEqual(contextual.map(item=>referenceExample(item,definition,exercise).upper),contextual.map(item=>item.upper),'No contextual letters are removed');
 }
});
test('typed thanks, typed goodbye and Russian choice answers use safe whole-word examples',()=>{
 const entry=(upper:string)=>CYRILLIC.find(item=>item.upper===upper)!;
 assert.equal(entry('А').example,'Анна');assert.equal(entry('А').meaning,'Anna');
 const thanks=referenceExample(entry('Б'),cafeLesson,cafeLesson.exercises[4]);
 assert.equal(thanks.example,'банк');assert.equal(thanks.meaning,'bank');
 assert.equal(referenceExample(entry('Б'),cafeLesson,cafeLesson.exercises[3]).example,'банк');
 assert.equal(referenceExample(entry('П'),introductionsLesson,introductionsLesson.exercises[4]).example,'привет');
 const nice=referenceExample(entry('Ь'),introductionsLesson,introductionsLesson.exercises[3]);
 assert.equal(nice.example,'день');assert.equal(nice.meaning,'day');
 // Russian targets are normalized, while English-only answers are never compared
 // to Cyrillic examples as empty strings. Safe current-lesson examples win.
 assert.equal(referenceExample({...entry('П'),example:'Пока!'},introductionsLesson,{...introductionsLesson.exercises[4],answer:'  ПО́КА?! '}).example,'парк');
 const withSafeLessonWord={...introductionsLesson,words:[...introductionsLesson.words,{id:'tomato',text:'помидор',stressed:'помидо́р',pronunciation:'pa-mee-DOR',meaning:'tomato'}]};
 assert.equal(referenceExample({...entry('П'),example:'Пока!'},withSafeLessonWord,introductionsLesson.exercises[4]).example,'помидор','A safe starting-letter lesson example wins over neutral vocabulary');
 assert.equal(referenceExample(entry('Ф'),cafeLesson,{...cafeLesson.exercises[1],prompt:'Choose a drink',answer:'coffee'}),entry('Ф'));
});
test('an impossible single-letter target omits its example rather than falling back to a leaking one',()=>{
 const item=CYRILLIC.find(item=>item.upper==='Б')!;
 const resolved=referenceExample(item,cafeLesson,{...cafeLesson.exercises[4],answer:'б'});
 assert.equal(resolved.upper,'Б');assert.equal(resolved.example,'');
});


test('beginner examples match the requested words and begin with their letter except the three internal examples',()=>{
 const mapping=[
  ['А','Анна','Anna'],['Б','банк','bank'],['В','Ваш','your'],['Г','город','city'],['Д','дом','home'],
  ['Е','еда','food'],['Ё','ёж','hedgehog'],['Ж','журнал','magazine'],['З','зовут','called'],['И','имя','name'],
  ['Й','йогурт','yogurt'],['К','кофе','coffee'],['Л','лимон','lemon'],['М','меня','me'],['Н','нет','no'],
  ['О','он','he'],['П','привет','hi'],['Р','Россия','Russia'],['С','спасибо','thank you'],['Т','ты','you, informal'],
  ['У','утро','morning'],['Ф','фото','photo'],['Х','хочу','I want'],['Ц','центр','centre'],['Ч','чай','tea'],
  ['Ш','школа','school'],['Щ','щётка','brush'],['Ъ','подъезд','building entrance'],['Ы','сыр','cheese'],['Ь','день','day'],
  ['Э','это','this'],['Ю','юг','south'],['Я','я','I'],
 ];
 assert.deepEqual(CYRILLIC.map(({upper,example,meaning})=>[upper,example,meaning]),mapping);
 for(const item of CYRILLIC){
  const normalized=item.example.normalize('NFC').toLowerCase();
  if(['Ъ','Ы','Ь'].includes(item.upper)){
   assert.ok(normalized.indexOf(item.lower)>0,item.upper);assert.match(item.note!,/Normally not used at the start/);
  }else assert.ok(normalized.startsWith(item.lower),item.upper);
 }
 for(const upper of ['Е','Ё','Ю','Я'])assert.match(CYRILLIC.find(item=>item.upper===upper)!.note!,/consonant.*softness/);
 assert.equal(CYRILLIC.find(item=>item.upper==='Е')!.sound,'ye / e');
});
test('highlight parts select the target grapheme without changing the complete word',()=>{
 for(const item of CYRILLIC){
  const parts=targetLetterParts(item.example,item.lower);
  assert.equal(parts.before+parts.target+parts.after,item.example);
  assert.equal(parts.target.toLowerCase(),item.lower,item.upper);
  if(!['Ъ','Ы','Ь'].includes(item.upper))assert.equal(parts.before,'',item.upper);
 }
 for(const [example,target,highlight] of [['подъезд','ъ','ъ'],['сыр','ы','ы'],['день','ь','ь'],['Приве́т','е','е́'],['ёж','ё','ё']]){
  const parts=targetLetterParts(example,target);assert.equal(parts.target,highlight);assert.equal(parts.before+parts.target+parts.after,example);
 }
 assert.deepEqual(targetLetterParts('','б'),{before:'',target:'',after:''});
});
test('any future assessment matching a default example still cannot leak that answer',()=>{
 const normalize=(text:string)=>text.normalize('NFD').replace(/\u0301/g,'').normalize('NFC').toLowerCase().replace(/[^а-яё]/g,'');
 for(const item of CYRILLIC){
  const exercise={...cafeLesson.exercises[4],answer:item.example,prompt:item.example};
  const resolved=referenceExample(item,cafeLesson,exercise);
  assert.equal(resolved.upper,item.upper);
  assert.ok(!normalize(resolved.example).includes(normalize(exercise.answer)),item.upper);
  if(item.upper==='Я')assert.equal(resolved.example,'','No safe Russian word containing я can conceal a one-letter answer я');
  else {
   assert.ok(resolved.example,item.upper);
   if(!['Ъ','Ы','Ь'].includes(item.upper))assert.ok(normalize(resolved.example).startsWith(item.lower),item.upper);
   const parts=targetLetterParts(resolved.example,item.lower);assert.ok(parts.target,item.upper);
  }
 }
});

test('letter audio uses Russian letter text, never an English sound guide or a silent sign',()=>{
 for(const item of CYRILLIC){
  if(['Ъ','Ь'].includes(item.upper))assert.equal(letterAudioText(item),null);
  else {assert.equal(letterAudioText(item),item.lower);assert.match(letterAudioText(item)!,/^[а-яё]$/u);}
 }
});
