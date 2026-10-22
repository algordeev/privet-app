import {NativeCompanionImages} from './NativeCompanionImages';
import {useState} from 'react';
import type {SubscriptionController} from './useSubscription';
import {PLUS_MONTHLY_PRICE,PLUS_YEARLY_PRICE} from './subscription';

export function PlusScreen({subscription,onClose}:{subscription:SubscriptionController;onClose:()=>void}){
 const {subscription:sub,plus,subscribe,cancel}=subscription;
 const [plan,setPlan]=useState<'monthly'|'yearly'>('monthly');
 return <div className="native-profile-scroll native-plus-scroll">
  <header className="native-profile-navigation"><button className="app-icon-button" onClick={onClose} aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1 id="native-plus-title" tabIndex={-1}>Privet Plus</h1><span aria-hidden="true"/></header>
  <section className="native-plus-intro"><span aria-hidden="true">∞</span><h2>Keep learning, your way.</h2><p>Unlimited hearts. Lessons never end early.</p></section>
  {plus?<section className="native-plus-card"><strong>Plus demo is active</strong><p>{sub.plan==='monthly'?'Monthly':'Yearly'} demo plan · Started {sub.since}</p><button className="button teal" onClick={cancel}>Cancel Plus</button></section>:<><section className="native-plus-plans" aria-label="Choose a demo plan"><button aria-pressed={plan==='monthly'} onClick={()=>setPlan('monthly')}><strong>Monthly</strong><span>{PLUS_MONTHLY_PRICE} / month · Concept pricing</span></button><button aria-pressed={plan==='yearly'} onClick={()=>setPlan('yearly')}><strong>Yearly</strong><span>{PLUS_YEARLY_PRICE} / year · Concept pricing</span></button></section><button className="button teal native-plus-start" onClick={()=>subscribe(plan)}>Activate Plus demo</button></>}
  <p className="native-plus-demo">Local demo only · No payment processing. Your selection is saved on this device.</p>
  <section aria-label="Optional physical companion"><h2 className="native-plus-companion-title">A companion for your desk.</h2><NativeCompanionImages/><p className="native-plus-demo">Optional physical companion concept · Not included with the Plus demo.</p></section>
 </div>;
}
