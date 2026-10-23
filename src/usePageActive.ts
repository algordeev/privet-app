import {useEffect,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';

export function usePageActive(){
 const [active,setActive]=useState(()=>typeof document==='undefined'||!document.hidden);
 useEffect(()=>{
  let alive=true,nativeActive=true,version=0;
  const sync=()=>setActive(nativeActive&&!document.hidden);
  const onHide=()=>setActive(false);
  sync();document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',onHide);window.addEventListener('pageshow',sync);
  const listener=Capacitor.isNativePlatform()?App.addListener('appStateChange',({isActive})=>{if(alive){version++;nativeActive=isActive;sync();}}):undefined;
  const current=version;
  void listener?.then(async()=>{if(!alive)return;try{const status=await App.getState();if(alive&&version===current){nativeActive=status.isActive;sync();}}catch{/* App lifecycle is optional in the browser shell. */}}).catch(()=>{});
  return()=>{alive=false;document.removeEventListener('visibilitychange',sync);window.removeEventListener('pagehide',onHide);window.removeEventListener('pageshow',sync);void listener?.then(handle=>handle.remove()).catch(()=>{});};
 },[]);
 return active;
}
