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
test('quick start stays focused and reference examples avoid printing assessed targets where alternatives exist',()=>{
 assert.deepEqual(QUICK_LETTERS[1],['В','Н','Р','С','У','Х']);assert.equal(QUICK_LETTERS.length,3);assert.equal(READING_WORDS.length,4);
 const letter=CYRILLIC.find(item=>item.upper==='П')!;
 assert.notEqual(referenceExample(letter,introductionsLesson,introductionsLesson.exercises[4]).example,'Пока!');
 assert.equal(referenceExample(letter,cafeLesson,cafeLesson.exercises[0]),letter);
 assert.equal(referenceExample(CYRILLIC.find(item=>item.upper==='Ф')!,cafeLesson,cafeLesson.exercises[1]).example,'фото');
});
