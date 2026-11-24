import type {CSSProperties,ReactNode} from 'react';
import type {Exercise} from './curriculum/types';
import {SoundIcon} from './Icons';
import type {SpeakStep} from './useSpeakStep';
import './speakExercise.css';

export function MicIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>;}
function CheckMark(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>;}
function Dots(){return <span className="speak-dots" aria-hidden="true"><i/><i/><i/></span>;}

type ContentProps={
 exercise:Exercise;step:SpeakStep;feedback:'correct'|'incorrect'|null;
 playing:boolean;audio:boolean;showReading:boolean;reading?:string;
 display:(text:string)=>string;onPlay:(rate?:number)=>void;
};

// The middle of a speaking step: a Repeat card or a Reply conversation, and the words as they are heard.
export function SpeakContent({exercise,step,feedback,playing,audio,showReading,reading,display,onPlay}:ContentProps){
 const {phase,partial,heard,missing}=step;
 const live=phase==='listening'||phase==='checking';
 const wrong=feedback==='incorrect'||phase==='almost';
 const missed=(word:string)=>phase==='almost'&&missing.some(m=>m.toLocaleLowerCase('ru')===word.replace(/[^\p{L}\p{N}́-]/gu,'').toLocaleLowerCase('ru'));
 if(exercise.exchange){
  const ex=exercise.exchange;
  const reply=feedback==='correct'?<div className="speak-reply is-correct" lang="ru">{display(exercise.answer)}</div>
   :live?<div className="speak-reply is-live" lang="ru" aria-live="polite">{partial||<Dots/>}</div>
   :wrong&&heard?<div className="speak-reply is-wrong" lang="ru">{heard}</div>
   :<div className="speak-reply"><MicIcon/> Your reply</div>;
  return <div className="speak-chat">
   <div className="exchange speak-line"><span>{ex.speaker}</span><p lang="ru">{display(ex.text)}</p>{showReading&&reading&&<small className="native-russian-reading" lang="en">{reading}</small>}<small>{ex.meaning}</small>
    {audio&&<button className={`listen-play speak-replay${playing?' is-playing':''}`} onClick={()=>onPlay()} disabled={live}><SoundIcon/><span className="speak-eq" aria-hidden="true"><i/><i/><i/></span> Hear it again</button>}
   </div>
   {reply}
   {phase==='almost'&&<AlmostNote missing={missing}/>}
  </div>;
 }
 const words=exercise.prompt.split(/\s+/);
 return <>
  <div className={`speak-card${feedback==='correct'?' is-correct':wrong?' is-wrong':live?' is-listening':''}`}>
   {feedback==='correct'&&<span className="speak-check"><CheckMark/></span>}
   {audio&&<div className="speak-audio"><button className={`listen-play${playing?' is-playing':''}`} onClick={()=>onPlay()} disabled={live} aria-label="Play the Russian audio"><SoundIcon/><span className="speak-eq" aria-hidden="true"><i/><i/><i/></span> Play</button><button className="listen-slow" onClick={()=>onPlay(.3)} disabled={live}>Slower</button></div>}
   <p className={`speak-word${playing?' is-sweeping':''}`} lang="ru">{words.map((word,i)=><span key={i} className={missed(word)?'is-missing':feedback==='correct'?'is-heard':undefined} style={{'--i':i} as CSSProperties}>{display(word)}</span>)}</p>
   {showReading&&exercise.pronunciationGuide&&<small className="speak-reading" lang="en">{exercise.pronunciationGuide}</small>}
   {exercise.translation&&<small className="speak-meaning">{exercise.translation}</small>}
  </div>
  <div className="speak-heard" aria-live="polite">{live&&<><small>I hear</small><strong lang="ru">{partial}{phase==='listening'&&<i className="speak-caret" aria-hidden="true"/>}</strong></>}</div>
  {phase==='almost'&&<AlmostNote missing={missing}/>}
 </>;
}

function AlmostNote({missing}:{missing:string[]}){
 return <div className="feedback incorrect speak-almost" role="status"><strong>Almost there.</strong><p>{missing.length?<>This word got lost: <b lang="ru">{missing.join(' ')}</b>. </>:null}Say the whole thing again. This try is free.</p></div>;
}

// The bottom button while a speaking step waits for an answer: Tap to speak, the listening bar, or Checking.
export function SpeakButton({step,onSpeak,onRetry}:{step:SpeakStep;onSpeak:()=>void;onRetry:()=>void}){
 const {phase,bars}=step;
 if(phase==='listening')return <button className="button teal speak-button is-listening" onClick={step.stop} aria-label="Listening. Tap when you're done."><span className="speak-wave" aria-hidden="true">{bars.map((h,i)=><i key={i} style={{transform:`scaleY(${h.toFixed(2)})`}}/>)}</span>Listening… tap when done</button>;
 if(phase==='checking')return <button className="button teal speak-button is-checking" disabled><Dots/> Checking</button>;
 if(phase==='almost')return <button className="button teal" onClick={onRetry}>Try again <span>→</span></button>;
 return <button className="button teal speak-button" onClick={onSpeak}><MicIcon/> Tap to speak</button>;
}

export function SpeakToast({children}:{children:ReactNode}){return <div className="speak-toast" role="status">{children}</div>;}

// "Hear it": a quiet Reply. Both lines play (the other person, then your reply); Continue counts it as done.
export function HearContent({exercise,playing,audio,showReading,reading,display,note,onPlay}:{exercise:Exercise;playing:boolean;audio:boolean;showReading:boolean;reading?:string;display:(text:string)=>string;note?:string;onPlay:()=>void}){
 const ex=exercise.exchange!;
 return <div className="speak-chat">
  <div className="exchange speak-line"><span>{ex.speaker}</span><p lang="ru">{display(ex.text)}</p>{showReading&&reading&&<small className="native-russian-reading" lang="en">{reading}</small>}<small>{ex.meaning}</small></div>
  <div className="speak-reply is-heard" lang="ru">
   {audio&&<button className={`speak-hear-play${playing?' is-playing':''}`} onClick={onPlay} aria-label="Hear the exchange again"><SoundIcon/><span className="speak-eq" aria-hidden="true"><i/><i/><i/></span></button>}
   <span>{display(exercise.answer)}</span>
  </div>
  {exercise.translation&&<small className="speak-hear-meaning">{exercise.translation}</small>}
  {note&&<p className="speak-hear-note">{note}</p>}
 </div>;
}
