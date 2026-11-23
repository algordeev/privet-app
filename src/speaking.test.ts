import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons,cafeLesson,websiteCafeLesson} from './curriculum/catalog.ts';
import {checkAnswer,initialProgress,progressReducer} from './engine.ts';
import {LESSON_DATA_VERSION,parseSaved,restoreSession,speakingUpgrade} from './session.ts';
import {gradeSpeech,speakOutcome} from './speechMatch.ts';
import {hearsReply,modelLine,presentExercise} from './speakSteps.ts';
import {PAUSE_MS,defaultSpeaking,pauseSpeaking,restoreSpeaking,savedSpeaking,speakingAvailability} from './speakingSettings.ts';
import {buildReviewSession,emptyReview,restoreReview,reviewFormat,reviewSources} from './review.ts';
import {companionDisplay} from './companionDisplay.ts';
import type {SpeechSupport} from './speechRecognition.ts';

const step=(lessonId:string,id:string)=>{const lesson=nativeLessons.find(l=>l.id===lessonId)!;return {lesson,index:lesson.exercises.findIndex(e=>e.id===id),exercise:lesson.exercises.find(e=>e.id===id)!};};

test('every lesson has a Repeat right after discovery and a Reply right after its dialogue step',()=>{
 for(const lesson of nativeLessons){
  const ids=lesson.exercises.map(e=>e.id);
  assert.equal(ids[1],'say',lesson.id);
  assert.equal(ids[ids.indexOf('exchange')+1],'reply',lesson.id);
  assert.equal(lesson.exercises.filter(e=>e.kind==='speak').length,2,lesson.id);
  const reply=lesson.exercises[ids.indexOf('reply')],dialogue=lesson.exercises[ids.indexOf('exchange')];
  assert.deepEqual(reply.exchange,dialogue.exchange);assert.equal(reply.answer,dialogue.answer);
 }
 assert.equal(websiteCafeLesson.exercises.some(e=>e.kind==='speak'),false,'the website preview keeps the original lesson');
});

test('spoken answers are graded on the words alone',()=>{
 const {lesson,index}=step('shopping','reply');
 for(const said of ['да спасибо','Да, спасибо.','ДА СПАСИБО!'])assert.equal(checkAnswer(index,said,lesson.exercises),true,said);
 for(const said of ['спасибо','да','','нет спасибо'])assert.equal(checkAnswer(index,said,lesson.exercises),false,said);
});

test('Almost earns one free second try; a second miss counts as a mistake',()=>{
 const close=gradeSpeech(['сколько'],['Сколько стоит?']);
 assert.equal(close.type,'close');
 assert.equal(speakOutcome(close,false),'almost');
 assert.equal(speakOutcome(close,true),'fail');
 assert.equal(speakOutcome(gradeSpeech(['столько'],['Привет!']),false),'fail');
 assert.equal(speakOutcome(gradeSpeech([],['Привет!']),true),'silence');
 assert.equal(speakOutcome(gradeSpeech(['привет'],['Привет!']),true),'pass');
 // Right after a free Almost is still right first time: nothing reached the lesson before it.
 const {lesson,index}=step('cafe','say');
 let p={...initialProgress(),index,results:Array(index).fill(true)};
 p=progressReducer(p,{type:'check',value:'Привет!'},lesson.exercises);
 p=progressReducer(p,{type:'continue'},lesson.exercises);
 assert.equal(p.results[index],true);assert.equal(p.hearts,3);
});

test('quiet versions: a listening or meaning choice for a Repeat, Hear it for a Reply',()=>{
 const repeat=step('cafe','say').exercise,reply=step('cafe','reply').exercise;
 assert.equal(presentExercise(repeat,true),repeat);
 assert.equal(presentExercise(repeat,false).kind,'listen');
 assert.equal(presentExercise(repeat,false).answer,repeat.answer);
 // Lessons 5 and 7 listen to their Repeat phrase two steps later, so quietly they ask for its meaning.
 for(const id of ['daily-life','studies']){
  const {lesson,index,exercise}=step(id,'say'),quiet=presentExercise(exercise,false);
  assert.equal(quiet.kind,'choice');assert.equal(quiet.answer,exercise.translation);
  assert.equal(checkAnswer(index,exercise.translation!,lesson.exercises),true,id);
  for(const wrong of exercise.choices!.filter(c=>c!==exercise.translation))assert.equal(checkAnswer(index,wrong,lesson.exercises),false,wrong);
 }
 assert.equal(hearsReply(reply,false),true);assert.equal(hearsReply(reply,true),false);assert.equal(hearsReply(repeat,false),false);
 assert.equal(presentExercise(reply,false).title,'Hear it out loud.');
 assert.match(presentExercise(reply,true).instruction,/Say your reply out loud\.$/);
 assert.equal(modelLine(repeat),'Привет!');assert.equal(modelLine(reply),'Ваш чай.');
});

