import test from 'node:test';
import assert from 'node:assert/strict';
import {answerLetters,boxes,givenLetters,letterSound} from './typingHelp.ts';
import {lesson as cafe} from './curriculum/lessons/cafe.ts';

test('every letter button in the course has a short sound', () => {
 for(const letter of 'спаибокмярйзеутвхлд')assert.ok(letterSound(letter).length>0&&letterSound(letter).length<=3,`${letter} → "${letterSound(letter)}"`);
 assert.equal(letterSound('с'),'s');assert.equal(letterSound('и'),'ee');assert.equal(letterSound('х'),'h');assert.equal(letterSound('у'),'u');assert.equal(letterSound('Й'),'y');
});

test('a typed answer shows one box per letter, capitals and punctuation aside', () => {
 assert.deepEqual(answerLetters('Спасибо!'),['с','п','а','с','и','б','о']);
 assert.deepEqual(boxes('спасибо','спа'),['С','п','а','','','','']);
 assert.equal(givenLetters('спасибо',1),'с');
 assert.equal(givenLetters('пока'),'');
});

test('Lesson 1 gives the first letter of Спасибо, and its hint teaches the two traps', () => {
 const typed=cafe.find(e=>e.kind==='typed')!;
 assert.equal(typed.given,1);
 assert.match(typed.hint!,/с comes twice/);
 assert.match(typed.hint!,/sounds like “a”/);
});
