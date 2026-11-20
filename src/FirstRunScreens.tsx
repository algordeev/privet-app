import type {Ref} from 'react';
import {PRODUCT} from './config';
import {LEVELS,REASONS,type Offer} from './firstRun';
import type {NativeCompanionController} from './useNativeCompanion';
import {COMPANION_PRICE,PLUS_MONTHLY_PRICE,PLUS_YEARLY_PRICE,type PlusPlan} from './subscription';
import {NativeRobot} from './NativeRobot';
import {NativeCompanionImages} from './NativeCompanionImages';
import {ExpressionStrip,StoryArt} from './OnboardingArt';

// The onboarding screens that only show content and report choices; NativeFirstRun owns the flow.
// Each screen returns its parts as siblings, so they enter one after another (see .first-screen).

type Reason=typeof REASONS[number];
type Level=typeof LEVELS[number];
type Heading=Ref<HTMLHeadingElement>;

// Brand on the left; on the right, either the step dots or a short line.
export function FirstRunHeader({step,steps,note}:{step:number;steps:number;note:string}){
 return <header className="first-navigation">
  <div className="wordmark"><span className="brand-icon" aria-hidden="true"><i/><i/></span>{PRODUCT.name}<span className="brand-dot">.</span></div>
  {step>0?<StepDots step={step} steps={steps}/>:<span>{note}</span>}
 </header>;
}

function StepDots({step,steps}:{step:number;steps:number}){
 const label=`Step ${step} of ${steps}`;
 const dots=Array.from({length:steps},(_,n)=><b key={n} className={n<step?'is-complete':''}/>);
 return <div className="first-progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps} aria-valuenow={step} aria-label={label}><span>Step {step} of {steps}</span><i aria-hidden="true">{dots}</i></div>;
}

// The welcome: a greeting, then three short pages about how learning works.
export const STORY_PAGES=[
 {art:'speak',title:'Listen and repeat',text:'Hear natural pronunciation and practise useful phrases.'},
 {art:'letters',title:'Understand Cyrillic',text:'Get letter help exactly when you need it.'},
 {art:'together',title:'Learn together',text:'Your companion reacts as you think, improve and succeed.'},
] as const;

export function WelcomeGreeting({companion,heading}:{companion:NativeCompanionController;heading:Heading}){
 return <>
  <div className="first-robot first-hero-robot"><NativeRobot companion={companion} size="greeting"/><span className="first-hello" lang="ru">Привет!</span></div>
  <p className="native-kicker">RUSSIAN THAT REACTS TO YOU</p>
  <h1 ref={heading} tabIndex={-1}>Meet your Russian learning companion</h1>
  <p>Learn practical Russian while your companion listens, thinks and celebrates with you.</p>
 </>;
}

// page counts from 1.
export function WelcomeStory({page,heading}:{page:number;heading:Heading}){
 const {art,title,text}=STORY_PAGES[page-1];
 return <>
  <StoryArt kind={art}/>
  <p className="native-kicker">A LITTLE RUSSIAN, TOGETHER</p>
  <h1 ref={heading} tabIndex={-1}>{title}</h1>
  <p>{text}</p>
 </>;
}

// Two questions: why (purpose), then how much Russian already (level).
const REASON_ICONS:Record<Reason,string>={Travel:'↗',Conversations:'☏',Studies:'Aa',Culture:'✦'};
const REASON_FOCUS:Record<Reason,string>={Travel:'travel',Conversations:'conversations',Studies:'your studies',Culture:'exploring culture'};

export function Personalize({question,reason,level,onReason,onLevel,heading}:{question:'purpose'|'level';reason:Reason|null;level:Level|null;onReason:(reason:Reason)=>void;onLevel:(level:Level)=>void;heading:Heading}){
 const purpose=question==='purpose';
 return <>
  <p className="native-kicker">{purpose?'MAKE YOURSELF AT HOME':'YOUR STARTING POINT'}</p>
  <h1 ref={heading} tabIndex={-1}>{purpose?'Why are you learning Russian?':'Where are you starting?'}</h1>
  <p>{purpose?'Choose what brings you here. Your choices stay on this device.':`Great for ${REASON_FOCUS[reason??'Travel']} — we’ll meet you where you are.`}</p>
  {purpose
   ?<fieldset className="first-options"><legend>Your motivation</legend>{REASONS.map(option=><Option key={option} label={option} icon={REASON_ICONS[option]} picked={reason===option} onPick={()=>onReason(option)}/>)}</fieldset>
   :<fieldset className="first-options first-levels"><legend>Your Russian experience</legend>{LEVELS.map(option=><Option key={option} label={option} picked={level===option} onPick={()=>onLevel(option)}/>)}</fieldset>}
 </>;
}

