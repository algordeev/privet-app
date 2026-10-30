import {tourLayout} from './tourLayout';
import {useEffect,useRef,useState,type RefObject} from 'react';
import './nativeLessonTour.css';

// A visual coach only: never submits an answer, starts speech or sends BLE events.
export function NativeLessonTour({root,audio,onClose}:{root:RefObject<HTMLDivElement|null>;audio:boolean;onClose:()=>void}){
 const steps=[{target:'.vocab-reveal',title:'Meet a word',copy:'Tap a word to reveal its meaning.'},...(audio?[{target:'.word-audio',title:'Hear it in Russian',copy:'Tap the speaker for optional pronunciation.'}]:[]),{target:'.native-alphabet-trigger',title:'A little letter help',copy:'АБВ opens the Cyrillic guide. It’s here whenever you need it.'}];
 const [step,setStep]=useState(0),[box,setBox]=useState({left:0,top:0,width:0,height:0}),[viewport,setViewport]=useState({width:0,height:0,top:0,left:0}),[cardHeight,setCardHeight]=useState(0);
 const card=useRef<HTMLElement>(null);
 const dialog=useRef<HTMLDialogElement>(null),next=useRef<HTMLButtonElement>(null);
 const current=steps[Math.min(step,steps.length-1)];
 useEffect(()=>{const origin=document.activeElement,element=dialog.current;element?.showModal();next.current?.focus({preventScroll:true});return ()=>{element?.close();if(origin instanceof HTMLElement&&origin.isConnected)origin.focus({preventScroll:true});};},[]);
 useEffect(()=>{
  const container=root.current;
  const target=container?.querySelector<HTMLElement>(current.target);if(!target){onClose();return;}
  target.scrollIntoView({block:'nearest',behavior:'instant'});
  const measure=()=>{const r=target.getBoundingClientRect();setBox({left:r.left,top:r.top,width:r.width,height:r.height});const v=window.visualViewport,native=container?.closest('.native-app'),style=native?getComputedStyle(native):null;
   const safeTop=parseFloat(style?.paddingTop??'0')||0,safeBottom=parseFloat(style?.paddingBottom??'0')||0;
   setViewport({left:v?.offsetLeft??0,width:v?.width??window.innerWidth,height:Math.max(0,(v?.height??window.innerHeight)-safeTop-safeBottom),top:(v?.offsetTop??0)+safeTop});};
  measure();const observer=new ResizeObserver(measure);observer.observe(target);window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);window.visualViewport?.addEventListener('scroll',measure);container?.addEventListener('scroll',measure,true);
  // Step entrance animations move the target without resizing it; re-measure once they settle.
  container?.addEventListener('animationend',measure);
  next.current?.focus({preventScroll:true});
  return ()=>{observer.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('scroll',measure);container?.removeEventListener('scroll',measure,true);container?.removeEventListener('animationend',measure);};
 },[root,current.target,onClose]);
 useEffect(()=>{
  const element=card.current;if(!element)return;
  const measure=()=>setCardHeight(element.offsetHeight);measure();
  const observer=new ResizeObserver(measure);observer.observe(element);return ()=>observer.disconnect();
 },[current.target]);
 const {width,top,left,height,maxHeight,below,arrowVisible}=tourLayout(box,viewport,cardHeight);
 const tipX=box.left+box.width/2,tipY=below?box.top+box.height+6:box.top-6;
 return <dialog ref={dialog} className="native-lesson-tour" aria-labelledby="lesson-tour-title" aria-describedby="lesson-tour-copy" onCancel={event=>{event.preventDefault();onClose();}}>
  <div className="native-tour-spotlight" aria-hidden="true" style={{left:box.left-5,top:box.top-5,width:box.width+10,height:box.height+10}}/>
  {arrowVisible&&<svg className="native-tour-arrow" aria-hidden="true"><defs><marker id="tour-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="none" stroke="currentColor" strokeWidth="1.4"/></marker></defs><path d={`M ${left+width/2} ${below?top:top+height} Q ${tipX+20} ${below?top-15:tipY+25} ${tipX} ${tipY}`} markerEnd="url(#tour-arrow)"/></svg>}
  <section ref={card} className="native-tour-card" key={current.target} style={{top,left,width,maxHeight,visibility:cardHeight&&viewport.height?'visible':'hidden'}}><span>{step+1} / {steps.length}</span><h2 id="lesson-tour-title">{current.title}</h2><p id="lesson-tour-copy">{current.copy}</p><div><button onClick={onClose}>Skip tour</button><button ref={next} className="native-tour-next" onClick={()=>step===steps.length-1?onClose():setStep(step+1)}>{step===steps.length-1?'Got it':'Next'} <span aria-hidden="true">→</span></button></div></section>
 </dialog>;
}
