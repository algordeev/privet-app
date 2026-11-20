import {PRODUCT} from './config.ts';

// Reminders are local notifications planned on the phone: a daily reminder at the learner's time, and an
// evening last call while a streak is at risk. Nothing is sent from a server.

// enabled: the learner turned reminders on · offered: the after-first-lesson invitation was already shown.
export type ReminderSettings={version:1;enabled:boolean;time:string;lastCall:boolean;offered:boolean};
export const REMINDERS_KEY=`${PRODUCT.storageKey}-reminders`;
export const DEFAULT_TIME='19:00';
export const LAST_CALL_TIME='21:00';
// The last call needs this much room after the daily reminder, or it is left out.
const LAST_CALL_GAP_MINUTES=60;
// How far ahead reminders are planned; the plan is redone every time the app opens.
export const PLAN_DAYS=7;

export const defaultReminders=():ReminderSettings=>({version:1,enabled:false,time:DEFAULT_TIME,lastCall:true,offered:false});
export const isClockTime=(value:unknown):value is string=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5));

// Saved settings, or the defaults if missing or damaged.
export function restoreReminders(raw:string|null):ReminderSettings{
 if(raw===null)return defaultReminders();
 try{
  const s=JSON.parse(raw);
  return s&&s.version===1&&typeof s.enabled==='boolean'&&isClockTime(s.time)&&typeof s.lastCall==='boolean'&&typeof s.offered==='boolean'
   ?{version:1,enabled:s.enabled,time:s.time,lastCall:s.lastCall,offered:s.offered}:defaultReminders();
 }catch{return defaultReminders();}
}

export type PlannedReminder={id:number;kind:'daily'|'last-call';at:Date;title:string;body:string};
export type ReminderState={now:Date;practisedToday:boolean;streak:number};

// Wording: warm, short, in the companion's voice. The streak number is only used where it is certain.
const DAILY=[
 {title:'Привет! 👋',body:'A little Russian today? Your next lesson is ready.'},
 {title:'Time for a mini-class ☕',body:'Five minutes is enough. Your next lesson is waiting.'},
 {title:'Ready when you are',body:'One short lesson, a few new words. Поехали!'},
];
const dailyWithStreak=(streak:number)=>({title:`Keep your ${streak}-day streak 🔥`,body:'Привет! One short lesson keeps it going.'});
const lastCall=(streak:number)=>({title:`Your ${streak}-day streak ends at midnight`,body:'There is still time. One short lesson keeps it. 🔥'});

const at=(day:Date,time:string)=>new Date(day.getFullYear(),day.getMonth(),day.getDate(),Number(time.slice(0,2)),Number(time.slice(3,5)));
const dayNumber=(day:Date)=>Math.floor(Date.UTC(day.getFullYear(),day.getMonth(),day.getDate())/86_400_000);

// What to schedule from now on. Days already practised get nothing. The streak can only be named for the next
// day it is certain: today while it is alive and unpractised, or tomorrow after practising today. Further ahead
// a skipped day may have ended it, so those days get a plain reminder and no last call.
export function planReminders(settings:ReminderSettings,{now,practisedToday,streak}:ReminderState):PlannedReminder[]{
 if(!settings.enabled)return [];
 const plan:PlannedReminder[]=[];
 const withLastCall=settings.lastCall&&minutes(LAST_CALL_TIME)-minutes(settings.time)>=LAST_CALL_GAP_MINUTES;
 for(let offset=0;offset<PLAN_DAYS;offset++){
  if(offset===0&&practisedToday)continue;
  const day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);
  // The streak this day would keep, if certain: today's live streak, or tomorrow's after practising today.
  const knownStreak=streak>0&&(offset===0||(offset===1&&practisedToday))?streak:0;
  const daily=at(day,settings.time);
  if(daily>now)plan.push({id:100+offset,kind:'daily',at:daily,...(knownStreak?dailyWithStreak(knownStreak):DAILY[dayNumber(day)%DAILY.length])});
  const evening=at(day,LAST_CALL_TIME);
  if(withLastCall&&knownStreak&&evening>now)plan.push({id:200+offset,kind:'last-call',at:evening,...lastCall(knownStreak)});
 }
 return plan;
}
