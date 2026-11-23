import {useCallback,useEffect,useState} from 'react';
import {appStorage} from './previewStorage';
import {useForeground} from './useForeground';
import {speechPlugin,speechRecognitionSupported,type SpeechSupport} from './speechRecognition';
import {SPEAKING_KEY,pauseSpeaking,restoreSpeaking,speakingAvailability,type SpeakingSettings} from './speakingSettings';

// One app-wide owner of the speaking state: the saved switch and pause, and what this iPhone allows.
// Support is asked again whenever the app returns to the foreground (permissions change in iOS Settings).
export function useSpeaking(){
 const [settings,setSettings]=useState<SpeakingSettings>(()=>{try{return restoreSpeaking(appStorage.getItem(SPEAKING_KEY));}catch{return restoreSpeaking(null);}});
 const [support,setSupport]=useState<SpeechSupport|null>(null);
 const [now,setNow]=useState(()=>Date.now());
 const foreground=useForeground();
 const save=useCallback((next:SpeakingSettings)=>{setSettings(next);try{appStorage.setItem(SPEAKING_KEY,JSON.stringify(next));}catch{/* Storage is optional. */}},[]);
 const refresh=useCallback(async()=>{
  if(!speechRecognitionSupported()){setSupport(null);return null;}
  try{const next=await speechPlugin.status();setSupport(next);return next;}catch{setSupport(null);return null;}
 },[]);
 useEffect(()=>{if(foreground){setNow(Date.now());void refresh();}},[foreground,refresh]);
 // Re-render when the pause ends, so the next speaking step is spoken again.
 useEffect(()=>{
  if(settings.pausedUntil===null||settings.pausedUntil<=now)return;
  const timer=setTimeout(()=>setNow(Date.now()),settings.pausedUntil-now+50);
  return ()=>clearTimeout(timer);
 },[settings.pausedUntil,now]);
 const availability=speakingAvailability(settings,support,now);
 const pause=useCallback(()=>{const at=Date.now();setNow(at);save(pauseSpeaking(settings,at));},[settings,save]);
 const setEnabled=useCallback((enabled:boolean)=>save({...settings,enabled,pausedUntil:null}),[settings,save]);
 // iOS asks for the microphone, then speech recognition. True when both are allowed.
 const authorize=useCallback(async()=>{
  try{const next=await speechPlugin.authorize();setSupport(next);return next.speech==='granted'&&next.microphone==='granted';}catch{return false;}
 },[]);
 const openSettings=useCallback(()=>{void speechPlugin.openSettings().catch(()=>{});},[]);
 return {settings,support,...availability,pause,setEnabled,authorize,refresh,openSettings};
}
export type SpeakingController=ReturnType<typeof useSpeaking>;
