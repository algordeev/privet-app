import {appStorage} from './previewStorage.ts';
import {validSentenceTokens} from './sentenceOrder.ts';
import {initialProgress,MAX_HEARTS,type Progress} from './engine.ts';
import {cafeLesson,type LessonDefinition} from './lessons.ts';
import {PRODUCT} from './config.ts';

export type Preferences={stress:boolean;pronunciation:boolean};
export type Saved={preferences:Preferences;bestFirstTry?:number;completion?:{results:boolean[];date:string;hearts:number;bestCombo:number}};
// completion is the latest finished attempt; bestFirstTry is a separate high score.
export function recordLessonCompletion(saved:Saved,completion:NonNullable<Saved['completion']>):Saved{
 const previous=saved.completion?.results.filter(Boolean).length??0;
 return {...saved,completion,bestFirstTry:Math.max(saved.bestFirstTry??0,previous,completion.results.filter(Boolean).length)};
}
// A practice attempt can restart without undoing a previously earned completion.
export function lessonPassed(progress:Pick<Progress,'complete'>,saved:Saved){return progress.complete||!!saved.completion;}
// Version of a lesson's saved results and of its saved attempt. When their shape changes, raise it and
// convert older data in readSaved/restoreSession (never drop it: see storageCompat.test.ts).
// Data written before versions existed has none and reads as version 1.
export const LESSON_DATA_VERSION=1;
const knownVersion=(version:unknown)=>version===undefined||version===LESSON_DATA_VERSION;
export const NATIVE_SESSION_KEY=`${PRODUCT.storageKey}-native-session`;
export const sessionKey=(definition:LessonDefinition=cafeLesson)=>definition.id===cafeLesson.id?NATIVE_SESSION_KEY:`${NATIVE_SESSION_KEY}-${definition.id}`;
export const savedKey=(definition:LessonDefinition=cafeLesson)=>definition.id===cafeLesson.id?PRODUCT.storageKey:`${PRODUCT.storageKey}-${definition.id}`;
// matches: Russian sides of correctly matched pairs in the current match exercise.
export type LessonSnapshot={progress:Progress;selected:string;tokens:string[];matches:string[];revealed:string[];hintAt:number|null;vocabularyWord:string|null};
export function freshSession():LessonSnapshot {
 return {progress:initialProgress(),selected:'',tokens:[],matches:[],revealed:[],hintAt:null,vocabularyWord:null};
}
const isWholeNumberIn=(value:unknown,min:number,max:number):value is number=>Number.isInteger(value)&&(value as number)>=min&&(value as number)<=max;

// Every rule a saved attempt on a lesson of `steps` steps must follow; anything else starts the lesson fresh.
function validProgress(p:any,steps:number):p is Progress{
 if(!p||typeof p!=='object')return false;
 const position=isWholeNumberIn(p.index,0,steps)&&typeof p.complete==='boolean'&&p.complete===(p.index===steps)
  &&Array.isArray(p.results)&&p.results.length===p.index&&p.results.every((r:unknown)=>typeof r==='boolean');
 const answer=isWholeNumberIn(p.attempts,0,Infinity)&&[null,'correct','incorrect'].includes(p.feedback)&&(p.feedback===null||p.attempts>0);
 const hearts=isWholeNumberIn(p.hearts,0,MAX_HEARTS)&&typeof p.failed==='boolean'&&p.failed===(p.hearts===0);
 const run=isWholeNumberIn(p.combo,0,steps)&&isWholeNumberIn(p.bestCombo,p.combo,steps);
 // A finished attempt has nothing pending; a failed one is mid-lesson, showing its wrong answer.
 const finished=!p.complete||(p.feedback===null&&p.attempts===0&&!p.failed);
 const failed=!p.failed||(!p.complete&&p.feedback==='incorrect');
 return position&&answer&&hearts&&run&&finished&&failed;
}

// A finished lesson rebuilt from its completion record.
function finishedProgress({results,hearts,bestCombo}:NonNullable<Saved['completion']>,steps:number):Progress{
 return {...initialProgress(),index:steps,results,complete:true,hearts,bestCombo};
}

// Only native mode restores an in-progress session. The browser demo keeps
// its existing start-fresh behavior and completion/preferences storage.
export function restoreSession(serialized:string|null,definition:LessonDefinition=cafeLesson):LessonSnapshot {
 const {exercises:lesson,words}=definition;
 const allowedTokens=lesson.flatMap(exercise=>exercise.tokens??[]);
 const pairsAt=(index:number)=>lesson[index]?.pairs??[];
 try {
  if(!serialized) return freshSession();
  const s=JSON.parse(serialized);
  if(!knownVersion(s?.version))return freshSession();
  const matches=s.matches??[];
  const p=s.progress;
  if(!validProgress(p,lesson.length)||
   typeof s.selected!=='string'||s.selected.length>1000||
   !validSentenceTokens(s.tokens,allowedTokens)||
   !Array.isArray(matches)||new Set(matches).size!==matches.length||!matches.every((ru:unknown)=>pairsAt(p.index).some(([text])=>text===ru))||
   !Array.isArray(s.revealed)||!s.revealed.every((id:unknown)=>words.some(w=>w.id===id))||new Set(s.revealed).size!==s.revealed.length||
   !(s.hintAt===null||(s.hintAt===p.index&&!p.complete))||
   !(s.vocabularyWord===null||words.some(w=>w.text===s.vocabularyWord))) return freshSession();
  return {progress:p,selected:s.selected,tokens:s.tokens,matches,revealed:s.revealed,hintAt:s.hintAt,vocabularyWord:s.vocabularyWord};
 } catch {return freshSession();}
}
export function loadSession(enabled:boolean,definition:LessonDefinition=cafeLesson):LessonSnapshot {
 const lesson=definition.exercises;
 if(!enabled) return freshSession();
 try{
  const stored=appStorage.getItem(sessionKey(definition));
  if(stored)return restoreSession(stored,definition);
  const completion=readSaved(definition).completion;
  return completion?{...freshSession(),progress:finishedProgress(completion,lesson.length)}:freshSession();
 }catch{return freshSession();}
}
export function readSaved(definition:LessonDefinition=cafeLesson):Saved {
 try{return parseSaved(appStorage.getItem(savedKey(definition)),definition);}catch{return {preferences:{stress:false,pronunciation:true}};}
}
// A lesson's saved results as stored; anything missing or damaged falls back to "not passed yet".
export function parseSaved(raw:string|null,definition:LessonDefinition=cafeLesson):Saved {
 try {
  const data=JSON.parse(raw||'{}');
  if(!knownVersion(data?.version))return {preferences:{stress:false,pronunciation:true}};
  const {completion}=data,steps=definition.exercises.length;
  const validCompletion=Array.isArray(completion?.results)&&completion.results.length===steps&&completion.results.every((v:unknown)=>typeof v==='boolean')
   &&typeof completion.date==='string'&&isWholeNumberIn(completion.hearts,0,MAX_HEARTS)&&isWholeNumberIn(completion.bestCombo,0,steps);
  return {preferences:{stress:data.preferences?.stress===true,pronunciation:data.preferences?.pronunciation!==false},completion:validCompletion?completion:undefined,...(validCompletion?{bestFirstTry:Math.max(completion.results.filter(Boolean).length,Number.isInteger(data.bestFirstTry)&&data.bestFirstTry>=0&&data.bestFirstTry<=definition.exercises.length?data.bestFirstTry:0)}:{})};
 }catch{return {preferences:{stress:false,pronunciation:true}};}
}
