import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStats,type NativeStats} from './nativeStats.ts';
import {firstMonth,milestones,monthWeeks,savedYesterday,todayStatus,weeklyBonusProgress} from './streak.ts';

const d=(n:number)=>`2026-10-${String(n).padStart(2,'0')}`;
const withDays=(practised:number[],frozen:number[]=[],milestoneDays:number[]=[]):NativeStats=>({...emptyStats(),days:Object.fromEntries(practised.map(n=>[d(n),1])),frozen:frozen.map(d),gems:{...emptyStats().gems,milestones:milestoneDays.map(d)}});
const today=d(17);

test('today is done once practised, pending while a streak is alive, broken after one ended, none before any practice',()=>{
 assert.equal(todayStatus(withDays([16,17]),today,2),'done');
 assert.equal(todayStatus(withDays([15,16]),today,2),'pending');
 assert.equal(todayStatus(withDays([1,2]),today,0),'broken');
 assert.equal(todayStatus(withDays([]),today,0),'none');
 assert.equal(todayStatus(withDays([20]),today,0),'none','a day that has not come yet does not count');
});

test('the page knows when a streak freeze saved yesterday',()=>{
 assert.equal(savedYesterday(withDays([15],[16]),today),true);
 assert.equal(savedYesterday(withDays([15,16]),today),false);
});

test('the weekly bonus counts down the days to the next multiple of seven, and shows the full week on the day it is earned',()=>{
 assert.deepEqual(weeklyBonusProgress(withDays([]),today,0),{earned:false,left:7,done:0,gems:10});
 assert.deepEqual(weeklyBonusProgress(withDays([]),today,5),{earned:false,left:2,done:5,gems:10});
 assert.deepEqual(weeklyBonusProgress(withDays([]),today,8),{earned:false,left:6,done:1,gems:10});
 assert.deepEqual(weeklyBonusProgress(withDays([],[],[17]),today,7),{earned:true,left:0,done:7,gems:10});
 assert.equal(weeklyBonusProgress(withDays([],[],[10]),today,7).earned,false,'only today’s bonus counts as earned today');
});

test('badges light up from the best streak; the next one counts down from the current streak',()=>{
 assert.deepEqual(milestones(8,3),[{days:7,reached:true,next:false,left:4},{days:30,reached:false,next:true,left:27},{days:100,reached:false,next:false,left:97},{days:365,reached:false,next:false,left:362}]);
 assert.equal(milestones(6,0)[0].left,7,'a broken streak starts the countdown again');
 assert.equal(milestones(400,400).every(badge=>badge.reached&&!badge.next),true);
});

test('the month is laid out in Monday weeks, and practised or frozen days in a row join into one band',()=>{
 // October 2026 starts on a Thursday.
 const weeks=monthWeeks(withDays([1,2,3,9,10,11,12,14,15,16,17],[13]),2026,9,today);
 assert.equal(weeks.length,5);
 assert.deepEqual(weeks[0].slice(0,4).map(cell=>cell?.date??null),[null,null,null,1]);
 const byDate=new Map(weeks.flat().filter(cell=>cell!==null).map(cell=>[cell!.date,cell!]));
 const band=(n:number)=>{const c=byDate.get(n)!;return `${c.start?'[':''}${c.practised?'p':c.frozen?'f':'-'}${c.end?']':''}`;};
 assert.deepEqual([1,2,3,4].map(band),['[p','p','p]','-'],'a run ends before an empty day');
 assert.deepEqual([9,10,11].map(band),['[p','p','p]'],'a band breaks at the end of the week row');
 assert.deepEqual([12,13,14,17].map(band),['[p','f','p','p]'],'a frozen day joins the band; today ends it');
 assert.equal(byDate.get(17)!.today,true);assert.equal(byDate.get(18)!.future,true);
});

test('the calendar pages back no further than the first month with practice',()=>{
 assert.deepEqual(firstMonth(withDays([]),today),{year:2026,month:9});
 assert.deepEqual(firstMonth({...withDays([]),days:{'2026-08-30':1}},today),{year:2026,month:7});
});
