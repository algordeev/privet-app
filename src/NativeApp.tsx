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
import {GemsScreen} from './GemsScreen';
import {useCyrillicProgress,type CyrillicController} from './useCyrillicProgress';
import {recommendCyrillic} from './cyrillicProgress';
import {CyrillicQuickCard,NativeCyrillicQuickStart} from './NativeCyrillic';
import {NativeSheet} from './NativeSheet';

export function NativeHome({controller,controllers,companion,activity,plus,onStart,onReset,onProfile,onPhysical,onGems,physical,onboarding,onQuickStart}:{onboarding:CyrillicController;onQuickStart:()=>void;controller:LessonController;controllers:LessonController[];companion:NativeCompanionController;activity:NativeStatsController;plus:boolean;onStart:(id:string)=>void;onReset:()=>void;onProfile:()=>void;onPhysical:()=>void;onGems:()=>void;physical:PhysicalCompanionController}) {
 const greeting=companion.view.scope==='home'&&companion.view.message?companion.view.message:homeGreeting(controller,controller.definition.title);
 return <div className="native-home-scroll">
  <header className="native-home-header"><div className="wordmark"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></div><div className="native-home-tools"><span className="native-streak-badge" role="img" aria-label={`${activity.summary.current}-day learning streak`}><StreakIcon/><span>{activity.summary.current}</span><span className="native-streak-unit">{activity.summary.current===1?'day':'days'}</span></span><button id="native-gems-open" className="native-gems-pill" onClick={onGems} aria-label={`${activity.summary.gems} gems; open gems`}><span aria-hidden="true">◆</span> {activity.summary.gems}</button><button id="native-profile-open" className={`native-profile-open ${plus?'is-plus':''}`} onClick={onProfile} aria-label="Open your profile and statistics" aria-describedby={plus?'native-profile-plus-status':undefined}><ProfileIcon/>{plus&&<span className="native-profile-plus-tag" aria-hidden="true">PLUS</span>}</button>{plus&&<span id="native-profile-plus-status" className="native-sr-only">Plus demo active</span>}</div></header>
  <section className="native-welcome" aria-labelledby="native-home-title"><h1 id="native-home-title" tabIndex={-1}>Your next little win.</h1></section>
  <section className="native-companion-greeting" aria-label="Your virtual companion"><div className="native-greeting-row"><NativeRobot companion={companion} size="greeting"/><p className="native-companion-bubble" role="status" aria-live="polite" aria-atomic="true">{greeting}</p></div></section>
  <CyrillicQuickCard onboarding={onboarding} onStart={onQuickStart}/>
  <div className="native-lesson-list">{controllers.map((item,index)=>{
   const {progress,definition}=item;const started=lessonStarted(item);const total=definition.exercises.length;
   const pathState=progress.complete?'Passed':controllers.slice(0,index).every(candidate=>candidate.progress.complete)?'Up next':'Available';
   return <section className="native-lesson-card" aria-labelledby={`native-card-${definition.id}`} key={definition.id}>
    <div className="native-card-top"><span className="native-cup" aria-hidden="true">{definition.icon}</span><span className="native-lesson-meta">LESSON {definition.number} · ABOUT 3 MIN</span><span className={`native-path-state ${progress.complete?'passed':pathState==='Up next'?'up-next':''}`}>{pathState}</span></div>
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
 const onboarding=useCyrillicProgress();
 const [recommendation,setRecommendation]=useState(false);
 const companion=useNativeCompanion();
 const activity=useNativeStats();
 const subscription=useSubscription();
 const cafe=useLesson({persistSession:true,unlimitedHearts:subscription.plus,onTransition:(previous,next,action)=>{companion.onTransition(previous,next,action);activity.onTransition(previous,next,action,cafeLesson.id);physical.onTransition(previous,next,action,cafeLesson.id);}});
 const introductions=useLesson({persistSession:true,unlimitedHearts:subscription.plus,definition:introductionsLesson,sharedSpeech:cafe.speech,sharedPreferences:{value:cafe.preferences,set:cafe.setPreferences},onTransition:(previous,next,action)=>{companion.onTransition(previous,next,action);activity.onTransition(previous,next,action,introductionsLesson.id);physical.onTransition(previous,next,action,introductionsLesson.id);}});
 const [selectedLesson,setSelectedLesson]=useState(()=>lessonStarted(introductions)?introductionsLesson.id:cafeLesson.id);
 const controller=selectedLesson===introductionsLesson.id?introductions:cafe;
 const controllers=[cafe,introductions];
 const [view,setView]=useState<'home'|'lesson'|'profile'|'physical'|'plus'|'gems'|'quick-start'>('home');
 const [plusOrigin,setPlusOrigin]=useState<'profile'|'lesson'>('profile');
 const root=useRef<HTMLElement>(null);
 const previousView=useRef(view);
 useNativeViewport(root);
 useEffect(()=>{
  // Recovery follows the selected lesson and entitlement, not the upgrade route.
  if(subscription.plus&&controller.progress.failed)controller.revive();
 },[subscription.plus,controller.progress.failed,controller.definition.id]);
 useEffect(()=>{
  if(view==='plus'&&plusOrigin==='lesson'&&subscription.plus){setView('lesson');return;}
  if(view==='lesson')controller.lessonHeading.current?.focus({preventScroll:true});
  else root.current?.querySelector<HTMLElement>(view==='physical'?'#native-physical-title':view==='profile'?(previousView.current==='plus'?'#native-profile-plus-open':'#native-profile-title'):view==='plus'?'#native-plus-title':view==='gems'?'#native-gems-title':previousView.current==='quick-start'?'#native-quick-open':previousView.current==='gems'?'#native-gems-open':previousView.current==='physical'?'#native-physical-open':previousView.current==='profile'?'#native-profile-open':previousView.current==='plus'?'#native-profile-open':'#native-home-title')?.focus({preventScroll:true});
  previousView.current=view;
 },[view,plusOrigin,subscription.plus,controller.lessonHeading]);
 function openQuickStart(){controller.speech.stop();setRecommendation(false);onboarding.dispatch({type:'start'});companion.navigate('home');setView('quick-start');}
 function requestLesson(id:string){
  const target=controllers.find(item=>item.definition.id===id);
  if(id===cafeLesson.id&&target&&recommendCyrillic(onboarding.state,lessonStarted(target))){setRecommendation(true);return;}
  openLesson(id);
 }
 function openLesson(id:string){
  const target=controllers.find(item=>item.definition.id===id);
  if(!target)return;
  const hasActiveQuestion=!target.progress.complete&&!target.progress.failed&&!target.progress.feedback;
  controllers.forEach(item=>{item.speech.stop();item.setLessonSettings(false);item.setNotice('');});
  physical.enterLesson(hasActiveQuestion);
  setSelectedLesson(target.definition.id);
  companion.navigate('lesson');
  setView('lesson');
 }
 function replayLesson(){controller.restart();physical.enterLesson(true);}
 function closeLesson(){physical.navigate('home');companion.navigate('home');controller.speech.stop();controller.setLessonSettings(false);setView('home');}
 function openPlus(origin:'profile'|'lesson'){setPlusOrigin(origin);controller.speech.stop();setView('plus');}
 function closePlus(){setView(plusOrigin);}
 return <main className="native-app" ref={root} data-view={view}>
  {view==='quick-start'?<NativeCyrillicQuickStart onboarding={onboarding} speech={cafe.speech} onClose={()=>{cafe.speech.stop();setView('home');}} onLesson={()=>openLesson(cafeLesson.id)}/>:view==='home'?<NativeHome onboarding={onboarding} onQuickStart={openQuickStart} physical={physical} plus={subscription.plus} onGems={()=>{controller.speech.stop();setView('gems');}} onPhysical={()=>{physical.navigate('physical');controller.speech.stop();companion.navigate('home');controller.setNotice('');setView('physical');}} controller={controller} controllers={controllers} companion={companion} activity={activity} onProfile={()=>{physical.navigate('profile');companion.navigate('home');controller.speech.stop();controller.setNotice('');setView('profile');}} onReset={()=>{onboarding.dispatch({type:'reset'});activity.reset();companion.resetPreference();controllers.forEach(item=>item.resetAll());}} onStart={requestLesson}/>:view==='physical'?<PhysicalCompanionSettings controller={physical} onClose={()=>{physical.navigate('home');setView('home');}}/>:view==='profile'?<NativeProfile activity={activity} subscription={subscription} onPlus={()=>openPlus('profile')} onClose={()=>{physical.navigate('home');setView('home');}}/>:view==='plus'?<PlusScreen subscription={subscription} onClose={closePlus}/>:view==='gems'?<GemsScreen activity={activity} onClose={()=>setView('home')}/>:<div className="native-lesson-view"><LessonPanel key={controller.definition.id} controller={controller} native onReplay={replayLesson} onListen={physical.onListen} onListenEnd={physical.onListenEnd} onHint={physical.onHint} nextLesson={controller.definition.id===cafeLesson.id?{label:introductions.progress.complete?'View Lesson 2 results':'Continue to Lesson 2',onOpen:()=>openLesson(introductionsLesson.id)}:undefined} nativeCompanion={companion} gems={activity.summary.gems} gemAward={activity.stats.latest?.lessonId===controller.definition.id?activity.stats.latest.gemAward:undefined} onRefill={()=>{if(activity.spendForRefill())controller.refill();}} onUpgrade={()=>openPlus('lesson')} onClose={closeLesson}/></div>}
  {recommendation&&<NativeSheet id="native-cyrillic-recommendation" title="A little help with Cyrillic?" onClose={()=>setRecommendation(false)}><div className="native-sheet-scroll"><p>The optional quick start helps you recognize letters in your first lessons.</p><button className="button teal" onClick={openQuickStart}>Try the quick start</button><button className="native-text-button" onClick={()=>{onboarding.dispatch({type:'skip'});setRecommendation(false);openLesson(cafeLesson.id);}}>Start Lesson 1 anyway</button></div></NativeSheet>}
  {controller.notice&&<div className="native-notice" role="status"><span>{controller.notice}</span><button onClick={()=>controller.setNotice('')} aria-label="Dismiss notice">×</button></div>}
 </main>;
}
