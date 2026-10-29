import {useEffect,useState} from 'react';
import {useBleState,type PhysicalCompanionController} from './usePhysicalCompanion';
import {BLE_NAME} from './bleProtocol';
// Phases where the app is still looking for (or re-checking) the companion; these get a gentle searching motion.
const searching=(phase:string)=>phase==='scanning'||phase==='connecting'||phase==='reconciling';
const phases={suspended:'Reactions paused',reconciling:'Checking connection',disconnected:'Disconnected',scanning:'Scanning',connecting:'Connecting',connected:'Connected',unavailable:'Bluetooth unavailable','permission-denied':'Permission denied',error:'Connection error'} as const;
export function PhysicalCompanionSettings({controller,onClose,backLabel='Back to home'}:{controller:PhysicalCompanionController;onClose:()=>void;backLabel?:string}){
 const {scan,connect,disconnect,testHappy}=controller;
 const state=useBleState(controller);
 const inSession=state.phase==='scanning'||state.phase==='connecting'||state.phase==='connected'||state.phase==='suspended'||state.phase==='reconciling';
 return <div className="native-physical-scroll">
  <header className="native-profile-navigation"><button className="app-icon-button" onClick={onClose} aria-label={backLabel}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1 id="native-physical-title" tabIndex={-1}>Physical companion</h1><span aria-hidden="true"/></header>
  <section className="native-physical-intro"><span className="native-kicker">YOUR DESK COMPANION</span><h2>A little hello, over Bluetooth.</h2><p>Connect your {BLE_NAME} for little reactions as you learn. You can keep learning with or without it.</p></section>
  <section className="native-physical-card" aria-label="Physical companion settings">
   <div className="native-physical-status" data-phase={state.phase} data-searching={searching(state.phase)} role="status" aria-live="polite" aria-atomic="true"><strong key={state.phase}><i className="native-physical-dot" aria-hidden="true"/>{phases[state.phase]}</strong>{state.device&&<span>{state.device.name||BLE_NAME}</span>}<p>{state.message}</p>{state.notice&&<p className="native-physical-update">{state.notice}</p>}{state.busy&&!inSession&&<p>Finishing the previous connection. If this takes too long, reopen Privet.</p>}</div>
   {state.phase==='scanning'&&state.devices.length>0&&<ul className="native-physical-devices" aria-label="Available companions">{state.devices.map((device,index)=><li key={device.deviceId}><button disabled={state.busy} onClick={()=>connect(device.deviceId)}><span>{device.name||'Unnamed companion'}<small>Device {index+1} · Tap to connect</small></span><span aria-hidden="true">→</span></button></li>)}</ul>}
   <div className="native-physical-actions">{inSession?<button className="native-physical-disconnect" onClick={disconnect}>{state.phase==='scanning'?'Stop scanning':state.phase==='connecting'?'Cancel connection':'Disconnect'}</button>:<button className="button teal" onClick={scan} disabled={state.busy}>Connect <span aria-hidden="true">→</span></button>}
   <button className="button teal" onClick={testHappy} disabled={!state.ready||state.pending||state.busy}>{state.pending?'Sending reaction…':'Test happy reaction'}</button></div>
  </section>
  <p className="native-physical-note">An established connection can stay while your phone is locked. iOS or loss of range may interrupt it. Privet checks the connection when you return. Leaving this screen stops an unfinished connection.</p>
  <p className="native-physical-note">The virtual companion and pronunciation audio work independently.</p>
 </div>;
}

export function PhysicalCompanionHomeStatus({controller,onOpen}:{controller:PhysicalCompanionController;onOpen:()=>void}){
 const state=useBleState(controller);
 const label=state.phase==='connected'?(state.notice?'Connected · Update needed':'Connected'):phases[state.phase];
 return <button id="native-physical-open" className="native-text-button native-physical-home" onClick={onOpen} aria-label={`Physical companion: ${label}. Open settings.`}><span>Physical companion settings</span><span className="native-physical-home-status" role="status" aria-live="polite"><i aria-hidden="true" data-connected={state.phase==='connected'} data-searching={searching(state.phase)}/>{label}</span></button>;
}

// Survives home remounts: the connected ripple plays once per connection, not on every return home.
// Only a real end of the session resets it; a reconcile on app return keeps the same connection.
let connectionAnnounced=false;
export function PhysicalCompanionChip({controller,onOpen,greeting}:{controller:PhysicalCompanionController;onOpen:()=>void;greeting?:string}){
 const state=useBleState(controller);
 const connected=state.phase==='connected'&&state.ready;
 const inSession=searching(state.phase)||state.phase==='connected'||state.phase==='suspended';
 const [celebrate,setCelebrate]=useState(false);
 useEffect(()=>{
  if(!inSession){connectionAnnounced=false;return;}
  if(connected&&!connectionAnnounced){connectionAnnounced=true;setCelebrate(true);}
 },[connected,inSession]);
 const label=connected?'Companion connected':state.phase==='suspended'?'Companion paused':state.phase==='reconciling'?'Checking companion…':state.phase==='connecting'?'Connecting companion…':state.phase==='scanning'?'Finding companion…':'Have a physical companion? Let’s connect it.';
 return <div className="native-companion-bubble" data-connected={connected} data-searching={!connected&&searching(state.phase)}>
  <button id="native-companion-chip" className="native-companion-chip" data-connected={connected} data-celebrate={celebrate&&connected} onClick={onOpen} aria-label={connected?'Companion connected. Open physical companion settings.':`${label} Open physical companion settings.`}>
   {connected?<><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 7 10 10-5 4V3l5 4L7 17"/></svg><span className="native-sr-only" role="status" aria-live="polite" aria-atomic="true">{label}</span></>:<><span role="status" aria-live="polite" aria-atomic="true">{label}</span>{searching(state.phase)?<span className="native-searching-dots" aria-hidden="true"><i/><i/><i/></span>:<span aria-hidden="true">›</span>}</>}
  </button>
  {connected&&<p role="status" aria-live="polite" aria-atomic="true">{greeting}</p>}
 </div>;
}
