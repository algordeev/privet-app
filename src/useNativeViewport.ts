import {useEffect,type RefObject} from 'react';

// WKWebView's visual viewport already accounts for the keyboard. Use that
// measured height directly; never subtract a keyboard height a second time.
export function useNativeViewport(root:RefObject<HTMLElement|null>) {
 useEffect(()=>{
  const element=root.current;
  if(!element)return;
  const viewport=window.visualViewport;
  let frame=0;
  const update=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const height=viewport?.height??window.innerHeight;
    element.style.setProperty('--app-viewport-height',`${height}px`);
    element.style.setProperty('--app-viewport-top',`${viewport?.offsetTop??0}px`);
    const keyboardVisible=window.innerHeight-height>120;
    element.dataset.keyboard=String(keyboardVisible);
    const focused=document.activeElement;
    if(focused instanceof HTMLInputElement&&element.contains(focused))focused.scrollIntoView({block:'nearest',behavior:'instant'});
   });
  };
  update();
  viewport?.addEventListener('resize',update);
  viewport?.addEventListener('scroll',update);
  window.addEventListener('resize',update);
  element.addEventListener('focusin',update);
  return ()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);element.removeEventListener('focusin',update);};
 },[root]);
}
