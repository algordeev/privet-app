import type {PhysicalCompanionController} from './usePhysicalCompanion';
import type {BleState} from './bleTransport';
import {BLE_NAME} from './bleProtocol';
const phases={suspended:'Reactions paused',reconciling:'Checking connection',disconnected:'Disconnected',scanning:'Scanning',connecting:'Connecting',connected:'Connected',unavailable:'Bluetooth unavailable','permission-denied':'Permission denied',error:'Connection error'} as const;
export function PhysicalCompanionSettings({controller,onClose,backLabel='Back to home'}:{controller:PhysicalCompanionController;onClose:()=>void;backLabel?:string}){
 const {state,scan,connect,disconnect,testHappy}=controller;
 const inSession=state.phase==='scanning'||state.phase==='connecting'||state.phase==='connected'||state.phase==='suspended'||state.phase==='reconciling';
 return <div className="native-physical-scroll">
  <header className="native-profile-navigation"><button className="app-icon-button" onClick={onClose} aria-label={backLabel}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1 id="native-physical-title" tabIndex={-1}>Physical companion</h1><span aria-hidden="true"/></header>
  <section className="native-physical-intro"><span className="native-kicker">YOUR DESK COMPANION</span><h2>A little hello, over Bluetooth.</h2><p>Connect your {BLE_NAME} for little reactions as you learn. You can keep learning with or without it.</p></section>
  <section className="native-physical-card" aria-label="Physical companion settings">
   <div className="native-physical-status" role="status" aria-live="polite" aria-atomic="true"><strong>{phases[state.phase]}</strong>{state.device&&<span>{state.device.name||BLE_NAME}</span>}<p>{state.message}</p>{state.notice&&<p className="native-physical-update">{state.notice}</p>}{state.busy&&!inSession&&<p>Finishing the previous connection. If this takes too long, reopen Privet.</p>}</div>
   {state.phase==='scanning'&&state.devices.length>0&&<ul className="native-physical-devices" aria-label="Available companions">{state.devices.map((device,index)=><li key={device.deviceId}><button disabled={state.busy} onClick={()=>connect(device.deviceId)}><span>{device.name||'Unnamed companion'}<small>Device {index+1} · Tap to connect</small></span><span aria-hidden="true">→</span></button></li>)}</ul>}
   <div className="native-physical-actions">{inSession?<button className="native-physical-disconnect" onClick={disconnect}>{state.phase==='scanning'?'Stop scanning':state.phase==='connecting'?'Cancel connection':'Disconnect'}</button>:<button className="button teal" onClick={scan} disabled={state.busy}>Connect <span aria-hidden="true">→</span></button>}
   <button className="button teal" onClick={testHappy} disabled={!state.ready||state.pending||state.busy}>{state.pending?'Sending reaction…':'Test happy reaction'}</button></div>
  </section>
  <p className="native-physical-note">An established connection can stay while your phone is locked. iOS or loss of range may interrupt it. Privet checks the connection when you return. Leaving this screen stops an unfinished connection.</p>
  <p className="native-physical-note">The virtual companion and pronunciation audio work independently.</p>
 </div>;
}

export function PhysicalCompanionHomeStatus({state,onOpen}:{state:BleState;onOpen:()=>void}){
 const label=state.phase==='connected'?(state.notice?'Connected · Update needed':'Connected'):phases[state.phase];
 return <button id="native-physical-open" className="native-text-button native-physical-home" onClick={onOpen} aria-label={`Physical companion: ${label}. Open settings.`}><span>Physical companion settings</span><span className="native-physical-home-status" role="status" aria-live="polite"><i aria-hidden="true" data-connected={state.phase==='connected'}/>{label}</span></button>;
}
