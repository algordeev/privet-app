import type {CyrillicLetter} from './cyrillic';
import type {Word} from './curriculum/types';
import {CurriculumControllers} from './CurriculumControllers';
import {useNativeFocus} from './useNativeFocus';
import {SettingsConfirmation,type SettingsAction} from './SettingsConfirmation';
import {appStorage,isOnboardingPreview} from './previewStorage';
import {Capacitor} from '@capacitor/core';
import {useFirstRun} from './useFirstRun';
import {NativeFirstRun} from './NativeFirstRun';
import {initialProgress,type Progress} from './engine';
import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {PhysicalCompanionSettings,PhysicalCompanionHomeStatus,PhysicalCompanionChip} from './PhysicalCompanionSettings';
import {rememberedCompanion,useBleState,usePhysicalCompanion,type PhysicalCompanionController} from './usePhysicalCompanion';
import {NativeProfile,ProfileIcon,StreakIcon} from './NativeProfile';
import {useNativeStats,type NativeStatsController} from './useNativeStats';
import {PRODUCT} from './config';
import {cafeLesson,nextLesson} from './lessons';
import {NativeRobot} from './NativeRobot';
import {lessonStarted} from './nativeCompanion';
import {CONNECT_BEAT_MS,GREETING_FACE,homeGreeting,learnedWord,type GreetingFacts} from './homeGreeting';
import {chapterOf} from './curriculum/chapters';

import {useNativeCompanion,type NativeCompanionController} from './useNativeCompanion';
import {LessonPanel} from './LessonPanel';
import {type LessonController} from './useLesson';
import {useNativeViewport} from './useNativeViewport';
import {useSubscription} from './useSubscription';
import {HelpSettings} from './HelpSettings';
import {useSpeaking,type SpeakingController} from './useSpeaking';
import {SpeakingSettingsCard} from './SpeakingSettingsCard';
import {AppearanceSettingsCard} from './AppearanceSettingsCard';
import {useAppearance,type AppearanceController} from './useAppearance';
import {lessonOpen} from './access';
import {HomeLessons} from './HomeLessons';
import {homeMemory,newlyPassedSince} from './homeMemory';
import {PlusScreen} from './PlusScreen';
import {GemsScreen} from './GemsScreen';
import {StreakScreen} from './StreakScreen';
import {useReminders,type RemindersController} from './useReminders';
import {onReminderTap} from './reminderScheduler';
import {ReminderInvite,ReminderSettings} from './ReminderScreens';
import {useCyrillicProgress,type CyrillicController} from './useCyrillicProgress';
import {recommendCyrillic} from './cyrillicProgress';
import {NativeCyrillicQuickStart} from './NativeCyrillic';
import {NativeSheet} from './NativeSheet';
import {CompanionFoundCard,preloadCompanionRobot} from './CompanionFoundCard';
import {useReview,type ReviewController} from './useReview';
import {NativeReviewSession,ReviewBar} from './NativeReview';
import type {ReviewSession} from './review';
import {usePrinter,usePrinterConnected,type PrinterController} from './usePrinter';
import {PrinterSettings,PrinterSettingsButton,PrinterSheet} from './PrinterScreen';
import {PrinterFoundCard} from './PrinterFoundCard';
import {alphabetStrip,letterStrip,practiceStrip,recallStrip,progressReceipt,reviewStrip,wordCard,wordOfTheDay} from './printContent';
import {renderAlphabetStrip,renderLetterStrip,renderRecallStrip,renderPracticeStrip,renderReceipt,renderTestPage,renderWordCard,type Rendered} from './printRender';
import {localDay} from './days';
import {DEVICE} from './device';
import {lessonActivityTitle,useLessonActivity} from './useLessonActivity';

