#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>
// Portable, allocation-free protocol receiver. Caller serializes access with a
// short critical section. No display, servo, BLE or Arduino calls here.
namespace PrivetCards {
static constexpr uint8_t MAX_PRIMARY=64, MAX_SECONDARY=32, MAX_BODY=96, MAX_FRAGMENTS=(MAX_BODY+(12-3)-1)/(12-3);
inline uint32_t u32(const uint8_t *p){return uint32_t(p[0])|(uint32_t(p[1])<<8)|(uint32_t(p[2])<<16)|(uint32_t(p[3])<<24);}
inline uint16_t crc16(const uint8_t *p,size_t n){uint16_t c=0xffff;for(size_t i=0;i<n;i++){c^=uint16_t(p[i])<<8;for(int j=0;j<8;j++)c=(c&0x8000)?uint16_t((c<<1)^0x1021):uint16_t(c<<1);}return c;}
// Valid Unicode scalars in the actual renderer repertoire: printable ASCII and
// Russian Cyrillic including Ё/ё. Each DATA fragment must end on a scalar.
inline bool utf8(const uint8_t *p,size_t n){for(size_t i=0;i<n;){uint8_t a=p[i++];if(a>=32&&a<=126)continue;if(a!=0xd0&&a!=0xd1)return false;if(i>=n)return false;uint8_t b=p[i++];if(b<0x80||b>0xbf)return false;uint16_t cp=((a&31)<<6)|(b&63);if(!(cp>=0x410&&cp<=0x44f)&&cp!=0x401&&cp!=0x451)return false;}return true;}
struct Card {uint32_t revision=0,face=0;uint8_t mode=0;char primary[65]={},secondary[33]={};};
struct Reply {uint8_t bytes[8]={};bool send=false;};
class Receiver {
 uint32_t nonce=0,faceId=0,highest=0,transaction=0,started=0,terminal=0,lastRejected=0;
 uint8_t begin[20]={},body[96]={},offset[MAX_FRAGMENTS]={},sizes[MAX_FRAGMENTS]={},used=0,next=0,mode=0;
 uint8_t terminalMode=0,terminalResult=0;
 bool staging=false;
 Reply ack(uint32_t id,uint8_t result,uint8_t m){Reply r;r.send=true;r.bytes[0]=2;r.bytes[1]=0x90;for(int i=0;i<4;i++)r.bytes[i+2]=uint8_t(id>>(8*i));r.bytes[6]=result;r.bytes[7]=m;return r;}
 Reply finish(uint8_t result){staging=false;terminal=transaction;terminalMode=mode;terminalResult=result;return ack(terminal,result,mode);}
 public:
 Card completed;
 void connection(uint32_t value){nonce=value;faceId=highest=transaction=terminal=lastRejected=0;staging=false;clear();}
 void clear(){completed.mode=0;completed.revision++;}
 void face(uint32_t id){faceId=id;staging=false;clear();}
 void expire(uint32_t now){if(staging&&uint32_t(now-started)>=5000)finish(7);}
 Reply receive(const uint8_t *p,size_t n,uint32_t now,bool oled){
  if(n<6||p[0]!=2)return {};
  uint32_t id=u32(p+2);if(!id)return {};
  expire(now);
  if(id==terminal){if(p[1]==0x12&&n==8&&!p[6]&&!p[7])return ack(id,terminalResult,terminalMode);return {};}
  if(p[1]==0x10){
   if(staging&&id==transaction){if(n==20&&!memcmp(p,begin,20))return {};return finish(3);}
   if(id<=highest){if(lastRejected==id)return {};lastRejected=id;return ack(id,8,0);}
   highest=id;transaction=id;mode=n==20&&p[14]>=1&&p[14]<=5?p[14]:0;staging=false;
   if(n!=20||mode<1||mode>5)return finish(2);
   if(!oled)return finish(9);
   if(u32(p+6)!=nonce||!nonce||u32(p+10)!=faceId||!faceId)return finish(8);
   if(!p[15]||p[15]>64||p[16]>32||int(p[15])+p[16]>96||!p[17]||p[17]>MAX_FRAGMENTS)return finish(5);
   memcpy(begin,p,20);used=next=0;memset(sizes,0,sizeof(sizes));started=now;staging=true;return {};
  }
  if(!staging||id!=transaction){if(lastRejected==id)return {};lastRejected=id;return ack(id,8,0);}
  if(p[1]==0x11){
   if(n<9||n>20||p[7]<1||p[7]>12||n!=size_t(8+p[7]))return finish(2);
   uint8_t index=p[6],size=p[7];if(index>=begin[17])return finish(3);
   if(index<next){if(sizes[index]==size&&!memcmp(body+offset[index],p+8,size))return {};return finish(3);}
   if(index!=next)return finish(3);
   if(int(used)+size>int(begin[15])+begin[16])return finish(5);
   if(!utf8(p+8,size))return finish(4);
   offset[index]=used;sizes[index]=size;memcpy(body+used,p+8,size);used+=size;next++;return {};
  }
  if(p[1]==0x12){
   if(n!=8||p[6]||p[7])return finish(2);
   if(next!=begin[17]||used!=begin[15]+begin[16])return finish(7);
   if(u32(begin+6)!=nonce||u32(begin+10)!=faceId)return finish(8);
   if(!utf8(body,begin[15])||!utf8(body+begin[15],begin[16]))return finish(4);
   if(crc16(body,used)!=(uint16_t(begin[18])|(uint16_t(begin[19])<<8)))return finish(6);
   Card card;card.revision=completed.revision+1;card.face=faceId;card.mode=mode;
   memcpy(card.primary,body,begin[15]);memcpy(card.secondary,body+begin[15],begin[16]);completed=card;
   return finish(0);
  }
  return finish(1);
 }
};
}
