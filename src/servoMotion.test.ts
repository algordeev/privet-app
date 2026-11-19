import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TILT_HOME_DEG,gestureEnd,headPose,type Reaction} from './servoMotion.ts';

const firmware=readFileSync(new URL('../firmware/PrivetBLE_S3_v5/ServoMotion.h',import.meta.url),'utf8');
// Keyframes as the firmware writes them: {{0,FROM},{300,5},...}.
function keys(name:string){
 const body=new RegExp(`static constexpr Key ${name}\\[\\]=\\{(.*?)\\};`).exec(firmware)?.[1];
 assert.ok(body,name);
 return [...body.matchAll(/\{(\d+),(-?\d+|FROM)\}/g)].filter(m=>m[2]!=='FROM').map(m=>[Number(m[1]),Number(m[2])] as const);
}

test('every gesture hits the firmware keyframes exactly, at the firmware times',()=>{
 for(const [reaction,name] of [['happy','happy'],['encourage','encourage'],['celebrate','celebrate'],['hint','hint'],['connected','connected']] as [Reaction,string][]){
  for(const [at,deg] of keys(`${name}Pan`))assert.equal(Math.round(headPose(reaction,at).pan*1000)/1000,deg,`${reaction} pan @${at}`);
  for(const [at,deg] of keys(`${name}Tilt`))assert.equal(Math.round(headPose(reaction,at).tilt*1000)/1000,TILT_HOME_DEG+deg,`${reaction} tilt @${at}`);
  assert.equal(gestureEnd(reaction),Math.max(keys(`${name}Pan`).at(-1)![0],keys(`${name}Tilt`).at(-1)![0]));
 }
 assert.equal(Number(/TILT_HOME_DEG=(\d+)/.exec(firmware)![1]),TILT_HOME_DEG);
});

test('gestures start and end at rest and move smoothly in between',()=>{
 for(const reaction of ['happy','encourage','celebrate','hint','connected'] as Reaction[]){
  assert.deepEqual(headPose(reaction,0),{pan:0,tilt:TILT_HOME_DEG});
  assert.deepEqual(headPose(reaction,gestureEnd(reaction)+500),{pan:0,tilt:TILT_HOME_DEG});
  // No jumps: 10 ms apart, the head never moves more than a degree.
  for(let t=10;t<=gestureEnd(reaction);t+=10){
   const a=headPose(reaction,t-10),b=headPose(reaction,t);
   assert.ok(Math.abs(a.pan-b.pan)<1&&Math.abs(a.tilt-b.tilt)<1,`${reaction} @${t}`);
  }
 }
});
