import {lessonById} from './lessons.ts';
import {PRODUCT} from './config.ts';
import type {Action,Progress} from './engine.ts';
import type {Saved} from './session.ts';

export const NATIVE_STATS_KEY=`${PRODUCT.storageKey}-native-stats`;
export type NativeStats={version:1;days:Record<string,number>;earlierFinishes:number;latest:{day:string|null;firstTry:number;lessonId?:string}|null};
export const emptyStats=():NativeStats=>({version:1,days:{},earlierFinishes:0,latest:null});
export function localDay(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function validDay(day:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
 const d=new Date(`${day}T12:00:00Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===day;
}
export function shiftDay(day:string,offset:number){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
export function restoreStats(raw:string|null,legacy?:Saved['completion']):NativeStats {
 if(raw!==null){
  try{
   const s=JSON.parse(raw);
   if(s?.version===1&&s.days&&typeof s.days==='object'&&!Array.isArray(s.days)&&[0,1].includes(s.earlierFinishes)&&
    Object.entries(s.days).every(([day,n])=>validDay(day)&&Number.isSafeInteger(n)&&Number(n)>0&&Number(n)<1_000_000)&&
    (s.latest===null||(s.latest&&Number.isInteger(s.latest.firstTry)&&s.latest.firstTry>=0&&s.latest.firstTry<=5&&(s.latest.lessonId===undefined||['cafe','introductions'].includes(s.latest.lessonId))&&
      (s.latest.day===null?s.earlierFinishes===1:typeof s.latest.day==='string'&&validDay(s.latest.day)&&Object.hasOwn(s.days,s.latest.day)))))return s;
  }catch{/* Ignore malformed local storage. */}
 }
 const stats=emptyStats();
 // The old completion timestamp was refreshed on restore, so it cannot prove
 // a practice day. Preserve one known result without inventing streak history.
 if(legacy?.results?.length===5&&legacy.results.every(r=>typeof r==='boolean')){
  stats.earlierFinishes=1;stats.latest={day:null,firstTry:legacy.results.filter(Boolean).length};
 }
 return stats;
}
export function recordFinish(stats:NativeStats,results:boolean[],date:Date,lessonId?:string):NativeStats {
 const day=localDay(date);
 return {...stats,days:{...stats.days,[day]:(stats.days[day]??0)+1},latest:{day,firstTry:results.filter(Boolean).length,...(lessonId?{lessonId:lessonById(lessonId).id}:{})}};
}
export function statsSummary(stats:NativeStats,now:Date){
 const today=localDay(now),days=Object.keys(stats.days).filter(day=>day<=today).sort();
 let best=0,run=0,previous='';
 for(const day of days){run=previous&&shiftDay(previous,1)===day?run+1:1;best=Math.max(best,run);previous=day;}
 const last=days.at(-1);let current=0;
 if(last&&(last===today||last===shiftDay(today,-1))){
  for(let day=last;Object.hasOwn(stats.days,day);day=shiftDay(day,-1))current++;
 }
 return {current,best,practiceDays:days.length,finishes:stats.earlierFinishes+days.reduce((sum,day)=>sum+stats.days[day],0),
  week:Array.from({length:7},(_,i)=>{const day=shiftDay(today,i-6);return {day,finishes:stats.days[day]??0,today:day===today};})};
}
export function createStatsTracker(initial:NativeStats,save:(stats:NativeStats)=>void,now:()=>Date){
 let stats=initial;const recorded=new Set<string>();
 return {
  transition(previous:Progress,next:Progress,action:Action,lessonId='cafe'){
   if(action.type==='reset'){recorded.delete(lessonId);return;}
   if(action.type!=='continue'||recorded.has(lessonId)||previous.complete||!next.complete)return;
   recorded.add(lessonId);stats=recordFinish(stats,next.results,now(),lessonId);save(stats);
  },
  reset(){recorded.clear();stats=emptyStats();save(stats);},
 };
}
