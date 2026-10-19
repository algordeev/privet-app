import {useEffect,useRef,type ReactNode} from 'react';

// The modal shell explicitly follows the visual viewport. An inner panel owns
// sizing/scrolling: WebKit must not infer a flex dialog's height from its content.
export function NativeSheet({id,title,onClose,children,size='content'}:{id:string;title:string;onClose:()=>void;children:ReactNode;size?:'content'|'reference'}){
 const dialog=useRef<HTMLDialogElement>(null);
 const heading=useRef<HTMLHeadingElement>(null);
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
 return <dialog ref={dialog} id={id} className="native-sheet" aria-labelledby={`${id}-title`} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section className="native-sheet-panel" data-size={size}><header className="native-sheet-heading"><h2 ref={heading} id={`${id}-title`} tabIndex={-1}>{title}</h2><button className="app-icon-button" aria-label={`Close ${title}`} onClick={onClose}>×</button></header>{children}</section>
 </dialog>;
}
