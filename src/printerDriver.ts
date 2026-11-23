import type {PluginListenerHandle} from '@capacitor/core';
import {BleClient,BluetoothLe} from '@capacitor-community/bluetooth-le';
import {nativeBleShared} from './bleNative';
import {PRINTER_NOTIFY,PRINTER_SERVICE,PRINTER_WRITE,isCatPrinter} from './printerProtocol';
import type {PrinterDriver} from './printerTransport';

// The printer's plugin resources only: its own scan lease (an unfiltered share of the one native scan),
// its own disconnect listener and notifications. Cleanup never touches the companion's.
export function createNativePrinterDriver():PrinterDriver {
 let epoch=0,releaseScan:(()=>Promise<void>)|undefined,disconnectListener:PluginListenerHandle|undefined;
 // Largest write without response the link takes; packets above it go in pieces (the printer parses a stream).
 let chunk=20;
 const stopScan=async()=>{const release=releaseScan;releaseScan=undefined;await release?.();};
 return {
  initialize:()=>nativeBleShared().initialize(),
  isEnabled:()=>BleClient.isEnabled(),
  async scan(callback){
   await stopScan();
   const started=epoch;
   // No service filter: these printers don't reliably advertise ae30.
   const release=await nativeBleShared().acquireScan({accept:result=>isCatPrinter(result.name),callback:result=>callback({deviceId:result.deviceId,name:result.name})});
   if(started!==epoch){await release();throw new Error('Scan cancelled');}
   releaseScan=release;
  },
  stopScan,
  async connect(id,disconnected,timeout){
   const started=epoch;
   const listener=await BluetoothLe.addListener(`disconnected|${id}`,disconnected);
   if(started!==epoch){await listener.remove();throw new Error('Connection cancelled');}
   disconnectListener=listener;
   await BleClient.connect(id,undefined,{timeout});
   // iOS reports the write-without-response maximum + 3.
   try{const mtu=await BleClient.getMtu(id);if(Number.isInteger(mtu)&&mtu>23)chunk=Math.min(mtu-3,512);}catch{chunk=20;}
  },
  maxWrite:()=>chunk,
  subscribe:(id,callback,timeout)=>BleClient.startNotifications(id,PRINTER_SERVICE,PRINTER_NOTIFY,callback,{timeout}),
  async write(id,value){
   for(let offset=0;offset<value.length;offset+=chunk){
    const piece=value.slice(offset,offset+chunk);
    await BleClient.writeWithoutResponse(id,PRINTER_SERVICE,PRINTER_WRITE,new DataView(piece.buffer));
   }
  },
  async cleanup(id){
   epoch++;
   const listener=disconnectListener;disconnectListener=undefined;
   await Promise.allSettled([
    stopScan(),listener?.remove(),
    ...(id?[BleClient.stopNotifications(id,PRINTER_SERVICE,PRINTER_NOTIFY),BleClient.disconnect(id)]:[]),
   ]);
  },
 };
}
