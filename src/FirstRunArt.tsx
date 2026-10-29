import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {Companion} from './Companion';

export function FirstBackdrop(){return <div className="first-backdrop" aria-hidden="true"><i/><i/><i/><span>я</span><span>а</span><span>м</span><span>о</span></div>;}

// Small OLED-style faces matching the companion's screen; cheaper and crisper than scaled robots.
const faces={
 listening:<><rect x="30" y="17" width="17" height="25" rx="8"/><rect x="113" y="17" width="17" height="25" rx="8"/><path d="M69 47 Q80 54 91 47"/></>,
 thinking:<><rect x="36" y="12" width="17" height="22" rx="8"/><rect x="119" y="12" width="17" height="22" rx="8"/><path d="M70 50 L90 48"/></>,
 correct:<><path d="M29 31 Q39 14 49 31 M111 31 Q121 14 131 31"/><path d="M66 43 Q80 60 94 43"/></>,
 celebrating:<><path d="M29 31 Q39 14 49 31 M111 31 Q121 14 131 31"/><path d="M62 41 Q80 66 98 41 Z"/></>,
};
export function ExpressionStrip(){return <ul className="first-expression-strip" aria-label="Your companion’s expressions">{([['listening','Listening'],['thinking','Thinking'],['correct','Correct!'],['celebrating','Celebrating']] as const).map(([face,label])=><li key={face} data-face={face}><svg viewBox="0 0 160 67" aria-hidden="true">{faces[face]}</svg><span>{label}</span></li>)}</ul>;}

export function StoryArt({kind}:{kind:'speak'|'letters'|'together'}){return <div className={`first-story-art is-${kind}`} aria-hidden="true">{kind==='speak'?<><span className="first-sound-wave"/><span className="first-sound-wave"/><span className="first-sound-wave"/><b>Привет!</b></>:kind==='letters'?<><span className="first-letter-tile">АБВ</span><i>→</i><b>A B V</b></>:<><span className="first-story-robot"><Companion state="celebrating" text="✦" small/></span><b>♥</b></>}</div>;}

export function Sparkles(){return <span className="first-sparkles-art" aria-hidden="true">{Array.from({length:8},(_,index)=><i key={index} style={{'--spark':index} as CSSProperties}>✦</i>)}</span>;}

export function CountUp({value,suffix='',delay=0}:{value:number;suffix?:string;delay?:number}){
 const [shown,setShown]=useState(0);
 // A changed value counts on from what is shown (e.g. gems spent), not from zero again.
 const shownRef=useRef(0);shownRef.current=shown;
 useEffect(()=>{
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced){setShown(value);return;}
  const from=shownRef.current;let frame=0,start:number|undefined;
  const tick=(now:number)=>{if(start===undefined)start=now+delay;if(now<start){frame=requestAnimationFrame(tick);return;}const progress=Math.min(1,(now-start)/700);setShown(Math.round(from+(value-from)*progress));if(progress<1)frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[value,delay]);
 return <span className="first-count-overlay" data-count={shown} data-suffix={suffix} aria-hidden="true"/>;
}
// The real number stays as (transparent) text for VoiceOver and tests; CountUp draws the counting copy over it.
export function CountedNumber({value,delay=0}:{value:number;delay?:number}){return <b className="app-count"><span className="app-count-final">{value}</span><CountUp value={value} delay={delay}/></b>;}
