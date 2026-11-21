import {useCallback,useEffect,useRef,useState} from 'react';
import {App} from '@capacitor/app';
import {appStorage} from './previewStorage';
import {localDay} from './days';
import {cancel as cancelPlan,isPlus,restoreSubscription,subscribe as startPlan,SUBSCRIPTION_KEY,PLUS_MONTHLY_PRICE,PLUS_YEARLY_PRICE,type Subscription} from './subscription';
import {activePlus,planOf,PLUS_PRODUCTS,store,storeSupported,type PlusPlan,type PurchaseStatus,type StoreEntitlement,type StoreProduct} from './store';

function readSaved():Subscription{
 try{return restoreSubscription(appStorage.getItem(SUBSCRIPTION_KEY));}
 catch{return restoreSubscription(null);}
}
function writeSaved(value:Subscription){
 try{appStorage.setItem(SUBSCRIPTION_KEY,JSON.stringify(value));}catch{/* Not saved; still right in memory. */}
}

// The browser preview and website have no App Store: the same screens run on a local demo store.
const DEMO_PRODUCTS:StoreProduct[]=[
 {id:PLUS_PRODUCTS.yearly,displayName:'Privet Plus Yearly',displayPrice:PLUS_YEARLY_PRICE,price:Number(PLUS_YEARLY_PRICE.slice(1)),currency:'USD',locale:'en-US',period:{unit:'year',value:1},introOffer:null,introEligible:false},
 {id:PLUS_PRODUCTS.monthly,displayName:'Privet Plus Monthly',displayPrice:PLUS_MONTHLY_PRICE,price:Number(PLUS_MONTHLY_PRICE.slice(1)),currency:'USD',locale:'en-US',period:{unit:'month',value:1},introOffer:null,introEligible:false},
];
const demoEntitlement=(saved:Subscription):StoreEntitlement|null=>saved.plan&&saved.since?{productId:PLUS_PRODUCTS[saved.plan],purchaseDate:`${saved.since}T00:00:00Z`,expirationDate:null,willAutoRenew:true}:null;
// What the App Store said, kept so the next launch starts right (unlimited hearts, open lessons) before StoreKit answers.
const cacheOf=(entitlement:StoreEntitlement|null):Subscription=>{
 const plan=entitlement?planOf(entitlement.productId):null;
 return plan?startPlan(plan,localDay(new Date(entitlement!.purchaseDate))):cancelPlan();
};

export type ProductsState='loading'|'ready'|'failed';

// Privet Plus: Apple's subscription state in the iOS app, a local demo elsewhere.
export function useSubscription(){
 const [demo]=useState(()=>!storeSupported());
 const [saved,setSaved]=useState(readSaved);
 const [entitlement,setEntitlement]=useState<StoreEntitlement|null>(()=>demo?demoEntitlement(saved):null);
 const [products,setProducts]=useState<StoreProduct[]>(demo?DEMO_PRODUCTS:[]);
 const [productsState,setProductsState]=useState<ProductsState>(demo?'ready':'loading');
 const [busy,setBusy]=useState<'purchase'|'restore'|null>(null);
 const [message,setMessage]=useState('');
 const mounted=useRef(true);
 useEffect(()=>()=>{mounted.current=false;},[]);

 // On first use, store the value as read, so storage always holds a clean, current entry (damaged data is replaced).
 useEffect(()=>{writeSaved(saved);},[]);
 const keep=useCallback((next:Subscription)=>{setSaved(next);writeSaved(next);},[]);

 const apply=useCallback((list:StoreEntitlement[])=>{
  if(!mounted.current)return null;
  const active=activePlus(list,new Date());
  setEntitlement(active);keep(cacheOf(active));
  return active;
 },[keep]);

 const loadProducts=useCallback(()=>{
  if(demo)return;
  setProductsState('loading');
  store.products().then(found=>{if(!mounted.current)return;setProducts(found);setProductsState(found.length?'ready':'failed');},()=>{if(mounted.current)setProductsState('failed');});
 },[demo]);

 const refresh=useCallback(()=>store.entitlements().then(apply,()=>null/* Keep the cached state; StoreKit answers next time. */),[apply]);

 useEffect(()=>{
  if(demo)return;
  refresh();loadProducts();
  const change=store.onChange(list=>{apply(list);});
  // A subscription can end while the app sleeps; StoreKit sends no update for that.
  const resume=App.addListener('appStateChange',({isActive})=>{if(isActive)refresh();});
  return ()=>{void change.then(handle=>handle.remove());void resume.then(handle=>handle.remove());};
 },[demo,apply,refresh,loadProducts]);

 // StoreKit sends nothing when a subscription simply runs out: ask again the moment it is due to end.
 const expires=entitlement?.expirationDate??null;
 useEffect(()=>{
  if(demo||!expires)return;
  const wait=Date.parse(expires)-Date.now()+1500;
  // Timers longer than ~24 days overflow; a far-off end is caught by the next launch or return to the app.
  if(wait>2**31-1)return;
  const timer=setTimeout(()=>{void refresh();},Math.max(wait,0));
  return ()=>clearTimeout(timer);
 },[demo,expires,refresh]);

 const purchase=useCallback(async(plan:PlusPlan):Promise<PurchaseStatus|'failed'>=>{
  setMessage('');
  if(demo){const next=startPlan(plan,localDay(new Date()));keep(next);setEntitlement(demoEntitlement(next));return 'purchased';}
  setBusy('purchase');
  try{
   const result=await store.purchase(PLUS_PRODUCTS[plan]);
   apply(result.entitlements);
   if(result.status==='pending')setMessage('Waiting for approval. Plus starts as soon as the purchase is approved.');
   if(result.status==='unverified')setMessage('The App Store couldn’t verify this purchase. Please try again.');
   return result.status;
  }catch{
   setMessage('The purchase didn’t go through. Please try again.');
   return 'failed';
  }finally{if(mounted.current)setBusy(null);}
 },[demo,keep,apply]);

 const restore=useCallback(async()=>{
  setMessage('');
  if(demo){setMessage(isPlus(saved)?'Plus is active.':'Browser preview: there are no purchases to restore.');return;}
  setBusy('restore');
  try{
   const active=apply(await store.restore());
   setMessage(active?'Plus restored. Every lesson is open.':'No active Plus subscription was found for this Apple Account.');
  }catch{
   setMessage('Couldn’t reach the App Store. Please try again.');
  }finally{if(mounted.current)setBusy(null);}
 },[demo,saved,apply]);

 // Apple's own screen for changing or cancelling; the demo just ends.
 const manage=useCallback(()=>{
  setMessage('');
  if(demo){keep(cancelPlan());setEntitlement(null);return;}
  // Cancelling there changes only whether Plus renews, and StoreKit announces no new transaction for it: ask again once it closes.
  store.manage().then(()=>{void refresh();},()=>setMessage('Couldn’t open subscriptions. Try Settings › Apple Account › Subscriptions.'));
 },[demo,keep,refresh]);

 // Every StoreKit answer rewrites the saved copy, so it is the answer (and, before the first one, the last known).
 return {plus:isPlus(saved),plan:saved.plan,entitlement,products,productsState,retryProducts:loadProducts,refresh:useCallback(()=>{if(!demo)void refresh();},[demo,refresh]),purchase,restore,manage,busy,message,clearMessage:useCallback(()=>setMessage(''),[]),demo};
}
export type SubscriptionController=ReturnType<typeof useSubscription>;
