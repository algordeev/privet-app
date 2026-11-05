import {useCallback,useEffect,useRef,useSyncExternalStore} from 'react';
import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {companionDisplay} from './companionDisplay';
import type {LessonDefinition} from './curriculum/types';
import type {LearningCard} from './learningProtocol';
import {COMMAND,DEFAULT_VOLUME_LEVEL,VOLUME_LEVELS} from './bleProtocol';
import {createPhysicalLessonEvents} from './physicalLessonEvents';
import type {Action,Progress} from './engine';
import {createNativeBleDriver} from './bleDriver';
import {createBleTransport,initialBleState,type BleState,type BleTransport,type PhysicalDevice} from './bleTransport';
import {appStorage} from './previewStorage';
import {PRODUCT} from './config';
import {syncPocket,type PocketStore,type PocketSummary} from './pocketSync';

// Set once a connection has succeeded, so iOS has already granted Bluetooth: only then may the app
// look for a companion by itself ("companion found" on home, and reconnecting to the remembered one).
export const BLE_USED_KEY=`${PRODUCT.storageKey}-ble-used`;
// The last companion connected (its iOS device ID and name), reconnected to by itself whenever the app
// is open and it is nearby. Disconnect turns that off (AUTO_OFF_KEY) until the next connection by hand.
export const COMPANION_KEY=`${PRODUCT.storageKey}-companion-device`;
export const AUTO_OFF_KEY=`${PRODUCT.storageKey}-companion-auto-off`;
// The app keeps looking while it is open: a new quiet scan starts within this delay after one ends, so
// a companion switched on (or woken) later is found within seconds. Two minutes after the remembered
// companion went away, and with home's discovery not running, it looks only every RECONNECT_SLOW_MS.
const DISCOVERY_RETRY_MS=4000,RECONNECT_FAST_FOR_MS=120000,RECONNECT_SLOW_MS=20000;
// After reconnecting during a lesson, the question is sent again once the wake-up face has played.
const RESEND_AFTER_CONNECTED_MS=2500;
function bluetoothUsed(){try{return appStorage.getItem(BLE_USED_KEY)==='1';}catch{return false;}}
export function rememberedCompanion():PhysicalDevice|undefined{
 try{
  const saved=JSON.parse(appStorage.getItem(COMPANION_KEY)??'null') as unknown;
  if(!saved||typeof saved!=='object')return undefined;
  const {deviceId,name}=saved as Record<string,unknown>;
  return typeof deviceId==='string'&&deviceId?{deviceId,name:typeof name==='string'?name:undefined}:undefined;
 }catch{return undefined;}
}
// The companion the app reconnects to by itself, if any.
export function autoReconnectTarget():PhysicalDevice|undefined{
 if(!bluetoothUsed())return undefined;
 try{if(appStorage.getItem(AUTO_OFF_KEY)==='1')return undefined;}catch{return undefined;}
 return rememberedCompanion();
}
function remember(device:PhysicalDevice,byHand:boolean){
 try{
  appStorage.setItem(COMPANION_KEY,JSON.stringify({deviceId:device.deviceId,name:device.name}));
  if(byHand)appStorage.removeItem(AUTO_OFF_KEY);
 }catch{/* It just isn't reconnected to by itself. */}
}
// The robot's sound level (0 Off … 4 Max). Saved here and sent on every connection; the robot also keeps it.
export const VOLUME_KEY=`${PRODUCT.storageKey}-companion-volume`;
function savedVolume(){try{const level=Number(appStorage.getItem(VOLUME_KEY)??DEFAULT_VOLUME_LEVEL);return Number.isInteger(level)&&level>=0&&level<VOLUME_LEVELS.length?level:DEFAULT_VOLUME_LEVEL;}catch{return DEFAULT_VOLUME_LEVEL;}}

