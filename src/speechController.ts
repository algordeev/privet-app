export type SpeechStatus = 'idle'|'loading'|'speaking'|'error';
export type SpeechSnapshot = {available:boolean; status:SpeechStatus; message:string};
export type SpeechEnvironment = {
 synth: Pick<SpeechSynthesis,'getVoices'|'speak'|'cancel'|'addEventListener'|'removeEventListener'>;
 utterance:(text:string)=>SpeechSynthesisUtterance;
 now:()=>number;
 setTimer:(callback:()=>void,ms:number)=>ReturnType<typeof setTimeout>;
 clearTimer:(timer:ReturnType<typeof setTimeout>)=>void;
};
export const STARTUP_TIMEOUT_MS=6000;
const unavailable='Russian audio unavailable. Continue with text.';

// One owner of the speech queue. No retries, resume calls, or deferred autoplay.
// Every voice event, utterance callback and timer belongs to a request generation.
export function createSpeechController(env:SpeechEnvironment,notify:(state:SpeechSnapshot)=>void) {
 let generation=0, disposed=false, active=true;
 let state:SpeechSnapshot={available:false,status:'idle',message:''};
 let request:{id:number;text:string;deadline:number;onEnd?:()=>void;utterance?:SpeechSynthesisUtterance;timer?:ReturnType<typeof setTimeout>}|undefined;
 const publish=(patch:Partial<SpeechSnapshot>)=>{state={...state,...patch};if(!disposed)notify(state);};
 function voices(){return env.synth.getVoices();}
 function russianVoice(){return voices().find(v=>/^ru(?:[-_]|$)/i.test(v.lang));}
 function invalidate(){
  generation++;
  if(request?.timer!==undefined)env.clearTimer(request.timer);
  if(request?.utterance){request.utterance.onstart=null;request.utterance.onend=null;request.utterance.onerror=null;}
  request=undefined;
 }
 function cancel(){invalidate();env.synth.cancel();}
 function fail(message:string){cancel();publish({status:'error',message});}
 function current(id:number){return !disposed&&active&&request?.id===id&&generation===id;}
 function start(id:number){
  if(!current(id)||!request||request.utterance)return;
  if(env.now()>=request.deadline){fail('Audio took too long to start. Tap pronunciation to try again, or use text.');return;}
  const voice=russianVoice();
  if(!voice){
   if(voices().length)fail(unavailable);
   return; // Wait only for voiceschanged, within the original startup deadline.
  }
  const utterance=env.utterance(request.text);
  request.utterance=utterance; // Retain it until completion (including on iOS).
  utterance.voice=voice;utterance.lang='ru-RU';utterance.rate=.8;
  utterance.onstart=()=>{
   if(!current(id))return;
   if(env.now()>=request!.deadline){fail('Audio took too long to start. Tap pronunciation to try again, or use text.');return;}
   env.clearTimer(request!.timer!);request!.timer=undefined;
   publish({status:'speaking',message:'Playing pronunciation…'});
  };
  utterance.onend=()=>{if(current(id)){const onEnd=request?.onEnd;invalidate();publish({status:'idle',message:''});onEnd?.();}};
  utterance.onerror=()=>{if(current(id))fail('Pronunciation could not play. Tap to try again, or continue with text.');};
  env.synth.speak(utterance);
 }
 function refresh(){
  if(disposed)return;
  try {
   const list=voices();
   // An empty list can mean voices are still initializing. A tap may wait, but
   // it never outlives its request or its single startup deadline.
   publish({available:!!russianVoice()||list.length===0});
   if(request)start(request.id);
  }catch{fail('Audio could not initialize. Continue with text.');}
 }
 env.synth.addEventListener('voiceschanged',refresh);
 refresh();
 return {
  speak(text:string,onEnd?:()=>void){
   if(disposed)return;
   cancel();
   if(!active){publish({status:'error',message:'Return to the app to play pronunciation.'});return;}
   const id=generation;
   request={id,text,onEnd,deadline:env.now()+STARTUP_TIMEOUT_MS};
   publish({status:'loading',message:'Loading pronunciation…'});
   request.timer=env.setTimer(()=>{if(current(id))fail('Audio took too long to start. Tap pronunciation to try again, or use text.');},STARTUP_TIMEOUT_MS);
   try{start(id);}catch{fail('Pronunciation could not play. Tap to try again, or continue with text.');}
  },
  stop(){if(!disposed){cancel();publish({status:'idle',message:''});}},
  setActive(value:boolean){active=value;if(!value&&!disposed){cancel();publish({status:'idle',message:''});}},
  dispose(){if(disposed)return;disposed=true;env.synth.removeEventListener('voiceschanged',refresh);cancel();},
 };
}
export type SpeechController=ReturnType<typeof createSpeechController>;
