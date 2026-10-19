import {useEffect,useRef,useState} from 'react';
import {CYRILLIC,LETTER_GROUPS,QUICK_LETTERS,READING_WORDS,contextualLetters,referenceExample,targetLetterParts,type CyrillicLetter} from './cyrillic';
import type {LessonDefinition} from './lessons';
import type {Exercise} from './lesson';
import type {LessonController} from './useLesson';
import type {CyrillicController} from './useCyrillicProgress';
import {NativeSheet} from './NativeSheet';
import {SoundIcon} from './Icons';

type Speech=LessonController['speech'];
function BackChevron(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>;}
export function CyrillicExample({example,target}:{example:string;target:string}){
 const parts=targetLetterParts(example,target);
 return <span className="native-letter-example" lang="ru"><span aria-hidden="true">{parts.before}{parts.target&&<strong className="native-target-letter">{parts.target}</strong>}{parts.after}</span><span className="native-sr-only">{example}</span></span>;
}
function LetterCards({letters,speech,onListen}:{letters:readonly CyrillicLetter[];speech:Speech;onListen:(text:string)=>void}){
 return <div className="native-letter-list">{letters.map(item=><article className="native-letter-card" key={item.upper}>
  <strong lang="ru">{item.upper} <span>{item.lower}</span></strong><div><b>{item.sound}</b><p><CyrillicExample example={item.example} target={item.lower}/><span className="native-example-meaning">{item.meaning}</span></p>{item.note&&<small>{item.note}</small>}</div>
  {speech.available&&item.example&&<button className="native-letter-audio" aria-label={`Listen to ${item.example}: ${item.meaning}`} onClick={()=>onListen(item.example)}><SoundIcon/></button>}
 </article>)}</div>;
}
function AudioNote({speech}:{speech:Speech}){return <p className="native-alphabet-note">{speech.message|| (speech.available?'Tap a speaker to hear the whole example word or phrase.':'Russian audio unavailable. You can keep learning with text.')}</p>;}
export function NativeAlphabetGuide({definition,exercise,speech,onListen,onClose}:{definition:LessonDefinition;exercise:Exercise;speech:Speech;onListen:(text:string)=>void;onClose:()=>void}){
 const [full,setFull]=useState(false);
 const scroll=useRef<HTMLDivElement>(null);
 useEffect(()=>()=>speech.stop(),[speech.stop]);
 const letters=(full?CYRILLIC:contextualLetters(definition,exercise)).map(item=>referenceExample(item,definition,exercise));
 function switchView(){speech.stop();setFull(value=>!value);if(scroll.current)scroll.current.scrollTop=0;}
 return <NativeSheet id="native-alphabet-guide" size="reference" title="Cyrillic guide" onClose={onClose}>
  <div className="native-guide-tabs"><button aria-pressed={!full} onClick={()=>{if(full)switchView();}}>Current exercise</button><button aria-pressed={full} onClick={()=>{if(!full)switchView();}}>See full alphabet</button></div>
  <div ref={scroll} className="native-sheet-scroll"><p className="native-alphabet-note">Rough English sound guides, not exact pronunciation. Letters below are in Russian alphabetical order within each group.</p>
   {full?Object.entries(LETTER_GROUPS).map(([group,title])=><section className={`native-letter-group ${group==='tricky'?'is-tricky':''}`} key={group}><h3>{title}</h3><LetterCards letters={letters.filter(item=>item.group===group)} speech={speech} onListen={onListen}/></section>):<LetterCards letters={letters} speech={speech} onListen={onListen}/>}
   <AudioNote speech={speech}/>
  </div>
 </NativeSheet>;
}
export function CyrillicQuickCard({onboarding,onStart}:{onboarding:CyrillicController;onStart:()=>void}){
 const {status}=onboarding.state;
 if(status!=='unseen')return <section className="native-quick-card is-collapsed" aria-labelledby="native-quick-title"><span className="native-quick-monogram" lang="ru" aria-hidden="true">Аа</span><div><h2 id="native-quick-title">Cyrillic quick start</h2><p>{status==='completed'?'Always here for reference.':status==='started'?'Continue at your pace.':'Optional alphabet help'}</p></div><button id="native-quick-open" className="native-quick-open" aria-label={`${status==='completed'?'Review':status==='started'?'Continue':'Open'} Cyrillic quick start`} onClick={onStart}>{status==='completed'?'Review':status==='started'?'Continue':'Open'} <span aria-hidden="true">→</span></button></section>;
 return <section className="native-quick-card" aria-labelledby="native-quick-title"><span className="native-kicker">RECOMMENDED · ABOUT 3 MIN</span><div className="native-quick-heading"><span lang="ru" aria-hidden="true">Аа</span><h2 id="native-quick-title">Cyrillic quick start</h2></div><p>Recognize the letters you’ll meet in your first lessons.</p><button id="native-quick-open" className="button teal" onClick={onStart}>Start quick start <span aria-hidden="true">→</span></button>{status==='unseen'&&<button className="native-text-button" onClick={()=>onboarding.dispatch({type:'skip'})}>Skip for now</button>}</section>;
}
const titles=['A few familiar faces.','Same shape. New sound.','A few new friends.','You can already read a little.'];
export function NativeCyrillicQuickStart({onboarding,speech,onClose,onLesson,onListen,onListenEnd}:{onboarding:CyrillicController;speech:Speech;onClose:()=>void;onLesson:()=>void;onListen?:()=>void;onListenEnd?:()=>void}){
 const [page,setPage]=useState(onboarding.state.status==='completed'?0:onboarding.state.page);
 const [finished,setFinished]=useState(false);
 const listening=useRef(false);
 const [revealed,setRevealed]=useState<string[]>([]);
 const heading=useRef<HTMLHeadingElement>(null),scroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});if(scroll.current)scroll.current.scrollTop=0;},[page,finished]);
 useEffect(()=>()=>speech.stop(),[speech.stop]);
 function finishListening(){if(!listening.current)return;listening.current=false;onListenEnd?.();}
 function stopListening(){speech.stop();finishListening();}
 function listen(text:string){if(!speech.available)return;listening.current=true;onListen?.();speech.speak(text,finishListening);}
 function move(next:number){stopListening();setPage(next);onboarding.dispatch({type:'page',page:next});}
 const letters=page<3?QUICK_LETTERS[page].map(upper=>CYRILLIC.find(item=>item.upper===upper)!):[];
 return <div className="native-quick-screen">
  <header className="native-profile-navigation"><button className="app-icon-button" aria-label="Back to home" onClick={onClose}><BackChevron/></button><span>Cyrillic quick start</span><span aria-hidden="true"/></header>
  <p className="native-quick-progress" role="status">{finished?'Quick start complete':`Page ${page+1} of 4`}</p>
  <div ref={scroll} className="native-quick-scroll">
   <h1 ref={heading} tabIndex={-1}>{finished?'A little more familiar.':titles[page]}</h1>
   {finished?<p>You don’t need to memorize everything. The alphabet guide stays available during lessons.</p>:<>
    <p>{page===0?'Some Russian letters already look and sound familiar.':page===1?'These look familiar to English readers, but their sounds are different. Take your time with them.':page===2?'Meet a few more useful Russian letters. You can look them up any time.':'Try reading each word, then tap to reveal its meaning. No scores, no wrong answers.'}</p>
    {page<3?<section className={page===1?'native-letter-group is-tricky':'native-letter-group'}><p className="native-alphabet-note">English spellings are rough sound guides, not exact equivalents.</p><LetterCards letters={letters} speech={speech} onListen={listen}/></section>:<div className="native-reading-list">{READING_WORDS.map(word=><article className="native-reading-card" key={word.text}><button className="native-reading-reveal" aria-expanded={revealed.includes(word.text)} onClick={()=>setRevealed(values=>values.includes(word.text)?values:[...values,word.text])}><strong lang="ru">{word.text}</strong><span>{revealed.includes(word.text)?word.meaning:'Reveal meaning +'}</span></button>{speech.available&&<button className="native-letter-audio" aria-label={`Listen to ${word.text}`} onClick={()=>listen(word.text)}><SoundIcon/></button>}</article>)}</div>}
    <AudioNote speech={speech}/>
   </>}
  </div>
  <div className={`native-quick-actions ${finished?'is-finished':''}`}>{finished?<><button className="button teal" onClick={onLesson}>Start Lesson 1 <span aria-hidden="true">→</span></button><button className="button native-secondary" onClick={onClose}><BackChevron/>Back to home</button></>:<>{page>0&&<button className="button native-secondary" onClick={()=>move(page-1)}><BackChevron/>Previous</button>}<button className="button teal" onClick={()=>{if(page<3)move(page+1);else{stopListening();onboarding.dispatch({type:'complete'});setFinished(true);}}}>{page<3?'Continue':'Finish quick start'} <span aria-hidden="true">→</span></button></>}</div>
 </div>;
}
