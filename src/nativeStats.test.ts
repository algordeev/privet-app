import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStats,localDay,validDay,shiftDay,resolveToday,restoreStats,recordFinish,statsSummary,createStatsTracker,spendGems,applyStreakFreezes,GEM_RULES,type NativeStats} from './nativeStats.ts';
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
test('a timezone change cannot read "today" earlier than the latest day already recorded',()=>{
 // Stands in for a device timezone change (travel, or crossing the date
 // line): the real clock has only moved forward since lastSeenAt, but the
 // device's local calendar now reads a day the tracker already has
 // recorded. Without the clamp this would double count 2026-10-17 under a
 // second, earlier key instead of folding into the existing day.
 const stats={...emptyStats(),days:{'2026-10-17':1},lastSeenAt:date(17).getTime()};
 assert.equal(resolveToday(stats,date(18)),'2026-10-18'); // ordinary forward day: unaffected.
 assert.equal(resolveToday({...stats,days:{'2026-10-18':1}},date(17)),'2026-10-18'); // clamped forward, not double-counted.
});
test('a timezone change cannot read "today" further ahead than real elapsed time justifies',()=>{
 // Stands in for the opposite direction: local calendar jumps forward by
 // several days in an instant (a timezone swing), while the real clock
 // (lastSeenAt, epoch ms) shows almost no time actually passed. Without the
 // cap this would skip the days in between as though they were missed.
 const stats={...emptyStats(),days:{'2026-10-10':1},lastSeenAt:date(16).getTime()-1000};
 assert.equal(resolveToday(stats,date(16)),'2026-10-11'); // capped to one day past the last known day.
 assert.equal(resolveToday({...stats,lastSeenAt:date(9).getTime()},date(16)),'2026-10-16'); // six real days did pass: trusted.
});
test('a backdated or replayed finish never moves the real-time anchor backward',()=>{
 // recordFinish always records lastSeenAt, but an out-of-order call (a
 // replay, or a loop filling in earlier history) must never regress it --
 // otherwise a later call could be wrongly clamped against a stale "latest"
 // day, as if the earlier call were the most recent one.
 let s=recordFinish(emptyStats(),results,date(17));
 s=recordFinish(s,results,date(10));
 assert.equal(s.lastSeenAt,date(17).getTime());
 assert.equal(resolveToday(s,date(12)),'2026-10-12'); // not wrongly clamped to 2026-10-17.
});
test('missing or malformed data starts empty',()=>{
 assert.deepEqual(restoreStats(null),emptyStats());
 for(const raw of ['not JSON','null','{}',JSON.stringify({...emptyStats(),days:{'2026-02-30':1}}),JSON.stringify({...emptyStats(),days:{'2026-10-17':-1}}),JSON.stringify({...emptyStats(),latest:{firstTry:6,day:null}})])assert.deepEqual(restoreStats(raw),emptyStats());
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

test('automatic freeze consumption and a later finish share the authoritative tracker snapshot',()=>{
 let initial=recordFinish(emptyStats(),results,date(15),'cafe');
 initial={...initial,gems:{...initial.gems,freezes:1,balance:60}};
 const snapshots:NativeStats[]=[];const tracker=createStatsTracker(initial,s=>snapshots.push(s),()=>date(17));
 // Same path used by midnight, pageshow and visibility callbacks in useNativeStats.
 tracker.update(current=>applyStreakFreezes(current,date(17)));
 assert.equal(snapshots.length,1);assert.equal(snapshots[0].gems.freezes,0);assert.deepEqual(snapshots[0].frozen,['2026-10-16']);
 const before={...initialProgress(),index:4,attempts:1,feedback:'correct' as const,results:results.slice(0,4)};
 tracker.transition(before,progressReducer(before,{type:'continue'}),{type:'continue'});
 const latest=snapshots.at(-1)!;
 assert.equal(latest.gems.freezes,0);assert.deepEqual(latest.frozen,['2026-10-16']);assert.equal(statsSummary(latest,date(17)).current,2);
 assert.equal(latest.gems.balance,65);assert.equal(latest.days['2026-10-17'],1);
 assert.deepEqual(restoreStats(JSON.stringify(latest)),latest);
 // Shop writes use that same snapshot, so subsequent purchases cannot resurrect a freeze either.
 assert.equal(tracker.update(current=>spendGems(current,GEM_RULES.refill)),true);
 assert.equal(snapshots.at(-1)!.gems.balance,45);assert.equal(snapshots.at(-1)!.gems.freezes,0);
});

test('completion protects a missed day even when the midnight lifecycle callback has not run yet',()=>{
 const initial={...recordFinish(emptyStats(),results,date(15)),gems:{...emptyStats().gems,freezes:1}};
 let saved=initial;const tracker=createStatsTracker(initial,value=>{saved=value;},()=>date(17));
 const before={...initialProgress(),index:4,attempts:1,feedback:'correct' as const,results:results.slice(0,4)};
 tracker.transition(before,progressReducer(before,{type:'continue'}),{type:'continue'});
 assert.equal(saved.gems.freezes,0);assert.deepEqual(saved.frozen,['2026-10-16']);assert.equal(statsSummary(saved,date(17)).current,2);
});

test('same-day replay retains cumulative daily rewards while latest attempt has only its own award',()=>{
 const perfect=Array(5).fill(true);
 let s=recordFinish(emptyStats(),perfect,date(17),'cafe',18);
 assert.deepEqual(s.latest?.gemAward,{finish:5,perfect:5,streakWeek:0});
 s=recordFinish(s,results,date(17),'introductions',15);
 const daily=s.gems.awards['2026-10-17'];
 s=recordFinish(s,perfect,date(17),'cafe',18);
 assert.deepEqual(s.gems.awards['2026-10-17'],daily);assert.equal(statsSummary(s,date(17)).todayGemAwards,15);
 assert.equal(s.gems.balance,15);assert.equal(s.days['2026-10-17'],3);assert.equal(s.xp['2026-10-17'],51);
 assert.deepEqual(s.latest?.gemAward,{finish:0,perfect:0,streakWeek:0});assert.equal(s.latest?.lessonId,'cafe');
 assert.deepEqual(restoreStats(JSON.stringify(s)),s);
 s=recordFinish(s,perfect,date(18),'cafe',18);
 assert.equal(s.gems.balance,25);assert.deepEqual(s.latest?.gemAward,{finish:5,perfect:5,streakWeek:0});
});

test('a later same-day perfect replay earns no second completion or perfect reward',()=>{
 let s=recordFinish(emptyStats(),results,date(17));s=recordFinish(s,Array(5).fill(true),date(17));
 assert.equal(s.gems.balance,5);assert.deepEqual(s.latest?.gemAward,{finish:0,perfect:0,streakWeek:0});
 assert.deepEqual(s.gems.awards['2026-10-17'].cafe,{finish:5,perfect:0,streakWeek:0});
});

test('weekly award survives replay and remains distinct from the latest zero award',()=>{
 let s=emptyStats();for(let day=11;day<=17;day++)s=recordFinish(s,results,date(day));
 const balance=s.gems.balance,awards=s.gems.awards['2026-10-17'].cafe;
 assert.equal(awards.streakWeek,10);assert.equal(statsSummary(s,date(17)).todayGemAwards,15);
 s=recordFinish(s,results,date(17));assert.equal(s.gems.balance,balance);assert.deepEqual(s.gems.awards['2026-10-17'].cafe,awards);
 assert.deepEqual(s.latest?.gemAward,{finish:0,perfect:0,streakWeek:0});assert.equal(s.gems.milestones.length,1);
});

test('existing v3 awards migrate without inventing a latest-attempt reward or changing earned balances',()=>{
 const s=recordFinish(emptyStats(),Array(5).fill(true),date(17));
 const old={...s,latest:{day:'2026-10-17',firstTry:5,lessonId:'cafe'}};
 const restored=restoreStats(JSON.stringify(old));assert.deepEqual(restored,old);assert.equal(restored.latest?.gemAward,undefined);
 const replay=recordFinish(restored,results,date(17));assert.equal(replay.gems.balance,10);assert.deepEqual(replay.gems.awards,old.gems.awards);
 assert.deepEqual(replay.latest?.gemAward,{finish:0,perfect:0,streakWeek:0});
 // Older buggy replays may already have erased a breakdown. Do not fabricate it or repay it.
 const erased={...old,gems:{...old.gems,awards:{'2026-10-17':{cafe:{finish:0,perfect:0,streakWeek:0}}}}};
 assert.deepEqual(restoreStats(JSON.stringify(erased)),erased);assert.equal(recordFinish(erased,results,date(17)).gems.balance,10);
 assert.deepEqual(restoreStats(JSON.stringify({...s,latest:{...s.latest,gemAward:{finish:500,perfect:0,streakWeek:0}}})),emptyStats());
});
test('a perfect 10-item review earns one combo XP per answer, without gems',()=>{
 const changes:NativeStats[]=[];const tracker=createStatsTracker(emptyStats(),s=>changes.push(s),()=>date(17));
 const done={...initialProgress(),index:10,results:Array(10).fill(true),complete:true,combo:10,bestCombo:10};
 tracker.transition({...done,complete:false,index:9},done,{type:'continue'},'review:2026-10-17');
 assert.equal(changes.at(-1)?.xp[localDay(date(17))],23);assert.equal(changes.at(-1)?.gems.balance,0);
});
