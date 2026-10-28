#pragma once
#include <stdint.h>
#include <math.h>
namespace PrivetMotion {
static constexpr int CENTER=1500,MINIMUM=1300,MAXIMUM=1700;
enum Axis:uint8_t{PAN,TILT};
inline int clampPulse(int pulse){return pulse<MINIMUM?MINIMUM:pulse>MAXIMUM?MAXIMUM:pulse;}
// Cubic ease-in/out, fixed-point and bounded: no abrupt target reversal and no
// floating point or allocation. Start each new gesture at the last actual pulse.
inline int ease(int from,int to,uint32_t age,uint32_t duration){
 if(age>=duration)return to;
 int64_t t=int64_t(age)*1000/duration;
 int64_t weight=t*t*(3000-2*t)/1000000;
 return clampPulse(from+int((int64_t(to-from)*weight)/1000));
}
// Pan: the original single-servo gestures, unchanged.
inline int panTarget(uint8_t reaction,uint32_t age,int from){
 switch(reaction){
 case 1: if(age<650)return ease(from,1700,age,650);if(age<900)return 1700;return ease(1700,CENTER,age-900,650);
 case 2: if(age<650)return ease(from,1420,age,650);if(age<900)return 1420;return ease(1420,CENTER,age-900,700);
 case 3: if(age<900)return ease(from,1300,age,900);if(age<1800)return ease(1300,1700,age-900,900);if(age<2700)return ease(1700,1300,age-1800,900);if(age<3600)return ease(1300,1700,age-2700,900);return ease(1700,CENTER,age-3600,500);
 case 7: if(age<450)return ease(from,1600,age,450);if(age<700)return 1600;return ease(1600,CENTER,age-700,700);
 case 8: if(age<650)return ease(from,1370,age,650);if(age<1300)return ease(1370,1630,age-650,650);return ease(1630,CENTER,age-1300,650);
 case 9: if(age<400)return ease(from,1400,age,400);if(age<550)return 1400;return ease(1400,CENTER,age-550,650);
 default:return ease(from,CENTER,age,600);
 }
}
// Tilt: small nods, above 1500 = head up. Amplitudes stay well inside the
// pan limits because the tilt joint carries the screen's weight.
inline int tiltTarget(uint8_t reaction,uint32_t age,int from){
 switch(reaction){
 case 1: if(age<400)return ease(from,1580,age,400);if(age<700)return 1580;return ease(1580,CENTER,age-700,600);
 case 2: if(age<700)return ease(from,1440,age,700);if(age<1400)return 1440;return ease(1440,CENTER,age-1400,700);
 case 3: {
  if(age>=3600)return ease(1450,CENTER,age-3600,500);
  const uint32_t segment=age/450,inSegment=age%450;
  const int to=segment%2?1450:1580;
  const int start=segment==0?from:(segment%2?1580:1450);
  return ease(start,to,inSegment,450);
 }
 case 7: if(age<450)return ease(from,1560,age,450);if(age<1100)return 1560;return ease(1560,CENTER,age-1100,600);
 case 8: if(age<500)return ease(from,1580,age,500);if(age<900)return 1580;return ease(1580,CENTER,age-900,600);
 case 9: if(age<300)return ease(from,1440,age,300);if(age<450)return 1440;if(age<900)return ease(1440,1570,age-450,450);return ease(1570,CENTER,age-900,500);
 default:return ease(from,CENTER,age,600);
 }
}
inline int target(Axis axis,uint8_t reaction,uint32_t age,int from){
 from=clampPulse(from);
 return axis==PAN?panTarget(reaction,age,from):tiltTarget(reaction,age,from);
}
// When the gesture is over; after this a centred axis releases its PWM.
// 0 means the reaction has no expressive motion (IDLE, LISTENING, THINKING).
inline uint32_t gestureEnd(Axis axis,uint8_t reaction){
 if(axis==PAN){
  switch(reaction){case 1:return 1500;case 2:return 1700;case 3:return 4100;case 7:return 1500;case 8:return 2100;case 9:return 1300;default:return 0;}
 }
 switch(reaction){case 1:return 1300;case 2:return 2100;case 3:return 4100;case 7:return 1700;case 8:return 1500;case 9:return 1400;default:return 0;}
}
// Smooth follower between the gesture path and the real servo pulse.
// The gesture tables say where the head should be; this decides how it gets
// there: speed and acceleration are bounded and velocity is continuous, so an
// interrupted gesture, a new reaction or a return to centre never snaps or
// reverses instantly. It also brakes in time (v^2 <= 2*a*distance), so it
// does not overshoot the target.
struct Follower {
 float position=CENTER,velocity=0;
 void reset(float pulse){position=pulse;velocity=0;}
 bool settled(float target)const{return position==target&&velocity==0;}
 // dt in seconds; maxSpeed in us/s; maxAccel in us/s^2.
 int step(float target,float dt,float maxSpeed,float maxAccel){
  const float error=target-position;
  const float distance=error<0?-error:error;
  if(distance<0.75f&&(velocity<0?-velocity:velocity)<15.0f){position=target;velocity=0;return int(target+0.5f);}
  float desired=maxSpeed;
  const float braking=sqrtf(2.0f*maxAccel*distance)*0.9f;
  if(braking<desired)desired=braking;
  const float proportional=distance*8.0f;
  if(proportional<desired)desired=proportional;
  if(error<0)desired=-desired;
  const float change=desired-velocity,limit=maxAccel*dt;
  velocity+=change>limit?limit:change<-limit?-limit:change;
  position+=velocity*dt;
  if(position<MINIMUM){position=MINIMUM;velocity=0;}
  if(position>MAXIMUM){position=MAXIMUM;velocity=0;}
  return int(position+(position<0?-0.5f:0.5f));
 }
};
}
