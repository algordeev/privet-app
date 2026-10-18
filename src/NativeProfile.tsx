import {lessonById} from './lessons';
import type {NativeStatsController} from './useNativeStats';

export function ProfileIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>;}
export function StreakIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 3c1 5-4 6-3 10 1-1 2-2 2-4 4 2 6 5 5 8a6 6 0 0 1-11-4c0-4 4-6 7-10Z"/></svg>;}
function displayDate(day:string,options:Intl.DateTimeFormatOptions){return new Intl.DateTimeFormat('en',options).format(new Date(`${day}T12:00:00`));}
export function NativeProfile({activity,onClose}:{activity:NativeStatsController;onClose:()=>void}){
 const {stats,summary,persistent}=activity;
 return <div className="native-profile-scroll">
  <header className="native-profile-navigation"><button className="app-icon-button" onClick={onClose} aria-label="Back to home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1 id="native-profile-title" tabIndex={-1}>Profile</h1><span aria-hidden="true"/></header>
  <section className="native-profile-intro"><span className="native-profile-avatar"><ProfileIcon/></span><div><h2>Your learning</h2><p>Beginner Russian · At your pace</p></div></section>
  <dl className="native-stat-grid">
   <div className="native-stat-streak"><dt><StreakIcon/> Current streak</dt><dd><strong>{summary.current}</strong><span>{summary.current===1?'day':'days'}</span></dd></div>
   <div><dt>Best streak</dt><dd><strong>{summary.best}</strong><span>{summary.best===1?'day':'days'}</span></dd></div>
   <div><dt>Lesson finishes</dt><dd><strong>{summary.finishes}</strong></dd><p>Recorded, incl. replays</p></div>
   <div><dt>Practice days</dt><dd><strong>{summary.practiceDays}</strong></dd><p>With a lesson finished</p></div>
  </dl>
  <section className="native-profile-week" aria-labelledby="native-week-title"><h2 id="native-week-title">Your last seven days</h2><ol aria-label="Daily lesson finishes">{summary.week.map(day=><li key={day.day} className={`${day.finishes?'practised':''} ${day.today?'today':''}`} aria-label={`${displayDate(day.day,{weekday:'long',month:'short',day:'numeric'})}${day.today?', today':''}: ${day.finishes} ${day.finishes===1?'lesson finish':'lesson finishes'}`}><span aria-hidden="true">{displayDate(day.day,{weekday:'short'})}</span><i aria-hidden="true">{day.finishes?<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 10 3 3 7-7"/></svg>:new Date(`${day.day}T12:00:00`).getDate()}</i></li>)}</ol><p>A day counts when you finish a lesson. Replays count too.</p></section>
  <section className="native-profile-result" aria-labelledby="native-result-title"><div><span>LATEST RESULT</span><h2 id="native-result-title">{lessonById(stats.latest?.lessonId).title}</h2></div>{stats.latest?<><p className="native-profile-score"><strong>{stats.latest.firstTry}<span>/5</span></strong><span>steps completed<br/>on your first try</span></p><p>{stats.latest.day?displayDate(stats.latest.day,{month:'long',day:'numeric',year:'numeric'}):'Earlier result · Practice date not recorded'}</p></>:<p>Finish the lesson to see your first result here.</p>}</section>
  <footer className="native-profile-footer"><p>{persistent?'Your statistics stay on this iPhone. No account needed.':'Local saving is unavailable. These statistics last for this session.'}</p></footer>
 </div>;
}
