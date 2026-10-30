import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {NativeSheet} from './NativeSheet';
import {OledFace} from './OledFace';
import {BLE_NAME} from './bleProtocol';
import {playHaptic} from './nativeHaptics';
import type {PhysicalDevice} from './bleTransport';
import {useBleState,type PhysicalCompanionController} from './usePhysicalCompanion';

const Robot3D=lazy(()=>import('./Robot3D'));
type Stage='found'|'connecting'|'connected'|'failed'|'gone';
const reducedMotion=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Floating card. On home it answers the quiet discovery scan; in companion settings it answers
// the explicit Connect scan when exactly one companion is found (several keep the plain list).
export function CompanionFoundCard({controller,where}:{controller:PhysicalCompanionController;where:'home'|'physical'}){
 const state=useBleState(controller);
 const [card,setCard]=useState<{device:PhysicalDevice;quiet:boolean;attempted:boolean}|null>(null);
 const [leaving,setLeaving]=useState(false);
 const dismissedScan=useRef(false),buzzed=useRef(false);
 const offer=state.phase==='scanning'&&state.devices.length>0&&(where==='home'?!!state.quiet:!state.quiet&&state.devices.length===1);
 useEffect(()=>{
  if(state.phase!=='scanning'&&!card)dismissedScan.current=false;
  if(!card&&offer&&!dismissedScan.current){buzzed.current=false;setLeaving(false);setCard({device:state.devices[0],quiet:!!state.quiet,attempted:false});controller.holdScan();}
 },[offer,state.phase,card,controller]);
 const stage:Stage|null=!card?null
  :state.phase==='connected'&&state.ready&&state.device?.deviceId===card.device.deviceId?'connected'
  :state.phase==='connecting'?'connecting'
  :state.phase==='scanning'?'found'
  :card.attempted?'failed':'gone';
 useEffect(()=>{if(stage==='gone'){dismissedScan.current=true;setCard(null);}},[stage]);
 useEffect(()=>{if(stage==='connected'&&!buzzed.current){buzzed.current=true;playHaptic('complete');}},[stage]);
 if(!card||!stage||stage==='gone')return null;
 function close(){
  // Closing an unanswered card ends its scan; closing mid-connection cancels it.
  if(stage==='found')card!.quiet?controller.dismissDiscovery():controller.cancelScan();
  else if(stage==='connecting')controller.disconnect();
  dismissedScan.current=true;setCard(null);
 }
 const connect=()=>{setCard({...card,attempted:true});controller.connect(card.device.deviceId);};
 const name=card.device.name||BLE_NAME;
 const message=stage==='found'?'Your desk companion is nearby. Connect to wake it up.'
  :stage==='connecting'?'Connecting… keep it close to your iPhone.'
  :stage==='connected'?'Connected. It will react as you learn.'
  :state.message;
 return <NativeSheet id="companion-found" variant="card" title={name} onClose={close}
  autoClose={leaving?0:stage==='connected'?(reducedMotion()?1200:3200):undefined}>
  <div className="companion-found" data-stage={stage}>
   <div className="companion-found-stage"><Suspense fallback={<OledFace mood="sleeping"/>}><Robot3D mood={stage==='connected'?'connected':'sleeping'}/></Suspense></div>
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
