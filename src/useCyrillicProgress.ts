import {useState} from 'react';
import {CYRILLIC_KEY,initialCyrillic,restoreCyrillic,updateCyrillic,type CyrillicAction} from './cyrillicProgress';
export function useCyrillicProgress(){
 const [state,setState]=useState(()=>{try{return restoreCyrillic(localStorage.getItem(CYRILLIC_KEY));}catch{return initialCyrillic();}});
 function dispatch(action:CyrillicAction){setState(previous=>{
  const next=updateCyrillic(previous,action);
  try{if(action.type==='reset')localStorage.removeItem(CYRILLIC_KEY);else localStorage.setItem(CYRILLIC_KEY,JSON.stringify(next));}catch{/* Learning stays usable without storage. */}
  return next;
 });}
 return {state,dispatch};
}
export type CyrillicController=ReturnType<typeof useCyrillicProgress>;
