import {useEffect,useRef,useState} from 'react';

const illustrations = [
 {
  id:'white', label:'Warm white', src:'images/companion-white.png',
  alt:'White desk companion concept, showing a smiling OLED face, front button, and an open rear view with the planned servo, wiring, and ESP32 board.',
 },
 {
  id:'coral', label:'Soft coral', src:'images/companion-coral.png',
  alt:'Coral desk companion concept, showing the enclosed smiling robot alongside an open rear view of the planned OLED, head servo, and ESP32 electronics.',
 },
] as const;

export function CompanionGallery() {
 const [activeIndex,setActiveIndex]=useState(0);
 const [isOpen,setIsOpen]=useState(false);
 const dialogRef=useRef<HTMLDialogElement>(null);
 const active=illustrations[activeIndex];

 useEffect(()=>{
  if(!isOpen) return;
  const dialog=dialogRef.current!;
  const previousOverflow=document.body.style.overflow;
  dialog.showModal();
  document.body.style.overflow='hidden';
  return ()=>{dialog.close();document.body.style.overflow=previousOverflow;};
 },[isOpen]);

 return <div className="companion-gallery" aria-labelledby="companion-gallery-title">
  <div className="concept-gallery-heading"><div><div className="eyebrow">FROM AN IDEA TO SOMETHING YOU CAN PICTURE</div><h3 id="companion-gallery-title">A little companion, taking shape.</h3></div><p>Two color explorations. One tiny desk mate.<br/>Concept illustrations · physical hardware planned.</p></div>
  <div className="concept-gallery-images">
   {illustrations.map((illustration,index)=><figure key={illustration.id}>
    <button className="concept-image-button" onClick={()=>{setActiveIndex(index);setIsOpen(true);}} aria-label={`View ${illustration.label.toLowerCase()} companion illustration`} aria-haspopup="dialog" aria-controls="companion-image-viewer"><img src={illustration.src} width="1536" height="1024" loading="lazy" decoding="async" alt={illustration.alt}/></button>
    <figcaption><span><i className={`concept-swatch ${illustration.id}`}/> {illustration.label}</span><span>Concept illustration <span aria-hidden="true">⤢</span></span></figcaption>
   </figure>)}
  </div>
  <dialog className="concept-lightbox" id="companion-image-viewer" ref={dialogRef} aria-labelledby="concept-lightbox-title" aria-describedby="concept-lightbox-description" onClose={()=>setIsOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setIsOpen(false);}} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setActiveIndex(index=>(index+1)%illustrations.length);}}}>
   <div className="concept-lightbox-content">
    <div className="concept-lightbox-header"><div><span>COMPANION CONCEPT</span><h3 id="concept-lightbox-title">A little closer.</h3></div><button className="concept-lightbox-close" onClick={()=>setIsOpen(false)} aria-label="Close image viewer" autoFocus><span aria-hidden="true">×</span></button></div>
    <figure className="concept-lightbox-figure"><img src={active.src} width="1536" height="1024" decoding="async" alt={active.alt}/></figure>
    <div className="concept-lightbox-footer"><div className="concept-color-controls" role="group" aria-label="Companion illustration color">{illustrations.map((illustration,index)=><button key={illustration.id} onClick={()=>setActiveIndex(index)} aria-pressed={activeIndex===index}><i className={`concept-swatch ${illustration.id}`}/>{illustration.label}</button>)}</div><span className="concept-image-count" aria-live="polite">{active.label} · {activeIndex+1} / {illustrations.length}</span></div>
    <p id="concept-lightbox-description">Concept illustrations · physical hardware planned.</p>
   </div>
  </dialog>
 </div>;
}