function Option({label,icon,picked,onPick}:{label:string;icon?:string;picked:boolean;onPick:()=>void}){
 return <button aria-label={label} aria-pressed={picked} onClick={onPick}>
  {icon&&<span aria-hidden="true">{icon}</span>}
  <span className="first-option-label">{label}</span>
  <i aria-hidden="true">{picked?'✓':''}</i>
 </button>;
}

// After the first lesson: the companion, Plus and Free side by side. The offers need a finished lesson.
export function Offers({companion,lessonDone,plan,onPlan,onChoose,onResume,heading}:{companion:NativeCompanionController;lessonDone:boolean;plan:PlusPlan;onPlan:(plan:PlusPlan)=>void;onChoose:(offer:Offer)=>void;onResume:()=>void;heading:Heading}){
 const yearly=plan==='yearly';
 return <>
  <div className="first-offer-hero">
   <div className="first-robot"><div className="first-halo"/><NativeRobot companion={companion} size="greeting"/></div>
   <p className="native-kicker">YOUR NEXT LITTLE WIN</p>
   <h1 ref={heading} tabIndex={-1}>Keep learning with a companion by your side</h1>
   <p>Unlock the complete course with Privet Plus—or bring Privet to life with the physical companion.</p>
  </div>
  {!lessonDone
   ?<div className="first-note"><p>Your saved first lesson is unavailable. Finish it before exploring offers.</p><button className="button teal" onClick={onResume}>Resume first lesson</button></div>
   :<div className="first-offers">
    <section className="first-offer first-offer-companion">
     <NativeCompanionImages compact/>
     <p className="native-kicker">THE PRIVET COMPANION · CONCEPT</p>
     <h2>A learning companion to call your own.</h2>
     <ul><li>Expressive OLED face</li><li>Servo head movement</li><li>Real-time Bluetooth reactions</li><li>Lifetime Privet Plus included</li></ul>
     <ExpressionStrip/>
     <p className="first-honest-line">Working ESP32 prototype today · finished companion is a concept</p>
     <p className="first-price-line">{COMPANION_PRICE} · One-time preorder concept</p>
     <button className="button teal" onClick={()=>onChoose('companion')}>Explore Companion</button>
    </section>
    <section className="first-offer first-offer-plus">
     <p className="native-kicker">PRIVET PLUS</p>
     <h2>More room to grow.</h2>
     <ul><li>Unlimited hearts</li><li>Full course and practice access <small>Planned</small></li><li>Advanced progress insights <small>Planned</small></li></ul>
     <div className="first-plan-options" role="group" aria-label="Plus demo plan">
      <span className={`first-plan-indicator is-${plan}`}/>
      <button aria-pressed={!yearly} onClick={()=>onPlan('monthly')}>Monthly</button>
      <button aria-pressed={yearly} onClick={()=>onPlan('yearly')}>Annual <b>Save 33%</b></button>
     </div>
     <div className="first-price-display"><strong>{yearly?PLUS_YEARLY_PRICE:PLUS_MONTHLY_PRICE}</strong><span>{yearly?'/ year':'/ month'} · Concept pricing</span></div>
     <button className="button teal" onClick={()=>onChoose(yearly?'plus-yearly':'plus-monthly')}>Try Privet Plus</button>
    </section>
    <section className="first-offer first-offer-free">
     <p className="native-kicker">FREE</p>
     <h2>Keep learning at your pace.</h2>
     <ul><li>Basic lessons</li><li>Limited hearts</li><li>Virtual companion</li></ul>
     <button className="button first-secondary" onClick={()=>onChoose('free')}>Continue with Free</button>
    </section>
   </div>}
 </>;
}
