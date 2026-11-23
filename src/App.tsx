import {Fragment,useState} from 'react';
import {websiteCafeLesson} from './curriculum/catalog';
import {LEGAL,PRODUCT} from './config';
import {Companion} from './Companion';
import {useLesson} from './useLesson';
import {LessonPanel} from './LessonPanel';
import {SoundIcon} from './Icons';
import {CourseSection,FamilySection,PlansSection,ScreensSection,Ticker,useReveal} from './SiteSections';
import {roadmap} from './siteContent';

function Arrow() {return <span aria-hidden="true">↗</span>;}

// A tiny version of the printer from the device family, feeding out a word card.
function HeroPrinter(){
 return <div className="hero-printer" aria-hidden="true">
  <div className="hero-paper"><span className="hero-paper-roll"><b lang="ru">спасибо</b><small>thank you</small><i/></span></div>
  <div className="hero-printer-body"><span className="hero-printer-slot"/><span className="hero-printer-face"><i/><i/><b>ω</b></span><span className="hero-printer-led"/></div>
 </div>;
}

function App(){
 const controller=useLesson({definition:websiteCafeLesson});
 const {saved,progress,reaction,notice,setNotice,speech,restart,resetAll,incorrect}=controller;
 const [menu,setMenu]=useState(false);
 useReveal();
 const close=()=>setMenu(false);
 return <>
  <a className="skip-link" href="#demo">Skip to lesson</a>
  <header className="site-header wrap">
   <a className="wordmark" href="#" aria-label={`${PRODUCT.name} home`}><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></a>
   <button className="menu-toggle" onClick={()=>setMenu(!menu)} aria-expanded={menu} aria-controls="navigation">{menu?'Close':'Menu'} <span>☰</span></button>
   <nav id="navigation" className={menu?'open':''} aria-label="Main navigation"><a href="#course" onClick={close}>The course</a><a href="#app" onClick={close}>Inside the app</a><a href="#devices" onClick={close}>Devices</a><a href="#plans" onClick={close}>Plans</a></nav>
   <a className="button dark header-cta" href="#demo">Try a lesson <Arrow/></a>
  </header>
  <main>
   <section className="hero wrap" aria-labelledby="hero-title">
    <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> A SMALL START. A WHOLE NEW LANGUAGE.</div>
     <h1 id="hero-title">A little Russian.<br/>A little <span className="serif-accent">every day.</span></h1>
     <p>From your first <span lang="ru">привет</span> to everyday conversations. Eight short lessons, a review that remembers what you missed, and, if you’d like, a desk robot, a keychain and a little printer cheering you on.</p>
     <div className="hero-actions"><a href="#demo" className="button teal">Try a lesson <Arrow/></a><a className="text-link" href="#devices">Meet the family <span aria-hidden="true">↓</span></a></div>
     <div className="concept-label"><span className="apple-outline" aria-hidden="true">◉</span> iOS app <span>·</span> 3 Bluetooth devices <span>·</span> Interactive web demo</div>
    </div>
    <div className="hero-art">
     <div className="orbital-ring"/><span className="hero-star star-one" aria-hidden="true">✳</span>
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
     <HeroPrinter/>
     <div className="hero-robot"><div className="speech-bubble" lang="ru">Привет! <span>Hi, you.</span></div><Companion/></div>
     <span className="hand-note note-bottom">A little company.<br/>A lot of encouragement.</span>
    </div>
   </section>
   <Ticker/>
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
   <CourseSection/>
   <section className="approach-section" id="approach" aria-labelledby="approach-title"><div className="wrap"><div className="section-heading" data-reveal><div><div className="eyebrow">03 / SMALL STEPS, REAL LANGUAGE</div><h2 id="approach-title">Less memorising.<br/><span className="serif-accent">More “oh, I get it.”</span></h2></div><p>A learning approach built around moments you’ll actually use. Start with a café. Take it from there.</p></div><div className="approach-grid site-approach-grid">
    <article data-reveal><span className="feature-number">GET FAMILIAR</span><div className="letter-example"><span lang="ru">Я</span><span className="letter-arrow">→</span><span>ya<small>“I”</small></span></div><h3>A new alphabet. One hello at a time.</h3><p>Meet Cyrillic inside useful words. A two-screen quick start covers the letters of your first lesson, and the АБВ guide is a tap away in every lesson.</p></article>
    <article data-reveal><span className="feature-number">FIND YOUR VOICE</span><div className="stress-example" lang="ru">спа<span>си́</span>бо<small>spa-<b>SEE</b>-ba</small></div><h3>A little help, when you want it.</h3><p>Turn on stress marks to see where the emphasis goes. Pronunciation hints sit under every line until you don’t need them, and a Russian voice reads it aloud.</p></article>
    <article data-reveal><span className="feature-number">MAKE IT USEFUL</span><div className="grammar-example"><span lang="ru">Я <b>хочу</b> чай.</span><small>I <b>want</b> tea.</small></div><h3>Grammar with somewhere to go.</h3><p>Я means “I.” Хочу means “want.” Put them together with чай, and you’ve got a real café order.</p></article>
    <article data-reveal><span className="feature-number">COME BACK STRONGER</span><div className="review-example"><span>↻</span><div lang="ru">кофе <small>coffee, not tea</small></div><i>↗</i></div><h3>Your mistakes make the next step.</h3><p>Mix up coffee and tea? Review brings it back tomorrow, then less often as it sticks. Review never costs a heart.</p></article>
    <article data-reveal><span className="feature-number">KEEP IT FRESH</span><div className="site-kinds-example" aria-hidden="true"><span>Aa</span><span>☑</span><span>⇄</span><span>⌨</span><span>♪</span><span>⋈</span></div><h3>Six ways to practise.</h3><p>Reveal words, pick the meaning, build a sentence, type it, listen and choose, match the pairs. Each lesson mixes them.</p></article>
    <article data-reveal><span className="feature-number">LITTLE WINS</span><div className="site-wins-example" aria-hidden="true"><span className="site-win-hearts">♥♥♥</span><span className="site-win-combo">×<b>5</b> combo</span><span className="site-win-streak">6 days</span><span className="site-win-gems">45</span></div><h3>Hearts, combos and a streak.</h3><p>Three hearts per lesson, XP for first-try combos, a daily streak with freezes for busy days, and gems you earn by learning.</p></article>
   </div></div></section>
   <ScreensSection/>
   <FamilySection/>
   <PlansSection/>
   <section className="closing-section"><div className="wrap"><div className="closing-top"><div className="eyebrow">A WORK IN PROGRESS. A GOOD PLACE TO START.</div><span className="closing-flower" aria-hidden="true">✳</span></div><h2>Every conversation<br/>starts with <span className="serif-accent" lang="ru">привет.</span></h2><div className="closing-bottom"><p>{PRODUCT.name} is a work in progress: an iPhone app, eight lessons and three little devices so far. Try the lesson, notice what clicks, and imagine where a few minutes a day could take you.</p><a className="button dark" href="#demo" onClick={restart}>Give it another go <Arrow/></a></div><div className="roadmap" aria-label="Project roadmap">{roadmap.map((step,index)=><Fragment key={step.label}>{index>0&&<span className="roadmap-arrow" aria-hidden="true">→</span>}<div className={step.state==='done'?'complete':step.state==='current'?'current':'upcoming'} aria-current={step.state==='current'?'step':undefined}><span>{String(index+1).padStart(2,'0')} <i>{step.state==='done'?'DONE':step.state==='current'?'WE ARE HERE':'NEXT'}</i></span><strong>{step.label}</strong></div></Fragment>)}</div></div></section>
  </main>
  <footer className="wrap"><a className="wordmark" href="#"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></a><p>A little Russian. A little every day.</p><div><nav className="site-legal" aria-label="Help and legal"><a href="support.html">Support</a><a href="privacy.html">Privacy Policy</a><a href={LEGAL.terms} target="_blank" rel="noopener noreferrer">Terms of Use</a></nav><span>Independent app · {new Date().getFullYear()}</span><button onClick={resetAll}>Reset saved demo data</button></div></footer>
  <div className="global-notice" role="status">{(notice||speech.message)&&<><span>{notice||speech.message}</span><button aria-label="Dismiss notice" onClick={()=>{setNotice('');speech.stop();}}>×</button></>}</div>
 </>;
}
export default App;
