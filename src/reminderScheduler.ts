import {notificationDriver as driver} from './notificationDriver';
import type {PlannedReminder} from './reminders';

// The only place that talks to iOS notifications (through the driver). Where they are missing (the website)
// everything is a quiet no-op, and any error leaves the app working without reminders.

export type ReminderPermission='granted'|'denied'|'prompt'|'unsupported';
export const remindersSupported=()=>driver.supported();

const asPermission=(display:string):ReminderPermission=>display==='granted'?'granted':display==='denied'?'denied':'prompt';

export async function reminderPermission():Promise<ReminderPermission>{
 if(!remindersSupported())return 'unsupported';
 try{return asPermission(await driver.permission());}catch{return 'unsupported';}
}

// Shows the iOS permission question if it has not been answered yet; otherwise returns the earlier answer.
export async function askReminderPermission():Promise<ReminderPermission>{
 if(!remindersSupported())return 'unsupported';
 try{return asPermission(await driver.requestPermission());}catch{return 'unsupported';}
}

// Calls back when a reminder is tapped; returns a stop function (a no-op where notifications are missing).
export function onReminderTap(listener:(kind:string)=>void):()=>void{
 if(!remindersSupported())return ()=>{};
 try{return driver.onTap(listener);}catch{return ()=>{};}
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
  const pending=await driver.pendingIds();
  if(pending.length)await driver.cancel(pending);
  if(plan.length)await driver.schedule(plan.map(({id,kind,at,title,body})=>({id,title,body,at,extra:{kind}})));
 }catch{/* Reminders are a convenience: if iOS refuses, the app carries on without them. */}
}
