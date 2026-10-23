import {Capacitor} from '@capacitor/core';
import {PRODUCT} from './config.ts';

export function isOnboardingPreview(search=typeof location==='undefined'?'':location.search,native=Capacitor.isNativePlatform()){
 const query=new URLSearchParams(search);
 return !native&&query.get('native')==='1'&&query.get('onboarding')==='1';
}
export function previewStorageKey(key:string,preview=isOnboardingPreview()){
 return preview?`${PRODUCT.storageKey}-onboarding-preview:${key}`:key;
}
// Scope the complete demo (lessons, preferences, rewards and Plus), not just its
// welcome flag. Native and ordinary browser sessions retain their existing keys.
export const appStorage={
 getItem:(key:string)=>localStorage.getItem(previewStorageKey(key)),
 setItem:(key:string,value:string)=>localStorage.setItem(previewStorageKey(key),value),
 removeItem:(key:string)=>localStorage.removeItem(previewStorageKey(key)),
};