export function usePhysicalCompanion(){
 // BLE state (connection phase, busy/pending flags, card-transfer progress)
 // changes at high frequency: ~4 times per reaction, ~50 times per learning
 // card transfer. It lives in a plain external store, not useState, so this
 // hook's call site (the native app root) never re-renders just because a
 // write/ACK/card frame settled. Only components that actually display BLE
 // status subscribe to it, via useBleState() below.
 const store=useRef<{state:BleState;listeners:Set<()=>void>}|null>(null);
 if(!store.current)store.current={state:initialBleState(),listeners:new Set()};
 const getState=useCallback(()=>store.current!.state,[]);
 const subscribe=useCallback((listener:()=>void)=>{
  store.current!.listeners.add(listener);
  return ()=>{store.current!.listeners.delete(listener);};
 },[]);
 const setState=useCallback((next:BleState)=>{
  const previous=store.current!.state;
  const linked=next.phase==='connected'&&next.ready&&!!next.device;
  const wasLinked=previous.phase==='connected'&&previous.ready;
  if(linked&&!bluetoothUsed()){try{appStorage.setItem(BLE_USED_KEY,'1');}catch{/* Discovery just stays off. */}}
  if(linked&&!wasLinked){remember(next.device!,!next.auto);connected.current?.();}
  // Lost (not only by Disconnect): look quickly for a while.
  if(wasLinked&&!linked&&next.phase!=='suspended'&&next.phase!=='reconciling')reconnect.current.lostAt=Date.now();
  store.current!.state=next;
  if(linked&&next.pocket)syncPocketOnce();
  for(const listener of store.current!.listeners)listener();
 },[]);
 const transport=useRef<BleTransport|null>(null);
 const context=useRef<{definition:LessonDefinition;progress:Progress}|null>(null);
 const revision=useRef(0);
 // The card that describes the current state; restored after a pronunciation.
 const contextCard=useRef<LearningCard|undefined>(undefined);
 const lessonEvents=useRef<ReturnType<typeof createPhysicalLessonEvents>|null>(null);
 const restoreRef=useRef<()=>void>(()=>{});
 // Home's quiet look for a nearby, powered-on companion, repeated while home is open. "Not now" (or an
 // explicit disconnect) ends it for this app session. discover() returns the function that stops it.
 const discovery=useRef<{dismissed:boolean;wanted:boolean}>({dismissed:false,wanted:false});
 // One loop, on every screen while the app is open: it looks for the remembered companion (and, on home,
 // for any companion to offer). Each round is a no-op while a scan, connection or cleanup is under way.
 const reconnect=useRef<{timer?:ReturnType<typeof setTimeout>;lostAt:number;running:boolean}>({lostAt:Date.now(),running:false});
 const connected=useRef<(()=>void)|null>(null);
 // Pocket deck (keychain Mini, capability bit 32): one sync per connection, at most two tries, in the
 // transport's background slot. The app supplies the review side with setPocket().
 const pocket=useRef<{store?:PocketStore;onSynced?:(summary:PocketSummary)=>void;done:number;running:boolean;tries:Map<number,number>}>({done:-1,running:false,tries:new Map()});
 const syncPocketOnce=useCallback(()=>{
  const p=pocket.current,t=transport.current,s=store.current!.state;
  if(!p.store||!t||p.running||!(s.phase==='connected'&&s.ready&&s.pocket))return;
  const token=t.connectionToken(),tries=p.tries.get(token)??0;
  if(p.done===token||tries>=2)return;
  p.tries.set(token,tries+1);p.running=true;
  const run=p.store;
  setTimeout(()=>{void syncPocket(t,run).then(summary=>{p.done=token;if(transport.current===t)p.onSynced?.(summary);}).catch(()=>{/* Tried again on the next ready state, or next connection. */}).finally(()=>{p.running=false;});},0);
 },[]);
 const setPocket=useCallback((pocketStore:PocketStore|undefined,onSynced?:(summary:PocketSummary)=>void)=>{pocket.current.store=pocketStore;pocket.current.onSynced=onSynced;syncPocketOnce();},[syncPocketOnce]);
 const lookAgain=useCallback(()=>{
  const r=reconnect.current,d=discovery.current;clearTimeout(r.timer);r.timer=undefined;
  if(!r.running)return;
  const target=autoReconnectTarget()?.deviceId,offer=d.wanted&&!d.dismissed&&bluetoothUsed();
  if(target||offer)void transport.current?.discover(target,offer);
  const fast=offer||Date.now()-r.lostAt<RECONNECT_FAST_FOR_MS;
  r.timer=setTimeout(lookAgain,fast?DISCOVERY_RETRY_MS:RECONNECT_SLOW_MS);
 },[]);
 const discover=useCallback(()=>{
  const d=discovery.current;d.wanted=true;lookAgain();
  return ()=>{d.wanted=false;};
 },[lookAgain]);
 useEffect(()=>{
  const actor=createBleTransport(createNativeBleDriver(),setState,{supported:()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='ios'&&Capacitor.isPluginAvailable('BluetoothLe'),volume:savedVolume});
  transport.current=actor;
  // Home mounts before this effect creates the transport: the loop starts here, with any discovery it asked for.
  reconnect.current.running=true;reconnect.current.lostAt=Date.now();lookAgain();
  // Reconnected in the middle of a lesson: once the wake-up face has played, show the question (or the
  // answered state) again, unless something newer was already sent.
  connected.current=()=>{
   const token=actor.connectionToken(),seen=revision.current;
   setTimeout(()=>{
    if(transport.current!==actor||actor.connectionToken()!==token||revision.current!==seen||!context.current)return;
    restoreRef.current();
   },RESEND_AFTER_CONNECTED_MS);
  };
  lessonEvents.current=createPhysicalLessonEvents((command,next,id)=>{
   const current=context.current;if(!current||current.definition.id!==id)return;
   revision.current++;current.progress=next;
   const card=companionDisplay(current.definition,next);contextCard.current=card;
   actor.request(command,card,command===COMMAND.ON_FIRE?Math.min(next.combo,255):0);
  });
  let alive=true,nativeActive=true,version=0;
  const visibility=()=>{
   revision.current++;const active=nativeActive&&!document.hidden;actor.setActive(active);
   // Back in the app: look quickly again, starting now.
   if(active){reconnect.current.lostAt=Date.now();lookAgain();}
  };
  const pagehide=()=>{revision.current++;actor.setActive(false);};
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',pagehide);
  window.addEventListener('pageshow',visibility);
  visibility();
  const listener=Capacitor.isNativePlatform()?App.addListener('appStateChange',({isActive})=>{
   if(alive){version++;nativeActive=isActive;visibility();}
  }):undefined;
  const initialVersion=version;
  void listener?.then(async()=>{
   const {isActive}=await App.getState();
   if(alive&&version===initialVersion){nativeActive=isActive;visibility();}
  }).catch(()=>{/* Web/shell previews use document visibility. */});
  return ()=>{
   reconnect.current.running=false;clearTimeout(reconnect.current.timer);connected.current=null;
   alive=false;transport.current=null;lessonEvents.current=null;actor.dispose();
   // A remount (StrictMode) gets a fresh transport: drop this one's last state (e.g. a quiet scan).
   setState(initialBleState());
   document.removeEventListener('visibilitychange',visibility);
   window.removeEventListener('pagehide',pagehide);
   window.removeEventListener('pageshow',visibility);
   void listener?.then(handle=>handle.remove()).catch(()=>{});
  };
 },[lookAgain]);
 const scan=useCallback(()=>{void transport.current?.scan();},[]);
 const dismissDiscovery=useCallback(()=>{discovery.current.dismissed=true;transport.current?.cancelScan();},[]);
 const holdScan=useCallback(()=>{transport.current?.holdScan();},[]);
 const cancelScan=useCallback(()=>{transport.current?.cancelScan();},[]);
 const connect=useCallback((id:string)=>{void transport.current?.connect(id);},[]);
 const testHappy=useCallback(()=>{void transport.current?.testHappy();},[]);
 const setVolume=useCallback((level:number)=>{try{appStorage.setItem(VOLUME_KEY,String(level));}catch{/* Still sent for this connection. */}transport.current?.setVolume(level);},[]);
 // Disconnect by hand: the app stops reconnecting by itself until the next connection by hand.
 const disconnect=useCallback(()=>{
  revision.current++;discovery.current.dismissed=true;
  try{appStorage.setItem(AUTO_OFF_KEY,'1');}catch{/* Reconnecting stays on. */}
  transport.current?.disconnect();
 },[]);
 // Closing the card mid-connection: that attempt only, reconnecting to the remembered companion stays on.
 const cancelConnection=useCallback(()=>{revision.current++;transport.current?.disconnect();},[]);
 const navigate=useCallback((screen:'home'|'profile'|'lesson'|'physical',homeCard?:LearningCard)=>{revision.current++;context.current=null;contextCard.current=undefined;transport.current?.navigate(screen,homeCard);},[]);
 const greet=useCallback(()=>{transport.current?.request(COMMAND.HAPPY);},[]);
 // Puts back what the robot showed before a pronunciation: THINKING while the
 // question is open, otherwise IDLE, with the last context card (the question,
 // a revealed word, match progress or the graded answer). The firmware draws a
 // card that returns to the same question at once, so nothing flashes.
 const restore=useCallback(()=>{
  revision.current++;const c=context.current;
  const open=!!c&&!c.progress.feedback&&!c.progress.complete&&!c.progress.failed;
  transport.current?.request(open?COMMAND.THINKING:COMMAND.IDLE,c?contextCard.current:undefined);
 },[]);
 restoreRef.current=restore;
 // Pronunciation: the listening face, and nothing else, for exactly as long as
 // the audio plays (like the Cyrillic guide). The returned function runs when
 // speech actually finishes; anything newer (an answer, a hint, a pair, leaving)
 // bumps the revision and makes it a no-op.
 const onListen=useCallback(()=>{
  const token=++revision.current,connection=transport.current?.connectionToken();
  transport.current?.request(COMMAND.LISTENING);
  return ()=>{if(revision.current!==token||transport.current?.connectionToken()!==connection)return;restore();};
 },[restore]);
 const onListenEnd=restore;
 const onQuickStartListenEnd=useCallback(()=>{revision.current++;context.current=null;contextCard.current=undefined;transport.current?.request(COMMAND.IDLE);},[]);
 // A hint card is a short cue, not context: after it the question's card returns.
 const onHint=useCallback(()=>{revision.current++;const c=context.current;transport.current?.request(COMMAND.HINT,c?companionDisplay(c.definition,c.progress,{kind:'hint'}):undefined);},[]);
 // Match pairs: progress on the OLED with a small nod per correct pair (firmware without NOD keeps a
 // neutral face; the last pair reacts through the normal check transition); a wrong pair encourages,
 // at most every 2s so fast taps don't flicker.
 const lastSlip=useRef(-Infinity);
 const onMatchPair=useCallback((correct:boolean,matched:number)=>{
  const c=context.current;if(!c)return;const total=c.definition.exercises[c.progress.index]?.pairs?.length??0;
  if(correct){if(matched>=total)return;revision.current++;contextCard.current=companionDisplay(c.definition,c.progress,{kind:'match',matched});transport.current?.request(COMMAND.NOD,contextCard.current);return;}
  if(Date.now()-lastSlip.current<2000)return;lastSlip.current=Date.now();revision.current++;
  contextCard.current=companionDisplay(c.definition,c.progress,{kind:'match',matched});
  transport.current?.request(COMMAND.ENCOURAGE,contextCard.current);
 },[]);
 const onReveal=useCallback((word:string)=>{revision.current++;const c=context.current;if(!c)return;contextCard.current=companionDisplay(c.definition,c.progress,{kind:'reveal',word});transport.current?.request(COMMAND.THINKING,contextCard.current);},[]);
 const enterLesson=useCallback((hasActiveQuestion:boolean,definition?:LessonDefinition,progress?:Progress)=>{
  revision.current++;context.current=definition&&progress?{definition,progress}:null;
  contextCard.current=definition&&progress&&hasActiveQuestion?companionDisplay(definition,progress):undefined;
  return transport.current?.enterLesson(hasActiveQuestion,contextCard.current);
 },[]);
 const onTransition=useCallback((previous:Progress,next:Progress,action:Action,lessonId='cafe')=>{lessonEvents.current?.(previous,next,action,lessonId);},[]);
 return {getState,subscribe,scan,discover,dismissDiscovery,holdScan,cancelScan,connect,testHappy,volume:savedVolume,setVolume,disconnect,cancelConnection,remembered:autoReconnectTarget,setPocket,navigate,enterLesson,greet,onListen,onListenEnd,onQuickStartListenEnd,onHint,onReveal,onMatchPair,onTransition};
}
export type PhysicalCompanionController=ReturnType<typeof usePhysicalCompanion>;
// Fine-grained subscription: only the component calling this (e.g. the
// connection chip or settings screen) re-renders when BLE state changes.
// Controllers/screens that only call actions (scan/connect/request/...)
// never need this and stay untouched by BLE activity.
export function useBleState(controller:PhysicalCompanionController):BleState{
 // A third (server-snapshot) argument is required wherever this may be
 // server-rendered (e.g. the static-markup shell check). The BLE-connecting
 // effect never runs during SSR, so the store never diverges from its
 // initial snapshot there; reusing the same getter is correct, not a stub.
 return useSyncExternalStore(controller.subscribe,controller.getState,controller.getState);
}
