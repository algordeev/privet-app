import {useEffect,type RefObject} from 'react';

// Keep restored focus for accessibility, but distinguish a tap from keyboard
// navigation: WebKit may otherwise paint :focus-visible after closing a sheet.
export function useNativeFocus(root:RefObject<HTMLElement|null>){
 useEffect(()=>{
  const element=root.current;if(!element)return;
  const pointer=()=>{element.dataset.inputModality='pointer';};
  const keyboard=(event:KeyboardEvent)=>{
   if(['Tab','Enter',' ','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.key))element.dataset.inputModality='keyboard';
  };
  document.addEventListener('pointerdown',pointer,true);
  document.addEventListener('touchstart',pointer,{capture:true,passive:true});
  document.addEventListener('keydown',keyboard,true);
  return ()=>{document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('touchstart',pointer,true);document.removeEventListener('keydown',keyboard,true);delete element.dataset.inputModality;};
 },[root]);
}
