import {shiftDay} from './days.ts';
import {GEM_RULES} from './gems.ts';
import type {NativeStats} from './nativeStats.ts';

// What the streak page says about today.
// done: practised today · pending: the streak is alive but today still needs practice
// broken: there was a streak before but it has ended · none: no practice yet.
export type TodayStatus='done'|'pending'|'broken'|'none';
export function todayStatus(stats:NativeStats,today:string,current:number):TodayStatus{
 if(Object.hasOwn(stats.days,today))return 'done';
 if(current>0)return 'pending';
 return Object.keys(stats.days).some(day=>day<=today)?'broken':'none';
}
// Yesterday was covered by a streak freeze (so the page can say the streak was saved).
export const savedYesterday=(stats:NativeStats,today:string)=>stats.frozen.includes(shiftDay(today,-1));

// The weekly bonus comes every 7 streak days. Days still to go, counting today if it is not practised yet;
// on the day it was earned, the whole week shows as done.
export function weeklyBonusProgress(stats:NativeStats,today:string,current:number){
 const gems=GEM_RULES.streakWeek;
 if(stats.gems.milestones.includes(today))return {earned:true,left:0,done:7,gems};
 const left=7-current%7;
 return {earned:false,left,done:7-left,gems};
}

// Streak badges, for pride only: they earn nothing and light up once the best streak reaches them.
// The next badge counts down from the current streak.
export const MILESTONES=[7,30,100,365] as const;
export function milestones(best:number,current:number){
 const next=MILESTONES.find(days=>best<days)??null;
 return MILESTONES.map(days=>({days,reached:best>=days,next:days===next,left:days-current}));
}

// One month as calendar weeks starting on Monday. Days outside the month are null.
// A practised or frozen day joins its neighbours in the same week into one band (start/end mark its ends).
export type CalendarDay={day:string;date:number;practised:boolean;frozen:boolean;today:boolean;future:boolean;start:boolean;end:boolean};
export function monthWeeks(stats:NativeStats,year:number,month:number,today:string):(CalendarDay|null)[][]{
 const first=`${year}-${String(month+1).padStart(2,'0')}-01`;
 const length=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 const lead=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
 const frozen=new Set(stats.frozen);
 const active=(day:string)=>Object.hasOwn(stats.days,day)||frozen.has(day);
 const cells:(CalendarDay|null)[]=Array.from({length:lead},()=>null);
 for(let date=1;date<=length;date++){
  const day=shiftDay(first,date-1),column=(lead+date-1)%7,on=active(day)&&day<=today;
  cells.push({day,date,practised:Object.hasOwn(stats.days,day)&&day<=today,frozen:frozen.has(day)&&!Object.hasOwn(stats.days,day),today:day===today,future:day>today,
   start:on&&(column===0||date===1||!active(shiftDay(day,-1))),end:on&&(column===6||date===length||!active(shiftDay(day,1))||shiftDay(day,1)>today)});
 }
 while(cells.length%7)cells.push(null);
 return Array.from({length:cells.length/7},(_,week)=>cells.slice(week*7,week*7+7));
}
// The earliest month with any practice, so the calendar does not page back into empty history.
export function firstMonth(stats:NativeStats,today:string){
 const earliest=[...Object.keys(stats.days),...stats.frozen].sort()[0]??today;
 return {year:Number(earliest.slice(0,4)),month:Number(earliest.slice(5,7))-1};
}
