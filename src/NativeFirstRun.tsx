import {useEffect,useRef,useState} from 'react';
import {PRODUCT} from './config';
import {REASONS,LEVELS,type Offer} from './firstRun';
import type {FirstRunController} from './useFirstRun';
import type {LessonController} from './useLesson';
import type {NativeCompanionController} from './useNativeCompanion';
import type {PhysicalCompanionController} from './usePhysicalCompanion';
import type {SubscriptionController} from './useSubscription';
import type {Progress} from './engine';
import {firstRunLesson} from './firstRunLesson';
import {useLesson} from './useLesson';
import {LessonPanel} from './LessonPanel';
import {NativeRobot} from './NativeRobot';
import './firstRun.css';

export function NativeFirstRun({flow,cafe,companion,physical,subscription,onResult,onDone,resultReady}:{flow:FirstRunController;cafe:LessonController;companion:NativeCompanionController;physical:PhysicalCompanionController;subscription:SubscriptionController;onResult:(result:Progress)=>void;onDone:()=>void;resultReady:boolean}){
 const {state,dispatch}=flow;
 const guided=useLesson({definition:firstRunLesson,persistSession:!state.replay,saveResults:!state.replay,sharedSpeech:cafe.speech,sharedPreferences:{value:cafe.preferences,set:cafe.setPreferences},unlimitedHearts:subscription.plus,onTransition:(previous,next,action)=>{companion.onTransition(previous,next,action);physical.onTransition(previous,next,action,firstRunLesson.id);if(!previous.complete&&next.complete)onResult(next);}});
 const resultCallback=useRef(onResult);resultCallback.current=onResult;
 useEffect(()=>{if(resultReady&&guided.progress.complete)resultCallback.current(guided.progress);},[guided.progress,resultReady]);
 const heading=useRef<HTMLHeadingElement>(null),scroll=useRef<HTMLDivElement>(null);
 const [plan,setPlan]=useState<'monthly'|'yearly'>('monthly');
 useEffect(()=>{heading.current?.focus({preventScroll:true});if(scroll.current)scroll.current.scrollTop=0;},[state.stage]);
 useEffect(()=>()=>cafe.speech.stop(),[cafe.speech.stop]);
 function beginLesson(){cafe.speech.stop();companion.navigate('lesson');physical.enterLesson(!guided.progress.complete&&!guided.progress.failed&&!guided.progress.feedback);dispatch({type:'lesson'});}
 function showCompanion(){cafe.speech.stop();companion.navigate('home');physical.greet();dispatch({type:'personalized'});}
 function choose(choice:Offer){if(state.stage!=='offer'||!guided.progress.complete)return;dispatch({type:'choose',choice});if(choice==='free')onDone();}
 function confirm(){
  // Existing subscriptions are never downgraded by a classroom demonstration.
  if(state.choice?.startsWith('plus-')&&!subscription.plus)subscription.subscribe(state.choice==='plus-yearly'?'yearly':'monthly');
  dispatch({type:'finish'});onDone();
 }
 if(state.stage==='lesson'){
  const result=guided.progress,accuracy=Math.round(result.results.filter(Boolean).length/5*100);
  const lessonCompanion=result.complete?{...companion,view:{...companion.view,message:firstRunLesson.summary}}:companion;
  return <div className="native-lesson-view native-first-lesson"><LessonPanel controller={guided} practiceOnly={state.replay} native nativeCompanion={lessonCompanion} onClose={()=>{cafe.speech.stop();physical.onQuickStartListenEnd();companion.navigate('home');dispatch({type:'back'});}} onListen={physical.onListen} onListenEnd={physical.onListenEnd} onHint={physical.onHint} onReplay={()=>{guided.restart();physical.enterLesson(true);}} nextLesson={{label:'Choose how to continue',onOpen:()=>{physical.onQuickStartListenEnd();companion.navigate('home');dispatch({type:'offer'});}}} completionDetails={<><p className="first-fine">{state.replay?'Replay practice · No rewards added.':'Your first lesson is saved.'}</p><dl className="first-result-metrics"><div><dt>Accuracy · first try</dt><dd>{accuracy}%</dd></div><div><dt>Hearts remaining</dt><dd>{result.hearts}/3</dd></div><div><dt>Best combo</dt><dd>{result.bestCombo}</dd></div></dl></>}/></div>;
 }
 const isOffer=state.stage==='offer';
 return <div className="native-first-run" data-stage={state.stage}>
  <header className="first-navigation"><div className="wordmark"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></div><span>{state.replay?'Welcome tour · Replay':'A little Russian, together'}</span></header>
  <div className="first-scroll" ref={scroll}>
   {state.stage==='welcome'?<><div className="first-robot"><NativeRobot companion={companion} size="celebration"/><span className="first-hello" lang="ru">Привет!</span></div><p className="native-kicker">YOUR FIRST LITTLE WIN</p><h1 ref={heading} tabIndex={-1}>Learn Russian with a companion that reacts to you.</h1><p>Useful words. A little encouragement. One conversation at a time.</p><div className="first-features"><span>☕ Practical lessons</span><span lang="ru">АБВ <span lang="en">Cyrillic help</span></span><span>◖ Pronunciation &amp; listening</span><span>✦ A reactive companion</span></div></>:
   state.stage==='personalize'?<><p className="native-kicker">MAKE YOURSELF AT HOME</p><h1 ref={heading} tabIndex={-1}>Why are you learning Russian?</h1><p>A little about you. Your choices are saved only on this device.</p><fieldset className="first-options"><legend>Your motivation</legend>{REASONS.map((reason,index)=><button key={reason} aria-label={reason} aria-pressed={state.reason===reason} onClick={()=>dispatch({type:'reason',value:reason})}><span aria-hidden="true">{['↗','☏','Aa','✦'][index]}</span><span className="first-option-label">{reason}</span><i aria-hidden="true">{state.reason===reason?'✓':''}</i></button>)}</fieldset><fieldset className="first-options first-levels"><legend>Where are you starting?</legend>{LEVELS.map(level=><button key={level} aria-label={level} aria-pressed={state.level===level} onClick={()=>dispatch({type:'level',value:level})}>{level}<i aria-hidden="true">{state.level===level?'✓':''}</i></button>)}</fieldset><p className="first-fine">Everyone starts with the same short café lesson in this prototype. These preferences are ready for future personalization.</p></>:
   state.stage==='companion'?<><div className="first-robot"><NativeRobot companion={companion} size="celebration"/></div><p className="native-kicker">MEET YOUR DESK MATE</p><h1 ref={heading} tabIndex={-1}>A little company for every little win.</h1><p>Your virtual companion cheers you on, encourages another try, and celebrates what you learn.</p><div className="first-note"><strong>A real-world companion, too.</strong><p>The optional ESP32 OLED-and-servo prototype can react over Bluetooth during lessons. {physical.state.ready?'Your connected companion is ready.':'No hardware or Bluetooth connection is needed to begin.'}</p></div><div className="first-lesson-preview"><span aria-hidden="true">☕</span><div><strong>Your first café order</strong><p>About 3–4 min · Coffee, please.</p></div></div></>:
   isOffer?<><p className="native-kicker">ONE CONVERSATION DOWN</p><h1 ref={heading} tabIndex={-1}>Keep your little wins coming.</h1><p>Choose how you’d like to keep learning.</p><p className="first-demo-notice" role="note">Concept offers only. No payment will be taken and no preorder will be placed.</p>
    {!guided.progress.complete?<div className="first-note"><p>Your saved first lesson is unavailable. Finish it before exploring offers.</p><button className="button teal" onClick={()=>dispatch({type:'resumeLesson'})}>Resume first lesson</button></div>:<div className="first-offers">
     <section className="first-offer"><span className="native-kicker">FREE</span><h2>A good place to begin.</h2><ul><li>Basic lessons</li><li>Limited hearts</li><li>Virtual companion</li></ul><button className="button first-secondary" onClick={()=>choose('free')}>Continue with Free</button></section>
     <section className="first-offer first-offer-plus"><span className="native-kicker">PRIVET PLUS · CONCEPT</span><h2>A little more room to grow.</h2><ul><li>Unlimited hearts</li><li>Full course and practice access <small>Planned</small></li><li>Advanced progress insights <small>Planned</small></li></ul><div className="first-plan-options" aria-label="Plus demo plan"><button aria-pressed={plan==='monthly'} onClick={()=>setPlan('monthly')}>Monthly</button><button aria-pressed={plan==='yearly'} onClick={()=>setPlan('yearly')}>Annual</button></div><button className="button teal" onClick={()=>choose(plan==='monthly'?'plus-monthly':'plus-yearly')}>Start Privet Plus</button></section>
     <section className="first-offer"><span className="native-kicker">PRIVET COMPANION · CONCEPT</span><h2>A little presence on your desk.</h2><ul><li>Physical expressive companion</li><li>Real-time Bluetooth lesson reactions</li><li>Lifetime Privet Plus included with this companion <small>Proposed bundle</small></li></ul><p className="first-fine">One-time purchase / preorder concept. The electronics prototype works; the finished companion and lifetime bundle are planned.</p><button className="button first-secondary" onClick={()=>choose('companion')}>Pre-order Companion</button></section>
    </div>}</>:
   <><div className="first-confirm-mark" aria-hidden="true">✓</div><p className="native-kicker">JUST A LOCAL DEMO</p><h1 ref={heading} tabIndex={-1}>{state.choice==='companion'?'Meet your future desk mate.':'A little more possibility.'}</h1><p>{state.choice==='companion'?'You explored the Companion preorder concept. Nothing was ordered, charged or sent. The proposed lifetime Plus bundle is not activated.':`You selected the ${state.choice==='plus-yearly'?'annual':'monthly'} Plus demo. Continue to activate unlimited hearts locally. Nothing will be charged.`}</p><div className="first-note"><strong>{subscription.plus?'Your existing Plus demo stays active.':'No account. No checkout. No payment.'}</strong><p>Existing progress and subscriptions stay on this device.</p></div></>}
  </div>
  {!isOffer&&<footer className="first-actions">{state.stage==='welcome'?<button className="button teal" onClick={()=>dispatch({type:'start'})}>Get started <span aria-hidden="true">→</span></button>:state.stage==='personalize'?<><button className="button teal" disabled={!state.reason||!state.level} onClick={showCompanion}>Continue <span aria-hidden="true">→</span></button><button className="native-text-button" onClick={()=>dispatch({type:'back'})}>Back</button></>:state.stage==='companion'?<><button className="button teal" onClick={beginLesson}>{guided.progress.complete?'View your first result':guided.progress.index||guided.progress.attempts?'Continue café lesson':'Start café lesson'} <span aria-hidden="true">→</span></button><button className="native-text-button" onClick={()=>dispatch({type:'back'})}>Back</button></>:<button className="button teal" onClick={confirm}>Continue to Privet <span aria-hidden="true">→</span></button>}</footer>}
  {!flow.persistent&&<p className="first-fine" role="status">Local saving is unavailable. This welcome lasts for this session.</p>}
 </div>;
}
