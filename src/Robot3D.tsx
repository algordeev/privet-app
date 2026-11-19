import {useEffect,useRef,useState} from 'react';
import {createRobotScene,type FigureModel,type RobotMood,type RobotScene} from './robotScene';
import type {DeviceColour} from './figureColours';
import {PrintIcon} from './Icons';
import {OledFace} from './OledFace';

// Loaded lazily (three.js stays out of the main bundle). Without WebGL it falls back to the flat face.
// colour: the device's body colour; omitted, each model shows its usual one.
export default function Robot3D({mood,model='desk',colour}:{mood:RobotMood;model?:FigureModel;colour?:DeviceColour}){
 const canvas=useRef<HTMLCanvasElement>(null),scene=useRef<RobotScene|null>(null);
 const [failed,setFailed]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  let robot:RobotScene;
  try{robot=createRobotScene(element,{model,colour,reducedMotion:!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,onReady:()=>setReady(true)});}
  catch{setFailed(true);return;}
  scene.current=robot;
  const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width&&height)robot.resize(width,height);});
  observer.observe(element);
  return ()=>{observer.disconnect();scene.current=null;robot.dispose();};
 },[model,colour]);
 useEffect(()=>{scene.current?.setMood(mood);},[mood,model]);
 // The printer has no screen: without WebGL it shows a printer icon instead.
 return failed?(model==='printer'?<span className="robot-3d-fallback-printer"><PrintIcon/></span>:<OledFace mood={mood} model={model}/>):<canvas ref={canvas} className="robot-3d" data-ready={ready} aria-hidden="true"/>;
}
