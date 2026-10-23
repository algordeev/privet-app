import {appStorage} from './previewStorage';
import {useState} from 'react';
import {CYRILLIC_KEY,initialCyrillic,restoreCyrillic,updateCyrillic,type CyrillicAction} from './cyrillicProgress';
export function useCyrillicProgress(){
 const [state,setState]=useState(()=>{try{return restoreCyrillic(appStorage.getItem(CYRILLIC_KEY));}catch{return initialCyrillic();}});
 function dispatch(action:CyrillicAction){setState(previous=>{
  const next=updateCyrillic(previous,action);
  try{if(action.type==='reset')appStorage.removeItem(CYRILLIC_KEY);else appStorage.setItem(CYRILLIC_KEY,JSON.stringify(next));}catch{/* Learning stays usable without storage. */}
  return next;
 });}
 return {state,dispatch};
}
export type CyrillicController=ReturnType<typeof useCyrillicProgress>;
