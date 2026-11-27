import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';

// Extra time from iOS after leaving the app (ios/App/App/PrivetBackgroundPlugin.swift), so a print that's
// still being sent can finish while you're away. iOS grants about 30 seconds. In the browser preview, or if
// iOS refuses, `active` stays false and printing behaves as before: it waits for the app to come back.
type Plugin={
 begin():Promise<{granted:boolean}>;
 end():Promise<void>;
 addListener(event:'expired',listener:()=>void):Promise<PluginListenerHandle>;
};
const plugin=registerPlugin<Plugin>('PrivetBackground');
const available=()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('PrivetBackground');

export function createBackgroundTime(onExpired:()=>void){
 let active=false,listener:Promise<PluginListenerHandle>|undefined;
 return {
  // Whether the app may keep working in the background right now.
  get active(){return active;},
  async begin(){
   if(!available()||active)return;
   listener??=plugin.addListener('expired',()=>{active=false;onExpired();});
   try{active=(await plugin.begin()).granted;}catch{active=false;}
  },
  async end(){
   if(!available()||!active)return;
   active=false;
   try{await plugin.end();}catch{/* iOS ends it by itself when the time is up. */}
  },
  dispose(){active=false;void listener?.then(handle=>handle.remove());if(available())void plugin.end().catch(()=>{});},
 };
}
