import test from 'node:test';
import assert from 'node:assert/strict';
import {cancel,emptySubscription,isPlus,restoreSubscription,subscribe,SUBSCRIPTION_KEY} from './subscription.ts';

test('subscriptions start empty and use the product-specific local key',()=>{
 assert.deepEqual(emptySubscription(),{version:1,plan:null,since:null});assert.equal(isPlus(emptySubscription()),false);assert.equal(SUBSCRIPTION_KEY,'privet-demo-v1-subscription');
});
test('monthly and yearly subscriptions restore and identify Plus',()=>{
 for(const plan of ['monthly','yearly'] as const){const sub=subscribe(plan,'2026-10-18');assert.deepEqual(sub,{version:1,plan,since:'2026-10-18'});assert.equal(isPlus(sub),true);assert.deepEqual(restoreSubscription(JSON.stringify(sub)),sub);}
});
test('malformed or incomplete subscription data restores as unsubscribed',()=>{
 for(const raw of ['not JSON','null','{}',JSON.stringify({version:2,plan:'yearly',since:'2026-10-18'}),JSON.stringify({version:1,plan:'annual',since:'2026-10-18'}),JSON.stringify({version:1,plan:'monthly',since:'not-a-date'}),JSON.stringify({version:1,plan:'yearly',since:'2026-02-30'}),JSON.stringify({version:1,plan:null,since:'2026-10-18'}),JSON.stringify({version:1,plan:'monthly',since:null})])assert.deepEqual(restoreSubscription(raw),emptySubscription());
 assert.deepEqual(restoreSubscription(null),emptySubscription());
});
test('cancel clears the subscription and invalid dates cannot create Plus',()=>{
 assert.deepEqual(cancel(),emptySubscription());assert.deepEqual(subscribe('monthly','invalid'),emptySubscription());
});