test('version 1 progress moves onto the lesson with speaking steps',()=>{
 const up=speakingUpgrade(cafeLesson);
 assert.equal(up.oldLength,5);
 // discover, SAY, meaning, sentence, exchange, REPLY, type
 assert.deepEqual([0,1,2,3,4,5].map(up.index),[0,2,3,4,6,7]);
 assert.deepEqual(up.results([true,false,true]),[true,true,false,true]);
 assert.deepEqual(up.results([true,false,true,true,false]),[true,true,false,true,true,true,false]);
 const old={version:1,progress:{...initialProgress(),index:3,results:[true,false,true],combo:1,bestCombo:1},selected:'',tokens:[],matches:[],revealed:[],hintAt:3,vocabularyWord:null};
 const restored=restoreSession(JSON.stringify(old),cafeLesson);
 assert.equal(restored.progress.index,4);assert.equal(cafeLesson.exercises[4].id,'exchange');
 assert.deepEqual(restored.progress.results,[true,true,false,true]);assert.equal(restored.hintAt,4);
 // Current data is read as it is.
 const current={...old,version:LESSON_DATA_VERSION,progress:{...old.progress,index:4,results:[true,true,false,true]},hintAt:4};
 const {version:_,...unversioned}=current;
 assert.deepEqual(restoreSession(JSON.stringify(current),cafeLesson),unversioned);
 const saved=parseSaved(JSON.stringify({version:1,preferences:{stress:false,pronunciation:true},completion:{results:[true,false,true,true,true],date:'2026-11-01',hearts:2,bestCombo:3}}),cafeLesson);
 assert.deepEqual(saved.completion?.results,[true,true,false,true,true,true,true]);
});

const support=(patch:Partial<SpeechSupport>={}):SpeechSupport=>({speech:'granted',microphone:'granted',recognizer:true,available:true,onDevice:true,...patch});
test('speaking is spoken only where this iPhone can listen on-device, and not while off, paused or refused',()=>{
 const now=1_000_000,on=defaultSpeaking();
 assert.deepEqual(speakingAvailability(on,support(),now),{spoken:true,reason:null,needsPermission:false});
 assert.equal(speakingAvailability(on,support({microphone:'prompt'}),now).needsPermission,true);
 assert.equal(speakingAvailability(on,null,now).reason,'unsupported');
 assert.equal(speakingAvailability(on,support({onDevice:false}),now).reason,'unsupported');
 assert.equal(speakingAvailability({...on,enabled:false},support(),now).reason,'off');
 assert.equal(speakingAvailability(on,support({speech:'denied'}),now).reason,'denied');
 const paused=pauseSpeaking(on,now);
 assert.equal(speakingAvailability(paused,support(),now+PAUSE_MS-1).reason,'paused');
 assert.equal(speakingAvailability(paused,support(),now+PAUSE_MS).spoken,true);
 // The pause belongs to this run of the app: it is never saved, and an old saved one is ignored.
 assert.deepEqual(JSON.parse(savedSpeaking(paused)),{version:1,enabled:true});
 assert.deepEqual(restoreSpeaking(JSON.stringify(paused)),on);
 assert.deepEqual(restoreSpeaking(savedSpeaking({...on,enabled:false})),{...on,enabled:false});
 for(const raw of [null,'nope','{}',JSON.stringify({version:2,enabled:false})])assert.deepEqual(restoreSpeaking(raw),defaultSpeaking());
});

test('review says words aloud in their third round when speaking is available, and keeps speaking results',()=>{
 const word=reviewSources().find(s=>s.word)!,reply=reviewSources().find(s=>s.key==='cafe/e/reply')!;
 assert.equal(reviewFormat(word,2,true),'speak');
 assert.equal(reviewFormat(word,2,false),'recall');
 assert.ok(reviewSources().some(s=>s.key==='cafe/e/reply'),'each Reply is its own review item');
 const state={...emptyReview(),items:{[word.key]:{box:2,due:'2026-11-01',lapses:0,reviews:2}}};
 const spoken=buildReviewSession(state,'2026-11-23',10,true)!;
 const e=spoken.definition.exercises[0];
 assert.equal(e.kind,'speak');assert.equal(e.answer,word.word!.text);assert.ok(e.choices?.includes(e.answer));
 assert.equal(buildReviewSession(state,'2026-11-23',10,false)!.definition.exercises[0].kind,'choice');
 // A due Reply waits for a session with speaking; it never turns into a free "Hear it" in review.
 const due={...emptyReview(),items:{[reply.key]:{box:0,due:'2026-11-01',lapses:0,reviews:0}}};
 assert.equal(buildReviewSession(due,'2026-11-23',10,false),null);
 assert.equal(buildReviewSession(due,'2026-11-23',10,true)!.items[0].key,reply.key);
 const withLog={...state,log:[{key:word.key,day:'2026-11-23',correct:true,format:'speak'}]};
 assert.equal(restoreReview(JSON.stringify(withLog)).log.length,1);
});

test('the robot never shows a speaking answer before it is graded',()=>{
 for(const lesson of nativeLessons)for(const [index,e] of lesson.exercises.entries()){
  if(e.kind!=='speak')continue;
  const card=companionDisplay(lesson,{...initialProgress(),index});
  const shown=`${card?.primary??''} ${card?.secondary??''}`.toLocaleLowerCase('ru');
  assert.ok(!shown.includes(e.answer.toLocaleLowerCase('ru').replace(/[.!?]+$/,'')),`${lesson.id}/${e.id}: ${shown}`);
 }
});
