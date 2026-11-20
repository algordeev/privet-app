// Website sections for the course, the app's screens, the device family and the plans.
import {lazy,Suspense,useEffect,useRef,useState,type CSSProperties,type RefObject} from 'react';
import {nativeLessons} from './curriculum/catalog';
import {EXERCISE_KINDS,courseWords,gemRules,plusYearly,siteDevices,siteLessons,sitePlans,ticker,type SiteDevice} from './siteContent';
import {lessonIcon,renderPracticeStrip,renderReceipt,renderWordCard,rowsToDataUrl} from './printRender';
import {practiceStrip,progressReceipt,wordCard} from './printContent';
import {emptyStats} from './nativeStats';
import {localDay,shiftDay} from './days';
import {emptyReview} from './review';
import {CompanionGallery} from './CompanionGallery';

const Robot3D=lazy(()=>import('./Robot3D'));
const reducedMotion=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// True while the element is on screen (or within `margin` of it). Without IntersectionObserver it stays false.
export function useInView<T extends Element>(margin='0px'):[RefObject<T|null>,boolean]{
 const ref=useRef<T>(null);const [visible,setVisible]=useState(false);
 useEffect(()=>{
  const element=ref.current;if(!element||typeof IntersectionObserver==='undefined')return;
  const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{rootMargin:margin});
  observer.observe(element);return ()=>observer.disconnect();
 },[margin]);
 return [ref,visible];
}

// Sections fade up once as they scroll in. Content stays visible without JavaScript, and with reduced motion.
export function useReveal(){
 useEffect(()=>{
  if(typeof IntersectionObserver==='undefined'||reducedMotion())return;
  const root=document.documentElement;root.classList.add('site-reveal');
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.setAttribute('data-shown','');observer.unobserve(entry.target);}},{rootMargin:'0px 0px -12% 0px'});
  document.querySelectorAll('[data-reveal]').forEach(element=>observer.observe(element));
  return ()=>{observer.disconnect();root.classList.remove('site-reveal');};
 },[]);
}

export function Ticker(){
 const items=(hidden?:boolean)=><ul aria-hidden={hidden||undefined}>{ticker.map(item=><li key={item}>{item}<span aria-hidden="true">✳</span></li>)}</ul>;
 return <div className="site-ticker" aria-label="Privet at a glance"><div className="site-ticker-track">{items()}{items(true)}</div></div>;
}

function LessonIcon({id}:{id:string}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const element=canvas.current,ctx=element?.getContext('2d');if(!element||!ctx)return;
  const size=40,scale=Math.min(3,Math.ceil(globalThis.devicePixelRatio||1));
  element.width=element.height=size*scale;ctx.scale(scale,scale);ctx.strokeStyle='#246653';
  lessonIcon(ctx,id,0,0,size);
 },[id]);
 return <canvas ref={canvas} className="site-lesson-icon" width="40" height="40" aria-hidden="true"/>;
}

export function CourseSection(){
 return <section className="site-course wrap" id="course" aria-labelledby="course-title">
  <div className="section-heading" data-reveal><div><div className="eyebrow">02 / THE COURSE</div><h2 id="course-title">Eight lessons.<br/><span className="serif-accent">One real moment each.</span></h2></div><p>Order a coffee, find the metro, make plans for tomorrow. {courseWords} words and phrases in {nativeLessons.length} short lessons. Nothing is locked, so start wherever you like.</p></div>
  <ol className="site-lessons">
   <li className="site-lesson site-lesson-alphabet" data-reveal><span className="site-lesson-letters" aria-hidden="true"><b>А</b><b>Б</b><b>В</b></span><span className="site-lesson-number">BEFORE LESSON 01</span><h3>Cyrillic quick start</h3><p>The letters of your first words, the four tricky look-alikes, and an АБВ guide in every lesson.</p><span className="site-lesson-meta">33 letters · optional</span></li>
   {siteLessons.map((lesson,index)=><li key={lesson.id} className="site-lesson" data-reveal style={{'--i':index%4} as CSSProperties}>
    <LessonIcon id={lesson.id}/><span className="site-lesson-number">LESSON {lesson.number}</span><h3>{lesson.title}</h3><p>{lesson.description}</p><span className="site-lesson-meta">{lesson.words} words · {lesson.steps} steps</span>
   </li>)}
  </ol>
  <div className="site-kinds" data-reveal><span className="site-kinds-label">Six ways to practise</span><ul>{Object.entries(EXERCISE_KINDS).map(([kind,{label,example}])=><li key={kind} title={example}>{label}</li>)}</ul></div>
 </section>;
}

