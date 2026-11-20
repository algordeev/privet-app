import type {ReactNode} from 'react';
import {GEM_RULES} from './gems';
import {CountedNumber} from './CountedNumber';
import {SubpageHeader} from './SubpageHeader';
import type {NativeStatsController} from './useNativeStats';
import './gemsScreen.css';

const icon=(paths:ReactNode)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>;
const icons={
 lesson:icon(<><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5-.7 1.5-1.5z"/></>),
 perfect:icon(<path d="m12 3.5 2.6 5.5 5.9.6-4.5 4 1.3 5.9-5.3-3-5.3 3 1.3-5.9-4.5-4 5.9-.6z"/>),
 streak:icon(<path d="M12 3c1 3.2 4.5 5 4.5 9.2a4.5 4.5 0 0 1-9 .2c0-1.9 1-3.3 2-4.2.2 1.6 1 2.6 2 3 .4-2.6-.3-5.3.5-8.2z"/>),
 freeze:icon(<><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/></>),
 heart:icon(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>),
};

// A small gem used next to prices; the large one in the balance card has facets and a shine.
const gemGlyph=<svg className="gems-glyph" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1.5h5L11 4.5 6 10.8 1 4.5z"/></svg>;
function BigGem(){
 return <svg className="gems-big" viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="gems-big-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe08a"/><stop offset="1" stopColor="#e3a62b"/></linearGradient></defs>
  <path d="M19 8h26l13 15-26 34L6 23z" fill="url(#gems-big-fill)"/>
  <path d="M6 23h52M19 8l7 15 6 34 6-34 7-15M26 23l6-15 6 15" fill="none" stroke="#fff6d6" strokeWidth="1.6" strokeLinejoin="round" opacity=".75"/>
  <path d="M21 12l-6 9" stroke="#fffbe9" strokeWidth="2.4" strokeLinecap="round"/>
 </svg>;
}

const earning=[
 {id:'lesson',title:'Finish a lesson',detail:'Once per lesson each day',amount:GEM_RULES.finish},
 {id:'perfect',title:'All right on the first try',detail:'On that lesson’s first finish of the day',amount:GEM_RULES.perfect},
 {id:'streak',title:'Keep your streak a full week',detail:'Every 7 days in a row',amount:GEM_RULES.streakWeek},
] as const;

// Gems: what you have, how they are earned, and what they buy.
export function GemsScreen({activity,onClose}:{activity:NativeStatsController;onClose:()=>void}){
 const {summary,buyFreeze}=activity;
 const freezesFull=summary.freezes>=GEM_RULES.maxFreezes,canBuyFreeze=!freezesFull&&summary.gems>=GEM_RULES.freeze;
 const goal=freezesFull?`Both freezes saved for missed days`:canBuyFreeze?'Enough for a streak freeze':`${GEM_RULES.freeze-summary.gems} more for a streak freeze`;
 const goalProgress=freezesFull?1:Math.min(1,summary.gems/GEM_RULES.freeze);
 return <div className="native-profile-scroll native-gems-scroll">
  <SubpageHeader title="Gems" titleId="native-gems-title" backLabel="Back to home" onBack={onClose}/>

  <section className="gems-balance">
   <span key={summary.gems} className="native-gems-icon"><BigGem/></span>
   <strong><CountedNumber value={summary.gems} delay={150}/></strong>
   <p>gems earned by learning</p>
   {summary.todayGemAwards>0&&<span className="gems-today">+{summary.todayGemAwards} today</span>}
   <div className="gems-goal">
    <div className="gems-goal-bar" aria-hidden="true"><i style={{width:`${Math.round(goalProgress*100)}%`}}/></div>
    <span>{goal}</span>
   </div>
  </section>

  <section className="gems-group">
   <h2>How to earn</h2>
   <ul className="gems-list">
    {earning.map(way=><li key={way.id} className={`gems-row is-${way.id}`}>
     <span className="gems-row-icon">{icons[way.id]}</span>
     <span className="gems-row-text"><strong>{way.title}</strong><small>{way.detail}</small></span>
     <b className="gems-amount">+{way.amount}{gemGlyph}</b>
    </li>)}
   </ul>
  </section>

  <section className="gems-group">
   <h2>Spend</h2>
   <article className="native-gem-shop-card gems-row is-freeze">
    <span className="gems-row-icon">{icons.freeze}</span>
    <span className="gems-row-text">
     <strong>Streak freeze</strong>
     <small>Covers one missed day</small>
     <span className="gems-slots" aria-label={`${summary.freezes} of ${GEM_RULES.maxFreezes} freezes saved`}>
      {Array.from({length:GEM_RULES.maxFreezes},(_,index)=><i key={index} className={index<summary.freezes?'is-full':''}/>)}
     </span>
    </span>
    <button className="gems-buy" disabled={!canBuyFreeze} onClick={buyFreeze} aria-label={`Get a streak freeze for ${GEM_RULES.freeze} gems`}>
     Get<span className="gems-buy-dot" aria-hidden="true">·</span>{GEM_RULES.freeze}{gemGlyph}
    </button>
   </article>
   <article className="gems-row is-heart">
    <span className="gems-row-icon">{icons.heart}</span>
    <span className="gems-row-text"><strong>Heart refill</strong><small>Offered when a lesson runs out of hearts</small></span>
    <b className="gems-amount">{GEM_RULES.refill}{gemGlyph}</b>
   </article>
  </section>

  <p className="gems-footer">Gems can’t be bought · No ads · Prices never change</p>
 </div>;
}
