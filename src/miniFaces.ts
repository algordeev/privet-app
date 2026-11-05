import type {FirmwareFace} from './oledFaces';

// Privet Mini's own sleeping, CONNECTED and IDLE faces, pixel for pixel as drawn by
// firmware/PrivetMini_v0.5/MiniFaces.h, for the keychain figure in the "companion found" card.
// Keep in sync with that header; firmwareLearning.test.ts compares the two.
const W=128,H=64,EL=46,ER=82,EY=30,AMBIENT_WINDOW_MS=60000;

function pen(){
 const pixels=new Uint8Array(W*H);let on=1;
 const set=(x:number,y:number)=>{if(x>=0&&y>=0&&x<W&&y<H)pixels[y*W+x]=on;};
 const hline=(x:number,y:number,w:number)=>{for(let i=0;i<w;i++)set(x+i,y);};
 const vline=(x:number,y:number,h:number)=>{for(let i=0;i<h;i++)set(x,y+i);};
 const box=(x:number,y:number,w:number,h:number)=>{for(let j=0;j<h;j++)hline(x,y+j,w);};
 function line(x0:number,y0:number,x1:number,y1:number){
  const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;
  for(;;){set(x0,y0);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}
 }
 function circle(x0:number,y0:number,r:number){
  let f=1-r,ddx=1,ddy=-2*r,x=0,y=r;
  set(x0,y0+r);set(x0,y0-r);set(x0+r,y0);set(x0-r,y0);
  while(x<y){if(f>=0){y--;ddy+=2;f+=ddy;}x++;ddx+=2;f+=ddx;
   set(x0+x,y0+y);set(x0-x,y0+y);set(x0+x,y0-y);set(x0-x,y0-y);set(x0+y,y0+x);set(x0-y,y0+x);set(x0+y,y0-x);set(x0-y,y0-x);}
 }
 function rbox(x:number,y:number,w:number,h:number,r:number){
  r=Math.max(0,Math.min(r,(Math.min(w,h)-1)>>1));
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
   const dx=i<r?r-i:i>w-1-r?i-(w-1-r):0,dy=j<r?r-j:j>h-1-r?j-(h-1-r):0;
   if(dx*dx+dy*dy<=r*r+r)set(x+i,y+j);
  }
 }
 return {pixels,set,hline,vline,box,line,circle,rbox,color:(value:number)=>{on=value;}};
}
type Pen=ReturnType<typeof pen>;

function eyes(d:Pen,dx=0,dy=0,h=20){
 for(const cx of [EL,ER]){
  const x=cx-8+dx;
  if(h<=3){d.box(x,EY-1+dy,16,2);continue;}
  const y=EY-(h>>1)+dy;
  d.rbox(x,y,16,h,6);
  if(h>=12){d.color(0);d.box(x+3,y+3,4,4);d.color(1);}
 }
}
function closedEyes(d:Pen,dy:number){
 for(const cx of [EL,ER])for(let t=0;t<2;t++){
  d.line(cx-7,EY+t+dy,cx-4,EY+3+t+dy);d.line(cx-4,EY+3+t+dy,cx+4,EY+3+t+dy);d.line(cx+4,EY+3+t+dy,cx+7,EY+t+dy);
 }
}
const smile=(d:Pen)=>{for(let t=0;t<2;t++){d.line(59,45+t,61,47+t);d.line(61,47+t,67,47+t);d.line(67,47+t,69,45+t);}};
function sparkle(d:Pen,x:number,y:number,r:number){
 d.hline(x-r,y,2*r+1);d.vline(x,y-r,2*r+1);
 if(r>=3){d.set(x-1,y-1);d.set(x+1,y-1);d.set(x-1,y+1);d.set(x+1,y+1);}
}
const zee=(d:Pen,x:number,y:number,s:number)=>{d.hline(x,y,s);d.line(x+s-1,y,x,y+s-1);d.hline(x,y+s-1,s);};
const roundHalfUp=(v:number)=>Math.floor(v+.5);
function glance(age:number){
 const p=age%7800;if(p<2200||p>=4000)return 0;
 const t=p-2200,m=t<300?t/300:t<1500?1:(1800-t)/300;
 return Math.trunc((Math.floor(age/7800)%2?-m:m)*4);
}

function sleeping(d:Pen,age:number){
 const p=age%3200,breathe=p<1600?Math.floor(p/800):Math.floor((3200-p)/800);
 closedEyes(d,breathe);d.circle(64,46+breathe,2);
 for(let k=0;k<3;k++){const q=(age/2400+k/3)%1;if(q<.9)zee(d,roundHalfUp(98+q*16),roundHalfUp(24-q*20),3+Math.floor(q*3));}
}
function connected(d:Pen,age:number){
 const h=age<300?2+Math.floor(age*20/300):age<420?22:20;
 eyes(d,0,0,h);if(age>=250)smile(d);
 if(age>=450&&age<1500){const r=[1,2,3,3,2,1][Math.floor((age-450)/175)];sparkle(d,24,16,r);sparkle(d,104,16,r);}
}
function idle(d:Pen,age:number,now:number){eyes(d,age<AMBIENT_WINDOW_MS?glance(age):0,0,now%4300<130?2:20);smile(d);}

// age: ms since this face began (since power-on for sleeping); now: the device clock, for blinks.
export function renderMiniFace(face:FirmwareFace,age:number,now=age):Uint8Array{
 const d=pen();age=Math.max(0,Math.trunc(age));now=Math.max(0,Math.trunc(now));
 if(face==='sleeping')sleeping(d,age);
 else if(face==='connected')connected(d,age);
 else idle(d,Math.min(age,AMBIENT_WINDOW_MS),now);
 return d.pixels;
}
