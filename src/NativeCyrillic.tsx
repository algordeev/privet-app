import {useEffect,useRef,useState} from 'react';
import {CYRILLIC,LETTER_GROUPS,QUICK_LETTERS,QUICK_TITLES,READING_WORDS,contextualLetters,referenceExample,targetLetterParts,letterAudioText,type CyrillicLetter} from './cyrillic';
import type {LessonDefinition} from './lessons';
import type {Exercise} from './lesson';
import type {LessonController} from './useLesson';
import type {CyrillicController} from './useCyrillicProgress';
import {NativeSheet} from './NativeSheet';
import {PrintIcon,SoundIcon} from './Icons';
import {russianReading} from './pronunciation';
import {Sparkles} from './OnboardingArt';
import type {Word} from './curriculum/types';

type Speech=LessonController['speech'];
function BackChevron(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>;}
export function CyrillicExample({example,target}:{example:string;target:string}){
 const parts=targetLetterParts(example,target);
 return <span className="native-letter-example" lang="ru"><span aria-hidden="true">{parts.before}{parts.target&&<strong className="native-target-letter">{parts.target}</strong>}{parts.after}</span><span className="native-sr-only">{example}</span></span>;
}
// onPrint: a print icon on each card (the guide, while a printer is connected).
function LetterCards({letters,speech,onListen,words,onPrint}:{letters:readonly CyrillicLetter[];speech:Speech;onListen:(text:string)=>void;words?:readonly Word[];onPrint?:(letter:CyrillicLetter)=>void}){
 return <div className="native-letter-list">{letters.map(item=><article className="native-letter-card" key={item.upper}>
  <div className="native-letter-heading">{speech.available&&letterAudioText(item)?<button className="native-letter-sound" aria-label={`Hear letter ${item.upper} (device speech)`} onClick={()=>onListen(letterAudioText(item)!)}><strong lang="ru">{item.upper} <span>{item.lower}</span></strong></button>:<strong lang="ru">{item.upper} <span>{item.lower}</span></strong>}</div><div className="native-letter-copy"><b>{item.sound}</b><p><CyrillicExample example={item.example} target={item.lower}/>{russianReading(item.example,words)&&<span className="native-example-reading" lang="en">{russianReading(item.example,words)}</span>}<span className="native-example-meaning">{item.meaning}</span></p>{item.note&&<small>{item.note}</small>}</div>
  {onPrint?<div className="native-letter-actions">{speech.available&&item.example&&<button className="native-letter-audio" aria-label={`Listen to ${item.example}: ${item.meaning}`} onClick={()=>onListen(item.example)}><SoundIcon/></button>}<button className="native-letter-print" aria-label={`Print a strip for the letter ${item.upper}`} onClick={()=>onPrint(item)}><PrintIcon/></button></div>
  :speech.available&&item.example&&<button className="native-letter-audio" aria-label={`Listen to ${item.example}: ${item.meaning}`} onClick={()=>onListen(item.example)}><SoundIcon/></button>}
 </article>)}</div>;
}
function AudioNote({speech}:{speech:Speech}){return <p className="native-alphabet-note">{speech.message|| (speech.available?'Tap a green letter to hear it, or the speaker for its example. Device voices may say letter names rather than pure sounds.':'Russian audio unavailable. You can keep learning with text.')}</p>;}
// onPrint: only while a printer is connected; gets the letter as its card shows it (with that card's example).
export function NativeAlphabetGuide({definition,exercise,speech,onListen,onClose,onPrint}:{definition:LessonDefinition;exercise:Exercise;speech:Speech;onListen:(text:string)=>void;onClose:()=>void;onPrint?:(letter:CyrillicLetter)=>void}){
 const [full,setFull]=useState(false);
 const scroll=useRef<HTMLDivElement>(null);
 useEffect(()=>()=>speech.stop(),[speech.stop]);
 const letters=(full?CYRILLIC:contextualLetters(definition,exercise)).map(item=>referenceExample(item,definition,exercise));
 const print=onPrint&&((letter:CyrillicLetter)=>{speech.stop();onPrint(letter);});
 function switchView(){speech.stop();setFull(value=>!value);if(scroll.current)scroll.current.scrollTop=0;}
 return <NativeSheet id="native-alphabet-guide" size="reference" title="Cyrillic guide" onClose={onClose}>
  <div className="native-guide-tabs"><button aria-pressed={!full} onClick={()=>{if(full)switchView();}}>Current exercise</button><button aria-pressed={full} onClick={()=>{if(!full)switchView();}}>See full alphabet</button></div>
  <div ref={scroll} className="native-sheet-scroll"><p className="native-alphabet-note">Rough English sound guides, not exact pronunciation. CAPITALS mark stress in words. Letters below are in Russian alphabetical order within each group.</p>
   {full?Object.entries(LETTER_GROUPS).map(([group,title])=><section className={`native-letter-group ${group==='tricky'?'is-tricky':''}`} key={group}><h3>{title}</h3><LetterCards letters={letters.filter(item=>item.group===group)} speech={speech} onListen={onListen} words={definition.words} onPrint={print}/></section>):<LetterCards letters={letters} speech={speech} onListen={onListen} words={definition.words} onPrint={print}/>}
   <AudioNote speech={speech}/>
  </div>
 </NativeSheet>;
}
// onPrint, onPrintLetter, onPrintRecall: only while a printer is connected; the page's alphabet strip, one
// letter's strip, or (on the finish screen) the write-from-memory strip.
export function NativeCyrillicQuickStart({onboarding,speech,onClose,onLesson,onListen,onListenEnd,onPrint,onPrintLetter,onPrintRecall}:{onboarding:CyrillicController;speech:Speech;onClose:()=>void;onLesson:()=>void;onListen?:()=>void;onListenEnd?:()=>void;onPrint?:(page:number)=>void;onPrintLetter?:(letter:CyrillicLetter)=>void;onPrintRecall?:()=>void}){
 const [page,setPage]=useState(onboarding.state.status==='completed'?0:onboarding.state.page);
 const [finished,setFinished]=useState(false);
 // Pages slide in from the side they come from; the scroll re-keys per page to replay its entrance.
 const [direction,setDirection]=useState<'forward'|'back'>('forward');
 const listening=useRef(false);
 const [revealed,setRevealed]=useState<string[]>([]);
 const heading=useRef<HTMLHeadingElement>(null),scroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});if(scroll.current)scroll.current.scrollTop=0;},[page,finished]);
 useEffect(()=>()=>speech.stop(),[speech.stop]);
 function finishListening(){if(!listening.current)return;listening.current=false;onListenEnd?.();}
 function stopListening(){speech.stop();finishListening();}
 function listen(text:string){if(!speech.available)return;listening.current=true;onListen?.();speech.speak(text,finishListening);}
 function move(next:number){stopListening();setDirection(next<page?'back':'forward');setPage(next);onboarding.dispatch({type:'page',page:next});}
 const letters=page<3?QUICK_LETTERS[page].map(upper=>CYRILLIC.find(item=>item.upper===upper)!):[];
 return <div className="native-quick-screen">
  <header className="native-profile-navigation"><button className="app-icon-button" aria-label="Back to home" onClick={onClose}><BackChevron/></button><span>Cyrillic quick start</span><span aria-hidden="true"/></header>
  <p className="native-quick-progress" role="status">{finished?'Quick start complete':`Page ${page+1} of 4`}</p>
  <div ref={scroll} className="native-quick-scroll" key={finished?'finished':page} data-direction={direction}>
   {finished&&<div className="first-sparkles"><Sparkles/></div>}
   <h1 ref={heading} tabIndex={-1}>{finished?'A little more familiar.':QUICK_TITLES[page]}</h1>
   {finished?<p>You don’t need to memorize everything. The alphabet guide stays available during lessons.</p>:<>
    <p>{page===0?'Some Russian letters already look and sound familiar.':page===1?'These look familiar to English readers, but their sounds are different. Take your time with them.':page===2?'Meet a few more useful Russian letters. You can look them up any time.':'Try reading each word, then tap to reveal its meaning. No scores, no wrong answers.'}</p>
    {page<3?<section className={page===1?'native-letter-group is-tricky':'native-letter-group'}><p className="native-alphabet-note">English spellings are rough sound guides, not exact equivalents. CAPITALS mark stress in words.</p><LetterCards letters={letters} speech={speech} onListen={listen} onPrint={onPrintLetter&&(letter=>{stopListening();onPrintLetter(letter);})}/></section>:<div className="native-reading-list">{READING_WORDS.map(word=><article className="native-reading-card" key={word.text}><button className="native-reading-reveal" aria-expanded={revealed.includes(word.text)} onClick={()=>setRevealed(values=>values.includes(word.text)?values:[...values,word.text])}><strong lang="ru">{word.text}</strong><span className="native-example-reading" lang="en">{russianReading(word.text)}</span><span>{revealed.includes(word.text)?word.meaning:'Reveal meaning +'}</span></button>{speech.available&&<button className="native-letter-audio" aria-label={`Listen to ${word.text}`} onClick={()=>listen(word.text)}><SoundIcon/></button>}</article>)}</div>}
    {onPrint&&<button className="native-text-button native-quick-print" id="native-quick-print" onClick={()=>{stopListening();onPrint(page);}}><PrintIcon/> Print a practice strip</button>}
    <AudioNote speech={speech}/>
   </>}
  </div>
  <div className={`native-quick-actions ${finished?'is-finished':''}`}>{finished?<><button className="button teal" onClick={onLesson}>Start Lesson 1 <span aria-hidden="true">→</span></button>{onPrintRecall&&<button className="native-text-button native-quick-print" id="native-quick-recall-print" onClick={()=>{stopListening();onPrintRecall();}}><PrintIcon/> Print a write-from-memory strip</button>}<button className="native-text-button" onClick={onClose}>Go back home</button></>:<>{page>0&&<button className="button native-secondary" onClick={()=>move(page-1)}><BackChevron/>Previous</button>}<button className="button teal" onClick={()=>{if(page<3)move(page+1);else{stopListening();setDirection('forward');onboarding.dispatch({type:'complete'});setFinished(true);}}}>{page<3?'Continue':'Finish quick start'} <span aria-hidden="true">→</span></button></>}</div>
 </div>;
}
