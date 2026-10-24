import test from 'node:test';
import assert from 'node:assert/strict';
import {russianReading} from './pronunciation.ts';
import {CYRILLIC,READING_WORDS,referenceExample} from './cyrillic.ts';
import {nativeLessons,cafeLesson} from './lessons.ts';
import {firstRunLesson} from './firstRunLesson.ts';

test('every alphabet example and quick-start reading word has a Latin whole-word sound guide',()=>{
 for(const text of [...CYRILLIC.map(item=>item.example),...READING_WORDS.map(item=>item.text)]){
  const guide=russianReading(text);assert.ok(guide,text);assert.doesNotMatch(guide,/[а-яё]/iu);assert.match(guide,/[a-z]/iu);
 }
 assert.equal(russianReading('Анна'),'AN-na');assert.equal(russianReading('подъезд'),'pad-YEST');assert.equal(russianReading('ёж'),'yosh');
});
test('all answer-safe alphabet substitutions resolve readings from the substituted example',()=>{
 for(const definition of [...nativeLessons,firstRunLesson])for(const exercise of definition.exercises)for(const letter of CYRILLIC){
  const safe=referenceExample(letter,definition,exercise);
  assert.ok(russianReading(safe.example,definition.words),`${definition.id}/${exercise.id}/${letter.upper}: ${safe.example}`);
 }
 const typed=cafeLesson.exercises.find(exercise=>exercise.kind==='typed')!;
 const safe=referenceExample(CYRILLIC.find(item=>item.upper==='Б')!,cafeLesson,typed);
 assert.equal(safe.example,'банк');assert.equal(russianReading(safe.example,cafeLesson.words),'bank');assert.notEqual(russianReading(safe.example),russianReading(typed.answer));
});
test('every Russian choice and dialogue across all eight lessons and the welcome class has a reading, but English options do not',()=>{
 for(const definition of [...nativeLessons,firstRunLesson])for(const exercise of definition.exercises){
  if(exercise.exchange)assert.ok(russianReading(exercise.exchange.text,definition.words),`${definition.id}: ${exercise.exchange.text}`);
  for(const choice of exercise.choices??[]){
   if(/[а-яё]/iu.test(choice))assert.ok(russianReading(choice,definition.words),`${definition.id}: ${choice}`);
   else assert.equal(russianReading(choice,definition.words),undefined);
  }
 }
 assert.equal(russianReading('Ваш чай.'),'vash chai');assert.equal(russianReading('Спасибо!'),'spa-SEE-ba');
});
test('reading lookup preserves existing vocabulary guides and handles stress, case and punctuation safely',()=>{
 for(const definition of [...nativeLessons,firstRunLesson])for(const word of definition.words){
  assert.equal(russianReading(word.text,definition.words),word.pronunciation);
  assert.equal(russianReading(word.stressed.toUpperCase(),definition.words),word.pronunciation);
 }
 assert.equal(russianReading('  ВАШ ЧА́Й?! '),'vash chai');
 assert.equal(russianReading('a future unknown Russian word: незнакомое'),undefined);
 assert.equal(russianReading(''),undefined);assert.equal(russianReading('coffee'),undefined);
 assert.equal(russianReading('ъ'),undefined);assert.equal(russianReading('ь'),undefined);
});
