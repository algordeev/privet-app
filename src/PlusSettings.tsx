import {useEffect} from 'react';
import type {SubscriptionController} from './useSubscription';
import {PlusMessage} from './PlusScreen';

// Settings › Privet Plus: the current plan, the paywall or plan screen, and Restore purchases.
export function PlusSettings({subscription,onOpen}:{subscription:SubscriptionController;onOpen:()=>void}){
 const {plus,busy,restore,clearMessage}=subscription;
 useEffect(()=>clearMessage,[clearMessage]);
 return <section className="native-settings-card native-settings-plus" aria-labelledby="settings-plus-title">
  <h2 id="settings-plus-title">Privet Plus</h2>
  <p>{plus?'Plus is active. Every lesson is open and hearts are unlimited.':'Lessons 1–3 are free. Plus opens every lesson.'}</p>
  <button className="button teal" id="native-settings-plus" onClick={onOpen}>{plus?'Manage Plus':'Get Plus'}</button>
  <button className="native-text-button" disabled={!!busy} onClick={restore}>{busy==='restore'?'Restoring…':'Restore purchases'}</button>
  <PlusMessage subscription={subscription}/>
 </section>;
}
