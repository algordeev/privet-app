import {useCallback,useEffect,useRef,useSyncExternalStore} from 'react';
import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {appStorage} from './previewStorage';
import {PRODUCT} from './config';
import {DEFAULT_ENERGY,ENERGY,printJob} from './printerProtocol';
import {createNativePrinterDriver} from './printerDriver';
import {createPrinterTransport,initialPrinterState,type PrinterDevice,type PrinterState,type PrinterTransport} from './printerTransport';

// The thermal printer remembered by itself, apart from the companion (COMPANION_KEY): found by the
// companion's discovery it would never be offered, and the printer is only looked for on request.
export const PRINTER_KEY=`${PRODUCT.storageKey}-printer-device`;
export const PRINTER_ENERGY_KEY=`${PRODUCT.storageKey}-printer-energy`;
const energies=Object.values(ENERGY) as number[];
function savedEnergy(){try{const value=Number(appStorage.getItem(PRINTER_ENERGY_KEY)??DEFAULT_ENERGY);return energies.includes(value)?value:DEFAULT_ENERGY;}catch{return DEFAULT_ENERGY;}}
export function rememberedPrinter():PrinterDevice|undefined{
 try{
  const saved=JSON.parse(appStorage.getItem(PRINTER_KEY)??'null') as unknown;
  if(!saved||typeof saved!=='object')return undefined;
  const {deviceId,name}=saved as Record<string,unknown>;
  return typeof deviceId==='string'&&deviceId?{deviceId,name:typeof name==='string'?name:undefined}:undefined;
 }catch{return undefined;}
}
export const printingSupported=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='ios'&&Capacitor.isPluginAvailable('BluetoothLe');

export function usePrinter(){
 // High-frequency state (progress every few rows) lives outside React, like useBleState.
 const store=useRef<{state:PrinterState;listeners:Set<()=>void>}|null>(null);
 if(!store.current)store.current={state:initialPrinterState(),listeners:new Set()};
 const transport=useRef<PrinterTransport|null>(null);
 // Rows waiting for a connection: Print while disconnected connects first, then prints.
 const pending=useRef<Uint8Array[]|undefined>(undefined);
 const getState=useCallback(()=>store.current!.state,[]);
 const subscribe=useCallback((listener:()=>void)=>{store.current!.listeners.add(listener);return ()=>{store.current!.listeners.delete(listener);};},[]);
 const start=useCallback((rows:Uint8Array[])=>{void transport.current?.print(printJob(rows,{energy:savedEnergy()}));},[]);
 const setState=useCallback((next:PrinterState)=>{
  const previous=store.current!.state;
  store.current!.state=next;
  if(next.phase==='connected'&&previous.phase==='connecting'&&next.device){
   try{appStorage.setItem(PRINTER_KEY,JSON.stringify({deviceId:next.device.deviceId,name:next.device.name}));}catch{/* Just not remembered. */}
   const rows=pending.current;pending.current=undefined;
   if(rows)setTimeout(()=>start(rows),0);
  }
  // A scan or connection that ended without a printer drops the waiting job.
  if(next.phase!=='scanning'&&next.phase!=='connecting'&&next.phase!=='connected')pending.current=undefined;
  for(const listener of store.current!.listeners)listener();
 },[start]);
 useEffect(()=>{
  const actor=createPrinterTransport(createNativePrinterDriver(),setState,{supported:printingSupported});
  transport.current=actor;
  let nativeActive=true;
  const visibility=()=>actor.setActive(nativeActive&&!document.hidden);
  const pagehide=()=>actor.setActive(false);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pagehide);
  const listener=Capacitor.isNativePlatform()?App.addListener('appStateChange',({isActive})=>{nativeActive=isActive;visibility();}):undefined;
  return ()=>{
   transport.current=null;pending.current=undefined;actor.dispose();setState(initialPrinterState());
   document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);
   void listener?.then(handle=>handle.remove()).catch(()=>{});
  };
 },[setState]);
 // Connect: looks for printers, connecting at once to the remembered one.
 const connect=useCallback(()=>{void transport.current?.scan({target:rememberedPrinter()?.deviceId});},[]);
 const choose=useCallback((id:string)=>{void transport.current?.connect(id);},[]);
 const print=useCallback((rows:Uint8Array[])=>{
  const t=transport.current,s=store.current!.state;if(!t)return;
  if(s.phase==='connected'){start(rows);return;}
  if(s.phase==='printing')return;
  pending.current=rows;
  if(s.phase!=='scanning'&&s.phase!=='connecting')void t.scan({target:rememberedPrinter()?.deviceId});
 },[start]);
 const cancel=useCallback(()=>{pending.current=undefined;transport.current?.cancel();},[]);
 const disconnect=useCallback(()=>{pending.current=undefined;void transport.current?.disconnect();},[]);
 const setEnergy=useCallback((value:number)=>{if(!energies.includes(value))return;try{appStorage.setItem(PRINTER_ENERGY_KEY,String(value));}catch{/* Used for this print only. */}},[]);
 const forget=useCallback(()=>{try{appStorage.removeItem(PRINTER_KEY);}catch{/* Nothing to forget. */}},[]);
 return {getState,subscribe,connect,choose,print,cancel,disconnect,energy:savedEnergy,setEnergy,remembered:rememberedPrinter,forget,supported:printingSupported};
}
export type PrinterController=ReturnType<typeof usePrinter>;
export function usePrinterState(controller:PrinterController){return useSyncExternalStore(controller.subscribe,controller.getState,controller.getState);}
// Whether print options should show: only while a printer is connected (or printing). A boolean
// snapshot, so the caller re-renders when it changes, not on every progress update.
export const printerConnected=(state:PrinterState)=>state.phase==='connected'||state.phase==='printing';
export function usePrinterConnected(controller:PrinterController){const get=()=>printerConnected(controller.getState());return useSyncExternalStore(controller.subscribe,get,get);}

