import {initialProgress,type Progress} from './engine.ts';
import {cafeLesson,type LessonDefinition} from './lessons.ts';
import {PRODUCT} from './config.ts';

export type Preferences={stress:boolean;pronunciation:boolean};
export type Saved={preferences:Preferences;completion?:{results:boolean[];date:string}};
export const NATIVE_SESSION_KEY=`${PRODUCT.storageKey}-native-session`;
export const sessionKey=(definition:LessonDefinition=cafeLesson)=>definition.id===cafeLesson.id?NATIVE_SESSION_KEY:`${NATIVE_SESSION_KEY}-${definition.id}`;
export const savedKey=(definition:LessonDefinition=cafeLesson)=>definition.id===cafeLesson.id?PRODUCT.storageKey:`${PRODUCT.storageKey}-${definition.id}`;
export type LessonSnapshot={progress:Progress;selected:string;tokens:string[];revealed:string[];hintAt:number|null;vocabularyWord:string|null};
export function freshSession():LessonSnapshot {
 return {progress:initialProgress(),selected:'',tokens:[],revealed:[],hintAt:null,vocabularyWord:null};
}
// Only native mode restores an in-progress session. The browser demo keeps
// its existing start-fresh behavior and completion/preferences storage.
export function restoreSession(serialized:string|null,definition:LessonDefinition=cafeLesson):LessonSnapshot {
 const {exercises:lesson,words}=definition;
 const allowedTokens=lesson.flatMap(exercise=>exercise.tokens??[]);
 try {
  if(!serialized) return freshSession();
  const s=JSON.parse(serialized);
  const p=s.progress;
  if(!p||!Number.isInteger(p.index)||p.index<0||p.index>lesson.length||
   typeof p.complete!=='boolean'||p.complete!==(p.index===lesson.length)||
   !Number.isInteger(p.attempts)||p.attempts<0||
   ![null,'correct','incorrect'].includes(p.feedback)||
   (p.feedback!==null&&p.attempts===0)||
   (p.complete&&(p.feedback!==null||p.attempts!==0))||
   !Array.isArray(p.results)||p.results.length!==p.index||!p.results.every((r:unknown)=>typeof r==='boolean')||
   typeof s.selected!=='string'||s.selected.length>1000||
   !Array.isArray(s.tokens)||!s.tokens.every((t:unknown)=>typeof t==='string'&&allowedTokens.includes(t))||new Set(s.tokens).size!==s.tokens.length||
   !Array.isArray(s.revealed)||!s.revealed.every((id:unknown)=>words.some(w=>w.id===id))||new Set(s.revealed).size!==s.revealed.length||
   !(s.hintAt===null||(s.hintAt===p.index&&!p.complete))||
   !(s.vocabularyWord===null||words.some(w=>w.text===s.vocabularyWord))) return freshSession();
  return {progress:p,selected:s.selected,tokens:s.tokens,revealed:s.revealed,hintAt:s.hintAt,vocabularyWord:s.vocabularyWord};
 } catch {return freshSession();}
}
export function loadSession(enabled:boolean,definition:LessonDefinition=cafeLesson):LessonSnapshot {
 const lesson=definition.exercises;
 if(!enabled) return freshSession();
 try{
  const stored=localStorage.getItem(sessionKey(definition));
  if(stored)return restoreSession(stored,definition);
  const completion=readSaved(definition).completion;
  return completion?{...freshSession(),progress:{index:lesson.length,attempts:0,results:completion.results,feedback:null,complete:true}}:freshSession();
 }catch{return freshSession();}
}
export function readSaved(definition:LessonDefinition=cafeLesson):Saved {
 try {
  const data=JSON.parse(localStorage.getItem(savedKey(definition))||'{}');
  return {preferences:{stress:data.preferences?.stress===true,pronunciation:data.preferences?.pronunciation!==false},completion:Array.isArray(data.completion?.results)&&data.completion.results.length===definition.exercises.length&&data.completion.results.every((v:unknown)=>typeof v==='boolean')?data.completion:undefined};
 }catch{return {preferences:{stress:false,pronunciation:true}};}
}
