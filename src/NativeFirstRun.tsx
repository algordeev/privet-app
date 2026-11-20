import {PhysicalCompanionSettings} from './PhysicalCompanionSettings';
import {useEffect,useRef,useState} from 'react';
import {CYRILLIC} from './cyrillic';
import {SoundIcon} from './Icons';
import {LEVELS,type Offer} from './firstRun';
import type {FirstRunController} from './useFirstRun';
import type {LessonController} from './useLesson';
import type {NativeCompanionController} from './useNativeCompanion';
import {useBleState,type PhysicalCompanionController} from './usePhysicalCompanion';
import type {SubscriptionController} from './useSubscription';
import {initialProgress,type Progress} from './engine';
import {firstRunLesson} from './firstRunLesson';
import {useLesson} from './useLesson';
import {LessonPanel} from './LessonPanel';
import {NativeRobot} from './NativeRobot';
import {CountUp} from './CountedNumber';
import {FirstBackdrop,Sparkles} from './OnboardingArt';
import {NativeCompanionImages} from './NativeCompanionImages';
import {FirstRunHeader,Offers,Personalize,STORY_PAGES,WelcomeGreeting,WelcomeStory} from './FirstRunScreens';
import {useForeground} from './useForeground';
import {COMPANION_PRICE,PLUS_MONTHLY_PRICE,PLUS_YEARLY_PRICE} from './subscription';
import './firstRun.css';

