import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {NativeSheet} from './NativeSheet';
import {BLE_NAME,companionModel} from './bleProtocol';
import {playHaptic} from './nativeHaptics';
import type {PhysicalDevice} from './bleTransport';
import {useBleState,type PhysicalCompanionController} from './usePhysicalCompanion';

const loadRobot3D=()=>import('./Robot3D');
const Robot3D=lazy(loadRobot3D);
// Home and companion settings load the 3D code ahead, so the card opens straight onto the robot.
export function preloadCompanionRobot(){void loadRobot3D().catch(()=>{/* The card loads it again when it opens. */});}
type Stage='found'|'connecting'|'connected'|'failed'|'gone';
const reducedMotion=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Floating card. On home it answers the quiet discovery scan with the first companion found (never the
// remembered companion: the app reconnects to that one by itself, without a card).
// In companion settings the scan only fills the list, so any of several companions can be chosen;
// the card opens once one is picked and plays its wake-up while it connects.
export function CompanionFoundCard({controller,where}:{controller:PhysicalCompanionController;where:'home'|'physical'}){
 const state=useBleState(controller);
 const [card,setCard]=useState<{device:PhysicalDevice;quiet:boolean;attempted:boolean}|null>(null);
 const [leaving,setLeaving]=useState(false);
 const dismissedScan=useRef(false),buzzed=useRef(false);
 const offer=where==='home'&&state.phase==='scanning'&&state.devices.length>0&&!!state.quiet&&!!state.offer;
 const picked=where==='physical'&&state.phase==='connecting'&&!state.auto?state.device:undefined;
 useEffect(()=>{
  if(state.phase!=='scanning'&&state.phase!=='connecting'&&!card)dismissedScan.current=false;
  if(card||dismissedScan.current)return;
  if(offer){buzzed.current=false;setLeaving(false);setCard({device:state.devices[0],quiet:true,attempted:false});controller.holdScan();}
  else if(picked){buzzed.current=false;setLeaving(false);setCard({device:picked,quiet:false,attempted:true});}
 },[offer,picked,state.phase,card,controller]);
 const stage:Stage|null=!card?null
  :state.phase==='connected'&&state.ready&&state.device?.deviceId===card.device.deviceId?'connected'
  :state.phase==='connecting'&&state.device?.deviceId===card.device.deviceId?'connecting'
  // After a failed attempt the card keeps its message, even once home's discovery scans again.
  :card.attempted?'failed'
  :state.phase==='scanning'?'found':'gone';
 useEffect(()=>{if(stage==='gone'){dismissedScan.current=true;setCard(null);}},[stage]);
 useEffect(()=>{if(stage==='connected'&&!buzzed.current){buzzed.current=true;playHaptic('complete');}},[stage]);
 if(!card||!stage||stage==='gone')return null;
 function close(){
  // Closing an unanswered card ends its scan; closing mid-connection cancels it.
  if(stage==='found')card!.quiet?controller.dismissDiscovery():controller.cancelScan();
  else if(stage==='connecting')controller.cancelConnection();
  dismissedScan.current=true;setCard(null);
 }
 const connect=()=>{setCard({...card,attempted:true});controller.connect(card.device.deviceId);};
 const name=card.device.name||BLE_NAME,model=companionModel(card.device.name);
 const message=stage==='found'?`Your ${model==='mini'?'pocket':'desk'} companion is nearby. Connect to wake it up.`
  :stage==='connecting'?'Connecting… keep it close to your iPhone.'
  :stage==='connected'?'Connected. It will react as you learn.'
  :state.message;
 return <NativeSheet id="companion-found" variant="card" title={name} onClose={close}
  autoClose={leaving?0:stage==='connected'?(reducedMotion()?1200:3200):undefined}>
  <div className="companion-found" data-stage={stage} data-model={model}>
   <div className="companion-found-stage"><Suspense fallback={null}><Robot3D model={model} mood={stage==='connected'?'connected':'sleeping'}/></Suspense></div>
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
