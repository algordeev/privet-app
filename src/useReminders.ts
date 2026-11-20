import {useCallback,useEffect,useState} from 'react';
import {appStorage} from './previewStorage';
import {isClockTime,planReminders,REMINDERS_KEY,restoreReminders,type ReminderSettings} from './reminders';
import {applyReminderPlan,askReminderPermission,reminderPermission,remindersSupported,type ReminderPermission} from './reminderScheduler';
import {useForeground} from './useForeground';

function readSaved():ReminderSettings{
 try{return restoreReminders(appStorage.getItem(REMINDERS_KEY));}catch{return restoreReminders(null);}
}
function writeSaved(value:ReminderSettings){
 try{appStorage.setItem(REMINDERS_KEY,JSON.stringify(value));}catch{/* Not saved; the choice lasts for this session. */}
}

// Reminder settings plus the iOS permission, and a fresh plan whenever practice, settings or the app's return
// to the foreground could change it. practisedToday and streak come from the statistics.
export function useReminders({practisedToday,streak}:{practisedToday:boolean;streak:number}){
 const [settings,setSettings]=useState(readSaved);
 const [permission,setPermission]=useState<ReminderPermission>(remindersSupported()?'prompt':'unsupported');
 const onScreen=useForeground();
 const keep=useCallback((change:Partial<ReminderSettings>)=>setSettings(current=>{const next={...current,...change};writeSaved(next);return next;}),[]);

 // iOS permission can change in the Settings app while Privet is away, so it is read again on every return.
 useEffect(()=>{if(onScreen)reminderPermission().then(setPermission);},[onScreen]);

 useEffect(()=>{
  if(!onScreen||permission==='unsupported')return;
  const active=permission==='granted'?settings:{...settings,enabled:false};
  applyReminderPlan(planReminders(active,{now:new Date(),practisedToday,streak}));
 },[onScreen,permission,settings,practisedToday,streak]);

 // Turning reminders on asks iOS first; they only switch on if iOS allows them.
 const enable=useCallback(async()=>{
  const answer=await askReminderPermission();
  setPermission(answer);
  keep({enabled:answer==='granted',offered:true});
  return answer;
 },[keep]);
 const disable=useCallback(()=>keep({enabled:false}),[keep]);
 const setTime=useCallback((time:string)=>{if(isClockTime(time))keep({time});},[keep]);
 const setLastCall=useCallback((lastCall:boolean)=>keep({lastCall}),[keep]);
 const markOffered=useCallback(()=>keep({offered:true}),[keep]);
 return {settings,permission,enable,disable,setTime,setLastCall,markOffered};
}
export type RemindersController=ReturnType<typeof useReminders>;
