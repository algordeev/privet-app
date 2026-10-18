import {Capacitor} from '@capacitor/core';
import App from './App';
import {NativeApp} from './NativeApp';

// `?native=1` previews the iPhone app screens in any browser (for testing
// without a Mac). Bluetooth stays unavailable there; the BLE layer only runs on iOS.
// The hosted site (VITE_PHONE_DEFAULT=1) opens the phone screens by default; `?native=0` shows the café demo.
const phoneDefault=(import.meta as {env?:Record<string,string|undefined>}).env?.VITE_PHONE_DEFAULT==='1';
export const nativePreview=()=>{try{const v=new URLSearchParams(location.search).get('native');return v==='1'||(phoneDefault&&v!=='0');}catch{return phoneDefault;}};
export const isNativeLayout=()=>Capacitor.isNativePlatform()||nativePreview();
export function RuntimeApp(){return isNativeLayout()?<NativeApp/>:<App/>;}
