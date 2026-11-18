// Draws the printed learning cards on an offscreen 384 px canvas (white paper, black ink only), then
// packs them into printer rows. Text stays at 16 px or more: thermal paper blurs thin strokes. Stress
// marks are ordinary U+0301 combining accents in the text.
import {PRINTER_WIDTH,packRows,type Region} from './printerProtocol.ts';
import type {PracticeStrip,Receipt,WordCard} from './printContent.ts';

export type Rendered={canvas:HTMLCanvasElement;rows:Uint8Array[];height:number};
const W=PRINTER_WIDTH,PAD=16,INNER=W-PAD*2,MAX_HEIGHT=4000;
// The system font draws Cyrillic and combining accents well in WKWebView.
const FAMILY='system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';
type Ctx=CanvasRenderingContext2D;
type Align='left'|'center'|'right';
// Stress marks are drawn by hand: U+0301 lands beside the vowel in some engines and fonts (seen in
// Chromium with the system font). The accent is stripped from the text and stroked above its vowel.
const ACCENT='\u0301';
const plainText=(text:string)=>text.split(ACCENT).join('');
const measure=(ctx:Ctx,text:string)=>ctx.measureText(plainText(text)).width;
const fontSize=(ctx:Ctx)=>Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1]??16);
export function fillStressed(ctx:Ctx,text:string,x:number,y:number){
 const plain=plainText(text),width=ctx.measureText(plain).width,align=ctx.textAlign;
 const left=align==='center'?x-width/2:align==='right'||align==='end'?x-width:x;
 ctx.textAlign='left';ctx.fillText(plain,left,y);
 if(text.includes(ACCENT)){
  const size=fontSize(ctx);let offset=0;
  ctx.save();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=Math.max(2,size*0.085);ctx.lineCap='round';ctx.setLineDash([]);
  for(let i=0;i<text.length;i++){
   if(text[i]===ACCENT)continue;
   const vowel=text[i];
   if(text[i+1]===ACCENT){
    const before=ctx.measureText(plain.slice(0,offset)).width,w=ctx.measureText(vowel).width,cx=left+before+w/2;
    const top=y-size*(vowel!==vowel.toLowerCase()?0.73:0.54);
    ctx.beginPath();ctx.moveTo(cx-size*0.05,top-size*0.08);ctx.lineTo(cx+size*0.11,top-size*0.3);ctx.stroke();
   }
   offset++;
  }
  ctx.restore();
 }
 ctx.textAlign=align;
}

const font=(ctx:Ctx,size:number,weight=400,style='')=>{ctx.font=`${style} ${weight} ${Math.max(16,size)}px ${FAMILY}`.trim();};

