import {useEffect,useRef,useState} from 'react';

type Colour='white'|'coral';
const colourLabel:Record<Colour,string>={white:'Warm white',coral:'Soft coral'};

// One card per device, each with a white and a soft coral concept illustration.
export const conceptDevices=[
 {id:'desk',name:'Desk companion',images:{
  white:{src:'images/companion-white.webp',alt:'White desk companion concept, showing a smiling OLED face, front button, and an open rear view with a conceptual servo, wiring, and ESP32 layout.'},
  coral:{src:'images/companion-coral.webp',alt:'Coral desk companion concept, showing the enclosed smiling robot alongside an open rear view of a conceptual OLED, head servo, and ESP32 layout.'},
 }},
 {id:'mini',name:'Privet Mini',images:{
  white:{src:'images/companion-mini.webp',alt:'White Privet Mini keychain companion concept: a small body with a black OLED face, a cream top button and a key ring.'},
  coral:{src:'images/companion-mini-coral.webp',alt:'Soft coral Privet Mini keychain companion concept: a small body with a black OLED face, a cream top button and a key ring.'},
 }},
 {id:'printer',name:'Printer body',images:{
  white:{src:'images/printer-concept.webp',alt:'Privet printer concept body, rendered from the app’s 3D model: a white front with a printed cat face and the Privet wordmark, mint shell and ears.'},
  coral:{src:'images/printer-concept-coral.webp',alt:'Privet printer concept body, rendered from the app’s 3D model: a white front with a printed cat face and the Privet wordmark, soft coral shell and ears.'},
 }},
] as const;
const colours:Colour[]=['white','coral'];

function ColourSwitch({device,colour,onPick,className}:{device:(typeof conceptDevices)[number];colour:Colour;onPick:(colour:Colour)=>void;className:string}){
 return <div className={className} role="group" aria-label={`${device.name} colour`}>
  {colours.map(option=><button key={option} onClick={()=>onPick(option)} aria-pressed={colour===option}><i className={`concept-swatch ${option} is-${device.id}`}/>{colourLabel[option]}</button>)}
 </div>;
}

export function CompanionGallery() {
 const [chosen,setChosen]=useState<Record<string,Colour>>({desk:'white',mini:'white',printer:'white'});
 const [activeIndex,setActiveIndex]=useState(0);
 const [isOpen,setIsOpen]=useState(false);
 const dialogRef=useRef<HTMLDialogElement>(null);
 const active=conceptDevices[activeIndex],activeColour=chosen[active.id];
 const pick=(id:string,colour:Colour)=>setChosen(current=>({...current,[id]:colour}));

 useEffect(()=>{
  if(!isOpen) return;
  const dialog=dialogRef.current!;
  const previousOverflow=document.body.style.overflow;
  dialog.showModal();
  document.body.style.overflow='hidden';
  return ()=>{dialog.close();document.body.style.overflow=previousOverflow;};
 },[isOpen]);

 return <div className="companion-gallery" aria-labelledby="companion-gallery-title">
  <div className="concept-gallery-heading"><div><div className="eyebrow">FROM AN IDEA TO SOMETHING YOU CAN PICTURE</div><h3 id="companion-gallery-title">A little family, taking shape.</h3></div><p>Each one in warm white or soft coral.<br/>Concept illustrations · enclosures planned.</p></div>
  <div className="concept-gallery-images">
   {conceptDevices.map((device,index)=>{const colour=chosen[device.id];return <figure key={device.id}>
    <button className="concept-image-button" onClick={()=>{setActiveIndex(index);setIsOpen(true);}} aria-label={`View ${device.name}, ${colourLabel[colour].toLowerCase()}, larger`} aria-haspopup="dialog" aria-controls="companion-image-viewer">
     {colours.map(option=><img key={option} src={device.images[option].src} width="1200" height="800" loading="lazy" decoding="async" alt={option===colour?device.images[option].alt:''} aria-hidden={option!==colour||undefined} className={option===colour?'is-active':undefined}/>)}
    </button>
    <figcaption><span className="concept-device-name">{device.name}</span><ColourSwitch device={device} colour={colour} onPick={option=>pick(device.id,option)} className="concept-colour-switch"/></figcaption>
   </figure>;})}
  </div>
  <dialog className="concept-lightbox" id="companion-image-viewer" ref={dialogRef} aria-labelledby="concept-lightbox-title" aria-describedby="concept-lightbox-description" onClose={()=>setIsOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setIsOpen(false);}} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const step=event.key==='ArrowRight'?1:conceptDevices.length-1;setActiveIndex(index=>(index+step)%conceptDevices.length);}}}>
   <div className="concept-lightbox-content">
    <div className="concept-lightbox-header"><div><span>CONCEPT ILLUSTRATION</span><h3 id="concept-lightbox-title">{active.name}</h3></div><button className="concept-lightbox-close" onClick={()=>setIsOpen(false)} aria-label="Close image viewer" autoFocus><span aria-hidden="true">×</span></button></div>
    <figure className="concept-lightbox-figure"><img src={active.images[activeColour].src} width="1200" height="800" decoding="async" alt={active.images[activeColour].alt}/></figure>
    <div className="concept-lightbox-footer"><ColourSwitch device={active} colour={activeColour} onPick={option=>pick(active.id,option)} className="concept-color-controls"/><span className="concept-image-count" aria-live="polite">{active.name} · {colourLabel[activeColour]} · {activeIndex+1} / {conceptDevices.length} <span className="concept-key-hint" aria-hidden="true">· ← → for the next</span></span></div>
    <p id="concept-lightbox-description">Concept illustrations · enclosures planned.</p>
   </div>
  </dialog>
 </div>;
}
