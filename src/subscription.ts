import {PRODUCT} from './config.ts';

export type Subscription={version:1;plan:'monthly'|'yearly'|null;since:string|null};
export const SUBSCRIPTION_KEY=`${PRODUCT.storageKey}-subscription`;
export const PLUS_MONTHLY_PRICE='$4.99';
export const PLUS_YEARLY_PRICE='$39.99';
export const emptySubscription=():Subscription=>({version:1,plan:null,since:null});
function validDate(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;}
export function restoreSubscription(raw:string|null):Subscription{
 if(raw===null)return emptySubscription();
 try{const sub=JSON.parse(raw);if(sub?.version!==1)return emptySubscription();if(sub.plan===null&&sub.since===null)return emptySubscription();if((sub.plan==='monthly'||sub.plan==='yearly')&&validDate(sub.since))return {version:1,plan:sub.plan,since:sub.since};}catch{/* Ignore malformed local storage. */}
 return emptySubscription();
}
export function subscribe(plan:'monthly'|'yearly',date:string):Subscription{return validDate(date)?{version:1,plan,since:date}:emptySubscription();}
export function cancel():Subscription{return emptySubscription();}
export function isPlus(sub:Subscription){return sub.plan!==null&&sub.since!==null;}
