// BLE thermal "cat" printers (57 mm, 384 px heads): GB01/GB02/GB03/GT01/MX05/MX06/MX08/MX10/MX11/YT01 and
// the SC03h family. Tested on an SC03h with energy 12000, speed 32, quality 0x33, LSB-first rows.
// MXW01 uses a different protocol and is deliberately not matched.
export const PRINTER_SERVICE='0000ae30-0000-1000-8000-00805f9b34fb';
// Written without response; the printer parses a byte stream.
export const PRINTER_WRITE='0000ae01-0000-1000-8000-00805f9b34fb';
// Status and flow control notifications.
export const PRINTER_NOTIFY='0000ae02-0000-1000-8000-00805f9b34fb';
// These printers don't reliably advertise their service: scan unfiltered and match the name.
export const PRINTER_NAME_PREFIXES=['SC03','GB0','GT01','MX0','MX1','YT01'] as const;
const EXCLUDED_NAMES=['MXW01'] as const;
export function isCatPrinter(name?:string){
 const upper=name?.trim().toUpperCase();
 if(!upper||EXCLUDED_NAMES.some(prefix=>upper.startsWith(prefix)))return false;
 return PRINTER_NAME_PREFIXES.some(prefix=>upper.startsWith(prefix));
}

export const PRINTER_WIDTH=384;
export const ROW_BYTES=PRINTER_WIDTH/8;
export const CMD={STATE:0xA3,QUALITY:0xA4,SPEED:0xBD,ENERGY:0xAF,APPLY_ENERGY:0xBE,UPDATE:0xA9,LATTICE:0xA6,ROW:0xA2,FEED:0xA1,FLOW:0xAE} as const;
export const LATTICE_START=[0xAA,0x55,0x17,0x38,0x44,0x5F,0x5F,0x5F,0x44,0x38,0x2C] as const;
export const LATTICE_END=[0xAA,0x55,0x17,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x17] as const;
// Print darkness: 12000 is the tested "normal" (lighter ~8000, darker ~20000; the app always uses normal).
export const DEFAULT_ENERGY=12000;

// CRC-8, polynomial 0x07, init 0, no reflection, no final XOR, over the data bytes only.
export function crc8(data:ArrayLike<number>){
 let crc=0;
 for(let i=0;i<data.length;i++){
  crc^=data[i]&0xFF;
  for(let bit=0;bit<8;bit++)crc=crc&0x80?((crc<<1)^0x07)&0xFF:(crc<<1)&0xFF;
 }
 return crc;
}
// 51 78 | cmd | 00 | len_lo len_hi | data... | crc8(data) | FF
export function packet(cmd:number,data:ArrayLike<number>=[]):Uint8Array{
 if(!Number.isInteger(cmd)||cmd<0||cmd>0xFF)throw new Error('Invalid printer command');
 if(data.length>0xFFFF)throw new Error('Printer packet too long');
 const out=new Uint8Array(data.length+8);
 out.set([0x51,0x78,cmd,0x00,data.length&0xFF,data.length>>8]);
 out.set(Array.from(data,byte=>byte&0xFF),6);
 out[6+data.length]=crc8(data);out[7+data.length]=0xFF;
 return out;
}
const uint16=(value:number)=>[value&0xFF,(value>>8)&0xFF];

// Flow control: 51 78 AE 00 01 00 10 .. FF pauses sending, 51 78 AE 00 01 00 00 .. FF resumes it.
export function decodeFlowControl(value:DataView|Uint8Array):'pause'|'resume'|null{
 const bytes=value instanceof Uint8Array?value:new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
 if(bytes.length<7||bytes[0]!==0x51||bytes[1]!==0x78||bytes[2]!==CMD.FLOW)return null;
 return bytes[6]===0x10?'pause':bytes[6]===0x00?'resume':null;
}

