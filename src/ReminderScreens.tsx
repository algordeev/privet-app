import {useState} from 'react';
import {NativeSheet} from './NativeSheet';
import {LAST_CALL_TIME} from './reminders';
import type {RemindersController} from './useReminders';
import './reminders.css';

// The once-only invitation, shown on home after the first finished lesson: a lock-screen preview of the two
// reminders, then a choice. Only "Allow reminders" brings up the iOS question (which iOS shows just once).
const AppIcon=()=><svg className="reminder-app-icon" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" fill="#f8f6f0"/><path d="M13.5 8.5h13a8.5 8.5 0 0 1 8.5 8.5v4a8.5 8.5 0 0 1-8.5 8.5h-7.6L13 33.4v-4A8.5 8.5 0 0 1 5 21v-4a8.5 8.5 0 0 1 8.5-8.5z" fill="#246653"/><rect x="14" y="15" width="3.4" height="7" rx="1.7" fill="#f4e9c9"/><rect x="22.6" y="15" width="3.4" height="7" rx="1.7" fill="#f4e9c9"/></svg>;
function PreviewNotification({when,title,body}:{when:string;title:string;body:string}){
 return <div className="reminder-preview-card"><AppIcon/><div><p><b>Privet</b><span>{when}</span></p><strong>{title}</strong><small>{body}</small></div></div>;
}
export function ReminderInvite({reminders,onClose}:{reminders:RemindersController;onClose:()=>void}){
 const [asking,setAsking]=useState(false);
 const later=()=>{reminders.markOffered();onClose();};
 const turnOn=async()=>{setAsking(true);await reminders.enable();onClose();};
 return <NativeSheet id="native-reminder-invite" title="Reminders" onClose={later}>
  <div className="native-sheet-scroll reminder-invite">
   <div className="reminder-preview" aria-hidden="true">
    <span className="reminder-preview-clock">{reminders.settings.time}</span>
    <PreviewNotification when="now" title="Привет! 👋" body="A little Russian today? Your next lesson is ready."/>
    <PreviewNotification when={LAST_CALL_TIME} title="Your 5-day streak ends at midnight" body="There is still time. One short lesson keeps it. 🔥"/>
   </div>
   <h3>A gentle nudge, only when you need it</h3>
   <p>A reminder at {reminders.settings.time} on days you haven’t practised, and a heads-up at {LAST_CALL_TIME} if your streak is about to end. Never once you’ve done your lesson.</p>
   <button className="button teal" onClick={turnOn} disabled={asking}>Allow reminders</button>
   <button className="native-text-button" onClick={later} disabled={asking}>Not now</button>
  </div>
 </NativeSheet>;
}

// Settings → Reminders: the daily reminder, its time and the streak last call.
export function ReminderSettings({reminders}:{reminders:RemindersController}){
 const {settings,permission}=reminders;
 if(permission==='unsupported')return null;
 const blocked=permission==='denied';
 const on=settings.enabled&&permission==='granted';
 const lastCallFits=Number(settings.time.slice(0,2))*60+Number(settings.time.slice(3,5))<=20*60;
 return <section className="native-settings-card reminder-settings" aria-labelledby="settings-reminders-title">
  <h2 id="settings-reminders-title">Reminders</h2>
  <label className="native-settings-row"><span><strong>Daily reminder</strong><small>Only on days you haven’t practised yet</small></span>
   <input type="checkbox" role="switch" aria-label="Daily reminder" checked={on} disabled={blocked} onChange={event=>{if(event.target.checked)reminders.enable();else reminders.disable();}}/></label>
  {on&&<label className="native-settings-row"><span><strong>Time</strong><small>When the daily reminder arrives</small></span>
   <input className="reminder-time" type="time" aria-label="Reminder time" value={settings.time} onChange={event=>reminders.setTime(event.target.value)}/></label>}
  {on&&<label className="native-settings-row"><span><strong>Streak last call · {LAST_CALL_TIME}</strong><small>{lastCallFits?'If your streak hasn’t been kept that day':'Paused while your reminder is after 20:00'}</small></span>
   <input type="checkbox" role="switch" aria-label="Streak last call" checked={settings.lastCall&&lastCallFits} disabled={!lastCallFits} onChange={event=>reminders.setLastCall(event.target.checked)}/></label>}
  {blocked&&<p className="reminder-blocked" role="note">Notifications for Privet are turned off on this iPhone. To use reminders, open the iOS Settings app → Notifications → Privet, and allow notifications.</p>}
 </section>;
}
