import {useLayoutEffect,useRef} from 'react';

export function CountUp({value,suffix='',delay=0}:{value:number;suffix?:string;delay?:number}){
 // Frames write the overlay's attribute directly: re-rendering through React every frame cost main-thread time
 // while entrance animations run. A changed value counts on from what is shown (e.g. gems spent), not from zero.
 const overlay=useRef<HTMLSpanElement>(null);
 const shown=useRef(0);
 useLayoutEffect(()=>{
  const show=(count:number)=>{shown.current=count;overlay.current?.setAttribute('data-count',String(count));};
  show(shown.current);
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){show(value);return;}
  const from=shown.current;let frame=0,start:number|undefined;
  const tick=(now:number)=>{if(start===undefined)start=now+delay;if(now<start){frame=requestAnimationFrame(tick);return;}const progress=Math.min(1,(now-start)/700);show(Math.round(from+(value-from)*progress));if(progress<1)frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);
  return ()=>{cancelAnimationFrame(frame);};
 },[value,delay]);
 return <span ref={overlay} className="first-count-overlay" data-suffix={suffix} aria-hidden="true"/>;
}

// The real number stays as (transparent) text for VoiceOver and tests; CountUp draws the counting copy over it.
export function CountedNumber({value,delay=0}:{value:number;delay?:number}){return <b className="app-count"><span className="app-count-final">{value}</span><CountUp value={value} delay={delay}/></b>;}
