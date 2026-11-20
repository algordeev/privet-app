import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStreakFreezes,buyFreeze,createStatsTracker,emptyStats,GEM_RULES,recordFinish,restoreStats,spendGems,statsSummary,validDay,type NativeStats} from './nativeStats.ts';
import {initialProgress,progressReducer} from './engine.ts';

const on=(day:number)=>new Date(2026,10,day,12);           // November 2026, local noon
const key=(day:number)=>`2026-11-${String(day).padStart(2,'0')}`;
const perfect=[true,true,true,true,true],mixed=[true,false,true,true,true];
const withGems=(balance:number,freezes=0):NativeStats=>({...emptyStats(),gems:{...emptyStats().gems,balance,freezes}});
const finishEachDay=(from:number,to:number,stats=emptyStats(),results=perfect)=>{for(let day=from;day<=to;day++)stats=recordFinish(stats,results,on(day),'cafe');return stats;};

test('the gem rules are fixed',()=>{
 assert.deepEqual({...GEM_RULES},{finish:5,perfect:5,streakWeek:10,refill:20,freeze:30,maxFreezes:2});
});

test('finishing earns 5 once per lesson each day, plus 5 when that first finish is all first tries',()=>{
 let s=recordFinish(emptyStats(),perfect,on(20),'cafe');
 assert.equal(s.gems.balance,10);assert.deepEqual(s.latest?.gemAward,{finish:5,perfect:5,streakWeek:0});
 s=recordFinish(s,perfect,on(20),'cafe');
 assert.equal(s.gems.balance,10,'a replay the same day earns nothing');assert.deepEqual(s.latest?.gemAward,{finish:0,perfect:0,streakWeek:0});
 assert.deepEqual(s.gems.awards[key(20)].cafe,{finish:5,perfect:5,streakWeek:0},'the day keeps the earned total');
 s=recordFinish(s,mixed,on(20),'introductions');
 assert.equal(s.gems.balance,15,'another lesson earns its finish, not the perfect bonus');assert.deepEqual(s.gems.awarded[key(20)],['cafe','introductions']);
 s=recordFinish(s,mixed,on(21),'cafe');
 assert.equal(s.gems.balance,20,'the next day the lesson earns again');
});

test('a full week of streak earns 10 on the 7th day, once that day, and again after 14 days',()=>{
 let s=finishEachDay(1,6);
 assert.equal(s.gems.milestones.length,0);
 s=finishEachDay(7,7,s);
 assert.equal(s.latest?.gemAward?.streakWeek,10);assert.deepEqual(s.gems.milestones,[key(7)]);
 const balance=s.gems.balance;
 s=recordFinish(s,perfect,on(7),'introductions');
 assert.equal(s.latest?.gemAward?.streakWeek,0,'only once that day');assert.equal(s.gems.balance,balance+5+5);
 s=finishEachDay(8,14,s);
 assert.deepEqual(s.gems.milestones,[key(7),key(14)]);
});

test('spending needs a whole, non-negative amount the balance covers; nothing changes otherwise',()=>{
 const s=withGems(25);
 for(const amount of [26,-1,2.5,Number.NaN])assert.equal(spendGems(s,amount),null,String(amount));
 assert.equal(spendGems(s,20)?.gems.balance,5);
 assert.equal(spendGems(s,25)?.gems.balance,0);
 assert.equal(s.gems.balance,25,'the original is untouched');
});

test('a streak freeze costs 30 and at most two can be held',()=>{
 assert.equal(buyFreeze(withGems(29)),null);
 const one=buyFreeze(withGems(70))!;assert.deepEqual([one.gems.balance,one.gems.freezes],[40,1]);
 const two=buyFreeze(one)!;assert.deepEqual([two.gems.balance,two.gems.freezes],[10,2]);
 assert.equal(buyFreeze({...two,gems:{...two.gems,balance:100}}),null,'two already held');
});

