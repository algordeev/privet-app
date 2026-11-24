import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';

// The native PrivetSpeech plugin (ios/App/App/PrivetSpeechPlugin.swift): Russian speech
// recognition, on-device unless a caller turns that off.
export type Permission='granted'|'denied'|'restricted'|'prompt';
export type SpeechSupport={speech:Permission;microphone:Permission;recognizer:boolean;available:boolean;onDevice:boolean};
export type ListenOptions={locale?:string;onDeviceOnly?:boolean;contextualStrings?:string[];maxSeconds?:number;silenceMs?:number;noSpeechSeconds?:number;loudDb?:number};
export type ListenReason='final'|'pause'|'max'|'silence'|'stopped'|'interrupted'|'replaced';
export type ListenResult={
 reason:ListenReason;onDevice:boolean;final:boolean;
 alternatives:{text:string;confidence:number}[];
 segments:{text:string;confidence:number;alternatives:string[]}[];
 listenedMs:number;checkMs:number;error?:string;
};

interface PrivetSpeechPlugin{
 status(options?:{locale?:string}):Promise<SpeechSupport>;
 authorize(options?:{locale?:string}):Promise<SpeechSupport>;
 start(options:ListenOptions):Promise<ListenResult>;
 stop():Promise<void>;
 openSettings():Promise<void>;
 addListener(event:'level',listener:(data:{db:number})=>void):Promise<PluginListenerHandle>;
 addListener(event:'partial',listener:(data:{text:string})=>void):Promise<PluginListenerHandle>;
 addListener(event:'state',listener:(data:{state:'listening'|'checking'|'idle'})=>void):Promise<PluginListenerHandle>;
}

export const speechPlugin=registerPlugin<PrivetSpeechPlugin>('PrivetSpeech');
export const speechRecognitionSupported=()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('PrivetSpeech');

// Every whole-answer candidate the recogniser offered: its n-best list, plus the best
// transcription with one word swapped for each per-word alternative it reported.
export function candidates(result:Pick<ListenResult,'alternatives'|'segments'>):string[]{
 const found=result.alternatives.map(a=>a.text);
 const words=result.segments.map(s=>s.text);
 result.segments.forEach((segment,i)=>segment.alternatives.forEach(alt=>found.push(words.map((w,j)=>j===i?alt:w).join(' '))));
 return [...new Set(found.filter(text=>text.trim()))];
}
