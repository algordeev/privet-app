import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {NativeSheet} from './NativeSheet';
import {playHaptic} from './nativeHaptics';
import {foundCardFree,holdFoundCard,offeredPrinter} from './foundCards';
import type {PrinterDevice} from './printerTransport';
import {usePrinterState,type PrinterController} from './usePrinter';

const Robot3D=lazy(()=>import('./Robot3D'));
type Stage='found'|'connecting'|'connected'|'failed'|'gone';
const reducedMotion=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Floating card, like the companion's. On home it answers the quiet look with the first printer found
// (except the remembered one while auto-reconnect is on: that one connects by itself, without a card). In Settings → Printer
// the scan fills the list; the card opens once one is picked and plays its paper feed as it connects.
export function PrinterFoundCard({printer,where}:{printer:PrinterController;where:'home'|'printer'}){
 const state=usePrinterState(printer);
 const [card,setCard]=useState<{device:PrinterDevice;quiet:boolean;attempted:boolean}|null>(null);
 const [leaving,setLeaving]=useState(false);
 const dismissedScan=useRef(false),buzzed=useRef(false);
 const offered=offeredPrinter(state.devices,printer.autoTarget()?.deviceId);
 const offer=where==='home'&&state.phase==='scanning'&&!!state.quiet&&!!state.offer&&!!offered;
 const picked=where==='printer'&&state.phase==='connecting'&&!state.auto?state.device:undefined;
 useEffect(()=>{
  if(state.phase!=='scanning'&&state.phase!=='connecting'&&!card)dismissedScan.current=false;
  if(card||dismissedScan.current||!foundCardFree('printer'))return;
  if(offer){buzzed.current=false;setLeaving(false);setCard({device:offered!,quiet:true,attempted:false});printer.holdScan();}
  else if(picked){buzzed.current=false;setLeaving(false);setCard({device:picked,quiet:false,attempted:true});}
 },[offer,offered,picked,state.phase,card,printer]);
 useEffect(()=>{holdFoundCard('printer',!!card);return ()=>holdFoundCard('printer',false);},[card]);
 const stage:Stage|null=!card?null
  :(state.phase==='connected'||state.phase==='printing')&&state.device?.deviceId===card.device.deviceId?'connected'
  :state.phase==='connecting'&&state.device?.deviceId===card.device.deviceId?'connecting'
  :card.attempted?'failed'
  :state.phase==='scanning'?'found':'gone';
 useEffect(()=>{if(stage==='gone'){dismissedScan.current=true;setCard(null);}},[stage]);
 useEffect(()=>{if(stage==='connected'&&!buzzed.current){buzzed.current=true;playHaptic('complete');}},[stage]);
 if(!card||!stage||stage==='gone')return null;
 function close(){
  // Closing an unanswered card ends its look for this session; closing mid-connection cancels it.
  if(stage==='found')printer.dismissDiscovery();
  else if(stage==='connecting')printer.cancelConnection();
  dismissedScan.current=true;setCard(null);
 }
 const connect=()=>{setCard({...card,attempted:true});printer.choose(card.device.deviceId);};
 const message=stage==='found'?'Your thermal printer is nearby. Connect to print learning cards.'
  :stage==='connecting'?'Connecting… keep it close to your iPhone.'
  :stage==='connected'?'Connected. Print buttons are ready in your lessons and profile.'
  :state.message;
 return <NativeSheet id="printer-found" variant="card" title={card.device.name||'Thermal printer'} onClose={close}
  autoClose={leaving?0:stage==='connected'?(reducedMotion()?1200:3600):undefined}>
  <div className="companion-found" data-stage={stage} data-model="printer">
   <div className="companion-found-stage"><Suspense fallback={null}><Robot3D model="printer" mood={stage==='connected'?'connected':'sleeping'}/></Suspense></div>
   <p className="companion-found-status" role="status" aria-live="polite">{message}</p>
   <div className="companion-found-actions">
    {stage==='found'&&<><button className="button teal" onClick={connect}>Connect</button><button className="native-text-button" onClick={()=>setLeaving(true)}>Not now</button></>}
    {stage==='connecting'&&<button className="button teal" disabled><span className="companion-found-spinner" aria-hidden="true"/>Connecting…</button>}
    {stage==='connected'&&<p className="companion-found-done"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 12.5 4 4 8-9"/></svg></span>Connected</p>}
    {stage==='failed'&&<button className="button teal" onClick={()=>setLeaving(true)}>Close</button>}
   </div>
  </div>
 </NativeSheet>;
}
