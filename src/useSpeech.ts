import {useEffect, useState} from 'react';
export function useSpeech() {
 const [voice,setVoice]=useState<SpeechSynthesisVoice|null>(null);
 const [speaking,setSpeaking]=useState(false);
 useEffect(()=>{
  if(!('speechSynthesis' in window)) return;
  const update=()=>setVoice(window.speechSynthesis.getVoices().find(v=>/^ru(?:-|_)/i.test(v.lang)||v.lang==='ru')??null);
  update(); window.speechSynthesis.addEventListener('voiceschanged',update);
  return ()=>{window.speechSynthesis.removeEventListener('voiceschanged',update);window.speechSynthesis.cancel();};
 },[]);
 function speak(text:string) {
  if(!voice) return;
  window.speechSynthesis.cancel(); const utterance=new SpeechSynthesisUtterance(text);
  utterance.voice=voice; utterance.lang='ru-RU'; utterance.rate=.8;
  utterance.onstart=()=>setSpeaking(true); utterance.onend=utterance.onerror=()=>setSpeaking(false);
  window.speechSynthesis.speak(utterance);
 }
 return {available:!!voice,speaking,speak};
}
