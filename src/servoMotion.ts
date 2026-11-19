// The desk robot's head gestures, ported from the firmware (PrivetBLE_S3_v5/ServoMotion.h) so the
// app's 3D robot moves the way the real one does. Keep in sync with the firmware's keyframes.
// Degrees: tilt + is head up, pan + turns toward the side the eyes look to. 0 = straight ahead.
export type Reaction='happy'|'encourage'|'celebrate'|'hint'|'connected';
export const TILT_HOME_DEG=8;
const PAN_LIMIT_DEG=18,TILT_MIN_DEG=-18,TILT_MAX_DEG=20;
type Key=readonly [at:number,deg:number];
// Tilt keyframes are relative to the resting tilt; pan keyframes are absolute. The firmware's first
// key is "wherever the head is": here that is the resting pose.
const GESTURES:Record<Reaction,{pan:readonly Key[];tilt:readonly Key[]}>={
 happy:{pan:[[300,5],[600,-5],[900,3],[1250,0]],tilt:[[220,9],[440,2],[660,10],[880,3],[1250,0]]},
 encourage:{pan:[[550,-5],[1000,-5],[1550,0]],tilt:[[500,-11],[1000,-11],[1500,5],[1750,1],[1950,4],[2200,0]]},
 celebrate:{pan:[[380,8],[760,-8],[1140,8],[1520,-8],[1900,8],[2280,-8],[2660,0]],tilt:[[380,9],[570,2],[760,9],[950,2],[1140,9],[1330,2],[1520,9],[1710,2],[1900,9],[2090,2],[2280,9],[2660,5],[3000,12],[3600,12],[4000,0]]},
 hint:{pan:[[200,4],[900,4],[1400,0]],tilt:[[200,10],[900,10],[1400,0]]},
 connected:{pan:[[400,-9],[550,-9],[1200,0]],tilt:[[300,-12],[450,-12],[900,10],[1400,0]]},
};
// The firmware shows each reaction face this long (PrivetBLE_S3_v5 reactionDuration).
export const REACTION_MS:Record<Reaction,number>={happy:2000,encourage:2200,celebrate:4500,hint:1500,connected:2400};

// The firmware's cubic ease (smoothstep), in floating point.
const ease=(from:number,to:number,age:number,duration:number)=>{if(age>=duration)return to;const t=age/duration;return from+(to-from)*t*t*(3-2*t);};
function follow(keys:readonly Key[],base:number,from:number,age:number,lo:number,hi:number){
 let previous=from,start=0;
 for(const [at,deg] of keys){
  const next=Math.min(hi,Math.max(lo,base+deg));
  if(age<at)return ease(previous,next,age-start,at-start);
  previous=next;start=at;
 }
 return previous;
}
// Head angles `age` ms into a reaction, starting from the resting pose.
export function headPose(reaction:Reaction,age:number){
 const g=GESTURES[reaction];
 return {
  pan:follow(g.pan,0,0,age,-PAN_LIMIT_DEG,PAN_LIMIT_DEG),
  tilt:follow(g.tilt,TILT_HOME_DEG,TILT_HOME_DEG,age,TILT_MIN_DEG,TILT_MAX_DEG),
 };
}
export const gestureEnd=(reaction:Reaction)=>Math.max(GESTURES[reaction].pan.at(-1)![0],GESTURES[reaction].tilt.at(-1)![0]);
