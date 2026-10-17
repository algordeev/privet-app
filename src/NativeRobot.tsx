import {useEffect,useRef,useState} from 'react';
import {Companion} from './Companion';
import type {CompanionState} from './engine';
import type {NativeExpression} from './nativeCompanion';
import type {NativeCompanionController} from './useNativeCompanion';
const expressions:Record<NativeExpression,CompanionState>={idle:'idle',greeting:'prompting',happy:'correct',encouraging:'idle',celebrating:'celebrating'};

// Reuse the coral CSS/SVG robot. Uniform scaling changes size, not expression.
export function NativeRobot({companion,size='small'}:{companion:NativeCompanionController;size?:'small'|'greeting'|'celebration'}){
 const root=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState(true);
 const {view,tap}=companion;
 useEffect(()=>{
  const element=root.current;
  if(!element||!('IntersectionObserver' in window))return;
  let alive=true;
  const observer=new IntersectionObserver(entries=>{if(alive)setVisible(entries.some(entry=>entry.isIntersecting));});
  observer.observe(element);
  return ()=>{alive=false;observer.disconnect();};
 },[]);
 const expression=view.enabled?view.expression:'idle';
 return <div ref={root} className={`native-robot native-robot-${size}`} data-expression={expression} data-enabled={view.enabled} data-running={view.enabled&&view.active&&visible}>
  <div className="native-robot-art" key={view.revision} aria-hidden="true"><Companion state={expressions[expression]} text="✦"/></div>
  <button className="native-robot-touch" onClick={tap} disabled={!view.enabled} aria-label={view.enabled?'Greet your virtual learning companion':'Virtual learning companion. Reactions are turned off.'}/>
 </div>;
}
