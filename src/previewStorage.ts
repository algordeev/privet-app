import {Capacitor} from '@capacitor/core';
import {Preferences} from '@capacitor/preferences';
import {PRODUCT} from './config.ts';

export function isOnboardingPreview(search=typeof location==='undefined'?'':location.search,native=Capacitor.isNativePlatform()){
 const query=new URLSearchParams(search);
 return !native&&query.get('native')==='1'&&query.get('onboarding')==='1';
}
export function previewStorageKey(key:string,preview=isOnboardingPreview()){
 return preview?`${PRODUCT.storageKey}-onboarding-preview:${key}`:key;
}
// WKWebView localStorage can be evicted under iOS storage pressure, with no
// warning to the app. Every hook still reads/writes it synchronously and
// unchanged (its own useState initializer needs a value immediately, and
// @capacitor/preferences has no synchronous read), but on native platforms
// every write/removal is also mirrored, fire-and-forget, to Preferences
// (native UserDefaults), which iOS does not evict the same way.
const native=Capacitor.isNativePlatform();
// Scope the complete demo (lessons, preferences, rewards and Plus), not just its
// welcome flag. Native and ordinary browser sessions retain their existing keys.
export const appStorage={
 getItem:(key:string)=>localStorage.getItem(previewStorageKey(key)),
 setItem:(key:string,value:string)=>{
  const resolved=previewStorageKey(key);
  localStorage.setItem(resolved,value);
  if(native)void Preferences.set({key:resolved,value}).catch(()=>{/* Mirror is a durability backstop, never load-bearing. */});
 },
 removeItem:(key:string)=>{
  const resolved=previewStorageKey(key);
  localStorage.removeItem(resolved);
  if(native)void Preferences.remove({key:resolved}).catch(()=>{/* Mirror is a durability backstop, never load-bearing. */});
 },
};
let restored=!native;
// Runs once, before the app renders (see main.tsx), so every hook's
// synchronous localStorage read already sees any mirrored value. Copies
// back only keys localStorage is missing; an active key already present
// (the common case) is never touched or overwritten by the mirror.
export async function restoreStorageMirror(){
 if(restored)return;
 restored=true;
 try{
  const {keys}=await Preferences.keys();
  await Promise.all(keys.map(async key=>{
   if(localStorage.getItem(key)!==null)return;
   const {value}=await Preferences.get({key});
   if(value!==null)localStorage.setItem(key,value);
  }));
 }catch{/* Continue with whatever localStorage already has. */}
}