const screens=[
 {id:'home',label:'Home',title:'Your next little win.',text:'Streak, gems, today’s review and the next lesson, all on one screen.'},
 {id:'lesson',label:'Lesson',title:'Small steps, real phrases.',text:'Tap to reveal, hear it in Russian, then use it. Pronunciation help sits under every line.'},
 {id:'review',label:'Review',title:'Mistakes come back.',text:'Words you miss return sooner, words you know return later. Review never costs a heart.'},
 {id:'alphabet',label:'АБВ guide',title:'Every letter, close at hand.',text:'The letters of the current exercise first, the full alphabet one tap away, with audio.'},
 {id:'profile',label:'Profile',title:'Progress you can see.',text:'Current and best streak, finishes, XP and your last seven days.'},
 {id:'gems',label:'Gems',title:'Earned, never bought.',text:'Gems come from learning only. Spend them on a heart refill or a streak freeze.'},
] as const;

export function ScreensSection(){
 const [active,setActive]=useState(0),[auto,setAuto]=useState(true);
 const [ref,visible]=useInView<HTMLDivElement>();
 useEffect(()=>{
  if(!auto||!visible||reducedMotion())return;
  const timer=setInterval(()=>setActive(index=>(index+1)%screens.length),4200);
  return ()=>clearInterval(timer);
 },[auto,visible]);
 const pick=(index:number)=>{setAuto(false);setActive(index);};
 const screen=screens[active];
 return <section className="site-screens" id="app" aria-labelledby="screens-title"><div className="wrap">
  <div className="section-heading" data-reveal><div><div className="eyebrow">04 / INSIDE THE APP</div><h2 id="screens-title">Made for a few<br/><span className="serif-accent">minutes a day.</span></h2></div><p>Real screens from the iPhone app. No account, no ads, and everything stays on your phone.</p></div>
  <div className="site-screens-layout" ref={ref} data-reveal>
   <div className="site-screens-tabs" role="tablist" aria-label="App screens" onKeyDown={event=>{const step=event.key==='ArrowDown'||event.key==='ArrowRight'?1:event.key==='ArrowUp'||event.key==='ArrowLeft'?-1:0;if(!step)return;event.preventDefault();const next=(active+step+screens.length)%screens.length;pick(next);document.getElementById(`screen-tab-${screens[next].id}`)?.focus();}}>
    {screens.map((item,index)=><button key={item.id} id={`screen-tab-${item.id}`} role="tab" aria-selected={index===active} aria-controls="screen-panel" tabIndex={index===active?0:-1} onClick={()=>pick(index)} className={index===active&&auto&&visible?'is-playing':undefined}>
     <span className="site-screens-tab-label">{item.label}</span><span className="site-screens-tab-title">{item.title}</span><span className="site-screens-tab-text">{item.text}</span><i aria-hidden="true"/>
    </button>)}
   </div>
   <div className="site-screens-stage" id="screen-panel" role="tabpanel" aria-labelledby={`screen-tab-${screen.id}`}>
    <div className="site-screens-phone">
     {screens.map((item,index)=><img key={item.id} src={`images/screens/${item.id}.webp`} width="600" height="1298" loading="lazy" decoding="async" alt={index===active?`Privet app ${item.label} screen: ${item.text}`:''} aria-hidden={index!==active||undefined} className={index===active?'is-active':undefined}/>)}
    </div>
    <span className="hand-note site-screens-note" aria-hidden="true">{screen.title}</span>
    <p className="site-screens-caption"><strong>{screen.label}.</strong> {screen.text}</p>
   </div>
  </div>
 </div></section>;
}

