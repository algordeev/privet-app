import type {PluginListenerHandle} from '@capacitor/core';
import {BleClient,BluetoothLe} from '@capacitor-community/bluetooth-le';
import {BLE_COMMAND,BLE_SERVICE,BLE_STATUS} from './bleProtocol';
import {nativeBleShared} from './bleNative';
import type {BleDriver} from './bleTransport';

// Both companions advertise the Privet service and a Privet- name (see bleProtocol.ts). The name also
// counts while another driver keeps the shared scan unfiltered and an advertisement omits the UUID.
const isCompanion=(result:{name?:string;uuids?:string[]})=>!!result.uuids?.some(uuid=>uuid.toLowerCase()===BLE_SERVICE)||!!result.name?.startsWith('Privet-');

// This adapter owns only the companion's own plugin resources. No initialization at import or mount:
// only the explicit Connect action may request Bluetooth permission.
export function createNativeBleDriver():BleDriver {
 let epoch=0;
 const disconnectListeners=new Set<PluginListenerHandle>();
 // Its own scan lease and enabled watches: cleanup releases these, never another driver's.
 let releaseScan:(()=>Promise<void>)|undefined;
 const unwatch=new Set<()=>Promise<void>>();
 const stopScan=async()=>{const release=releaseScan;releaseScan=undefined;await release?.();};
 return {
  // The transport serializes writes itself; the shared layer disables the plugin queue once.
  initialize:()=>nativeBleShared().initialize(),
  isEnabled:()=>BleClient.isEnabled(),
  async connected(id){
   const started=epoch;
   // Supported APIs: system-connected peripherals, followed by the plugin's
   // app-owned CBPeripheral.state check in getServices. Never call connect here.
   const devices=await BleClient.getConnectedDevices([BLE_SERVICE]);
   if(started!==epoch||!devices.some(device=>device.deviceId===id))return false;
   const services=await BleClient.getServices(id);
   if(started!==epoch)return false;
   const service=services.find(item=>item.uuid.toLowerCase()===BLE_SERVICE);
   return !!service?.characteristics.some(c=>c.uuid.toLowerCase()===BLE_COMMAND&&c.properties.write)
    &&!!service.characteristics.some(c=>c.uuid.toLowerCase()===BLE_STATUS&&c.properties.notify);
  },
  async watchEnabled(callback){
   const started=epoch;
   const remove=await nativeBleShared().watchEnabled(callback);
   if(started!==epoch){await remove();throw new Error('Connection cancelled');}
   unwatch.add(remove);
  },
  async scan(service,callback){
   await stopScan();
   const started=epoch;
   const release=await nativeBleShared().acquireScan({services:[service],accept:isCompanion,callback:result=>callback({deviceId:result.deviceId,name:result.name})});
   if(started!==epoch){await release();throw new Error('Scan cancelled');}
   releaseScan=release;
  },
  stopScan,
  async connect(id,disconnected,timeout){
   const started=epoch;
   // BleClient's convenience onDisconnect callback has no removal API in
   // v8.3.0. Own only this listener directly so its handle can be released.
   const listener=await BluetoothLe.addListener(`disconnected|${id}`,disconnected);
   if(started!==epoch){await listener.remove();throw new Error('Connection cancelled');}
   disconnectListeners.add(listener);
   await BleClient.connect(id,undefined,{timeout});
  },
  subscribe:(id,callback,timeout)=>BleClient.startNotifications(id,BLE_SERVICE,BLE_STATUS,callback,{timeout}),
  write:(id,value,timeout)=>BleClient.write(id,BLE_SERVICE,BLE_COMMAND,value,{timeout}),
  async cleanup(id){
   epoch++;
   const listeners=[...disconnectListeners];disconnectListeners.clear();
   const watches=[...unwatch];unwatch.clear();
   // Each cleanup is safe if initialization/subscription never finished. The
   // transport also cleans up after late native promise settlement before reuse.
   await Promise.allSettled([
    ...listeners.map(listener=>listener.remove()),
    stopScan(),...watches.map(remove=>remove()),
    ...(id?[BleClient.stopNotifications(id,BLE_SERVICE,BLE_STATUS),BleClient.disconnect(id)]:[])
   ]);
  }
 };
}
