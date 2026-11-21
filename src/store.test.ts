import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activePlus,yearlySaving,introText,monthlyEquivalent,perPeriod,periodText,planOf,PLUS_PRODUCTS,readEntitlements,readProducts} from './store.ts';

const yearly={id:PLUS_PRODUCTS.yearly,displayName:'Privet Plus Yearly',displayPrice:'$39.99',price:39.99,currency:'USD',locale:'en-US',period:{unit:'year',value:1},introEligible:true};

test('the StoreKit test file sells exactly the product IDs the app asks for',()=>{
 const config=JSON.parse(readFileSync(new URL('../ios/App/App/Privet.storekit',import.meta.url),'utf8'));
 const ids=config.subscriptionGroups.flatMap((group:{subscriptions:{productID:string}[]})=>group.subscriptions.map(item=>item.productID)).sort();
 assert.deepEqual(ids,Object.values(PLUS_PRODUCTS).sort());
});

test('products from the plugin are checked; malformed ones are left out',()=>{
 assert.deepEqual(readProducts([yearly]),[{...yearly,period:{unit:'year',value:1},introOffer:null}]);
 assert.deepEqual(readProducts(null),[]);
 assert.deepEqual(readProducts([{...yearly,price:'39.99'},{...yearly,displayPrice:''},{...yearly,currency:undefined},{...yearly,price:-1},'x',null]),[]);
 const [weird]=readProducts([{...yearly,displayName:undefined,period:{unit:'decade',value:1},introEligible:'yes'}]);
 assert.equal(weird.displayName,PLUS_PRODUCTS.yearly);
 assert.equal(weird.period,null);
 assert.equal(weird.introEligible,false);
});

test('an intro offer is kept only when it is complete',()=>{
 const trial={displayPrice:'$0.00',paymentMode:'freeTrial',period:{unit:'week',value:1},periodCount:1};
 assert.deepEqual(readProducts([{...yearly,introOffer:trial}])[0].introOffer,trial);
 for(const broken of [{...trial,paymentMode:'gift'},{...trial,periodCount:0},{...trial,period:{unit:'week',value:0}},{...trial,displayPrice:''}])
  assert.equal(readProducts([{...yearly,introOffer:broken}])[0].introOffer,null);
});

test('entitlements need a product and real dates',()=>{
 const good={productId:PLUS_PRODUCTS.monthly,purchaseDate:'2026-11-21T10:00:00Z',expirationDate:'2026-12-21T10:00:00Z',willAutoRenew:true};
 assert.deepEqual(readEntitlements([good]),[good]);
 assert.deepEqual(readEntitlements([{...good,willAutoRenew:undefined,expirationDate:undefined}]),[{...good,willAutoRenew:null,expirationDate:null}]);
 assert.deepEqual(readEntitlements([{...good,purchaseDate:'soon'},{...good,expirationDate:'never'},{...good,productId:''},7]),[]);
 assert.deepEqual(readEntitlements(undefined),[]);
});

test('plans map from product IDs, and nothing else is a plan',()=>{
 assert.equal(planOf(PLUS_PRODUCTS.yearly),'yearly');
 assert.equal(planOf(PLUS_PRODUCTS.monthly),'monthly');
 assert.equal(planOf('com.algordeev.privet.other'),null);
});

test('Plus is active only for a Plus product that has not expired',()=>{
 const now=new Date('2026-11-21T12:00:00Z');
 const monthly={productId:PLUS_PRODUCTS.monthly,purchaseDate:'2026-11-01T00:00:00Z',expirationDate:'2026-12-01T00:00:00Z',willAutoRenew:true};
 const expired={...monthly,expirationDate:'2026-11-21T11:59:59Z'};
 const other={...monthly,productId:'com.example.other'};
 const yearlyLater={...monthly,productId:PLUS_PRODUCTS.yearly,expirationDate:'2027-11-01T00:00:00Z'};
 assert.equal(activePlus([],now),null);
 assert.equal(activePlus([expired,other],now),null);
 assert.equal(activePlus([monthly],now),monthly);
 assert.equal(activePlus([monthly,yearlyLater],now),yearlyLater);
 assert.equal(activePlus([yearlyLater,monthly],now),yearlyLater);
});

test('the yearly price per month is rounded down and only shown for one year',()=>{
 assert.equal(monthlyEquivalent(yearly),'$3.33');
 assert.equal(monthlyEquivalent({...yearly,price:35.99}),'$2.99');
 // Prices come from Swift as doubles slightly below the real value.
 assert.equal(monthlyEquivalent({...yearly,price:39.989999999999995}),'$3.33');
 assert.equal(monthlyEquivalent({...yearly,price:47.879999999999995}),'$3.99');
 assert.equal(monthlyEquivalent({...yearly,price:47.88}),'$3.99');
 assert.equal(monthlyEquivalent({...yearly,period:{unit:'month',value:1}}),null);
 assert.equal(monthlyEquivalent({...yearly,period:null}),null);
 assert.equal(monthlyEquivalent({...yearly,currency:'nope'}),null);
 // Written like the store's own prices, whatever language the phone uses.
 assert.equal(monthlyEquivalent({...yearly,locale:'de-DE',currency:'EUR'}),'3,33\u00a0€');
});

test('periods read as plain lengths of time',()=>{
 assert.equal(periodText({unit:'week',value:1}),'1 week');
 assert.equal(periodText({unit:'month',value:1},3),'3 months');
 assert.equal(periodText({unit:'day',value:3}),'3 days');
 assert.equal(perPeriod({unit:'year',value:1}),'/ year');
 assert.equal(perPeriod({unit:'month',value:6}),'/ 6 months');
 assert.equal(perPeriod(null),'');
});

test('an intro offer is described only to someone who can still get it',()=>{
 const base={displayPrice:'$39.99',period:{unit:'year',value:1} as const,introEligible:true};
 assert.equal(introText({...base,introOffer:null}),null);
 const trial={displayPrice:'$0.00',paymentMode:'freeTrial',period:{unit:'week',value:1},periodCount:1} as const;
 assert.equal(introText({...base,introOffer:trial}),'1 week free, then $39.99 / year');
 assert.equal(introText({...base,introEligible:false,introOffer:trial}),null);
 assert.equal(introText({...base,introOffer:{displayPrice:'$0.99',paymentMode:'payAsYouGo',period:{unit:'month',value:1},periodCount:3}}),'$0.99 / month for 3 months, then $39.99 / year');
 assert.equal(introText({...base,introOffer:{displayPrice:'$9.99',paymentMode:'payUpFront',period:{unit:'month',value:6},periodCount:1}}),'$9.99 for 6 months, then $39.99 / year');
});

test('the yearly saving is worked out from real prices, rounded down',()=>{
 const monthly={id:PLUS_PRODUCTS.monthly,price:4.99,currency:'USD'};
 assert.equal(yearlySaving([yearly,monthly]),33);
 assert.equal(yearlySaving([{...yearly,price:39.989999999999995},{...monthly,price:4.9899999}]),33);
 assert.equal(yearlySaving([{...yearly,price:59.88},monthly]),null,'no saving, no badge');
 assert.equal(yearlySaving([yearly]),null);
 assert.equal(yearlySaving([yearly,{...monthly,currency:'EUR'}]),null);
});
