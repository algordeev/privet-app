import test from 'node:test';
import assert from 'node:assert/strict';
import {crc16} from './learningProtocol.ts';
import {POCKET,POCKET_LIMITS,dayKey,dayNumber,deckFrames,decodePocketAck,decodeResult,encodeClear,encodeRead,encodeTime,pocketBody,pocketText} from './pocketProtocol.ts';
const bytes=(p:DataView)=>[...new Uint8Array(p.buffer,p.byteOffset,p.byteLength)];

test('pocket TIME, READ and CLEAR frames have exact little-endian layouts',()=>{
 assert.deepEqual(bytes(encodeTime(0x12345678,0x65432100,-300)),[2,0x20,0x78,0x56,0x34,0x12,0x00,0x21,0x43,0x65,0xD4,0xFE]);
 assert.deepEqual(bytes(encodeRead(7)),[2,0x24,7,0,0,0,0,0]);
 assert.deepEqual(bytes(encodeClear(7,0xA1B2C3D4)),[2,0x25,7,0,0,0,0xD4,0xC3,0xB2,0xA1]);
 assert.throws(()=>encodeTime(0,1,0));assert.throws(()=>encodeTime(1,-1,0));assert.throws(()=>encodeTime(1,1,15*60));assert.throws(()=>encodeClear(1,0));
});
test('a deck body is flags and lengths then UTF-8 text; frames carry it in 12-byte chunks within 20 bytes',()=>{
 const entries=[{russian:'кофе',meaning:'coffee',englishFirst:false},{russian:'спасибо',meaning:'thank you',englishFirst:true}];
 const body=pocketBody(entries);
 assert.deepEqual([...body.slice(0,3)],[0,8,6]);assert.equal(new TextDecoder().decode(body.slice(3,11)),'кофе');
 const second=3+8+6;assert.deepEqual([...body.slice(second,second+3)],[1,14,9]);
 const frames=deckFrames(5,0x01020304,entries);
 const begin=frames[0];assert.equal(begin.byteLength,15);assert.equal(begin.getUint8(1),POCKET.BEGIN);assert.equal(begin.getUint32(6,true),0x01020304);
 assert.equal(begin.getUint8(10),2);assert.equal(begin.getUint16(11,true),body.length);assert.equal(begin.getUint16(13,true),crc16(body));
 const data=frames.slice(1,-1);assert.ok(data.every(f=>f.byteLength<=20&&f.getUint8(1)===POCKET.DATA));
 assert.deepEqual(data.map(f=>f.getUint8(6)),data.map((_,i)=>i));
 assert.deepEqual(data.flatMap(f=>bytes(f).slice(8,8+f.getUint8(7))),[...body]);
 assert.deepEqual(bytes(frames.at(-1)!),[2,0x23,5,0,0,0,0,0]);
});
test('a full deck of 20 long cards stays within the body and frame index limits',()=>{
 const long={russian:'я'.repeat(32),meaning:'w'.repeat(32),englishFirst:false};
 const frames=deckFrames(1,1,Array.from({length:20},()=>long));
 assert.ok(frames.length-2<=255);assert.equal(frames[0].getUint16(11,true),20*(3+64+32));assert.ok(20*(3+64+32)<=POCKET_LIMITS.body);
 assert.throws(()=>pocketBody([]));assert.throws(()=>pocketBody(Array.from({length:21},()=>long)));
 assert.throws(()=>pocketBody([{russian:'я'.repeat(33),meaning:'x',englishFirst:false}]),'Russian over 64 bytes');
 assert.throws(()=>pocketBody([{russian:'я',meaning:'w'.repeat(33),englishFirst:false}]),'meaning over 32 bytes');
 assert.throws(()=>pocketBody([{russian:'',meaning:'x',englishFirst:false}]));assert.throws(()=>pocketBody([{russian:'кофе ☕',meaning:'x',englishFirst:false}]),'only drawable text');
});
test('card text is fitted whole-character and drawable, or refused',()=>{
 assert.equal(pocketText('Спасибо!',64),'Спасибо!');assert.equal(pocketText('Да́',64),'Да');
 const fitted=pocketText('я'.repeat(40),64)!;assert.ok(new TextEncoder().encode(fitted).length<=64&&fitted.endsWith('...'));
 assert.equal(pocketText('日本',64),undefined);assert.equal(pocketText('',64),undefined);
});
test('ACK and RESULT frames decode only with exact sizes and valid fields',()=>{
 const ack=new DataView(new Uint8Array([2,0xA0,9,0,0,0,0x23,0]).buffer);assert.deepEqual(decodePocketAck(ack),{id:9,type:0x23,result:0});
 for(const bad of [[2,0xA0,9,0,0,0,0x26,0],[2,0xA0,9,0,0,0,0x23,4],[2,0x90,9,0,0,0,0x23,0],[2,0xA0,9,0,0,0,0x23]])assert.equal(decodePocketAck(new DataView(new Uint8Array(bad).buffer)),null);
 const result=(part:number,parts:number,card:number,knew:number,day:number)=>{const p=new DataView(new ArrayBuffer(16));[2,0xA4,9,0,0,0,4,3,2,1,part,parts,card,knew].forEach((b,i)=>p.setUint8(i,b));p.setUint16(14,day,true);return p;};
 assert.deepEqual(decodeResult(result(1,3,7,1,20398)),{id:9,deck:0x01020304,part:1,parts:3,answer:{card:7,knew:true,day:20398}});
 assert.deepEqual(decodeResult(result(0,0,0,0,0)),{id:9,deck:0x01020304,part:0,parts:0,answer:undefined});
 for(const bad of [result(3,3,0,1,1),result(0,21,0,1,1),result(0,1,20,1,1),result(0,1,0,2,1),result(1,0,0,0,0)])assert.equal(decodeResult(bad),null);
});
test('local day numbers round-trip with the app’s day keys; 0 is unknown',()=>{
 assert.equal(dayNumber('1970-01-02'),1);assert.equal(dayKey(dayNumber('2026-11-06')),'2026-11-06');assert.equal(dayKey(0),undefined);
 assert.equal(dayNumber('2028-02-29')-dayNumber('2028-02-28'),1);
});
