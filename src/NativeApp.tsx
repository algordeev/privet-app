import {useEffect,useRef,useState} from 'react';
import {PRODUCT} from './config';
import {lesson} from './lesson';
import {Companion} from './Companion';
import {LessonPanel} from './LessonPanel';
import {useLesson,type LessonController} from './useLesson';
import {useNativeViewport} from './useNativeViewport';

export function NativeHome({controller,onStart}:{controller:LessonController;onStart:()=>void}) {
 const {progress,revealed,selected,tokens,restart}=controller;
 const started=progress.index>0||progress.attempts>0||revealed.length>0||!!selected||tokens.length>0;
 return <div className="native-home-scroll">
  <header className="native-home-header"><div className="wordmark"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></div><span className="native-level">BEGINNER RUSSIAN</span></header>
  <section className="native-welcome" aria-labelledby="native-home-title"><p className="native-kicker">A LITTLE PRACTICE, ALL YOURS.</p><h1 id="native-home-title" tabIndex={-1}><span lang="ru">Привет!</span><span>Let’s make a little progress.</span></h1><p>A few useful words. A small conversation. Start wherever you left off.</p></section>
  <section className="native-lesson-card" aria-labelledby="native-card-title">
   <div className="native-card-top"><span className="native-cup" aria-hidden="true">☕</span><span>LESSON 01 · ABOUT 3 MIN</span></div>
   <h2 id="native-card-title">Café essentials</h2><p>Say hello, order something warm, and say thank you.</p>
   <div className="native-card-progress"><span>{progress.complete?'Lesson complete':started?`Step ${progress.index+1} of ${lesson.length}`:'Five small steps'}</span>{started&&<span>{progress.complete?`${progress.results.filter(Boolean).length} / 5 first try`:'Progress saved'}</span>}</div>
   <progress max={lesson.length} value={progress.index} aria-label="Café essentials lesson progress"/>
   <button className="button teal" onClick={onStart}>{progress.complete?'See your results':started?'Continue lesson':'Start lesson'}<span aria-hidden="true">→</span></button>
   {progress.complete&&<button className="native-text-button" onClick={()=>{restart();onStart();}}>Practise again</button>}
  </section>
  <aside className="native-companion-card"><div className="native-home-robot"><Companion/></div><div><strong>Simulated companion</strong><p>A little encouragement while you learn. The physical desk companion is planned.</p></div></aside>
  <div className="native-home-footer"><p>Your progress stays on this iPhone.</p><button className="native-text-button" onClick={controller.resetAll}>Reset saved lesson &amp; preferences</button></div>
 </div>;
}

export function NativeApp() {
 const controller=useLesson({persistSession:true});
 const [view,setView]=useState<'home'|'lesson'>('home');
 const root=useRef<HTMLElement>(null);
 useNativeViewport(root);
 useEffect(()=>{
  if(view==='lesson')controller.lessonHeading.current?.focus({preventScroll:true});
  else root.current?.querySelector<HTMLElement>('#native-home-title')?.focus({preventScroll:true});
 },[view,controller.lessonHeading]);
 function closeLesson(){controller.speech.stop();controller.setLessonSettings(false);setView('home');}
 return <main className="native-app" ref={root} data-view={view}>
  {view==='home'?<NativeHome controller={controller} onStart={()=>{controller.setNotice('');setView('lesson');}}/>:<div className="native-lesson-view"><LessonPanel controller={controller} native onClose={closeLesson}/></div>}
  {controller.notice&&<div className="native-notice" role="status"><span>{controller.notice}</span><button onClick={()=>controller.setNotice('')} aria-label="Dismiss notice">×</button></div>}
 </main>;
}
