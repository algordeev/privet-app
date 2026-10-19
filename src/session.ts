import {validSentenceTokens} from './sentenceOrder.ts';
import {initialProgress,MAX_HEARTS,type Progress} from './engine.ts';
import {cafeLesson,type LessonDefinition} from './lessons.ts';
import {PRODUCT} from './config.ts';

export type Preferences={stress:boolean;pronunciation:boolean};
export type Saved={preferences:Preferences;completion?:{results:boolean[];date:string;hearts?:number;bestCombo?:number}};
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
  const raw=s.progress;
  const p=raw&&typeof raw==='object'?{...raw,hearts:Object.hasOwn(raw,'hearts')?raw.hearts:MAX_HEARTS,combo:Object.hasOwn(raw,'combo')?raw.combo:0,bestCombo:Object.hasOwn(raw,'bestCombo')?raw.bestCombo:0,failed:Object.hasOwn(raw,'failed')?raw.failed:false}:raw;
  if(!p||!Number.isInteger(p.index)||p.index<0||p.index>lesson.length||
   typeof p.complete!=='boolean'||p.complete!==(p.index===lesson.length)||
   !Number.isInteger(p.hearts)||p.hearts<0||p.hearts>MAX_HEARTS||!Number.isInteger(p.combo)||p.combo<0||p.combo>lesson.length||!Number.isInteger(p.bestCombo)||p.bestCombo<p.combo||p.bestCombo>lesson.length||typeof p.failed!=='boolean'||p.failed!==(p.hearts===0)||
   !Number.isInteger(p.attempts)||p.attempts<0||
   ![null,'correct','incorrect'].includes(p.feedback)||
   (p.feedback!==null&&p.attempts===0)||
   (p.complete&&(p.feedback!==null||p.attempts!==0||p.failed))||
   (p.failed&&(p.complete||p.feedback!=='incorrect'))||
   !Array.isArray(p.results)||p.results.length!==p.index||!p.results.every((r:unknown)=>typeof r==='boolean')||
   typeof s.selected!=='string'||s.selected.length>1000||
   !validSentenceTokens(s.tokens,allowedTokens)||
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
  if(!completion)return freshSession();
  const hearts=completion.hearts,bestCombo=completion.bestCombo;
  return {...freshSession(),progress:{...freshSession().progress,index:lesson.length,attempts:0,results:completion.results,feedback:null,complete:true,hearts:hearts!==undefined&&Number.isInteger(hearts)&&hearts>=0&&hearts<=MAX_HEARTS?hearts:MAX_HEARTS,bestCombo:bestCombo!==undefined&&Number.isInteger(bestCombo)&&bestCombo>=0&&bestCombo<=lesson.length?bestCombo:0,combo:0}};
 }catch{return freshSession();}
}
export function readSaved(definition:LessonDefinition=cafeLesson):Saved {
 try {
  const data=JSON.parse(localStorage.getItem(savedKey(definition))||'{}');
  const completion=data.completion;
  const validCompletion=Array.isArray(completion?.results)&&completion.results.length===definition.exercises.length&&completion.results.every((v:unknown)=>typeof v==='boolean')&&typeof completion.date==='string'&&
   (completion.hearts===undefined||Number.isInteger(completion.hearts)&&completion.hearts>=0&&completion.hearts<=MAX_HEARTS)&&
   (completion.bestCombo===undefined||Number.isInteger(completion.bestCombo)&&completion.bestCombo>=0&&completion.bestCombo<=definition.exercises.length);
  return {preferences:{stress:data.preferences?.stress===true,pronunciation:data.preferences?.pronunciation!==false},completion:validCompletion?completion:undefined};
 }catch{return {preferences:{stress:false,pronunciation:true}};}
}
