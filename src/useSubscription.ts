import {useCallback,useEffect,useState} from 'react';
import {localDay} from './nativeStats';
import {cancel as cancelSubscription,isPlus,restoreSubscription,subscribe as createSubscription,SUBSCRIPTION_KEY,type Subscription} from './subscription';

function load(){try{return restoreSubscription(localStorage.getItem(SUBSCRIPTION_KEY));}catch{return restoreSubscription(null);}}
export function useSubscription(){
 const [subscription,setSubscription]=useState(load);
 const [persistent,setPersistent]=useState(true);
 const save=useCallback((value:Subscription)=>{setSubscription(value);try{localStorage.setItem(SUBSCRIPTION_KEY,JSON.stringify(value));setPersistent(true);}catch{setPersistent(false);}},[]);
 const subscribe=useCallback((plan:'monthly'|'yearly')=>save(createSubscription(plan,localDay(new Date()))),[save]);
 const cancel=useCallback(()=>save(cancelSubscription()),[save]);
 useEffect(()=>{try{localStorage.setItem(SUBSCRIPTION_KEY,JSON.stringify(subscription));setPersistent(true);}catch{setPersistent(false);}},[]);
 return {subscription,plus:isPlus(subscription),subscribe,cancel,persistent};
}
export type SubscriptionController=ReturnType<typeof useSubscription>;
