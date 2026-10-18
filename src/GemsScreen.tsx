import {GEM_RULES} from './nativeStats';
import type {NativeStatsController} from './useNativeStats';

export function GemsScreen({activity,onClose}:{activity:NativeStatsController;onClose:()=>void}){
 const {summary,buyFreeze}=activity;
 return <div className="native-profile-scroll native-gems-scroll">
  <header className="native-profile-navigation"><button className="app-icon-button" onClick={onClose} aria-label="Back to home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1 id="native-gems-title" tabIndex={-1}>Gems</h1><span aria-hidden="true"/></header>
  <section className="native-gems-balance"><span aria-hidden="true">◆</span><strong>{summary.gems}</strong><p>Gems earned by learning</p></section>
  <section className="native-gems-section"><h2>How to earn</h2><ul><li>+{GEM_RULES.finish} for finishing a lesson, once per lesson each day</li><li>+{GEM_RULES.perfect} when your first finish of that lesson that day gets every step right on the first try</li><li>+{GEM_RULES.streakWeek} when your streak reaches each multiple of 7 days</li></ul></section>
  <section className="native-gems-section"><h2>Shop</h2><article className="native-gem-shop-card"><div><strong>Streak freeze</strong><p>{GEM_RULES.freeze} gems · You have {summary.freezes}/{GEM_RULES.maxFreezes}</p></div><button className="button teal" disabled={summary.gems<GEM_RULES.freeze||summary.freezes>=GEM_RULES.maxFreezes} onClick={buyFreeze}>Get freeze</button></article><p>Refill hearts for {GEM_RULES.refill} gems on the Out of hearts screen.</p></section>
  <footer className="native-gems-footer">Gems can’t be bought. No ads. Heart refill: 20 gems. Streak freeze: 30 gems.</footer>
 </div>;
}
