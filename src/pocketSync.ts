// One pocket-deck sync with the keychain Mini, run once per connection after capability negotiation:
//   1. TIME: set the Mini's clock (so its answers carry the learner's day);
//   2. READ: collect its answers to the deck it holds;
//   3. if that is the deck the app sent (and still remembers), save the answers to the review schedule;
//   4. CLEAR: tell the Mini the app is done with that deck (it forgets the deck and its answers);
//   5. send today's due words as a new deck (none due: the Mini simply keeps no deck).
// Every frame goes through the transport's background slot, so lesson reactions are never delayed. A lost
// connection at any point just ends the sync: nothing is counted twice (the remembered deck is dropped as
// soon as its answers are saved) and the next connection starts again from step 1.
import {POCKET,POCKET_RESULT,decodePocketAck,decodeResult,deckFrames,encodeClear,encodeRead,encodeTime,type PocketAnswer,type PocketEntry} from './pocketProtocol.ts';
import {nextRequestId} from './bleProtocol.ts';

export type PocketLink={writeLow(packet:DataView):Promise<void>;listen(listener:(packet:DataView)=>void):()=>void};
export type PocketStore={
 // The deck the app last sent, if any (its ID), and saving the Mini's answers to it.
 pendingDeck():number|undefined;
 saveAnswers(answers:readonly PocketAnswer[]):{reviewed:number;known:number};
 // Today's new deck, and remembering it once it is on its way.
 buildDeck(id:number):PocketEntry[]|null;
 rememberDeck(id:number):void;
 forgetDeck():void;
};
export type PocketSummary={reviewed:number;known:number;sent:number};
export const POCKET_REPLY_MS=4000;

type Clock={now:()=>number;offsetMinutes:()=>number;set:(fn:()=>void,ms:number)=>unknown;clear:(id:any)=>void};
const realClock:Clock={now:()=>Date.now(),offsetMinutes:()=>-new Date().getTimezoneOffset(),set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)};
const randomDeckId=()=>{const v=new Uint32Array(1);crypto.getRandomValues(v);return v[0]||1;};

export async function syncPocket(link:PocketLink,store:PocketStore,options:{clock?:Clock;replyMs?:number;deckId?:()=>number}={}):Promise<PocketSummary>{
 const clock=options.clock??realClock,replyMs=options.replyMs??POCKET_REPLY_MS;
 // Writes a frame and waits for its ACK; `collect` sees every notification while waiting.
 async function exchange(packet:DataView,type:number,collect?:(p:DataView)=>void){
  const id=packet.getUint32(2,true);
  let stop=()=>{},timer:unknown;
  const reply=new Promise<number>((resolve,reject)=>{
   stop=link.listen(p=>{collect?.(p);const ack=decodePocketAck(p);if(ack&&ack.id===id&&ack.type===type)resolve(ack.result);});
   timer=clock.set(()=>reject(new Error('The Mini did not answer.')),replyMs);
  });
  try{await link.writeLow(packet);return await reply;}finally{stop();clock.clear(timer);}
 }
 const summary:PocketSummary={reviewed:0,known:0,sent:0};
 const time=await exchange(encodeTime(nextRequestId(),Math.floor(clock.now()/1000),clock.offsetMinutes()),POCKET.TIME);
 if(time!==POCKET_RESULT.OK)throw new Error('The Mini refused the time.');

 const read=nextRequestId(),answers:PocketAnswer[]=[];let miniDeck=0,parts=-1;const got=new Set<number>();
 const readResult=await exchange(encodeRead(read),POCKET.READ,p=>{
  const r=decodeResult(p);if(!r||r.id!==read)return;
  miniDeck=r.deck;parts=r.parts;
  if(r.answer&&!got.has(r.part)){got.add(r.part);answers.push(r.answer);}
 });
 if(readResult!==POCKET_RESULT.OK||parts<0||got.size!==parts)throw new Error('The Mini’s answers did not all arrive.');
 // Only answers to the deck the app remembers count; anything else (an old or unknown deck) is cleared.
 const pending=store.pendingDeck();
 if(answers.length&&pending!==undefined&&miniDeck===pending){const saved=store.saveAnswers(answers);summary.reviewed=saved.reviewed;summary.known=saved.known;}
 if(pending!==undefined)store.forgetDeck();
 if(miniDeck){
  const cleared=await exchange(encodeClear(nextRequestId(),miniDeck),POCKET.CLEAR);
  if(cleared!==POCKET_RESULT.OK&&cleared!==POCKET_RESULT.REJECTED)throw new Error('The Mini could not clear its deck.');
 }

 const deckId=(options.deckId??randomDeckId)(),entries=store.buildDeck(deckId);
 if(!entries)return summary;
 const frames=deckFrames(nextRequestId(),deckId,entries);
 for(const frame of frames.slice(0,-1))await link.writeLow(frame);
 // Remembered before COMMIT: if its ACK is lost but the Mini kept the deck, its answers still count later.
 store.rememberDeck(deckId);
 const committed=await exchange(frames.at(-1)!,POCKET.COMMIT);
 if(committed!==POCKET_RESULT.OK){store.forgetDeck();throw new Error('The Mini refused the deck.');}
 summary.sent=entries.length;
 return summary;
}