// The day the home robot last showed the connect prompt (once a day at most).
export const CONNECT_PROMPT_KEY=`${PRODUCT.storageKey}-companion-prompt-day`;
// Survives NativeHome remounts, so the badges only pop when a number grew since the last home visit.
const seenHomeStats={streak:-1,gems:-1};
export function NativeHome({unlocked,controller,controllers,companion,activity,plus,onStart,onUnlock,onProfile,onGems,onStreak,physical,onPhysical,onboarding,onQuickStart,onSettings,review,onReview,note}:{unlocked?:{focus:string|null}|null;note?:string;onUnlock?:()=>void;review?:ReviewController;onReview?:()=>void;onSettings?:()=>void;physical:PhysicalCompanionController;onPhysical:()=>void;onboarding:CyrillicController;onQuickStart:()=>void;controller:LessonController;controllers:LessonController[];companion:NativeCompanionController;activity:NativeStatsController;plus:boolean;onStart:(id:string)=>void;onProfile:()=>void;onGems:()=>void;onStreak:()=>void}) {
 const midLesson=lessonStarted(controller)&&!controller.progress.complete;
 const now=new Date(),today=localDay(now);
 const ble=useBleState(physical),robotConnected=ble.phase==='connected'&&ble.ready;
 // The lesson home is showing, when finished today, and the chapter it completed (if it did). On later
 // days the robot goes back to its everyday lines.
 const finished=(()=>{
  const completed=controller.saved.completion?.date;
  if(!controller.progress.complete||!completed||localDay(new Date(completed))!==today)return undefined;
  const id=controller.definition.id,day=(item:LessonController)=>item.saved.completion?.date??'';
  const chapter=chapterOf(id),inChapter=chapter?controllers.filter(item=>chapter.lessonIds.includes(item.definition.id)):[];
  // The chapter is done and this lesson was the last of it to be finished.
  const closed=!!chapter&&inChapter.every(item=>item.passed)&&inChapter.every(item=>day(item)<=day(controller));
  return {title:controller.definition.title,...(closed?{chapter:chapter!.number}:{})};
 })();
 const practisedToday=activity.summary.week.some(day=>day.today&&day.finishes>0);
 const facts:GreetingFacts={hour:now.getHours(),today,tap:companion.view.scope==='home'&&companion.view.message?companion.view.message:undefined,note:note||undefined,
  streak:activity.summary.current,practisedToday,away:activity.summary.current===0&&!practisedToday&&Object.keys(activity.stats.days).some(day=>day<today),due:review?.due??0,midLesson,finished,connect:false,
  quickStartUnseen:onboarding.state.status==='unseen',anyPassed:controllers.some(item=>item.passed),freezes:activity.summary.freezes,word:review?learnedWord(review.state,today):undefined};
 // The connect prompt, as a second beat: on a visit where it may show (no robot ever connected, not
 // seen yet today), home first shows its message, then after CONNECT_BEAT_MS the prompt takes the
 // bubble for the rest of the visit. The day counts only once the prompt was really on screen.
 const [mayConnect]=useState(()=>{
  let shown='';try{shown=appStorage.getItem(CONNECT_PROMPT_KEY)??'';}catch{/* Treated as not shown. */}
  return !rememberedCompanion()&&shown!==today;
 });
 const [beat,setBeat]=useState(false);
 useEffect(()=>{if(!mayConnect)return;const timer=setTimeout(()=>setBeat(true),CONNECT_BEAT_MS);return ()=>clearTimeout(timer);},[mayConnect]);
 const greeting=homeGreeting({...facts,connect:beat&&!robotConnected});
 const prompting=greeting.kind==='connect';
 // The robot's face follows what it says: when home opens and whenever the message changes.
 const {express}=companion;
 useEffect(()=>{const face=GREETING_FACE[greeting.kind];if(face)express(face);},[greeting.kind,express]);
 useEffect(()=>{if(prompting)try{appStorage.setItem(CONNECT_PROMPT_KEY,today);}catch{/* Asked again next visit. */}},[prompting,today]);
 const {current:streak,gems}=activity.summary;
 const [bumped]=useState(()=>({streak:seenHomeStats.streak>=0&&streak>seenHomeStats.streak,gems:seenHomeStats.gems>=0&&gems>seenHomeStats.gems}));
 useEffect(()=>{seenHomeStats.streak=streak;seenHomeStats.gems=gems;},[streak,gems]);
 // Back on home: the same scroll position as when you left, unless a lesson was just passed (then the top).
 const scroller=useRef<HTMLDivElement>(null);
 const passedIds=controllers.filter(item=>item.passed).map(item=>item.definition.id);
 const [restore]=useState(()=>!newlyPassedSince(passedIds));
 useLayoutEffect(()=>{if(scroller.current)scroller.current.scrollTop=restore?homeMemory.scroll:0;},[]);
 useEffect(()=>{homeMemory.passed=new Set(passedIds);},[passedIds.join('|')]);
 return <div className="native-home-scroll" ref={scroller} onScroll={event=>{homeMemory.scroll=event.currentTarget.scrollTop;}}>
  <header className="native-home-header"><div className="wordmark"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></div><div className="native-home-tools"><button id="native-streak-open" className={`native-streak-badge${bumped.streak?' is-bumped':''}`} onClick={onStreak} aria-label={`${activity.summary.current}-day learning streak; open streak`}><StreakIcon/><span>{activity.summary.current}</span><span className="native-streak-unit">{activity.summary.current===1?'day':'days'}</span></button><button id="native-gems-open" className={`native-gems-pill${bumped.gems?' is-bumped':''}`} onClick={onGems} aria-label={`${activity.summary.gems} gems; open gems`}><span aria-hidden="true">◆</span> {activity.summary.gems}</button><button id="native-profile-open" className={`native-profile-open ${plus?'is-plus':''}`} onClick={onProfile} aria-label="Open your profile and statistics" aria-describedby={plus?'native-profile-plus-status':undefined}><ProfileIcon/>{plus&&<span className="native-profile-plus-tag" aria-hidden="true">PLUS</span>}</button>{plus&&<span id="native-profile-plus-status" className="native-sr-only">Plus active</span>}</div></header>
  {/* No visible headline; VoiceOver and focus still get the page's main heading. */}
  <h1 id="native-home-title" className="native-sr-only" tabIndex={-1}>Home</h1>
  <section className="native-companion-greeting" aria-label="Your virtual companion"><div className="native-greeting-row"><NativeRobot companion={companion} size="greeting"/><PhysicalCompanionChip controller={physical} onOpen={onPhysical} greeting={greeting.text} prompt={prompting}/></div></section>
  {review&&onReview&&<ReviewBar review={review} onStart={onReview}/>}
  <HomeLessons controllers={controllers} plus={plus} onStart={onStart} onUnlock={onUnlock} onboarding={onboarding} onQuickStart={onQuickStart} unlocked={unlocked}/>
  <div className="native-home-footer"><p>{`Your progress stays on this ${DEVICE}.`}</p>{onSettings&&<button className="native-text-button" id="native-settings-open" onClick={onSettings}>Settings</button>}</div>
 </div>;
}

