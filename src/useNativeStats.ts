import {appStorage} from './previewStorage';
import {useCallback,useEffect,useRef,useState} from 'react';
import {readSaved} from './session';
import {applyStreakFreezes,recordOnboardingFinish,buyFreeze as purchaseFreeze,createStatsTracker,restoreStats,spendGems,statsSummary,NATIVE_STATS_KEY,GEM_RULES,type NativeStats} from './nativeStats';
import type {Action,Progress} from './engine';

function load(){try{return applyStreakFreezes(restoreStats(appStorage.getItem(NATIVE_STATS_KEY),readSaved().completion),new Date());}catch{return restoreStats(null);}}
export function useNativeStats(){
 const [stats,setStats]=useState(load);
 const [persistent,setPersistent]=useState(true);
 const [ready,setReady]=useState(false);
 const [,refresh]=useState(0);
 const actor=useRef<ReturnType<typeof createStatsTracker>|null>(null);
 useEffect(()=>{
  const save=(value:NativeStats)=>{
   try{appStorage.setItem(NATIVE_STATS_KEY,JSON.stringify(value));setPersistent(true);}catch{setPersistent(false);}
   setStats(value);
  };
  save(stats);
  actor.current=createStatsTracker(stats,save,()=>new Date());setReady(true);
  let alive=true,timer:ReturnType<typeof setTimeout>;
  const update=()=>{
   if(!alive)return;
   clearTimeout(timer);const now=new Date();actor.current?.update(current=>applyStreakFreezes(current,now));refresh(n=>n+1);
   const midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
   timer=setTimeout(update,Math.max(100,midnight.getTime()-now.getTime()+100));
  };
  const visible=()=>{if(!document.hidden)update();};
  update();document.addEventListener('visibilitychange',visible);window.addEventListener('pageshow',update);
  return ()=>{alive=false;actor.current=null;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('pageshow',update);};
  // The tracker owns the current snapshot; recreating it on render would allow
  // a restored completed lesson to be counted twice.
 },[]);
 const onTransition=useCallback((previous:Progress,next:Progress,action:Action,lessonId='cafe')=>actor.current?.transition(previous,next,action,lessonId),[]);
 const onboardingFinish=useCallback((progress:Progress)=>actor.current?.update(current=>recordOnboardingFinish(current,progress,new Date()))??false,[]);
 const reset=useCallback(()=>actor.current?.reset(),[]);
 const buyFreeze=useCallback(()=>actor.current?.update(purchaseFreeze)??false,[]);
 const spendForRefill=useCallback(()=>actor.current?.update(current=>spendGems(current,GEM_RULES.refill))??false,[]);
 return {stats,summary:statsSummary(stats,new Date()),persistent,ready,onTransition,onboardingFinish,reset,buyFreeze,spendForRefill};
}
export type NativeStatsController=ReturnType<typeof useNativeStats>;
