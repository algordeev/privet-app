import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStats,localDay,validDay,shiftDay,restoreStats,recordFinish,statsSummary,createStatsTracker,type NativeStats} from './nativeStats.ts';
import {initialProgress,progressReducer} from './engine.ts';
const date=(day:number)=>new Date(2026,9,day,12);
const results=[true,false,true,true,true];

test('empty profile has truthful zero counts and seven calendar days',()=>{
 const s=statsSummary(emptyStats(),date(17));assert.deepEqual([s.current,s.best,s.finishes,s.practiceDays],[0,0,0,0]);
 assert.equal(s.week.length,7);assert.equal(s.week[0].day,'2026-10-11');assert.equal(s.week[6].today,true);assert.equal(s.week[6].day,'2026-10-17');
});
test('same-day replays count finishes once each but earn only one practice day',()=>{
 const s=recordFinish(recordFinish(emptyStats(),results,date(17)),results,date(17));
 const summary=statsSummary(s,date(17));assert.equal(summary.current,1);assert.equal(summary.practiceDays,1);assert.equal(summary.finishes,2);assert.equal(s.latest?.firstTry,4);
});
test('streak allows today or yesterday, resets after a gap, and retains the best',()=>{
 let s=emptyStats();for(const day of [14,15,16])s=recordFinish(s,results,date(day));
 assert.equal(statsSummary(s,date(16)).current,3);assert.equal(statsSummary(s,date(17)).current,3);assert.equal(statsSummary(s,date(18)).current,0);assert.equal(statsSummary(s,date(18)).best,3);
 s=recordFinish(s,results,date(18));assert.equal(statsSummary(s,date(18)).current,1);assert.equal(statsSummary(s,date(18)).best,3);assert.equal(statsSummary(s,date(18)).practiceDays,4);
});
test('uses local completion dates and calendar arithmetic across month/leap/DST boundaries',()=>{
 assert.equal(localDay(new Date(2026,9,17,23,59)),'2026-10-17');
 assert.equal(shiftDay('2024-02-28',1),'2024-02-29');assert.equal(shiftDay('2024-02-29',1),'2024-03-01');assert.equal(shiftDay('2026-03-29',1),'2026-03-30');assert.equal(shiftDay('2026-01-01',-1),'2025-12-31');
 assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('invalid'),false);assert.equal(validDay('2024-02-29'),true);
});
test('legacy result is preserved without inventing dated activity or a streak',()=>{
 const s=restoreStats(null,{results,date:date(17).toISOString()});assert.equal(s.earlierFinishes,1);assert.equal(s.latest?.day,null);assert.equal(s.latest?.firstTry,4);
 const summary=statsSummary(s,date(17));assert.equal(summary.finishes,1);assert.equal(summary.current,0);assert.equal(summary.practiceDays,0);
 assert.deepEqual(restoreStats(JSON.stringify(s),{results,date:'changed'}),s);
});
test('malformed data is rejected, and a reset snapshot never reimports the legacy result',()=>{
 for(const raw of ['not JSON','null','{}',JSON.stringify({...emptyStats(),days:{'2026-02-30':1}}),JSON.stringify({...emptyStats(),days:{'2026-10-17':-1}}),JSON.stringify({...emptyStats(),latest:{firstTry:6,day:null}})])assert.deepEqual(restoreStats(raw),emptyStats());
 assert.deepEqual(restoreStats(JSON.stringify(emptyStats()),{results,date:date(17).toISOString()}),emptyStats());
});
test('only a new completed lesson is recorded; rerenders, duplicate continue and restored results do not count',()=>{
 const changes:NativeStats[]=[];const tracker=createStatsTracker(emptyStats(),s=>changes.push(s),()=>date(17));
 const before={...initialProgress(),index:4,attempts:1,feedback:'correct' as const,results:results.slice(0,4)};
 const after=progressReducer(before,{type:'continue'});
 tracker.transition(before,before,{type:'check',value:'спасибо'});assert.equal(changes.length,0);
 tracker.transition(before,after,{type:'continue'});tracker.transition(before,after,{type:'continue'});tracker.transition(after,after,{type:'continue'});
 assert.equal(changes.length,1);assert.equal(statsSummary(changes[0],date(17)).finishes,1);
 tracker.transition(after,initialProgress(),{type:'reset'});tracker.transition(before,after,{type:'continue'});assert.equal(statsSummary(changes.at(-1)!,date(17)).finishes,2);
 tracker.reset();assert.deepEqual(changes.at(-1),emptyStats());
});
test('future dated records do not create a current streak or mark future days as practised',()=>{
 const s=recordFinish(emptyStats(),results,date(19));const summary=statsSummary(s,date(17));assert.equal(summary.current,0);assert.equal(summary.practiceDays,0);assert.equal(summary.week.some(d=>d.finishes>0),false);
});
