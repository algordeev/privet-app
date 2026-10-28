// Host checks for firmware/PrivetBLE_S3/ServoMotion.h: keyframe tables, the
// follower at the sketch's speed limits, and random interruptions.
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <initializer_list>
#include "ServoMotion.h"
#include "FacePresentation.h"
using namespace PrivetMotion;

// Mirrors PrivetBLE_S3.ino: reactionDuration() and the follower limits per style (degrees -> us).
static uint32_t duration(uint8_t m){switch(m){case HAPPY:return 2000;case ENCOURAGE:return 2200;case CELEBRATE:return 4500;case LISTENING:return 2600;case HINT:return 2600;case STREAK:return 3600;case CONNECTED:return 2400;case NOD:return 900;case ON_FIRE:return 2200;default:return 0;}}
static float speed(uint8_t m){Style s=style(m);return US_PER_DEGREE*(s==PERKY?80.f:s==GENTLE?32.f:50.f);}
static float accel(uint8_t m){Style s=style(m);return US_PER_DEGREE*(s==PERKY?540.f:s==GENTLE?180.f:225.f);}
static const uint8_t motions[]={HAPPY,ENCOURAGE,CELEBRATE,IDLE,LISTENING,THINKING,HINT,STREAK,CONNECTED,NOD,ON_FIRE,SLEEP};
static const Axis axes[]={PAN,TILT};
static float degrees(int value){return (value-CENTER)/US_PER_DEGREE;}

