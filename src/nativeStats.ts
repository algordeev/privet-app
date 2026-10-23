import {validFirstLessonResult} from './firstRun.ts';
import {lessonById,nativeLessons} from './lessons.ts';
import {PRODUCT} from './config.ts';
import {lessonXp,type Action,type Progress} from './engine.ts';
import type {Saved} from './session.ts';

export const NATIVE_STATS_KEY=`${PRODUCT.storageKey}-native-stats`;
export const GEM_RULES={finish:5,perfect:5,streakWeek:10,refill:20,freeze:30,maxFreezes:2} as const;
export type GemBreakdown={finish:number;perfect:number;streakWeek:number};
export type NativeStats={version:3;onboardingAwarded?:true;days:Record<string,number>;xp:Record<string,number>;earlierFinishes:number;latest:{day:string|null;firstTry:number;lessonId?:string;gemAward?:GemBreakdown}|null;gems:{balance:number;freezes:number;awarded:Record<string,string[]>;milestones:string[];awards:Record<string,Record<string,GemBreakdown>>};frozen:string[]};
const emptyGems=()=>({balance:0,freezes:0,awarded:{},milestones:[],awards:{}});
export const emptyStats=():NativeStats=>({version:3,days:{},xp:{},earlierFinishes:0,latest:null,gems:emptyGems(),frozen:[]});
export function localDay(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function validDay(day:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const d=new Date(`${day}T12:00:00Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===day;}
export function shiftDay(day:string,offset:number){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
const lessonIds=nativeLessons.map(item=>item.id);
function validCounts(obj:unknown){return !!obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.entries(obj).every(([day,n])=>validDay(day)&&Number.isSafeInteger(n)&&Number(n)>0&&Number(n)<1_000_000);}
function validGemBreakdown(a:any){return !!a&&Number.isSafeInteger(a.finish)&&[0,GEM_RULES.finish].includes(a.finish)&&Number.isSafeInteger(a.perfect)&&[0,GEM_RULES.perfect].includes(a.perfect)&&Number.isSafeInteger(a.streakWeek)&&[0,GEM_RULES.streakWeek].includes(a.streakWeek);}
function validGems(g:any){return !!g&&Number.isSafeInteger(g.balance)&&g.balance>=0&&Number.isInteger(g.freezes)&&g.freezes>=0&&g.freezes<=GEM_RULES.maxFreezes&&!!g.awarded&&typeof g.awarded==='object'&&!Array.isArray(g.awarded)&&Object.entries(g.awarded).every(([day,ids])=>validDay(day)&&Array.isArray(ids)&&ids.every((id:any)=>lessonIds.includes(id))&&new Set(ids).size===ids.length)&&Array.isArray(g.milestones)&&g.milestones.every((day:any)=>validDay(day))&&new Set(g.milestones).size===g.milestones.length&&!!g.awards&&typeof g.awards==='object'&&!Array.isArray(g.awards)&&Object.entries(g.awards).every(([day,items])=>validDay(day)&&!!items&&typeof items==='object'&&!Array.isArray(items)&&Object.entries(items).every(([id,a]:[string,any])=>lessonIds.includes(id)&&validGemBreakdown(a)));}
export function restoreStats(raw:string|null,legacy?:Saved['completion']):NativeStats{
 if(raw!==null){try{const s=JSON.parse(raw);const validLatest=(s:any)=>s.latest===null||(s.latest&&Number.isInteger(s.latest.firstTry)&&s.latest.firstTry>=0&&s.latest.firstTry<=lessonById(s.latest.lessonId).exercises.length&&(s.latest.lessonId===undefined||lessonIds.includes(s.latest.lessonId))&&(s.latest.gemAward===undefined||validGemBreakdown(s.latest.gemAward))&&(s.latest.day===null?s.earlierFinishes===1:typeof s.latest.day==='string'&&validDay(s.latest.day)&&Object.hasOwn(s.days,s.latest.day)));const validBase=(s:any)=>validCounts(s.days)&&[0,1].includes(s.earlierFinishes)&&validLatest(s);
  if((s?.version===1||s?.version===2)&&validBase(s)&&(s.version===1||validCounts(s.xp)))return {...s,version:3,xp:s.version===1?{}:s.xp,gems:emptyGems(),frozen:[]};
  if(s?.version===3&&(s.onboardingAwarded===undefined||s.onboardingAwarded===true)&&validBase(s)&&validCounts(s.xp)&&validGems(s.gems)&&Array.isArray(s.frozen)&&s.frozen.every((day:any)=>validDay(day))&&new Set(s.frozen).size===s.frozen.length)return s;
 }catch{/* Ignore malformed local storage. */}}
 const stats=emptyStats();if(legacy?.results?.length===5&&legacy.results.every(r=>typeof r==='boolean')){stats.earlierFinishes=1;stats.latest={day:null,firstTry:legacy.results.filter(Boolean).length};}return stats;
}
export function statsSummary(stats:NativeStats,now:Date){
 const today=localDay(now),days=Object.keys(stats.days).filter(day=>day<=today).sort(),active=new Set([...days,...stats.frozen.filter(day=>day<=today)]);
 let best=0,run=0,previous='';for(const day of [...active].sort()){run=previous&&shiftDay(previous,1)===day?run+(Object.hasOwn(stats.days,day)?1:0):(Object.hasOwn(stats.days,day)?1:0);best=Math.max(best,run);previous=day;}
 let current=0;const last=[...active].sort().at(-1);if(last&&(last===today||last===shiftDay(today,-1))){for(let day=last;active.has(day);day=shiftDay(day,-1))if(Object.hasOwn(stats.days,day))current++;}
 const xpDays=Object.keys(stats.xp).filter(day=>day<=today),todayAwards=Object.values(stats.gems.awards[today]??{}).reduce((sum,a)=>sum+a.finish+a.perfect+a.streakWeek,0);
 return {current,best,practiceDays:days.length,finishes:stats.earlierFinishes+days.reduce((sum,day)=>sum+stats.days[day],0),todayXp:stats.xp[today]??0,totalXp:xpDays.reduce((sum,day)=>sum+stats.xp[day],0),gems:stats.gems.balance,freezes:stats.gems.freezes,todayGemAwards:todayAwards,week:Array.from({length:7},(_,i)=>{const day=shiftDay(today,i-6);return {day,finishes:stats.days[day]??0,xp:stats.xp[day]??0,today:day===today};})};
}
export function applyStreakFreezes(stats:NativeStats,today:Date):NativeStats{
 const todayKey=localDay(today),yesterday=shiftDay(todayKey,-1),lastPractice=Object.keys(stats.days).filter(day=>day<=yesterday).sort().at(-1);if(!lastPractice)return stats;
 const known=new Set(stats.frozen),missed:string[]=[];
 for(let day=shiftDay(lastPractice,1);day<=yesterday;day=shiftDay(day,1))if(!Object.hasOwn(stats.days,day)&&!known.has(day))missed.push(day);
 // Only spend freezes when they save the streak; a gap longer than the
 // freezes held breaks it anyway, so the learner keeps their freezes.
 if(!missed.length||missed.length>stats.gems.freezes)return stats;
 return {...stats,frozen:[...stats.frozen,...missed],gems:{...stats.gems,freezes:stats.gems.freezes-missed.length}};
}
export function spendGems(stats:NativeStats,amount:number):NativeStats|null{if(!Number.isSafeInteger(amount)||amount<0||stats.gems.balance<amount)return null;return {...stats,gems:{...stats.gems,balance:stats.gems.balance-amount}};}
export function buyFreeze(stats:NativeStats):NativeStats|null{if(stats.gems.freezes>=GEM_RULES.maxFreezes)return null;const spent=spendGems(stats,GEM_RULES.freeze);return spent?{...spent,gems:{...spent.gems,freezes:spent.gems.freezes+1}}:null;}
export function recordFinish(stats:NativeStats,results:boolean[],date:Date,lessonId='cafe',xp=0):NativeStats{
 const day=localDay(date),id=lessonById(lessonId).id,awarded=stats.gems.awarded[day]??[],finish=awarded.includes(id)?0:GEM_RULES.finish,perfect=!awarded.includes(id)&&results.length>0&&results.every(Boolean)?GEM_RULES.perfect:0;
 let next:NativeStats={...stats,days:{...stats.days,[day]:(stats.days[day]??0)+1},xp:xp>0?{...stats.xp,[day]:(stats.xp[day]??0)+xp}:stats.xp,latest:{day,firstTry:results.filter(Boolean).length,lessonId:id},gems:{...stats.gems,awarded:{...stats.gems.awarded,[day]:finish?[...awarded,id]:awarded}}};
 const streakBefore=statsSummary(next,date).current,streakWeek=streakBefore>0&&streakBefore%7===0&&!next.gems.milestones.includes(day)?GEM_RULES.streakWeek:0;
 const breakdown={finish,perfect,streakWeek},previous=stats.gems.awards[day]?.[id]??{finish:0,perfect:0,streakWeek:0};
 // Daily totals survive replays; the latest attempt contains only newly earned gems.
 const cumulative={finish:previous.finish+finish,perfect:previous.perfect+perfect,streakWeek:previous.streakWeek+streakWeek};
 next={...next,latest:{...next.latest!,gemAward:breakdown},gems:{...next.gems,balance:next.gems.balance+finish+perfect+streakWeek,milestones:streakWeek?[...next.gems.milestones,day]:next.gems.milestones,awards:{...next.gems.awards,[day]:{...next.gems.awards[day],[id]:cumulative}}}};return next;
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
