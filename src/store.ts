import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';

// Privet Plus products in App Store Connect. These IDs are permanent once created there.
export const PLUS_PRODUCTS={yearly:'com.algordeev.privet.plus.yearly',monthly:'com.algordeev.privet.plus.monthly'} as const;
export type PlusPlan=keyof typeof PLUS_PRODUCTS;
export const PLUS_PRODUCT_IDS:readonly string[]=Object.values(PLUS_PRODUCTS);

export type StorePeriod={unit:'day'|'week'|'month'|'year';value:number};
export type IntroOffer={displayPrice:string;paymentMode:'freeTrial'|'payAsYouGo'|'payUpFront';period:StorePeriod;periodCount:number};
export type StoreProduct={id:string;displayName:string;displayPrice:string;price:number;currency:string;locale:string|null;period:StorePeriod|null;introOffer:IntroOffer|null;introEligible:boolean};
export type StoreEntitlement={productId:string;purchaseDate:string;expirationDate:string|null;willAutoRenew:boolean|null};
export type PurchaseStatus='purchased'|'pending'|'cancelled'|'unverified';

interface PrivetStorePlugin{
 products(options:{ids:string[]}):Promise<{products:unknown}>;
 purchase(options:{id:string}):Promise<{status:unknown;entitlements:unknown}>;
 entitlements():Promise<{entitlements:unknown}>;
 restore():Promise<{entitlements:unknown}>;
 manage():Promise<void>;
 addListener(event:'entitlementsChanged',listener:(data:{entitlements:unknown})=>void):Promise<PluginListenerHandle>;
}
const plugin=registerPlugin<PrivetStorePlugin>('PrivetStore');

// The App Store exists only in the native app; the website and browser preview keep the local demo.
export const storeSupported=()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('PrivetStore');

const object=(value:unknown):Record<string,unknown>|null=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const text=(value:unknown)=>typeof value==='string'&&value.length>0?value:null;
const units=['day','week','month','year'] as const;

function readPeriod(value:unknown):StorePeriod|null{
 const data=object(value);
 const unit=units.find(item=>item===data?.unit);
 return unit&&Number.isInteger(data?.value)&&(data!.value as number)>0?{unit,value:data!.value as number}:null;
}
function readIntro(value:unknown):IntroOffer|null{
 const data=object(value);
 const displayPrice=text(data?.displayPrice),period=readPeriod(data?.period);
 const paymentMode=(['freeTrial','payAsYouGo','payUpFront'] as const).find(item=>item===data?.paymentMode);
 const periodCount=Number.isInteger(data?.periodCount)&&(data!.periodCount as number)>0?data!.periodCount as number:null;
 return displayPrice&&period&&paymentMode&&periodCount?{displayPrice,paymentMode,period,periodCount}:null;
}

// What the plugin returned, checked: anything malformed is left out rather than shown.
export function readProducts(value:unknown):StoreProduct[]{
 if(!Array.isArray(value))return [];
 return value.flatMap(raw=>{
  const data=object(raw);
  const id=text(data?.id),displayPrice=text(data?.displayPrice),currency=text(data?.currency);
  const price=typeof data?.price==='number'&&Number.isFinite(data.price)&&data.price>=0?data.price:null;
  if(!id||!displayPrice||!currency||price===null)return [];
  return [{id,displayName:text(data?.displayName)??id,displayPrice,price,currency,locale:text(data?.locale),period:readPeriod(data?.period),introOffer:readIntro(data?.introOffer),introEligible:data?.introEligible===true}];
 });
}
const isDate=(value:string|null)=>value!==null&&!Number.isNaN(Date.parse(value));
export function readEntitlements(value:unknown):StoreEntitlement[]{
 if(!Array.isArray(value))return [];
 return value.flatMap(raw=>{
  const data=object(raw);
  const productId=text(data?.productId),purchaseDate=text(data?.purchaseDate),expirationDate=text(data?.expirationDate);
  if(!productId||!isDate(purchaseDate)||(expirationDate!==null&&!isDate(expirationDate)))return [];
  return [{productId,purchaseDate:purchaseDate!,expirationDate,willAutoRenew:typeof data?.willAutoRenew==='boolean'?data.willAutoRenew:null}];
 });
}
const readStatus=(value:unknown):PurchaseStatus=>(['purchased','pending','cancelled','unverified'] as const).find(item=>item===value)??'cancelled';

