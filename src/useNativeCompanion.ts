import {useCallback,useEffect,useRef,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {companionEnabled,COMPANION_PREFERENCE_KEY,createNativeCompanion,initialCompanion} from './nativeCompanion';
import type {Action,Progress} from './engine';

function readPreference(){try{return companionEnabled(localStorage.getItem(COMPANION_PREFERENCE_KEY));}catch{return true;}}
export function useNativeCompanion(){
 const [view,setView]=useState(()=>initialCompanion(readPreference()));
 const initialEnabled=useRef(view.enabled);
 const actor=useRef<ReturnType<typeof createNativeCompanion>|null>(null);
 useEffect(()=>{
  const companion=createNativeCompanion(initialEnabled.current,setView,{set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)});
  actor.current=companion;
  let alive=true,nativeActive=true,lifecycleVersion=0;
  const visibility=()=>companion.setActive(nativeActive&&!document.hidden);
  const pagehide=()=>companion.setActive(false);
  visibility();
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',pagehide);
  window.addEventListener('pageshow',visibility);
  const listener=Capacitor.isNativePlatform()?App.addListener('appStateChange',({isActive})=>{
   if(alive){lifecycleVersion++;nativeActive=isActive;visibility();}
  }):undefined;
  const version=lifecycleVersion;
  void listener?.then(async()=>{
   if(!alive)return;
   const state=await App.getState();
   if(alive&&version===lifecycleVersion){nativeActive=state.isActive;visibility();}
  }).catch(error=>console.warn('Companion lifecycle unavailable',error));
  return ()=>{
   alive=false;actor.current=null;companion.dispose();
   document.removeEventListener('visibilitychange',visibility);
   window.removeEventListener('pagehide',pagehide);
   window.removeEventListener('pageshow',visibility);
   void listener?.then(handle=>handle.remove()).catch(()=>{});
  };
 },[]);
 const setEnabled=useCallback((value:boolean)=>{
  initialEnabled.current=value;actor.current?.setEnabled(value);
  try{localStorage.setItem(COMPANION_PREFERENCE_KEY,JSON.stringify(value));}catch{/* Preference remains usable without storage. */}
 },[]);
 const resetPreference=useCallback(()=>{
  initialEnabled.current=true;actor.current?.setEnabled(true);
  try{localStorage.removeItem(COMPANION_PREFERENCE_KEY);}catch{}
 },[]);
 const navigate=useCallback((scope:'home'|'lesson')=>actor.current?.navigate(scope),[]);
 const onTransition=useCallback((previous:Progress,next:Progress,action:Action)=>actor.current?.transition(previous,next,action),[]);
 const tap=useCallback(()=>actor.current?.tap(),[]);
 return {view,setEnabled,resetPreference,navigate,onTransition,tap};
}
export type NativeCompanionController=ReturnType<typeof useNativeCompanion>;
