import test from 'node:test';
import assert from 'node:assert/strict';
import {crc16} from './learningProtocol.ts';
import {POCKET,type PocketAnswer,type PocketEntry} from './pocketProtocol.ts';
import {syncPocket,type PocketLink,type PocketStore} from './pocketSync.ts';

// A simulated Mini following PocketDeck.h's rules, answering through the link like the firmware.
function fakeMini(initial:{deck?:number;cards?:number;answers?:PocketAnswer[]}={}){
 let deck=initial.deck??0,cards=initial.cards??0,answers=[...(initial.answers??[])];
 let begin:{id:number;deck:number;count:number;length:number;crc:number}|undefined,body:number[]=[];
 const listeners=new Set<(p:DataView)=>void>(),log:string[]=[];
 let failNext:number|undefined,silent=false,dropAfter:number|undefined;
 const send=(bytes:number[])=>{const p=new DataView(Uint8Array.from(bytes).buffer);for(const l of [...listeners])l(p);};
 const le=(v:number)=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255];
 const ack=(id:number,type:number,result:number)=>send([2,0xA0,...le(id),type,result]);
 const link:PocketLink={
  listen(l){listeners.add(l);return ()=>{listeners.delete(l);};},
  async writeLow(p){
   const type=p.getUint8(1),id=p.getUint32(2,true);log.push(type.toString(16));
   if(dropAfter!==undefined&&log.length>dropAfter)throw new Error('Connection changed');
   await Promise.resolve();
   if(silent)return;
   if(failNext===type){failNext=undefined;ack(id,type,2);return;}
   if(type===POCKET.TIME)ack(id,type,0);
   if(type===POCKET.READ){
    if(!answers.length)send([2,0xA4,...le(id),...le(deck),0,0,0,0,0,0]);
    answers.forEach((a,i)=>send([2,0xA4,...le(id),...le(deck),i,answers.length,a.card,a.knew?1:0,a.day&255,a.day>>8]));
    ack(id,type,0);
   }
   if(type===POCKET.CLEAR){if(p.getUint32(6,true)===deck){deck=0;cards=0;answers=[];ack(id,type,0);}else ack(id,type,2);}
   if(type===POCKET.BEGIN){begin={id,deck:p.getUint32(6,true),count:p.getUint8(10),length:p.getUint16(11,true),crc:p.getUint16(13,true)};body=[];}
   if(type===POCKET.DATA)for(let i=0;i<p.getUint8(7);i++)body.push(p.getUint8(8+i));
   if(type===POCKET.COMMIT){
    const ok=begin&&begin.id===id&&body.length===begin.length&&crc16(Uint8Array.from(body))===begin.crc&&!answers.length;
    if(ok){deck=begin!.deck;cards=begin!.count;}
    ack(id,type,ok?0:2);
   }
  }
 };
 return {link,log,get deck(){return deck;},get cards(){return cards;},fail(type:number){failNext=type;},silence(){silent=true;},dropAfter(n:number){dropAfter=n;}};
}
function store(pending?:number,entries:PocketEntry[]|null=[{russian:'кофе',meaning:'coffee',englishFirst:false}]){
 const saved:PocketAnswer[][]=[];let remembered=pending;
 const s:PocketStore&{saved:PocketAnswer[][];remembered:()=>number|undefined}={
  saved,remembered:()=>remembered,
  pendingDeck:()=>remembered,
  saveAnswers(a){saved.push([...a]);return {reviewed:a.length,known:a.filter(x=>x.knew).length};},
  buildDeck:()=>entries,
  rememberDeck(id){remembered=id;},forgetDeck(){remembered=undefined;},
 };
 return s;
}
const clock={now:()=>Date.UTC(2026,10,6,9),offsetMinutes:()=>120,set:(fn:()=>void,ms:number)=>setTimeout(fn,ms),clear:(id:any)=>clearTimeout(id)};

test('first sync: time, read (nothing), then today’s deck; the deck is remembered',async()=>{
 const mini=fakeMini(),st=store();
 const summary=await syncPocket(mini.link,st,{clock,deckId:()=>41});
 assert.deepEqual(summary,{reviewed:0,known:0,sent:1});
 assert.deepEqual(mini.log,['20','24','21','22','22','23'],'17 body bytes: two DATA frames');
 assert.equal(mini.deck,41);assert.equal(st.remembered(),41);
});
test('answers to the remembered deck are saved once, the deck cleared, and a new one sent',async()=>{
 const answers=[{card:0,knew:true,day:20763},{card:1,knew:false,day:20763},{card:2,knew:true,day:0}];
 const mini=fakeMini({deck:41,cards:3,answers}),st=store(41);
 const summary=await syncPocket(mini.link,st,{clock,deckId:()=>42});
 assert.deepEqual(summary,{reviewed:3,known:2,sent:1});
 assert.deepEqual(st.saved,[answers]);assert.deepEqual(mini.log,['20','24','25','21','22','22','23']);
 assert.equal(mini.deck,42);assert.equal(st.remembered(),42);
});
test('answers to a deck the app does not remember are cleared, never saved',async()=>{
 const mini=fakeMini({deck:7,cards:2,answers:[{card:0,knew:true,day:1}]}),st=store(41);
 const summary=await syncPocket(mini.link,st,{clock,deckId:()=>43});
 assert.equal(summary.reviewed,0);assert.deepEqual(st.saved,[]);assert.equal(mini.deck,43);
});
test('nothing due: the old deck is cleared and none is sent',async()=>{
 const mini=fakeMini({deck:41,cards:3}),st=store(41,null);
 const summary=await syncPocket(mini.link,st,{clock});
 assert.deepEqual(summary,{reviewed:0,known:0,sent:0});assert.equal(mini.deck,0);assert.equal(st.remembered(),undefined);
 assert.deepEqual(mini.log,['20','24','25']);
});
test('a refused deck is forgotten; a silent Mini or a lost connection ends the sync without counting twice',async()=>{
 const refused=fakeMini(),st=store();refused.fail(POCKET.COMMIT);
 await assert.rejects(syncPocket(refused.link,st,{clock,deckId:()=>9}),/refused the deck/);assert.equal(st.remembered(),undefined);
 const quiet=fakeMini();quiet.silence();
 await assert.rejects(syncPocket(quiet.link,store(),{clock,replyMs:20}),/did not answer/);
 // Lost right after the answers were saved, before CLEAR: they are not saved again next time.
 const answers=[{card:0,knew:true,day:5}];
 const lost=fakeMini({deck:41,cards:1,answers}),st2=store(41);lost.dropAfter(2);
 await assert.rejects(syncPocket(lost.link,st2,{clock}));
 assert.equal(st2.saved.length,1);assert.equal(st2.remembered(),undefined);
 const again=fakeMini({deck:41,cards:1,answers});await syncPocket(again.link,st2,{clock,deckId:()=>50});
 assert.equal(st2.saved.length,1,'the same answers are not saved twice');assert.equal(again.deck,50);
});
