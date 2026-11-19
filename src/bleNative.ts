import {BleClient} from '@capacitor-community/bluetooth-le';
import {createBleShared,type BleShared} from './bleShared';

let shared:BleShared|undefined;
// The plugin's global state (initialization, the one native scan, the Bluetooth-enabled listener),
// shared by the robot/Mini driver (bleDriver.ts) and the printer driver (printerDriver.ts). Created on first use, never at import.
export function nativeBleShared():BleShared{
 shared??=createBleShared({
  disableQueue:()=>BleClient.disableQueue(),
  initialize:()=>BleClient.initialize(),
  requestLEScan:(options,callback)=>BleClient.requestLEScan(options,result=>callback({deviceId:result.device.deviceId,name:result.localName||result.device.name,uuids:result.uuids})),
  stopLEScan:()=>BleClient.stopLEScan(),
  startEnabledNotifications:callback=>BleClient.startEnabledNotifications(callback),
  stopEnabledNotifications:()=>BleClient.stopEnabledNotifications(),
 });
 return shared;
}
