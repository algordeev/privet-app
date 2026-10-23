import test from 'node:test';
import assert from 'node:assert/strict';
import {isOnboardingPreview,previewStorageKey,appStorage} from './previewStorage.ts';

test('onboarding URL is explicit and never changes native storage',()=>{
 assert.equal(isOnboardingPreview('?native=1&onboarding=1',false),true);
 for(const search of ['', '?native=1','?native=0&onboarding=1','?onboarding=1'])assert.equal(isOnboardingPreview(search,false),false);
 assert.equal(isOnboardingPreview('?native=1&onboarding=1',true),false);
});
test('preview keys isolate every learner store without migrating existing data',()=>{
 for(const key of ['privet-demo-v1','privet-demo-v1-first-run','privet-demo-v1-native-session','privet-demo-v1-native-stats','privet-demo-v1-subscription','privet-demo-v1-cyrillic']){
  assert.equal(previewStorageKey(key,false),key);assert.notEqual(previewStorageKey(key,true),key);
 }
});
test('preview writes and resets preserve ordinary browser progress',()=>{
 const data=new Map([['privet-demo-v1-native-stats','existing rewards']]);
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),loc=Object.getOwnPropertyDescriptor(globalThis,'location');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)}});
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?native=1&onboarding=1'}});
 try{const key='privet-demo-v1-native-stats';assert.equal(appStorage.getItem(key),null);appStorage.setItem(key,'preview rewards');assert.equal(appStorage.getItem(key),'preview rewards');assert.equal(data.get(key),'existing rewards');appStorage.removeItem(key);assert.equal(data.get(key),'existing rewards');}
 finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');if(loc)Object.defineProperty(globalThis,'location',loc);else Reflect.deleteProperty(globalThis,'location');}
});
