import {useCallback,useEffect,useRef,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {createSpeechController,type SpeechController,type SpeechSnapshot} from './speechController';

export function useSpeech() {
 const controller=useRef<SpeechController|null>(null);
 const [state,setState]=useState<SpeechSnapshot>({available:false,status:'idle',message:''});
 useEffect(()=>{
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window))return;
  const audio=createSpeechController({
   synth:window.speechSynthesis,utterance:text=>new SpeechSynthesisUtterance(text),
   now:()=>Date.now(),setTimer:(fn,ms)=>setTimeout(fn,ms),clearTimer:timer=>clearTimeout(timer),
  },setState);
  controller.current=audio;
  let nativeActive=true,alive=true,lifecycleVersion=0;
  const visibility=()=>audio.setActive(nativeActive&&!document.hidden);
  const pagehide=()=>audio.setActive(false);
  const pageshow=()=>visibility();
  visibility();
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',pagehide);
  window.addEventListener('pageshow',pageshow);
  // WKWebView visibility alone is insufficient for native app lifecycle events.
  // Guard async listener registration so StrictMode/unmount cannot leak a listener.
  const nativeListener=Capacitor.isNativePlatform()
   ? App.addListener('appStateChange',({isActive})=>{if(alive){lifecycleVersion++;nativeActive=isActive;visibility();}})
   : undefined;
  const initialVersion=lifecycleVersion;
  void nativeListener?.then(async()=>{
   if(!alive)return;
   const {isActive}=await App.getState();
   if(alive&&lifecycleVersion===initialVersion){nativeActive=isActive;visibility();}
  }).catch(error=>console.warn('Native audio lifecycle state unavailable',error));
  void nativeListener?.catch(error=>console.warn('Native audio lifecycle listener unavailable',error));
  return ()=>{
   alive=false;controller.current=null;
   document.removeEventListener('visibilitychange',visibility);
   window.removeEventListener('pagehide',pagehide);
   window.removeEventListener('pageshow',pageshow);
   audio.dispose();
   void nativeListener?.then(listener=>listener.remove()).catch(()=>{});
  };
 },[]);
 const speak=useCallback((text:string)=>controller.current?.speak(text),[]);
 const stop=useCallback(()=>controller.current?.stop(),[]);
 return {...state,speaking:state.status==='speaking',speak,stop};
}
