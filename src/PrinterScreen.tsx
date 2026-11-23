import {useEffect,useState} from 'react';
import {NativeSheet} from './NativeSheet';
export {PrintIcon} from './Icons';
import {rowsToDataUrl,type Rendered} from './printRender';
import {usePrinterState,type PrinterController} from './usePrinter';
import {describePrint,printEstimate,PRINTER_IDLE,type PrinterState} from './printerTransport';
// The app's own quiet look for the remembered printer is invisible: it reads as not connected.
const shown=(state:PrinterState):PrinterState=>state.quiet&&state.phase==='scanning'?{...state,phase:'disconnected',message:PRINTER_IDLE,devices:[]}:state;

const phases={disconnected:'Not connected',scanning:'Looking for printer',connecting:'Connecting',connected:'Connected',printing:'Printing',unavailable:'Bluetooth unavailable','permission-denied':'Permission denied',error:'Printer error'} as const;

// waiting: the printer the app reconnects to by itself, while it isn't connected.
function PrinterStatus({state,remembered,waiting}:{state:PrinterState;remembered?:string;waiting?:string}){
 const searching=state.phase==='scanning'||state.phase==='connecting';
 const idle=state.phase==='disconnected'||state.phase==='error'||state.phase==='unavailable';
 return <div className="native-physical-status" data-phase={state.phase==='printing'?'connected':state.phase} data-searching={searching} role="status" aria-live="polite" aria-atomic="true">
  <strong key={state.phase}><i className="native-physical-dot" aria-hidden="true"/>{phases[state.phase]}</strong>
  {(state.device?.name||remembered)&&<span>{state.device?.name||remembered}</span>}
  {waiting&&idle&&state.phase==='disconnected'&&state.message===PRINTER_IDLE?<p>{waiting} will reconnect by itself when it’s nearby.</p>:<p>{state.held?state.message:state.paused?'Printer is catching up…':state.message}</p>}
  {waiting&&idle&&!(state.phase==='disconnected'&&state.message===PRINTER_IDLE)&&<p>{waiting} will reconnect by itself when it’s nearby.</p>}
 </div>;
}
function DevicePicker({printer,state}:{printer:PrinterController;state:PrinterState}){
 if(state.phase!=='scanning'||!state.devices.length)return null;
 return <ul className="native-physical-devices" aria-label="Printers found">{state.devices.map(device=><li key={device.deviceId}><button disabled={state.busy} onClick={()=>printer.choose(device.deviceId)}><span>{device.name||'Thermal printer'}<small>Tap to connect</small></span><span aria-hidden="true">→</span></button></li>)}</ul>;
}
// How far the paper is and about how long is left, from the printer's speed (it doesn't report rows as it
// prints them, and sending is far ahead of the paper). Never "done" before the printer says so.
function Progress({state,rate}:{state:PrinterState;rate:number}){
 const printing=state.phase==='printing'&&!!state.progress;
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{if(!printing)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),250);return ()=>clearInterval(timer);},[printing]);
 if(!printing||!state.progress)return null;
 const {sent,total}=state.progress;
 const {printed,secondsLeft}=printEstimate({sent,total,elapsedMs:now-(state.printStartedAt??now),rowsPerSecond:rate});
 return <div className="native-printer-progress"><progress max={Math.max(1,total)} value={printed} aria-label="Printing progress"/><span>{printed>=total?'Almost done…':`About ${secondsLeft} s left`}</span>{!state.finishing&&<small>Keep Privet open until it finishes.</small>}</div>;
}

