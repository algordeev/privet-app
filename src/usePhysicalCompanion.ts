import {useCallback,useEffect,useRef,useSyncExternalStore} from 'react';
import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {companionDisplay} from './companionDisplay';
import type {LessonDefinition} from './curriculum/types';
import type {LearningCard} from './learningProtocol';
import {COMMAND} from './bleProtocol';
import {createPhysicalLessonEvents} from './physicalLessonEvents';
import type {Action,Progress} from './engine';
import {createNativeBleDriver} from './bleDriver';
import {createBleTransport,initialBleState,type BleState,type BleTransport} from './bleTransport';
import {appStorage} from './previewStorage';
import {PRODUCT} from './config';

// Set once a connection has succeeded, so iOS has already granted Bluetooth: only then may the app
// look for the companion by itself ("companion found"). Never a device ID; no automatic connection.
export const BLE_USED_KEY=`${PRODUCT.storageKey}-ble-used`;
// While home is open the app keeps looking: each quiet scan runs its normal window, and a new one
// starts within this delay after it ends, so a companion switched on later is still found.
const DISCOVERY_RETRY_MS=4000;
function bluetoothUsed(){try{return appStorage.getItem(BLE_USED_KEY)==='1';}catch{return false;}}

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
  if(next.phase==='connected'&&next.ready&&!bluetoothUsed()){try{appStorage.setItem(BLE_USED_KEY,'1');}catch{/* Discovery just stays off. */}}
  store.current!.state=next;
  for(const listener of store.current!.listeners)listener();
 },[]);
 const transport=useRef<BleTransport|null>(null);
 const context=useRef<{definition:LessonDefinition;progress:Progress}|null>(null);
 const revision=useRef(0);
 // The card that describes the current state; restored after a pronunciation.
 const contextCard=useRef<LearningCard|undefined>(undefined);
 const lessonEvents=useRef<ReturnType<typeof createPhysicalLessonEvents>|null>(null);
 // Home's quiet look for a nearby, powered-on companion, repeated while home is open. "Not now" (or an
 // explicit disconnect) ends it for this app session. discover() returns the function that stops it.
 const discovery=useRef<{dismissed:boolean;wanted:boolean;timer?:ReturnType<typeof setTimeout>}>({dismissed:false,wanted:false});
 const lookAgain=useCallback(()=>{
  const d=discovery.current;clearTimeout(d.timer);d.timer=undefined;
  if(!d.wanted||d.dismissed||!bluetoothUsed())return;
  // A no-op while a scan, connection or cleanup is under way; the next round tries again.
  void transport.current?.discover();
  d.timer=setTimeout(lookAgain,DISCOVERY_RETRY_MS);
 },[]);
 const discover=useCallback(()=>{
  const d=discovery.current;d.wanted=true;lookAgain();
  return ()=>{d.wanted=false;clearTimeout(d.timer);d.timer=undefined;};
 },[lookAgain]);
 useEffect(()=>{
  const actor=createBleTransport(createNativeBleDriver(),setState,{supported:()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='ios'&&Capacitor.isPluginAvailable('BluetoothLe')});
  transport.current=actor;
  // Home mounts before this effect creates the transport: start a discovery it asked for.
  if(discovery.current.wanted)lookAgain();
  lessonEvents.current=createPhysicalLessonEvents((command,next,id)=>{
   const current=context.current;if(!current||current.definition.id!==id)return;
   revision.current++;current.progress=next;
   const card=companionDisplay(current.definition,next);contextCard.current=card;
   actor.request(command,card,command===COMMAND.ON_FIRE?Math.min(next.combo,255):0);
  });
  let alive=true,nativeActive=true,version=0;
  const visibility=()=>{revision.current++;actor.setActive(nativeActive&&!document.hidden);};
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
 const disconnect=useCallback(()=>{revision.current++;discovery.current.dismissed=true;transport.current?.disconnect();},[]);
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
 return {getState,subscribe,scan,discover,dismissDiscovery,holdScan,cancelScan,connect,testHappy,disconnect,navigate,enterLesson,greet,onListen,onListenEnd,onQuickStartListenEnd,onHint,onReveal,onMatchPair,onTransition};
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
