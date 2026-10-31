#pragma once
#include <stdint.h>
#include <stddef.h>
#include <math.h>
namespace PrivetMotion {

// ===== Tuning, in degrees =====================================================
// 0 = straight ahead. Tilt: + is head up. Pan: + turns toward the side the
// eyes look to (set PAN_INVERTED / TILT_INVERTED in the sketch if a servo is
// mounted the other way round).
//
// Resting tilt: the head sits this far up when nothing is happening.
static constexpr int TILT_HOME_DEG=8;
// Where the head droops to while the phone is away.
static constexpr int SLEEP_TILT_DEG=-9;
// Hard limits. No gesture, glance or setting can drive the head past these.
// Widen them only if the head moves that far freely; a servo pressed against
// a stop buzzes and heats up. A setting that would push a gesture past them
// stops compilation with a message (see the checks at the end of this file).
static constexpr int PAN_LIMIT_DEG=18;
static constexpr int TILT_MIN_DEG=-18,TILT_MAX_DEG=20;
// SG90: roughly 2000 us of pulse across 180 degrees. Angles are approximate.
static constexpr float US_PER_DEGREE=2000.0f/180.0f;
// ==============================================================================

static constexpr int CENTER=1500;
enum Axis:uint8_t{PAN,TILT};
// Reaction codes match the BLE commands; SLEEP is local (phone not connected).
enum Motion:uint8_t{HAPPY=1,ENCOURAGE=2,CELEBRATE=3,IDLE=4,LISTENING=5,THINKING=6,HINT=7,STREAK=8,CONNECTED=9,NOD=11,ON_FIRE=12,SLEEP=20};
enum Style:uint8_t{NORMAL,PERKY,GENTLE};

inline int pulse(float degrees){return CENTER+int(lroundf(degrees*US_PER_DEGREE));}
inline int minPulse(Axis axis){return pulse(axis==TILT?TILT_MIN_DEG:-PAN_LIMIT_DEG);}
inline int maxPulse(Axis axis){return pulse(axis==TILT?TILT_MAX_DEG:PAN_LIMIT_DEG);}
inline int clampPulse(Axis axis,int value){const int lo=minPulse(axis),hi=maxPulse(axis);return value<lo?lo:value>hi?hi:value;}
inline int home(Axis axis){return pulse(axis==TILT?TILT_HOME_DEG:0);}

// Cubic ease-in/out between two in-range pulses, fixed-point, no allocation.
inline int ease(int from,int to,uint32_t age,uint32_t duration){
 if(age>=duration)return to;
 int64_t t=int64_t(age)*1000/duration;
 int64_t weight=t*t*(3000-2*t)/1000000;
 return from+int((int64_t(to-from)*weight)/1000);
}

// A gesture is a list of keyframes {time ms, degrees} eased in order. The first
// key is always {0, FROM}: the gesture starts wherever the head actually is.
// The last key's time is the gesture's end; its angle is held afterwards.
// Tilt keyframes are degrees relative to TILT_HOME_DEG, so raising the resting
// pose raises every gesture with it. Pan keyframes are absolute degrees.
// Moves are deliberately large and quick: small, slow steps only make loaded
// servos buzz without visibly moving.
static constexpr int8_t FROM=-128;
struct Key{uint16_t at;int8_t deg;};
struct Path{const Key *keys;uint8_t count;int base;};
template<size_t N> constexpr Path path(const Key (&keys)[N],int base=0){return {keys,uint8_t(N),base};}

// HAPPY: head lifts and nods "yes, yes!" with a small side wiggle.
static constexpr Key happyPan[]={{0,FROM},{300,5},{600,-5},{900,3},{1250,0}};
static constexpr Key happyTilt[]={{0,FROM},{220,9},{440,2},{660,10},{880,3},{1250,0}};
// ENCOURAGE: sympathetic droop to one side, slow lift, one small nod ("you've got this").
static constexpr Key encouragePan[]={{0,FROM},{550,-5},{1000,-5},{1550,0}};
static constexpr Key encourageTilt[]={{0,FROM},{500,-11},{1000,-11},{1500,5},{1750,1},{1950,4},{2200,0}};
// CELEBRATE: bouncy wiggle with up-bobs, then a proud head-up pose.
static constexpr Key celebratePan[]={{0,FROM},{380,8},{760,-8},{1140,8},{1520,-8},{1900,8},{2280,-8},{2660,0}};
static constexpr Key celebrateTilt[]={{0,FROM},{380,9},{570,2},{760,9},{950,2},{1140,9},{1330,2},{1520,9},{1710,2},{1900,9},{2090,2},{2280,9},{2660,5},{3000,12},{3600,12},{4000,0}};
// HINT: quick "aha!" perk-up.
static constexpr Key hintPan[]={{0,FROM},{200,4},{900,4},{1400,0}};
static constexpr Key hintTilt[]={{0,FROM},{200,10},{900,10},{1400,0}};
static constexpr Key streakPan[]={{0,FROM},{650,-12},{1300,12},{1950,0}};
static constexpr Key streakTilt[]={{0,FROM},{450,10},{900,10},{1500,0}};
// CONNECTED: wake-up nod, a dip and then a lift.
static constexpr Key connectedPan[]={{0,FROM},{400,-9},{550,-9},{1200,0}};
static constexpr Key connectedTilt[]={{0,FROM},{300,-12},{450,-12},{900,10},{1400,0}};
// NOD: one clear "yes" for a correct match pair.
static constexpr Key nodPan[]={{0,FROM},{300,0}};
static constexpr Key nodTilt[]={{0,FROM},{250,-8},{500,2},{700,0}};
// ON_FIRE: head up with an excited little shimmy.
static constexpr Key onFirePan[]={{0,FROM},{250,4},{500,-4},{750,4},{1000,-4},{1250,4},{1500,0}};
static constexpr Key onFireTilt[]={{0,FROM},{220,12},{1500,12},{2000,0}};
// SLEEP: the head slowly droops while the phone is away, then rests unpowered.
// Its tilt is absolute (SLEEP_TILT_DEG), not relative to the resting pose.
static constexpr Key sleepPan[]={{0,FROM},{2500,0}};
static constexpr Key sleepTilt[]={{0,FROM},{2500,SLEEP_TILT_DEG}};
// IDLE, THINKING, LISTENING and anything unknown: settle to the resting pose and stay still.
static constexpr Key settle[]={{0,FROM},{600,0}};

inline Path gesture(Axis axis,uint8_t motion){
 const bool pan=axis==PAN;
 const int tiltBase=TILT_HOME_DEG;
 switch(motion){
 case HAPPY:return pan?path(happyPan):path(happyTilt,tiltBase);
 case ENCOURAGE:return pan?path(encouragePan):path(encourageTilt,tiltBase);
 case CELEBRATE:return pan?path(celebratePan):path(celebrateTilt,tiltBase);
 case HINT:return pan?path(hintPan):path(hintTilt,tiltBase);
 case STREAK:return pan?path(streakPan):path(streakTilt,tiltBase);
 case CONNECTED:return pan?path(connectedPan):path(connectedTilt,tiltBase);
 case NOD:return pan?path(nodPan):path(nodTilt,tiltBase);
 case ON_FIRE:return pan?path(onFirePan):path(onFireTilt,tiltBase);
 case SLEEP:return pan?path(sleepPan):path(sleepTilt);
 default:return pan?path(settle):path(settle,tiltBase);
 }
}
// Target pulse for this axis at `age` ms into the gesture, starting from pulse `from`.
inline int target(Axis axis,uint8_t motion,uint32_t age,int from){
 from=clampPulse(axis,from);
 const Path p=gesture(axis,motion);
 int previous=from;
 for(uint8_t i=1;i<p.count;i++){
  const Key &a=p.keys[i-1],&b=p.keys[i];
  const int next=clampPulse(axis,pulse(float(p.base+b.deg)));
  if(age<b.at)return ease(previous,next,age-a.at,b.at-a.at);
  previous=next;
 }
 return previous;
}
// When the gesture is over; after this a still axis releases its PWM.
// Settling motions (IDLE, THINKING, LISTENING) end at once: they only ease back to rest.
inline uint32_t gestureEnd(Axis axis,uint8_t motion){
 const Path p=gesture(axis,motion);
 return p.keys==settle?0:p.keys[p.count-1].at;
}
inline Style style(uint8_t motion){
 switch(motion){
 case HAPPY:case CELEBRATE:case HINT:case NOD:case ON_FIRE:return PERKY;
 case ENCOURAGE:case LISTENING:case SLEEP:case IDLE:case THINKING:return GENTLE;
 default:return NORMAL;
 }
}
// Idle glance shared by the face and the head, -1000..1000 (0 = straight ahead).
// Every 7.8 s the eyes look aside for 1.8 s, alternating sides.
inline int glance(uint32_t age){
 const uint32_t phase=age%7800U;
 if(phase<2200U||phase>=4000U)return 0;
 const uint32_t t=phase-2200U;
 const int magnitude=t<300U?int(t)*1000/300:t<1500U?1000:int(1800U-t)*1000/300;
 return (age/7800U)%2U?-magnitude:magnitude;
}
// Smooth follower between the gesture path and the real servo pulse.
// The gesture tables say where the head should be; this decides how it gets
// there: speed and acceleration are bounded and velocity is continuous, so an
// interrupted gesture, a new reaction or a return to rest never snaps or
// reverses instantly. It also brakes in time (v^2 <= 2*a*distance), so it
// does not overshoot the target. lo/hi are the axis limits in pulses.
struct Follower {
 float position=CENTER,velocity=0,lo=CENTER,hi=CENTER;
 void limits(Axis axis){lo=float(minPulse(axis));hi=float(maxPulse(axis));}
 void reset(float value){position=value;velocity=0;}
 bool settled(float goal)const{return position==goal&&velocity==0;}
 // dt in seconds; maxSpeed in us/s; maxAccel in us/s^2.
 int step(float goal,float dt,float maxSpeed,float maxAccel){
  const float error=goal-position;
  const float distance=error<0?-error:error;
  if(distance<0.75f&&(velocity<0?-velocity:velocity)<15.0f){position=goal;velocity=0;return int(goal+0.5f);}
  float desired=maxSpeed;
  const float braking=sqrtf(2.0f*maxAccel*distance)*0.9f;
  if(braking<desired)desired=braking;
  const float proportional=distance*8.0f;
  if(proportional<desired)desired=proportional;
  if(error<0)desired=-desired;
  const float change=desired-velocity,limit=maxAccel*dt;
  velocity+=change>limit?limit:change<-limit?-limit:change;
  position+=velocity*dt;
  if(position<lo){position=lo;velocity=0;}
  if(position>hi){position=hi;velocity=0;}
  return int(position+(position<0?-0.5f:0.5f));
 }
};

// ===== Compile-time checks: every gesture must fit inside the limits ==========
template<size_t N> constexpr bool fits(const Key (&keys)[N],int base,int lo,int hi){
 for(size_t i=1;i<N;i++){const int d=base+keys[i].deg;if(d<lo||d>hi)return false;}
 return true;
}
static_assert(TILT_MIN_DEG<0&&TILT_MAX_DEG>0&&PAN_LIMIT_DEG>0,"Limits must include straight ahead (0 degrees).");
static_assert(TILT_HOME_DEG>=TILT_MIN_DEG&&TILT_HOME_DEG<=TILT_MAX_DEG,"TILT_HOME_DEG is outside TILT_MIN_DEG..TILT_MAX_DEG.");
static_assert(SLEEP_TILT_DEG>=TILT_MIN_DEG&&SLEEP_TILT_DEG<=TILT_MAX_DEG,"SLEEP_TILT_DEG is outside TILT_MIN_DEG..TILT_MAX_DEG.");
static_assert(
 fits(happyTilt,TILT_HOME_DEG,TILT_MIN_DEG,TILT_MAX_DEG)&&fits(encourageTilt,TILT_HOME_DEG,TILT_MIN_DEG,TILT_MAX_DEG)&&
 fits(celebrateTilt,TILT_HOME_DEG,TILT_MIN_DEG,TILT_MAX_DEG)&&fits(hintTilt,TILT_HOME_DEG,TILT_MIN_DEG,TILT_MAX_DEG)&&
 fits(streakTilt,TILT_HOME_DEG,TILT_MIN_DEG,TILT_MAX_DEG)&&fits(connectedTilt,TILT_HOME_DEG,TILT_MIN_DEG,TILT_MAX_DEG)&&
 fits(nodTilt,TILT_HOME_DEG,TILT_MIN_DEG,TILT_MAX_DEG)&&fits(onFireTilt,TILT_HOME_DEG,TILT_MIN_DEG,TILT_MAX_DEG),
 "A tilt gesture leaves TILT_MIN_DEG..TILT_MAX_DEG with this TILT_HOME_DEG (gestures reach 12 degrees above and below it). Change TILT_HOME_DEG, or widen the limits only if the head moves that far freely.");
static_assert(
 fits(happyPan,0,-PAN_LIMIT_DEG,PAN_LIMIT_DEG)&&fits(encouragePan,0,-PAN_LIMIT_DEG,PAN_LIMIT_DEG)&&
 fits(celebratePan,0,-PAN_LIMIT_DEG,PAN_LIMIT_DEG)&&fits(hintPan,0,-PAN_LIMIT_DEG,PAN_LIMIT_DEG)&&
 fits(streakPan,0,-PAN_LIMIT_DEG,PAN_LIMIT_DEG)&&fits(connectedPan,0,-PAN_LIMIT_DEG,PAN_LIMIT_DEG)&&
 fits(onFirePan,0,-PAN_LIMIT_DEG,PAN_LIMIT_DEG),
 "A pan gesture leaves -PAN_LIMIT_DEG..PAN_LIMIT_DEG.");
}
