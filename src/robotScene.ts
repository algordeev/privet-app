import {NeutralToneMapping,CanvasTexture,CylinderGeometry,DirectionalLight,ExtrudeGeometry,Group,Mesh,MeshBasicMaterial,MeshPhysicalMaterial,MeshStandardMaterial,PerspectiveCamera,PlaneGeometry,PMREMGenerator,Scene,Shape,ShapeGeometry,SphereGeometry,SRGBColorSpace,TorusGeometry,WebGLRenderer,type BufferGeometry,type Material} from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CONNECTED_FACE_MS,OLED_HEIGHT,OLED_WIDTH,renderFirmwareFace,type FirmwareFace} from './oledFaces';

// The physical companion as a small WebGL scene for the "companion found" card, modelled on the
// enclosure concept: tapered coral PLA base on a screwed bottom lid, cream button, servo neck and a
// head whose OLED shows the firmware's own faces. The head turns with the firmware's servo curve.
export type RobotMood='sleeping'|'connected';
export type RobotScene={setMood:(mood:RobotMood)=>void;resize:(width:number,height:number)=>void;dispose:()=>void};

const CORAL=0xd8684f,CREAM=0xeee2c6;
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
function slab(width:number,height:number,depth:number,radius:number,bevel:number,vertical:boolean){
 const across=vertical?depth:height;
 const geometry:BufferGeometry=new ExtrudeGeometry(roundedRect(width,across,radius),{depth:1,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel*.9,bevelSegments:10,curveSegments:14});
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

export function createRobotScene(canvas:HTMLCanvasElement,{reducedMotion=false}:{reducedMotion?:boolean}={}):RobotScene{
 const renderer=new WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=NeutralToneMapping;renderer.toneMappingExposure=.95;
 const scene=new Scene();
 const pmrem=new PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room,.04).texture;scene.environment=environment;scene.environmentIntensity=.5;
 const key=new DirectionalLight(0xfff1e2,1.4);key.position.set(2.2,4,3.2);scene.add(key);
 const camera=new PerspectiveCamera(25,1,.1,50);camera.position.set(0,1.5,6.1);camera.lookAt(0,.93,0);

 const plastic=pla(CORAL);
 const robot=new Group();scene.add(robot);
 const add=<T extends Mesh>(parent:Group,mesh:T,x=0,y=0,z=0)=>{mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
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
 // The OLED: glossy black glass whose emissive map is the firmware face, drawn as pixel dots.
 const faceCanvas=document.createElement('canvas');faceCanvas.width=OLED_WIDTH*DOT;faceCanvas.height=OLED_HEIGHT*DOT;
 const faceCtx=faceCanvas.getContext('2d')!;const faceTexture=new CanvasTexture(faceCanvas);faceTexture.colorSpace=SRGBColorSpace;faceTexture.anisotropy=4;
 const glass=new MeshPhysicalMaterial({color:0x000000,roughness:.12,clearcoat:1,clearcoatRoughness:.05,emissive:0xffffff,emissiveMap:faceTexture,emissiveIntensity:1.35});
 add(head,new Mesh(new PlaneGeometry(.74,.44),glass),0,HEAD_HEIGHT/2,HEAD_DEPTH/2+.003);
 const shadow=new Mesh(new PlaneGeometry(3,2.2),new MeshBasicMaterial({map:shadowTexture(),transparent:true,depthWrite:false}));
 shadow.rotation.x=-Math.PI/2;shadow.position.y=.001;scene.add(shadow);

 let previous='';
 function drawFace(face:FirmwareFace,age:number,clock:number){
  const pixels=renderFirmwareFace(face,age,clock);
  const signature=pixels.join('');if(signature===previous)return;previous=signature;
  faceCtx.fillStyle='#000';faceCtx.fillRect(0,0,faceCanvas.width,faceCanvas.height);
  faceCtx.fillStyle='#e9f5ff';
  for(let y=0;y<OLED_HEIGHT;y++)for(let x=0;x<OLED_WIDTH;x++)if(pixels[y*OLED_WIDTH+x])faceCtx.fillRect(x*DOT,y*DOT,DOT-1,DOT-1);
  faceTexture.needsUpdate=true;
 }

 const start=performance.now();
 let mood:RobotMood='sleeping',moodAt=start,frame=0,disposed=false,yaw=0;
 const easeOut=(x:number)=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
 function render(now=performance.now()){
  const t=(now-start)/1000,since=now-moodAt;
  // Entrance: rise and turn in from the side, then a slow drift and float.
  const intro=reducedMotion?1:easeOut(t/1.6);
  robot.rotation.y=-.34+(1-intro)*-.95+(reducedMotion?0:.13*Math.sin(t*.62)*intro);
  robot.position.y=reducedMotion?0:(1-intro)*-.18+.022*Math.sin(t*1.25)*intro;
  robot.scale.setScalar(.9+.1*intro);
  shadow.scale.setScalar(1-robot.position.y*.6);
  // Head: the firmware's CONNECTED servo curve, followed with a little inertia like a real servo.
  const target=mood==='connected'&&!reducedMotion?servoAngle(since):0;
  yaw+=(target-yaw)*(reducedMotion?1:.32);head.rotation.y=yaw;
  const face:FirmwareFace=mood==='sleeping'?'sleeping':since<CONNECTED_FACE_MS?'connected':'idle';
  drawFace(face,face==='sleeping'?now-start:face==='connected'?since:since-CONNECTED_FACE_MS,now-start);
  renderer.render(scene,camera);
 }
 function loop(now:number){if(disposed)return;if(!document.hidden)render(now);frame=requestAnimationFrame(loop);}
 frame=requestAnimationFrame(loop);
 return {
  setMood(next){if(next===mood)return;mood=next;moodAt=performance.now();},
  resize(width,height){renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();render();},
  dispose(){
   disposed=true;cancelAnimationFrame(frame);
   scene.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();const materials:Material[]=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){(material as MeshBasicMaterial).map?.dispose();material.dispose();}}});
   faceTexture.dispose();environment.dispose();pmrem.dispose();renderer.dispose();
  },
 };
}
