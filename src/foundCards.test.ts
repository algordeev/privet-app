import test from 'node:test';
import assert from 'node:assert/strict';
import {foundCardFree,holdFoundCard,offeredPrinter} from './foundCards.ts';
test('home offers the remembered printer when auto-reconnect is off, and skips it only while it reconnects by itself',()=>{
 const mine={deviceId:'mine',name:'SC03h-438F'},other={deviceId:'other',name:'GB03'};
 assert.equal(offeredPrinter([mine],undefined),mine);
 assert.equal(offeredPrinter([mine],'mine'),undefined);
 assert.equal(offeredPrinter([mine,other],'mine'),other);
 assert.equal(offeredPrinter([],undefined),undefined);
});
test('only one found card is open at a time',()=>{
 assert.equal(foundCardFree('printer'),true);
 holdFoundCard('companion',true);
 assert.equal(foundCardFree('printer'),false);assert.equal(foundCardFree('companion'),true);
 holdFoundCard('printer',false);assert.equal(foundCardFree('printer'),false);
 holdFoundCard('companion',false);assert.equal(foundCardFree('printer'),true);
});
