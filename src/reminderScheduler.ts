import {Capacitor} from '@capacitor/core';
import {LocalNotifications} from '@capacitor/local-notifications';
import type {PlannedReminder} from './reminders';

// The only place that talks to iOS notifications. Where the plugin is missing (the website, the browser checks)
// everything is a quiet no-op, and any plugin error leaves the app working without reminders.

export type ReminderPermission='granted'|'denied'|'prompt'|'unsupported';
export const remindersSupported=()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('LocalNotifications');

const asPermission=(display:string):ReminderPermission=>display==='granted'?'granted':display==='denied'?'denied':'prompt';

export async function reminderPermission():Promise<ReminderPermission>{
 if(!remindersSupported())return 'unsupported';
 try{return asPermission((await LocalNotifications.checkPermissions()).display);}catch{return 'unsupported';}
}

// Shows the iOS permission question if it has not been answered yet; otherwise returns the earlier answer.
export async function askReminderPermission():Promise<ReminderPermission>{
 if(!remindersSupported())return 'unsupported';
 try{return asPermission((await LocalNotifications.requestPermissions()).display);}catch{return 'unsupported';}
}

// Replaces everything scheduled with this plan (an empty plan just clears it). Calls run one after another,
// so two quick updates cannot interleave their cancel and schedule steps.
let queue:Promise<void>=Promise.resolve();
export function applyReminderPlan(plan:PlannedReminder[]){
 queue=queue.then(()=>replace(plan));
 return queue;
}
async function replace(plan:PlannedReminder[]){
 if(!remindersSupported())return;
 try{
  const {notifications:pending}=await LocalNotifications.getPending();
  if(pending.length)await LocalNotifications.cancel({notifications:pending.map(({id})=>({id}))});
  if(plan.length)await LocalNotifications.schedule({notifications:plan.map(({id,kind,at,title,body})=>({id,title,body,schedule:{at,allowWhileIdle:true},extra:{kind}}))});
 }catch{/* Reminders are a convenience: if iOS refuses, the app carries on without them. */}
}
