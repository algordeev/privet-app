import {PRODUCT} from './config.ts';
import {isCalendarDay} from './days.ts';
import {GEM_RULES} from './gems.ts';
import {lessonById,nativeLessons} from './lessons.ts';
import {emptyStats,type NativeStats} from './nativeStats.ts';

// Statistics are saved as one JSON snapshot under this key.
export const NATIVE_STATS_KEY=`${PRODUCT.storageKey}-native-stats`;
const lessonIds=nativeLessons.map(item=>item.id);
// Per-day counts: real days mapped to positive whole numbers (under a million, so nothing absurd survives).
function validCounts(counts:unknown):counts is Record<string,number>{
 if(!counts||typeof counts!=='object'||Array.isArray(counts))return false;
 return Object.entries(counts).every(([day,count])=>isCalendarDay(day)&&typeof count==='number'&&Number.isSafeInteger(count)&&count>0&&count<1_000_000);
}
function validGemBreakdown(a:any){return !!a&&Number.isSafeInteger(a.finish)&&[0,GEM_RULES.finish].includes(a.finish)&&Number.isSafeInteger(a.perfect)&&[0,GEM_RULES.perfect].includes(a.perfect)&&Number.isSafeInteger(a.streakWeek)&&[0,GEM_RULES.streakWeek].includes(a.streakWeek);}
function validGems(g:any){return !!g&&Number.isSafeInteger(g.balance)&&g.balance>=0&&Number.isInteger(g.freezes)&&g.freezes>=0&&g.freezes<=GEM_RULES.maxFreezes&&!!g.awarded&&typeof g.awarded==='object'&&!Array.isArray(g.awarded)&&Object.entries(g.awarded).every(([day,ids])=>isCalendarDay(day)&&Array.isArray(ids)&&ids.every((id:any)=>lessonIds.includes(id))&&new Set(ids).size===ids.length)&&Array.isArray(g.milestones)&&g.milestones.every((day:any)=>isCalendarDay(day))&&new Set(g.milestones).size===g.milestones.length&&!!g.awards&&typeof g.awards==='object'&&!Array.isArray(g.awards)&&Object.entries(g.awards).every(([day,items])=>isCalendarDay(day)&&!!items&&typeof items==='object'&&!Array.isArray(items)&&Object.entries(items).every(([id,a]:[string,any])=>lessonIds.includes(id)&&validGemBreakdown(a)));}
function validLatest(s:any){return s.latest===null||(s.latest&&Number.isInteger(s.latest.firstTry)&&s.latest.firstTry>=0&&s.latest.firstTry<=lessonById(s.latest.lessonId).exercises.length&&(s.latest.lessonId===undefined||lessonIds.includes(s.latest.lessonId))&&(s.latest.gemAward===undefined||validGemBreakdown(s.latest.gemAward))&&(s.latest.day===null?s.earlierFinishes===1:typeof s.latest.day==='string'&&isCalendarDay(s.latest.day)&&Object.hasOwn(s.days,s.latest.day)));}
function validCurrent(s:any):s is NativeStats{return (s.onboardingAwarded===undefined||s.onboardingAwarded===true)&&validCounts(s.days)&&[0,1].includes(s.earlierFinishes)&&validLatest(s)&&validCounts(s.xp)&&validGems(s.gems)&&Array.isArray(s.frozen)&&s.frozen.every((day:any)=>isCalendarDay(day))&&new Set(s.frozen).size===s.frozen.length&&(s.lastSeenAt===undefined||(Number.isSafeInteger(s.lastSeenAt)&&s.lastSeenAt>=0));}

// Saved statistics, or a fresh start if they are missing, damaged or from an older version.
function parseStats(raw:string):NativeStats|null{
 const s=JSON.parse(raw);
 return s&&typeof s==='object'&&s.version===3&&validCurrent(s)?s:null;
}
export function restoreStats(raw:string|null):NativeStats{
 if(raw===null)return emptyStats();
 try{return parseStats(raw)??emptyStats();}catch{return emptyStats();}
}
