import {useEffect,useId,useRef,useState,type Dispatch,type SetStateAction,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {moveSentenceWord} from './sentenceOrder';
import './sentenceWords.css';

type Drag={pointer:number;word:string;from:number;x:number;y:number;offsetX:number;offsetY:number;width:number;height:number;font:string;fontSize:string;background:string;color:string;started:boolean;target:number|null;snapshot:string[]};
export function SentenceWords({tokens,setTokens,disabled,displayToken}:{tokens:string[];setTokens:Dispatch<SetStateAction<string[]>>;disabled:boolean;displayToken:(word:string)=>string}){
 const container=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null),suppressClick=useRef(false),focusWord=useRef<string|null>(null);
 const [preview,setPreview]=useState<Drag|null>(null),[announcement,setAnnouncement]=useState('');
 const helpId=useId();
 function cancel(){drag.current=null;setPreview(null);}
 useEffect(()=>{
  if(disabled||drag.current&&drag.current.snapshot!==tokens)cancel();
  if(focusWord.current){const word=focusWord.current;focusWord.current=null;container.current?.querySelectorAll<HTMLButtonElement>('[data-word]').forEach(button=>{if(button.dataset.word===word)button.focus({preventScroll:true});});}
 },[tokens,disabled]);
 function targetAt(x:number,y:number){
  const button=document.elementFromPoint(x,y)?.closest<HTMLButtonElement>('button[data-word]');
  return button&&container.current?.contains(button)?Number(button.dataset.position):null;
 }
 function down(event:PointerEvent<HTMLButtonElement>,index:number){
  if(disabled||!event.isPrimary||event.button!==0)return;
  suppressClick.current=false;
  const button=event.currentTarget,rect=button.getBoundingClientRect(),style=getComputedStyle(button);
  drag.current={pointer:event.pointerId,word:tokens[index],from:index,x:event.clientX,y:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height,font:style.font,fontSize:`${parseFloat(style.fontSize)*rect.width/button.offsetWidth}px`,background:style.backgroundColor,color:style.color,started:false,target:index,snapshot:tokens};
  button.setPointerCapture(event.pointerId);
 }
 function move(event:PointerEvent<HTMLButtonElement>){
  const current=drag.current;if(!current||current.pointer!==event.pointerId||disabled)return;
  if(!current.started&&Math.hypot(event.clientX-current.x,event.clientY-current.y)<6)return;
  event.preventDefault();current.started=true;current.x=event.clientX;current.y=event.clientY;current.target=targetAt(current.x,current.y);setPreview({...current});
 }
 function up(event:PointerEvent<HTMLButtonElement>){
  const current=drag.current;if(!current||current.pointer!==event.pointerId)return;
  if(current.started){
   event.preventDefault();suppressClick.current=true;
   const target=targetAt(event.clientX,event.clientY);
   if(!disabled&&target!==null&&target!==current.from){
    setTokens(previous=>previous===current.snapshot?moveSentenceWord(previous,current.from,target):previous);
    setAnnouncement(`${displayToken(current.word)} moved to position ${target+1} of ${tokens.length}.`);
   }
  }
  cancel();
 }
 return <>
  <div ref={container} className="sentence-answer" aria-label="Your sentence">{tokens.length===0?<span>Build your sentence here</span>:tokens.map((word,index)=><button key={word} data-word={word} data-position={index} data-dragging={preview?.word===word||undefined} data-drop-target={preview?.target===index&&preview.from!==index||undefined} disabled={disabled} aria-label={`Remove ${word}`} aria-describedby={helpId} lang="ru"
   onPointerDown={event=>down(event,index)} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{suppressClick.current=!!drag.current?.started;cancel();}} onLostPointerCapture={()=>{if(drag.current)cancel();}}
   onClick={event=>{if(suppressClick.current&&event.detail>0){suppressClick.current=false;event.preventDefault();return;}suppressClick.current=false;setTokens(previous=>previous.filter((_,i)=>i!==index));}}
   onKeyDown={event=>{
    if(!disabled&&event.altKey&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
     event.preventDefault();const target=index+(event.key==='ArrowLeft'?-1:1);
     if(target>=0&&target<tokens.length){focusWord.current=word;setTokens(previous=>moveSentenceWord(previous,index,target));setAnnouncement(`${displayToken(word)} moved to position ${target+1} of ${tokens.length}.`);}
    }
   }}>{displayToken(word)} <small aria-hidden="true">×</small></button>)}</div>
  <span id={helpId} className="sentence-reorder-accessible">Drag selected words to reorder them, or use Alt and the left or right arrow key. Tap or press Enter to put a word back.</span>
  <span className="sentence-reorder-accessible" role="status" aria-live="polite">{announcement}</span>
  {preview&&createPortal(<div className="sentence-drag-ghost" aria-hidden="true" lang="ru" style={{left:preview.x-preview.offsetX,top:preview.y-preview.offsetY,width:preview.width,height:preview.height,font:preview.font,fontSize:preview.fontSize,background:preview.background,color:preview.color}}>{displayToken(preview.word)}</div>,document.body)}
 </>;
}
