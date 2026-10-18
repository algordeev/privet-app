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
import {useSubscription} from './useSubscription';
import {PlusScreen} from './PlusScreen';
import {ComparisonScreen} from './ComparisonScreen';
import {GemsScreen} from './GemsScreen';
import {localDay} from './nativeStats';

export function NativeHome({controller,controllers,companion,activity,plus,onStart,onReset,onProfile,onPhysical,onPlus,onGems,onCompare,physical}:{controller:LessonController;controllers:LessonController[];companion:NativeCompanionController;activity:NativeStatsController;plus:boolean;onStart:(id:string)=>void;onReset:()=>void;onProfile:()=>void;onPhysical:()=>void;onPlus:()=>void;onGems:()=>void;onCompare:()=>void;physical:PhysicalCompanionController}) {
 const greeting=companion.view.scope==='home'&&companion.view.message?companion.view.message:homeGreeting(controller,controller.definition.title);
 return <div className="native-home-scroll">
  <header className="native-home-header"><div className="wordmark"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></div><div className="native-home-tools"><span className="native-streak-badge" role="img" aria-label={`${activity.summary.current}-day learning streak`}><StreakIcon/><span>{activity.summary.current}</span><span className="native-streak-unit">{activity.summary.current===1?'day':'days'}</span></span><button id="native-gems-open" className="native-gems-pill" onClick={onGems} aria-label={`${activity.summary.gems} gems; open gems`}><span aria-hidden="true">◆</span> {activity.summary.gems}</button><button id="native-plus-open" className={`native-plus-pill ${plus?'active':''}`} onClick={onPlus}>{plus?'PLUS ✓':'Plus'}</button><button id="native-profile-open" className="native-profile-open" onClick={onProfile} aria-label="Open your profile and statistics"><ProfileIcon/></button></div></header>
  <section className="native-welcome" aria-labelledby="native-home-title"><h1 id="native-home-title" tabIndex={-1}>Your next little win.</h1></section>
  <section className="native-companion-greeting" aria-label="Your virtual companion"><div className="native-greeting-row"><NativeRobot companion={companion} size="greeting"/><p className="native-companion-bubble" role="status" aria-live="polite" aria-atomic="true">{greeting}</p></div><p className="native-companion-information">Virtual companion · Physical version planned</p></section>
  <div className="native-lesson-list">{controllers.map((item,index)=>{
   const {progress,definition}=item;const started=lessonStarted(item);const total=definition.exercises.length;
   const pathState=progress.complete?'Passed':controllers.slice(0,index).every(candidate=>candidate.progress.complete)?'Up next':'Available';
   return <section className="native-lesson-card" aria-labelledby={`native-card-${definition.id}`} key={definition.id}>
    <div className="native-card-top"><span className="native-cup" aria-hidden="true">{definition.icon}</span><span>LESSON {definition.number} · ABOUT 3 MIN</span><span className={`native-path-state ${progress.complete?'passed':pathState==='Up next'?'up-next':''}`}>{pathState}</span></div>
    <h2 id={`native-card-${definition.id}`}>{definition.title}</h2><p>{definition.description}</p>
    <div className="native-card-progress"><span>{progress.complete?'Lesson complete':started?`Step ${progress.index+1} of ${total}`:'Five small steps'}</span>{started&&<span>{progress.complete?`${progress.results.filter(Boolean).length} / ${total} first try`:'Progress saved'}</span>}</div>
    <progress max={total} value={progress.index} aria-label={`${definition.title} lesson progress`}/>
    <button className="button teal" onClick={()=>onStart(definition.id)}>{progress.complete?'See your results':started?'Continue lesson':'Start lesson'}<span aria-hidden="true">→</span></button>
   </section>;
  })}</div>
  <button id="native-compare-open" className="native-compare-open" onClick={onCompare}><span aria-hidden="true">⚖</span><span><strong>Why {PRODUCT.name}?</strong><small>See how it compares with Duolingo</small></span><span aria-hidden="true">→</span></button>
  <div className="native-home-footer"><PhysicalCompanionHomeStatus state={physical.state} onOpen={onPhysical}/><p>Your progress stays on this iPhone.</p><button className="native-text-button" onClick={onReset}>Reset saved lesson &amp; preferences</button></div>
 </div>;
}

