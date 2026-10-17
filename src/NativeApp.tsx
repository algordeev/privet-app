import {useEffect,useRef,useState} from 'react';
import {PhysicalCompanionSettings,PhysicalCompanionHomeStatus} from './PhysicalCompanionSettings';
import {usePhysicalCompanion,type PhysicalCompanionController} from './usePhysicalCompanion';
import {NativeProfile,ProfileIcon,StreakIcon} from './NativeProfile';
import {useNativeStats,type NativeStatsController} from './useNativeStats';
import {PRODUCT} from './config';
import {lesson} from './lesson';
import {NativeRobot} from './NativeRobot';
import {homeGreeting,lessonStarted} from './nativeCompanion';
import {useNativeCompanion,type NativeCompanionController} from './useNativeCompanion';
import {LessonPanel} from './LessonPanel';
import {useLesson,type LessonController} from './useLesson';
import {useNativeViewport} from './useNativeViewport';

export function NativeHome({controller,companion,activity,onStart,onReset,onProfile,onPhysical,physical}:{controller:LessonController;companion:NativeCompanionController;activity:NativeStatsController;onStart:()=>void;onReset:()=>void;onProfile:()=>void;onPhysical:()=>void;physical:PhysicalCompanionController}) {
 const {progress}=controller;
 const started=lessonStarted(controller);
 const greeting=companion.view.scope==='home'&&companion.view.message?companion.view.message:homeGreeting(controller);
 return <div className="native-home-scroll">
  <header className="native-home-header"><div className="wordmark"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></div><div className="native-home-tools"><span className="native-streak-badge" role="img" aria-label={`${activity.summary.current}-day learning streak`}><StreakIcon/><span>{activity.summary.current}</span><span className="native-streak-unit">{activity.summary.current===1?'day':'days'}</span></span><button id="native-profile-open" className="native-profile-open" onClick={onProfile} aria-label="Open your profile and statistics"><ProfileIcon/></button></div></header>
  <section className="native-welcome" aria-labelledby="native-home-title"><h1 id="native-home-title" tabIndex={-1}>Your next little win.</h1></section>
  <section className="native-companion-greeting" aria-label="Your virtual companion"><div className="native-greeting-row"><NativeRobot companion={companion} size="greeting"/><p className="native-companion-bubble" role="status" aria-live="polite" aria-atomic="true">{greeting}</p></div><p className="native-companion-information">Virtual companion · Physical version planned</p></section>
  <section className="native-lesson-card" aria-labelledby="native-card-title">
   <div className="native-card-top"><span className="native-cup" aria-hidden="true">☕</span><span>LESSON 01 · ABOUT 3 MIN</span></div>
   <h2 id="native-card-title">Café essentials</h2><p>Say hello, order something warm, and say thank you.</p>
   <div className="native-card-progress"><span>{progress.complete?'Lesson complete':started?`Step ${progress.index+1} of ${lesson.length}`:'Five small steps'}</span>{started&&<span>{progress.complete?`${progress.results.filter(Boolean).length} / 5 first try`:'Progress saved'}</span>}</div>
   <progress max={lesson.length} value={progress.index} aria-label="Café essentials lesson progress"/>
   <button className="button teal" onClick={onStart}>{progress.complete?'See your results':started?'Continue lesson':'Start lesson'}<span aria-hidden="true">→</span></button>
  </section>
  <div className="native-home-footer"><PhysicalCompanionHomeStatus state={physical.state} onOpen={onPhysical}/><p>Your progress stays on this iPhone.</p><button className="native-text-button" onClick={onReset}>Reset saved lesson &amp; preferences</button></div>
 </div>;
}

export function NativeApp() {
 const physical=usePhysicalCompanion();
 const companion=useNativeCompanion();
 const activity=useNativeStats();
 const controller=useLesson({persistSession:true,onTransition:(previous,next,action)=>{companion.onTransition(previous,next,action);activity.onTransition(previous,next,action);physical.onTransition(previous,next,action);}});
 const [view,setView]=useState<'home'|'lesson'|'profile'|'physical'>('home');
 const root=useRef<HTMLElement>(null);
 const previousView=useRef(view);
 useNativeViewport(root);
 useEffect(()=>{
  if(view==='lesson')controller.lessonHeading.current?.focus({preventScroll:true});
  else root.current?.querySelector<HTMLElement>(view==='physical'?'#native-physical-title':view==='profile'?'#native-profile-title':previousView.current==='physical'?'#native-physical-open':previousView.current==='profile'?'#native-profile-open':'#native-home-title')?.focus({preventScroll:true});
  previousView.current=view;
 },[view,controller.lessonHeading]);
 function closeLesson(){physical.navigate('home');companion.navigate('home');controller.speech.stop();controller.setLessonSettings(false);setView('home');}
 return <main className="native-app" ref={root} data-view={view}>
  {view==='home'?<NativeHome physical={physical} onPhysical={()=>{physical.navigate('physical');controller.speech.stop();companion.navigate('home');controller.setNotice('');setView('physical');}} controller={controller} companion={companion} activity={activity} onProfile={()=>{physical.navigate('profile');companion.navigate('home');controller.speech.stop();controller.setNotice('');setView('profile');}} onReset={()=>{activity.reset();companion.resetPreference();controller.resetAll();}} onStart={()=>{physical.navigate('lesson');companion.navigate('lesson');controller.setNotice('');setView('lesson');}}/>:view==='physical'?<PhysicalCompanionSettings controller={physical} onClose={()=>{physical.navigate('home');setView('home');}}/>:view==='profile'?<NativeProfile activity={activity} onClose={()=>{physical.navigate('home');setView('home');}}/>:<div className="native-lesson-view"><LessonPanel controller={controller} native nativeCompanion={companion} onClose={closeLesson}/></div>}
  {controller.notice&&<div className="native-notice" role="status"><span>{controller.notice}</span><button onClick={()=>controller.setNotice('')} aria-label="Dismiss notice">×</button></div>}
 </main>;
}