class Card {
 ctx:Ctx;canvas:HTMLCanvasElement;y=PAD;dither:Region[]=[];
 constructor(){
  this.canvas=document.createElement('canvas');this.canvas.width=W;this.canvas.height=MAX_HEIGHT;
  const ctx=this.canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Canvas unavailable');
  this.ctx=ctx;ctx.fillStyle='#fff';ctx.fillRect(0,0,W,MAX_HEIGHT);ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.textBaseline='alphabetic';
 }
 gap(px:number){this.y+=px;}
 // Wrapped text; returns the lines drawn.
 text(value:string,{size=18,weight=400,align='left' as Align,x=PAD,width=INNER,style='',lineHeight=1.3}={}){
  const ctx=this.ctx;font(ctx,size,weight,style);ctx.textAlign=align;
  const lines=wrap(ctx,value,width),height=Math.round(Math.max(16,size)*lineHeight);
  const at=align==='center'?x+width/2:align==='right'?x+width:x;
  for(const line of lines){this.y+=height;fillStressed(ctx,line,at,this.y-Math.round(height*0.22));}
  ctx.textAlign='left';
  return lines;
 }
 // The largest size (down to min) at which the text fits on one line.
 fit(value:string,max:number,min:number,weight=700,width=INNER){let size=max;font(this.ctx,size,weight);while(size>min&&measure(this.ctx,value)>width){size-=2;font(this.ctx,size,weight);}return size;}
 rule(dashed=false,weight=2){
  const ctx=this.ctx;ctx.lineWidth=weight;ctx.setLineDash(dashed?[8,6]:[]);
  ctx.beginPath();ctx.moveTo(PAD,this.y+weight/2);ctx.lineTo(W-PAD,this.y+weight/2);ctx.stroke();ctx.setLineDash([]);this.y+=weight;
 }
 // Label …… value, like a shop receipt.
 leader(label:string,value:string,size=18){
  const ctx=this.ctx;font(ctx,size,500);
  const lw=measure(ctx,label);font(ctx,size,700);const vw=measure(ctx,value);
  this.y+=Math.round(size*1.45);const base=this.y-Math.round(size*0.3);
  font(ctx,size,500);fillStressed(ctx,label,PAD,base);
  font(ctx,size,700);ctx.textAlign='right';fillStressed(ctx,value,W-PAD,base);ctx.textAlign='left';
  for(let x=PAD+lw+8;x<W-PAD-vw-8;x+=7)ctx.fillRect(x,base-2,2,2);
 }
 banner(value:string,size=18){
  const ctx=this.ctx,height=Math.round(size*2.1);
  ctx.fillRect(0,this.y,W,height);ctx.fillStyle='#fff';font(ctx,size,800);ctx.textAlign='center';
  fillStressed(ctx,value,W/2,this.y+height/2+size*0.36);ctx.textAlign='left';ctx.fillStyle='#000';this.y+=height;
 }
 // Robot logo, Privet and the date.
 header(subtitle:string){
  const ctx=this.ctx;robot(ctx,PAD,this.y,40);
  font(ctx,26,800);fillStressed(ctx,'Privet',PAD+52,this.y+24);
  font(ctx,16,500);fillStressed(ctx,subtitle,PAD+52,this.y+44);
  this.y+=50;
 }
 cut(){
  this.gap(14);const ctx=this.ctx,y=this.y;
  ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.beginPath();ctx.moveTo(PAD+30,y);ctx.lineTo(W-PAD,y);ctx.stroke();ctx.setLineDash([]);
  scissors(ctx,PAD,y);this.y+=12;
 }
 finish():Rendered{
  const height=Math.min(MAX_HEIGHT,Math.ceil(this.y+PAD));
  const image=this.ctx.getImageData(0,0,W,height);
  const rows=packRows(image,'threshold',{ditherRegions:this.dither});
  const out=document.createElement('canvas');out.width=W;out.height=height;out.getContext('2d')!.drawImage(this.canvas,0,0);
  return {canvas:out,rows,height};
 }
}
function wrap(ctx:Ctx,value:string,width:number){
 const lines:string[]=[];
 for(const paragraph of value.split('\n')){
  let line='';
  for(const word of paragraph.split(' ')){
   const next=line?`${line} ${word}`:word;
   if(line&&measure(ctx,next)>width){lines.push(line);line=word;}else line=next;
  }
  lines.push(line);
 }
 return lines;
}
// Small line-art robot: head, screen with eyes, antenna.
function robot(ctx:Ctx,x:number,y:number,size:number){
 const s=size/40;ctx.lineWidth=3*s;
 ctx.beginPath();ctx.roundRect(x+2*s,y+8*s,36*s,28*s,8*s);ctx.fill();
 ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(x+7*s,y+13*s,26*s,17*s,5*s);ctx.fill();ctx.fillStyle='#000';
 ctx.beginPath();ctx.arc(x+15*s,y+21*s,2.6*s,0,Math.PI*2);ctx.arc(x+25*s,y+21*s,2.6*s,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.moveTo(x+27*s,y+8*s);ctx.lineTo(x+31*s,y+2*s);ctx.stroke();
 ctx.beginPath();ctx.arc(x+31.5*s,y+2*s,2.6*s,0,Math.PI*2);ctx.fill();
}
function scissors(ctx:Ctx,x:number,y:number){
 ctx.lineWidth=2;
 ctx.beginPath();ctx.arc(x+5,y-5,4,0,Math.PI*2);ctx.stroke();
 ctx.beginPath();ctx.arc(x+5,y+5,4,0,Math.PI*2);ctx.stroke();
 ctx.beginPath();ctx.moveTo(x+8,y-3);ctx.lineTo(x+24,y+4);ctx.moveTo(x+8,y+3);ctx.lineTo(x+24,y-4);ctx.stroke();
}
// One simple line icon per lesson, drawn in a size×size box.
export function lessonIcon(ctx:Ctx,lessonId:string,x:number,y:number,size:number){
 const s=size/64;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
 const p=(draw:()=>void)=>{ctx.beginPath();draw();ctx.stroke();};
 switch(lessonId){
  case 'cafe':p(()=>{ctx.moveTo(12,26);ctx.lineTo(16,54);ctx.lineTo(42,54);ctx.lineTo(46,26);ctx.closePath();});p(()=>{ctx.arc(48,36,7,-Math.PI/2,Math.PI/2);});p(()=>{ctx.moveTo(22,8);ctx.quadraticCurveTo(18,14,22,20);ctx.moveTo(32,8);ctx.quadraticCurveTo(28,14,32,20);});break;
  case 'introductions':p(()=>{ctx.roundRect(8,10,48,32,8);});p(()=>{ctx.moveTo(18,42);ctx.lineTo(14,54);ctx.lineTo(28,42);});p(()=>{ctx.moveTo(20,26);ctx.lineTo(44,26);});break;
  case 'around-town':p(()=>{ctx.moveTo(32,58);ctx.bezierCurveTo(12,36,12,8,32,8);ctx.bezierCurveTo(52,8,52,36,32,58);});p(()=>{ctx.arc(32,26,7,0,Math.PI*2);});break;
  case 'shopping':p(()=>{ctx.moveTo(12,22);ctx.lineTo(52,22);ctx.lineTo(48,56);ctx.lineTo(16,56);ctx.closePath();});p(()=>{ctx.moveTo(22,28);ctx.lineTo(22,16);ctx.arc(32,16,10,Math.PI,0);ctx.lineTo(42,28);});break;
  case 'daily-life':p(()=>{ctx.arc(32,32,11,0,Math.PI*2);});p(()=>{for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.moveTo(32+Math.cos(a)*18,32+Math.sin(a)*18);ctx.lineTo(32+Math.cos(a)*25,32+Math.sin(a)*25);}});break;
  case 'making-plans':p(()=>{ctx.roundRect(10,14,44,40,6);});p(()=>{ctx.moveTo(10,26);ctx.lineTo(54,26);ctx.moveTo(22,8);ctx.lineTo(22,18);ctx.moveTo(42,8);ctx.lineTo(42,18);});p(()=>{ctx.moveTo(22,40);ctx.lineTo(29,46);ctx.lineTo(42,33);});break;
  case 'studies':p(()=>{ctx.moveTo(32,16);ctx.quadraticCurveTo(20,10,8,14);ctx.lineTo(8,52);ctx.quadraticCurveTo(20,48,32,54);ctx.quadraticCurveTo(44,48,56,52);ctx.lineTo(56,14);ctx.quadraticCurveTo(44,10,32,16);ctx.lineTo(32,54);});break;
  case 'culture':p(()=>{ctx.moveTo(8,24);ctx.lineTo(32,10);ctx.lineTo(56,24);ctx.closePath();});p(()=>{for(const cx of [16,27,37,48]){ctx.moveTo(cx,28);ctx.lineTo(cx,50);}ctx.moveTo(8,54);ctx.lineTo(56,54);});break;
  default:p(()=>{ctx.moveTo(32,8);for(let i=1;i<=10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?11:24;ctx.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r);}});
 }
 ctx.restore();
}
function star(ctx:Ctx,cx:number,cy:number,r:number,filled:boolean){
 ctx.beginPath();
 for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.45:r;ctx[i?'lineTo':'moveTo'](cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}
 ctx.closePath();ctx.lineWidth=2;if(filled)ctx.fill();else ctx.stroke();
}

