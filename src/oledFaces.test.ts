import test from 'node:test';
import assert from 'node:assert/strict';
import {OLED_WIDTH,renderFirmwareFace} from './oledFaces.ts';

const lit=(pixels:Uint8Array,x:number,y:number)=>pixels[y*OLED_WIDTH+x]===1;

test('sleeping face: closed eyes, small mouth, a sleep bubble and the small corner dot',()=>{
 const face=renderFirmwareFace('sleeping',0);
 assert.ok(lit(face,28,26)&&lit(face,47,26),'closed eye ends');
 assert.ok(lit(face,64,43)&&!lit(face,64,46),'hollow mouth circle');
 assert.ok(lit(face,101,23),'first sleep bubble');assert.ok(!lit(face,116,5),'third bubble not yet');
 assert.ok(lit(face,122,4)&&!lit(face,125,4),'disconnected dot has radius 1');
 assert.ok(lit(renderFirmwareFace('sleeping',1400),116,5),'third bubble after 1.3 s');
});

test('connected face: eyes open from 3 px to full height in 500 ms, with smile, pulse and connection dot',()=>{
 const opening=renderFirmwareFace('connected',0);
 assert.ok(lit(opening,38,35)&&!lit(opening,38,30),'eyes start 3 px tall at the bottom');
 const open=renderFirmwareFace('connected',600);
 assert.ok(lit(open,38,15)&&lit(open,38,36)&&lit(open,90,20),'both eyes fully open');
 assert.ok(lit(open,60,48)&&lit(open,44,41),'smile');
 assert.ok(lit(open,125,4),'connected dot has radius 3');
 assert.ok(lit(open,64,5)||lit(open,64,4)||lit(open,64,6),'pulse ring at the top');
});

test('idle face blinks every 4.3 s and glances sideways in its first minute',()=>{
 const blink=renderFirmwareFace('idle',100,4300+50);
 assert.ok(lit(blink,38,27)&&!lit(blink,38,18),'blink is a thin bar');
 const ahead=renderFirmwareFace('idle',1000,1000),glance=renderFirmwareFace('idle',2200+700,2200+700);
 assert.ok(lit(ahead,28,20)&&!lit(ahead,28+5+20,20));
 assert.ok(lit(glance,28+5+19,20)&&!lit(glance,28,20),'eyes moved 5 px');
 assert.ok(!lit(renderFirmwareFace('idle',2000),64,5),'no connection pulse once idle');
});