export type GrayImage={width:number;height:number;data:ArrayLike<number>};
export type Region={x:number;y:number;width:number;height:number};
export type PackMode='threshold'|'dither';
// Luminance 0 (black) … 255 (white) of an RGBA image composited on white paper.
export function luminance(image:GrayImage):Float32Array{
 const {width,height,data}=image;
 if(data.length!==width*height*4)throw new Error('Image data must be RGBA');
 const out=new Float32Array(width*height);
 for(let i=0;i<out.length;i++){
  const r=data[i*4],g=data[i*4+1],b=data[i*4+2],a=data[i*4+3]/255;
  out[i]=255-a*(255-(0.299*r+0.587*g+0.114*b));
 }
 return out;
}
// One 48-byte row per image row. Pixel x goes to byte x>>3, bit x&7 (LSB first = leftmost); 1 burns.
// threshold: hard cut for text and line art. dither: Floyd–Steinberg for photos and gradients.
// In threshold mode, ditherRegions are dithered too (e.g. a receipt's bars beside its crisp text).
export function packRows(image:GrayImage,mode:PackMode='threshold',{threshold=140,ditherRegions=[]}:{threshold?:number;ditherRegions?:readonly Region[]}={}):Uint8Array[]{
 const {width,height}=image;
 if(width!==PRINTER_WIDTH)throw new Error(`Printer images must be ${PRINTER_WIDTH} px wide`);
 if(!Number.isInteger(height)||height<0)throw new Error('Invalid image height');
 const light=luminance(image);
 const dithered=(x:number,y:number)=>mode==='dither'||ditherRegions.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
 const rows:Uint8Array[]=[];
 for(let y=0;y<height;y++){
  const row=new Uint8Array(ROW_BYTES);
  for(let x=0;x<width;x++){
   const i=y*width+x,value=light[i];
   let black:boolean;
   if(dithered(x,y)){
    black=value<128;
    const error=value-(black?0:255);
    // Error spreads only to pixels that are dithered themselves.
    const spread=(dx:number,dy:number,weight:number)=>{
     const nx=x+dx,ny=y+dy;
     if(nx>=0&&nx<width&&ny<height&&dithered(nx,ny))light[ny*width+nx]+=error*weight;
    };
    spread(1,0,7/16);spread(-1,1,3/16);spread(0,1,5/16);spread(1,1,1/16);
   }else black=value<threshold;
   if(black)row[x>>3]|=1<<(x&7);
  }
  rows.push(row);
 }
 return rows;
}

export type JobOptions={energy?:number;speed?:number;quality?:number;feed?:number};
// A3, A4, BD, AF, BE, A9, A6(start), one A2 per row, A1(feed), A6(end), A3.
export function printJob(rows:readonly Uint8Array[],{energy=DEFAULT_ENERGY,speed=32,quality=0x33,feed=80}:JobOptions={}):Uint8Array[]{
 if(!Number.isInteger(energy)||energy<1||energy>0xFFFF)throw new Error('Invalid printer energy');
 if(!Number.isInteger(feed)||feed<0||feed>0xFFFF)throw new Error('Invalid feed');
 for(const row of rows)if(row.length!==ROW_BYTES)throw new Error(`Printer rows must be ${ROW_BYTES} bytes`);
 return [
  packet(CMD.STATE,[0x00]),packet(CMD.QUALITY,[quality]),packet(CMD.SPEED,[speed]),
  packet(CMD.ENERGY,uint16(energy)),packet(CMD.APPLY_ENERGY,[0x01]),packet(CMD.UPDATE,[0x00]),
  packet(CMD.LATTICE,LATTICE_START),
  ...rows.map(row=>packet(CMD.ROW,row)),
  packet(CMD.FEED,uint16(feed)),packet(CMD.LATTICE,LATTICE_END),packet(CMD.STATE,[0x00]),
 ];
}
export const latticeEnd=()=>packet(CMD.LATTICE,LATTICE_END);
export const isRowPacket=(value:Uint8Array)=>value.length===ROW_BYTES+8&&value[2]===CMD.ROW;
