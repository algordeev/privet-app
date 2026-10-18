import {Capacitor} from '@capacitor/core';
import App from './App';
import {NativeApp} from './NativeApp';

// `?native=1` previews the iPhone app screens in any browser (for testing
// without a Mac). Bluetooth stays unavailable there; the BLE layer only runs on iOS.
export const nativePreview=()=>{try{return new URLSearchParams(location.search).get('native')==='1';}catch{return false;}};
export const isNativeLayout=()=>Capacitor.isNativePlatform()||nativePreview();
export function RuntimeApp(){return isNativeLayout()?<NativeApp/>:<App/>;}
