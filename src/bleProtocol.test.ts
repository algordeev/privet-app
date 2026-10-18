import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeHappy,encodeCommand,COMMAND,decodeAcknowledgement,nextRequestId} from './bleProtocol.ts';
const bytes=(view:DataView)=>Array.from(new Uint8Array(view.buffer,view.byteOffset,view.byteLength));
test('happy packet is exactly eight bytes with a little-endian unsigned request ID',()=>{
 assert.deepEqual(bytes(encodeHappy(0x12345678)),[1,1,0x78,0x56,0x34,0x12,1,0]);
 assert.equal(encodeHappy(0xffffffff).getUint32(2,true),0xffffffff);
 for(const id of [0,-1,1.5,NaN,0x100000000])assert.throws(()=>encodeHappy(id));
});
test('acknowledgements decode little-endian IDs, result codes, and sliced DataViews',()=>{
 for(const result of [0,1,2]){
  const buffer=Uint8Array.from([9,9,1,2,0x78,0x56,0x34,0x12,1,result,9]);
  assert.deepEqual(decodeAcknowledgement(new DataView(buffer.buffer,2,8)),{requestId:0x12345678,command:1,result});
 }
});
test('malformed sizes, versions, message types, commands and results are rejected',()=>{
 for(const size of [0,1,7,9,100])assert.equal(decodeAcknowledgement(new DataView(new ArrayBuffer(size))),null);
 const packet=encodeHappy(1);assert.equal(decodeAcknowledgement(packet),null);packet.setUint8(1,2);
 for(const [offset,value] of [[0,2],[1,0],[1,3],[6,0],[6,10],[6,255],[7,3],[7,255]]){
  const bad=new DataView(packet.buffer.slice(0));bad.setUint8(offset,value);assert.equal(decodeAcknowledgement(bad),null);
 }
});
test('request IDs remain distinct across controller instances during the process lifetime',()=>{
 const ids=Array.from({length:1000},()=>nextRequestId());assert.equal(new Set(ids).size,1000);
 for(let i=1;i<ids.length;i++)assert.equal(ids[i],ids[i-1]+1);
});

test('all nine commands preserve version, eight-byte format and argument zero; ACK echoes each code',()=>{
 assert.deepEqual(Object.values(COMMAND),[1,2,3,4,5,6,7,8,9]);
 for(const command of Object.values(COMMAND)){
  const packet=encodeCommand(0x12345678,command);
  assert.deepEqual(bytes(packet),[1,1,0x78,0x56,0x34,0x12,command,0]);
  packet.setUint8(1,2);assert.equal(decodeAcknowledgement(packet)?.command,command);
 }
 for(const code of [0,10,255,-1,1.5,NaN])assert.throws(()=>encodeCommand(1,code as never));
});
