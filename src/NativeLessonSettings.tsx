import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import type {Preferences} from './session';

export function NativeLessonSettings({open,preferences,setPreferences,onDismiss,onRestart}:{
 open:boolean;preferences:Preferences;setPreferences:Dispatch<SetStateAction<Preferences>>;onDismiss:()=>void;onRestart:()=>void;
}){
 const panel=useRef<HTMLDivElement>(null);
 const [present,setPresent]=useState(open);
 const currentlyOpen=useRef(open);
 currentlyOpen.current=open;
 useEffect(()=>{
  if(open){setPresent(true);return;}
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setPresent(false);return;}
  const timer=setTimeout(()=>{if(!currentlyOpen.current)setPresent(false);},180);
  return ()=>clearTimeout(timer);
 },[open]);
 useEffect(()=>{
  if(!open||!present)return;
  const element=panel.current;
  const trigger=()=>document.querySelector<HTMLButtonElement>('.native-app [aria-controls="lesson-display-settings"]');
  const outside=(event:PointerEvent)=>{
   if(event.target instanceof Node&&!element?.contains(event.target)&&!trigger()?.contains(event.target))onDismiss();
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onDismiss();trigger()?.focus({preventScroll:true});}
  };
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open,present,onDismiss]);
 if(!present)return null;
 return <div ref={panel} className="native-lesson-settings" id="lesson-display-settings" role="dialog" aria-label="Learning aids" data-open={open} aria-hidden={!open||undefined} inert={!open} onAnimationEnd={event=>{if(event.target===event.currentTarget&&event.animationName==='native-settings-out'&&!currentlyOpen.current)setPresent(false);}} onBlur={event=>{
  const next=event.relatedTarget;
  if(next instanceof Node&&!event.currentTarget.contains(next)&&!(next instanceof Element&&next.closest('[aria-controls="lesson-display-settings"]')))onDismiss();
 }}>

  <div className="native-settings-options">
   <label className="native-settings-row"><span><strong>Stress marks <span className="native-settings-example" lang="ru">а́</span></strong><small>See which syllable to stress.</small></span><input type="checkbox" role="switch" disabled={!open} aria-label="Stress marks" checked={preferences.stress} onChange={event=>setPreferences(p=>({...p,stress:event.target.checked}))}/></label>
   <label className="native-settings-row"><span><strong>Pronunciation help</strong><small>Show English sound guides.</small></span><input type="checkbox" role="switch" disabled={!open} aria-label="Pronunciation help" checked={preferences.pronunciation} onChange={event=>setPreferences(p=>({...p,pronunciation:event.target.checked}))}/></label>
  </div>
  <button className="native-settings-restart" disabled={!open} onClick={onRestart}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></svg><span>Restart lesson</span></button>
 </div>;
}
