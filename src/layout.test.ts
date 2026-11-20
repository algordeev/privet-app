import test from 'node:test';
import assert from 'node:assert/strict';
import {wantsPhoneLayout} from './layout.ts';

test('the native app always uses the phone layout, whatever the URL says',()=>{
 for(const search of ['','?native=0','?native=1','?lesson=2'])assert.equal(wantsPhoneLayout(true,search),true);
});

test('a browser shows the website unless ?native=1 asks for the phone preview',()=>{
 assert.equal(wantsPhoneLayout(false,''),false);
 assert.equal(wantsPhoneLayout(false,'?native=1'),true);
 assert.equal(wantsPhoneLayout(false,'?lesson=2&native=1'),true);
 for(const search of ['?native=0','?native=true','?native','?Native=1','?lesson=2'])assert.equal(wantsPhoneLayout(false,search),false,search);
});
