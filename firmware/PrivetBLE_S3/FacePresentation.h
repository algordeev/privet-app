#pragma once
#include <atomic>
#include <stdint.h>
namespace PrivetFaces {
inline bool cardExpired(uint8_t mode,uint32_t now,uint32_t receivedAt,bool visible,uint32_t shownAt){
 // Give the short hint cue two seconds of actual display time. Other cards
 // retain their existing 30-second lifetime from receipt.
 return mode==4 ? visible&&uint32_t(now-shownAt)>=2000U : uint32_t(now-receivedAt)>=30000U;
}

// U8g2 does not clamp rounded-box radii like Adafruit GFX does. A radius
// larger than half the dimensions underflows its unsigned interior sizes.
inline int roundedRadius(int width,int height,int radius){
 const int shortest=width<height?width:height;
 if(shortest<=1||radius<=0)return 0;
 const int maximum=(shortest-1)/2;
 return radius<maximum?radius:maximum;
}
// BLE link creation is not a visual wake-up. Only an accepted app reaction
// releases the sleeping face; no local CONNECTED animation is synthesized.
class WakeTransition {
 std::atomic<bool> waiting{true};
 public:
 void reset(){waiting.store(true);}
 void acceptReaction(){waiting.store(false);}
 bool awake(bool linked)const{return linked&&!waiting.load();}
};
}
