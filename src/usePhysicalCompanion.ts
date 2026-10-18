import {useCallback,useEffect,useRef,useState} from 'react';
import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {COMMAND} from './bleProtocol';
import {createPhysicalLessonEvents} from './physicalLessonEvents';
import type {Action,Progress} from './engine';
import {createNativeBleDriver} from './bleDriver';
import {createBleTransport,initialBleState,type BleTransport} from './bleTransport';

export function usePhysicalCompanion(){
 const [state,setState]=useState(initialBleState);
 const transport=useRef<BleTransport|null>(null);
 const lessonEvents=useRef<ReturnType<typeof createPhysicalLessonEvents>|null>(null);
 useEffect(()=>{
  const actor=createBleTransport(createNativeBleDriver(),setState,{supported:()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='ios'&&Capacitor.isPluginAvailable('BluetoothLe')});
  transport.current=actor;
  lessonEvents.current=createPhysicalLessonEvents(command=>actor.request(command));
  let alive=true,nativeActive=true,version=0;
  const visibility=()=>actor.setActive(nativeActive&&!document.hidden);
  const pagehide=()=>actor.setActive(false);
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
   document.removeEventListener('visibilitychange',visibility);
   window.removeEventListener('pagehide',pagehide);
   window.removeEventListener('pageshow',visibility);
   void listener?.then(handle=>handle.remove()).catch(()=>{});
  };
 },[]);
 const scan=useCallback(()=>{void transport.current?.scan();},[]);
 const connect=useCallback((id:string)=>{void transport.current?.connect(id);},[]);
 const testHappy=useCallback(()=>{void transport.current?.testHappy();},[]);
 const disconnect=useCallback(()=>transport.current?.disconnect(),[]);
 const navigate=useCallback((screen:'home'|'profile'|'lesson'|'physical')=>transport.current?.navigate(screen),[]);
 const onListen=useCallback(()=>{transport.current?.request(COMMAND.LISTENING);},[]);
 const onListenEnd=useCallback(()=>{transport.current?.request(COMMAND.THINKING);},[]);
 const onHint=useCallback(()=>{transport.current?.request(COMMAND.HINT);},[]);
 const enterLesson=useCallback((hasActiveQuestion:boolean)=>transport.current?.enterLesson(hasActiveQuestion),[]);
 const onTransition=useCallback((previous:Progress,next:Progress,action:Action,lessonId='cafe')=>lessonEvents.current?.(previous,next,action,lessonId),[]);
 return {state,scan,connect,testHappy,disconnect,navigate,enterLesson,onListen,onListenEnd,onHint,onTransition};
}
export type PhysicalCompanionController=ReturnType<typeof usePhysicalCompanion>;
