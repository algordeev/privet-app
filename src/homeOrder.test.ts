import test from 'node:test';
import assert from 'node:assert/strict';
import {homeOrder} from './homeOrder.ts';

const course=(passed:number[],started:number[]=[],open=(index:number)=>true)=>[0,1,2,3,4,5,6,7].map(index=>({index,passed:passed.includes(index),started:started.includes(index)||passed.includes(index),open:open(index)}));

test('a fresh course keeps course order with lesson 1 up next and nothing completed',()=>{
 assert.deepEqual(homeOrder(course([])),{upNext:0,upcoming:[0,1,2,3,4,5,6,7],completed:[]});
});

test('passed lessons move to Completed and the next one leads',()=>{
 assert.deepEqual(homeOrder(course([0,1])),{upNext:2,upcoming:[2,3,4,5,6,7],completed:[0,1]});
});

test('a lesson in progress leads, even past an untouched earlier one',()=>{
 assert.deepEqual(homeOrder(course([0],[4])),{upNext:4,upcoming:[4,1,2,3,5,6,7],completed:[0]});
});

test('locked lessons are never up next but keep their place among the upcoming ones',()=>{
 const free=(index:number)=>index<3;
 assert.deepEqual(homeOrder(course([0,1,2],[],free)),{upNext:null,upcoming:[3,4,5,6,7],completed:[0,1,2]});
 assert.deepEqual(homeOrder(course([0],[],free)),{upNext:1,upcoming:[1,2,3,4,5,6,7],completed:[0]});
});

test('a finished course is all Completed',()=>{
 assert.deepEqual(homeOrder(course([0,1,2,3,4,5,6,7])),{upNext:null,upcoming:[],completed:[0,1,2,3,4,5,6,7]});
});
