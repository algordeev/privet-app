#pragma once
#include <stdint.h>
#include <string.h>

namespace PrivetDisplay {
// SSD1306 full-buffer memory order: eight rows of sixteen 8-byte tiles.
// Keep one fixed shadow of the last submitted frame. Never blank the panel
// between frames; unchanged cards generate no I2C traffic at all.
class Refresh {
 uint8_t previous[1024]={};
 bool valid=false;
 public:
 template<class Send> void present(const uint8_t *frame,Send send){
  for(uint8_t row=0;row<8;row++){
   const uint16_t base=uint16_t(row)*128;
   uint8_t first=0,last=16;
   if(valid){
    while(first<16&&!memcmp(frame+base+first*8,previous+base+first*8,8))first++;
    if(first==16)continue;
    while(last>first&&!memcmp(frame+base+(last-1)*8,previous+base+(last-1)*8,8))last--;
   }
   // One bounded transfer per changed row, including any small interior gaps.
   send(first,row,uint8_t(last-first),frame+base+first*8);
   memcpy(previous+base+first*8,frame+base+first*8,(last-first)*8);
  }
  valid=true;
 }
};
}
