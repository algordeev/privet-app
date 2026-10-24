#pragma once
#include <stdint.h>
namespace PrivetMotion {
static constexpr int CENTER=1500,MINIMUM=1300,MAXIMUM=1700;
inline int clampPulse(int pulse){return pulse<MINIMUM?MINIMUM:pulse>MAXIMUM?MAXIMUM:pulse;}
// Cubic ease-in/out, fixed-point and bounded: no abrupt target reversal and no
// floating point or allocation. Start each new gesture at the last actual pulse.
inline int ease(int from,int to,uint32_t age,uint32_t duration){
 if(age>=duration)return to;
 int64_t t=int64_t(age)*1000/duration;
 int64_t weight=t*t*(3000-2*t)/1000000;
 return clampPulse(from+int((int64_t(to-from)*weight)/1000));
}
inline int target(uint8_t reaction,uint32_t age,int from){
 from=clampPulse(from);
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
}
