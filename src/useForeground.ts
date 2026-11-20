import {useSyncExternalStore} from 'react';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {createForegroundStore,type AppLifecycle,type PageSignals} from './foreground';

const page:PageSignals|null=typeof document==='undefined'?null:{
 hidden:()=>document.hidden,
 watch({change,leave}){
  document.addEventListener('visibilitychange',change);
  window.addEventListener('pageshow',change);
  window.addEventListener('pagehide',leave);
  return ()=>{
   document.removeEventListener('visibilitychange',change);
   window.removeEventListener('pageshow',change);
   window.removeEventListener('pagehide',leave);
  };
 },
};

// WKWebView page visibility misses some iOS app lifecycle changes, so the native app also listens to App.
const appLifecycle:AppLifecycle={
 async listen(onChange){
  const handle=await App.addListener('appStateChange',({isActive})=>onChange(isActive));
  return ()=>{handle.remove().catch(()=>{});};
 },
 async current(){return (await App.getState()).isActive;},
};

const foreground=createForegroundStore(page,()=>Capacitor.isNativePlatform()?appLifecycle:null);
const onServer=()=>true;

// True while the app is on screen; animations pause when it is false.
export function useForeground(){return useSyncExternalStore(foreground.subscribe,foreground.get,onServer);}
