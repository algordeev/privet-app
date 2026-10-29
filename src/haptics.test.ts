import test from 'node:test';
import assert from 'node:assert/strict';
import {hapticFor} from './haptics.ts';
import {initialProgress,type Progress} from './engine.ts';

const at=(patch:Partial<Progress>={}):Progress=>({...initialProgress(),...patch});

test('a first check gives a correct or incorrect haptic',()=>{
 assert.equal(hapticFor(at(),at({attempts:1,feedback:'correct'}),{type:'check',value:'x'}),'correct');
 assert.equal(hapticFor(at(),at({attempts:1,feedback:'incorrect',hearts:2}),{type:'check',value:'x'}),'incorrect');
});

test('losing the last heart gives the failure haptic instead',()=>{
 assert.equal(hapticFor(at({hearts:1}),at({attempts:1,feedback:'incorrect',hearts:0,failed:true}),{type:'check',value:'x'}),'failed');
});

test('continuing past the last step celebrates; other continues stay quiet',()=>{
 assert.equal(hapticFor(at({feedback:'correct'}),at({index:5,complete:true}),{type:'continue'}),'complete');
 assert.equal(hapticFor(at({feedback:'correct'}),at({index:1}),{type:'continue'}),null);
});

test('rejected or repeated dispatches and finished lessons give nothing',()=>{
 const same=at();
 assert.equal(hapticFor(same,same,{type:'check',value:'x'}),null);
 assert.equal(hapticFor(at({feedback:'correct'}),at({feedback:'correct',attempts:2}),{type:'check',value:'x'}),null);
 assert.equal(hapticFor(at({complete:true}),at(),{type:'reset'}),null);
});