export const planOf=(productId:string):PlusPlan|null=>(Object.keys(PLUS_PRODUCTS) as PlusPlan[]).find(plan=>PLUS_PRODUCTS[plan]===productId)??null;

// The Plus subscription that is active now, if any (the latest-expiring one when there are several).
export function activePlus(entitlements:readonly StoreEntitlement[],now:Date):StoreEntitlement|null{
 const active=entitlements.filter(item=>planOf(item.productId)!==null&&(item.expirationDate===null||Date.parse(item.expirationDate)>now.getTime()));
 const end=(item:StoreEntitlement)=>item.expirationDate===null?Infinity:Date.parse(item.expirationDate);
 return active.reduce<StoreEntitlement|null>((best,item)=>best===null||end(item)>end(best)?item:best,null);
}

// A yearly price shown per month, rounded down, written the way the store writes its prices.
export function monthlyEquivalent(product:Pick<StoreProduct,'price'|'currency'|'period'|'locale'>):string|null{
 if(product.period?.unit!=='year'||product.period.value!==1)return null;
 try{return new Intl.NumberFormat(product.locale??undefined,{style:'currency',currency:product.currency}).format(Math.floor(Math.round(product.price*1e4)/12/100)/100);}// Prices arrive as doubles (39.99 → 39.98999…): settle them first.
 catch{return null;}
}

// How much cheaper a year is than twelve months, in whole percent (rounded down, never overstated).
export function yearlySaving(products:readonly Pick<StoreProduct,'id'|'price'|'currency'>[]):number|null{
 const yearly=products.find(item=>item.id===PLUS_PRODUCTS.yearly),monthly=products.find(item=>item.id===PLUS_PRODUCTS.monthly);
 if(!yearly||!monthly||yearly.currency!==monthly.currency||monthly.price<=0)return null;
 const saving=Math.floor((1-Math.round(yearly.price*100)/Math.round(monthly.price*1200))*100);
 return saving>0?saving:null;
}

// "1 week", "3 months": a length of time, for trials and offers.
export function periodText(period:StorePeriod,count=1){
 const value=period.value*count;
 return `${value} ${period.unit}${value===1?'':'s'}`;
}
// "/ year": what each payment covers.
export const perPeriod=(period:StorePeriod|null)=>!period?'':period.value===1?`/ ${period.unit}`:`/ ${periodText(period)}`;

// An introductory offer in words, only for someone who can still get it.
export function introText(product:Pick<StoreProduct,'displayPrice'|'period'|'introOffer'|'introEligible'>):string|null{
 const offer=product.introOffer;
 if(!offer||!product.introEligible)return null;
 const then=`then ${product.displayPrice} ${perPeriod(product.period)}`.trim();
 if(offer.paymentMode==='freeTrial')return `${periodText(offer.period,offer.periodCount)} free, ${then}`;
 if(offer.paymentMode==='payUpFront')return `${offer.displayPrice} for ${periodText(offer.period,offer.periodCount)}, ${then}`;
 return `${offer.displayPrice} ${perPeriod(offer.period)} for ${periodText(offer.period,offer.periodCount)}, ${then}`;
}

export const store={
 products:async(ids:readonly string[]=PLUS_PRODUCT_IDS)=>readProducts((await plugin.products({ids:[...ids]})).products),
 purchase:async(id:string)=>{const result=await plugin.purchase({id});return {status:readStatus(result.status),entitlements:readEntitlements(result.entitlements)};},
 entitlements:async()=>readEntitlements((await plugin.entitlements()).entitlements),
 restore:async()=>readEntitlements((await plugin.restore()).entitlements),
 manage:()=>plugin.manage(),
 onChange:(listener:(entitlements:StoreEntitlement[])=>void)=>plugin.addListener('entitlementsChanged',data=>listener(readEntitlements(data.entitlements))),
};
