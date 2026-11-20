import {useState} from 'react';
import {Companion} from './Companion';
import {StreakIcon} from './NativeProfile';
import {GEM_RULES} from './gems';
import {localDay} from './days';
import {SubpageHeader} from './SubpageHeader';
import {firstMonth,milestones,monthWeeks,savedYesterday,todayStatus,weeklyBonusProgress,type TodayStatus} from './streak';
import type {NativeStatsController} from './useNativeStats';
import type {CompanionState} from './engine';
import './streakScreen.css';

const robot:Record<TodayStatus,{state:CompanionState;text:string}>={
 done:{state:'celebrating',text:'✦'},
 pending:{state:'thinking',text:'…'},
 broken:{state:'idle',text:''},
 none:{state:'idle',text:''},
};
const WEEKDAYS=['M','T','W','T','F','S','S'];
const monthName=(year:number,month:number)=>new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1)));
const days=(count:number)=>`${count} ${count===1?'day':'days'}`;
const snowflake=<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/></svg>;

// The streak: today's status with the companion, the next milestone, a month calendar, the records and freezes.
export function StreakScreen({activity,onClose,onGems,onPractice}:{activity:NativeStatsController;onClose:()=>void;onGems:()=>void;onPractice:()=>void}){
 const {stats,summary}=activity;
 const today=localDay(new Date());
 const status=todayStatus(stats,today,summary.current);
 const saved=status!=='broken'&&savedYesterday(stats,today);
 const bonus=weeklyBonusProgress(stats,today,summary.current);
 const [shown,setShown]=useState(()=>({year:Number(today.slice(0,4)),month:Number(today.slice(5,7))-1}));
 const earliest=firstMonth(stats,today);
 const atFirst=shown.year<earliest.year||(shown.year===earliest.year&&shown.month<=earliest.month);
 const atToday=shown.year===Number(today.slice(0,4))&&shown.month===Number(today.slice(5,7))-1;
 const move=(by:number)=>setShown(({year,month})=>{const index=year*12+month+by;return {year:Math.floor(index/12),month:index%12};});
 const line=status==='done'?'Today’s practice is done. See you tomorrow!'
  :status==='pending'?(saved?`A streak freeze saved yesterday. Practise today to keep your ${days(summary.current)}.`:`Practise today to keep your ${days(summary.current)}.`)
  :status==='broken'?`Your best was ${days(summary.best)}. Start a new streak today.`
  :'Finish a lesson to start your streak.';

 return <div className="native-profile-scroll native-streak-scroll">
  <SubpageHeader title="Streak" titleId="native-streak-title" backLabel="Back to home" onBack={onClose}/>

  <section className={`streak-hero is-${status}`}>
   <div className="streak-robot"><Companion state={robot[status].state} text={robot[status].text} small/></div>
   <div className="streak-count"><StreakIcon/><strong>{summary.current}</strong><span>{summary.current===1?'day':'days'} in a row</span></div>
   <p>{line}</p>
   {(status==='pending'||status==='broken'||status==='none')&&<button className="button teal streak-practice" onClick={onPractice}>{status==='pending'?'Practise now':'Start a lesson'} <span aria-hidden="true">→</span></button>}
  </section>

  <section className="streak-group">
   <h2>Next milestone</h2>
   <div className={`streak-card streak-bonus${bonus.earned?' is-earned':''}`}>
    <div className="streak-bonus-text">{bonus.earned
     ?<><strong>Weekly bonus earned today!</strong><small>{days(summary.current)} in a row. The next one comes in 7 days.</small></>
     :<><strong>{bonus.left===7?'A week in a row':`${days(bonus.left)} to go`}</strong><small>Every 7 days in a row earns +{bonus.gems} gems</small></>}</div>
    <b className="streak-gems">+{bonus.gems}<span aria-hidden="true">◆</span>{bonus.earned&&<small> earned</small>}</b>
    <div className="streak-bonus-bar" role="progressbar" aria-label="Days towards the weekly bonus" aria-valuemin={0} aria-valuemax={7} aria-valuenow={bonus.done}>{Array.from({length:7},(_,day)=><i key={day} className={day<bonus.done?'is-done':''}/>)}</div>
   </div>
   <ol className="streak-badges" aria-label="Streak badges">
    {milestones(summary.best,summary.current).map(badge=><li key={badge.days} className={badge.reached?'is-reached':badge.next?'is-next':''}>
     <span className="streak-badge-medal"><StreakIcon/><b>{badge.days}</b></span>
     <small>{badge.reached?'Reached':badge.next?`${badge.left} to go`:`${badge.days} days`}</small>
    </li>)}
   </ol>
  </section>

  <section className="streak-group">
   <div className="streak-month">
    <h2>{monthName(shown.year,shown.month)}</h2>
    <button className="app-icon-button" onClick={()=>move(-1)} disabled={atFirst} aria-label="Previous month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
    <button className="app-icon-button" onClick={()=>move(1)} disabled={atToday} aria-label="Next month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button>
   </div>
   <div className="streak-card streak-calendar">
    <div className="streak-weekdays" aria-hidden="true">{WEEKDAYS.map((letter,index)=><span key={index}>{letter}</span>)}</div>
    {monthWeeks(stats,shown.year,shown.month,today).map((week,row)=><div key={row} className="streak-week">
     {week.map((cell,column)=>cell?<span key={column} className={['streak-day',cell.practised&&'is-practised',cell.frozen&&'is-frozen',cell.today&&'is-today',cell.future&&'is-future',cell.start&&'is-start',cell.end&&'is-end'].filter(Boolean).join(' ')}
      aria-label={`${cell.day}${cell.practised?', practised':cell.frozen?', saved by a streak freeze':''}${cell.today?', today':''}`}>{cell.frozen?snowflake:cell.date}</span>:<span key={column} className="streak-day is-empty"/>)}
    </div>)}
    <div className="streak-legend" aria-hidden="true"><span><i className="is-practised"/>Practised</span><span><i className="is-frozen"/>Freeze</span><span><i className="is-today"/>Today</span></div>
   </div>
  </section>

  <section className="streak-group">
   <h2>Your records</h2>
   <dl className="streak-figures">
    <div><dt>Current</dt><dd>{summary.current}</dd></div>
    <div><dt>Best</dt><dd>{summary.best}</dd></div>
    <div><dt>Days practised</dt><dd>{summary.practiceDays}</dd></div>
   </dl>
  </section>

  <section className="streak-group">
   <h2>Streak freezes</h2>
   <div className="streak-card streak-freezes">
    <span className="streak-freeze-icon">{snowflake}</span>
    <div className="streak-freeze-text"><strong>{summary.freezes} of {GEM_RULES.maxFreezes} saved</strong><small>A freeze covers a missed day on its own</small>
     <span className="streak-slots" aria-hidden="true">{Array.from({length:GEM_RULES.maxFreezes},(_,slot)=><i key={slot} className={slot<summary.freezes?'is-full':''}/>)}</span></div>
    {summary.freezes<GEM_RULES.maxFreezes&&<button className="streak-link" onClick={onGems}>Get one</button>}
   </div>
  </section>
 </div>;
}
