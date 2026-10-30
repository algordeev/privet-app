import {useEffect,useRef,useState} from 'react';
import {createRobotScene,type RobotMood,type RobotScene} from './robotScene';
import {OledFace} from './OledFace';

// Loaded lazily (three.js stays out of the main bundle). Without WebGL it falls back to the flat face.
export default function Robot3D({mood}:{mood:RobotMood}){
 const canvas=useRef<HTMLCanvasElement>(null),scene=useRef<RobotScene|null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  let robot:RobotScene;
  try{robot=createRobotScene(element,{reducedMotion:!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches});}
  catch{setFailed(true);return;}
  scene.current=robot;
  const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width&&height)robot.resize(width,height);});
  observer.observe(element);
  return ()=>{observer.disconnect();scene.current=null;robot.dispose();};
 },[]);
 useEffect(()=>{scene.current?.setMood(mood);},[mood]);
 return failed?<OledFace mood={mood}/>:<canvas ref={canvas} className="robot-3d" aria-hidden="true"/>;
}
