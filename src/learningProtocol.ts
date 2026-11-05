// Capability control is deliberately separate from the nine reaction commands.
export const CAPABILITIES=10 as const;
export const CARD_LIMITS={primary:64,secondary:32,combined:96,frame:20,data:12,fragments:Math.ceil(96/(12-3)),transfer:3500,ack:2000,reassembly:5000} as const;
export const DISPLAY_MODE={DISCOVERY:1,SAFE_PROMPT:2,PRONUNCIATION:3,HINT:4,ANSWER:5} as const;
export type DisplayMode=typeof DISPLAY_MODE[keyof typeof DISPLAY_MODE];
export type LearningCard={mode:DisplayMode;primary:string;secondary:string};
// reactions: the firmware accepts the extended reactions 11 NOD and 12 ON_FIRE (feature bit 8).
// sound: it has working sound and accepts control code 13 SET_VOLUME (feature bit 16).
export type Capabilities={nonce:number;reactions:boolean;sound:boolean};
const encoder=new TextEncoder();
export function displayText(value:string){return value.normalize('NFD').replace(/\u0301/g,'').normalize('NFC').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/…/g,'...');}
export function validText(text:string){return !/[\uD800-\uDFFF]/u.test(text)&&Array.from(text).every(c=>{const n=c.codePointAt(0)!;return n>=32&&n<=126||n>=0x410&&n<=0x44f||n===0x401||n===0x451;});}
export function validateCard(card:LearningCard){const a=encoder.encode(card.primary).length,b=encoder.encode(card.secondary).length;return [1,2,3,4,5].includes(card.mode)&&validText(card.primary)&&validText(card.secondary)&&a>0&&a<=64&&b<=32&&a+b<=96;}
// Ellipsis only at scalar boundaries; never send a partial Cyrillic encoding.
export function fitText(text:string,limit:number){const clean=displayText(text);if(encoder.encode(clean).length<=limit)return clean;let result='';for(const c of clean){if(encoder.encode(result+c).length>limit-3)break;result+=c;}return result.trimEnd()+'...';}
function packet(length:number,type:number,id:number){if(!Number.isInteger(id)||id<1||id>0xffffffff)throw new Error('Invalid request ID');const p=new DataView(new ArrayBuffer(length));p.setUint8(0,2);p.setUint8(1,type);p.setUint32(2,id,true);return p;}
export function encodeControl(id:number,command:typeof CAPABILITIES=CAPABILITIES){if(command!==CAPABILITIES)throw new Error('Invalid control command');const p=packet(8,1,id);p.setUint8(0,1);p.setUint8(6,command);return p;}
export function decodeControlAck(p:DataView){return p.byteLength===8&&p.getUint8(0)===1&&p.getUint8(1)===2&&p.getUint8(6)===10&&p.getUint8(7)<=2?{id:p.getUint32(2,true),result:p.getUint8(7)}:null;}
export function decodeCapabilities(p:DataView){if(p.byteLength!==20||p.getUint8(0)!==2||p.getUint8(1)!==0x80||(p.getUint8(6)&7)!==7||(p.getUint8(6)&~31)!==0||p.getUint8(7)!==20||p.getUint16(8,true)!==96||p.getUint8(10)!==64||p.getUint8(11)!==32||p.getUint32(12,true)===0||p.getUint16(16,true)!==5000||p.getUint16(18,true)!==0)return null;return {id:p.getUint32(2,true),nonce:p.getUint32(12,true),reactions:(p.getUint8(6)&8)!==0,sound:(p.getUint8(6)&16)!==0};}
export function decodeContentAck(p:DataView){if(p.byteLength!==8||p.getUint8(0)!==2||p.getUint8(1)!==0x90||p.getUint8(6)>9||p.getUint8(7)>5)return null;return {id:p.getUint32(2,true),result:p.getUint8(6),mode:p.getUint8(7)};}
export function crc16(bytes:Uint8Array){let crc=0xffff;for(const byte of bytes){crc^=byte<<8;for(let i=0;i<8;i++)crc=(crc&0x8000)?(crc<<1)^0x1021:crc<<1;crc&=0xffff;}return crc;}
export function cardFrames(id:number,nonce:number,faceId:number,card:LearningCard){
 if(!validateCard(card)||!Number.isInteger(nonce)||nonce<1||nonce>0xffffffff||!Number.isInteger(faceId)||faceId<1||faceId>0xffffffff)throw new Error('Invalid learning card');
 const chunks:number[][]=[];let chunk:number[]=[];
 for(const scalar of card.primary+card.secondary){const bytes=[...encoder.encode(scalar)];if(chunk.length+bytes.length>12){chunks.push(chunk);chunk=[];}chunk.push(...bytes);}if(chunk.length)chunks.push(chunk);
 if(chunks.length>11)throw new Error('Too many fragments');
 const body=encoder.encode(card.primary+card.secondary),begin=packet(20,0x10,id);begin.setUint32(6,nonce,true);begin.setUint32(10,faceId,true);begin.setUint8(14,card.mode);begin.setUint8(15,encoder.encode(card.primary).length);begin.setUint8(16,encoder.encode(card.secondary).length);begin.setUint8(17,chunks.length);begin.setUint16(18,crc16(body),true);
 const data=chunks.map((bytes,index)=>{const p=packet(8+bytes.length,0x11,id);p.setUint8(6,index);p.setUint8(7,bytes.length);bytes.forEach((b,i)=>p.setUint8(8+i,b));return p;});
 return [begin,...data,packet(8,0x12,id)];
}
