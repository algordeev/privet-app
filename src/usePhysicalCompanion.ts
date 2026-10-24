import {useCallback,useEffect,useRef,useState} from 'react';
import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {companionDisplay} from './companionDisplay';
import type {LessonDefinition} from './curriculum/types';
import {COMMAND} from './bleProtocol';
import {createPhysicalLessonEvents} from './physicalLessonEvents';
import type {Action,Progress} from './engine';
import {createNativeBleDriver} from './bleDriver';
import {createBleTransport,initialBleState,type BleTransport} from './bleTransport';

export function usePhysicalCompanion(){
 const [state,setState]=useState(initialBleState);
 const transport=useRef<BleTransport|null>(null);
 const context=useRef<{definition:LessonDefinition;progress:Progress}|null>(null);
 const revision=useRef(0);
 const lessonEvents=useRef<ReturnType<typeof createPhysicalLessonEvents>|null>(null);
 useEffect(()=>{
  const actor=createBleTransport(createNativeBleDriver(),setState,{supported:()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='ios'&&Capacitor.isPluginAvailable('BluetoothLe')});
  transport.current=actor;
  lessonEvents.current=createPhysicalLessonEvents((command,next,id)=>{
   const current=context.current;if(!current||current.definition.id!==id)return;
   revision.current++;current.progress=next;
   actor.request(command,companionDisplay(current.definition,next));
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
   document.removeEventListener('visibilitychange',visibility);
   window.removeEventListener('pagehide',pagehide);
   window.removeEventListener('pageshow',visibility);
   void listener?.then(handle=>handle.remove()).catch(()=>{});
  };
 },[]);
 const scan=useCallback(()=>{void transport.current?.scan();},[]);
 const connect=useCallback((id:string)=>{void transport.current?.connect(id);},[]);
 const testHappy=useCallback(()=>{void transport.current?.testHappy();},[]);
 const disconnect=useCallback(()=>{revision.current++;transport.current?.disconnect();},[]);
 const navigate=useCallback((screen:'home'|'profile'|'lesson'|'physical')=>{revision.current++;context.current=null;transport.current?.navigate(screen);},[]);
 const greet=useCallback(()=>{transport.current?.request(COMMAND.HAPPY);},[]);
 const onListen=useCallback((text?:string)=>{
  const token=++revision.current,current=context.current,connection=transport.current?.connectionToken();
  transport.current?.request(COMMAND.LISTENING,current&&text?companionDisplay(current.definition,current.progress,{kind:'listen',text}):undefined);
  return ()=>{if(revision.current!==token||transport.current?.connectionToken()!==connection)return;revision.current++;const c=context.current;transport.current?.request(c?COMMAND.THINKING:COMMAND.IDLE,c?companionDisplay(c.definition,c.progress):undefined);};
 },[]);
 const onListenEnd=useCallback(()=>{const c=context.current;transport.current?.request(COMMAND.THINKING,c?companionDisplay(c.definition,c.progress):undefined);},[]);
 const onQuickStartListenEnd=useCallback(()=>{revision.current++;context.current=null;transport.current?.request(COMMAND.IDLE);},[]);
 const onHint=useCallback(()=>{revision.current++;const c=context.current;transport.current?.request(COMMAND.HINT,c?companionDisplay(c.definition,c.progress,{kind:'hint'}):undefined);},[]);
 const onReveal=useCallback((word:string)=>{revision.current++;const c=context.current;if(c)transport.current?.request(COMMAND.THINKING,companionDisplay(c.definition,c.progress,{kind:'reveal',word}));},[]);
 const enterLesson=useCallback((hasActiveQuestion:boolean,definition?:LessonDefinition,progress?:Progress)=>{revision.current++;context.current=definition&&progress?{definition,progress}:null;return transport.current?.enterLesson(hasActiveQuestion,definition&&progress&&hasActiveQuestion?companionDisplay(definition,progress):undefined);},[]);
 const onTransition=useCallback((previous:Progress,next:Progress,action:Action,lessonId='cafe')=>{lessonEvents.current?.(previous,next,action,lessonId);},[]);
 return {state,scan,connect,testHappy,disconnect,navigate,enterLesson,greet,onListen,onListenEnd,onQuickStartListenEnd,onHint,onReveal,onTransition};
}
export type PhysicalCompanionController=ReturnType<typeof usePhysicalCompanion>;
