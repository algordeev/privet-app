import {useEffect,useRef,useState} from 'react';
import {PRODUCT} from './config';
import {lesson} from './lesson';
import {NativeRobot} from './NativeRobot';
import {homeGreeting,lessonStarted} from './nativeCompanion';
import {useNativeCompanion,type NativeCompanionController} from './useNativeCompanion';
import {LessonPanel} from './LessonPanel';
import {useLesson,type LessonController} from './useLesson';
import {useNativeViewport} from './useNativeViewport';

export function NativeHome({controller,companion,onStart,onReset}:{controller:LessonController;companion:NativeCompanionController;onStart:()=>void;onReset:()=>void}) {
 const {progress}=controller;
 const started=lessonStarted(controller);
 const greeting=companion.view.scope==='home'&&companion.view.message?companion.view.message:homeGreeting(controller);
 return <div className="native-home-scroll">
  <header className="native-home-header"><div className="wordmark"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></div><span className="native-level">BEGINNER RUSSIAN</span></header>
  <section className="native-welcome" aria-labelledby="native-home-title"><h1 id="native-home-title" tabIndex={-1}>Your next little win.</h1></section>
  <section className="native-companion-greeting" aria-label="Your virtual companion"><div className="native-greeting-row"><NativeRobot companion={companion} size="greeting"/><p className="native-companion-bubble" role="status" aria-live="polite" aria-atomic="true">{greeting}</p></div><p className="native-companion-information">Virtual companion · Physical version planned</p></section>
  <section className="native-lesson-card" aria-labelledby="native-card-title">
   <div className="native-card-top"><span className="native-cup" aria-hidden="true">☕</span><span>LESSON 01 · ABOUT 3 MIN</span></div>
   <h2 id="native-card-title">Café essentials</h2><p>Say hello, order something warm, and say thank you.</p>
   <div className="native-card-progress"><span>{progress.complete?'Lesson complete':started?`Step ${progress.index+1} of ${lesson.length}`:'Five small steps'}</span>{started&&<span>{progress.complete?`${progress.results.filter(Boolean).length} / 5 first try`:'Progress saved'}</span>}</div>
   <progress max={lesson.length} value={progress.index} aria-label="Café essentials lesson progress"/>
   <button className="button teal" onClick={onStart}>{progress.complete?'See your results':started?'Continue lesson':'Start lesson'}<span aria-hidden="true">→</span></button>
  </section>
  <div className="native-home-footer"><p>Your progress stays on this iPhone.</p><button className="native-text-button" onClick={onReset}>Reset saved lesson &amp; preferences</button></div>
 </div>;
}

export function NativeApp() {
 const companion=useNativeCompanion();
 const controller=useLesson({persistSession:true,onTransition:companion.onTransition});
 const [view,setView]=useState<'home'|'lesson'>('home');
 const root=useRef<HTMLElement>(null);
 useNativeViewport(root);
 useEffect(()=>{
  if(view==='lesson')controller.lessonHeading.current?.focus({preventScroll:true});
  else root.current?.querySelector<HTMLElement>('#native-home-title')?.focus({preventScroll:true});
 },[view,controller.lessonHeading]);
 function closeLesson(){companion.navigate('home');controller.speech.stop();controller.setLessonSettings(false);setView('home');}
 return <main className="native-app" ref={root} data-view={view}>
  {view==='home'?<NativeHome controller={controller} companion={companion} onReset={()=>{companion.resetPreference();controller.resetAll();}} onStart={()=>{companion.navigate('lesson');controller.setNotice('');setView('lesson');}}/>:<div className="native-lesson-view"><LessonPanel controller={controller} native nativeCompanion={companion} onClose={closeLesson}/></div>}
  {controller.notice&&<div className="native-notice" role="status"><span>{controller.notice}</span><button onClick={()=>controller.setNotice('')} aria-label="Dismiss notice">×</button></div>}
 </main>;
}