int main(){
 assert(pulse(0)==CENTER&&pulse(9)==1600&&pulse(-18)==1300&&pulse(18)==1700);
 assert(home(PAN)==CENTER&&home(TILT)==pulse(TILT_HOME_DEG)&&TILT_HOME_DEG>0);
 for(uint8_t m:motions)for(Axis axis:axes){
  const Path p=gesture(axis,m);
  assert(p.count>=2&&p.keys[0].at==0&&p.keys[0].deg==FROM);
  for(uint8_t i=1;i<p.count;i++)assert(p.keys[i].at>p.keys[i-1].at);
  // Every keyframe lands inside the axis limits without needing the clamp.
  for(uint8_t i=1;i<p.count;i++){const int d=p.base+p.keys[i].deg;assert(axis==TILT?d>=TILT_MIN_DEG&&d<=TILT_MAX_DEG:d>=-PAN_LIMIT_DEG&&d<=PAN_LIMIT_DEG);}
  const int rest=target(axis,m,600000,home(axis));
  assert(m==SLEEP&&axis==TILT?rest==pulse(SLEEP_TILT_DEG):rest==home(axis));
  // A gesture must finish before the face moves on to its next state.
  if(duration(m))assert(gestureEnd(axis,m)<=duration(m));
 }
 // IDLE, THINKING and LISTENING never move on their own: they only settle to the raised resting pose.
 for(uint8_t m:{IDLE,THINKING,LISTENING})for(Axis axis:axes){assert(gestureEnd(axis,m)==0);for(uint32_t age:{600u,5000u})assert(target(axis,m,age,1450)==home(axis));}
 // Every gesture starts exactly where the head is, from any in-range position.
 for(uint8_t m:motions)for(Axis axis:axes)for(int from:{minPulse(axis),1450,1500,1580,maxPulse(axis)})assert(target(axis,m,0,from)==from);
 // Out-of-range input is clamped to the axis limits.
 assert(clampPulse(TILT,2500)==maxPulse(TILT)&&clampPulse(PAN,500)==minPulse(PAN));

 // Each gesture through the real follower, from the resting pose, 20 ms ticks.
 for(uint8_t m:motions)for(Axis axis:axes){
  const int rest=home(axis);Follower f;f.limits(axis);f.reset(float(rest));int low=rest,high=rest;
  const uint32_t end=gestureEnd(axis,m)+3000;
  for(uint32_t age=0;age<=end;age+=20){
   const int value=f.step(float(target(axis,m,age,rest)),0.02f,speed(m),accel(m));
   assert(value>=minPulse(axis)&&value<=maxPulse(axis));
   assert(f.velocity<=speed(m)+1&&f.velocity>=-speed(m)-1);
   if(value<low)low=value;
   if(value>high)high=value;
  }
  assert(f.settled(float(target(axis,m,600000,rest))));
  printf("%-2u %s moves %+5.1f..%+5.1f deg\n",m,axis==PAN?"pan ":"tilt",degrees(low),degrees(high));
  // Expressive gestures must stay clearly visible after smoothing:
  // vertical moves at least 6 degrees from rest, side moves at least 2.
  const Path p=gesture(axis,m);bool moves=false;
  for(uint8_t i=1;i<p.count;i++)if(pulse(float(p.base+p.keys[i].deg))!=rest)moves=true;
  const int need=int(US_PER_DEGREE*(axis==TILT?6:2));
  if(moves)assert(high-rest>=need||rest-low>=need);
 }
 // The double nod in HAPPY must read as two nods, not one smoothed lift.
 {
  Follower f;f.limits(TILT);f.reset(float(home(TILT)));int peaks=0,last=home(TILT),direction=0;
  for(uint32_t age=0;age<=1500;age+=20){
   const int value=f.step(float(target(TILT,HAPPY,age,home(TILT))),0.02f,speed(HAPPY),accel(HAPPY));
   const int d=value>last?1:value<last?-1:0;
   if(d<0&&direction>0)peaks++;
   if(d)direction=d;
   last=value;
  }
  assert(peaks>=2);
 }

 // Idle glance: bounded, symmetric over two cycles, zero outside the window.
 for(uint32_t age=0;age<20000;age+=10){const int g=glance(age);assert(g>=-1000&&g<=1000);const uint32_t phase=age%7800;if(phase<2200||phase>=4000)assert(g==0);}
 assert(glance(2200+700)==1000&&glance(7800+2200+700)==-1000);

 // Ten simulated minutes of random, often interrupted reactions.
 srand(7);
 Follower pan,tilt;pan.limits(PAN);tilt.limits(TILT);pan.reset(float(home(PAN)));tilt.reset(float(home(TILT)));
 uint8_t m=IDLE;uint32_t started=0;int fromPan=home(PAN),fromTilt=home(TILT);
 for(uint32_t now=0;now<600000;now+=20){
  if(rand()%60==0){m=motions[rand()%(sizeof motions)];started=now;fromPan=int(pan.position+0.5f);fromTilt=int(tilt.position+0.5f);}
  const uint32_t age=now-started;
  const int offset=m==IDLE?int(glance(age)*5*US_PER_DEGREE/1000):0;
  const int p=pan.step(float(clampPulse(PAN,target(PAN,m,age,fromPan)+offset)),0.02f,speed(m),accel(m));
  const int t=tilt.step(float(target(TILT,m,age,fromTilt)),0.02f,speed(m),accel(m));
  assert(p>=minPulse(PAN)&&p<=maxPulse(PAN)&&t>=minPulse(TILT)&&t<=maxPulse(TILT));
 }
 // A final IDLE brings both axes home.
 fromPan=int(pan.position+0.5f);fromTilt=int(tilt.position+0.5f);
 for(uint32_t age=0;age<3000;age+=20){pan.step(float(target(PAN,IDLE,age,fromPan)),0.02f,speed(IDLE),accel(IDLE));tilt.step(float(target(TILT,IDLE,age,fromTilt)),0.02f,speed(IDLE),accel(IDLE));}
 assert(pan.settled(float(home(PAN)))&&tilt.settled(float(home(TILT))));
 // Card timing: a new question shows the thinking face first; returning to the same
 // question (after listening, a hint, a pair nod or another THINKING) draws its card at once.
 using PrivetFaces::cardDelay;
 for(uint8_t previous:{IDLE,HAPPY,ENCOURAGE,ON_FIRE,CONNECTED,CELEBRATE})assert(cardDelay(THINKING,previous,0)==700);
 for(uint8_t previous:{THINKING,LISTENING,HINT,NOD})assert(cardDelay(THINKING,previous,0)==0);
 assert(cardDelay(IDLE,LISTENING,0)==0&&cardDelay(IDLE,HAPPY,0)==0);
 assert(cardDelay(HAPPY,THINKING,2000)==2000&&cardDelay(NOD,THINKING,900)==900&&cardDelay(LISTENING,THINKING,15000)==500);
 // Card lifetimes: the home status note (discovery card on the idle face) is short;
 // a revealed word (discovery on THINKING) and an answer on IDLE keep 30 s.
 using PrivetFaces::cardExpired;
 assert(!cardExpired(1,IDLE,9000,0,false,0));
 assert(!cardExpired(1,IDLE,4999,0,true,1000)&&cardExpired(1,IDLE,5000,0,true,1000));
 assert(!cardExpired(1,THINKING,29999,0,true,0)&&cardExpired(1,THINKING,30000,0,true,0));
 assert(!cardExpired(5,IDLE,29999,0,true,0)&&cardExpired(5,IDLE,30000,0,true,0));
 assert(!cardExpired(4,THINKING,2999,0,true,1000)&&cardExpired(4,THINKING,3000,0,true,1000));
 puts("servo motion checks passed");
 return 0;
}
