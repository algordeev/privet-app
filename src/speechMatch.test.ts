import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeSpeech,spokenWords} from './speechMatch.ts';
import {candidates} from './speechRecognition.ts';

test('spoken words ignore case, punctuation, hyphens, stress and ё', () => {
 assert.deepEqual(spokenWords('Кофе, пожа́луйста!'),['кофе','пожалуйста']);
 assert.deepEqual(spokenWords('Ёлка'),['елка']);
 assert.deepEqual(spokenWords('Как-то так…'),['как','то','так']);
 assert.deepEqual(spokenWords('  '),[]);
});

test('any recogniser alternative matching any accepted answer passes', () => {
 assert.deepEqual(gradeSpeech(['пасибо','спасибо'],['Спасибо!']),{type:'match',heard:'спасибо'});
 assert.deepEqual(gradeSpeech(['Привет'],['Здравствуйте','Привет!']),{type:'match',heard:'Привет'});
 assert.deepEqual(gradeSpeech(['кофе пожалуйста'],['Кофе, пожалуйста.']),{type:'match',heard:'кофе пожалуйста'});
});

test('nothing heard is silence, never a wrong answer', () => {
 assert.deepEqual(gradeSpeech([],['Спасибо']),{type:'silence'});
 assert.deepEqual(gradeSpeech(['',' '],['Спасибо']),{type:'silence'});
});

test('a single wrong word is wrong; a phrase with half its words is close', () => {
 assert.deepEqual(gradeSpeech(['пасибо'],['Спасибо!']),{type:'wrong',heard:'пасибо'});
 assert.deepEqual(gradeSpeech(['кофе пожалуй'],['Кофе, пожалуйста.']),{type:'close',heard:'кофе пожалуй',missing:['пожалуйста']});
 assert.deepEqual(gradeSpeech(['меня зовут'],['Меня зовут Алекс']),{type:'close',heard:'меня зовут',missing:['Алекс']});
 assert.deepEqual(gradeSpeech(['да'],['Меня зовут Алекс']),{type:'wrong',heard:'да'});
});

test('extra words around the answer are not a match', () => {
 assert.equal(gradeSpeech(['ну спасибо'],['Спасибо']).type,'wrong');
});

test('per-word alternatives become whole-answer candidates', () => {
 const list=candidates({alternatives:[{text:'кофе пожалуй',confidence:.4}],segments:[
  {text:'кофе',confidence:.9,alternatives:[]},{text:'пожалуй',confidence:.3,alternatives:['пожалуйста']}]});
 assert.deepEqual(list,['кофе пожалуй','кофе пожалуйста']);
 assert.equal(gradeSpeech(list,['Кофе, пожалуйста.']).type,'match');
});
