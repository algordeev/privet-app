import test from 'node:test';
import assert from 'node:assert/strict';
import {PRODUCT} from './config.ts';
import {CYRILLIC_KEY,initialCyrillic,restoreCyrillic,updateCyrillic,recommendCyrillic} from './cyrillicProgress.ts';

test('onboarding has its own product-scoped key and validated initial, partial, skipped and completed states',()=>{
 assert.equal(CYRILLIC_KEY,`${PRODUCT.storageKey}-cyrillic-quick-start`);
 for(const state of [initialCyrillic(),{version:1,status:'started',page:2},{version:1,status:'skipped',page:0},{version:1,status:'completed',page:3}])assert.deepEqual(restoreCyrillic(JSON.stringify(state)),state);
 for(const value of [null,'{','null','false','[]','{}',JSON.stringify({version:2,status:'started',page:0}),JSON.stringify({version:1,status:'completed',page:0}),JSON.stringify({version:1,status:'skipped',page:2}),JSON.stringify({version:1,status:'started',page:4}),JSON.stringify({version:1,status:'started',page:1.5})])assert.deepEqual(restoreCyrillic(value),initialCyrillic());
});
test('skip stops recommendations; beginning, partial progress, completion and review remain optional and isolated',()=>{
 const initial=initialCyrillic();assert.equal(recommendCyrillic(initial,false),true);assert.equal(recommendCyrillic(initial,true),false);
 const skipped=updateCyrillic(initial,{type:'skip'});assert.equal(recommendCyrillic(skipped,false),false);
 let state=updateCyrillic(skipped,{type:'start'});assert.equal(state.status,'started');assert.equal(recommendCyrillic(state,false),false);
 state=updateCyrillic(state,{type:'page',page:2});assert.equal(state.page,2);
 assert.equal(updateCyrillic(state,{type:'page',page:-1}),state);
 state=updateCyrillic(state,{type:'complete'});assert.deepEqual(state,{version:1,status:'completed',page:3});
 assert.equal(updateCyrillic(state,{type:'start'}),state);assert.equal(updateCyrillic(state,{type:'page',page:0}),state);
 assert.deepEqual(Object.keys(state).sort(),['page','status','version']);assert.deepEqual(updateCyrillic(state,{type:'reset'}),initial);
});
