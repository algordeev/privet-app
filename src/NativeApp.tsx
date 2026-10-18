import {useEffect,useRef,useState} from 'react';
import {PhysicalCompanionSettings,PhysicalCompanionHomeStatus} from './PhysicalCompanionSettings';
import {usePhysicalCompanion,type PhysicalCompanionController} from './usePhysicalCompanion';
import {NativeProfile,ProfileIcon,StreakIcon} from './NativeProfile';
import {useNativeStats,type NativeStatsController} from './useNativeStats';
import {PRODUCT} from './config';
import {cafeLesson,introductionsLesson} from './lessons';
import {NativeRobot} from './NativeRobot';
import {homeGreeting,lessonStarted} from './nativeCompanion';
import {useNativeCompanion,type NativeCompanionController} from './useNativeCompanion';
import {LessonPanel} from './LessonPanel';
import {useLesson,type LessonController} from './useLesson';
import {useNativeViewport} from './useNativeViewport';

export function NativeHome({controller,controllers,companion,activity,onStart,onReset,onProfile,onPhysical,physical}:{controller:LessonController;controllers:LessonController[];companion:NativeCompanionController;activity:NativeStatsController;onStart:(id:string)=>void;onReset:()=>void;onProfile:()=>void;onPhysical:()=>void;physical:PhysicalCompanionController}) {
 const greeting=companion.view.scope==='home'&&companion.view.message?companion.view.message:homeGreeting(controller,controller.definition.title);
 return <div className="native-home-scroll">
  <header className="native-home-header"><div className="wordmark"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></div><div className="native-home-tools"><span className="native-streak-badge" role="img" aria-label={`${activity.summary.current}-day learning streak`}><StreakIcon/><span>{activity.summary.current}</span><span className="native-streak-unit">{activity.summary.current===1?'day':'days'}</span></span><button id="native-profile-open" className="native-profile-open" onClick={onProfile} aria-label="Open your profile and statistics"><ProfileIcon/></button></div></header>
  <section className="native-welcome" aria-labelledby="native-home-title"><h1 id="native-home-title" tabIndex={-1}>Your next little win.</h1></section>
  <section className="native-companion-greeting" aria-label="Your virtual companion"><div className="native-greeting-row"><NativeRobot companion={companion} size="greeting"/><p className="native-companion-bubble" role="status" aria-live="polite" aria-atomic="true">{greeting}</p></div><p className="native-companion-information">Virtual companion · Physical version planned</p></section>
  <div className="native-lesson-list">{controllers.map(item=>{
   const {progress,definition}=item;const started=lessonStarted(item);const total=definition.exercises.length;
   return <section className="native-lesson-card" aria-labelledby={`native-card-${definition.id}`} key={definition.id}>
    <div className="native-card-top"><span className="native-cup" aria-hidden="true">{definition.icon}</span><span>LESSON {definition.number} · ABOUT 3 MIN</span></div>
    <h2 id={`native-card-${definition.id}`}>{definition.title}</h2><p>{definition.description}</p>
    <div className="native-card-progress"><span>{progress.complete?'Lesson complete':started?`Step ${progress.index+1} of ${total}`:'Five small steps'}</span>{started&&<span>{progress.complete?`${progress.results.filter(Boolean).length} / ${total} first try`:'Progress saved'}</span>}</div>
    <progress max={total} value={progress.index} aria-label={`${definition.title} lesson progress`}/>
    <button className="button teal" onClick={()=>onStart(definition.id)}>{progress.complete?'See your results':started?'Continue lesson':'Start lesson'}<span aria-hidden="true">→</span></button>
   </section>;
  })}</div>
  <div className="native-home-footer"><PhysicalCompanionHomeStatus state={physical.state} onOpen={onPhysical}/><p>Your progress stays on this iPhone.</p><button className="native-text-button" onClick={onReset}>Reset saved lesson &amp; preferences</button></div>
 </div>;
}

export function NativeApp() {
 const physical=usePhysicalCompanion();
 const companion=useNativeCompanion();
 const activity=useNativeStats();
 const cafe=useLesson({persistSession:true,onTransition:(previous,next,action)=>{companion.onTransition(previous,next,action);activity.onTransition(previous,next,action,cafeLesson.id);physical.onTransition(previous,next,action,cafeLesson.id);}});
 const introductions=useLesson({persistSession:true,definition:introductionsLesson,sharedSpeech:cafe.speech,sharedPreferences:{value:cafe.preferences,set:cafe.setPreferences},onTransition:(previous,next,action)=>{companion.onTransition(previous,next,action);activity.onTransition(previous,next,action,introductionsLesson.id);physical.onTransition(previous,next,action,introductionsLesson.id);}});
 const [selectedLesson,setSelectedLesson]=useState(()=>lessonStarted(introductions)?introductionsLesson.id:cafeLesson.id);
 const controller=selectedLesson===introductionsLesson.id?introductions:cafe;
 const controllers=[cafe,introductions];
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
  {view==='home'?<NativeHome physical={physical} onPhysical={()=>{physical.navigate('physical');controller.speech.stop();companion.navigate('home');controller.setNotice('');setView('physical');}} controller={controller} controllers={controllers} companion={companion} activity={activity} onProfile={()=>{physical.navigate('profile');companion.navigate('home');controller.speech.stop();controller.setNotice('');setView('profile');}} onReset={()=>{activity.reset();companion.resetPreference();controllers.forEach(item=>item.resetAll());}} onStart={(id)=>{controllers.forEach(item=>item.speech.stop());setSelectedLesson(id);physical.navigate('lesson');companion.navigate('lesson');controller.setNotice('');setView('lesson');}}/>:view==='physical'?<PhysicalCompanionSettings controller={physical} onClose={()=>{physical.navigate('home');setView('home');}}/>:view==='profile'?<NativeProfile activity={activity} onClose={()=>{physical.navigate('home');setView('home');}}/>:<div className="native-lesson-view"><LessonPanel key={controller.definition.id} controller={controller} native nativeCompanion={companion} onClose={closeLesson}/></div>}
  {controller.notice&&<div className="native-notice" role="status"><span>{controller.notice}</span><button onClick={()=>controller.setNotice('')} aria-label="Dismiss notice">×</button></div>}
 </main>;
}
