// The Privet promo, as one deterministic 1920×1080 page: window.renderFrame(n) draws frame n (30 fps).
// Phone footage is the real app (promo/capture-app.mjs); the robot, Mini and printer are the app's own
// 3D figures (src/robotScene.ts) with the firmware's faces and head gestures; the printed card is the
// app's print renderer. Sound cues and subtitles are exported for the audio mix (promo/audio.py).
import {createRobotScene,type FigureModel,type RobotScene} from '../src/robotScene';
import type {Reaction} from '../src/servoMotion';
import {renderWordCard,rowsToDataUrl} from '../src/printRender';
import {wordCard} from '../src/printContent';
import {nativeLessons} from '../src/curriculum/catalog';
import {TIMELINE,FPS,DURATION} from './timeline';

const W=1920,H=1080;
const stage=document.getElementById('stage')!;
const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
const prog=(t:number,a:number,b:number)=>clamp((t-a)/(b-a));
const easeOut=(x:number)=>1-Math.pow(1-clamp(x),3);
const easeInOut=(x:number)=>{x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;};
const easeBack=(x:number)=>{x=clamp(x);const c=1.6;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;
function el<K extends keyof HTMLElementTagNameMap>(tag:K,cls:string,parent:HTMLElement=stage,html=''):HTMLElementTagNameMap[K]{const e=document.createElement(tag);if(cls)e.className=cls;if(html)e.innerHTML=html;parent.appendChild(e);return e;}
const css=(e:HTMLElement|SVGElement,styles:Record<string,string|number>)=>{for(const [k,v] of Object.entries(styles))(e.style as unknown as Record<string,string>)[k]=typeof v==='number'&&!['opacity','zIndex'].includes(k)?`${v}px`:String(v);};
const pending:Promise<unknown>[]=[];

// ---------- Phone playing captured app footage ----------
type ClipInfo={frames:number;taps:{frame:number;x:number;y:number}[]};
const clipInfo:Record<string,ClipInfo>={};
async function loadClip(name:string){clipInfo[name]=await (await fetch(`/promo/out/app/${name}/clip.json`)).json();}
class Phone{
 root:HTMLDivElement;img:HTMLImageElement;touch:HTMLDivElement;ripple:HTMLDivElement;src='';
 constructor(parent:HTMLElement){
  this.root=el('div','phone',parent);
  const screen=el('div','phone-screen',this.root);
  el('div','phone-status',screen,'<span>9:41</span><span class="phone-icons"><i style="width:18px;height:11px"></i><i style="width:16px;height:11px;border-radius:6px 6px 2px 2px"></i><i style="width:27px;height:13px;border-radius:4px"></i></span>');
  el('div','phone-island',screen);
  this.img=el('img','phone-app',screen);
  this.touch=el('div','touch',screen);this.ripple=el('div','ripple',screen);
  el('div','phone-home',screen);
 }
 show(clip:string,frame:number){
  const info=clipInfo[clip];frame=Math.round(clamp(frame,0,info.frames-1));
  const src=`/promo/out/app/${clip}/${String(frame).padStart(5,'0')}.jpg`;
  if(src!==this.src){this.src=src;this.img.src=src;pending.push(this.img.decode().catch(()=>undefined));}
  // Touch indicator: appears just before each tap, presses, and ripples out.
  let touch=0,ripple=-1,x=0,y=0;
  for(const tap of info.taps){const d=frame-tap.frame;if(d>-7&&d<9){touch=d<0?(d+7)/7:1-d/9;x=tap.x;y=tap.y;}if(d>=0&&d<14){ripple=d/14;x=tap.x;y=tap.y;}}
  const sx=400/390,sy=866/844;
  css(this.touch,{left:x*sx,top:48+y*sy,opacity:touch,transform:`scale(${touch>0?.85+.15*touch:1})`});
  css(this.ripple,{left:x*sx,top:48+y*sy,opacity:ripple<0?0:1-ripple,transform:`scale(${ripple<0?1:1+ripple*1.6})`});
 }
 // Phones sit at 86% so subtitles never cover the screen; `scale` multiplies that.
 place(x:number,y:number,scale=1,rotY=0,rotZ=0,opacity=1){css(this.root,{left:x,top:y-40,opacity,transform:`perspective(2400px) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale*.86})`});}
}

// ---------- The app's 3D figures ----------
class Device{
 canvas:HTMLCanvasElement;scene?:RobotScene;
 constructor(public model:FigureModel,parent:HTMLElement,public size:number){this.canvas=el('canvas','device',parent);css(this.canvas,{width:size,height:size});}
 create(){this.scene=createRobotScene(this.canvas,{model:this.model});this.scene.resize(this.size,this.size);}
 dispose(){this.scene?.dispose();this.scene=undefined;}
 place(x:number,y:number,scale=1,opacity=1){css(this.canvas,{left:x,top:y,opacity,transform:`scale(${scale})`});}
}

// ---------- Mini review card, after PrivetMini_v0.9 MiniScreens.h reviewCard() ----------
function miniCard(russian:string,meaning:string|null,number:number,total:number){
 const c=document.createElement('canvas');c.width=128;c.height=64;const g=c.getContext('2d')!;
 g.fillStyle='#000';g.fillRect(0,0,128,64);g.fillStyle='#fff';g.textBaseline='alphabetic';
 g.fillRect(0,0,128,11);g.fillStyle='#000';g.font='bold 9px Menlo, monospace';g.fillText('REVIEW',3,9);
 const corner=`${number}/${total}`;g.fillText(corner,125-g.measureText(corner).width,9);
 g.fillStyle='#fff';g.font='bold 17px "DM Sans", sans-serif';g.textAlign='center';g.fillText(russian,64,meaning?32:36);
 g.font='9px Menlo, monospace';g.fillText(meaning??'what does it mean?',64,meaning?45:48);
 g.textAlign='left';for(let x=0;x<128;x+=2)g.fillRect(x,54,1,1);
 const [left,right]=meaning?["x didn't",'knew it v']:['< quit','flip >'];
 g.font='8px Menlo, monospace';g.fillText(left,1,63);g.fillText(right,127-g.measureText(right).width,63);
 const data=g.getImageData(0,0,128,64).data,pixels=new Uint8Array(128*64);
 for(let i=0;i<pixels.length;i++)pixels[i]=data[i*4]>110?1:0;
 return pixels;
}

// ---------- Scenes ----------
type Event={t:number;run:()=>void};
const events:Event[]=[];
const at=(t:number,run:()=>void)=>events.push({t,run});
const updates:((t:number)=>void)[]=[];
// Scenes switch under a colour wipe (see build), so the layers themselves only need a tiny fade.
function layer(start:number,end:number,fade=.06){
 const root=el('div','layer');
 updates.push(t=>{const o=Math.min(prog(t,start-fade/2,start+fade/2),1-prog(t,end-fade/2,end+fade/2));css(root,{opacity:o,display:o<=0?'none':'block'});});
 return root;
}
function background(root:HTMLElement,base:string,blobs:[string,number,number,number][]){
 const bg=el('div','bg',root);css(bg,{background:base});
 const items=blobs.map(([color,x,y,size])=>{const b=el('div','blob',bg);css(b,{background:color,width:size,height:size,left:x,top:y});return {b,x,y};});
 updates.push(t=>items.forEach(({b},i)=>css(b,{transform:`translate(${Math.sin(t*.25+i*2)*60}px,${Math.cos(t*.2+i)*40}px)`})));
}
// A headline whose words rise in one after another.
function headline(root:HTMLElement,html:string,x:number,y:number,start:number,size=88,kicker=''){
 if(kicker){const k=el('div','kicker',root,kicker);css(k,{left:x,top:y-46});updates.push(t=>{const p=easeOut(prog(t,start-.1,start+.5));css(k,{opacity:p,transform:`translateY(${(1-p)*14}px)`});});}
 const h=el('div','headline',root);css(h,{left:x,top:y,fontSize:size});
 h.innerHTML=html.split(/(<br>)/).map(part=>part==='<br>'?part:part.split(/(<em>.*?<\/em>|\s+)/).filter(Boolean).map(w=>/^\s+$/.test(w)?w:`<span class="word">${w}</span>`).join('')).join('');
 const words=[...h.querySelectorAll<HTMLElement>('.word')];
 updates.push(t=>words.forEach((w,i)=>{const p=easeOut(prog(t,start+i*.07,start+i*.07+.6));css(w,{opacity:p,transform:`translateY(${(1-p)*38}px)`});}));
 return h;
}
function chip(root:HTMLElement,html:string,x:number,y:number,start:number,end:number){
 const c=el('div','chip',root,html);css(c,{left:x,top:y});
 updates.push(t=>{const p=easeBack(prog(t,start,start+.5))*(1-easeOut(prog(t,end-.3,end)));css(c,{opacity:clamp(p),transform:`translateY(${(1-p)*20}px) scale(${.9+.1*clamp(p)})`});});
 return c;
}

// Clip time mapping: stage seconds → clip frame, at real speed from a clip frame. Each tap the
// mapping shows inside [startAt, until) becomes a soft click in the mix.
const run=(from:number,startAt:number,until=startAt+60,clip='lesson')=>{
 queueMicrotask(()=>{for(const tap of clipInfo[clip]?.taps??[]){const t=startAt+(tap.frame-from)/FPS;if(t>=startAt&&t<until)cue('tap',t);}});
 return (t:number)=>from+(t-startAt)*FPS;
};

function build(){
 const T=TIMELINE;
 for(const t of [T.lesson[0],T.print[0],T.printer[0],T.fridge[0],T.celebrate[0],T.miniHome[0],T.mini[0],T.montage[0],T.end[0]])cue('whoosh',t-.25);
 cue('logo',.3);
 // ===== 1. Opening: the wordmark, then the phone at home and the desk robot waking up =====
 {
  const L=layer(T.open[0],T.open[1]);background(L,'#f7f5ee',[['#cfe4d6',-100,560,700],['#f6d9cc',1300,-150,700]]);
  const logo=el('div','logo',L,'<span class="brand-icon"><i></i><i></i></span>Privet<span class="dot">.</span>');
  updates.push(t=>{const inP=easeBack(prog(t,.15,.85)),out=easeInOut(prog(t,1.55,2.15));css(logo,{left:W/2-330,top:H/2-95,opacity:clamp(inP)*(1-out),transform:`scale(${(.82+.18*inP)*(1-.25*out)}) translateY(${-out*40}px)`});});
  const open=run(0,2.2,T.open[1]);
  headline(L,'Real Russian,<br><em>a few minutes</em><br>a day.',140,360,2.3,84,'Meet Privet');
  const phone=new Phone(L),robot=new Device('desk',L,700);
  updates.push(t=>{const p=easeOut(prog(t,2.0,3.0));phone.place(720,70+(1-p)*120,1,-8*(1-p)+4,0,p);phone.show('lesson',open(t));
   const r=easeOut(prog(t,2.4,3.4));robot.place(1150,190+(1-r)*60,1,r);});
  at(2.3,()=>robot.create());
  at(3.8,()=>robot.scene?.setMood('connected'));cue('robot-wake',3.8);
  at(T.open[1]+.4,()=>robot.dispose());
 }
 // ===== 2. Lesson: right answer → HAPPY, a miss → ENCOURAGE =====
 {
  const L=layer(T.lesson[0],T.lesson[1]);background(L,'#eef1e8',[['#cfe4d6',-150,-100,800],['#d7ece9',1200,600,800]]);
  headline(L,'Bite-sized<br><em>lessons.</em>',120,330,T.lesson[0]+.3,88,'Real phrases');
  const phone=new Phone(L),robot=new Device('desk',L,820);
  const intro=run(104,T.lesson[0],T.right),right=run(600,T.right,T.miss),miss=run(770,T.miss,T.lesson[1]);
  updates.push(t=>{const p=easeOut(prog(t,T.lesson[0]-.2,T.lesson[0]+.6));phone.place(620,66,1,6,0,p);
   phone.show('lesson',t<T.right?intro(t):t<T.miss?right(t):miss(t));robot.place(1090,150,1,easeOut(prog(t,T.lesson[0],T.lesson[0]+.8)));});
  at(T.lesson[0]-.3,()=>{robot.create();robot.scene?.setMood('connected');});
  const happy=T.right+(652-600)/FPS+.2,sad=T.miss+(800-770)/FPS+.25;
  at(happy,()=>robot.scene?.react('happy'));cue('robot-happy',happy);
  at(sad,()=>robot.scene?.react('encourage'));cue('robot-encourage',sad);
  chip(L,'<b>✓</b>Correct!',1300,820,happy,happy+1.8);
  chip(L,'<b>♥</b>No rush. Try again.',1250,820,sad+.1,sad+2.4);
  at(T.lesson[1]+.4,()=>robot.dispose());
 }
 // ===== 3a. Print a word from the lesson =====
 {
  const L=layer(T.print[0],T.print[1]);background(L,'#f7f2e8',[['#f6d9cc',-200,500,800],['#d7ece9',1300,-200,700]]);
  headline(L,'Love a word?<br><em>Print it.</em>',140,360,T.print[0]+.3,92,'Your vocabulary');
  const phone=new Phone(L),clip=run(222,T.print[0],T.print[1]);
  updates.push(t=>{const p=easeOut(prog(t,T.print[0]-.2,T.print[0]+.6));phone.place(980,66,lerp(1,1.04,prog(t,T.print[0],T.print[1])),-6,0,p);phone.show('lesson',clip(t));});
 }
 // ===== 3b. The printer prints the card =====
 const card=renderWordCard(wordCard(nativeLessons[0],nativeLessons[0].words.find(w=>w.id==='thanks')!,new Date().toISOString().slice(0,10)));
 const cardUrl=rowsToDataUrl(card.rows),cardRatio=card.rows.length/384;
 {
  const L=layer(T.printer[0],T.printer[1]);background(L,'#eaf2ef',[['#cdeae7',-100,-100,900],['#f6e3da',1200,500,800]]);
  const printer=new Device('printer',L,860);
  updates.push(t=>{const p=easeOut(prog(t,T.printer[0]-.3,T.printer[0]+.6));printer.place(530,40+(1-p)*40,1,p);});
  // The printer's own 3D print job feeds the real card out of its slot (src/robotScene.ts print()).
  const printed=document.createElement('canvas');printed.width=384;printed.height=card.rows.length;
  {const g=printed.getContext('2d')!,img=g.createImageData(384,card.rows.length);
   card.rows.forEach((row,y)=>{for(let x=0;x<384;x++){const ink=row[x>>3]&(1<<(x&7)),i=(y*384+x)*4,v=ink?34:255;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255;}});
   g.putImageData(img,0,0);}
  at(T.printer[0]+.6,()=>printer.scene?.print(printed,(T.printer[1]-T.printer[0]-1.2)*1000));
  at(T.printer[0]-.3,()=>printer.create());
  cue('printer',T.printer[0]+.6);
  chip(L,'<b>⎙</b>Printing · спасибо',1340,860,T.printer[0]+.9,T.printer[1]);
  at(T.printer[1]+.4,()=>printer.dispose());
 }
 // ===== 3c. On the fridge =====
 {
  const L=layer(T.fridge[0],T.fridge[1]);
  const svg=el('div','',L);css(svg,{position:'absolute',inset:0});
  svg.innerHTML=`<svg width="1920" height="1080" viewBox="0 0 1920 1080">
   <defs><linearGradient id="wall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f5ede0"/><stop offset="1" stop-color="#efe3d1"/></linearGradient>
   <linearGradient id="door" x1="0" x2="1"><stop offset="0" stop-color="#e3efe9"/><stop offset=".5" stop-color="#f2f8f4"/><stop offset="1" stop-color="#dce9e2"/></linearGradient>
   <radialGradient id="sun" cx=".85" cy=".1" r=".8"><stop offset="0" stop-color="#fff6dc" stop-opacity=".9"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient></defs>
   <rect width="1920" height="1080" fill="url(#wall)"/>
   <g opacity=".35" stroke="#e6d6bf" stroke-width="2">${Array.from({length:12},(_,i)=>`<line x1="0" x2="1920" y1="${90*i}" y2="${90*i}"/>`).join('')}</g>
   <rect x="430" y="-40" width="1060" height="1180" rx="46" fill="url(#door)" stroke="#c9dbd2" stroke-width="4"/>
   <rect x="1400" y="200" width="26" height="420" rx="13" fill="#c2d6cc"/>
   <rect x="560" y="140" width="210" height="160" rx="10" fill="#fff" transform="rotate(-6 665 220)"/><rect x="575" y="155" width="180" height="110" rx="6" fill="#f3c9b8" transform="rotate(-6 665 220)"/>
   <circle cx="665" cy="150" r="17" fill="#246653"/>
   <rect x="1110" y="560" width="190" height="240" rx="8" fill="#fffdf6" transform="rotate(5 1205 680)"/><path d="M1140 620h120M1140 660h90M1140 700h110" stroke="#cbbfa9" stroke-width="10" stroke-linecap="round" transform="rotate(5 1205 680)"/>
   <circle cx="1205" cy="570" r="17" fill="#f2b84b"/>
   <rect width="1920" height="1080" fill="url(#sun)"/>
  </svg>`;
  const paper=el('div','paper',L);paper.innerHTML=`<img src="${cardUrl}">`;
  const magnet=el('div','',L);css(magnet,{position:'absolute',width:54,height:54,borderRadius:'50%',background:'radial-gradient(circle at 35% 30%,#ffb7a3,#e8826b 55%,#c85f49)',boxShadow:'0 8px 14px rgba(120,50,30,.3)'});
  const hand=el('div','',L);hand.innerHTML=`<svg width="520" height="560" viewBox="0 0 520 560">
   <path d="M330 560 L250 330 C238 300 250 270 280 262 L420 236 L520 380 L520 560Z" fill="#246653"/>
   <path d="M232 330 C210 270 196 200 200 150 C202 128 230 124 236 146 L252 220 L258 92 C259 68 292 66 294 92 L298 206 L314 76 C318 52 350 54 349 80 L342 210 L366 104 C371 82 401 86 398 110 L382 238 C398 214 418 196 438 196 C460 196 462 220 448 236 L392 312 C360 356 300 372 262 360Z" fill="#f2c4a4"/>
   <path d="M258 92 C259 68 292 66 294 92 M314 76 C318 52 350 54 349 80 M366 104 C371 82 401 86 398 110" stroke="#e7ad8a" stroke-width="3" fill="none"/>
  </svg>`;
  css(hand,{position:'absolute'});
  updates.push(t=>{
   const s=T.fridge[0],w=300,h=w*cardRatio;
   const fly=easeOut(prog(t,s,s+1.3)),settle=easeBack(prog(t,s+1.2,s+1.6));
   const x=lerp(1500,800,fly),y=lerp(760,260,fly),rot=lerp(14,-3,fly);
   css(paper,{width:w,left:x,top:y,transform:`rotate(${rot}deg) scale(${1.04-.04*settle})`,['--cut' as string]:'#e9f2ed'});
   // The hand carries the card in by its lower edge, presses it flat, then lets go and leaves.
   const away=easeInOut(prog(t,s+1.9,s+2.7)),press=Math.sin(Math.PI*prog(t,s+1.15,s+1.7));
   css(hand,{left:x+w-300+away*420,top:y+h-150+press*8+away*380,opacity:1-prog(t,s+2.4,s+2.8)});
   const drop=easeBack(prog(t,s+1.55,s+1.95));
   css(magnet,{left:x+w/2-27,top:y-20,opacity:clamp(drop*2),transform:`translateY(${(1-drop)*-60}px) scale(${.6+.4*drop})`});
   css(L,{transform:`scale(${1+prog(t,s,T.fridge[1])*.05})`});
  });
  cue('magnet',T.fridge[0]+1.6);
  chip(L,'<b>☀</b>See it every morning',1270,880,T.fridge[0]+2.2,T.fridge[1]);
 }
 // ===== 4. Lesson complete: CELEBRATE =====
 {
  const L=layer(T.celebrate[0],T.celebrate[1]);background(L,'#f3f0e6',[['#f6d9cc',-150,-150,800],['#cfe4d6',1250,550,800]]);
  headline(L,'Celebrate<br><em>together.</em>',140,360,T.celebrate[0]+.3,92,'Lesson complete');
  const phone=new Phone(L),robot=new Device('desk',L,820),clip=run(1316,T.celebrate[0],T.celebrate[1]);
  updates.push(t=>{phone.place(640,66,1,4,0,easeOut(prog(t,T.celebrate[0]-.2,T.celebrate[0]+.6)));phone.show('lesson',clip(t));robot.place(1100,150,1,easeOut(prog(t,T.celebrate[0],T.celebrate[0]+.7)));});
  at(T.celebrate[0]-.3,()=>{robot.create();robot.scene?.setMood('connected');});
  const party=T.celebrate[0]+(1336-1316)/FPS;
  at(party,()=>robot.scene?.react('celebrate'));cue('robot-celebrate',party);cue('confetti',party);
  // Confetti
  const bits=Array.from({length:70},(_,i)=>{const b=el('div','',L);css(b,{position:'absolute',width:10+(i%3)*4,height:16+(i%4)*3,borderRadius:3,background:['#246653','#e8826b','#f2b84b','#a9e5e3'][i%4]});return {b,x:200+((i*137)%1500),v:.7+((i*53)%40)/50,r:(i*47)%360,d:(i%7)*.08};});
  updates.push(t=>bits.forEach(({b,x,v,r,d})=>{const k=t-party-d;css(b,{left:x+Math.sin(k*3+r)*40,top:-60+k*v*520,opacity:k>0&&k<3?1:0,transform:`rotate(${r+k*260}deg)`});}));
  at(T.celebrate[1]+.4,()=>robot.dispose());
 }
 // ===== 5a. Review words go to the Mini =====
 {
  const L=layer(T.miniHome[0],T.miniHome[1]);background(L,'#f7f5ee',[['#f6d9cc',-100,-100,800],['#d7ece9',1300,500,700]]);
  const miniClip=run(30,T.miniHome[0],T.miniHome[1],'mini');
  headline(L,'On the go?<br>Meet <em>Privet Mini.</em>',140,360,T.miniHome[0]+.3,86,'Keychain companion');
  const phone=new Phone(L),mini=new Device('mini',L,760);
  updates.push(t=>{phone.place(900,66,1,-5,0,easeOut(prog(t,T.miniHome[0]-.2,T.miniHome[0]+.6)));phone.show('mini',miniClip(t));mini.place(1240,240,1,easeOut(prog(t,T.miniHome[0]+.3,T.miniHome[0]+1)));});
  at(T.miniHome[0],()=>{mini.create();mini.scene?.setMood('connected');});
  at(T.miniHome[1]+.4,()=>mini.dispose());
 }
 // ===== 5b. Practising on the go =====
 {
  const L=layer(T.mini[0],T.mini[1]);
  const scene=el('div','',L);css(scene,{position:'absolute',inset:0});
  scene.innerHTML=`<svg width="1920" height="1080" viewBox="0 0 1920 1080"><defs><linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f9d7c4"/><stop offset=".6" stop-color="#f7e8d8"/><stop offset="1" stop-color="#eef0e4"/></linearGradient></defs>
   <rect width="1920" height="1080" fill="url(#sky)"/><circle cx="1500" cy="260" r="120" fill="#fbe7c8"/>
   <g fill="#e6c9b8" opacity=".75">${[[0,520,220,560],[240,440,160,640],[420,560,260,520],[700,470,180,610],[900,540,240,540],[1160,420,200,660],[1380,520,260,560],[1660,460,260,620]].map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`).join('')}</g>
   <rect x="0" y="860" width="1920" height="220" fill="#dfe5d6"/>
   <g transform="translate(250 360)"><rect x="0" y="0" width="22" height="520" fill="#7a8a82"/><rect x="-60" y="-10" width="150" height="110" rx="18" fill="#246653"/><text x="15" y="60" font-family="Manrope" font-weight="800" font-size="46" fill="#fff" text-anchor="middle">BUS</text></g>
   <path d="M1280 -20 C1250 200 1200 330 1120 420" stroke="#c8865f" stroke-width="44" fill="none" stroke-linecap="round"/>
   <path d="M760 1100 C820 760 1000 560 1200 470 C1400 380 1640 420 1820 520 L1920 1100Z" fill="#d6936a"/>
  </svg>`;
  const mini=new Device('mini',L,980);
  const thumb=el('div','',L);thumb.innerHTML=`<svg width="300" height="520" viewBox="0 0 300 520"><path d="M70 0 L230 0 L214 300 C212 360 196 410 150 430 C104 410 88 360 86 300Z" fill="#f2c4a4"/><path d="M110 330 C110 380 128 410 150 414 C172 410 190 380 190 330 C190 300 172 290 150 290 C128 290 110 300 110 330Z" fill="#f8d9c4"/><path d="M60 0 L240 0 L236 120 L64 120Z" fill="#e8826b"/></svg>`;css(thumb,{position:'absolute'});
  updates.push(t=>{
   const s=T.mini[0];mini.place(470,60+Math.sin(t*1.3)*8,1,easeOut(prog(t,s-.2,s+.6)));
   const press=(p0:number)=>{const k=prog(t,p0-.6,p0+.5);return Math.sin(Math.PI*k);};
   const p=Math.max(press(T.flip),press(T.knew));
   css(thumb,{left:870,top:-520+lerp(330,505,p)+(1-clamp(prog(t,T.flip-1.2,T.flip-.6)))*-200+prog(t,T.knew+.5,T.knew+1.1)*-400});
  });
  at(T.mini[0]-.3,()=>{mini.create();mini.scene?.setMood('connected');mini.scene?.showScreen(miniCard('спасибо',null,1,4));});
  at(T.flip,()=>mini.scene?.showScreen(miniCard('спасибо','thank you',1,4)));cue('mini-flip',T.flip);
  at(T.knew,()=>{mini.scene?.showScreen(null);mini.scene?.react('happy');});cue('mini-happy',T.knew);cue('sync',T.sync);
  at(T.knew+1.4,()=>mini.scene?.showScreen(miniCard('чай',null,2,4)));
  chip(L,'<b>✓</b>Knew it!',1200,300,T.knew+.1,T.knew+1.8);
  chip(L,'<b>↻</b>Syncs back when you’re home',1180,820,T.sync,T.mini[1]);
  at(T.mini[1]+.4,()=>mini.dispose());
 }
 // ===== 6. Together =====
 {
  const L=layer(T.montage[0],T.montage[1]);background(L,'#f7f5ee',[['#cfe4d6',-100,600,800],['#f6d9cc',1300,-200,800]]);
  const devices=[new Device('desk',L,640),new Device('printer',L,520),new Device('mini',L,500)];
  const phone=new Phone(L);
  headline(L,'No account. No ads.',560,90,T.montage[0]+.3,72);
  updates.push(t=>{const s=T.montage[0];
   phone.place(744,170,.9,0,0,easeOut(prog(t,s,s+.7)));phone.show('mini',100);
   [[110,290],[1130,270],[1420,380]].forEach(([x,y],i)=>devices[i].place(x,y+(1-easeOut(prog(t,s+.15*i,s+.15*i+.7)))*40,1,easeOut(prog(t,s+.15*i,s+.15*i+.7))));
  });
  at(T.montage[0]-.3,()=>devices.forEach((d,i)=>{d.create();if(i!==1)d.scene?.setMood('connected');}));
  at(T.montage[1]+.4,()=>devices.forEach(d=>d.dispose()));
 }
 // ===== 7. End card =====
 {
  const L=layer(T.end[0],DURATION+1);background(L,'#f7f5ee',[['#cfe4d6',-200,500,800],['#f6d9cc',1300,-200,800]]);
  const logo=el('div','logo',L,'<span class="brand-icon"><i></i><i></i></span>Privet<span class="dot">.</span>');
  const tag=el('div','tagline',L,'A little Russian. A little <em>every day.</em>');
  const fine=el('div','fine',L,'Concept video · devices shown are working prototypes, enclosures are concepts');
  updates.push(t=>{const s=T.end[0],p=easeBack(prog(t,s+.1,s+.8)),q=easeOut(prog(t,s+.7,s+1.4));
   css(logo,{left:W/2-330,top:330,opacity:clamp(p),transform:`scale(${.85+.15*p})`});
   css(tag,{left:W/2-tag.offsetWidth/2,top:560,opacity:q,transform:`translateY(${(1-q)*20}px)`});
   css(fine,{left:W/2-fine.offsetWidth/2,top:48,opacity:easeOut(prog(t,s+1.2,s+1.8))*.9});});
 }
 // ===== Wipes: a diagonal band in a brand colour sweeps across each scene change; the scene
 // switches underneath while the screen is covered, so two scenes never show through each other.
 {
  const cuts:[number,string,string][]=[[T.lesson[0],'#246653','#a9e5e3'],[T.print[0],'#e8826b','#f6d9cc'],[T.printer[0],'#a9e5e3','#246653'],[T.fridge[0],'#f2b84b','#e8826b'],
   [T.celebrate[0],'#246653','#e8826b'],[T.miniHome[0],'#e8826b','#246653'],[T.mini[0],'#f6d9cc','#e8826b'],[T.montage[0],'#246653','#a9e5e3'],[T.end[0],'#a9e5e3','#246653']];
  const wipe=el('div','');css(wipe,{position:'absolute',inset:0,zIndex:40,pointerEvents:'none',overflow:'hidden'});
  const accent=el('div','',wipe),band=el('div','',wipe);
  for(const b of [accent,band])css(b,{position:'absolute',top:-200,height:H+400,width:2700});
  updates.push(t=>{
   const cut=cuts.find(([c])=>t>c-.42&&t<c+.42);
   if(!cut){css(wipe,{display:'none'});return;}
   const [c,main,second]=cut,k=easeInOut((t-(c-.42))/.84);
   // The band starts off screen on the left, covers the frame at the cut and leaves on the right.
   const x=lerp(-3200,2400,k);
   css(wipe,{display:'block'});
   css(band,{left:x,background:main,transform:'skewX(-18deg)'});
   css(accent,{left:x-160,width:2860,background:second,transform:'skewX(-18deg)'});
  });
 }
 // ===== Subtitles =====
 const sub=el('div','sub');
 updates.push(t=>{const line=subtitles.find(([a,b])=>t>=a&&t<b);css(sub,{opacity:line?Math.min(prog(t,line[0],line[0]+.15),1-prog(t,line[1]-.15,line[1])):0});if(line&&sub.textContent!==line[2])sub.textContent=line[2];});
}

// ---------- Sound cues for the mix ----------
const cues:{name:string;t:number}[]=[];
function cue(name:string,t:number){cues.push({name,t});}

// ---------- Frame stepping ----------
let current=-1;
async function renderFrame(n:number){
 const target=n/FPS;
 if(n<current)throw Error('frames must go forward');
 for(const e of events)if(e.t>current/FPS&&e.t<=target){window.__now=e.t*1000;e.run();window.__tick(e.t*1000);}
 current=n;
 for(const u of updates)u(target);
 window.__tick(target*1000);
 await Promise.all(pending.splice(0));
}
declare global{interface Window{__now:number;__tick:(ms:number)=>void;renderFrame:(n:number)=>Promise<void>;promo:{frames:number;fps:number;cues:typeof cues;subtitles:typeof TIMELINE.subtitles}}}
await Promise.all(['lesson','mini'].map(loadClip));
// Subtitles follow the recorded voice (promo/audio.py writes out/voice.json); each stays up a beat
// after its line ends. Without a recording, the planned timing is used.
let subtitles:[number,number,string][]=TIMELINE.subtitles.map(l=>[...l] as [number,number,string]);
try{const voice=await fetch('/promo/out/voice.json');if(voice.ok)subtitles=(await voice.json() as [number,number,string][]).map(([a,b,text],i,all)=>[a,Math.min(b+.35,all[i+1]?.[0]??60),text]);}catch{/* planned timing */}
await document.fonts.ready;
build();
events.sort((a,b)=>a.t-b.t);
window.renderFrame=renderFrame;
await Promise.resolve();cues.sort((a,b)=>a.t-b.t);
window.promo={frames:Math.round(DURATION*FPS),fps:FPS,cues,subtitles:TIMELINE.subtitles};
document.title='ready';