// The app's own 3D figure, mounted only while near the screen.
function DeviceStage({device,awake}:{device:SiteDevice;awake:boolean}){
 const [ref,near]=useInView<HTMLDivElement>('200px');
 return <div className={`site-device-stage is-${device.id}`} ref={ref}>{near&&<Suspense fallback={null}><Robot3D model={device.id} mood={awake?'connected':'sleeping'}/></Suspense>}</div>;
}

function DeviceCard({device,index}:{device:SiteDevice;index:number}){
 const [awake,setAwake]=useState(false);
 return <article className={`site-device is-${device.id}`} data-reveal style={{'--i':index} as CSSProperties}>
  <DeviceStage device={device} awake={awake}/>
  <button className={`site-device-wake${awake?' is-awake':''}`} onClick={()=>setAwake(!awake)} aria-pressed={awake}><span className="live-dot"/>{awake?'Connected · tap to rest':'Simulate a connection'}</button>
  <div className="site-device-copy">
   <span className="site-device-kind">{device.kind}</span><h3>{device.name}</h3><p>{device.line}</p>
   <ul>{device.features.map(feature=><li key={feature}>{feature}</li>)}</ul>
   <p className="site-device-parts">{device.parts}</p>
   <p className="site-device-status"><span className="is-real">{device.status}</span><span>{device.concept}</span></p>
  </div>
 </article>;
}

// Sample learner for the printed cards: the same renderer and content the app prints.
function samplePrints(){
 const now=new Date(),today=localDay(now),cafe=nativeLessons[0];
 const thanks=cafe.words.find(word=>word.id==='thanks')??cafe.words[0];
 const days:Record<string,number>={},xp:Record<string,number>={};
 [[-5,18],[-4,31],[-3,16],[-2,22],[-1,34],[0,19]].forEach(([offset,points])=>{const day=shiftDay(today,offset);days[day]=1;xp[day]=points;});
 const review={...emptyReview(),items:{'cafe/w/tea':{box:4,due:shiftDay(today,9),lapses:0,reviews:5},'cafe/w/coffee':{box:1,due:today,lapses:1,reviews:2},'introductions/w/hello':{box:3,due:shiftDay(today,4),lapses:0,reviews:3}},log:[{key:'cafe/w/tea',day:today,correct:true,format:'meaning' as const},{key:'cafe/w/coffee',day:today,correct:false,format:'meaning' as const}]};
 const receipt=progressReceipt({...emptyStats(),days,xp},review,[{lessonId:'introductions',date:now.toISOString(),results:[true,true,true,true,false]}],now);
 return [
  {id:'word',label:'Word of the day',rendered:renderWordCard(wordCard(cafe,thanks,today))},
  {id:'strip',label:'Practice strip',rendered:renderPracticeStrip(practiceStrip(nativeLessons[2]))},
  {id:'receipt',label:'Progress receipt',rendered:renderReceipt(receipt)},
 ];
}

function PrintedCards(){
 const [ref,near]=useInView<HTMLDivElement>('300px');
 // Rendered a little early, printed once it's properly on screen.
 const [seenRef,seen]=useInView<HTMLDivElement>('0px 0px -25% 0px');
 const [prints,setPrints]=useState<{id:string;label:string;src:string;height:number}[]>([]);
 const [printed,setPrinted]=useState(false);
 useEffect(()=>{
  if(!near||prints.length)return;
  try{setPrints(samplePrints().map(({id,label,rendered})=>({id,label,src:rowsToDataUrl(rendered.rows),height:rendered.rows.length})));}catch{/* No canvas: the section keeps its text. */}
 },[near,prints.length]);
 useEffect(()=>{if(seen&&prints.length){const timer=setTimeout(()=>setPrinted(true),250);return ()=>clearTimeout(timer);}},[seen,prints.length]);
 return <div className={`site-prints${printed?' is-printed':''}`} ref={ref}><div className="site-prints-inner" ref={seenRef}>
  {prints.map((print,index)=><figure key={print.id} style={{'--i':index} as CSSProperties}>
   <div className="site-print-slot" aria-hidden="true"/>
   <div className="site-print-paper"><img src={print.src} width="384" height={print.height} alt={`${print.label} printed by the app (sample)`}/></div>
   <figcaption>{print.label}</figcaption>
  </figure>)}
 </div></div>;
}

