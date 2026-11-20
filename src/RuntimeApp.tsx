import {Capacitor} from '@capacitor/core';
import App from './App';
import {NativeApp} from './NativeApp';
import {wantsPhoneLayout} from './layout';

export function phoneLayoutActive(){
 const search=typeof location==='undefined'?'':location.search;
 return wantsPhoneLayout(Capacitor.isNativePlatform(),search);
}

export function RuntimeApp(){
 if(phoneLayoutActive())return <NativeApp/>;
 return <App/>;
}
