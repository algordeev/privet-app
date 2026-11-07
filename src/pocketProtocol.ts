// Pocket review deck: the app copies today's due words onto the keychain Mini, which quizzes the learner
// off the phone and hands the answers back on the next connection. Only firmware advertising capability
// bit 32 (POCKET) receives these. All frames are version 2 (like learning cards) and at most 20 bytes.
//
// App -> Mini (written with response):
//   TIME   [2, 0x20, id u32, unix seconds u32, local offset minutes i16]                    12 bytes
//   BEGIN  [2, 0x21, id u32, deck u32, count u8, body length u16, CRC-16 u16]                15 bytes
//   DATA   [2, 0x22, id u32, index u8, length u8, up to 12 body bytes]                     <=20 bytes
//   COMMIT [2, 0x23, id u32, 0, 0]                                                            8 bytes
//   READ   [2, 0x24, id u32, 0, 0]                                                            8 bytes
//   CLEAR  [2, 0x25, id u32, deck u32]                                                       10 bytes
// Mini -> App (notifications):
//   ACK    [2, 0xA0, id u32, frame type, result]                                              8 bytes
//   RESULT [2, 0xA4, id u32, deck u32, part u8, parts u8, card u8, knew u8, day u16]         16 bytes
// TIME, COMMIT, READ and CLEAR are acknowledged; BEGIN and DATA only on error (the COMMIT result covers
// them). READ is answered by `parts` RESULT frames (one per answered card, parts 0..19), or one frame with
// parts = 0 when there is nothing to report, then its ACK. `deck` is the Mini's current deck (0: none).
// `day` is the learner's local day number (days since 1970-01-01) when the card was answered, 0 if the
// Mini's clock was unknown. CLEAR tells the Mini the app has saved those answers and is done with that
// deck: it forgets both, and the app sends today's new deck straight after.
//
// Deck body, one entry per card in order: [flags u8, Russian length u8, meaning length u8, Russian, meaning]
// (Russian up to 64 bytes, the meaning up to 32, like learning cards). Flag bit 0: the card shows the
// meaning first and asks for the Russian (recall); otherwise it shows the Russian first (recognition).
// Flipped, a card always shows the Russian large with the meaning below.
import {crc16,fitText,validText} from './learningProtocol.ts';

export const POCKET={TIME:0x20,BEGIN:0x21,DATA:0x22,COMMIT:0x23,READ:0x24,CLEAR:0x25,ACK:0xA0,RESULT:0xA4} as const;
export const POCKET_LIMITS={cards:20,russian:64,meaning:32,data:12,body:20*(3+64+32)} as const;
// ACK results: 0 done, 1 unsupported or malformed, 2 deck rejected (size, order or CRC), 3 storage failed.
export const POCKET_RESULT={OK:0,BAD:1,REJECTED:2,STORAGE:3} as const;
export const POCKET_ENGLISH_FIRST=1;
export type PocketEntry={russian:string;meaning:string;englishFirst:boolean};
export type PocketAnswer={card:number;knew:boolean;day:number};

const encoder=new TextEncoder();
function frame(length:number,type:number,id:number){
 if(!Number.isInteger(id)||id<1||id>0xffffffff)throw new Error('Invalid request ID');
 const p=new DataView(new ArrayBuffer(length));p.setUint8(0,2);p.setUint8(1,type);p.setUint32(2,id,true);return p;
}
const validDeck=(deck:number)=>Number.isInteger(deck)&&deck>=1&&deck<=0xffffffff;

export function encodeTime(id:number,unixSeconds:number,offsetMinutes:number){
 if(!Number.isInteger(unixSeconds)||unixSeconds<0||unixSeconds>0xffffffff||!Number.isInteger(offsetMinutes)||Math.abs(offsetMinutes)>14*60)throw new Error('Invalid time');
 const p=frame(12,POCKET.TIME,id);p.setUint32(6,unixSeconds,true);p.setInt16(10,offsetMinutes,true);return p;
}
// Card text the Mini can draw: printable ASCII and Cyrillic, cut at a whole character if too long.
export function pocketText(text:string,limit:number){const fitted=fitText(text,limit);return validText(fitted)&&fitted.length>0?fitted:undefined;}
export function pocketBody(entries:readonly PocketEntry[]){
 if(entries.length<1||entries.length>POCKET_LIMITS.cards)throw new Error('Invalid deck size');
 const bytes:number[]=[];
 for(const entry of entries){
  const russian=encoder.encode(entry.russian),meaning=encoder.encode(entry.meaning);
  if(!russian.length||!meaning.length||russian.length>POCKET_LIMITS.russian||meaning.length>POCKET_LIMITS.meaning||!validText(entry.russian)||!validText(entry.meaning))throw new Error('Invalid card text');
  bytes.push(entry.englishFirst?POCKET_ENGLISH_FIRST:0,russian.length,meaning.length,...russian,...meaning);
 }
 return Uint8Array.from(bytes);
}
// BEGIN, DATA... and COMMIT for one deck. Chunks may split a character: the Mini reassembles and checks
// the whole body before reading it.
export function deckFrames(id:number,deck:number,entries:readonly PocketEntry[]){
 if(!validDeck(deck))throw new Error('Invalid deck ID');
 const body=pocketBody(entries),chunks:Uint8Array[]=[];
 for(let at=0;at<body.length;at+=POCKET_LIMITS.data)chunks.push(body.slice(at,at+POCKET_LIMITS.data));
 const begin=frame(15,POCKET.BEGIN,id);begin.setUint32(6,deck,true);begin.setUint8(10,entries.length);begin.setUint16(11,body.length,true);begin.setUint16(13,crc16(body),true);
 const data=chunks.map((chunk,index)=>{const p=frame(8+chunk.length,POCKET.DATA,id);p.setUint8(6,index);p.setUint8(7,chunk.length);chunk.forEach((b,i)=>p.setUint8(8+i,b));return p;});
 return [begin,...data,frame(8,POCKET.COMMIT,id)];
}
export function encodeRead(id:number){return frame(8,POCKET.READ,id);}
export function encodeClear(id:number,deck:number){if(!validDeck(deck))throw new Error('Invalid deck ID');const p=frame(10,POCKET.CLEAR,id);p.setUint32(6,deck,true);return p;}

export function decodePocketAck(p:DataView){
 if(p.byteLength!==8||p.getUint8(0)!==2||p.getUint8(1)!==POCKET.ACK||p.getUint8(6)<POCKET.TIME||p.getUint8(6)>POCKET.CLEAR||p.getUint8(7)>3)return null;
 return {id:p.getUint32(2,true),type:p.getUint8(6),result:p.getUint8(7)};
}
export function decodeResult(p:DataView){
 if(p.byteLength!==16||p.getUint8(0)!==2||p.getUint8(1)!==POCKET.RESULT)return null;
 const part=p.getUint8(10),parts=p.getUint8(11),card=p.getUint8(12),knew=p.getUint8(13);
 if(parts>POCKET_LIMITS.cards||(parts===0?part!==0:part>=parts)||card>=POCKET_LIMITS.cards||knew>1)return null;
 return {id:p.getUint32(2,true),deck:p.getUint32(6,true),part,parts,answer:parts?{card,knew:knew===1,day:p.getUint16(14,true)}:undefined};
}
// Local day number <-> 'YYYY-MM-DD' (the app's day keys). 0 means unknown.
export function dayNumber(day:string){const t=Date.parse(`${day}T00:00:00Z`);return Number.isNaN(t)?0:Math.round(t/86400000);}
export function dayKey(n:number){return n>0?new Date(n*86400000).toISOString().slice(0,10):undefined;}