test('freezes cover missed days that would break the streak, which is kept but not lengthened',()=>{
 let s=finishEachDay(14,15);s={...s,gems:{...s.gems,freezes:2}};
 const one=applyStreakFreezes(s,on(17));
 assert.deepEqual(one.frozen,[key(16)]);assert.equal(one.gems.freezes,1);
 assert.deepEqual([statsSummary(one,on(17)).current,statsSummary(one,on(17)).best],[2,2]);
 const two=applyStreakFreezes(s,on(18));
 assert.deepEqual(two.frozen,[key(16),key(17)]);assert.equal(two.gems.freezes,0);
 const later=recordFinish(one,perfect,on(17),'cafe');
 assert.equal(statsSummary(later,on(17)).current,3,'practising after a frozen day continues the streak');
});

test('freezes are kept when they could not save the streak, or when nothing was missed',()=>{
 let s=finishEachDay(10,10);s={...s,gems:{...s.gems,freezes:2}};
 assert.equal(applyStreakFreezes(s,on(17)),s,'six missed days, two freezes: keep them');
 const fresh=finishEachDay(16,16,withGems(0,1));
 assert.equal(applyStreakFreezes(fresh,on(17)),fresh,'yesterday was practised');
 const covered=applyStreakFreezes(finishEachDay(14,14,withGems(0,2)),on(16));
 assert.equal(applyStreakFreezes(covered,on(16)),covered,'an already frozen day is not frozen twice');
});

test('the streak counts practised days in the latest unbroken run, if it reached today or yesterday',()=>{
 const s=finishEachDay(10,12,finishEachDay(3,4));
 assert.deepEqual([statsSummary(s,on(12)).current,statsSummary(s,on(12)).best],[3,3]);
 assert.equal(statsSummary(s,on(13)).current,3,'yesterday still counts');
 assert.equal(statsSummary(s,on(14)).current,0,'a missed day ends it');
 assert.equal(statsSummary(s,on(14)).best,3,'the best stays');
});

test('XP adds up per day and in total, ignoring days that have not come yet',()=>{
 let s=recordFinish(emptyStats(),perfect,on(19),'cafe',16);
 s=recordFinish(s,perfect,on(20),'cafe',12);s=recordFinish(s,mixed,on(20),'introductions',11);
 s=recordFinish(s,perfect,on(22),'cafe',30);
 const summary=statsSummary(s,on(20));
 assert.equal(summary.todayXp,23);assert.equal(summary.totalXp,39);
 assert.deepEqual(summary.week.slice(-2).map(day=>day.xp),[16,23]);
 assert.equal(summary.todayGemAwards,15,'today: cafe 5+5, introductions 5');
});

test('a failed attempt is never recorded as a finish, XP or gems',()=>{
 const saved:NativeStats[]=[];const tracker=createStatsTracker(emptyStats(),s=>saved.push(s),()=>on(20));
 let p={...initialProgress(),index:1,hearts:1};
 const failed=progressReducer(p,{type:'check',value:'not it'});
 tracker.transition(p,failed,{type:'check',value:'not it'});
 tracker.transition(failed,progressReducer(failed,{type:'continue'}),{type:'continue'});
 assert.equal(saved.length,0);
});

test('current statistics come back unchanged; statistics from older versions start empty',()=>{
 const three=finishEachDay(15,16);
 assert.deepEqual(restoreStats(JSON.stringify(three)),three);
 const v1={version:1,days:{[key(16)]:2},earlierFinishes:0,latest:{day:key(16),firstTry:4,lessonId:'cafe'}};
 for(const old of [v1,{...v1,version:2,xp:{[key(16)]:12}}])assert.deepEqual(restoreStats(JSON.stringify(old)),emptyStats(),`version ${old.version}`);
});

test('damaged statistics start empty',()=>{
 for(const raw of [null,'garbage','{}',JSON.stringify({version:4}),JSON.stringify({version:1,days:{[key(16)]:0},earlierFinishes:0,latest:null}),JSON.stringify({version:2,days:{},xp:{'2026-02-30':5},earlierFinishes:0,latest:null})])
  assert.deepEqual(restoreStats(raw),emptyStats(),String(raw));
});

test('day keys must be real calendar days',()=>{
 for(const day of ['2026-11-20','2028-02-29'])assert.equal(validDay(day),true,day);
 for(const day of ['2026-02-29','2026-13-01','2026-11-31','20-11-2026','2026-1-5',''])assert.equal(validDay(day),false,day);
});