export function NativeFirstRun({flow,cafe,companion,physical,subscription,onResult,onDone,resultReady}:{flow:FirstRunController;cafe:LessonController;companion:NativeCompanionController;physical:PhysicalCompanionController;subscription:SubscriptionController;onResult:(result:Progress)=>void;onDone:()=>void;resultReady:boolean}){
 const {state,dispatch}=flow;
 // Only this screen (and only while it's mounted) re-renders on BLE state
 // changes; the rest of the native app is unaffected.
 const bleState=useBleState(physical);
 const guided=useLesson({definition:firstRunLesson,persistSession:!state.replay,saveResults:!state.replay,sharedSpeech:cafe.speech,sharedPreferences:{value:cafe.preferences,set:cafe.setPreferences},unlimitedHearts:subscription.plus,onTransition:(previous,next,action)=>{companion.onTransition(previous,next,action);physical.onTransition(previous,next,action,firstRunLesson.id);if(!previous.complete&&next.complete)onResult(next);}});
 const resultCallback=useRef(onResult);resultCallback.current=onResult;
 useEffect(()=>{if(resultReady&&guided.progress.complete)resultCallback.current(guided.progress);},[guided.progress,resultReady]);
 const heading=useRef<HTMLHeadingElement>(null),scroll=useRef<HTMLDivElement>(null);
 const [alphabetPage,setAlphabetPage]=useState(0);
 const [plan,setPlan]=useState<'monthly'|'yearly'>('monthly');
 const [welcomeStep,setWelcomeStep]=useState(0),[personalStep,setPersonalStep]=useState<'purpose'|'level'>('purpose');
 const [connectionOpen,setConnectionOpen]=useState(false);
 const onScreen=useForeground();
 useEffect(()=>{if(connectionOpen)document.getElementById('native-physical-title')?.focus({preventScroll:true});},[connectionOpen]);
 useEffect(()=>()=>{physical.navigate('home');},[physical.navigate]);
 function closeConnection(){physical.navigate('home');setConnectionOpen(false);}
 function continueConnection(){cafe.speech.stop();physical.navigate('home');if(bleState.ready)physical.greet();setConnectionOpen(false);dispatch({type:'connectionDone'});}

 useEffect(()=>{if(state.stage==='alphabet')setAlphabetPage(0);if(state.stage==='welcome')setWelcomeStep(0);if(state.stage==='personalize')setPersonalStep('purpose');heading.current?.focus({preventScroll:true});if(scroll.current)scroll.current.scrollTop=0;},[state.stage]);
 useEffect(()=>()=>cafe.speech.stop(),[cafe.speech.stop]);
 function beginLesson(){cafe.speech.stop();companion.navigate('lesson');physical.enterLesson(!guided.progress.complete&&!guided.progress.failed&&!guided.progress.feedback,guided.definition,guided.progress);dispatch({type:'lesson'});}
 function showCompanion(){cafe.speech.stop();companion.navigate('home');dispatch({type:'personalized'});}
 function choose(choice:Offer){if(state.stage!=='offer'||!guided.progress.complete)return;dispatch({type:'choose',choice});if(choice==='free')onDone();}
 function confirm(){
  const chosen=state.choice==='plus-yearly'?'yearly':state.choice==='plus-monthly'?'monthly':null;
  // A Plus demo that is already active stays as it is.
  if(chosen&&!subscription.plus)subscription.subscribe(chosen);
  dispatch({type:'finish'});onDone();
 }
 if(state.stage==='lesson'){
  const result=guided.progress,accuracy=Math.round(result.results.filter(Boolean).length/5*100);
  const lessonCompanion=result.complete?{...companion,view:{...companion.view,message:firstRunLesson.summary}}:companion;
  return <div className="native-lesson-view native-first-lesson" data-active={onScreen}><LessonPanel showFeatureTour controller={guided} practiceOnly={state.replay} native nativeCompanion={lessonCompanion} onClose={()=>{cafe.speech.stop();physical.onQuickStartListenEnd();companion.navigate('home');dispatch({type:'back'});}} onListen={physical.onListen} onListenEnd={physical.onListenEnd} onHint={physical.onHint} onReveal={physical.onReveal} onMatchPair={physical.onMatchPair} onReplay={()=>{guided.restart();physical.enterLesson(true,guided.definition,initialProgress());}} nextLesson={{label:'Choose how to continue',onOpen:()=>{physical.onQuickStartListenEnd();companion.navigate('home');dispatch({type:'offer'});}}} completionDetails={<><div className="first-sparkles"><Sparkles/></div><p className="first-fine">{state.replay?'Replay practice · No rewards added.':'Your first lesson is saved.'}</p><dl className="first-result-metrics"><div><dt>Accuracy · first try</dt><dd><span className="first-count-final">{accuracy}%</span><CountUp value={accuracy} suffix="%"/></dd></div><div><dt>Hearts remaining</dt><dd><span className="first-count-final">{result.hearts}/3</span><CountUp value={result.hearts} suffix="/3"/></dd></div><div><dt>Best combo</dt><dd><span className="first-count-final">{result.bestCombo}</span><CountUp value={result.bestCombo}/></dd></div></dl></>}/></div>;
 }
 function advanceAlphabet(){cafe.speech.stop();physical.onQuickStartListenEnd();if(alphabetPage===0){setAlphabetPage(1);if(scroll.current)scroll.current.scrollTop=0;}else{dispatch({type:'alphabetDone'});}}
 if(state.stage==='connection'&&connectionOpen)return <div className="native-first-run" data-stage="connection"><PhysicalCompanionSettings controller={physical} backLabel="Back to companion setup" onClose={closeConnection}/><footer className="first-actions"><button className="button teal" onClick={continueConnection}>{bleState.ready?'Continue':'Continue with virtual companion'} <span aria-hidden="true">→</span></button></footer></div>;
 const isOffer=state.stage==='offer',isWelcome=state.stage==='welcome',isPersonal=state.stage==='personalize';
 const viewKey=`${state.stage}-${state.stage==='alphabet'?alphabetPage:''}-${isWelcome?welcomeStep:isPersonal?personalStep:'screen'}`;
 const step=isWelcome?welcomeStep:isPersonal?(personalStep==='purpose'?1:2):0,steps=isWelcome?STORY_PAGES.length:2;
 return <div className="native-first-run" data-stage={state.stage} data-active={onScreen}>
  <FirstRunHeader step={step} steps={steps} note={state.replay?'Welcome tour · Replay':'A little Russian, together'}/>
  <div className="first-scroll" ref={scroll}>
   <FirstBackdrop/>
   <div className="first-screen" key={viewKey}>{
   isWelcome&&welcomeStep===0?<WelcomeGreeting companion={companion} heading={heading}/>:
   isWelcome?<WelcomeStory page={welcomeStep} heading={heading}/>:
   state.stage==='connection'?<><div className="first-robot"><NativeRobot companion={companion} size="greeting"/></div><p className="native-kicker">OPTIONAL · YOUR DESK COMPANION</p><h1 ref={heading} tabIndex={-1}>{bleState.ready?'Your companion is ready.':'Have a physical companion?'}</h1><p>{bleState.ready?'It will react during your first lesson. Let’s get started.':'Connect it to see it react during your first lesson. You can also learn with the virtual companion.'}</p>{!bleState.ready&&<button className="button first-secondary first-connect-button" onClick={()=>{cafe.speech.stop();physical.navigate('physical');setConnectionOpen(true);}}>Connect companion <span aria-hidden="true">→</span></button>}</>:
   isPersonal?<Personalize question={personalStep} reason={state.reason} level={state.level} onReason={value=>dispatch({type:'reason',value})} onLevel={value=>dispatch({type:'level',value})} heading={heading}/>:
   state.stage==='alphabet'?<><p className="native-kicker">CYRILLIC · {alphabetPage+1} OF 2 · ABOUT A MINUTE</p><h1 ref={heading} tabIndex={-1}>{alphabetPage===0?'A new alphabet. A familiar word.':'Same shape. Different sound.'}</h1><p>{alphabetPage===0?'Russian uses Cyrillic. Start with just four letters in a word you already know.':'These look like English letters. Their Russian sounds are different.'}</p><div className="first-alphabet-tiles">{(alphabetPage===0?['К','О','Ф','Е']:['В','Н','Р','С']).map(upper=>{const letter=CYRILLIC.find(item=>item.upper===upper)!;return <div key={upper}><strong lang="ru">{letter.upper} <small>{letter.lower}</small></strong><span>{letter.sound}</span></div>;})}</div>{alphabetPage===0?<div className="first-alphabet-word"><span lang="ru">кофе</span><span>KO-fe · coffee</span>{cafe.speech.available&&<button className="app-icon-button" aria-label="Listen to кофе: coffee" onClick={()=>{physical.onListen();cafe.speech.speak('кофе',physical.onQuickStartListenEnd);}}><SoundIcon/></button>}</div>:<div className="first-note"><strong><span lang="ru">АБВ</span> is always close by.</strong><p>Tap АБВ in your lesson for the letters in that question. You don’t need to memorize the alphabet before starting.</p></div>}<p className="first-fine">{alphabetPage===0?'These are rough sound guides. In кофе, е sounds closer to e; at the start of a word it can sound like ye.':'For example, С sounds like s, not k. You’ll recognize more letters as you learn.'}</p>{alphabetPage===0&&<p className="first-fine" role="status">{cafe.speech.message||(!cafe.speech.available?'Russian audio unavailable. All text remains usable.':'Optional device pronunciation')}</p>}</>:
   state.stage==='companion'?<><span className="first-mini-coffee" role="img" aria-label="Coffee">☕</span><p className="native-kicker">YOUR FIRST MINI-CLASS · ABOUT 3 MIN</p><h1 ref={heading} tabIndex={-1}>A little Russian at the café.</h1><p>Learn to order a coffee politely and say thank you. One short conversation to get you started.</p></>:
   isOffer?<Offers companion={companion} lessonDone={guided.progress.complete} plan={plan} onPlan={setPlan} onChoose={choose} onResume={()=>dispatch({type:'resumeLesson'})} heading={heading}/>:
   <><p className="native-kicker">{state.choice==='companion'?'YOUR DESK COMPANION':'YOUR PLUS PLAN'}</p><h1 ref={heading} tabIndex={-1}>{state.choice==='companion'?'A little company. In real life.':'More room for little wins.'}</h1><p>{state.choice==='companion'?'Explore the physical companion concept before heading into your next lesson.':'Review your selection, then keep learning with the Plus demo.'}</p>
    {state.choice==='companion'?<><NativeCompanionImages/><div className="first-review"><h2>Privet Companion</h2><dl><div><dt>Expressive face</dt><dd>OLED reactions</dd></div><div><dt>Head movement</dt><dd>Servo-powered</dd></div><div><dt>Connection</dt><dd>iPhone Bluetooth</dd></div><div><dt>Purchase concept</dt><dd>{COMPANION_PRICE} · One-time</dd></div></dl><p>Lifetime Plus is a proposed bundle. The electronics prototype works; the finished enclosure is a concept.</p></div><p className="first-fine">Nothing was ordered, charged or sent. Continue returns you home without placing a preorder or activating the proposed lifetime bundle.</p></>:<><div className="first-review"><span className="first-review-symbol" aria-hidden="true">∞</span><h2>Privet Plus</h2><dl><div><dt>Selected plan</dt><dd>{state.choice==='plus-yearly'?'Annual':'Monthly'}</dd></div><div><dt>Concept price</dt><dd>{state.choice==='plus-yearly'?PLUS_YEARLY_PRICE+' / year':PLUS_MONTHLY_PRICE+' / month'}</dd></div><div><dt>Hearts</dt><dd>Unlimited</dd></div><div><dt>Payment today</dt><dd>None · local demo</dd></div></dl><p>Full course access and advanced insights are planned.</p></div><p className="first-fine">{subscription.plus?'Your existing Plus demo stays active.':'Continue activates unlimited hearts on this device.'} Nothing was ordered, charged or sent. No billing or automatic renewal.</p></>}
   </>}
   </div>
  </div>
  {!isOffer&&<footer className="first-actions">{isWelcome?<><button className="button teal" onClick={()=>welcomeStep===0?setWelcomeStep(1):welcomeStep<3?setWelcomeStep(welcomeStep+1):dispatch({type:'start'})}>{welcomeStep===0?'Get started':'Continue'} <span aria-hidden="true">→</span></button>{welcomeStep>0&&<button className="native-text-button" onClick={()=>setWelcomeStep(welcomeStep-1)}>Back</button>}</>:state.stage==='connection'?<><button className="button teal" onClick={continueConnection}>{bleState.ready?'Continue':'Continue with virtual companion'} <span aria-hidden="true">→</span></button><button className="native-text-button" onClick={()=>dispatch({type:'back'})}>Back</button></>:isPersonal?<><button className="button teal" disabled={personalStep==='purpose'?!state.reason:!state.level} onClick={()=>personalStep==='purpose'?setPersonalStep('level'):showCompanion()}>{personalStep==='purpose'?'Continue':(state.level===LEVELS[0]?'A little Cyrillic first':'Continue')} <span aria-hidden="true">→</span></button><button className="native-text-button" onClick={()=>personalStep==='level'?setPersonalStep('purpose'):dispatch({type:'back'})}>Back</button></>:state.stage==='alphabet'?<><button className="button teal" onClick={advanceAlphabet}>{alphabetPage===0?'Continue':'Ready for the mini-class'} <span aria-hidden="true">→</span></button><button className="native-text-button" onClick={()=>{cafe.speech.stop();physical.onQuickStartListenEnd();if(alphabetPage)setAlphabetPage(0);else dispatch({type:'back'});}}>Back</button><button className="native-text-button" onClick={()=>{cafe.speech.stop();physical.onQuickStartListenEnd();dispatch({type:'alphabetDone'});}}>Skip intro</button></>:state.stage==='companion'?<><button className="button teal" onClick={beginLesson}>Start lesson <span aria-hidden="true">→</span></button><button className="native-text-button" onClick={()=>dispatch({type:'back'})}>Back</button></>:<><button className="button teal" onClick={confirm}>Continue <span aria-hidden="true">→</span></button><button className="native-text-button" onClick={()=>dispatch({type:'back'})}>Back to options</button></>}</footer>}
  {!flow.persistent&&<p className="first-fine" role="status">Local saving is unavailable. This welcome lasts for this session.</p>}
 </div>;
}
