#pragma once
#include <atomic>
#include <stdint.h>
namespace PrivetFaces {
// face: the face the card is shown with (4 IDLE).
inline bool cardExpired(uint8_t mode,uint8_t face,uint32_t now,uint32_t receivedAt,bool visible,uint32_t shownAt){
 // Give the short hint cue two seconds of actual display time.
 if(mode==4)return visible&&uint32_t(now-shownAt)>=2000U;
 // A discovery card on the idle face is a passing status note ("3 to review"
 // at home): four seconds, then the idle face. Revealed words come with THINKING.
 if(mode==1&&face==4)return visible&&uint32_t(now-shownAt)>=4000U;
 // Other cards retain their 30-second lifetime from receipt.
 return uint32_t(now-receivedAt)>=30000U;
}

// How long a face plays before the card sent with it is drawn. Codes: 4 IDLE,
// 5 LISTENING, 6 THINKING, 7 HINT, 11 NOD. A new question shows the thinking
// face first; returning to the same question (after listening, a hint, a pair
// nod, or another THINKING such as a revealed word) shows its card at once, so
// nothing flashes. Reactions show their face for their whole duration.
inline uint32_t cardDelay(uint8_t face,uint8_t previous,uint32_t reactionMs){
 if(face==6)return previous==6||previous==5||previous==7||previous==11?0:700;
 if(face==5)return 500;
 return reactionMs;
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
