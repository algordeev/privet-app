import {PRODUCT} from './config.ts';
import type {SpeechSupport} from './speechRecognition.ts';

// Whether lesson speaking steps are spoken or quiet. Saved on the device: the Settings switch and the
// 10-minute pause from "Can't speak now". Absent means on and not paused.
export const SPEAKING_KEY=`${PRODUCT.storageKey}-speaking`;
export const PAUSE_MS=10*60*1000;
export type SpeakingSettings={version:1;enabled:boolean;pausedUntil:number|null};
export const defaultSpeaking=():SpeakingSettings=>({version:1,enabled:true,pausedUntil:null});

export function restoreSpeaking(raw:string|null):SpeakingSettings{
 try{
  const s=raw?JSON.parse(raw):null;
  if(s?.version!==1||typeof s.enabled!=='boolean')return defaultSpeaking();
  return {version:1,enabled:s.enabled,pausedUntil:Number.isSafeInteger(s.pausedUntil)&&s.pausedUntil>0?s.pausedUntil:null};
 }catch{return defaultSpeaking();}
}
export const paused=(settings:SpeakingSettings,now:number)=>settings.pausedUntil!==null&&now<settings.pausedUntil;
export const pauseSpeaking=(settings:SpeakingSettings,now:number):SpeakingSettings=>({...settings,pausedUntil:now+PAUSE_MS});

// Why a speaking step is quiet, if it is. Unsupported: no recogniser in this app (the browser) or no
// on-device Russian on this iPhone; recognition never falls back to Apple's servers.
export type QuietReason='unsupported'|'off'|'paused'|'denied';
export type Availability={spoken:boolean;reason:QuietReason|null;needsPermission:boolean};
const refused=(p:SpeechSupport['speech'])=>p==='denied'||p==='restricted';
export function speakingAvailability(settings:SpeakingSettings,support:SpeechSupport|null,now:number):Availability{
 const quiet=(reason:QuietReason):Availability=>({spoken:false,reason,needsPermission:false});
 if(!support||!support.recognizer||!support.onDevice)return quiet('unsupported');
 if(!settings.enabled)return quiet('off');
 if(paused(settings,now))return quiet('paused');
 if(refused(support.speech)||refused(support.microphone))return quiet('denied');
 return {spoken:true,reason:null,needsPermission:support.speech==='prompt'||support.microphone==='prompt'};
}
