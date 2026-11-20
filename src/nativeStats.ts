import {validFirstLessonResult} from './firstRun.ts';
import {lessonById} from './lessons.ts';
import {lessonXp,type Action,type Progress} from './engine.ts';
import {isCalendarDay,shiftDay} from './days.ts';
import {addFreeze,emptyWallet,GEM_RULES,spend,spendFreezes,weeklyStreakBonus,type GemBreakdown,type GemWallet} from './gems.ts';
import {resolveToday,statsSummary} from './statsSummary.ts';

// The learner's statistics and every change to them: finishing lessons and reviews, freezes and gem purchases.
// Saving and loading live in statsStorage.ts; what Profile shows is worked out in statsSummary.ts.
export type NativeStats={version:3;onboardingAwarded?:true;days:Record<string,number>;xp:Record<string,number>;earlierFinishes:number;latest:{day:string|null;firstTry:number;lessonId?:string;gemAward?:GemBreakdown}|null;gems:GemWallet;frozen:string[];lastSeenAt?:number};
export function emptyStats():NativeStats{
 return {version:3,days:{},xp:{},earlierFinishes:0,latest:null,gems:emptyWallet(),frozen:[]};
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
 for(const {day,knew} of answers)if(isCalendarDay(day)&&day<=today)byDay.set(day,(byDay.get(day)??0)+(knew?POCKET_XP_PER_CARD:0));
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
