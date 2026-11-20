import {useState} from 'react';
import type {SubscriptionController} from './useSubscription';
import {PLUS_MONTHLY_PRICE,PLUS_YEARLY_PRICE,type PlusPlan} from './subscription';
import {SubpageHeader} from './SubpageHeader';
import './plusScreen.css';

const plans:readonly {id:PlusPlan;name:string;price:string;per:string}[]=[
 {id:'monthly',name:'Monthly',price:PLUS_MONTHLY_PRICE,per:'month'},
 {id:'yearly',name:'Yearly',price:PLUS_YEARLY_PRICE,per:'year'},
];

// Privet Plus (local demo): pick a plan and activate it, or see and cancel the active one.
export function PlusScreen({subscription,onClose}:{subscription:SubscriptionController;onClose:()=>void}){
 const {subscription:active,plus,subscribe,cancel}=subscription;
 const [choice,setChoice]=useState<PlusPlan>('monthly');
 const activeName=plans.find(plan=>plan.id===active.plan)?.name??'';
 return <div className="native-profile-scroll native-plus-scroll">
  <SubpageHeader title="Privet Plus" titleId="native-plus-title" backLabel="Back" onBack={onClose}/>
  <section className="native-plus-intro">
   <span aria-hidden="true">∞</span>
   <h2>Keep learning, your way.</h2>
   <p>Unlimited hearts. Lessons never end early.</p>
  </section>
  {plus
   ?<section className="native-plus-card">
     <strong>Plus demo is active</strong>
     <p>{activeName} demo plan · Started {active.since}</p>
     <button className="button teal" onClick={cancel}>Cancel Plus</button>
    </section>
   :<>
     <section className="native-plus-plans" aria-label="Choose a demo plan">
      {plans.map(plan=><button key={plan.id} aria-pressed={choice===plan.id} onClick={()=>setChoice(plan.id)}>
       <strong>{plan.name}</strong><span>{plan.price} / {plan.per} · Concept pricing</span>
      </button>)}
     </section>
     <button className="button teal native-plus-start" onClick={()=>subscribe(choice)}>Activate Plus demo</button>
    </>}
  <p className="native-plus-demo">Local demo only · No payment processing. Your selection is saved on this device.</p>
 </div>;
}
