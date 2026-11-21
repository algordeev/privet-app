import test from 'node:test';
import assert from 'node:assert/strict';
import {FREE_LESSONS,lessonOpen} from './access.ts';

const fresh=(index:number,plus=false)=>({index,plus,started:false,passed:false});

test('the first three lessons are free; the rest need Plus',()=>{
 assert.equal(FREE_LESSONS,3);
 assert.deepEqual([0,1,2,3,4,5,6,7].map(index=>lessonOpen(fresh(index))),[true,true,true,false,false,false,false,false]);
 assert.ok([0,1,2,3,4,5,6,7].every(index=>lessonOpen(fresh(index,true))));
});

test('a lesson already started or passed stays open when Plus ends',()=>{
 assert.equal(lessonOpen({...fresh(5),started:true}),true);
 assert.equal(lessonOpen({...fresh(5),passed:true}),true);
});
