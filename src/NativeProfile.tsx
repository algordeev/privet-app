import {lessonById} from './lessons';
import {CountedNumber} from './FirstRunArt';
import type {NativeStatsController} from './useNativeStats';
import type {SubscriptionController} from './useSubscription';

export function ProfileIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>;}
export function StreakIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 3c1 5-4 6-3 10 1-1 2-2 2-4 4 2 6 5 5 8a6 6 0 0 1-11-4c0-4 4-6 7-10Z"/></svg>;}
function displayDate(day:string,options:Intl.DateTimeFormatOptions){return new Intl.DateTimeFormat('en',options).format(new Date(`${day}T12:00:00`));}
export function NativeProfile({activity,subscription,onPlus,onClose}:{activity:NativeStatsController;subscription:SubscriptionController;onPlus:()=>void;onClose:()=>void}){
 const {stats,summary,persistent}=activity;
 return <div className="native-profile-scroll">
  <header className="native-profile-navigation"><button className="app-icon-button" onClick={onClose} aria-label="Back to home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1 id="native-profile-title" tabIndex={-1}>Profile</h1><span aria-hidden="true"/></header>
  <section className="native-profile-intro"><span className={`native-profile-avatar ${subscription.plus?'is-plus':''}`} role={subscription.plus?'img':undefined} aria-label={subscription.plus?'Profile · Plus demo active':undefined}><ProfileIcon/>{subscription.plus&&<span className="native-profile-plus-tag" aria-hidden="true">PLUS</span>}</span><div><h2>Your learning</h2><p>Beginner Russian · At your pace</p></div></section>
  <section className="native-profile-plus"><div><strong>Privet Plus</strong><p>{subscription.plus?'Local Plus demo · Unlimited hearts are active.':'Local demo · Unlimited hearts, no payments.'}</p></div><button id="native-profile-plus-open" className="button teal" onClick={onPlus}>{subscription.plus?'Manage Plus':'Get Plus'}</button></section>
  <section className="native-profile-gems"><div><strong>◆ {summary.gems} gems</strong><p>Earned by finishing lessons</p></div><div><strong>{summary.freezes}/{2} streak freezes</strong><p>Held for a missed day</p></div></section>
  <dl className="native-stat-grid">
   <div className="native-stat-streak"><dt><StreakIcon/> Current streak</dt><dd><strong><CountedNumber value={summary.current} delay={300}/></strong><span>{summary.current===1?'day':'days'}</span></dd></div>
   <div><dt>Best streak</dt><dd><strong><CountedNumber value={summary.best} delay={300}/></strong><span>{summary.best===1?'day':'days'}</span></dd></div>
   <div><dt>Lesson finishes</dt><dd><strong><CountedNumber value={summary.finishes} delay={350}/></strong></dd><p>Recorded, incl. replays</p></div>
   <div className="native-stat-xp"><dt>Today XP</dt><dd><strong><CountedNumber value={summary.todayXp} delay={350}/></strong></dd><p>Earned today</p></div>
   <div className="native-stat-xp"><dt>Total XP</dt><dd><strong><CountedNumber value={summary.totalXp} delay={400}/></strong></dd><p>Recorded locally</p></div>
  </dl>
  <section className="native-profile-week" aria-labelledby="native-week-title"><h2 id="native-week-title">Your last seven days</h2><ol aria-label="Daily lesson finishes">{summary.week.map(day=><li key={day.day} className={`${day.finishes?'practised':''} ${day.today?'today':''}`} aria-label={`${displayDate(day.day,{weekday:'long',month:'short',day:'numeric'})}${day.today?', today':''}: ${day.finishes} ${day.finishes===1?'lesson finish':'lesson finishes'}, ${day.xp} XP`}><span aria-hidden="true">{displayDate(day.day,{weekday:'short'})}</span><i aria-hidden="true">{day.finishes?<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 10 3 3 7-7"/></svg>:new Date(`${day.day}T12:00:00`).getDate()}</i><small>{day.xp} XP</small></li>)}</ol></section>
  <section className="native-profile-result" aria-labelledby="native-result-title"><div><span>LATEST ATTEMPT</span><h2 id="native-result-title">{lessonById(stats.latest?.lessonId).title}</h2></div>{stats.latest?<><p className="native-profile-score"><strong>{stats.latest.firstTry}<span>/{lessonById(stats.latest?.lessonId).exercises.length}</span></strong><span>Correct on first<br/>submission</span></p><p>{stats.latest.day?displayDate(stats.latest.day,{month:'long',day:'numeric',year:'numeric'}):'Earlier result · Practice date not recorded'}</p></>:<p>Finish the lesson to see your first result here.</p>}</section>
  <footer className="native-profile-footer"><p>{persistent?'Your statistics stay on this iPhone. No account needed.':'Local saving is unavailable. These statistics last for this session.'}</p></footer>
 </div>;
}
