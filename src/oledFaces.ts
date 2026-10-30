// A pixel-for-pixel port of the faces drawn by the current companion firmware
// (PrivetBLE_Servo_New_Emotions_v2 drawFace/drawSleepingFace) on its 128×64 OLED,
// so the app's 3D robot shows exactly what the real one shows. Keep in sync with
// the firmware when those faces change.
export const OLED_WIDTH=128,OLED_HEIGHT=64;
export type FirmwareFace='sleeping'|'connected'|'idle';
// CONNECTED lasts 2400 ms on the firmware, then the robot returns to IDLE.
export const CONNECTED_FACE_MS=2400;
const AMBIENT_WINDOW_MS=60000;

type Bitmap=Uint8Array;
function canvas(){
 const pixels=new Uint8Array(OLED_WIDTH*OLED_HEIGHT);
 const pixel=(x:number,y:number)=>{if(x>=0&&y>=0&&x<OLED_WIDTH&&y<OLED_HEIGHT)pixels[y*OLED_WIDTH+x]=1;};
 const vline=(x:number,y:number,h:number)=>{for(let i=0;i<h;i++)pixel(x,y+i);};
 // Adafruit GFX algorithms (Bresenham line, midpoint circles), as used by the firmware.
 function line(x0:number,y0:number,x1:number,y1:number){
  const steep=Math.abs(y1-y0)>Math.abs(x1-x0);
  if(steep){[x0,y0]=[y0,x0];[x1,y1]=[y1,x1];}
  if(x0>x1){[x0,x1]=[x1,x0];[y0,y1]=[y1,y0];}
  const dx=x1-x0,dy=Math.abs(y1-y0),step=y0<y1?1:-1;let err=Math.trunc(dx/2),y=y0;
  for(let x=x0;x<=x1;x++){steep?pixel(y,x):pixel(x,y);err-=dy;if(err<0){y+=step;err+=dx;}}
 }
 function circle(x0:number,y0:number,r:number){
  let f=1-r,ddx=1,ddy=-2*r,x=0,y=r;
  pixel(x0,y0+r);pixel(x0,y0-r);pixel(x0+r,y0);pixel(x0-r,y0);
  while(x<y){
   if(f>=0){y--;ddy+=2;f+=ddy;}
   x++;ddx+=2;f+=ddx;
   pixel(x0+x,y0+y);pixel(x0-x,y0+y);pixel(x0+x,y0-y);pixel(x0-x,y0-y);
   pixel(x0+y,y0+x);pixel(x0-y,y0+x);pixel(x0+y,y0-x);pixel(x0-y,y0-x);
  }
 }
 function circleHelper(x0:number,y0:number,r:number,corners:number,delta:number){
  let f=1-r,ddx=1,ddy=-2*r,x=0,y=r,px=x,py=y;delta++;
  while(x<y){
   if(f>=0){y--;ddy+=2;f+=ddy;}
   x++;ddx+=2;f+=ddx;
   if(x<y+1){if(corners&1)vline(x0+x,y0-y,2*y+delta);if(corners&2)vline(x0-x,y0-y,2*y+delta);}
   if(y!==py){if(corners&1)vline(x0+py,y0-px,2*px+delta);if(corners&2)vline(x0-py,y0-px,2*px+delta);py=y;}
   px=x;
  }
 }
 const fillCircle=(x0:number,y0:number,r:number)=>{vline(x0,y0-r,2*r+1);circleHelper(x0,y0,r,3,0);};
 function roundBox(x:number,y:number,w:number,h:number,r:number){
  r=Math.min(r,Math.trunc(Math.min(w,h)/2));
  for(let i=x+r;i<x+w-r;i++)vline(i,y,h);
  circleHelper(x+w-r-1,y+r,r,1,h-2*r-1);circleHelper(x+r,y+r,r,2,h-2*r-1);
 }
 return {pixels,line,circle,fillCircle,roundBox};
}

// Not connected: relaxed closed eyes and a small mouth breathe; sleep bubbles count 1-2-3.
function sleeping(d:ReturnType<typeof canvas>,age:number){
 const phase=age%3200,breathe=phase<1600?Math.trunc(phase/800):Math.trunc((3200-phase)/800);
 for(let t=0;t<2;t++){
  d.line(28,26+breathe+t,37,29+breathe+t);d.line(37,29+breathe+t,47,26+breathe+t);
  d.line(80,26+breathe+t,90,29+breathe+t);d.line(90,29+breathe+t,99,26+breathe+t);
 }
 d.circle(64,46+breathe,3);
 const bubbles=1+Math.trunc(age/650)%3;
 if(bubbles>=1)d.circle(102,23,1);
 if(bubbles>=2)d.circle(108,16,2);
 if(bubbles>=3)d.circle(116,8,3);
 d.fillCircle(122,4,1);
}

function awake(d:ReturnType<typeof canvas>,face:'connected'|'idle',age:number,now:number){
 // IDLE glances sideways once per 7.8 s cycle during the first minute.
 let look=0;
 const lookPhase=age%7800;
 if(face==='idle'&&age<AMBIENT_WINDOW_MS&&lookPhase>=2200&&lookPhase<4000){
  const t=lookPhase-2200,direction=Math.trunc(age/7800)%2?-1:1;
  look=direction*(t<300?Math.trunc(t*5/300):t<1500?5:Math.trunc((1800-t)*5/300));
 }
 const blink=face==='idle'&&now%4300<130;
 if(face==='connected'&&age<500){
  // The eyes open: rounded eyes grow upward from 3 px to 23 px.
  const height=3+Math.trunc(age*20/500);
  d.roundBox(28,37-height,20,height,5);d.roundBox(80,37-height,20,height,5);
 }else if(blink){
  d.roundBox(28+look,26,20,3,1);d.roundBox(80+look,26,20,3,1);
 }else{
  d.roundBox(28+look,14,20,23,6);d.roundBox(80+look,14,20,23,6);
 }
 for(let t=0;t<2;t++){d.line(44,41+t,54,48+t);d.line(54,48+t,73,48+t);d.line(73,48+t,84,41+t);}
 if(face==='connected')d.circle(64,8,2+Math.trunc(age/180)%3);
 d.fillCircle(122,4,3);
}

// age: ms since this face began (since power-on for sleeping); now: the robot's clock, for blinks.
export function renderFirmwareFace(face:FirmwareFace,age:number,now=age):Bitmap{
 const d=canvas();age=Math.max(0,Math.trunc(age));now=Math.max(0,Math.trunc(now));
 if(face==='sleeping')sleeping(d,age);
 else awake(d,face,face==='idle'?Math.min(age,AMBIENT_WINDOW_MS):age,now);
 return d.pixels;
}
