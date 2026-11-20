import {localDay,shiftDay} from './days.ts';
import type {NativeStats} from './nativeStats.ts';

// Which day it is for the statistics, and what Profile shows: streaks, finishes, XP, gems and the week.

// localDay() reads the device's CURRENT local calendar fields; shiftDay()
// and isCalendarDay() are anchored to UTC noon and never move. A timezone
// change -- travel, or crossing the date line -- can therefore make
// localDay(now) read a day earlier, or several days later, than it last
// did, even though real (UTC epoch) time only moved forward. lastSeenAt is
// that real-time anchor: the epoch-ms moment stats were last recorded,
// unaffected by timezone. We only clamp when `now` is at or after it --
// the only situation a timezone blip can occur in, during continuous
// normal use. A `now` before lastSeenAt is a separately recorded date that
// has not arrived yet (already excluded by the day<=today filters below,
// and covered by "future dated records" below), never a timezone blip, so
// it is left alone.
export function resolveToday(stats:Pick<NativeStats,'days'|'lastSeenAt'>,now:Date):string{
 const raw=localDay(now),lastSeenAt=stats.lastSeenAt;
 if(!Number.isFinite(lastSeenAt)||now.getTime()<lastSeenAt!)return raw;
 const known=Object.keys(stats.days).sort().at(-1);
 if(!known)return raw;
 if(raw<known)return known; // never earlier than the latest day already recorded: prevents a double count.
 const elapsedDays=Math.floor((now.getTime()-lastSeenAt!)/86400000);
 const cap=shiftDay(known,elapsedDays+1); // genuine elapsed days, plus one honest day of timezone slack.
 return raw>cap?cap:raw; // never further ahead than real time justifies: prevents a skip.
}
// Unbroken runs of days, each a list of consecutive days in order.
function consecutiveRuns(days:Iterable<string>):string[][]{
 const runs:string[][]=[];
 for(const day of [...days].sort()){
  const run=runs.at(-1);
  if(run&&shiftDay(run[run.length-1],1)===day)run.push(day);else runs.push([day]);
 }
 return runs;
}
const total=(values:number[])=>values.reduce((sum,value)=>sum+value,0);
export function statsSummary(stats:NativeStats,now:Date){
 const today=resolveToday(stats,now),days=Object.keys(stats.days).filter(day=>day<=today).sort(),active=new Set([...days,...stats.frozen.filter(day=>day<=today)]);
 // Frozen days keep a run unbroken but only practised days count toward the streak.
 const practised=(run:string[])=>run.filter(day=>Object.hasOwn(stats.days,day)).length;
 const runs=consecutiveRuns(active),latest=runs.at(-1),latestDay=latest?.at(-1);
 const alive=latestDay===today||latestDay===shiftDay(today,-1);
 const week=Array.from({length:7},(_,offset)=>{const day=shiftDay(today,offset-6);return {day,finishes:stats.days[day]??0,xp:stats.xp[day]??0,today:day===today};});
 return {
  current:alive&&latest?practised(latest):0,
  best:Math.max(0,...runs.map(practised)),
  practiceDays:days.length,
  finishes:stats.earlierFinishes+total(days.map(day=>stats.days[day])),
  todayXp:stats.xp[today]??0,
  totalXp:total(Object.keys(stats.xp).filter(day=>day<=today).map(day=>stats.xp[day])),
  gems:stats.gems.balance,
  freezes:stats.gems.freezes,
  todayGemAwards:total(Object.values(stats.gems.awards[today]??{}).map(award=>award.finish+award.perfect+award.streakWeek)),
  week,
 };
}
