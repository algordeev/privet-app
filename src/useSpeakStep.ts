import {useCallback,useEffect,useRef,useState} from 'react';
import type {Exercise} from './curriculum/types';
import {gradeSpeech,speakOutcome} from './speechMatch';
import {useForeground} from './useForeground';
import {candidates,speechPlugin,speechRecognitionSupported} from './speechRecognition';

// idle: waiting for "Tap to speak"; listening/checking: the microphone is open, then the final words;
// almost: a phrase came back with a word missing (one free retry); silence: nothing heard (no grade);
// error: the microphone could not start.
export type SpeakPhase='idle'|'listening'|'checking'|'almost'|'silence'|'error';
const UNAVAILABLE=new Set(['NOT_AUTHORIZED','NO_ON_DEVICE','UNAVAILABLE']);
const BARS=7;

// One spoken attempt at a time for the current step. onGrade submits the answer to the lesson
// (the accepted answer when right, what was heard when wrong); onUnavailable reports that this
// iPhone can no longer listen, so the step turns quiet.
export function useSpeakStep({exercise,stepKey,onGrade,onUnavailable}:{exercise:Exercise;stepKey:string;onGrade:(value:string)=>void;onUnavailable:()=>void}){
 const [phase,setPhase]=useState<SpeakPhase>('idle');
 const [partial,setPartial]=useState('');
 const [heard,setHeard]=useState('');
 const [missing,setMissing]=useState<string[]>([]);
 const [bars,setBars]=useState<number[]>(()=>new Array(BARS).fill(0));
 const almostUsed=useRef(false);
 const generation=useRef(0);
 const listening=useRef(false);
 const latest=useRef({exercise,onGrade,onUnavailable});latest.current={exercise,onGrade,onUnavailable};

 // A new step starts clean; leaving a step closes the microphone.
 useEffect(()=>{
  generation.current++;almostUsed.current=false;
  setPhase('idle');setPartial('');setHeard('');setMissing([]);
  return ()=>{generation.current++;if(listening.current){listening.current=false;void speechPlugin.stop().catch(()=>{});}};
 },[stepKey]);

 useEffect(()=>{
  if(!speechRecognitionSupported())return;
  const handles=[
   speechPlugin.addListener('partial',({text})=>{if(listening.current)setPartial(text);}),
   speechPlugin.addListener('state',({state})=>{if(listening.current&&state==='checking')setPhase('checking');}),
   // Voice bars: the level (about -60 dB quiet to -10 dB loud) shapes seven bars, the middle ones tallest.
   speechPlugin.addListener('level',({db})=>{
    if(!listening.current)return;
    const level=Math.max(0,Math.min(1,(db+60)/50));
    setBars(Array.from({length:BARS},(_,i)=>Math.max(.18,level*(1-Math.abs(i-3)/5)*(.75+Math.random()*.5))));
   }),
  ];
  handles.forEach(h=>void h.catch(()=>{}));
  return ()=>handles.forEach(h=>void h.then(x=>x.remove()).catch(()=>{}));
 },[]);

 const start=useCallback(async()=>{
  if(listening.current)return;
  const id=++generation.current;
  listening.current=true;
  setPhase('listening');setPartial('');setHeard('');setMissing([]);setBars(new Array(BARS).fill(0));
  try{
   const result=await speechPlugin.start({locale:'ru-RU',onDeviceOnly:true,silenceMs:1200,maxSeconds:6,noSpeechSeconds:4});
   listening.current=false;
   if(id!==generation.current)return;
   const {exercise:e,onGrade:grade}=latest.current;
   const verdict=gradeSpeech(candidates(result),[e.answer,...e.alsoAccepted??[]]);
   const outcome=speakOutcome(verdict,almostUsed.current);
   if(verdict.type!=='silence')setHeard(verdict.heard);
   if(outcome==='silence'){setPhase('silence');return;}
   if(outcome==='almost'){almostUsed.current=true;setMissing(verdict.type==='close'?verdict.missing:[]);setPhase('almost');return;}
   setPhase('idle');
   grade(outcome==='pass'?e.answer:verdict.type==='silence'?'':verdict.heard);
  }catch(error){
   listening.current=false;
   if(id!==generation.current)return;
   const code=(error as {code?:string})?.code??'';
   if(UNAVAILABLE.has(code))latest.current.onUnavailable();
   setPhase('error');
  }
 },[]);
 // Leaving the app ends the attempt: the microphone never stays open in the background.
 const foreground=useForeground();
 useEffect(()=>{if(!foreground&&listening.current)void speechPlugin.stop().catch(()=>{});},[foreground]);
 // Closes the microphone early; the words heard so far are graded.
 const stop=useCallback(()=>{if(listening.current)void speechPlugin.stop().catch(()=>{});},[]);
 // Back to "Tap to speak" after Almost, silence or an error. The heart and first-try state are untouched.
 const reset=useCallback(()=>{if(!listening.current){setPhase('idle');setPartial('');}},[]);
 return {phase,partial,heard,missing,bars,start,stop,reset};
}
export type SpeakStep=ReturnType<typeof useSpeakStep>;
