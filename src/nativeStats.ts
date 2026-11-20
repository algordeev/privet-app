import {validFirstLessonResult} from './firstRun.ts';
import {lessonById,nativeLessons} from './lessons.ts';
import {PRODUCT} from './config.ts';
import {lessonXp,type Action,type Progress} from './engine.ts';
import {isCalendarDay} from './days.ts';
import {addFreeze,emptyWallet,GEM_RULES,spend,spendFreezes,weeklyStreakBonus,type GemBreakdown,type GemWallet} from './gems.ts';
export {GEM_RULES} from './gems.ts';
export type {GemBreakdown} from './gems.ts';

export const NATIVE_STATS_KEY=`${PRODUCT.storageKey}-native-stats`;
export type NativeStats={version:3;onboardingAwarded?:true;days:Record<string,number>;xp:Record<string,number>;earlierFinishes:number;latest:{day:string|null;firstTry:number;lessonId?:string;gemAward?:GemBreakdown}|null;gems:GemWallet;frozen:string[];lastSeenAt?:number};
export function emptyStats():NativeStats{
 return {version:3,days:{},xp:{},earlierFinishes:0,latest:null,gems:emptyWallet(),frozen:[]};
}
export function localDay(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export const validDay=(day:string)=>isCalendarDay(day);
export function shiftDay(day:string,offset:number){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
const lessonIds=nativeLessons.map(item=>item.id);
// Per-day counts: real days mapped to positive whole numbers (under a million, so nothing absurd survives).
function validCounts(counts:unknown):counts is Record<string,number>{
 if(!counts||typeof counts!=='object'||Array.isArray(counts))return false;
 return Object.entries(counts).every(([day,count])=>validDay(day)&&typeof count==='number'&&Number.isSafeInteger(count)&&count>0&&count<1_000_000);
}
function validGemBreakdown(a:any){return !!a&&Number.isSafeInteger(a.finish)&&[0,GEM_RULES.finish].includes(a.finish)&&Number.isSafeInteger(a.perfect)&&[0,GEM_RULES.perfect].includes(a.perfect)&&Number.isSafeInteger(a.streakWeek)&&[0,GEM_RULES.streakWeek].includes(a.streakWeek);}
function validGems(g:any){return !!g&&Number.isSafeInteger(g.balance)&&g.balance>=0&&Number.isInteger(g.freezes)&&g.freezes>=0&&g.freezes<=GEM_RULES.maxFreezes&&!!g.awarded&&typeof g.awarded==='object'&&!Array.isArray(g.awarded)&&Object.entries(g.awarded).every(([day,ids])=>validDay(day)&&Array.isArray(ids)&&ids.every((id:any)=>lessonIds.includes(id))&&new Set(ids).size===ids.length)&&Array.isArray(g.milestones)&&g.milestones.every((day:any)=>validDay(day))&&new Set(g.milestones).size===g.milestones.length&&!!g.awards&&typeof g.awards==='object'&&!Array.isArray(g.awards)&&Object.entries(g.awards).every(([day,items])=>validDay(day)&&!!items&&typeof items==='object'&&!Array.isArray(items)&&Object.entries(items).every(([id,a]:[string,any])=>lessonIds.includes(id)&&validGemBreakdown(a)));}
function validLatest(s:any){return s.latest===null||(s.latest&&Number.isInteger(s.latest.firstTry)&&s.latest.firstTry>=0&&s.latest.firstTry<=lessonById(s.latest.lessonId).exercises.length&&(s.latest.lessonId===undefined||lessonIds.includes(s.latest.lessonId))&&(s.latest.gemAward===undefined||validGemBreakdown(s.latest.gemAward))&&(s.latest.day===null?s.earlierFinishes===1:typeof s.latest.day==='string'&&validDay(s.latest.day)&&Object.hasOwn(s.days,s.latest.day)));}
function validCurrent(s:any):s is NativeStats{return (s.onboardingAwarded===undefined||s.onboardingAwarded===true)&&validCounts(s.days)&&[0,1].includes(s.earlierFinishes)&&validLatest(s)&&validCounts(s.xp)&&validGems(s.gems)&&Array.isArray(s.frozen)&&s.frozen.every((day:any)=>validDay(day))&&new Set(s.frozen).size===s.frozen.length&&(s.lastSeenAt===undefined||(Number.isSafeInteger(s.lastSeenAt)&&s.lastSeenAt>=0));}

// Saved statistics, or a fresh start if they are missing, damaged or from an older version.
function parseStats(raw:string):NativeStats|null{
 const s=JSON.parse(raw);
 return s&&typeof s==='object'&&s.version===3&&validCurrent(s)?s:null;
}
export function restoreStats(raw:string|null):NativeStats{
 if(raw===null)return emptyStats();
 try{return parseStats(raw)??emptyStats();}catch{return emptyStats();}
}
// localDay() reads the device's CURRENT local calendar fields; shiftDay()/
// validDay() above are anchored to UTC noon and never move. A timezone
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
// The days after `day`, up to and including `through`.
function daysAfter(day:string,through:string):string[]{
 const list:string[]=[];
 for(let next=shiftDay(day,1);next<=through;next=shiftDay(next,1))list.push(next);
 return list;
}
// Held freezes cover the days missed since the last practice, up to yesterday, but only when they
// can cover all of them: if the streak is lost anyway, the learner keeps the freezes.
export function applyStreakFreezes(stats:NativeStats,now:Date):NativeStats{
 const yesterday=shiftDay(resolveToday(stats,now),-1);
 const lastPractised=Object.keys(stats.days).filter(day=>day<=yesterday).sort().at(-1);
 if(!lastPractised)return stats;
 const alreadyCovered=new Set(stats.frozen);
 const missed=daysAfter(lastPractised,yesterday).filter(day=>!Object.hasOwn(stats.days,day)&&!alreadyCovered.has(day));
 if(missed.length===0||missed.length>stats.gems.freezes)return stats;
 return {...stats,frozen:[...stats.frozen,...missed],gems:spendFreezes(stats.gems,missed.length)};
}
const withWallet=(stats:NativeStats,wallet:GemWallet|null):NativeStats|null=>wallet&&{...stats,gems:wallet};
export const spendGems=(stats:NativeStats,amount:number)=>withWallet(stats,spend(stats.gems,amount));
export const buyFreeze=(stats:NativeStats)=>withWallet(stats,addFreeze(stats.gems));
export function recordFinish(stats:NativeStats,results:boolean[],date:Date,lessonId='cafe',xp=0):NativeStats{
 const day=resolveToday(stats,date),id=lessonById(lessonId).id,awarded=stats.gems.awarded[day]??[],finish=awarded.includes(id)?0:GEM_RULES.finish,perfect=!awarded.includes(id)&&results.length>0&&results.every(Boolean)?GEM_RULES.perfect:0;
 // Monotonic: a backdated/out-of-order finish (replaying history, or a
 // `now` already excluded above) must never move our real-time anchor
 // backward, or a later call could wrongly clamp against it.
 const lastSeenAt=Math.max(stats.lastSeenAt??0,date.getTime());
 let next:NativeStats={...stats,days:{...stats.days,[day]:(stats.days[day]??0)+1},xp:xp>0?{...stats.xp,[day]:(stats.xp[day]??0)+xp}:stats.xp,latest:{day,firstTry:results.filter(Boolean).length,lessonId:id},gems:{...stats.gems,awarded:{...stats.gems.awarded,[day]:finish?[...awarded,id]:awarded}},lastSeenAt};
 const streakWeek=weeklyStreakBonus(statsSummary(next,date).current,day,next.gems);
 const breakdown={finish,perfect,streakWeek},previous=stats.gems.awards[day]?.[id]??{finish:0,perfect:0,streakWeek:0};
 // Daily totals survive replays; the latest attempt contains only newly earned gems.
 const cumulative={finish:previous.finish+finish,perfect:previous.perfect+perfect,streakWeek:previous.streakWeek+streakWeek};
 next={...next,latest:{...next.latest!,gemAward:breakdown},gems:{...next.gems,balance:next.gems.balance+finish+perfect+streakWeek,milestones:streakWeek?[...next.gems.milestones,day]:next.gems.milestones,awards:{...next.gems.awards,[day]:{...next.gems.awards[day],[id]:cumulative}}}};return next;
}
// Review sessions keep the streak alive and earn XP, but award no gems and leave `latest` (a lesson receipt) untouched.
export const REVIEW_SESSION_PREFIX='review:';
export function recordReviewFinish(stats:NativeStats,date:Date,xp=0):NativeStats{
 const day=resolveToday(stats,date),lastSeenAt=Math.max(stats.lastSeenAt??0,date.getTime());
 return {...stats,days:{...stats.days,[day]:(stats.days[day]??0)+1},xp:xp>0?{...stats.xp,[day]:(stats.xp[day]??0)+xp}:stats.xp,lastSeenAt};
}
// Answers from the keychain Mini's pocket deck: each day with answers counts once as a practice day (for
// the streak), with 1 XP per card the learner knew. Less than an in-app review on purpose: a self-graded
// flashcard is easier. No gems; `latest` (a lesson receipt) is untouched. Days after today are ignored.
export const POCKET_XP_PER_CARD=1;
export function recordPocketReviews(stats:NativeStats,answers:readonly {day:string;knew:boolean}[],date:Date):NativeStats{
 const today=resolveToday(stats,date),byDay=new Map<string,number>();
 for(const {day,knew} of answers)if(validDay(day)&&day<=today)byDay.set(day,(byDay.get(day)??0)+(knew?POCKET_XP_PER_CARD:0));
 if(!byDay.size)return stats;
 const days={...stats.days},xp={...stats.xp};
 for(const [day,earned] of byDay){days[day]=(days[day]??0)+1;if(earned>0)xp[day]=(xp[day]??0)+earned;}
 return {...stats,days,xp,lastSeenAt:Math.max(stats.lastSeenAt??0,date.getTime())};
}
export function createStatsTracker(initial:NativeStats,save:(stats:NativeStats)=>void,now:()=>Date){
 let stats=initial;
 const recorded=new Set<string>();
 // All mutations, including lifecycle freeze checks and shop purchases, use
 // this path so the tracker, React state and persisted snapshot cannot diverge.
 function update(transform:(current:NativeStats)=>NativeStats|null){
  const next=transform(stats);
  if(!next)return false;
  if(next!==stats){stats=next;save(stats);}
  return true;
 }
 return {
  update,
  transition(previous:Progress,next:Progress,action:Action,lessonId='cafe'){
   if(action.type==='reset'){recorded.delete(lessonId);return;}
   if(action.type!=='continue'||recorded.has(lessonId)||previous.complete||!next.complete||next.failed)return;
   recorded.add(lessonId);
   const date=now();
   if(lessonId.startsWith(REVIEW_SESSION_PREFIX)){update(current=>recordReviewFinish(applyStreakFreezes(current,date),date,lessonXp(next,next.results.length)));return;}
   update(current=>recordFinish(applyStreakFreezes(current,date),next.results,date,lessonId,lessonXp(next,next.results.length)));
  },
  reset(){recorded.clear();update(()=>emptyStats());},
 };
}

// The durable receipt and rewards are saved in one statistics snapshot. Replay
// and a reopened completion cannot mint another onboarding award.
export function recordOnboardingFinish(stats:NativeStats,progress:Progress,date:Date):NativeStats{
 if(stats.onboardingAwarded||!validFirstLessonResult(progress))return stats;
 return {...recordFinish(stats,progress.results,date,'cafe',lessonXp(progress,5)),onboardingAwarded:true};
}
