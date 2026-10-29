import {useEffect,useRef,useState} from 'react';
import {PRODUCT} from './config';
import {words} from './lesson';
import {companionReaction} from './engine';
import {Companion} from './Companion';
import {CompanionGallery} from './CompanionGallery';
import {useLesson} from './useLesson';
import {LessonPanel} from './LessonPanel';
import {SoundIcon} from './Icons';

function Arrow() {return <span aria-hidden="true">↗</span>;}

function App(){
 const controller=useLesson();
 const {saved,progress,reaction,notice,setNotice,speech,restart,resetAll,incorrect}=controller;
 const [meetReaction,setMeetReaction]=useState(companionReaction({type:'reset'}));
 const [menu,setMenu]=useState(false);
 const wordIndex=useRef(0); const meetTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(meetTimer.current)clearTimeout(meetTimer.current);},[]);
 function meet(type:'word'|'tilt'|'celebrate'){
  if(meetTimer.current)clearTimeout(meetTimer.current);
  setMeetReaction(companionReaction(type==='word'?{type:'prompt',text:words[wordIndex.current++%words.length].text}:type==='tilt'?{type:'thinking'}:{type:'complete'}));
  meetTimer.current=setTimeout(()=>setMeetReaction(companionReaction({type:'reset'})),4500);
 }
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
     <div className="concept-label"><span className="apple-outline" aria-hidden="true">◉</span> iOS prototype <span>·</span> Interactive web demo</div>
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
      <div className="preview-word" lang="ru">Я хочу́ чай.</div><div className="preview-pronunciation">ya ha-CHU chai</div><div className="preview-meaning">I want tea.</div>
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
        <LessonPanel controller={controller}/>
       </div>
      </div>
     </div>
     <aside className="lesson-side"><div className="demo-connection"><span className="live-dot"/> Demo connection</div><Companion state={reaction.state} text={reaction.text}/><div className="lesson-companion-details"><span className="simulation-tag">Simulated companion</span><div className="companion-message" aria-live="polite">{progress.complete?'Look at you, making conversation.':incorrect?'No rush. Let’s give it another try.':progress.feedback==='correct'?'One small win. Keep going!':'I’m here for the little wins.'}</div><p>The words stay on your phone.<br/>The encouragement sits on your desk.</p><div className="solo-note"><span>↳</span> More of a solo learner? The app works beautifully on its own.</div></div></aside>
    </div>
    <div className="demo-footnote"><span>✧ A concept you can actually try. No account. No personal data collected.</span><span>{saved.completion?'You’ve completed the demo on this browser.':'Made for curious beginners.'}</span></div>
   </section>
   <section className="approach-section" id="approach" aria-labelledby="approach-title"><div className="wrap"><div className="section-heading"><div><div className="eyebrow">02 / SMALL STEPS, REAL LANGUAGE</div><h2 id="approach-title">Less memorising.<br/><span className="serif-accent">More “oh, I get it.”</span></h2></div><p>A learning approach built around moments you’ll actually use. Start with a café. Take it from there.</p></div><div className="approach-grid">
    <article><span className="feature-number">01 / GET FAMILIAR</span><div className="letter-example"><span lang="ru">Я</span><span className="letter-arrow">→</span><span>ya<small>“I”</small></span></div><h3>A new alphabet. One hello at a time.</h3><p>Meet Cyrillic inside useful words. Start with Я (“I”), then put it to work in your very first order.</p></article>
    <article><span className="feature-number">02 / FIND YOUR VOICE</span><div className="stress-example" lang="ru">спа<span>си́</span>бо<small>spa-<b>SEE</b>-ba</small></div><h3>A little help, when you want it.</h3><p>Turn on stress marks to see where the emphasis goes. Pronunciation hints are there until you don’t need them.</p></article>
    <article><span className="feature-number">03 / MAKE IT USEFUL</span><div className="grammar-example"><span lang="ru">Я <b>хочу</b> чай.</span><small>I <b>want</b> tea.</small></div><h3>Grammar with somewhere to go.</h3><p>Я means “I.” Хочу means “want.” Put them together with чай, and you’ve got a real café order.</p></article>
    <article><span className="feature-number">04 / COME BACK STRONGER</span><div className="review-example"><span>↻</span><div lang="ru">кофе <small>coffee, not tea</small></div><i>↗</i></div><h3>Your mistakes make the next step.</h3><p>Mix up coffee and tea? The demo keeps that in your practice list. Future reviews will build on these little discoveries.</p></article>
   </div></div></section>
   <section className="product-features wrap" aria-labelledby="features-title"><div className="section-heading"><div><div className="eyebrow">03 / MADE FOR YOUR FIRST STEPS</div><h2 id="features-title">Small lessons.<br/><span className="serif-accent">Room to grow.</span></h2></div><p>Try the café lesson here. The iPhone prototype adds a second lesson, local progress, and optional hardware reactions.</p></div><div className="product-feature-grid">
    <article><h3>A little Russian, ready to go.</h3><p>Two bundled iPhone lessons cover café orders and introductions. Optional stress marks, pronunciation help, and a Russian system voice support your practice. No account needed.</p></article>
    <article><h3>Progress, at your pace.</h3><p>The iPhone app records hearts, XP, streaks, and gems locally. A heart refill costs 20 gems; a streak freeze costs 30 gems. Privet Plus is a local unlimited-hearts demo with no payment processing.</p></article>
    <article><h3>A companion, if you’d like.</h3><p>The robot on this website is simulated. The working iPhone + ESP32 prototype displays OLED emotions and moves its screen with a servo. Learning also works without hardware.</p></article>
   </div></section>
   <section className="companion-section wrap" id="companion" aria-labelledby="companion-title">
    <div className="companion-playground"><div className="planned-label">BROWSER SIMULATION · HARDWARE PROTOTYPE</div><div className="companion-stage"><span className="stage-doodle doodle-one">✳</span><Companion state={meetReaction.state} text={meetReaction.text}/><span className="hardware-callout callout-screen">Small OLED.<br/>Big personality.<i/></span><span className="hardware-callout callout-button">A button.<br/>A little nudge.<i/></span></div><div className="playground-label"><span className="live-dot"/> Simulated companion <span>· Demo connection</span></div><div className="companion-controls"><button onClick={()=>meet('word')}>Aa <span>Show a word</span></button><button onClick={()=>meet('tilt')}>↶ <span>Tilt head</span></button><button onClick={()=>meet('celebrate')}>✧ <span>Celebrate</span></button></div><span className="playground-caption">Go on. Say hello.</span></div>
    <div className="companion-copy"><div className="eyebrow">04 / A LITTLE COMPANY</div><h2 id="companion-title">Learning has<br/>a new <span className="serif-accent">desk mate.</span></h2><p>Some days, a tiny encouraging face makes all the difference. Meet the optional ESP32 companion prototype for {PRODUCT.name}.</p><dl><div><dt><span>01</span> A small screen, a shared moment.</dt><dd>The working electronics prototype shows predefined OLED faces. Words and prompts in this browser simulation illustrate future text support. Lessons stay on your iPhone.</dd></div><div><dt><span>02</span> A little movement goes a long way.</dt><dd>The prototype’s servo moves the screen with its emotions. Buttons and the pictured enclosure remain planned.</dd></div><div><dt><span>03</span> Your phone does the heavy lifting.</dt><dd>The iPhone app connects to the ESP32 prototype over Bluetooth Low Energy. The app handles audio, lessons, and checking answers.</dd></div></dl><div className="honesty-note"><span>↳</span><p><strong>Optional by design.</strong> No companion needed to learn. The website robot is simulated. The project owner has tested iPhone BLE, lesson reactions, and servo motion on the electronics prototype; the enclosure remains a concept.</p></div></div>
    <CompanionGallery/>
   </section>
   <section className="closing-section"><div className="wrap"><div className="closing-top"><div className="eyebrow">A WORK IN PROGRESS. A GOOD PLACE TO START.</div><span className="closing-flower" aria-hidden="true">✳</span></div><h2>Every conversation<br/>starts with <span className="serif-accent" lang="ru">привет.</span></h2><div className="closing-bottom"><p>This is the first chapter of {PRODUCT.name}. Try the lesson, notice what clicks, and imagine where a few minutes a day could take you.</p><a className="button dark" href="#demo" onClick={restart}>Give it another go <Arrow/></a></div><div className="roadmap" aria-label="Project roadmap"><div className="complete"><span>01 <i>DONE</i></span><strong>Web concept</strong></div><span className="roadmap-arrow" aria-hidden="true">→</span><div className="complete"><span>02 <i>DONE</i></span><strong>iOS prototype</strong></div><span className="roadmap-arrow" aria-hidden="true">→</span><div className="current" aria-current="step"><span>03 <i>WE ARE HERE</i></span><strong>Hardware integration</strong></div><span className="roadmap-arrow" aria-hidden="true">→</span><div className="upcoming"><span>04 <i>NEXT</i></span><strong>Learner pilot</strong></div></div></div></section>
  </main>
  <footer className="wrap"><a className="wordmark" href="#"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></a><p>A little Russian. A little every day.</p><div><span>Independent concept · {new Date().getFullYear()}</span><button onClick={resetAll}>Reset saved demo data</button></div></footer>
  <div className="global-notice" role="status">{(notice||speech.message)&&<><span>{notice||speech.message}</span><button aria-label="Dismiss notice" onClick={()=>{setNotice('');speech.stop();}}>×</button></>}</div>
 </>;
}
export default App;
