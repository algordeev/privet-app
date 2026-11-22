import {useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';

// What decides the order of lessons on home: which are passed and which are in progress.
export type HomeSnapshot={passed:ReadonlySet<string>;started:ReadonlySet<string>};

// The snapshot home last showed. It outlives home (which unmounts during a lesson), so coming
// back after passing a lesson can show the order as it was, and then move it.
let seen:HomeSnapshot|null=null;
// Lets the cards' entrance (up to ~740 ms) finish before anything moves, so the move is clearly seen.
export const REORDER_DELAY=900;
const MOVE={duration:520,easing:'cubic-bezier(.22,.8,.24,1)'};

export const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const sameSet=(a:ReadonlySet<string>,b:ReadonlySet<string>)=>a.size===b.size&&[...a].every(id=>b.has(id));
const same=(a:HomeSnapshot,b:HomeSnapshot)=>sameSet(a.passed,b.passed)&&sameSet(a.started,b.started);
const newlyPassed=(shown:HomeSnapshot,now:HomeSnapshot)=>[...now.passed].some(id=>!shown.passed.has(id));

export function positions(list:HTMLElement|null){
 const map=new Map<string,number>();
 list?.querySelectorAll<HTMLElement>('[data-flip]').forEach(el=>map.set(el.dataset.flip!,el.getBoundingClientRect().top));
 return map;
}

// Animates every [data-flip] element from where it was (old positions) to where it is now;
// new elements fade in. Nothing moves with Reduce Motion.
export function glideFrom(list:HTMLElement|null,old:Map<string,number>){
 if(reducedMotion())return;
 list?.querySelectorAll<HTMLElement>('[data-flip]').forEach(el=>{
  if(typeof el.animate!=='function')return;
  const from=old.get(el.dataset.flip!),to=el.getBoundingClientRect().top;
  if(from===undefined)el.animate([{opacity:0},{opacity:1}],{duration:300,delay:120,fill:'backwards'});
  else if(Math.abs(from-to)>1)el.animate([{transform:`translateY(${from-to}px)`},{transform:'translateY(0)'}],MOVE);
 });
}

// The snapshot home should order lessons by, and the move between orders: after a lesson is
// newly passed, home first shows the order as last seen, then the lesson glides down to
// Completed while the others slide up (FLIP: measure, reorder, animate from the old spot).
// Reduce Motion and any other change (a reset, a first visit, starting a lesson) show the
// new order straight away.
export function useHomeReorder(passed:readonly string[],started:readonly string[],list:RefObject<HTMLElement|null>){
 const key=`${passed.join('|')}/${started.join('|')}`;
 const [shown,setShown]=useState<HomeSnapshot>(()=>{
  const now={passed:new Set(passed),started:new Set(started)};
  if(!seen||reducedMotion()||!newlyPassed(seen,now))return now;
  return {passed:new Set(passed.filter(id=>seen!.passed.has(id))),started:seen.started};
 });
 const before=useRef<Map<string,number>|null>(null);
 useEffect(()=>{
  const now={passed:new Set(passed),started:new Set(started)};
  if(same(shown,now)){seen=now;return;}
  if(reducedMotion()||!newlyPassed(shown,now)){setShown(now);return;}
  const timer=setTimeout(()=>{
   // Moving a card in the page would replay its CSS entrance (a fade); once home has settled it is switched off.
   if(list.current)list.current.dataset.settled='true';
   before.current=positions(list.current);setShown(now);
  },REORDER_DELAY);
  return ()=>clearTimeout(timer);
 },[key,shown]);
 useLayoutEffect(()=>{
  const old=before.current;before.current=null;
  if(old)glideFrom(list.current,old);
 },[shown]);
 return shown;
}
