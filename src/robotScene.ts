import {Color,Float32BufferAttribute,NeutralToneMapping,CanvasTexture,CapsuleGeometry,CircleGeometry,CylinderGeometry,DirectionalLight,ExtrudeGeometry,Group,Mesh,MeshBasicMaterial,MeshPhysicalMaterial,MeshStandardMaterial,PerspectiveCamera,PlaneGeometry,PMREMGenerator,Scene,Shape,ShapeGeometry,SphereGeometry,SRGBColorSpace,TorusGeometry,WebGLRenderer,type BufferGeometry,type Material} from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CONNECTED_FACE_MS,OLED_HEIGHT,OLED_WIDTH,renderFirmwareFace,type FirmwareFace} from './oledFaces';
import type {CompanionModel} from './bleProtocol';
import {renderMiniFace} from './miniFaces';
import {figurePalette,type DeviceColour,type FigurePalette} from './figureColours';

// The physical companions as a small WebGL scene for the "companion found" card, each modelled on
// its enclosure concept, with an OLED that shows the firmware's own faces.
// Each figure comes in warm white or soft coral (figureColours.ts).
// desk: tapered PLA base on a screwed bottom lid, cream button, servo neck and a head that
//   turns with the firmware's servo curve.
// mini: the keychain (≈40×42×18 mm), after its concept illustration: a wide glossy glass panel
//   low on the front with the OLED inset, a big cream top button, a lug with its split ring and
//   key ring, and on the right a framed slide switch, vents and the charging port. No servo: it
//   hops and its ring swings.
//   Its screen shows the Mini's own faces (miniFaces.ts), not the desk robot's.
// printer: the pocket thermal printer standing upright: one soft rounded body, glossy white at the
//   front and mint (or soft coral) at the back, meeting flush round the sides; the paper slot across the front, two
//   cat ears in the shell colour and vent holes on top. No screen: on
//   connect it hops, the LED on top lights and a paper strip printed "Privet" feeds out of the slot.
export type RobotMood='sleeping'|'connected';
export type FigureModel=CompanionModel|'printer';
export type RobotScene={setMood:(mood:RobotMood)=>void;resize:(width:number,height:number)=>void;dispose:()=>void};

const CREAM=0xeee2c6;
const DOT=4; // texture pixels per OLED pixel: a 3 px lit dot and a 1 px gap, like the real panel.

function roundedRect(width:number,height:number,radius:number){
 const shape=new Shape(),x=-width/2,y=-height/2;
 shape.moveTo(x+radius,y);shape.lineTo(x+width-radius,y);shape.quadraticCurveTo(x+width,y,x+width,y+radius);
 shape.lineTo(x+width,y+height-radius);shape.quadraticCurveTo(x+width,y+height,x+width-radius,y+height);
 shape.lineTo(x+radius,y+height);shape.quadraticCurveTo(x,y+height,x,y+height-radius);
 shape.lineTo(x,y+radius);shape.quadraticCurveTo(x,y,x+radius,y);
 return shape;
}
// A rounded slab fitted exactly to width×height×depth (bevels included), smooth-shaded.
// vertical: extruded upward (a base seen from above); otherwise extruded toward the viewer (a head).
// steps: segments along the depth (more lets a colour split run cleanly round the sides).
function slab(width:number,height:number,depth:number,radius:number,bevel:number,vertical:boolean,steps=1){
 const across=vertical?depth:height;
 const geometry:BufferGeometry=new ExtrudeGeometry(roundedRect(width,across,radius),{depth:1,steps,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel*.9,bevelSegments:10,curveSegments:14});
 if(vertical)geometry.rotateX(-Math.PI/2);
 geometry.computeBoundingBox();const box=geometry.boundingBox!;
 geometry.translate(-(box.min.x+box.max.x)/2,-(vertical?box.min.y:(box.min.y+box.max.y)/2),-(box.min.z+box.max.z)/2);
 geometry.scale(width/(box.max.x-box.min.x),height/(box.max.y-box.min.y),depth/(box.max.z-box.min.z));
 geometry.deleteAttribute('uv');geometry.deleteAttribute('normal');
 const smooth=mergeVertices(geometry,1e-4);smooth.computeVertexNormals();geometry.dispose();
 return smooth;
}
// 3D-printed PLA: faint horizontal layer lines in world space, faded out where they would alias.
function pla(color:number){
 const material=new MeshStandardMaterial({color,roughness:.62});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vLayerY;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvLayerY=(modelMatrix*vec4(transformed,1.0)).y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vLayerY;').replace('#include <color_fragment>','#include <color_fragment>\nfloat layer=vLayerY*90.0;float fade=1.0-clamp(fwidth(layer)*1.6,0.0,1.0);diffuseColor.rgb*=1.0-0.035*fade*(0.5+0.5*sin(layer*6.2832));');
 };
 return material;
}
function shadowTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d')!;const g=ctx.createRadialGradient(64,64,0,64,64,64);
 g.addColorStop(0,'rgba(70,45,32,.5)');g.addColorStop(.45,'rgba(70,45,32,.22)');g.addColorStop(1,'rgba(70,45,32,0)');
 ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}
