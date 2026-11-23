import {useEffect,useState} from 'react';
import {LEGAL} from './config';
import type {SubscriptionController} from './useSubscription';
import {introText,monthlyEquivalent,perPeriod,PLUS_PRODUCTS,type PlusPlan} from './store';
import {SubpageHeader} from './SubpageHeader';
import {nativeLessons} from './curriculum/catalog';
import './plusScreen.css';
// Counted, so a new lesson in an update keeps the perk true.
export const LESSONS_PERK=`All ${nativeLessons.length} lessons, and every new one`;

const PLANS:readonly {id:PlusPlan;name:string;short:string;badge?:string}[]=[
 {id:'yearly',name:'Yearly',short:'year',badge:'Best value'},
 {id:'monthly',name:'Monthly',short:'month'},
];
const dateText=(iso:string)=>new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});

// What Plus gives, the two plans with App Store prices, the buy button and the renewal terms Apple asks for.
export function PlusOffer({subscription,onPurchased}:{subscription:SubscriptionController;onPurchased?:()=>void}){
 const {products,productsState,busy,purchase,retryProducts}=subscription;
 const [choice,setChoice]=useState<PlusPlan>('yearly');
 const product=(plan:PlusPlan)=>products.find(item=>item.id===PLUS_PRODUCTS[plan]);
 const chosen=product(choice);
 const intro=chosen?introText(chosen):null;
 const ready=productsState==='ready'&&!!chosen;
 async function buy(){if(ready&&!busy&&await purchase(choice)==='purchased')onPurchased?.();}
 return <div className="plus-offer">
  <ul className="plus-perks"><li>{LESSONS_PERK}</li><li>Unlimited hearts</li></ul>
  <div className="plus-plans" role="radiogroup" aria-label="Choose a plan">
   {PLANS.map(plan=>{
    const item=product(plan.id),perMonth=item?monthlyEquivalent(item):null;
    return <button key={plan.id} role="radio" aria-checked={choice===plan.id} onClick={()=>setChoice(plan.id)}>
     <span className="plus-plan-name">{plan.name}{plan.badge&&<b>{plan.badge}</b>}</span>
     <strong>{item?`${item.displayPrice} ${perPeriod(item.period)}`:'…'}</strong>
     {perMonth&&<small>{perMonth} / month</small>}
    </button>;
   })}
  </div>
  {productsState==='failed'
   ?<div className="plus-note" role="status"><p>Prices couldn’t load. Check your connection and try again.</p><button className="native-text-button" onClick={retryProducts}>Try again</button></div>
   :<>
    {intro&&<p className="plus-intro">{intro}</p>}
    <button className="button teal plus-buy" disabled={!ready||!!busy} onClick={buy}>{busy==='purchase'?'Opening the App Store…':!ready?'Loading prices…':intro&&chosen?.introOffer?.paymentMode==='freeTrial'?'Start free trial':`Continue · ${chosen!.displayPrice}/${PLANS.find(plan=>plan.id===choice)!.short}`}</button>
   </>}
  <p className="plus-terms">Renews automatically until cancelled. Cancel anytime in Settings.</p>
 </div>;
}

// Restore and the two documents every paywall links to.
export function PlusLegal({subscription,restore=true}:{subscription:SubscriptionController;restore?:boolean}){
 return <p className="plus-legal">
  {restore&&<><button className="native-text-button" disabled={!!subscription.busy} onClick={subscription.restore}>{subscription.busy==='restore'?'Restoring…':'Restore purchases'}</button><span aria-hidden="true"> · </span></>}
  <a href={LEGAL.terms} target="_blank" rel="noopener noreferrer">Terms of Use</a><span aria-hidden="true"> · </span>
  <a href={LEGAL.privacy} target="_blank" rel="noopener noreferrer">Privacy Policy</a>
 </p>;
}

export function PlusMessage({subscription}:{subscription:SubscriptionController}){
 return subscription.message?<p className="plus-message" role="status">{subscription.message}</p>:null;
}

// The active plan: when it renews (or ends) and Apple's screen to change it.
export function PlusActive({subscription}:{subscription:SubscriptionController}){
 const {entitlement,plan,demo,manage}=subscription;
 const name=PLANS.find(item=>item.id===plan)?.name;
 const until=entitlement?.expirationDate?dateText(entitlement.expirationDate):null;
 // A cancelled plan stays on until the end of what was paid for, as Apple does it.
 const cancelled=entitlement?.willAutoRenew===false;
 return <section className="native-plus-card">
  <strong>{cancelled?'Plus is cancelled':'Plus is active'}</strong>
  {cancelled&&until?<p>{name?`${name} · `:''}Everything stays open until {until}.</p>:(name||until)&&<p>{[name,until&&`Renews ${until}`].filter(Boolean).join(' · ')}</p>}
  <button className="button teal" onClick={manage}>{demo?'Cancel Plus demo':'Manage subscription'}</button>
 </section>;
}

export function PlusScreen({subscription,onClose}:{subscription:SubscriptionController;onClose:()=>void}){
 const {plus,demo,busy,restore,clearMessage,refresh}=subscription;
 // Opening the screen always shows Apple's current answer, not the last one the app heard.
 useEffect(()=>{clearMessage();refresh();return clearMessage;},[clearMessage,refresh]);
 return <div className="native-profile-scroll native-plus-scroll">
  <SubpageHeader title="Privet Plus" titleId="native-plus-title" backLabel="Back" onBack={onClose} action={plus?undefined:<button className="native-text-button native-plus-restore" disabled={!!busy} onClick={restore}>{busy==='restore'?'Restoring…':'Restore'}</button>}/>
  <section className="native-plus-intro">
   <span aria-hidden="true">∞</span>
   <h2>The whole course, your pace.</h2>
  </section>
  {plus?<PlusActive subscription={subscription}/>:<PlusOffer subscription={subscription}/>}
  <PlusMessage subscription={subscription}/>
  <PlusLegal subscription={subscription} restore={false}/>
  {demo&&<p className="native-plus-demo">Browser preview · No payment. Plus is saved on this device.</p>}
 </div>;
}
