import {useEffect,useRef,useState,type ReactNode} from 'react';

const CLOSE_MS=260;

// The modal shell explicitly follows the visual viewport. An inner panel owns
// sizing/scrolling: WebKit must not infer a flex dialog's height from its content.
export function NativeSheet({id,title,onClose,children,size='content'}:{id:string;title:string;onClose:()=>void;children:ReactNode;size?:'content'|'reference'}){
 const dialog=useRef<HTMLDialogElement>(null);
 const heading=useRef<HTMLHeadingElement>(null);
 // Closing slides the sheet away first; onClose (which unmounts it) follows when the motion ends.
 const [closing,setClosing]=useState(false);
 const latestClose=useRef(onClose);latestClose.current=onClose;
 useEffect(()=>{if(!closing)return;const timer=setTimeout(()=>latestClose.current(),CLOSE_MS);return ()=>clearTimeout(timer);},[closing]);
 const requestClose=()=>{if(closing)return;if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)onClose();else setClosing(true);};
 useEffect(()=>{
  const origin=document.activeElement,element=dialog.current;
  const viewport=window.visualViewport;
  const measure=()=>{
   element?.style.setProperty('--sheet-viewport-height',`${viewport?.height??window.innerHeight}px`);
   element?.style.setProperty('--sheet-viewport-top',`${viewport?.offsetTop??0}px`);
  };
  measure();element?.showModal();heading.current?.focus({preventScroll:true});
  viewport?.addEventListener('resize',measure);viewport?.addEventListener('scroll',measure);window.addEventListener('resize',measure);
  return ()=>{
   viewport?.removeEventListener('resize',measure);viewport?.removeEventListener('scroll',measure);window.removeEventListener('resize',measure);
   element?.close();if(origin instanceof HTMLElement&&origin.isConnected)origin.focus({preventScroll:true});
  };
 },[]);
 return <dialog ref={dialog} id={id} className="native-sheet" aria-labelledby={`${id}-title`} data-closing={closing} onCancel={event=>{event.preventDefault();requestClose();}} onClick={event=>{if(event.target===event.currentTarget)requestClose();}}>
  <section className="native-sheet-panel" data-size={size} onAnimationEnd={event=>{if(event.target===event.currentTarget&&dialog.current)dialog.current.scrollTop=0;}}><header className="native-sheet-heading"><h2 ref={heading} id={`${id}-title`} tabIndex={-1}>{title}</h2><button className="app-icon-button" aria-label={`Close ${title}`} onClick={requestClose}>×</button></header>{children}</section>
 </dialog>;
}