// Firmware servo gesture for CONNECTED (ServoMotion.h case 9): to 1400 µs in 400 ms, hold 150 ms,
// back to centre in 650 ms, with the firmware's cubic ease. 100 µs ≈ 9° on the SG90.
function servoAngle(age:number){
 const ease=(from:number,to:number,t:number,duration:number)=>{if(t>=duration)return to;const x=t/duration;return from+(to-from)*x*x*(3-2*x);};
 const pulse=age<400?ease(1500,1400,age,400):age<550?1400:ease(1400,1500,age-550,650);
 return (pulse-1500)/1000*Math.PI/2;
}

const add=<T extends Mesh>(parent:Group,mesh:T,x=0,y=0,z=0)=>{mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
// A figure: its meshes (the OLED glass placed by the builder), framing and its own motion.
// animate: since = ms in the current mood; t = s since the entrance began. Returns the lift above the floor.
// face: that companion's firmware faces.
type Figure={root:Group;camera:{x:number;y:number;z:number;target:number};shadow:number;face:typeof renderFirmwareFace;animate:(mood:RobotMood,since:number,t:number)=>number};
type Parts={glass:Material;reducedMotion:boolean;palette:FigurePalette};

function deskFigure({glass,reducedMotion,palette}:Parts):Figure{
 const plastic=pla(palette.plastic);
 const robot=new Group();
 // Base: a pillowy body, wider at the bottom with a sloped front. Its rounded lower edge sits
 // into a flush bottom lid, leaving the slight overhang and seam of the printed enclosure.
 const BODY_BOTTOM=.05,BODY_HEIGHT=.95,DEPTH=1.2,LID_TOP=.17,TAPER_X=.1,TAPER_Z=.13,SLOPE=.07;
 const body=slab(1.6,BODY_HEIGHT,DEPTH,.34,.26,true);
 const position=body.getAttribute('position');
 let seamX=0,seamZ=0;
 for(let i=0;i<position.count;i++){
  const k=position.getY(i)/BODY_HEIGHT;
  position.setX(i,position.getX(i)*(1-TAPER_X*k));position.setZ(i,position.getZ(i)*(1-TAPER_Z*k)-SLOPE*k);
  if(Math.abs(position.getY(i)+BODY_BOTTOM-LID_TOP)<.03){seamX=Math.max(seamX,Math.abs(position.getX(i)));seamZ=Math.max(seamZ,Math.abs(position.getZ(i)));}
 }
 body.computeVertexNormals();
 add(robot,new Mesh(body,plastic),0,BODY_BOTTOM);
 add(robot,new Mesh(slab(seamX*2+.012,LID_TOP-.05,seamZ*2+.012,.3,.02,true),plastic),0,.05);
 const metal=new MeshStandardMaterial({color:0xd0d0cc,metalness:1,roughness:.28});
 for(const x of [-seamX+.18,seamX-.18]){const screw=add(robot,new Mesh(new CylinderGeometry(.028,.028,.012,20),metal),x,.11,seamZ+.012);screw.rotation.x=Math.PI/2;}
 const rubber=new MeshStandardMaterial({color:0x252220,roughness:.9});
 for(const [x,z] of [[-.6,-.4],[.6,-.4],[-.6,.4],[.6,.4]])add(robot,new Mesh(new CylinderGeometry(.07,.075,.05,24),rubber),x,.025,z);
 // Button on the sloped front, tilted to sit flush.
 const frontZ=(y:number)=>{const k=(y-BODY_BOTTOM)/BODY_HEIGHT;return DEPTH/2*(1-TAPER_Z*k)-SLOPE*k;};
 const button=new Group();button.position.set(0,.52,frontZ(.52));button.rotation.x=-Math.atan((DEPTH/2*TAPER_Z+SLOPE)/BODY_HEIGHT);robot.add(button);
 const cream=new MeshPhysicalMaterial({color:CREAM,roughness:.38,clearcoat:.35,clearcoatRoughness:.4});
 const rim=add(button,new Mesh(new CylinderGeometry(.135,.14,.05,40),cream),0,0,.01);rim.rotation.x=Math.PI/2;
 const dome=add(button,new Mesh(new SphereGeometry(.135,40,16,0,Math.PI*2,0,Math.PI/2),cream),0,0,.034);dome.rotation.x=Math.PI/2;dome.scale.set(1,.28,1);
 // The neck rises out of a recessed ring on the flat top.
 const TOP=BODY_BOTTOM+BODY_HEIGHT;
 add(robot,new Mesh(new CylinderGeometry(.2,.2,.004,40),new MeshStandardMaterial({color:0x7d3626,roughness:.9})),0,TOP+.001,-.05);
 const collar=add(robot,new Mesh(new TorusGeometry(.19,.024,14,48),plastic),0,TOP+.004,-.05);collar.rotation.x=Math.PI/2;
 add(robot,new Mesh(new CylinderGeometry(.12,.125,.24,32),plastic),0,TOP+.12,-.05);
 // Head on the servo axis: yaw turns it about the neck like the real one.
 const head=new Group();head.position.set(0,TOP+.2,-.05);robot.add(head);
 const HEAD_HEIGHT=.68,HEAD_DEPTH=.52;
 add(head,new Mesh(slab(1.12,HEAD_HEIGHT,HEAD_DEPTH,.2,.08,false),plastic),0,HEAD_HEIGHT/2);
 add(head,new Mesh(new ShapeGeometry(roundedRect(.8,.5,.06),8),new MeshStandardMaterial({color:0x2a2c2c,roughness:.5})),0,HEAD_HEIGHT/2,HEAD_DEPTH/2+.001);
 add(head,new Mesh(new PlaneGeometry(.74,.44),glass),0,HEAD_HEIGHT/2,HEAD_DEPTH/2+.003);
 let yaw=0;
 return {root:robot,camera:{x:0,y:1.5,z:6.1,target:.93},shadow:1,face:renderFirmwareFace,animate(mood,since){
  // Head: the firmware's CONNECTED servo curve, followed with a little inertia like a real servo.
  const target=mood==='connected'&&!reducedMotion?servoAngle(since):0;
  yaw+=(target-yaw)*(reducedMotion?1:.32);head.rotation.y=yaw;
  return 0;
 }};
}

// Keychain proportions at 1 unit = 25 mm.
const MINI_WIDTH=1.6,MINI_HEIGHT=1.68,MINI_DEPTH=.72,RING_RADIUS=.44,RING_LEAN=.32;
// CONNECTED: a happy hop as the eyes open (with a small landing bounce), then rest.
function hop(since:number){
 const arc=(t:number,start:number,duration:number,height:number)=>{const x=(t-start)/duration;return x>0&&x<1?height*4*x*(1-x):0;};
 return arc(since,120,420,.2)+arc(since,540,200,.035);
}
function miniFigure({glass,reducedMotion,palette}:Parts):Figure{
 const plastic=pla(palette.plastic);
 const root=new Group(),device=new Group();root.add(device);
 const W=MINI_WIDTH,H=MINI_HEIGHT,D=MINI_DEPTH,FRONT=D/2,SIDE=W/2;
 add(device,new Mesh(slab(W,H,D,.36,.16,false),plastic),0,H/2);
 // Front, after the concept illustration: a wide glossy black glass panel set low on the front, with
 // a bevelled rim catching the light, the 2:1 OLED inset in it, faint cheeks and the status LED.
 const SCREEN_Y=.96,PANEL_W=W*.88,PANEL_H=H*.58;
 const bezel=new MeshPhysicalMaterial({color:0x080707,roughness:.14,clearcoat:1,clearcoatRoughness:.05});
 add(device,new Mesh(slab(PANEL_W,PANEL_H,.04,.07,.016,false),bezel),0,SCREEN_Y,FRONT-.012);
 add(device,new Mesh(new ShapeGeometry(roundedRect(PANEL_W*.8,PANEL_W*.4,.02),6),new MeshStandardMaterial({color:0x1c1d1f,roughness:.5})),0,SCREEN_Y+.02,FRONT+.026);
 add(device,new Mesh(new PlaneGeometry(PANEL_W*.76,PANEL_W*.38),glass),0,SCREEN_Y+.02,FRONT+.029);
 const blush=new MeshStandardMaterial({color:palette.blush??0xf2cfc4,roughness:.8,transparent:true,opacity:.22});
 for(const x of [-.56,.56])add(device,new Mesh(new CircleGeometry(.12,40),blush),x,.24,FRONT+.001);
 const led=new MeshStandardMaterial({color:0xf8c4a6,roughness:.35,emissive:0xff7a3a,emissiveIntensity:0});
 const ledDome=add(device,new Mesh(new SphereGeometry(.034,24,12,0,Math.PI*2,0,Math.PI/2),led),0,.24,FRONT);ledDome.rotation.x=Math.PI/2;ledDome.scale.set(1,.5,1);
 // Top right: the big click button, a thick cream cap on a wide, low white collar.
 const cream=new MeshPhysicalMaterial({color:CREAM,roughness:.38,clearcoat:.35,clearcoatRoughness:.4});
 const BUTTON_X=.34,BUTTON_Z=-.04;
 add(device,new Mesh(new CylinderGeometry(.33,.34,.06,56),plastic),BUTTON_X,H+.01,BUTTON_Z);
 add(device,new Mesh(new CylinderGeometry(.245,.25,.13,56),cream),BUTTON_X,H+.1,BUTTON_Z);
 const cap=add(device,new Mesh(new SphereGeometry(.245,56,16,0,Math.PI*2,0,Math.PI/2),cream),BUTTON_X,H+.163,BUTTON_Z);cap.scale.set(1,.12,1);
 // Top left: the keyring lug with its hole, a small split ring through it and the big key ring.
 const LUG_X=-.46,HOLE_Y=H+.13;
 add(device,new Mesh(slab(.32,.42,.28,.15,.06,false),plastic),LUG_X,H+.1);
 const hole=new MeshStandardMaterial({color:0x6b625c,roughness:.9});
 for(const z of [.151,-.151]){const disc=add(device,new Mesh(new CircleGeometry(.062,24),hole),LUG_X,HOLE_Y,z);if(z<0)disc.rotation.y=Math.PI;}
 const metal=new MeshStandardMaterial({color:0xd8d8d4,metalness:1,roughness:.22});
 const LOOP=.15,loop=add(device,new Mesh(new TorusGeometry(LOOP,.026,16,56),metal),LUG_X,HOLE_Y+LOOP);loop.rotation.y=Math.PI/2;
 // The key ring hangs from the top of the loop, leaning left and back; it swings about that point.
 const pivot=new Group();pivot.position.set(LUG_X,HOLE_Y+2*LOOP-.02,0);device.add(pivot);
 const ring=add(pivot,new Mesh(new TorusGeometry(RING_RADIUS,.036,20,120),metal),0,RING_RADIUS);ring.rotation.y=.25;
 // Right side: the slide switch in a raised white frame (cream knob at the top of its track), three
 // vent ribs below it and the USB-C charging port, all on the flat part of the side.
 const recess=new MeshStandardMaterial({color:0xd6d2cb,roughness:.7});
 // Side parts are front-facing slabs turned a quarter: their rounding then faces sideways.
 const side=(w:number,h:number,t:number,r:number,material:Material,x:number,y:number,z=0)=>{const part=add(device,new Mesh(slab(w,h,t,r,Math.min(r,t)*.4,false),material),x,y,z);part.rotation.y=Math.PI/2;return part;};
 side(.2,.42,.05,.08,plastic,SIDE-.006,1.1);
 side(.11,.34,.03,.05,recess,SIDE+.012,1.1);
 side(.1,.13,.09,.04,cream,SIDE+.03,1.19);
 for(const y of [.62,.72,.82]){const rib=add(device,new Mesh(new CapsuleGeometry(.022,.26,6,16),plastic),SIDE-.004,y,.06);rib.rotation.x=Math.PI/2;}
 // USB-C, set into the side (8.4 × 2.6 mm at this scale): the dark stadium opening, a thin metal
 // shell round it and the contact tongue inside, lying on the surface rather than standing off it.
 const PORT_W=.34,PORT_H=.105,usb=new Group();usb.position.set(SIDE+.001,.44,0);usb.rotation.y=Math.PI/2;device.add(usb);
 const stadium=(w:number,h:number)=>roundedRect(w,h,h/2*.999);
 const shellShape=stadium(PORT_W+.032,PORT_H+.032);shellShape.holes.push(stadium(PORT_W,PORT_H));
 add(usb,new Mesh(new ShapeGeometry(stadium(PORT_W,PORT_H),16),new MeshStandardMaterial({color:0x0c0c0d,roughness:.6})),0,0,0);
 add(usb,new Mesh(new ShapeGeometry(shellShape,16),new MeshStandardMaterial({color:0xbdbcb8,metalness:.9,roughness:.3})),0,0,.002);
 add(usb,new Mesh(new ShapeGeometry(roundedRect(PORT_W*.62,.026,.01),4),new MeshStandardMaterial({color:0x3a3a3c,roughness:.5})),0,0,.003);

 let swing=0,swingVelocity=0,last=0;
 return {root,camera:{x:0,y:2,z:7.6,target:1.38},shadow:1.15,face:renderMiniFace,animate(mood,since,t){
  const lift=mood==='connected'&&!reducedMotion?hop(since):0;
  device.position.y=lift;
  // A little lean into the jump and back on landing.
  device.rotation.z=mood==='connected'&&!reducedMotion&&since<760?-.06*Math.sin(Math.PI*Math.min(1,since/760)):0;
  // The key ring: a damped pendulum, kicked by the hop and nudged by the idle float.
  const dt=last?Math.min(.05,t-last):0;last=t;
  if(reducedMotion){swing=0;swingVelocity=0;}
  else{
   const push=(mood==='connected'&&since>120&&since<300?-9:0)+(mood==='connected'&&since>540&&since<640?7:0)+.35*Math.sin(t*1.25);
   swingVelocity+=(push-28*swing-2.2*swingVelocity)*dt;swing+=swingVelocity*dt;
  }
  pivot.rotation.set(-.42,0,RING_LEAN+swing);
  led.emissiveIntensity=mood==='connected'?Math.min(1,Math.max(0,(since-450)/250))*3:0;
  return lift;
 }};
}

// Printer proportions (upright, about 80 × 92 × 45 mm).
const PRINTER_W=1.66,PRINTER_H=1.92,PRINTER_D=.92,SLOT_Y=.84,PAPER_LENGTH=.58;
// The face printed on the upper front, after the real printer's: round eyes with highlights, two
// whisker strokes beside each and an "ω" mouth. It is printed on, so it never changes.
function printerFace(){
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
 const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,320,180);
 ctx.fillStyle=ctx.strokeStyle='#5b2e2c';ctx.lineCap='round';ctx.lineJoin='round';
 for(const [x,side] of [[100,-1],[220,1]] as const){
  ctx.beginPath();ctx.arc(x,70,34,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+11,57,12,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x-12,84,5.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5b2e2c';
  // Whiskers: two short waves on the outer side of each eye.
  ctx.lineWidth=6;
  for(const dy of [-9,9]){
   const x0=x+side*48,x1=x+side*78;
   ctx.beginPath();ctx.moveTo(x0,70+dy);ctx.quadraticCurveTo((x0+x1)/2,70+dy-8,x1,70+dy+(dy<0?-4:4));ctx.stroke();
  }
 }
 // The "ω" mouth between and below the eyes.
 ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(136,124);ctx.quadraticCurveTo(144,152,160,134);ctx.quadraticCurveTo(176,152,184,124);ctx.stroke();
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}
// The Privet wordmark on the lower front: teal with the coral dot.
function printerLogo(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=72;
 const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,256,72);
 ctx.font='800 50px system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';ctx.textBaseline='middle';ctx.textAlign='left';
 const width=ctx.measureText('Privet').width,x=(256-width-14)/2;
 ctx.fillStyle='#246653';ctx.fillText('Privet',x,38);
 ctx.fillStyle='#df795f';ctx.beginPath();ctx.arc(x+width+8,52,6,0,Math.PI*2);ctx.fill();
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}
const decal=(map:CanvasTexture)=>new MeshStandardMaterial({map,transparent:true,roughness:.4,polygonOffset:true,polygonOffsetFactor:-2,depthWrite:false});
// The strip that feeds out: "Privet" with a little robot, printed in black on white thermal paper.
function paperTexture(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=180;
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fbfbf8';ctx.fillRect(0,0,256,180);ctx.fillStyle='#1d1d1d';
 ctx.font='800 46px system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';ctx.textAlign='center';ctx.fillText('Privet',140,66);
 ctx.beginPath();ctx.roundRect(22,30,40,32,8);ctx.fill();ctx.fillStyle='#fbfbf8';ctx.beginPath();ctx.roundRect(28,36,28,19,5);ctx.fill();
 ctx.fillStyle='#1d1d1d';ctx.beginPath();ctx.arc(37,45,3,0,Math.PI*2);ctx.arc(47,45,3,0,Math.PI*2);ctx.fill();
 for(const [y,w] of [[100,180],[120,140],[140,160],[160,120]])ctx.fillRect(128-w/2,y,w,5);
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}
function printerFigure({reducedMotion,palette}:Parts):Figure{
 const SHELL=palette.shell??0xa9e5e3;
 const root=new Group(),device=new Group();root.add(device);
 const W=PRINTER_W,H=PRINTER_H,D=PRINTER_D,FRONT=D/2;
 // One body: white in front of the split, mint behind it, blended over a hair so the line is clean.
 const body=slab(W,H,D,.5,.22,false,40);
 const SPLIT=D*.1,BLEND=.012,position=body.getAttribute('position'),colors:number[]=[];
 // Vertex colours are linear: Color converts the sRGB hex.
 const mintLinear=new Color(SHELL),frontLinear=new Color(palette.plastic),whiteColor=[frontLinear.r,frontLinear.g,frontLinear.b],mintColor=[mintLinear.r,mintLinear.g,mintLinear.b];
 for(let i=0;i<position.count;i++){
  const t=Math.min(1,Math.max(0,(position.getZ(i)-SPLIT+BLEND)/(2*BLEND))),k=t*t*(3-2*t);
  colors.push(...mintColor.map((m,c)=>m+(whiteColor[c]-m)*k));
 }
 body.setAttribute('color',new Float32BufferAttribute(colors,3));
 const shell=new MeshPhysicalMaterial({vertexColors:true,roughness:.3,clearcoat:.7,clearcoatRoughness:.18});
 add(device,new Mesh(body,shell),0,H/2);
 // The paper slot: a dark groove under the lid's edge, almost the full width of the front.
 const slot=add(device,new Mesh(new CapsuleGeometry(.022,W-.5,6,16),new MeshStandardMaterial({color:0x3a3e43,roughness:.8})),0,SLOT_Y,FRONT-.005);slot.rotation.z=Math.PI/2;
 const lip=add(device,new Mesh(new CapsuleGeometry(.018,W-.46,6,16),shell),0,SLOT_Y+.035,FRONT-.002);lip.rotation.z=Math.PI/2;
 // Cat ears on the mint top corners, vent holes and the status LED between them.
 const mint=new MeshPhysicalMaterial({color:SHELL,roughness:.32,clearcoat:.6,clearcoatRoughness:.2});
 // Ears: full rounded domes sunk well into the shell, so they grow out of the top with no gap.
 for(const x of [-W/2+.4,W/2-.4]){const ear=add(device,new Mesh(new SphereGeometry(.2,40,24),mint),x,H-.06,-D*.12);ear.scale.set(1,.92,.78);}
 const hole=new MeshStandardMaterial({color:palette.holes??0x5a6d6c,roughness:.9});
 for(const [x,z] of [[-.12,-.24],[0,-.24],[.12,-.24]]){const dot=add(device,new Mesh(new CircleGeometry(.026,16),hole),x,H+.001,z);dot.rotation.x=-Math.PI/2;}
 const led=new MeshStandardMaterial({color:palette.led??0xdff3f1,roughness:.35,emissive:0x3fd6c8,emissiveIntensity:0});
 const ledDome=add(device,new Mesh(new SphereGeometry(.035,24,12,0,Math.PI*2,0,Math.PI/2),led),.26,H,-.24);ledDome.scale.set(1,.5,1);
 // The printed face on the upper front and the Privet wordmark below the slot.
 add(device,new Mesh(new PlaneGeometry(1.3,.73),decal(printerFace())),0,1.33,FRONT+.004);
 add(device,new Mesh(new PlaneGeometry(.76,.21),decal(printerLogo())),0,.36,FRONT+.004);
 // The white slide switch on the left side.
 const switchCap=add(device,new Mesh(slab(.04,.2,.12,.02,.012,false),new MeshPhysicalMaterial({color:0xffffff,roughness:.3})),-W/2-.005,H-.62,-.02);switchCap.rotation.y=Math.PI/2;
 // Paper strip from the slot. The print moves with the paper: the bottom lines come out first and
 // travel down, "Privet" comes out last, just under the slot. A short strip sticks out of the slot and
 // droops onto the lower front as it gets longer.
 const texture=paperTexture();
 const paperGeometry=new PlaneGeometry(W-.42,1);paperGeometry.translate(0,-.5,0);
 const hinge=new Group();hinge.position.set(0,SLOT_Y,FRONT+.03);device.add(hinge);
 const paper=add(hinge,new Mesh(paperGeometry,new MeshStandardMaterial({map:texture,roughness:.85,side:2})),0,0,0);
 const feed=(fraction:number)=>{
  const f=Math.max(.001,Math.min(1,fraction));
  paper.visible=fraction>0;paper.scale.y=f*PAPER_LENGTH;
  // Plane bottom (free end) shows the texture's bottom; its top, at the slot, the line printed last.
  texture.repeat.set(1,f);texture.offset.set(0,0);
  hinge.rotation.x=-(.95-.8*f);
 };
 feed(0);
 const blank:Uint8Array=new Uint8Array(OLED_WIDTH*OLED_HEIGHT);
 return {root,camera:{x:0,y:2.1,z:6.6,target:1.06},shadow:1.05,face:(()=>blank) as typeof renderFirmwareFace,animate(mood,since){
  const connected=mood==='connected';
  // A small hop like the Mini's (no shake or lean), then the LED and the paper feed.
  const lift=connected&&!reducedMotion?hop(since):0;
  led.emissiveIntensity=connected?Math.min(1,Math.max(0,(since-300)/250))*4.5:0;
  const x=reducedMotion?1:Math.min(1,Math.max(0,(since-700)/1300));
  feed(connected?1-Math.pow(1-x,2):0);
  device.position.y=lift;
  return lift;
 }};
}