export function FamilySection(){
 return <section className="site-family" id="devices" aria-labelledby="family-title"><div className="wrap">
  <div className="section-heading" data-reveal><div><div className="eyebrow">05 / THE PRIVET FAMILY</div><h2 id="family-title">Three little friends.<br/><span className="serif-accent">All optional.</span></h2></div><p>Each one connects to the iPhone app over Bluetooth and reconnects by itself when it’s nearby. The app does the learning; they make it a bit more fun. You don’t need any of them to learn.</p></div>
  <div className="site-devices">{siteDevices.map((device,index)=><DeviceCard key={device.id} device={device} index={index}/>)}</div>
  <div className="site-print-band" data-reveal>
   <div className="site-print-copy"><div className="eyebrow">FRESH FROM THE PRINTER</div><h3>Russian you can<br/><span className="serif-accent">stick on the fridge.</span></h3><p>These are drawn by the app’s own print renderer, dot for dot as the 57 mm printer makes them. Print buttons appear in the app while the printer is connected.</p></div>
   <PrintedCards/>
  </div>
  <p className="site-family-honesty" data-reveal><span aria-hidden="true">↳</span> The robots on this page are simulated. The desk companion, Privet Mini and printer have each been tested with the iPhone app; their enclosures and the Privet printer body are concepts.</p>
  <CompanionGallery/>
 </div></section>;
}

export function PlansSection(){
 const [yearly,setYearly]=useState(false);
 return <section className="site-plans wrap" id="plans" aria-labelledby="plans-title">
  <div className="section-heading" data-reveal><div><div className="eyebrow">06 / PLANS</div><h2 id="plans-title">Learning is free.<br/><span className="serif-accent">Extras, if you like.</span></h2></div><p>Concept pricing. Nothing is sold yet: Plus in the app is a local demo, and the companion bundle is a preorder idea.</p></div>
  <div className="site-receipts">
   {sitePlans.map((plan,index)=>{
    const plus=plan.id==='plus',price=plus&&yearly?plusYearly.price:plan.price,per=plus&&yearly?plusYearly.per:plan.per;
    return <article key={plan.id} className={`site-receipt is-${plan.id}`} data-reveal style={{'--i':index} as CSSProperties} aria-labelledby={`plan-${plan.id}`}><div className="site-receipt-paper">
     <div className="site-receipt-head"><span>PRIVET · PLAN {String(index+1).padStart(2,'0')}</span><h3 id={`plan-${plan.id}`}>{plan.name}</h3><p>{plan.line}</p></div>
     {plus&&<div className="site-plan-toggle" role="group" aria-label="Billing period"><span className={`site-plan-thumb${yearly?' is-yearly':''}`} aria-hidden="true"/><button aria-pressed={!yearly} onClick={()=>setYearly(false)}>Monthly</button><button aria-pressed={yearly} onClick={()=>setYearly(true)}>Annual <b>−{plusYearly.saving}%</b></button></div>}
     <ul>{plan.features.map(feature=><li key={feature.text}><span aria-hidden="true">{feature.planned?'○':'✓'}</span>{feature.text}{feature.planned&&<small>Planned</small>}</li>)}</ul>
     <div className="site-receipt-total"><span>TOTAL</span><strong aria-live="polite">{price}<small> / {per}</small></strong></div>
     {plus&&<p className="site-receipt-alt">{yearly?`or ${plan.price} / ${plan.per}`:`or ${plusYearly.price} / ${plusYearly.per}, save ${plusYearly.saving}%`}</p>}
     <p className="site-receipt-fine">{plan.id==='free'?'No account. No ads.':'Concept pricing · no checkout'}</p>
    </div></article>;
   })}
  </div>
  <div className="site-gems" data-reveal>
   <div className="site-gems-title"><span className="site-gem" aria-hidden="true"/><div><h3>Gems are earned by learning.</h3><p>Everyone earns at the same rate. You can’t buy them, and Plus doesn’t earn more.</p></div></div>
   <dl>{gemRules.map(rule=><div key={rule.text}><dt>{rule.amount}</dt><dd>{rule.text}</dd></div>)}</dl>
  </div>
 </section>;
}