export function NativeApp() {
 const physical=usePhysicalCompanion();
 const onboarding=useCyrillicProgress();
 const companion=useNativeCompanion();
 const activity=useNativeStats();
 const subscription=useSubscription();
 // Keeps the scheduled reminders in line with today's practice and the streak.
 const reminders=useReminders({practisedToday:(activity.summary.week.at(-1)?.finishes??0)>0,streak:activity.summary.current});
 const review=useReview();
 const speaking=useSpeaking();
 const appearance=useAppearance();
 const printer=usePrinter();
 return <CurriculumControllers plus={subscription.plus} onTransition={(previous,next,action,id)=>{companion.onTransition(previous,next,action);activity.onTransition(previous,next,action,id);physical.onTransition(previous,next,action,id);review.onLessonTransition(previous,next,action,id);}}>{controllers=><NativeAppContent controllers={controllers} speaking={speaking} appearance={appearance} physical={physical} onboarding={onboarding} companion={companion} activity={activity} subscription={subscription} reminders={reminders} review={review} printer={printer}/>}</CurriculumControllers>;
}
function NativeAppContent({controllers,physical,onboarding,companion,activity,subscription,reminders,review,printer,speaking,appearance}:{speaking:SpeakingController;appearance:AppearanceController;reminders:RemindersController;printer:PrinterController;review:ReviewController;controllers:LessonController[];physical:ReturnType<typeof usePhysicalCompanion>;onboarding:CyrillicController;companion:NativeCompanionController;activity:NativeStatsController;subscription:ReturnType<typeof useSubscription>}){
 const cafe=controllers[0];
 const [recommendation,setRecommendation]=useState(false);
 const [confirmation,setConfirmation]=useState<SettingsAction|null>(null);
 const pendingSettingsAction=useRef<SettingsAction|null>(null);
 const [selectedLesson,setSelectedLesson]=useState(()=>controllers.filter(lessonStarted).at(-1)?.definition.id??cafeLesson.id);
 const controller=controllers.find(item=>item.definition.id===selectedLesson)??cafe;
 const following=nextLesson(controller.definition.id);
 const nativeOnboarding=Capacitor.isNativePlatform()||isOnboardingPreview();
 const firstRun=useFirstRun(!nativeOnboarding||controllers.some(lessonStarted)||activity.summary.finishes>0||subscription.plus);
 const firstRunActive=nativeOnboarding&&firstRun.state.stage!=='done';
 useEffect(()=>{if(!isOnboardingPreview())return;const url=new URL(location.href);if(url.searchParams.get('replay')!=='1')return;url.searchParams.delete('replay');history.replaceState(history.state,'',url.href);firstRun.dispatch({type:'replay'});},[firstRun.dispatch]);
 const [view,setView]=useState<'home'|'lesson'|'review'|'profile'|'physical'|'plus'|'gems'|'streak'|'quick-start'|'settings'|'printer'>('home');
 // The lesson in the Dynamic Island and on the Lock Screen while you're away (src/useLessonActivity.ts).
 useLessonActivity({lesson:{id:controller.definition.id,title:lessonActivityTitle(Number(controller.definition.number),controller.definition.title)},
  active:view==='lesson'&&!firstRunActive,finished:controller.progress.complete||!!controller.progress.failed,
  done:controller.progress.index,total:controller.definition.exercises.length});
 // A card to print: previewed in a sheet, connecting to the printer only when Print is tapped.
 const [printSheet,setPrintSheet]=useState<{title:string;render:()=>Rendered}|null>(null);
 // The reminder invitation appears once, on home, after the first finished lesson, while iOS has not been asked yet.
 // It waits a second after home appears, so home is seen first and the sheet does not feel like a pop-up.
 const [inviteClosed,setInviteClosed]=useState(false),[inviteDue,setInviteDue]=useState(false);
 const inviteFits=!inviteClosed&&!firstRunActive&&view==='home'&&activity.summary.finishes>0&&!reminders.settings.offered&&!reminders.settings.enabled
  &&(reminders.permission==='prompt'||reminders.permission==='granted')&&!recommendation&&!confirmation&&!printSheet;
 useEffect(()=>{if(!inviteFits){setInviteDue(false);return;}const timer=setTimeout(()=>setInviteDue(true),1000);return ()=>clearTimeout(timer);},[inviteFits]);
 const showInvite=inviteFits&&inviteDue;
 const isOpen=(id:string)=>{const index=controllers.findIndex(item=>item.definition.id===id),item=controllers[index];return !!item&&lessonOpen({index,plus:subscription.plus,started:lessonStarted(item),passed:item.passed});};
 // The lesson to continue with: the first open one not passed yet (reminders and Practice never land on the paywall).
 const nextLessonId=()=>controllers.find(item=>!item.passed&&isOpen(item.definition.id))?.definition.id??selectedLesson;
 // Tapping a reminder opens that lesson, but never interrupts onboarding or a lesson or review in progress.
 const reminderTap=useRef(()=>{});
 reminderTap.current=()=>{if(firstRunActive||view==='lesson'||view==='review')return;controller.speech.stop();openLesson(nextLessonId());};
 useEffect(()=>onReminderTap(()=>reminderTap.current()),[]);
 // Print options show only while the printer is connected; connecting happens in Settings → Printer.
 const canPrint=usePrinterConnected(printer);
 const printWordOfTheDay=()=>setPrintSheet({title:'Word of the day',render:()=>renderWordCard(wordOfTheDay(review.state,localDay(new Date())))});
 const printWord=(wordId:string)=>{const definition=controller.definition,word=definition.words.find(w=>w.id===wordId);if(word)setPrintSheet({title:'Word card',render:()=>renderWordCard(wordCard(definition,word,localDay(new Date())))});};
 const printAlphabet=(page:number)=>setPrintSheet({title:'Alphabet strip',render:()=>renderAlphabetStrip(alphabetStrip(page))});
 const printLetter=(letter:CyrillicLetter,words:readonly Word[])=>setPrintSheet({title:'Letter strip',render:()=>renderLetterStrip(letterStrip(letter,words))});
 // Shuffled once per sheet: the preview and the print are the same order.
 const printRecall=()=>setPrintSheet({title:'Write from memory',render:()=>renderRecallStrip(recallStrip())});
 const printPractice=()=>{const definition=controller.definition;setPrintSheet({title:'Practice strip',render:()=>renderPracticeStrip(practiceStrip(definition))});};
 // After a review: a strip from the words just reviewed, missed ones first.
 const printReview=(done:ReviewSession,results:readonly boolean[])=>setPrintSheet({title:'Review strip',render:()=>renderPracticeStrip(reviewStrip(done.items.map((item,i)=>({key:item.key,correct:!!results[i]})),localDay(new Date())))});
 const printReceipt=()=>{const completions=controllers.flatMap(item=>item.saved.completion?[{lessonId:item.definition.id,date:item.saved.completion.date,results:item.saved.completion.results}]:[]);setPrintSheet({title:'Progress receipt',render:()=>renderReceipt(progressReceipt(activity.stats,review.state,completions,new Date()))});};
 const [reviewSession,setReviewSession]=useState<{id:string;session:ReviewSession}|null>(null);
 // Lessons passed before review existed (or through onboarding) still get their items scheduled.
 const completions=controllers.map(item=>item.saved.completion?`${item.definition.id}:${item.saved.completion.date}`:'').join('|');
 useEffect(()=>{review.sync(controllers.flatMap(item=>item.saved.completion?[{lessonId:item.definition.id,results:item.saved.completion.results}]:[]));},[completions,review.sync]);
 // Pocket deck (keychain Mini): on each connection its answers come back into reviews and stats, and
 // today's due words go out. Home then says how the Mini session went, until you leave home.
 const [pocketNote,setPocketNote]=useState('');
 const {recordPocket}=activity,{pocket}=review,{setPocket}=physical;
 useEffect(()=>{
  const store=pocket();
  setPocket({...store,saveAnswers(answers){const applied=store.applyAnswers(answers);recordPocket(applied);return {reviewed:applied.length,known:applied.filter(a=>a.knew).length};}},
   summary=>{if(summary.reviewed)setPocketNote(`Your Mini: ${summary.reviewed} reviewed, ${summary.known} known. Nice work!`);});
  return ()=>setPocket(undefined);
 },[pocket,recordPocket,setPocket]);
 useEffect(()=>{if(view!=='home')setPocketNote('');},[view]);
 const physicalHome=()=>physical.navigate('home',review.homeCard);
 const [physicalOrigin,setPhysicalOrigin]=useState<'home'|'settings'>('settings');
 // Settings opens from home and from Profile; Back returns to where it was opened.
 const [settingsOrigin,setSettingsOrigin]=useState<'home'|'profile'>('home');
 const [plusOrigin,setPlusOrigin]=useState<'profile'|'lesson'|'home'>('profile');
 // A locked lesson (or home's unlock button) that sent the learner to the paywall: buying Plus goes back to home,
 // where the locks come off and that lesson glows, ready to be tapped. `unlocked` lasts while home stays open.
 const [unlocking,setUnlocking]=useState<string|null>(null);
 const [unlocked,setUnlocked]=useState<{focus:string|null}|null>(null);
 useEffect(()=>{if(view!=='home')setUnlocked(null);},[view]);
 const root=useRef<HTMLElement>(null);
 const previousView=useRef(view);
 useNativeViewport(root);
 useNativeFocus(root);
 useEffect(()=>{
  // While home is open it keeps quietly looking for a powered-on companion (only once Bluetooth was used before).
  if(firstRunActive)return;
  if(view==='home'||view==='physical'||view==='printer')preloadCompanionRobot();
  if(view==='home'){const stopCompanion=physical.discover(),stopPrinter=printer.discover();return ()=>{stopCompanion();stopPrinter();};}
 },[view,firstRunActive,physical.discover,printer.discover]);
 useEffect(()=>{
  // Recovery follows the selected lesson and entitlement, not the upgrade route.
  if(subscription.plus&&controller.progress.failed)controller.revive();
 },[subscription.plus,controller.progress.failed,controller.definition.id]);
 useEffect(()=>{
  if(view==='plus'&&subscription.plus&&(unlocking||plusOrigin==='home')){const focus=unlocking;setUnlocking(null);setUnlocked({focus});physicalHome();companion.navigate('home');setView('home');return;}
  if(view==='plus'&&plusOrigin==='lesson'&&subscription.plus){setView('lesson');return;}
  if(view==='lesson')controller.lessonHeading.current?.focus({preventScroll:true});
  else root.current?.querySelector<HTMLElement>(view==='settings'?(previousView.current==='physical'?'#native-physical-open':previousView.current==='printer'?'#native-printer-open':'#native-settings-title'):view==='printer'?'#native-printer-title':view==='physical'?'#native-physical-title':view==='profile'?(previousView.current==='plus'?'#native-profile-plus-open':previousView.current==='settings'?'#native-profile-settings':'#native-profile-title'):view==='plus'?'#native-plus-title':view==='gems'?'#native-gems-title':view==='streak'?'#native-streak-title':previousView.current==='quick-start'?'#native-quick-open':previousView.current==='review'?(root.current?.querySelector('#native-review-open')?'#native-review-open':'#native-home-title'):previousView.current==='gems'?'#native-gems-open':previousView.current==='streak'?'#native-streak-open':previousView.current==='physical'?'#native-companion-chip':previousView.current==='settings'?'#native-settings-open':previousView.current==='profile'?'#native-profile-open':previousView.current==='plus'?(unlocked?(unlocked.focus?`#native-card-${unlocked.focus} ~ .button`:'#native-home-title'):'#native-profile-open'):'#native-home-title')?.focus({preventScroll:true});
  previousView.current=view;
 },[view,plusOrigin,unlocking,subscription.plus,controller.lessonHeading,firstRunActive]);
 useEffect(()=>{
  if(!nativeOnboarding)return;
  // Console-only test helper: reset the welcome UI, never learner data or awards.
  const reset=()=>{cafe.speech.stop();physical.onQuickStartListenEnd();firstRun.dispatch({type:'resetFlag'});};
  Object.assign(window,{privetResetOnboarding:reset});
  return ()=>{Reflect.deleteProperty(window,'privetResetOnboarding');};
 },[nativeOnboarding,firstRun.dispatch,cafe.speech.stop,physical.onQuickStartListenEnd]);
 function completeFirstLesson(progress:Progress){if(firstRun.state.replay||!activity.ready)return;activity.onboardingFinish(progress);cafe.adoptCompletion(progress);}
 function finishFirstRun(){cafe.speech.stop();physical.onQuickStartListenEnd();companion.navigate('home');setSelectedLesson(cafeLesson.id);setView('home');}
 function replayFirstRun(){if(!nativeOnboarding){const url=new URL(location.href);url.searchParams.set('native','1');url.searchParams.set('onboarding','1');url.searchParams.set('replay','1');location.assign(url.href);return;}controller.speech.stop();physical.onQuickStartListenEnd();companion.navigate('home');firstRun.dispatch({type:'replay'});}
 function openQuickStart(){controller.speech.stop();setRecommendation(false);onboarding.dispatch({type:'start'});companion.navigate('home');setView('quick-start');}
 function requestLesson(id:string){
  const target=controllers.find(item=>item.definition.id===id);
  if(id===cafeLesson.id&&target&&recommendCyrillic(onboarding.state,lessonStarted(target))){setRecommendation(true);return;}
  openLesson(id);
 }
 function openLesson(id:string){
  const target=controllers.find(item=>item.definition.id===id);
  if(!target)return;
  if(!isOpen(id)){openPlus(view==='lesson'?'lesson':'home',id);return;}
  const hasActiveQuestion=!target.progress.complete&&!target.progress.failed&&!target.progress.feedback;
  controllers.forEach(item=>{item.speech.stop();item.setLessonSettings(false);item.setNotice('');});
  physical.enterLesson(hasActiveQuestion,target.definition,target.progress);
  setSelectedLesson(target.definition.id);
  companion.navigate('lesson');
  setView('lesson');
 }
 function openReview(){
  const session=review.start(speaking.spoken);if(!session)return;
  controllers.forEach(item=>{item.speech.stop();item.setLessonSettings(false);item.setNotice('');});
  physical.enterLesson(true,session.definition,initialProgress());
  setReviewSession({id:`${Date.now()}`,session});
  companion.navigate('lesson');
  setView('review');
 }
 function closeReview(){cafe.speech.stop();physicalHome();companion.navigate('home');setReviewSession(null);setView('home');}
 function replayLesson(){controller.restart();physical.enterLesson(true,controller.definition,initialProgress());}
 function openPhysicalSettings(origin:'home'|'settings'='settings'){setPhysicalOrigin(origin);physical.navigate('physical');controller.speech.stop();companion.navigate('home');controller.setNotice('');setView('physical');}
 function requestSettingsAction(action:SettingsAction){root.current?.querySelector<HTMLElement>(action==='replay'?'#native-replay-onboarding':'#native-reset-saved')?.focus({preventScroll:true});controller.speech.stop();pendingSettingsAction.current=action;setConfirmation(action);}
 function cancelSettingsAction(){pendingSettingsAction.current=null;setConfirmation(null);}
 function confirmSettingsAction(){const action=pendingSettingsAction.current;if(!action)return;pendingSettingsAction.current=null;setConfirmation(null);if(action==='reset')resetSaved();else replayFirstRun();}
 function resetSaved(){onboarding.dispatch({type:'reset'});activity.reset();review.reset();companion.resetPreference();controllers.forEach(item=>item.resetAll());}
 function closeLesson(){physicalHome();companion.navigate('home');controller.speech.stop();controller.setLessonSettings(false);setView('home');}
 function openSettings(origin:'home'|'profile'){controller.speech.stop();physical.onQuickStartListenEnd();setSettingsOrigin(origin);setView('settings');}
 function openPlus(origin:'profile'|'lesson'|'home',lesson:string|null=null){setPlusOrigin(origin);setUnlocking(lesson);controller.speech.stop();setView('plus');}
 function closePlus(){setUnlocking(null);setView(plusOrigin);}
 return <main className="native-app" ref={root} data-view={firstRunActive?'onboarding':view}>
  {firstRunActive?<NativeFirstRun flow={firstRun} cafe={cafe} companion={companion} physical={physical} subscription={subscription} onResult={completeFirstLesson} resultReady={activity.ready} onDone={finishFirstRun}/>:view==='settings'?<div className="native-profile-scroll native-settings-screen"><header className="native-profile-navigation"><button className="app-icon-button" aria-label={settingsOrigin==='profile'?'Back to profile':'Back to home'} onClick={()=>setView(settingsOrigin)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1 id="native-settings-title" tabIndex={-1}>Settings</h1><span/></header><div className="native-settings-list"><section className="native-settings-card" aria-labelledby="settings-welcome-title"><h2 id="settings-welcome-title">Welcome to {PRODUCT.name}</h2><button className="button teal" id="native-replay-onboarding" onClick={()=>requestSettingsAction('replay')}>Replay onboarding</button></section><AppearanceSettingsCard appearance={appearance}/><ReminderSettings reminders={reminders}/><SpeakingSettingsCard speaking={speaking}/><section className="native-settings-card" aria-labelledby="settings-companion-title"><h2 id="settings-companion-title">Companion</h2><PhysicalCompanionHomeStatus controller={physical} onOpen={()=>openPhysicalSettings('settings')}/></section>{printer.supported()&&<section className="native-settings-card" aria-labelledby="settings-printer-title"><h2 id="settings-printer-title">Printer</h2><PrinterSettingsButton printer={printer} onOpen={()=>setView('printer')}/></section>}<section className="native-settings-card" aria-labelledby="settings-data-title"><h2 id="settings-data-title">Local data</h2><p>Clear saved lessons, statistics and display preferences on this device.</p><button className="native-text-button native-settings-reset" id="native-reset-saved" onClick={()=>requestSettingsAction('reset')}>Reset saved lesson &amp; preferences</button></section><HelpSettings/></div></div>:view==='quick-start'?<NativeCyrillicQuickStart onboarding={onboarding} speech={cafe.speech} onPrint={canPrint?printAlphabet:undefined} onPrintLetter={canPrint?letter=>printLetter(letter,[]):undefined} onPrintRecall={canPrint?printRecall:undefined} onListen={physical.onListen} onListenEnd={physical.onQuickStartListenEnd} onClose={()=>{cafe.speech.stop();physical.onQuickStartListenEnd();setView('home');}} onLesson={()=>{cafe.speech.stop();physical.onQuickStartListenEnd();openLesson(cafeLesson.id);}}/>:view==='home'?<NativeHome unlocked={unlocked} note={pocketNote} physical={physical} onPhysical={()=>openPhysicalSettings('home')} onSettings={()=>openSettings('home')} onboarding={onboarding} onQuickStart={openQuickStart} plus={subscription.plus} onUnlock={()=>openPlus('home')} onGems={()=>{controller.speech.stop();setView('gems');}} onStreak={()=>{controller.speech.stop();setView('streak');}} controller={controller} controllers={controllers} companion={companion} activity={activity} onProfile={()=>{physical.navigate('profile');companion.navigate('home');controller.speech.stop();controller.setNotice('');setView('profile');}} onStart={requestLesson} review={review} onReview={openReview}/>:view==='review'&&reviewSession?<NativeReviewSession key={reviewSession.id} speaking={speaking} sessionId={reviewSession.id} session={reviewSession.session} shared={cafe} review={review} companion={companion} physical={physical} activity={activity} onPrint={canPrint?printReview:undefined} onPrintLetter={canPrint?printLetter:undefined} onClose={closeReview}/>:view==='printer'?<PrinterSettings printer={printer} onClose={()=>setView('settings')} onWordOfTheDay={printWordOfTheDay} onTestPage={()=>setPrintSheet({title:'Test page',render:renderTestPage})}/>:view==='physical'?<PhysicalCompanionSettings controller={physical} backLabel={physicalOrigin==='home'?'Back to home':'Back to settings'} onClose={()=>{if(physicalOrigin==='home')physicalHome();else physical.navigate('home');setView(physicalOrigin);}}/>:view==='profile'?<NativeProfile activity={activity} subscription={subscription} onSettings={()=>openSettings('profile')} onPrint={canPrint?printReceipt:undefined} onPlus={()=>openPlus('profile')} onClose={()=>{physicalHome();setView('home');}}/>:view==='plus'?<PlusScreen subscription={subscription} onClose={closePlus}/>:view==='gems'?<GemsScreen activity={activity} onClose={()=>setView('home')}/>:view==='streak'?<StreakScreen activity={activity} onClose={()=>setView('home')} onGems={()=>setView('gems')} onPractice={()=>openLesson(nextLessonId())}/>:<div className="native-lesson-view"><LessonPanel key={controller.definition.id} controller={controller} native speaking={speaking} onReplay={replayLesson} onListen={physical.onListen} onListenEnd={physical.onListenEnd} onHint={physical.onHint} onReveal={physical.onReveal} onMatchPair={physical.onMatchPair} onPrintWord={canPrint?printWord:undefined} onPrintPractice={canPrint?printPractice:undefined} onPrintLetter={canPrint?printLetter:undefined} nextLesson={following?{label:!isOpen(following.id)?`Unlock Lesson ${Number(following.number)} with Plus`:controllers.find(item=>item.definition.id===following.id)?.progress.complete?`View Lesson ${Number(following.number)} results`:`Continue to Lesson ${Number(following.number)}`,onOpen:()=>openLesson(following.id)}:undefined} nativeCompanion={companion} gems={activity.summary.gems} gemAward={activity.stats.latest?.lessonId===controller.definition.id?activity.stats.latest.gemAward:undefined} onRefill={()=>{if(activity.spendForRefill())controller.refill();}} onUpgrade={()=>openPlus('lesson')} onClose={closeLesson}/></div>}
  {!firstRunActive&&(view==='home'||view==='physical')&&<CompanionFoundCard key={view} controller={physical} where={view}/>}
  {!firstRunActive&&printer.supported()&&(view==='home'||view==='printer')&&<PrinterFoundCard key={`printer-${view}`} printer={printer} where={view==='home'?'home':'printer'}/>}
  {printSheet&&<PrinterSheet printer={printer} title={printSheet.title} render={printSheet.render} onClose={()=>setPrintSheet(null)}/>}
  {confirmation&&<SettingsConfirmation action={confirmation} browserRedirect={!nativeOnboarding} onCancel={cancelSettingsAction} onConfirm={confirmSettingsAction}/>}
  {showInvite&&<ReminderInvite reminders={reminders} onClose={()=>setInviteClosed(true)}/>}{recommendation&&<NativeSheet id="native-cyrillic-recommendation" title="A little help with Cyrillic?" onClose={()=>setRecommendation(false)}><div className="native-sheet-scroll"><p>The optional quick start helps you recognize letters in your first lessons.</p><button className="button teal" onClick={openQuickStart}>Try the quick start</button><button className="native-text-button" onClick={()=>{onboarding.dispatch({type:'skip'});setRecommendation(false);openLesson(cafeLesson.id);}}>Start Lesson 1 anyway</button></div></NativeSheet>}
  {!firstRunActive&&controller.notice&&<div className="native-notice" role="status"><span>{controller.notice}</span><button onClick={()=>controller.setNotice('')} aria-label="Dismiss notice">×</button></div>}
 </main>;
}
