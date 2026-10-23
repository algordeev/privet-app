import {appStorage} from './previewStorage';
import {useEffect,useReducer,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {cafeLesson,type LessonDefinition} from './lessons';
import {companionReaction,lessonCompanionEvent,progressReducer,type Action,type Progress} from './engine';
import {loadSession,sessionKey,savedKey,readSaved,lessonPassed,recordLessonCompletion,type Preferences} from './session';
import {useSpeech} from './useSpeech';

export function useLesson({persistSession=false,saveResults=true,definition=cafeLesson,sharedPreferences,sharedSpeech,onTransition,unlimitedHearts=false}:{persistSession?:boolean;saveResults?:boolean;definition?:LessonDefinition;sharedSpeech?:ReturnType<typeof useSpeech>;sharedPreferences?:{value:Preferences;set:Dispatch<SetStateAction<Preferences>>};onTransition?:(previous:Progress,next:Progress,action:Action)=>void;unlimitedHearts?:boolean}={}) {
 const {exercises:lesson,words}=definition;
 const [initial]=useState(()=>loadSession(persistSession,definition));
 const [saved,setSaved]=useState(()=>readSaved(definition));
 const [localPreferences,setLocalPreferences]=useState(saved.preferences);
 const preferences=sharedPreferences?.value??localPreferences;
 const setPreferences=sharedPreferences?.set??setLocalPreferences;
 const [progress,reduce]=useReducer((state:Progress,action:Action|{type:'adoptCompletion';progress:Progress})=>action.type==='adoptCompletion'?action.progress:progressReducer(state,action,lesson,{unlimitedHearts}),initial.progress);
 const [thinkingAt,setThinkingAt]=useState<number|null>(null);
 const [hintAt,setHintAt]=useState<number|null>(initial.hintAt);
 const [vocabularyWord,setVocabularyWord]=useState<string|null>(initial.vocabularyWord);
 const [selected,setSelected]=useState(initial.selected);
 const [tokens,setTokens]=useState(initial.tokens);
 const [revealed,setRevealed]=useState(initial.revealed);
 const [lessonSettings,setLessonSettings]=useState(false);
 const [notice,setNotice]=useState('');
 const lessonScroll=useRef<HTMLDivElement>(null);
 const inputRef=useRef<HTMLInputElement>(null);
 const lessonHeading=useRef<HTMLHeadingElement>(null);
 const mounted=useRef(false);
 const previousStep=useRef(progress.index);
 const localSpeech=useSpeech(!sharedSpeech);
 const speech=sharedSpeech??localSpeech;
 function dispatch(action:Action){speech.stop();onTransition?.(progress,progressReducer(progress,action,lesson,{unlimitedHearts}),action);reduce(action);}
 useEffect(()=>{speech.stop();},[progress.index,progress.complete,progress.failed,speech.stop]);
 const exercise=lesson[Math.min(progress.index,lesson.length-1)];
 const hintRequested=hintAt===progress.index;
 const reaction=companionReaction(lessonCompanionEvent(progress,{thinking:thinkingAt===progress.index,hintRequested,vocabularyWord},lesson));
 useEffect(()=>{if(!saveResults)return;try{appStorage.setItem(savedKey(definition),JSON.stringify({...saved,preferences}));}catch{/* Storage is optional. */}},[saved,preferences,saveResults]);
 useEffect(()=>{
  if(previousStep.current!==progress.index){setSelected('');setTokens([]);setLessonSettings(false);setHintAt(null);}
  previousStep.current=progress.index;
  if(lessonScroll.current)lessonScroll.current.scrollTop=0;
  if(mounted.current)lessonHeading.current?.focus({preventScroll:true});
  mounted.current=true;
 },[progress.index,progress.complete,progress.failed,exercise.prompt]);
 useEffect(()=>{if(progress.complete)setSaved(s=>{const completion={results:progress.results,date:new Date().toISOString(),hearts:progress.hearts,bestCombo:progress.bestCombo};return persistSession?recordLessonCompletion(s,completion):{...s,completion};});},[progress.complete,progress.results,progress.hearts,progress.bestCombo]);
 useEffect(()=>{
  if(!persistSession)return;
  // A transition may render before the step-cleanup effect; don't persist a
  // prior step's hint as though it belonged to the newly opened question.
  const snapshot={progress,selected,tokens,revealed,hintAt:hintAt===progress.index&&!progress.complete?hintAt:null,vocabularyWord};
  try{appStorage.setItem(sessionKey(definition),JSON.stringify(snapshot));}catch{/* Continue without persistence. */}
 },[persistSession,progress,selected,tokens,revealed,hintAt,vocabularyWord]);
 useEffect(()=>{if(progress.feedback&&lessonScroll.current)lessonScroll.current.scrollTop=lessonScroll.current.scrollHeight;},[progress.feedback]);
 const display=(id:string)=>{const w=words.find(w=>w.id===id)!;return preferences.stress?w.stressed:w.text;};
 const ready=exercise.kind==='vocabulary'?revealed.length===words.length:exercise.kind==='sentence'?tokens.length===exercise.tokens?.length:selected.trim().length>0;
 function check(){if(!ready||progress.feedback)return;if(persistSession)inputRef.current?.blur();dispatch({type:'check',value:exercise.kind==='vocabulary'?'ready':exercise.kind==='sentence'?tokens.join(' '):selected});}
 function restart(){
  if(lessonScroll.current)lessonScroll.current.scrollTop=0;
  setLessonSettings(false);dispatch({type:'reset'});setRevealed([]);setSelected('');setTokens([]);setThinkingAt(null);setHintAt(null);setVocabularyWord(null);
  setNotice('Lesson reset. Ready for a fresh start.');
 }
 function adoptCompletion(value:Progress){if(progress.complete||!value.complete||value.failed||value.index!==lesson.length||value.results.length!==lesson.length)return;speech.stop();setSelected('');setTokens([]);setHintAt(null);reduce({type:'adoptCompletion',progress:{...value,results:[...value.results]}});}
 function revive(){dispatch({type:'revive'});}
 function refill(){dispatch({type:'refill'});}
 function resetAll(){restart();setPreferences({stress:false,pronunciation:true});setSaved({preferences:{stress:false,pronunciation:true}});try{appStorage.removeItem(savedKey(definition));if(persistSession)appStorage.removeItem(sessionKey(definition));}catch{}setNotice('Saved completion and display preferences cleared.');}
 return {definition,saved,passed:lessonPassed(progress,saved),preferences,setPreferences,progress,dispatch,thinkingAt,setThinkingAt,hintAt,setHintAt,vocabularyWord,setVocabularyWord,selected,setSelected,tokens,setTokens,revealed,setRevealed,lessonSettings,setLessonSettings,notice,setNotice,lessonScroll,inputRef,lessonHeading,speech,exercise,hintRequested,reaction,display,ready,check,restart,adoptCompletion,revive,refill,resetAll,unlimitedHearts,incorrect:progress.feedback==='incorrect'};
}
export type LessonController=ReturnType<typeof useLesson>;