// onReady: called once the first frame is on the canvas; the entrance starts from that frame.
export function createRobotScene(canvas:HTMLCanvasElement,{model='desk',colour,reducedMotion=false,onReady}:{model?:FigureModel;colour?:DeviceColour;reducedMotion?:boolean;onReady?:()=>void}={}):RobotScene{
 const renderer=new WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=NeutralToneMapping;renderer.toneMappingExposure=.95;
 const scene=new Scene();
 const pmrem=new PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room,.04).texture;scene.environment=environment;scene.environmentIntensity=.5;
 const key=new DirectionalLight(0xfff1e2,1.4);key.position.set(2.2,4,3.2);scene.add(key);

 // The OLED: glossy black glass whose emissive map is the firmware face, drawn as pixel dots.
 const faceCanvas=document.createElement('canvas');faceCanvas.width=OLED_WIDTH*DOT;faceCanvas.height=OLED_HEIGHT*DOT;
 const faceCtx=faceCanvas.getContext('2d')!;const faceTexture=new CanvasTexture(faceCanvas);faceTexture.colorSpace=SRGBColorSpace;faceTexture.anisotropy=4;
 const glass=new MeshPhysicalMaterial({color:0x000000,roughness:.12,clearcoat:1,clearcoatRoughness:.05,emissive:0xffffff,emissiveMap:faceTexture,emissiveIntensity:1.35});
 const figure=(model==='printer'?printerFigure:model==='mini'?miniFigure:deskFigure)({glass,reducedMotion,palette:figurePalette(model,colour)});
 const robot=figure.root;scene.add(robot);
 const camera=new PerspectiveCamera(25,1,.1,50);camera.position.set(figure.camera.x,figure.camera.y,figure.camera.z);camera.lookAt(0,figure.camera.target,0);
 const shadow=new Mesh(new PlaneGeometry(3*figure.shadow,2.2*figure.shadow),new MeshBasicMaterial({map:shadowTexture(),transparent:true,depthWrite:false}));
 shadow.rotation.x=-Math.PI/2;shadow.position.y=.001;scene.add(shadow);

 let previous='';
 function drawFace(face:FirmwareFace,age:number,clock:number){
  const pixels=figure.face(face,age,clock);
  const signature=pixels.join('');if(signature===previous)return;previous=signature;
  faceCtx.fillStyle='#000';faceCtx.fillRect(0,0,faceCanvas.width,faceCanvas.height);
  faceCtx.fillStyle='#e9f5ff';
  for(let y=0;y<OLED_HEIGHT;y++)for(let x=0;x<OLED_WIDTH;x++)if(pixels[y*OLED_WIDTH+x])faceCtx.fillRect(x*DOT,y*DOT,DOT-1,DOT-1);
  faceTexture.needsUpdate=true;
 }

 // Nothing is drawn until the canvas has its real size, so the first frame shown is the entrance's first.
 let start=0,mood:RobotMood='sleeping',moodAt=0,frame=0,disposed=false,sized=false;
 const easeOut=(x:number)=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
 function render(now=performance.now()){
  const first=!start;if(first){start=now;moodAt=Math.max(moodAt,now);}
  const t=(now-start)/1000,since=now-moodAt;
  // Entrance: rise and turn in from the side, then a slow drift and float.
  const intro=reducedMotion?1:easeOut(t/1.6);
  robot.rotation.y=-.34+(1-intro)*-.95+(reducedMotion?0:.13*Math.sin(t*.62)*intro);
  robot.position.y=reducedMotion?0:(1-intro)*-.18+.022*Math.sin(t*1.25)*intro;
  robot.scale.setScalar(.9+.1*intro);
  const lift=figure.animate(mood,since,t);
  shadow.scale.setScalar(1-(robot.position.y+lift)*.6);
  const face:FirmwareFace=mood==='sleeping'?'sleeping':since<CONNECTED_FACE_MS?'connected':'idle';
  drawFace(face,face==='sleeping'?now-start:face==='connected'?since:since-CONNECTED_FACE_MS,now-start);
  renderer.render(scene,camera);
  if(first)onReady?.();
 }
 function loop(now:number){if(disposed)return;if(sized&&!document.hidden)render(now);frame=requestAnimationFrame(loop);}
 frame=requestAnimationFrame(loop);
 return {
  setMood(next){if(next===mood)return;mood=next;moodAt=performance.now();},
  resize(width,height){renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();sized=true;render();},
  dispose(){
   disposed=true;cancelAnimationFrame(frame);
   scene.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();const materials:Material[]=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){(material as MeshBasicMaterial).map?.dispose();material.dispose();}}});
   faceTexture.dispose();environment.dispose();pmrem.dispose();renderer.dispose();
  },
 };
}
