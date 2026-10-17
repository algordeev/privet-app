import type {PluginListenerHandle} from '@capacitor/core';
import {BleClient,BluetoothLe} from '@capacitor-community/bluetooth-le';
import {BLE_COMMAND,BLE_SERVICE,BLE_STATUS} from './bleProtocol';
import type {BleDriver} from './bleTransport';

// This adapter is the only owner of the BLE plugin. No initialization at import
// or mount: only the explicit Connect action may request Bluetooth permission.
export function createNativeBleDriver():BleDriver {
 let epoch=0,initialized=false;
 const disconnectListeners=new Set<PluginListenerHandle>();
 return {
  async initialize(){
   if(initialized)return;
   // The transport serializes writes itself. Let cancellation/cleanup reach the
   // native plugin immediately rather than queue behind an unresolved operation.
   BleClient.disableQueue();
   await BleClient.initialize();
   initialized=true;
  },
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
  watchEnabled:callback=>BleClient.startEnabledNotifications(callback),
  scan:(service,callback)=>BleClient.requestLEScan({services:[service]},result=>callback({deviceId:result.device.deviceId,name:result.localName||result.device.name})),
  stopScan:()=>BleClient.stopLEScan(),
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
   // Each cleanup is safe if initialization/subscription never finished. The
   // transport also cleans up after late native promise settlement before reuse.
   await Promise.allSettled([
    ...listeners.map(listener=>listener.remove()),
    BleClient.stopLEScan(),BleClient.stopEnabledNotifications(),
    ...(id?[BleClient.stopNotifications(id,BLE_SERVICE,BLE_STATUS),BleClient.disconnect(id)]:[])
   ]);
  }
 };
}
