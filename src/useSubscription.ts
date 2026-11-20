import {useCallback,useEffect,useState} from 'react';
import {appStorage} from './previewStorage';
import {localDay} from './days';
import {cancel as cancelPlan,isPlus,restoreSubscription,subscribe as startPlan,SUBSCRIPTION_KEY,type PlusPlan,type Subscription} from './subscription';

function readSaved():Subscription{
 try{return restoreSubscription(appStorage.getItem(SUBSCRIPTION_KEY));}
 catch{return restoreSubscription(null);}
}

function writeSaved(value:Subscription){
 try{appStorage.setItem(SUBSCRIPTION_KEY,JSON.stringify(value));}catch{/* Not saved; still active in memory. */}
}

// The Plus demo choice. Saving is best effort: if storage is unavailable, the choice lasts for this session.
export function useSubscription(){
 const [subscription,setSubscription]=useState(readSaved);
 // On first use, store the value as read, so storage always holds a clean, current entry (damaged data is replaced).
 useEffect(()=>{writeSaved(subscription);},[]);
 const keep=useCallback((next:Subscription)=>{setSubscription(next);writeSaved(next);},[]);
 const subscribe=useCallback((plan:PlusPlan)=>keep(startPlan(plan,localDay(new Date()))),[keep]);
 const cancel=useCallback(()=>keep(cancelPlan()),[keep]);
 return {subscription,plus:isPlus(subscription),subscribe,cancel};
}
export type SubscriptionController=ReturnType<typeof useSubscription>;
