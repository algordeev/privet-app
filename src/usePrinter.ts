import {useCallback,useEffect,useRef,useSyncExternalStore} from 'react';
import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {appStorage} from './previewStorage';
import {PRODUCT} from './config';
import {printJob} from './printerProtocol';
import {createNativePrinterDriver} from './printerDriver';
import {BLE_USED_KEY} from './usePhysicalCompanion';
import {createPrinterTransport,DEFAULT_PRINT_ROWS_PER_SECOND,initialPrinterState,learnRate,type PrinterDevice,type PrinterState,type PrinterTransport} from './printerTransport';

// The thermal printer remembered by itself, apart from the companion (COMPANION_KEY), so the companion's
// discovery never offers it. Like the companion, the app reconnects to it by itself whenever the app is
// open and it is nearby; Disconnect turns that off (PRINTER_AUTO_OFF_KEY) until the next connection by hand.
export const PRINTER_KEY=`${PRODUCT.storageKey}-printer-device`;
export const PRINTER_AUTO_OFF_KEY=`${PRODUCT.storageKey}-printer-auto-off`;
// The printer's speed in rows per second, learnt from prints it said it finished (see learnRate).
export const PRINTER_RATE_KEY=`${PRODUCT.storageKey}-printer-rate`;
function learntRate():number|undefined{try{const value=Number(appStorage.getItem(PRINTER_RATE_KEY));return Number.isFinite(value)&&value>0?value:undefined;}catch{return undefined;}}
export const printRate=()=>learntRate()??DEFAULT_PRINT_ROWS_PER_SECOND;
// Same rhythm as the companion: a quick look every 4 s for two minutes after the printer went away (or
// the app came back), then every 20 s.
const LOOK_FAST_MS=4000,LOOK_FAST_FOR_MS=120000,LOOK_SLOW_MS=20000;
export function rememberedPrinter():PrinterDevice|undefined{
 try{
  const saved=JSON.parse(appStorage.getItem(PRINTER_KEY)??'null') as unknown;
  if(!saved||typeof saved!=='object')return undefined;
  const {deviceId,name}=saved as Record<string,unknown>;
  return typeof deviceId==='string'&&deviceId?{deviceId,name:typeof name==='string'?name:undefined}:undefined;
 }catch{return undefined;}
}
// The printer the app reconnects to by itself, if any. A remembered printer means Bluetooth was granted.
export function autoReconnectPrinter():PrinterDevice|undefined{
 try{if(appStorage.getItem(PRINTER_AUTO_OFF_KEY)==='1')return undefined;}catch{return undefined;}
 return rememberedPrinter();
}
// Bluetooth was granted before (a companion or a printer connected): only then may home look for a new
// printer by itself, without a permission prompt.
function bluetoothUsed(){try{return appStorage.getItem(BLE_USED_KEY)==='1'||!!rememberedPrinter();}catch{return false;}}
export const printingSupported=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='ios'&&Capacitor.isPluginAvailable('BluetoothLe');

