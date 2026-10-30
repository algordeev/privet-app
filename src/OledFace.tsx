import {useEffect,useRef} from 'react';
import {CONNECTED_FACE_MS,OLED_HEIGHT,OLED_WIDTH,renderFirmwareFace} from './oledFaces';
import type {RobotMood} from './robotScene';

// The firmware face on a flat OLED: shown while the 3D robot loads, or instead of it without WebGL.
export function OledFace({mood}:{mood:RobotMood}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(!ctx)return;
  const start=performance.now();let frame=0;
  const image=ctx.createImageData(OLED_WIDTH,OLED_HEIGHT);
  const draw=(now:number)=>{
   const age=now-start,face=mood==='sleeping'?'sleeping':age<CONNECTED_FACE_MS?'connected':'idle';
   const pixels=renderFirmwareFace(face,face==='idle'?age-CONNECTED_FACE_MS:age,age);
   for(let i=0;i<pixels.length;i++){const v=pixels[i]?235:0;image.data[i*4]=v;image.data[i*4+1]=v+10;image.data[i*4+2]=v+20;image.data[i*4+3]=255;}
   ctx.putImageData(image,0,0);frame=requestAnimationFrame(draw);
  };
  frame=requestAnimationFrame(draw);return ()=>cancelAnimationFrame(frame);
 },[mood]);
 return <div className="oled-face" aria-hidden="true"><canvas ref={canvas} width={OLED_WIDTH} height={OLED_HEIGHT}/></div>;
}
