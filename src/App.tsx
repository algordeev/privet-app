import {useEffect,useReducer,useRef,useState} from 'react';
import {PRODUCT} from './config';
import {lesson,words} from './lesson';
import {companionReaction,lessonCompanionEvent,initialProgress,progressReducer} from './engine';
import {Companion} from './Companion';
import {useSpeech} from './useSpeech';

type Preferences={stress:boolean;pronunciation:boolean};
type Saved={preferences:Preferences;completion?:{results:boolean[];date:string}};
function readSaved():Saved { try {const data=JSON.parse(localStorage.getItem(PRODUCT.storageKey)||'{}'); return {preferences:{stress:data.preferences?.stress===true,pronunciation:data.preferences?.pronunciation!==false},completion:Array.isArray(data.completion?.results)&&data.completion.results.length===5&&data.completion.results.every((v:unknown)=>typeof v==='boolean')?data.completion:undefined};} catch{return {preferences:{stress:false,pronunciation:true}};} }
function Arrow() {return <span aria-hidden="true">↗</span>;}
function SoundIcon(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z M15 8q5 4 0 8 M18 5q8 7 0 14"/></svg>;}
function App(){
 const [saved,setSaved]=useState(readSaved);
 const [preferences,setPreferences]=useState(saved.preferences);
 const [progress,dispatch]=useReducer(progressReducer,undefined,initialProgress);
 const [thinkingAt,setThinkingAt]=useState<number|null>(null);
 const [hintAt,setHintAt]=useState<number|null>(null);
 const [vocabularyWord,setVocabularyWord]=useState<string|null>(null);
 const [meetReaction,setMeetReaction]=useState(companionReaction({type:'reset'}));
 const [selected,setSelected]=useState(''); const [tokens,setTokens]=useState<string[]>([]);
 const [revealed,setRevealed]=useState<string[]>([]); const [listening,setListening]=useState(false);
 const [lessonSettings,setLessonSettings]=useState(false);
 const lessonScroll=useRef<HTMLDivElement>(null);
 const [menu,setMenu]=useState(false); const [notice,setNotice]=useState('');
 const speech=useSpeech(); const inputRef=useRef<HTMLInputElement>(null); const lessonHeading=useRef<HTMLHeadingElement>(null);
 const mounted=useRef(false); const wordIndex=useRef(0); const meetTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const exercise=lesson[Math.min(progress.index,lesson.length-1)];
 const hintRequested=hintAt===progress.index;
 const reaction=companionReaction(lessonCompanionEvent(progress,{thinking:thinkingAt===progress.index,hintRequested,vocabularyWord}));
 useEffect(()=>{try{localStorage.setItem(PRODUCT.storageKey,JSON.stringify({...saved,preferences}));}catch{/* The demo remains usable when storage is blocked. */}},[saved,preferences]);
 useEffect(()=>{
  setSelected('');setTokens([]);setListening(false);setLessonSettings(false);
  if(lessonScroll.current) lessonScroll.current.scrollTop=0;
  if(mounted.current) lessonHeading.current?.focus({preventScroll:true});
  mounted.current=true;
 },[progress.index,progress.complete,exercise.prompt]);
 useEffect(()=>{if(progress.complete) setSaved(s=>({...s,completion:{results:progress.results,date:new Date().toISOString()}}));},[progress.complete,progress.results]);
 useEffect(()=>()=>{if(meetTimer.current) clearTimeout(meetTimer.current);},[]);
 const display=(id:string)=>{const w=words.find(w=>w.id===id)!;return preferences.stress?w.stressed:w.text;};
 const ready=exercise.kind==='vocabulary'?revealed.length===words.length:exercise.kind==='sentence'?tokens.length===3:selected.trim().length>0;
 function check(){if(!ready||progress.feedback) return; dispatch({type:'check',value:exercise.kind==='vocabulary'?'ready':exercise.kind==='sentence'?tokens.join(' '):selected});}
 useEffect(()=>{if(progress.feedback){if(lessonScroll.current)lessonScroll.current.scrollTop=lessonScroll.current.scrollHeight;}},[progress.feedback]);
 function restart(){if(lessonScroll.current)lessonScroll.current.scrollTop=0;setLessonSettings(false);dispatch({type:'reset'});setRevealed([]);setSelected('');setTokens([]);setThinkingAt(null);setHintAt(null);setVocabularyWord(null);setNotice('Lesson reset. Ready for a fresh start.');}
 function resetAll(){restart();setPreferences({stress:false,pronunciation:true});setSaved({preferences:{stress:false,pronunciation:true}});try{localStorage.removeItem(PRODUCT.storageKey);}catch{}setNotice('Saved completion and display preferences cleared.');}
 function meet(type:'word'|'tilt'|'celebrate'){
  if(meetTimer.current)clearTimeout(meetTimer.current);
  setMeetReaction(companionReaction(type==='word'?{type:'prompt',text:words[wordIndex.current++%words.length].text}:type==='tilt'?{type:'thinking'}:{type:'complete'}));
  meetTimer.current=setTimeout(()=>setMeetReaction(companionReaction({type:'reset'})),4500);
 }
 const incorrect=progress.feedback==='incorrect';
 return <>
  <a className="skip-link" href="#demo">Skip to lesson</a>
  <header className="site-header wrap">
   <a className="wordmark" href="#" aria-label={`${PRODUCT.name} home`}><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></a>
   <button className="menu-toggle" onClick={()=>setMenu(!menu)} aria-expanded={menu} aria-controls="navigation">{menu?'Close':'Menu'} <span>☰</span></button>
   <nav id="navigation" className={menu?'open':''} aria-label="Main navigation"><a href="#demo" onClick={()=>setMenu(false)}>The demo</a><a href="#approach" onClick={()=>setMenu(false)}>How you’ll learn</a><a href="#companion" onClick={()=>setMenu(false)}>The little companion</a></nav>
   <a className="button dark header-cta" href="#demo">Try a lesson <Arrow/></a>
  </header>
  <main>
   <section className="hero wrap" aria-labelledby="hero-title">
    <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> A SMALL START. A WHOLE NEW LANGUAGE.</div>
     <h1 id="hero-title">A little Russian.<br/>A little <span className="serif-accent">every day.</span></h1>
     <p>From your first <span lang="ru">привет</span> to your everyday conversations. Learn practical Russian in small, satisfying steps—with a little desk companion cheering you on.</p>
     <div className="hero-actions"><a href="#demo" className="button teal">Try a lesson <Arrow/></a><a className="text-link" href="#companion">Meet your companion <span aria-hidden="true">↓</span></a></div>
     <div className="concept-label"><span className="apple-outline" aria-hidden="true">◉</span> iOS app concept <span>·</span> Interactive web demo</div>
    </div>
    <div className="hero-art">
     <div className="orbital-ring"/><span className="hero-star star-one" aria-hidden="true">✳</span><span className="hero-star star-two" aria-hidden="true">✧</span>
     <span className="hand-note note-top">Your daily dose of<br/>“I can do this.”<svg viewBox="0 0 85 46" aria-hidden="true"><path d="M5 4Q77 -5 70 34 M61 26 70 36 79 27"/></svg></span>
     <div className="phone-preview" aria-label="Illustrative iPhone lesson preview">
      <div className="phone-top"><span>9:41</span><span className="dynamic-island"/><span aria-hidden="true">▂▄▆ ▰</span></div>
      <div className="preview-nav"><span>←</span><span>YOUR FIRST CAFÉ VISIT</span><span>•••</span></div>
      <div className="mini-progress"><i/></div>
      <div className="preview-title">Small words.<br/>Big beginnings.</div><span className="preview-subtitle">Let’s order something warm.</span>
      <div className="tea-illustration"><svg viewBox="0 0 140 110" aria-hidden="true"><path className="steam" d="M55 30q-12-12 0-25M77 28q-12-12 0-25" fill="none" stroke="#a1b5a9" strokeWidth="3" strokeLinecap="round"/><ellipse cx="66" cy="94" rx="47" ry="7" fill="#c6d9cb"/><path d="M98 49h9c28 0 22 34-4 32" fill="none" stroke="#286654" strokeWidth="8"/><path d="M29 44h72v27q0 26-36 26T29 71Z" fill="#43816b"/><ellipse cx="65" cy="45" rx="36" ry="8" fill="#2a5e4c"/><ellipse cx="65" cy="45" rx="30" ry="5" fill="#b98452"/></svg></div>
      <div className="preview-word" lang="ru">Я хочу́ чай.</div><div className="preview-pronunciation">ya kha-CHOO chai</div><div className="preview-meaning">I want tea.</div>
      <button className="preview-listen" onClick={()=>speech.available?speech.speak('Я хочу чай.'):setNotice('Russian browser audio is unavailable. Every lesson works with text.')}><SoundIcon/> {speech.available?'Hear it in Russian':'Explore with text'} <span>↗</span></button>
      <div className="phone-home"/>
     </div>
     <div className="hero-robot"><div className="speech-bubble" lang="ru">Привет! <span>Hi, you.</span></div><Companion/><div className="simulation-tag"><span/> Simulated companion</div></div>
     <span className="hand-note note-bottom">A little company.<br/>A lot of encouragement.</span>
    </div>
   </section>
   <div className="benefit-strip"><div className="wrap"><span><i>01</i> Real words, from day one</span><span className="strip-asterisk">✳</span><span><i>02</i> A few minutes, all yours</span><span className="strip-asterisk">✳</span><span><i>03</i> Better together. Great solo.</span></div></div>
   <section className="demo-section wrap" aria-labelledby="demo-title">
    <div className="section-heading"><div><div className="eyebrow">01 / A TASTE OF RUSSIAN</div><h2 id="demo-title">Your first café visit.<br/><span className="serif-accent">On the house.</span></h2></div><p>Five small steps. A few useful words.<br/>And that first “I just said something in Russian” feeling. No account needed.</p></div>
    <div className="lesson-layout" id="demo">
     <div className="lesson-device-stage">
      <div className="lesson-device-caption"><span><i/> INTERACTIVE APP PREVIEW</span><span>Go on, tap around ↘</span></div>
      <div className="lesson-phone">
       <span className="phone-hardware-key key-silent" aria-hidden="true"/><span className="phone-hardware-key key-volume-up" aria-hidden="true"/><span className="phone-hardware-key key-volume-down" aria-hidden="true"/><span className="phone-hardware-key key-power" aria-hidden="true"/>
       <div className="lesson-phone-screen">
        <div className="ios-status-bar" aria-hidden="true"><span>9:41</span><div className="ios-island"><i/></div><div className="ios-system-icons"><svg viewBox="0 0 19 13"><path d="M1 12V9h3v3zm5 0V6h3v6zm5 0V3h3v9zm5 0V0h3v12z" fill="currentColor"/></svg><svg viewBox="0 0 17 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 4q7.5-6 15 0M4 7q4.5-4 9 0M7 10q1.5-1.5 3 0"/><circle cx="8.5" cy="12" r=".7" fill="currentColor" stroke="none"/></svg><span className="ios-battery"><i/></span></div></div>
        <div className="lesson-panel">
         <div className="app-navigation"><a href="#demo-title" className="app-icon-button" aria-label="Leave the lesson preview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m7 7 10 10M17 7 7 17"/></svg></a><div><span>{PRODUCT.name}</span><strong>Café essentials</strong></div><button className={`app-icon-button ${lessonSettings?'active':''}`} onClick={()=>setLessonSettings(v=>!v)} aria-label="Lesson display settings" aria-expanded={lessonSettings} aria-controls="lesson-display-settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="2.5" fill="currentColor" stroke="none"/></svg></button></div>
         {lessonSettings&&<div className="app-settings" id="lesson-display-settings"><div><strong>Make it yours</strong><button onClick={()=>setLessonSettings(false)} aria-label="Close lesson settings">Done</button></div><div className="display-options"><label><input type="checkbox" checked={preferences.stress} onChange={e=>setPreferences(p=>({...p,stress:e.target.checked}))}/> Stress marks</label><label><input type="checkbox" checked={preferences.pronunciation} onChange={e=>setPreferences(p=>({...p,pronunciation:e.target.checked}))}/> Pronunciation help</label></div><button className="app-restart" onClick={()=>{restart();setLessonSettings(false);if(lessonScroll.current)lessonScroll.current.scrollTop=0;}}>↻ Start this lesson again</button></div>}
         <div className="app-progress-track" aria-label={`Lesson progress: ${progress.complete?5:progress.index} of 5 steps complete`}>{lesson.map((step,i)=><span key={step.id} className={i<(progress.complete?5:progress.index)?'done':i===progress.index?'current':''}/>)}</div>
         <div className="lesson-scroll" ref={lessonScroll} key={progress.complete?'complete':exercise.id}>
      <div className="lesson-step-count">{progress.complete?'LESSON COMPLETE':`STEP ${progress.index+1} OF 5`}<span>{progress.complete?'Nice work, you.':'BEGINNER · ABOUT 3 MIN'}</span></div>
      {progress.complete?<div className="completion"><span className="completion-mark">✳</span><h3 ref={lessonHeading} tabIndex={-1}>A small lesson.<br/>A real beginning.</h3><p>You greeted someone, ordered tea, and said thank you.</p><div className="score"><strong>{progress.results.filter(Boolean).length}<span>/ 5</span></strong><span>steps completed<br/>on your first try</span></div><div className="review-box"><strong>{progress.results.every(Boolean)?'Everything clicked!':'A little more practice'}</strong>{progress.results.every(Boolean)?<p>Try saying Я хочу чай. next time you make a cup.</p>:<ul>{lesson.filter((_,i)=>!progress.results[i]).map(item=><li key={item.id}>{item.review}</li>)}</ul>}</div><button className="button teal" onClick={restart}>Replay the lesson <span>↻</span></button><p className="local-note">Completion saved on this browser only.</p></div>:<>
       <h3 ref={lessonHeading} tabIndex={-1}>{exercise.title}</h3><p className="exercise-instruction">{listening?'Listen to the word, then choose its meaning.':exercise.instruction}</p>

       <div className="exercise-content">
        {exercise.kind==='vocabulary'&&<div className="vocab-grid">{words.map((w,i)=><div className={`vocab-card ${revealed.includes(w.id)?'revealed':''}`} key={w.id}><button className="vocab-reveal" aria-expanded={revealed.includes(w.id)} onClick={()=>{setRevealed(r=>r.includes(w.id)?r:r.concat(w.id));setVocabularyWord(w.text);}}><span className="vocab-row-icon" aria-hidden="true">{["↗","♨","☕","Aa","♡"][i]}</span><span className="vocab-row-text"><span lang="ru">{display(w.id)}</span>{preferences.pronunciation&&<small>{w.pronunciation}</small>}<span className="word-meaning">{revealed.includes(w.id)?w.meaning:'Tap to reveal'}</span></span><span className="vocab-row-check" aria-hidden="true">{revealed.includes(w.id)?'✓':'+'}</span></button>{speech.available&&<button className="word-audio" aria-label={`Listen to ${w.meaning}`} onClick={()=>speech.speak(w.text)}><SoundIcon/></button>}</div>)}</div>}
        {exercise.id==='meaning'&&<><div className="question-word"><span lang="ru">{listening?'Listen, then choose…':display('coffee')}</span>{preferences.pronunciation&&!listening&&<small>{words[2].pronunciation}</small>}{speech.available&&<button className="round-audio" aria-label="Hear coffee in Russian" onClick={()=>speech.speak('кофе')}><SoundIcon/></button>}</div>{speech.available&&<label className="listening-toggle"><input type="checkbox" checked={listening} onChange={e=>{setListening(e.target.checked);if(e.target.checked)speech.speak('кофе');}}/> Try listening instead of reading</label>}</>}
        {exercise.kind==='choice'&&<>{exercise.id==='exchange'&&<div className="exchange"><span>BARISTA</span><p lang="ru">Ваш чай. <span aria-hidden="true">☕</span></p><small>Here is your tea.</small></div>}<div className="choices">{exercise.choices.map((choice,i)=><button className={`choice ${selected===choice?'selected':''}`} aria-pressed={selected===choice} disabled={!!progress.feedback} key={choice} onClick={()=>{setSelected(choice);setThinkingAt(progress.index);}}><span className="choice-number">{i+1}</span><span lang={exercise.id==='exchange'?'ru':undefined}>{preferences.stress&&choice==='Спасибо!'?'Спаси́бо!':preferences.stress&&choice==='Привет!'?'Приве́т!':preferences.stress&&choice==='Я хочу чай.'?'Я хочу́ чай.':choice}</span><span className="selection-indicator">{selected===choice?'✓':''}</span></button>)}</div></>}
        {exercise.kind==='sentence'&&<><div className="sentence-prompt">“I want tea.”</div><div className="sentence-answer" aria-label="Your sentence">{tokens.length===0?<span>Build your sentence here</span>:tokens.map((t,i)=><button key={t} disabled={!!progress.feedback} onClick={()=>setTokens(ts=>ts.filter((_,j)=>j!==i))} aria-label={`Remove ${t}`} lang="ru">{t==='хочу'&&preferences.stress?'хочу́':t} <small>×</small></button>)}</div><div className="word-bank">{exercise.tokens.map(t=><button key={t} disabled={tokens.includes(t)||!!progress.feedback} onClick={()=>{setTokens(ts=>[...ts,t]);setThinkingAt(progress.index);}} lang="ru">{t==='хочу'&&preferences.stress?'хочу́':t}</button>)}</div>{preferences.pronunciation&&(hintRequested||progress.feedback==='correct')&&<p className="pronunciation-guide">Я · ya &nbsp; / &nbsp; хочу́ · kha-CHOO &nbsp; / &nbsp; чай · chai</p>}<p className="small-tip">Tap a selected word to put it back.</p></>}
        {exercise.kind==='typed'&&<><label className="translation-label" htmlFor="translation">“Thank you!”</label><input id="translation" ref={inputRef} className="translation-input" value={selected} placeholder="Type in Russian…" lang="ru" autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={!!progress.feedback} onKeyDown={e=>{if(e.key==='Enter')check();}} onChange={e=>{setSelected(e.target.value);setThinkingAt(progress.index);}}/><div className="letter-bank" aria-label="Russian letter helpers">{['с','п','а','и','б','о'].map(letter=><button disabled={!!progress.feedback} key={letter} onClick={()=>{setSelected(s=>s+letter);inputRef.current?.focus();}} lang="ru">{letter}</button>)}<button aria-label="Delete last letter" disabled={!!progress.feedback||!selected} onClick={()=>setSelected(s=>Array.from(s).slice(0,-1).join(''))}>⌫</button></div>{preferences.pronunciation&&(hintRequested||progress.feedback==='correct')&&<p className="pronunciation-guide">A little hint: spa-SEE-ba</p>}</>}
       </div>
       {'hint' in exercise&&progress.feedback!=='correct'&&<div className="lesson-hint"><button className="lesson-hint-button" onClick={()=>setHintAt(progress.index)} aria-expanded={hintRequested} aria-controls="lesson-hint-text" disabled={hintRequested}>{hintRequested?'Hint shown':'Show a hint'} <span aria-hidden="true">?</span></button>{hintRequested&&<p id="lesson-hint-text" role="status">{exercise.hint}</p>}</div>}
       <div className={`feedback ${progress.feedback||''}`} aria-live="polite" aria-atomic="true">{progress.feedback?<><strong>{incorrect?'A little practice. You’ve got this.':'✓  That’s it!'}</strong><p>{incorrect?('retryFeedback' in exercise?exercise.retryFeedback:'Reveal each word and try again.'):exercise.success}</p></>:<p>{exercise.kind==='vocabulary'?`${revealed.length} of ${words.length} expressions explored. Reveal all five, then check in.`:'Take your time. Small steps count.'}</p>}</div>

      </>}
         </div>
         {!progress.complete&&<div className="lesson-bottom"><span className="app-audio-note">{speech.available?<><SoundIcon/> Browser voice · optional</>:'No Russian browser voice · use text'}</span>{progress.feedback?<button className="button teal" onClick={()=>{if(incorrect){if(lessonScroll.current)lessonScroll.current.scrollTop=0;dispatch({type:'retry'});setThinkingAt(null);}else{setSelected('');setTokens([]);setListening(false);dispatch({type:'continue'});}}}>{incorrect?'Try again':'Continue'} <span>→</span></button>:<button className="button teal" disabled={!ready} onClick={check}>Check answer <span>→</span></button>}</div>}
         <div className="ios-home-area" aria-hidden="true"><span/></div>
        </div>
       </div>
      </div>
      <div className="lesson-device-note"><span>iOS app concept</span><span>Live in your browser. No download needed.</span></div>
     </div>
     <aside className="lesson-side"><div className="demo-connection"><span className="live-dot"/> Demo connection</div><Companion state={reaction.state} text={reaction.text}/><span className="simulation-tag">Simulated companion</span><div className="companion-message" aria-live="polite">{progress.complete?'Look at you, making conversation.':incorrect?'No rush. Let’s give it another try.':progress.feedback==='correct'?'One small win. Keep going!':'I’m here for the little wins.'}</div><p>The words stay on your phone.<br/>The encouragement sits on your desk.</p><div className="solo-note"><span>↳</span> More of a solo learner? The app works beautifully on its own.</div></aside>
    </div>
    <div className="demo-footnote"><span>✧ A concept you can actually try. No account. No personal data collected.</span><span>{saved.completion?'You’ve completed the demo on this browser.':'Made for curious beginners.'}</span></div>
   </section>
   <section className="approach-section" id="approach" aria-labelledby="approach-title"><div className="wrap"><div className="section-heading"><div><div className="eyebrow">02 / SMALL STEPS, REAL LANGUAGE</div><h2 id="approach-title">Less memorising.<br/><span className="serif-accent">More “oh, I get it.”</span></h2></div><p>A learning approach built around moments you’ll actually use. Start with a café. Take it from there.</p></div><div className="approach-grid">
    <article><span className="feature-number">01 / GET FAMILIAR</span><div className="letter-example"><span lang="ru">Я</span><span className="letter-arrow">→</span><span>ya<small>“I”</small></span></div><h3>A new alphabet. One hello at a time.</h3><p>Meet Cyrillic inside useful words. Start with Я (“I”), then put it to work in your very first order.</p></article>
    <article><span className="feature-number">02 / FIND YOUR VOICE</span><div className="stress-example" lang="ru">спа<span>си́</span>бо<small>spa-<b>SEE</b>-ba</small></div><h3>A little help, when you want it.</h3><p>Turn on stress marks to see where the emphasis goes. Pronunciation hints are there until you don’t need them.</p></article>
    <article><span className="feature-number">03 / MAKE IT USEFUL</span><div className="grammar-example"><span lang="ru">Я <b>хочу</b> чай.</span><small>I <b>want</b> tea.</small></div><h3>Grammar with somewhere to go.</h3><p>Я means “I.” Хочу means “want.” Put them together with чай, and you’ve got a real café order.</p></article>
    <article><span className="feature-number">04 / COME BACK STRONGER</span><div className="review-example"><span>↻</span><div lang="ru">кофе <small>coffee, not tea</small></div><i>↗</i></div><h3>Your mistakes make the next step.</h3><p>Mix up coffee and tea? The demo keeps that in your practice list. Future reviews will build on these little discoveries.</p></article>
   </div></div></section>
   <section className="companion-section wrap" id="companion" aria-labelledby="companion-title">
    <div className="companion-playground"><div className="planned-label">A LITTLE HARDWARE, STILL A PLAN</div><div className="companion-stage"><span className="stage-doodle doodle-one">✳</span><Companion state={meetReaction.state} text={meetReaction.text}/><span className="hardware-callout callout-screen">Small OLED.<br/>Big personality.<i/></span><span className="hardware-callout callout-button">A button.<br/>A little nudge.<i/></span></div><div className="playground-label"><span className="live-dot"/> Simulated companion <span>· Demo connection</span></div><div className="companion-controls"><button onClick={()=>meet('word')}>Aa <span>Show a word</span></button><button onClick={()=>meet('tilt')}>↶ <span>Tilt head</span></button><button onClick={()=>meet('celebrate')}>✧ <span>Celebrate</span></button></div><span className="playground-caption">Go on. Say hello.</span></div>
    <div className="companion-copy"><div className="eyebrow">03 / A LITTLE COMPANY</div><h2 id="companion-title">Learning has<br/>a new <span className="serif-accent">desk mate.</span></h2><p>Some days, a tiny encouraging face makes all the difference. Meet the optional companion we’re imagining for {PRODUCT.name}.</p><dl><div><dt><span>01</span> A small screen, a shared moment.</dt><dd>A planned OLED shows a word, a prompt, or a happy little reaction. Longer lessons stay on your iPhone.</dd></div><div><dt><span>02</span> A little movement goes a long way.</dt><dd>One servo tilts the head. Buttons offer simple interactions. Correct answer? Picture a small, delighted nod.</dd></div><div><dt><span>03</span> Your phone does the heavy lifting.</dt><dd>The planned ESP32 companion connects over Bluetooth Low Energy. The app handles audio, lessons, and checking answers.</dd></div></dl><div className="honesty-note"><span>↳</span><p><strong>Optional by design.</strong> No companion needed to learn. Everything here is a browser simulation; physical hardware and BLE integration are planned.</p></div></div>
   </section>
   <section className="closing-section"><div className="wrap"><div className="closing-top"><div className="eyebrow">A WORK IN PROGRESS. A GOOD PLACE TO START.</div><span className="closing-flower" aria-hidden="true">✳</span></div><h2>Every conversation<br/>starts with <span className="serif-accent" lang="ru">привет.</span></h2><div className="closing-bottom"><p>This is the first chapter of {PRODUCT.name}. Try the lesson, notice what clicks, and imagine where a few minutes a day could take you.</p><a className="button dark" href="#demo" onClick={restart}>Give it another go <Arrow/></a></div><div className="roadmap" aria-label="Project roadmap"><div className="current"><span>01 <i>WE ARE HERE</i></span><strong>Web concept</strong></div><span className="roadmap-arrow">→</span><div><span>02</span><strong>iOS prototype</strong></div><span className="roadmap-arrow">→</span><div><span>03</span><strong>Hardware integration</strong></div><span className="roadmap-arrow">→</span><div><span>04</span><strong>Learner pilot</strong></div></div></div></section>
  </main>
  <footer className="wrap"><a className="wordmark" href="#"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></a><p>A little Russian. A little every day.</p><div><span>Independent concept · {new Date().getFullYear()}</span><button onClick={resetAll}>Reset saved demo data</button></div></footer>
  <div className="global-notice" role="status">{notice&&<><span>{notice}</span><button aria-label="Dismiss notice" onClick={()=>setNotice('')}>×</button></>}</div>
 </>;
}
export default App;