// Preview of exactly what will print (the 1-bit image), then Print / Cancel with progress.
export function PrinterSheet({printer,title,render,onClose}:{printer:PrinterController;title:string;render:()=>Rendered;onClose:()=>void}){
 const state=shown(usePrinterState(printer));
 const [card,setCard]=useState<{rows:Uint8Array[];url:string}|null>(null);
 const [problem,setProblem]=useState('');
 useEffect(()=>{
  let alive=true;
  // Fonts first, so the canvas never draws with a fallback.
  void (document.fonts?.ready??Promise.resolve()).then(()=>{
   if(!alive)return;
   try{const rendered=render();setCard({rows:rendered.rows,url:rowsToDataUrl(rendered.rows)});}
   catch{setProblem('Could not prepare this card.');}
  });
  return ()=>{alive=false;};
 },[render]);
 const busy=state.phase==='printing'||state.phase==='scanning'||state.phase==='connecting';
 const label=state.phase==='connected'?'Print':'Connect & print';
 return <NativeSheet id="native-printer-sheet" title={title} onClose={()=>{if(busy)printer.cancel();onClose();}}>
  <div className="native-sheet-scroll native-printer-sheet">
   <div className="native-printer-preview">{card?<img src={card.url} alt={`Preview of the printed ${title.toLowerCase()}`}/>:<p>{problem||'Preparing preview…'}</p>}</div>
   <PrinterStatus state={state} remembered={printer.remembered()?.name} waiting={printer.autoTarget()?(printer.autoTarget()!.name||'Your printer'):undefined}/>
   <DevicePicker printer={printer} state={state}/>
   <Progress state={state} rate={printer.rate()}/>
   <div className="native-printer-actions">{busy?<button className="native-physical-disconnect" onClick={printer.cancel}>{state.phase==='printing'?'Cancel printing':'Cancel'}</button>:<button className="button teal" disabled={!card||state.busy} onClick={()=>card&&printer.print(card.rows)}>{label} <span aria-hidden="true">→</span></button>}</div>
  </div>
 </NativeSheet>;
}

// Settings → Printer.
export function PrinterSettings({printer,onClose,onWordOfTheDay,onTestPage}:{printer:PrinterController;onClose:()=>void;onWordOfTheDay:()=>void;onTestPage:()=>void}){
 const state=shown(usePrinterState(printer));
 const last=state.lastPrint&&describePrint(state.lastPrint);
 const inSession=state.phase!=='disconnected'&&state.phase!=='error'&&state.phase!=='unavailable'&&state.phase!=='permission-denied';
 return <div className="native-physical-scroll">
  <header className="native-profile-navigation"><button className="app-icon-button" onClick={onClose} aria-label="Back to settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1 id="native-printer-title" tabIndex={-1}>Printer</h1><span aria-hidden="true"/></header>
  <section className="native-physical-intro"><span className="native-kicker">POCKET THERMAL PRINTER</span><h2>Learning cards on paper.</h2><p>Print the word of the day, practice strips and a progress receipt on a 57 mm Bluetooth printer.</p></section>
  <section className="native-physical-card" aria-label="Printer connection">
   <PrinterStatus state={state} remembered={printer.remembered()?.name} waiting={printer.autoTarget()?(printer.autoTarget()!.name||'Your printer'):undefined}/>
   <DevicePicker printer={printer} state={state}/>
   <Progress state={state} rate={printer.rate()}/>
   <div className="native-physical-actions">{inSession?<button className="native-physical-disconnect" onClick={state.phase==='connected'?printer.disconnect:printer.cancel}>{state.phase==='scanning'?'Stop looking':state.phase==='connecting'?'Cancel':state.phase==='printing'?'Cancel printing':'Disconnect'}</button>:<button className="button teal" onClick={printer.connect} disabled={state.busy}>Connect <span aria-hidden="true">→</span></button>}</div>
  </section>
  {(state.phase==='connected'||state.phase==='printing')&&<section className="native-physical-card native-printer-prints" aria-label="Print">
   <button className="button teal" onClick={onWordOfTheDay}>Print word of the day <span aria-hidden="true">→</span></button>
   <button className="native-text-button" onClick={onTestPage}>Print a test page</button>
  </section>}
  {last&&<section className="native-physical-card native-printer-prints" aria-label="Last print">
   <p className="native-printer-last"><strong>Last print: {last.summary}</strong><br/>{last.detail}</p>
  </section>}
 </div>;
}

export function PrinterSettingsButton({printer,onOpen}:{printer:PrinterController;onOpen:()=>void}){
 const state=shown(usePrinterState(printer));
 return <button id="native-printer-open" className="native-text-button native-physical-home" onClick={onOpen} aria-label={`Printer: ${phases[state.phase]}. Open printer settings.`}><span>Printer settings</span><span className="native-physical-home-status"><i aria-hidden="true" data-connected={state.phase==='connected'||state.phase==='printing'}/>{phases[state.phase]}</span></button>;
}

