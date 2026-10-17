import {Capacitor} from '@capacitor/core';
import App from './App';
import {NativeApp} from './NativeApp';

export function RuntimeApp(){return Capacitor.isNativePlatform()?<NativeApp/>:<App/>;}
