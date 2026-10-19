import test from 'node:test';
import assert from 'node:assert/strict';
import {CYRILLIC,QUICK_LETTERS,READING_WORDS,contextualLetters,referenceExample} from './cyrillic.ts';
import {cafeLesson,introductionsLesson} from './lessons.ts';

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
 for(const definition of [cafeLesson,introductionsLesson])for(const exercise of definition.exercises){
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
 for(const definition of [cafeLesson,introductionsLesson])for(const exercise of definition.exercises){
  const contextual=contextualLetters(definition,exercise);
  for(const item of [...contextual,...CYRILLIC]){
   const resolved=referenceExample(item,definition,exercise);
   const label=`${definition.id}/${exercise.id}/${item.upper}`;
   assert.equal(resolved.upper,item.upper,label);assert.equal(resolved.lower,item.lower,label);
   assert.ok(resolved.example&&resolved.meaning,label);
   assert.ok(normalize(resolved.example).includes(item.lower),label);
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
 assert.equal(referenceExample(entry('П'),introductionsLesson,introductionsLesson.exercises[4]).example,'Очень приятно!');
 const nice=referenceExample(entry('Ь'),introductionsLesson,introductionsLesson.exercises[3]);
 assert.equal(nice.example,'день');assert.equal(nice.meaning,'day');
 // Russian targets are normalized, while English-only answers are never compared
 // to Cyrillic examples as empty strings. Safe current-lesson examples win.
 assert.equal(referenceExample(entry('П'),introductionsLesson,{...introductionsLesson.exercises[4],answer:'  ПО́КА?! '}).example,'Очень приятно!');
 assert.equal(referenceExample(entry('Ф'),cafeLesson,{...cafeLesson.exercises[1],prompt:'Choose a drink',answer:'coffee'}),entry('Ф'));
});
test('an impossible single-letter target omits its example rather than falling back to a leaking one',()=>{
 const item=CYRILLIC.find(item=>item.upper==='Б')!;
 const resolved=referenceExample(item,cafeLesson,{...cafeLesson.exercises[4],answer:'б'});
 assert.equal(resolved.upper,'Б');assert.equal(resolved.example,'');
});
