import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultReminders,PLAN_DAYS,planReminders,restoreReminders,type ReminderSettings} from './reminders.ts';

const on:ReminderSettings={...defaultReminders(),enabled:true};
const at=(day:number,hour:number,minute=0)=>new Date(2026,10,day,hour,minute);   // November 2026, local time
const summary=(plan:ReturnType<typeof planReminders>)=>plan.map(item=>`${item.kind} ${item.at.getDate()} ${item.at.getHours()}:${String(item.at.getMinutes()).padStart(2,'0')}`);

test('reminders are off until turned on, and settings default to 19:00 with the evening last call',()=>{
 assert.deepEqual(defaultReminders(),{version:1,enabled:false,time:'19:00',lastCall:true,offered:false});
 assert.deepEqual(planReminders(defaultReminders(),{now:at(21,10),practisedToday:false,streak:5}),[]);
});

test('a daily reminder is planned for each of the next seven days not yet practised, at the chosen time',()=>{
 const plan=planReminders(on,{now:at(21,10),practisedToday:false,streak:0});
 assert.equal(plan.filter(item=>item.kind==='daily').length,PLAN_DAYS);
 assert.deepEqual(summary(plan).slice(0,2),['daily 21 19:00','daily 22 19:00']);
 const practised=planReminders(on,{now:at(21,10),practisedToday:true,streak:0});
 assert.equal(summary(practised)[0],'daily 22 19:00','practising today cancels today’s reminder');
 assert.equal(summary(planReminders(on,{now:at(21,19,30),practisedToday:false,streak:0}))[0],'daily 22 19:00','a time already passed today is not planned');
 assert.equal(summary(planReminders({...on,time:'08:15'},{now:at(21,7),practisedToday:false,streak:0}))[0],'daily 21 8:15');
});

test('the evening last call comes only while a streak is alive and still unpractised, for the next day that is certain',()=>{
 const today=planReminders(on,{now:at(21,10),practisedToday:false,streak:6});
 assert.deepEqual(summary(today).slice(0,3),['daily 21 19:00','last-call 21 21:00','daily 22 19:00'],'tomorrow is not certain: a skipped today ends the streak');
 assert.equal(today.filter(item=>item.kind==='last-call').length,1);
 const afterPractice=planReminders(on,{now:at(21,10),practisedToday:true,streak:6});
 assert.deepEqual(summary(afterPractice).slice(0,2),['daily 22 19:00','last-call 22 21:00'],'after practising today, tomorrow keeps the streak');
 assert.equal(planReminders(on,{now:at(21,10),practisedToday:false,streak:0}).some(item=>item.kind==='last-call'),false,'no streak, no last call');
 assert.equal(planReminders({...on,lastCall:false},{now:at(21,10),practisedToday:false,streak:6}).some(item=>item.kind==='last-call'),false,'the learner can switch it off');
});

test('the last call is left out when the daily reminder is less than an hour before it',()=>{
 for(const time of ['20:01','20:30','21:00','22:00'])assert.equal(planReminders({...on,time},{now:at(21,10),practisedToday:false,streak:6}).some(item=>item.kind==='last-call'),false,time);
 assert.equal(planReminders({...on,time:'20:00'},{now:at(21,10),practisedToday:false,streak:6}).some(item=>item.kind==='last-call'),true);
});

test('the streak is named only where it is certain; other days get varied plain wording',()=>{
 const plan=planReminders(on,{now:at(21,10),practisedToday:false,streak:6});
 assert.equal(plan[0].title,'Keep your 6-day streak 🔥');
 assert.equal(plan[1].title,'Your 6-day streak ends at midnight');
 const later=plan.filter(item=>item.kind==='daily').slice(1);
 assert.ok(later.every(item=>!/streak/.test(item.title+item.body)),'later days never mention a streak that may have ended');
 assert.ok(new Set(later.map(item=>item.title)).size>1,'the wording varies from day to day');
});

test('each planned reminder has its own id, so a new plan cleanly replaces the old one',()=>{
 const plan=planReminders(on,{now:at(21,10),practisedToday:false,streak:6});
 assert.equal(new Set(plan.map(item=>item.id)).size,plan.length);
});

test('damaged settings fall back to the defaults',()=>{
 for(const raw of [null,'garbage','{}',JSON.stringify({...on,version:2}),JSON.stringify({...on,time:'25:00'}),JSON.stringify({...on,time:'7:00'}),JSON.stringify({...on,enabled:'yes'})])
  assert.deepEqual(restoreReminders(raw),defaultReminders(),String(raw));
 assert.deepEqual(restoreReminders(JSON.stringify({...on,time:'07:30'})),{...on,time:'07:30'});
});
