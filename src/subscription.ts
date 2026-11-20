import {PRODUCT} from './config.ts';

// Privet Plus is a local demo: no payment, only the chosen plan and the day it started, saved on this device.
export type PlusPlan='monthly'|'yearly';
export type Subscription={version:1;plan:PlusPlan|null;since:string|null};

export const SUBSCRIPTION_KEY=`${PRODUCT.storageKey}-subscription`;
export const COMPANION_PRICE='$59.99';
export const PLUS_MONTHLY_PRICE='$4.99';
export const PLUS_YEARLY_PRICE='$39.99';

export const emptySubscription=():Subscription=>({version:1,plan:null,since:null});

const isPlan=(value:unknown):value is PlusPlan=>value==='monthly'||value==='yearly';

// A day that exists on the calendar, written YYYY-MM-DD (so 2026-02-30 is rejected).
function isCalendarDay(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number);
 const date=new Date(0);
 date.setUTCFullYear(year,month-1,day);
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}

// Reads what was saved. Anything missing, unknown or damaged means no Plus.
export function restoreSubscription(saved:string|null):Subscription{
 if(saved===null)return emptySubscription();
 let data:unknown;
 try{data=JSON.parse(saved);}catch{return emptySubscription();}
 if(!data||typeof data!=='object')return emptySubscription();
 const {version,plan,since}=data as Record<string,unknown>;
 return version===1&&isPlan(plan)&&isCalendarDay(since)?{version:1,plan,since}:emptySubscription();
}

export function subscribe(plan:PlusPlan,day:string):Subscription{
 return isCalendarDay(day)?{version:1,plan,since:day}:emptySubscription();
}
export const cancel=():Subscription=>emptySubscription();
export const isPlus=(subscription:Subscription)=>subscription.plan!==null&&subscription.since!==null;
