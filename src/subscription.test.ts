import test from 'node:test';
import assert from 'node:assert/strict';
import {PRODUCT} from './config.ts';
import {cancel,emptySubscription,isPlus,restoreSubscription,subscribe,SUBSCRIPTION_KEY,PLUS_MONTHLY_PRICE,PLUS_YEARLY_PRICE} from './subscription.ts';

const none={version:1,plan:null,since:null};

test('the Plus choice is saved under the product key the check scripts use',()=>{
 assert.equal(SUBSCRIPTION_KEY,`${PRODUCT.storageKey}-subscription`);
 assert.equal(SUBSCRIPTION_KEY,'privet-demo-v1-subscription');
});

test('nothing saved means no Plus',()=>{
 assert.deepEqual(emptySubscription(),none);
 assert.equal(isPlus(emptySubscription()),false);
 assert.deepEqual(restoreSubscription(null),none);
});

test('a started plan is Plus from its first day and survives a reload',()=>{
 for(const plan of ['monthly','yearly'] as const){
  const started=subscribe(plan,'2026-11-20');
  assert.deepEqual(started,{version:1,plan,since:'2026-11-20'});
  assert.equal(isPlus(started),true);
  assert.deepEqual(restoreSubscription(JSON.stringify(started)),started);
 }
});

test('saved data counts only as version 1 with a known plan and a real calendar day',()=>{
 const damaged=[
  'garbage','null','[]','{}','"monthly"','42',
  JSON.stringify({plan:'monthly',since:'2026-11-20'}),
  JSON.stringify({version:2,plan:'monthly',since:'2026-11-20'}),
  JSON.stringify({version:1,plan:'weekly',since:'2026-11-20'}),
  JSON.stringify({version:1,plan:'monthly',since:'2026-13-01'}),
  JSON.stringify({version:1,plan:'yearly',since:'2026-02-30'}),
  JSON.stringify({version:1,plan:'yearly',since:'20-11-2026'}),
  JSON.stringify({version:1,plan:'yearly',since:20261120}),
  JSON.stringify({version:1,plan:null,since:'2026-11-20'}),
  JSON.stringify({version:1,plan:'monthly',since:null}),
 ];
 for(const saved of damaged)assert.deepEqual(restoreSubscription(saved),none,saved);
});

test('starting needs a real day (leap days included); cancelling always clears',()=>{
 assert.deepEqual(subscribe('yearly','2026-02-29'),none);
 assert.deepEqual(subscribe('monthly','someday'),none);
 assert.deepEqual(subscribe('yearly','2028-02-29'),{version:1,plan:'yearly',since:'2028-02-29'});
 assert.deepEqual(cancel(),none);
 assert.equal(isPlus(cancel()),false);
});

test('the yearly plan costs less than twelve monthly payments',()=>{
 const dollars=(price:string)=>Number(price.replace('$',''));
 assert.ok(dollars(PLUS_YEARLY_PRICE)<12*dollars(PLUS_MONTHLY_PRICE));
});
