import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons} from './curriculum/catalog.ts';
import type {Exercise,LessonDefinition} from './curriculum/types.ts';

// Teaching-quality goals for lessons 3–8 (lessons 1–2 also carry the onboarding flow and stay as they are).
const norm=(text:string)=>' '+text.normalize('NFD').replace(/́/g,'').normalize('NFC').toLocaleLowerCase('ru').replace(/[^а-яё]+/gu,' ').trim()+' ';
// What a step actually makes the learner work with: wrong options do not count.
function practised(lesson:LessonDefinition,e:Exercise){
 const word=lesson.words.find(w=>w.id===e.wordId)?.text??'';
 return norm([word,e.answer,e.prompt,...(e.tokens??[]),...(e.pairs??[]).map(([ru])=>ru),e.exchange?.text??''].join(' '));
}
const isPractice=(e:Exercise)=>e.kind!=='vocabulary';
const later=nativeLessons.slice(2);

test('lessons 3–8 are 7–9 steps long and use at least four exercise kinds, including listening',()=>{
 for(const lesson of later){
  assert.ok(lesson.exercises.length>=7&&lesson.exercises.length<=9,`${lesson.id}: ${lesson.exercises.length} steps`);
  const kinds=new Set(lesson.exercises.map(e=>e.kind));
  assert.ok(kinds.size>=4,`${lesson.id}: ${[...kinds]}`);
  assert.ok(kinds.has('listen'),`${lesson.id}: no listening step`);
 }
});
test('every new word in lessons 3–8 is practised at least twice; a word repeated from an earlier lesson at least once',()=>{
 for(const [i,lesson] of nativeLessons.entries()){
  if(i<2)continue;
  const earlier=new Set(nativeLessons.slice(0,i).flatMap(l=>l.words.map(w=>norm(w.text))));
  for(const word of lesson.words){
   const uses=lesson.exercises.filter(e=>isPractice(e)&&practised(lesson,e).includes(norm(word.text))).length;
   const needed=earlier.has(norm(word.text))?1:2;
   assert.ok(uses>=needed,`${lesson.id}: ${word.text} practised ${uses}×, needs ${needed}`);
  }
 }
});
test('lessons 3–8 have at least two production steps (build or type)',()=>{
 for(const lesson of later)assert.ok(lesson.exercises.filter(e=>e.kind==='sentence'||e.kind==='typed').length>=2,lesson.id);
});
test('lessons 3–8 each practise at least one word from an earlier lesson',()=>{
 for(const [i,lesson] of nativeLessons.entries()){
  if(i<2)continue;
  const earlier=nativeLessons.slice(0,i).flatMap(l=>l.words.map(w=>norm(w.text)));
  const reused=earlier.filter(text=>lesson.exercises.some(e=>isPractice(e)&&practised(lesson,e).includes(text)));
  assert.ok(reused.length>=1,`${lesson.id}: no earlier word practised`);
 }
});
test('no two of lessons 3–8 share the same sequence of exercise kinds',()=>{
 const shapes=later.map(lesson=>lesson.exercises.map(e=>e.kind).join(' '));
 assert.equal(new Set(shapes).size,shapes.length,shapes.join('\n'));
});
