import test from 'node:test';
import assert from 'node:assert/strict';
import {CMD,DEFAULT_ENERGY,PRINTER_WIDTH,ROW_BYTES,crc8,decodeFlowControl,isCatPrinter,isRowPacket,notificationCommand,packRows,packet,printJob} from './printerProtocol.ts';
const hex=(bytes:Uint8Array)=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join(' ');
// An RGBA image filled by a per-pixel gray function.
function image(height:number,gray:(x:number,y:number)=>number,width=PRINTER_WIDTH){
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,v=gray(x,y);data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
 return {width,height,data};
}

test('packets match the tested framing and CRC-8 vectors',()=>{
 assert.equal(hex(packet(0xA4,[0x33])),'51 78 a4 00 01 00 33 99 ff');
 assert.equal(hex(packet(0xA6,[0xAA,0x55,0x17,0x38,0x44,0x5F,0x5F,0x5F,0x44,0x38,0x2C])),'51 78 a6 00 0b 00 aa 55 17 38 44 5f 5f 5f 44 38 2c a1 ff');
 assert.equal(crc8([]),0);assert.equal(hex(packet(0xA3,[0])),'51 78 a3 00 01 00 00 00 ff');
 assert.throws(()=>packet(0x100));
});
test('name matching covers the printer families, ignores case and excludes MXW01',()=>{
 for(const name of ['SC03h-438F','sc03h','GB01','GB03-12','GT01','MX05','MX06','MX10','MX11','YT01'])assert.equal(isCatPrinter(name),true,name);
 for(const name of ['MXW01','mxw01-ab','Privet-ESP32','Privet-Mini','',undefined,'iPhone'])assert.equal(isCatPrinter(name),false,String(name));
});
test('rows are 48 bytes, LSB first: the leftmost pixel is bit 0 of byte 0, and 1 burns',()=>{
 const black=new Set([0,9,383]);
 const [row]=packRows(image(1,x=>black.has(x)?0:255));
 assert.equal(row.length,ROW_BYTES);
 assert.equal(row[0],0b00000001);assert.equal(row[1],0b00000010);assert.equal(row[47],0b10000000);
 assert.equal(row.slice(2,47).every(b=>b===0),true);
 assert.throws(()=>packRows(image(1,()=>255,200)));
});
test('threshold cuts at 140 by default, and transparent pixels are paper',()=>{
 const [row]=packRows(image(1,x=>x===0?139:x===1?140:255));
 assert.equal(row[0],0b01);
 const clear={width:PRINTER_WIDTH,height:1,data:new Uint8ClampedArray(PRINTER_WIDTH*4)};
 assert.equal(packRows(clear)[0].every(b=>b===0),true);
});
const blackCount=(rows:Uint8Array[],from=0,to=PRINTER_WIDTH)=>rows.reduce((sum,row)=>{let n=0;for(let x=from;x<to;x++)if(row[x>>3]&(1<<(x&7)))n++;return sum+n;},0);
test('Floyd–Steinberg turns flat 50% gray into about half black, deterministically; threshold would not',()=>{
 const gray=image(40,()=>128);
 const rows=packRows(gray,'dither'),ratio=blackCount(rows)/(PRINTER_WIDTH*40);
 assert.ok(ratio>0.45&&ratio<0.55,String(ratio));
 assert.deepEqual(packRows(gray,'dither'),rows);
 assert.equal(blackCount(packRows(image(40,()=>150))),0);
});
test('dither regions dither only inside them; text outside stays a hard threshold',()=>{
 const rows=packRows(image(20,()=>128),'threshold',{ditherRegions:[{x:0,y:0,width:100,height:20}]});
 const inside=blackCount(rows,0,100)/(100*20);
 assert.ok(inside>0.4&&inside<0.6,String(inside));
 assert.equal(blackCount(rows,100,PRINTER_WIDTH),(PRINTER_WIDTH-100)*20); // 128 < 140: all black.
});
test('a print job follows the tested order, with energy little-endian and one A2 per row',()=>{
 const rows=packRows(image(3,()=>255));
 const job=printJob(rows);
 assert.deepEqual(job.map(p=>p[2]),[CMD.STATE,CMD.QUALITY,CMD.SPEED,CMD.ENERGY,CMD.APPLY_ENERGY,CMD.UPDATE,CMD.LATTICE,CMD.ROW,CMD.ROW,CMD.ROW,CMD.FEED,CMD.LATTICE,CMD.STATE]);
 assert.equal(DEFAULT_ENERGY,12000);
 assert.equal(hex(job[3]),`51 78 af 00 02 00 e0 2e ${crc8([0xE0,0x2E]).toString(16).padStart(2,'0')} ff`);
 assert.equal(hex(job[2]).slice(0,20),'51 78 bd 00 01 00 20');
 assert.equal(hex(job[1]),'51 78 a4 00 01 00 33 99 ff');
 assert.equal(hex(job[10]).slice(0,23),'51 78 a1 00 02 00 50 00');
 assert.equal(hex(job[11]).slice(0,50),'51 78 a6 00 0b 00 aa 55 17 00 00 00 00 00 00 00 17');
 assert.equal(job.filter(isRowPacket).length,3);
 assert.equal(hex(printJob([],{energy:20000})[3]).slice(18,23),'20 4e');
 assert.throws(()=>printJob([new Uint8Array(47)]));assert.throws(()=>printJob([],{energy:0}));assert.throws(()=>printJob([],{energy:70000}));
});
test('flow control: byte 6 is 0x10 to pause and 0x00 to resume',()=>{
 assert.equal(decodeFlowControl(new Uint8Array([0x51,0x78,0xAE,0,1,0,0x10,0x70,0xFF])),'pause');
 assert.equal(decodeFlowControl(new Uint8Array([0x51,0x78,0xAE,0,1,0,0x00,0x00,0xFF])),'resume');
 const view=new DataView(new Uint8Array([9,0x51,0x78,0xAE,0,1,0,0x10,0x70,0xFF]).buffer,1);
 assert.equal(decodeFlowControl(view),'pause');
 assert.equal(decodeFlowControl(new Uint8Array([0x51,0x78,0xA3,0,1,0,0x10,0,0xFF])),null);
 assert.equal(decodeFlowControl(new Uint8Array([0x51,0x78])),null);
});

test('a message from the printer names its command; anything else is not one',()=>{
 assert.equal(notificationCommand(new Uint8Array([0x51,0x78,0xA3,0,1,0,0,0,0xFF])),0xA3);
 assert.equal(notificationCommand(new DataView(new Uint8Array([0x51,0x78,0xAE,0,1,0,0x10,0x70,0xFF]).buffer)),0xAE);
 assert.equal(notificationCommand(new Uint8Array([0x00,0x78,0xA3])),null);
 assert.equal(notificationCommand(new Uint8Array([0x51])),null);
});
test('the printer speed goes in the job as one byte; 32 is the default',()=>{
 const speedOf=(job:Uint8Array[])=>job.find(p=>p[2]===CMD.SPEED)![6];
 assert.equal(speedOf(printJob([])),32);assert.equal(speedOf(printJob([],{speed:24})),24);
 for(const bad of [0,256,12.5])assert.throws(()=>printJob([],{speed:bad}),/speed/);
});