export function usePrinter(){
 // High-frequency state (progress every few rows) lives outside React, like useBleState.
 const store=useRef<{state:PrinterState;listeners:Set<()=>void>}|null>(null);
 if(!store.current)store.current={state:initialPrinterState(),listeners:new Set()};
 const transport=useRef<PrinterTransport|null>(null);
 // Rows waiting for a connection: Print while disconnected connects first, then prints.
 const pending=useRef<Uint8Array[]|undefined>(undefined);
 const reconnect=useRef<{timer?:ReturnType<typeof setTimeout>;lostAt:number;running:boolean}>({lostAt:Date.now(),running:false});
 // Home's quiet look for a printer the app doesn't know yet, for the "printer found" card. "Not now"
 // (or Disconnect) ends it for this app session.
 const discovery=useRef<{wanted:boolean;dismissed:boolean}>({wanted:false,dismissed:false});
 const lookAgain=useCallback(()=>{
  const r=reconnect.current,d=discovery.current;clearTimeout(r.timer);r.timer=undefined;
  if(!r.running)return;
  const target=autoReconnectPrinter()?.deviceId,offer=d.wanted&&!d.dismissed&&bluetoothUsed();
  if(target||offer)void transport.current?.discover({target,offer});
  r.timer=setTimeout(lookAgain,offer||Date.now()-r.lostAt<LOOK_FAST_FOR_MS?LOOK_FAST_MS:LOOK_SLOW_MS);
 },[]);
 // Home calls this while it is open; the returned function stops it.
 const discover=useCallback(()=>{
  const d=discovery.current;d.wanted=true;lookAgain();
  return ()=>{d.wanted=false;transport.current?.stopDiscovery();};
 },[lookAgain]);
 const dismissDiscovery=useCallback(()=>{discovery.current.dismissed=true;transport.current?.stopDiscovery();},[]);
 const holdScan=useCallback(()=>{transport.current?.holdScan();},[]);
 // Closing the card mid-connection: that attempt only (auto-reconnect is unchanged).
 const cancelConnection=useCallback(()=>{pending.current=undefined;transport.current?.cancel();},[]);
 const getState=useCallback(()=>store.current!.state,[]);
 const subscribe=useCallback((listener:()=>void)=>{store.current!.listeners.add(listener);return ()=>{store.current!.listeners.delete(listener);};},[]);
 // Always the Normal darkness (printJob's default), which suits the SC03h-type printers.
 // Each print the printer says it finished refines its speed, for the next print's progress and time left.
 const start=useCallback((rows:Uint8Array[])=>{void transport.current?.print(printJob(rows),{onOutcome:stats=>{
  const rate=learnRate(learntRate(),stats);
  if(rate!==undefined)try{appStorage.setItem(PRINTER_RATE_KEY,String(rate));}catch{/* The default speed stays. */}
 }});},[]);
 const setState=useCallback((next:PrinterState)=>{
  const previous=store.current!.state;
  store.current!.state=next;
  if(next.phase==='connected'&&previous.phase==='connecting'&&next.device){
   try{
    appStorage.setItem(BLE_USED_KEY,'1');
    appStorage.setItem(PRINTER_KEY,JSON.stringify({deviceId:next.device.deviceId,name:next.device.name}));
    // Connected by hand: reconnecting by itself is on again.
    if(!next.auto)appStorage.removeItem(PRINTER_AUTO_OFF_KEY);
   }catch{/* Just not remembered. */}
   const rows=pending.current;pending.current=undefined;
   if(rows)setTimeout(()=>start(rows),0);
  }
  // Lost (not only by Disconnect): look quickly for a while.
  const linked=(phase:PrinterState['phase'])=>phase==='connected'||phase==='printing';
  if(linked(previous.phase)&&!linked(next.phase))reconnect.current.lostAt=Date.now();
  // A scan or connection that ended without a printer drops the waiting job.
  if(next.phase!=='scanning'&&next.phase!=='connecting'&&next.phase!=='connected')pending.current=undefined;
  for(const listener of store.current!.listeners)listener();
 },[start]);
 useEffect(()=>{
  const actor=createPrinterTransport(createNativePrinterDriver(),setState,{supported:printingSupported,hidden:()=>document.hidden});
  transport.current=actor;
  let nativeActive=true;
  const visibility=()=>{
   // Only a real background holds a running print; being covered for a moment (Control Center, a banner,
   // a system prompt) does not interrupt it.
   const active=nativeActive&&!document.hidden;actor.setActive(active,document.hidden);
   // Back in the app: look quickly again, starting now.
   if(active){reconnect.current.lostAt=Date.now();lookAgain();}
  };
  const pagehide=()=>actor.setActive(false,true);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pagehide);
  const listener=Capacitor.isNativePlatform()?App.addListener('appStateChange',({isActive})=>{nativeActive=isActive;visibility();}):undefined;
  // The look-again loop, on every screen while the app is open (only on a device that can print).
  if(printingSupported()){reconnect.current.running=true;reconnect.current.lostAt=Date.now();lookAgain();}
  return ()=>{
   reconnect.current.running=false;clearTimeout(reconnect.current.timer);
   transport.current=null;pending.current=undefined;actor.dispose();setState(initialPrinterState());
   document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);
   void listener?.then(handle=>handle.remove()).catch(()=>{});
  };
 },[setState,lookAgain]);
 // Connect: looks for printers, connecting at once to the remembered one.
 const connect=useCallback(()=>{void transport.current?.scan({target:rememberedPrinter()?.deviceId});},[]);
 const choose=useCallback((id:string)=>{void transport.current?.connect(id);},[]);
 const print=useCallback((rows:Uint8Array[])=>{
  const t=transport.current,s=store.current!.state;if(!t)return;
  if(s.phase==='connected'){start(rows);return;}
  if(s.phase==='printing')return;
  pending.current=rows;
  // Not already looking or connecting (a quiet look becomes the visible scan).
  if((s.phase==='scanning'&&s.quiet)||(s.phase!=='scanning'&&s.phase!=='connecting'))void t.scan({target:rememberedPrinter()?.deviceId});
 },[start]);
 const cancel=useCallback(()=>{pending.current=undefined;transport.current?.cancel();},[]);
 // Disconnect by hand: the app stops reconnecting by itself until the next connection by hand.
 const disconnect=useCallback(()=>{
  pending.current=undefined;discovery.current.dismissed=true;
  try{appStorage.setItem(PRINTER_AUTO_OFF_KEY,'1');}catch{/* Reconnecting stays on. */}
  void transport.current?.disconnect();
 },[]);
 const forget=useCallback(()=>{try{appStorage.removeItem(PRINTER_KEY);}catch{/* Nothing to forget. */}},[]);
 return {rate:printRate,getState,subscribe,connect,choose,discover,dismissDiscovery,holdScan,cancelConnection,print,cancel,disconnect,remembered:rememberedPrinter,autoTarget:autoReconnectPrinter,forget,supported:printingSupported};
}
export type PrinterController=ReturnType<typeof usePrinter>;
export function usePrinterState(controller:PrinterController){return useSyncExternalStore(controller.subscribe,controller.getState,controller.getState);}
// Whether print options should show: only while a printer is connected (or printing). A boolean
// snapshot, so the caller re-renders when it changes, not on every progress update.
export const printerConnected=(state:PrinterState)=>state.phase==='connected'||state.phase==='printing';
export function usePrinterConnected(controller:PrinterController){const get=()=>printerConnected(controller.getState());return useSyncExternalStore(controller.subscribe,get,get);}