export function renderWordCard(card:WordCard):Rendered{
 const c=new Card(),ctx=c.ctx;
 c.header(card.date);c.gap(10);
 c.banner('СЛОВО ДНЯ · WORD OF THE DAY');c.gap(16);
 lessonIcon(ctx,card.lesson.id,(W-64)/2,c.y,64);c.gap(72);
 const word=card.word.stressed;
 const size=c.fit(word,56,30,800);
 // Room above the line for the stress mark.
 c.gap(4);c.text(word,{size,weight:800,align:'center',lineHeight:1.35});
 c.text(`[ ${card.word.pronunciation} ]`,{size:18,align:'center'});
 c.gap(4);c.text(card.word.meaning,{size:24,weight:700,align:'center'});
 if(card.example){
  c.gap(16);c.rule(false,2);c.gap(6);
  c.text('EXAMPLE',{size:16,weight:800});
  c.text(card.example.russian,{size:22,weight:600});
  c.text(card.example.english,{size:18,style:'italic'});
 }
 c.gap(8);c.text(`Lesson ${card.lesson.number} · ${card.lesson.title}`,{size:16,align:'center'});
 c.cut();
 return c.finish();
}

export function renderPracticeStrip(strip:PracticeStrip):Rendered{
 const c=new Card(),ctx=c.ctx;
 c.header(`Lesson ${strip.lesson.number} · ${strip.lesson.title}`);c.gap(10);
 c.banner('PRACTICE · FILL THE GAP');
 strip.items.forEach((item,index)=>{
  c.gap(16);
  // Number badge, then the line with a blank.
  const blank=72,line=`${item.before}${' '.repeat(1)}${item.after}`;
  let size=24;font(ctx,size,600);
  const widthOf=()=>measure(ctx,item.before)+blank+measure(ctx,item.after);
  while(size>18&&widthOf()>INNER-36){size-=2;font(ctx,size,600);}
  const top=c.y,base=top+size+6;
  ctx.beginPath();ctx.arc(PAD+12,base-size*0.35,12,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';font(ctx,16,800);ctx.textAlign='center';fillStressed(ctx,String(index+1),PAD+12,base-size*0.35+6);ctx.textAlign='left';ctx.fillStyle='#000';
  if(widthOf()<=INNER-36){
   font(ctx,size,600);let x=PAD+36;
   fillStressed(ctx,item.before,x,base);x+=measure(ctx,item.before)+4;
   ctx.fillRect(x,base+2,blank-8,3);x+=/^[.,!?…]/u.test(item.after)?blank-6:blank;
   fillStressed(ctx,item.after,x,base);c.y=base+8;
  }else{
   // Too long for one line: wrap, with the blank as underscores.
   c.y=top;c.text(line.replace(' ',' ______ '),{size:18,weight:600,x:PAD+36,width:INNER-36});
  }
  c.text(item.english,{size:16,style:'italic',x:PAD+36,width:INNER-36});
  // Three tick boxes, side by side when they fit, else stacked.
  font(ctx,20,500);
  const column=(INNER-36)/3,fits=item.options.every(o=>measure(ctx,o)+30<=column);
  c.gap(8);
  item.options.forEach((option,i)=>{
   const x=fits?PAD+36+i*column:PAD+36,y=fits?c.y:c.y+i*30;
   ctx.lineWidth=2;ctx.strokeRect(x,y+3,18,18);
   font(ctx,20,500);fillStressed(ctx,option,x+26,y+19);
  });
  c.y+=fits?30:90;
 });
 if(strip.trace){
  c.gap(16);c.rule(true);c.gap(6);
  c.text('TRACE & WRITE',{size:16,weight:800});
  c.text(strip.trace.english,{size:16,style:'italic'});
  const size=c.fit(strip.trace.russian,52,30,700);
  c.gap(8);const base=c.y+size;
  // Light grey, dithered to sparse dots to write over.
  font(ctx,size,600);ctx.fillStyle='#b4b4b4';fillStressed(ctx,strip.trace.russian,PAD+4,base);ctx.fillStyle='#000';
  c.dither.push({x:PAD,y:base-size*1.15,width:INNER,height:size*1.15+4});
  ctx.fillRect(PAD,base+8,INNER,2);
  // An empty line to write it again.
  ctx.fillRect(PAD,base+8+size+12,INNER,2);
  c.y=base+8+size+20;
 }
 c.cut();
 // The answers, upside down: turn the strip round to check.
 c.gap(10);
 // Each answer stays on one line: its number and word are joined by a no-break space.
 const key=`ANSWERS  ${strip.answers.map(a=>a.replace(/ /g,'\u00a0')).join('  ·  ')}`;
 font(ctx,18,600);const lines=wrap(ctx,key,INNER),lineHeight=24,top=c.y,height=lines.length*lineHeight+6;
 ctx.save();ctx.translate(W/2,top+height);ctx.rotate(Math.PI);ctx.textAlign='center';
 lines.forEach((line,i)=>fillStressed(ctx,line,0,(i+1)*lineHeight-4));
 ctx.restore();ctx.textAlign='left';c.y=top+height;
 return c.finish();
}

export function renderReceipt(receipt:Receipt):Rendered{
 const c=new Card(),ctx=c.ctx;
 robot(ctx,(W-44)/2,c.y,44);c.gap(48);
 c.text('Privet',{size:28,weight:800,align:'center'});
 c.text('PROGRESS RECEIPT',{size:16,weight:700,align:'center'});
 c.text(receipt.date,{size:16,align:'center'});
 c.gap(8);c.rule(true);c.gap(8);
 // Streak and this week's days.
 c.text(`STREAK  ${receipt.streak} ${receipt.streak===1?'DAY':'DAYS'}`,{size:26,weight:800,align:'center'});
 c.gap(8);
 const box=36,space=(INNER-box*7)/6;
 receipt.week.forEach((day,i)=>{
  const x=PAD+i*(box+space),y=c.y;
  ctx.lineWidth=day.today?4:2;
  if(day.done){ctx.fillRect(x,y,box,box);ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+9,y+19);ctx.lineTo(x+16,y+26);ctx.lineTo(x+28,y+11);ctx.stroke();ctx.strokeStyle='#000';}
  else{if(day.future)ctx.setLineDash([4,4]);ctx.strokeRect(x+1,y+1,box-2,box-2);ctx.setLineDash([]);}
  font(ctx,16,day.today?800:500);ctx.textAlign='center';fillStressed(ctx,day.label,x+box/2,y+box+20);ctx.textAlign='left';
 });
 c.gap(box+28);c.rule(true);
 c.leader('New words',String(receipt.newWords));
 c.leader('Reviewed',String(receipt.reviewed));
 c.leader('Accuracy',receipt.accuracy===null?'—':`${receipt.accuracy}%`);
 c.leader('XP today',String(receipt.todayXp));
 c.gap(10);c.rule(true);
 if(receipt.words.length){
  c.gap(4);c.text("TODAY'S WORDS",{size:16,weight:800});
  for(const word of receipt.words){
   c.gap(2);const top=c.y;
   c.text(word.russian,{size:20,weight:700,width:INNER-80});
   for(let i=0;i<3;i++)star(ctx,W-PAD-10-(2-i)*24,top+16,10,i<word.stars);
   c.text(word.english,{size:16,width:INNER-80});
  }
  c.gap(10);c.rule(true);
 }
 // Weekly XP: dithered bars, today's solid.
 c.gap(4);c.text('XP · LAST 7 DAYS',{size:16,weight:800});
 const chart=110,top=c.y+22,max=Math.max(10,...receipt.xp.map(d=>d.xp)),bar=30,gapX=(INNER-bar*7)/6;
 receipt.xp.forEach((day,i)=>{
  const x=PAD+i*(bar+gapX),h=Math.round(day.xp/max*chart),y=top+chart-h;
  if(h>0){
   if(day.today)ctx.fillRect(x,y,bar,h);
   else{ctx.fillStyle='#8c8c8c';ctx.fillRect(x,y,bar,h);ctx.fillStyle='#000';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,bar-2,h-2);c.dither.push({x:x+2,y:y+2,width:bar-4,height:h-4});}
  }
  ctx.fillRect(x-2,top+chart,bar+4,2);
  font(ctx,16,day.today?800:500);ctx.textAlign='center';
  if(day.xp)fillStressed(ctx,String(day.xp),x+bar/2,y-6);
  fillStressed(ctx,day.label,x+bar/2,top+chart+20);ctx.textAlign='left';
 });
 c.y=top+chart+28;c.rule(true);
 c.leader('TOTAL XP',String(receipt.totalXp),22);
 c.gap(8);c.rule(false,3);c.gap(10);
 c.text('Молодец! До завтра!',{size:24,weight:800,align:'center'});
 c.gap(6);c.text('* * *',{size:18,align:'center'});
 c.cut();
 return c.finish();
}
// The 1-bit rows as an image, to preview exactly what will print.
export function rowsToDataUrl(rows:readonly Uint8Array[]){
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=Math.max(1,rows.length);
 const ctx=canvas.getContext('2d')!;const image=ctx.createImageData(W,canvas.height);
 rows.forEach((row,y)=>{for(let x=0;x<W;x++){const black=row[x>>3]&(1<<(x&7)),i=(y*W+x)*4,v=black?0:255;image.data[i]=image.data[i+1]=image.data[i+2]=v;image.data[i+3]=255;}});
 ctx.putImageData(image,0,0);return canvas.toDataURL('image/png');
}
// A test pattern for the first print: darkness ramp, text and a dithered gradient.
export function renderTestPage():Rendered{
 const c=new Card(),ctx=c.ctx;
 c.header('Printer test');c.gap(8);c.banner('TEST PRINT');c.gap(8);
 c.text('Приве́т! Спаси́бо! я́блоко',{size:26,weight:700});
 c.text('Stress marks should sit above the vowel.',{size:16});
 c.gap(10);const top=c.y;
 const grad=ctx.createLinearGradient(PAD,0,W-PAD,0);grad.addColorStop(0,'#fff');grad.addColorStop(1,'#000');
 ctx.fillStyle=grad;ctx.fillRect(PAD,top,INNER,40);ctx.fillStyle='#000';c.dither.push({x:PAD,y:top,width:INNER,height:40});
 c.y=top+48;for(let i=1;i<=6;i++){ctx.fillRect(PAD,c.y,INNER,i);c.y+=i+6;}
 c.cut();return c.finish();
}
