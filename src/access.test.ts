import test from 'node:test';
import assert from 'node:assert/strict';
import {FREE_LESSONS,lessonOpen,lockedLessons} from './access.ts';

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

test('home shows the first locked lesson and blurs the others',()=>{
 const course=[0,1,2,3,4,5,6,7].map(index=>fresh(index));
 assert.deepEqual(lockedLessons(course),{first:3,blurred:[4,5,6,7],count:5});
 assert.deepEqual(lockedLessons(course.map(item=>({...item,plus:true}))),{first:null,blurred:[],count:0});
 // A lapsed subscriber's started lesson 4 is open, so lesson 5 becomes the readable one.
 assert.deepEqual(lockedLessons(course.map(item=>item.index===3?{...item,started:true}:item)),{first:4,blurred:[5,6,7],count:4});
 assert.deepEqual(lockedLessons(course.slice(0,4)),{first:3,blurred:[],count:1});
});
