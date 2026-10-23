import {useCallback,useEffect,useRef,useState} from 'react';
import {FIRST_RUN_KEY,restoreFirstRun,updateFirstRun,type FirstRunAction} from './firstRun';
export function useFirstRun(existingLearner=false){
 const [state,setState]=useState(()=>{try{return restoreFirstRun(localStorage.getItem(FIRST_RUN_KEY),existingLearner);}catch{return restoreFirstRun(null,existingLearner);}});
 const current=useRef(state);const [persistent,setPersistent]=useState(true);
 const dispatch=useCallback((action:FirstRunAction)=>{
  const next=updateFirstRun(current.current,action);current.current=next;
  try{localStorage.setItem(FIRST_RUN_KEY,JSON.stringify(next));setPersistent(true);}catch{setPersistent(false);}
  setState(next);
 },[]);
 useEffect(()=>{try{localStorage.setItem(FIRST_RUN_KEY,JSON.stringify(current.current));}catch{setPersistent(false);}},[]);
 return {state,persistent,dispatch};
}
export type FirstRunController=ReturnType<typeof useFirstRun>;
