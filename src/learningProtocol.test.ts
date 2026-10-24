import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cardFrames,CARD_LIMITS,DISPLAY_MODE,validateCard,fitText,encodeControl,decodeControlAck,decodeCapabilities,decodeContentAck,crc16} from './learningProtocol.ts';
import {encodeCommand,decodeAcknowledgement,type CommandCode} from './bleProtocol.ts';
const bytes=(p:DataView)=>new Uint8Array(p.buffer,p.byteOffset,p.byteLength);
test('control code 10 is separate from reactions and v1 reaction ACKs',()=>{
 const p=encodeControl(42);assert.deepEqual([...bytes(p)],[1,1,42,0,0,0,10,0]);p.setUint8(1,2);assert.deepEqual(decodeControlAck(p),{id:42,result:0});assert.equal(decodeAcknowledgement(p),null);assert.throws(()=>encodeCommand(42,10 as CommandCode));
});
test('capabilities require exact advertised limits, nonzero nonce and ready Cyrillic OLED',()=>{
 const p=new DataView(new ArrayBuffer(20));[2,0x80,42,0,0,0,7,20,96,0,64,32,1,0,0,0,0x88,0x13].forEach((b,i)=>p.setUint8(i,b));assert.deepEqual(decodeCapabilities(p),{id:42,nonce:1});
 for(const [i,value] of [[6,3],[7,21],[8,97],[10,65],[11,33],[12,0],[16,0],[19,1]]){const q=new DataView(p.buffer.slice(0));q.setUint8(i,value);assert.equal(decodeCapabilities(q),null);}
});
test('64/32/96 byte limits are UTF-8 limits and frames contain complete scalars',()=>{
 const card={mode:DISPLAY_MODE.SAFE_PROMPT,primary:'Я'.repeat(32),secondary:'a'.repeat(32)};assert.equal(validateCard(card),true);assert.equal(validateCard({...card,primary:card.primary+'а'}),false);assert.equal(validateCard({...card,secondary:'b'.repeat(33)}),false);
 const frames=cardFrames(0x12345678,99,88,card),begin=frames[0];assert.equal(begin.byteLength,20);assert.equal(begin.getUint32(2,true),0x12345678);assert.equal(begin.getUint32(6,true),99);assert.equal(begin.getUint32(10,true),88);assert.equal(begin.getUint8(15),64);assert.equal(begin.getUint8(16),32);assert.equal(begin.getUint8(17),frames.length-2);assert.equal(CARD_LIMITS.fragments,11);
 const body:number[]=[];frames.slice(1,-1).forEach((p,i)=>{assert.ok(p.byteLength<=20);assert.equal(p.getUint8(6),i);assert.equal(p.getUint8(7),p.byteLength-8);const chunk=bytes(p).slice(8);new TextDecoder('utf-8',{fatal:true}).decode(chunk);body.push(...chunk);});
 assert.equal(new TextDecoder().decode(new Uint8Array(body)),card.primary+card.secondary);assert.equal(begin.getUint16(18,true),crc16(new Uint8Array(body)));assert.deepEqual([...bytes(frames.at(-1)!)],[2,0x12,0x78,0x56,0x34,0x12,0,0]);
});
test('malformed/unrenderable text is rejected; fitting preserves Ё and complete scalar words',()=>{
 for(const primary of ['', '\ud800','\0','a\n','😀'])assert.equal(validateCard({mode:2,primary,secondary:''}),false);
 assert.equal(fitText('Ёлка́ — чай',64),'Ёлка - чай');assert.ok(new TextEncoder().encode(fitText('я'.repeat(40),64)).length<=64);assert.equal(crc16(new TextEncoder().encode('123456789')),0x29b1);
 const ack=new DataView(new Uint8Array([2,0x90,1,0,0,0,0,2]).buffer);assert.deepEqual(decodeContentAck(ack),{id:1,result:0,mode:2});ack.setUint8(6,10);assert.equal(decodeContentAck(ack),null);
});
test('scalar packing remains bounded for every mixture at maximum supported lengths',()=>{
 for(let i=0;i<=32;i++){const card={mode:2 as const,primary:'a'.repeat(64-i*2)+'я'.repeat(i),secondary:'ё'.repeat(16)};const frames=cardFrames(1,2,3,card);assert.ok(frames.length-2<=11);for(const p of frames.slice(1,-1))new TextDecoder('utf-8',{fatal:true}).decode(bytes(p).slice(8));}
});

test('documented control/card hexadecimal examples match the actual encoder and ACK decoder',()=>{
 const doc=readFileSync('docs/companion-ble.md','utf8');const example=(label:string)=>new DataView(new Uint8Array(doc.match(new RegExp('^'+label+': +([0-9A-F ]+)$','m'))![1].trim().split(' ').map(hex=>parseInt(hex,16))).buffer);
 const frames=cardFrames(11,77,9,{mode:1,primary:'чай',secondary:'tea'});for(const [index,label] of ['CARD_BEGIN','CARD_DATA','CARD_COMMIT'].entries())assert.deepEqual(bytes(example(label)),bytes(frames[index]));
 assert.deepEqual(bytes(example('CAP_REQUEST')),bytes(encodeControl(10)));assert.deepEqual(decodeContentAck(example('CARD_ACK')),{id:11,result:0,mode:1});
});
