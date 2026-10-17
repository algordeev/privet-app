import {useEffect,useReducer,useRef,useState} from 'react';
import {PRODUCT} from './config';
import {lesson,words} from './lesson';
import {companionReaction,lessonCompanionEvent,progressReducer,type Action,type Progress} from './engine';
import {loadSession,NATIVE_SESSION_KEY,readSaved} from './session';
import {useSpeech} from './useSpeech';

export function useLesson({persistSession=false,onTransition}:{persistSession?:boolean;onTransition?:(previous:Progress,next:Progress,action:Action)=>void}={}) {
 const [initial]=useState(()=>loadSession(persistSession));
 const [saved,setSaved]=useState(readSaved);
 const [preferences,setPreferences]=useState(saved.preferences);
 const [progress,reduce]=useReducer(progressReducer,initial.progress);
 const [thinkingAt,setThinkingAt]=useState<number|null>(null);
 const [hintAt,setHintAt]=useState<number|null>(initial.hintAt);
 const [vocabularyWord,setVocabularyWord]=useState<string|null>(initial.vocabularyWord);
 const [selected,setSelected]=useState(initial.selected);
 const [tokens,setTokens]=useState(initial.tokens);
 const [revealed,setRevealed]=useState(initial.revealed);
 const [listening,setListening]=useState(false);
 const [lessonSettings,setLessonSettings]=useState(false);
 const [notice,setNotice]=useState('');
 const lessonScroll=useRef<HTMLDivElement>(null);
 const inputRef=useRef<HTMLInputElement>(null);
 const lessonHeading=useRef<HTMLHeadingElement>(null);
 const mounted=useRef(false);
 const previousStep=useRef(progress.index);
 const speech=useSpeech();
 function dispatch(action:Action){speech.stop();onTransition?.(progress,progressReducer(progress,action),action);reduce(action);}
 useEffect(()=>{speech.stop();},[progress.index,progress.complete,speech.stop]);
 useEffect(()=>{if(!speech.available||speech.status==='error')setListening(false);},[speech.available,speech.status]);
 const exercise=lesson[Math.min(progress.index,lesson.length-1)];
 const hintRequested=hintAt===progress.index;
 const reaction=companionReaction(lessonCompanionEvent(progress,{thinking:thinkingAt===progress.index,hintRequested,vocabularyWord}));
 useEffect(()=>{try{localStorage.setItem(PRODUCT.storageKey,JSON.stringify({...saved,preferences}));}catch{/* Storage is optional. */}},[saved,preferences]);
 useEffect(()=>{
  if(previousStep.current!==progress.index){setSelected('');setTokens([]);setListening(false);setLessonSettings(false);setHintAt(null);}
  previousStep.current=progress.index;
  if(lessonScroll.current)lessonScroll.current.scrollTop=0;
  if(mounted.current)lessonHeading.current?.focus({preventScroll:true});
  mounted.current=true;
 },[progress.index,progress.complete,exercise.prompt]);
 useEffect(()=>{if(progress.complete)setSaved(s=>({...s,completion:{results:progress.results,date:new Date().toISOString()}}));},[progress.complete,progress.results]);
 useEffect(()=>{
  if(!persistSession)return;
  // A transition may render before the step-cleanup effect; don't persist a
  // prior step's hint as though it belonged to the newly opened question.
  const snapshot={progress,selected,tokens,revealed,hintAt:hintAt===progress.index&&!progress.complete?hintAt:null,vocabularyWord};
  try{localStorage.setItem(NATIVE_SESSION_KEY,JSON.stringify(snapshot));}catch{/* Continue without persistence. */}
 },[persistSession,progress,selected,tokens,revealed,hintAt,vocabularyWord]);
 useEffect(()=>{if(progress.feedback&&lessonScroll.current)lessonScroll.current.scrollTop=lessonScroll.current.scrollHeight;},[progress.feedback]);
 const display=(id:string)=>{const w=words.find(w=>w.id===id)!;return preferences.stress?w.stressed:w.text;};
 const ready=exercise.kind==='vocabulary'?revealed.length===words.length:exercise.kind==='sentence'?tokens.length===3:selected.trim().length>0;
 function check(){if(!ready||progress.feedback)return;if(persistSession)inputRef.current?.blur();dispatch({type:'check',value:exercise.kind==='vocabulary'?'ready':exercise.kind==='sentence'?tokens.join(' '):selected});}
 function restart(){
  if(lessonScroll.current)lessonScroll.current.scrollTop=0;
  setLessonSettings(false);dispatch({type:'reset'});setRevealed([]);setSelected('');setTokens([]);setListening(false);setThinkingAt(null);setHintAt(null);setVocabularyWord(null);
  setNotice('Lesson reset. Ready for a fresh start.');
 }
 function resetAll(){restart();setPreferences({stress:false,pronunciation:true});setSaved({preferences:{stress:false,pronunciation:true}});try{localStorage.removeItem(PRODUCT.storageKey);if(persistSession)localStorage.removeItem(NATIVE_SESSION_KEY);}catch{}setNotice('Saved completion and display preferences cleared.');}
 return {saved,preferences,setPreferences,progress,dispatch,thinkingAt,setThinkingAt,hintAt,setHintAt,vocabularyWord,setVocabularyWord,selected,setSelected,tokens,setTokens,revealed,setRevealed,listening,setListening,lessonSettings,setLessonSettings,notice,setNotice,lessonScroll,inputRef,lessonHeading,speech,exercise,hintRequested,reaction,display,ready,check,restart,resetAll,incorrect:progress.feedback==='incorrect'};
}
export type LessonController=ReturnType<typeof useLesson>;