export function NativeApp() {
 const physical=usePhysicalCompanion();
 const companion=useNativeCompanion();
 const activity=useNativeStats();
 const subscription=useSubscription();
 const cafe=useLesson({persistSession:true,unlimitedHearts:subscription.plus,onTransition:(previous,next,action)=>{companion.onTransition(previous,next,action);activity.onTransition(previous,next,action,cafeLesson.id);physical.onTransition(previous,next,action,cafeLesson.id);}});
 const introductions=useLesson({persistSession:true,unlimitedHearts:subscription.plus,definition:introductionsLesson,sharedSpeech:cafe.speech,sharedPreferences:{value:cafe.preferences,set:cafe.setPreferences},onTransition:(previous,next,action)=>{companion.onTransition(previous,next,action);activity.onTransition(previous,next,action,introductionsLesson.id);physical.onTransition(previous,next,action,introductionsLesson.id);}});
 const [selectedLesson,setSelectedLesson]=useState(()=>lessonStarted(introductions)?introductionsLesson.id:cafeLesson.id);
 const controller=selectedLesson===introductionsLesson.id?introductions:cafe;
 const controllers=[cafe,introductions];
 const [view,setView]=useState<'home'|'lesson'|'profile'|'physical'|'plus'|'compare'|'gems'>('home');
 const [plusOrigin,setPlusOrigin]=useState<'home'|'profile'|'lesson'>('home');
 const root=useRef<HTMLElement>(null);
 const previousView=useRef(view);
 useNativeViewport(root);
 useEffect(()=>{
  if(view==='plus'&&plusOrigin==='lesson'&&subscription.plus){controller.revive();setView('lesson');return;}
  if(view==='lesson')controller.lessonHeading.current?.focus({preventScroll:true});
  else root.current?.querySelector<HTMLElement>(view==='physical'?'#native-physical-title':view==='profile'?'#native-profile-title':view==='plus'?'#native-plus-title':view==='compare'?'#native-compare-title':view==='gems'?'#native-gems-title':previousView.current==='gems'?'#native-gems-open':previousView.current==='compare'?'#native-compare-open':previousView.current==='physical'?'#native-physical-open':previousView.current==='profile'?'#native-profile-plus-open':previousView.current==='plus'?(plusOrigin==='lesson'?'#native-home-title':plusOrigin==='profile'?'#native-profile-plus-open':'#native-plus-open'):'#native-home-title')?.focus({preventScroll:true});
  previousView.current=view;
 },[view,plusOrigin,subscription.plus,controller.lessonHeading]);
 function closeLesson(){physical.navigate('home');companion.navigate('home');controller.speech.stop();controller.setLessonSettings(false);setView('home');}
 function openPlus(origin:'home'|'profile'|'lesson'='home'){setPlusOrigin(origin);controller.speech.stop();setView('plus');}
 function closePlus(){setView(plusOrigin);}
 return <main className="native-app" ref={root} data-view={view}>
  {view==='home'?<NativeHome physical={physical} plus={subscription.plus} onPlus={()=>openPlus('home')} onGems={()=>{controller.speech.stop();setView('gems');}} onCompare={()=>{controller.speech.stop();controller.setNotice('');setView('compare');}} onPhysical={()=>{physical.navigate('physical');controller.speech.stop();companion.navigate('home');controller.setNotice('');setView('physical');}} controller={controller} controllers={controllers} companion={companion} activity={activity} onProfile={()=>{physical.navigate('profile');companion.navigate('home');controller.speech.stop();controller.setNotice('');setView('profile');}} onReset={()=>{activity.reset();companion.resetPreference();controllers.forEach(item=>item.resetAll());}} onStart={(id)=>{controllers.forEach(item=>item.speech.stop());setSelectedLesson(id);physical.navigate('lesson');companion.navigate('lesson');controller.setNotice('');setView('lesson');}}/>:view==='physical'?<PhysicalCompanionSettings controller={physical} onClose={()=>{physical.navigate('home');setView('home');}}/>:view==='profile'?<NativeProfile activity={activity} subscription={subscription} onPlus={()=>openPlus('profile')} onClose={()=>{physical.navigate('home');setView('home');}}/>:view==='plus'?<PlusScreen subscription={subscription} onClose={closePlus}/>:view==='compare'?<ComparisonScreen onClose={()=>setView('home')}/>:view==='gems'?<GemsScreen activity={activity} onClose={()=>setView('home')}/>:<div className="native-lesson-view"><LessonPanel key={controller.definition.id} controller={controller} native nativeCompanion={companion} gems={activity.summary.gems} gemAward={activity.stats.gems.awards[localDay(new Date())]?.[controller.definition.id]} onRefill={()=>{if(activity.spendForRefill())controller.refill();}} onUpgrade={()=>openPlus('lesson')} onClose={closeLesson}/></div>}
  {controller.notice&&<div className="native-notice" role="status"><span>{controller.notice}</span><button onClick={()=>controller.setNotice('')} aria-label="Dismiss notice">×</button></div>}
 </main>;
}
