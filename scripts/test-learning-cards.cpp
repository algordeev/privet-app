#include <assert.h>
#include <string.h>
#include <stdio.h>
#include <iostream>
#include <string>
#include "LearningCards.h"
#include "FacePresentation.h"
#include "ServoMotion.h"
#include "LearningLayout.h"
#include "DisplayRefresh.h"
using namespace PrivetCards;
static void put32(uint8_t *p,uint32_t v){for(int i=0;i<4;i++)p[i]=uint8_t(v>>(i*8));}
struct Transaction {
 uint8_t begin[20]={2,0x10},data[20]={2,0x11},commit[8]={2,0x12};size_t length;
 Transaction(uint32_t id,const char *text="чай",uint32_t nonce=77,uint32_t face=9){
  length=strlen(text);put32(begin+2,id);put32(data+2,id);put32(commit+2,id);put32(begin+6,nonce);put32(begin+10,face);
  begin[14]=2;begin[15]=length;begin[17]=1;const auto crc=crc16((const uint8_t*)text,length);begin[18]=uint8_t(crc);begin[19]=uint8_t(crc>>8);
  data[7]=length;memcpy(data+8,text,length);
 }
 void start(Receiver &r,uint32_t time=0){assert(!r.receive(begin,20,time,true).send);}
 void body(Receiver &r,uint32_t time=1){assert(!r.receive(data,length+8,time,true).send);}
 Reply finish(Receiver &r,uint32_t time=2){return r.receive(commit,8,time,true);}
};
int main(){
 // Submit a complete initial frame, then only changed spans, including erasure.
 PrivetDisplay::Refresh refresh;uint8_t pixels[1024]={},panel[1024]={};int calls=0,bytes=0;
 const auto send=[&](uint8_t x,uint8_t row,uint8_t width,const uint8_t *data){
  assert(x<16&&row<8&&width>0&&x+width<=16);calls++;bytes+=width*8;
  memcpy(panel+row*128+x*8,data,width*8);
 };
 refresh.present(pixels,send);assert(calls==8&&bytes==1024);
 calls=bytes=0;refresh.present(pixels,send);assert(calls==0&&bytes==0);
 pixels[3*128+5*8+2]=255;refresh.present(pixels,send);assert(calls==1&&bytes==8&&!memcmp(panel,pixels,1024));
 calls=bytes=0;pixels[3*128+5*8+2]=0;refresh.present(pixels,send);assert(calls==1&&bytes==8&&!memcmp(panel,pixels,1024));
 calls=bytes=0;pixels[0]=1;pixels[127]=2;refresh.present(pixels,send);assert(calls==1&&bytes==128&&!memcmp(panel,pixels,1024));
 calls=bytes=0;memset(pixels,0xa5,sizeof(pixels));refresh.present(pixels,send);assert(calls==8&&bytes==1024&&!memcmp(panel,pixels,1024));
 calls=bytes=0;refresh.present(pixels,send);assert(calls==0&&bytes==0);

 for(int index=0;index<1024;index++){
  calls=bytes=0;pixels[index]^=1;refresh.present(pixels,send);
  assert(calls==1&&bytes==8&&!memcmp(panel,pixels,1024));
 }
 // Layout is bounded at word boundaries and preserves Cyrillic scalars.
 const auto six=[](const char *text){int count=0;for(size_t i=0;text[i];i+=PrivetLayout::scalarBytes(text+i))count++;return count*6;};
 const auto walk=PrivetLayout::wrap("Let's go for a walk!",six);assert(walk.complete);assert(!strcmp(walk.text[0],"Let's go for a walk!"));
 const auto longMeaning=PrivetLayout::wrap("In the morning I drink coffee.",six);assert(longMeaning.complete&&longMeaning.count==2);
 const auto future=PrivetLayout::wrap("one two three four five six seven eight nine ten eleven twelve",six);assert(!future.complete);assert(strstr(future.text[1],"..."));
 // Node supplies every current curriculum/guide card; reject any content that
 // would need ellipsis even with the compact two-by-two layout.
 std::string line;while(std::getline(std::cin,line)){
  const auto separator=line.find('\t');assert(separator!=std::string::npos);
  for(const auto &text: {line.substr(0,separator),line.substr(separator+1)}){
   const auto layout=PrivetLayout::wrap(text.c_str(),six);
   if(!layout.complete){std::cerr<<"OLED overflow: "<<text<<"\n";return 1;}
   for(int i=0;i<layout.count;i++){assert(six(layout.text[i])<=120);assert(PrivetCards::utf8((const uint8_t*)layout.text[i],strlen(layout.text[i])));}
  }
 }
 // Hint cue duration starts when it is actually displayed, not on receipt.
 assert(!PrivetFaces::cardExpired(4,5000,0,false,0));
 assert(!PrivetFaces::cardExpired(4,6999,0,true,5000));
 assert(PrivetFaces::cardExpired(4,7000,0,true,5000));
 assert(PrivetFaces::cardExpired(4,1500,0,true,0xfffffe0cU)); // millis wrap
 for(int mode=1;mode<=5;mode++){
  if(mode==4)continue;
  assert(!PrivetFaces::cardExpired(mode,29999,0,true,100));
  assert(PrivetFaces::cardExpired(mode,30000,0,true,100));
 }
 // Fresh BLE link stays visually asleep until the subscribed app's reaction.
 PrivetFaces::WakeTransition wake;assert(!wake.awake(false));assert(!wake.awake(true));
 wake.acceptReaction();assert(wake.awake(true));assert(!wake.awake(false));
 wake.reset();assert(!wake.awake(true));wake.acceptReaction();assert(wake.awake(true));
 // Every opening-eye frame must have nonnegative unsigned U8g2 interiors.
 for(int age=0;age<500;age++){
  int height=3+age*20/500,radius=PrivetFaces::roundedRadius(20,height,5);
  assert(radius>=0&&2*radius<height&&2*radius<20);
 }
 assert(PrivetFaces::roundedRadius(20,23,6)==6);
 assert(PrivetFaces::roundedRadius(20,3,1)==1);
 assert(PrivetFaces::roundedRadius(0,3,5)==0);

 // Every gesture is continuous, clamped, finishes centered, and can be
 // interrupted from any last commanded position without jumping to neutral.
 for(int reaction=1;reaction<=9;reaction++)for(int from=1300;from<=1700;from+=25){
  int previous=PrivetMotion::target(reaction,0,from);assert(previous==from);
  for(int age=1;age<=5000;age++){
   int pulse=PrivetMotion::target(reaction,age,from);assert(pulse>=1300&&pulse<=1700);assert(pulse-previous<=2&&previous-pulse<=2);previous=pulse;
  }
  assert(previous==1500);
 }
 assert(PrivetMotion::target(7,450,1500)==1600);
 assert(PrivetMotion::target(7,700,1500)==1600);
 assert(PrivetMotion::target(7,1400,1500)==1500);
 for(int quiet=4;quiet<=6;quiet++)assert(PrivetMotion::target(quiet,300,1500)==1500);
 Receiver r;r.connection(77);r.face(9);Transaction t(11);t.start(r);assert(!r.completed.mode);t.body(r);assert(!r.completed.mode);
 auto a=t.finish(r);assert(a.send&&a.bytes[6]==0&&a.bytes[7]==2);assert(!strcmp(r.completed.primary,"чай"));auto revision=r.completed.revision;
 assert(t.finish(r).bytes[6]==0&&r.completed.revision==revision); // duplicate commit never republishes
 r.face(12);assert(!r.completed.mode);assert(t.finish(r).bytes[6]==0&&!r.completed.mode); // no stale rendering
 Transaction stale(10);assert(r.receive(stale.begin,20,3,true).bytes[6]==8);
 Transaction wrongNonce(13,"чай",78,12);assert(r.receive(wrongNonce.begin,20,3,true).bytes[6]==8);
 Transaction wrongFace(14,"чай",77,9);assert(r.receive(wrongFace.begin,20,3,true).bytes[6]==8);
 Transaction expired(15,"чай",77,12);expired.start(r,100);assert(r.expire(5100).bytes[6]==7);
 Transaction absolute(16,"чай",77,12);absolute.start(r,6000);absolute.body(r,10999);assert(r.expire(11000).bytes[6]==7);
 Transaction incomplete(17,"чай",77,12);incomplete.start(r);assert(incomplete.finish(r).bytes[6]==7);
 Transaction corrupt(18,"чай",77,12);corrupt.start(r);corrupt.data[8]='x';assert(r.receive(corrupt.data,corrupt.length+8,1,true).bytes[6]==4);
 Transaction crc(19,"чай",77,12);crc.begin[18]^=1;crc.start(r);crc.body(r);assert(crc.finish(r).bytes[6]==6);
 Transaction order(20,"чай",77,12);order.start(r);order.data[6]=1;assert(r.receive(order.data,order.length+8,1,true).bytes[6]==3);
 Transaction duplicate(21,"чай",77,12);duplicate.start(r);duplicate.body(r);duplicate.body(r);duplicate.data[9]^=1;assert(r.receive(duplicate.data,duplicate.length+8,1,true).bytes[6]==3);
 Transaction newer(22,"чай",77,12);newer.start(r);Transaction latest(23,"нет",77,12);latest.start(r);assert(newer.finish(r).bytes[6]==8);latest.body(r);assert(latest.finish(r).bytes[6]==0);
 Transaction length(24,"чай",77,12);length.begin[15]=65;assert(r.receive(length.begin,20,0,true).bytes[6]==5);
 Transaction fragments(25,"чай",77,12);fragments.begin[17]=12;assert(r.receive(fragments.begin,20,0,true).bytes[6]==5);
 Transaction unavailable(26,"чай",77,12);assert(r.receive(unavailable.begin,20,0,false).bytes[6]==9);
 Transaction split(27,"чай",77,12);split.start(r);split.data[7]=1;assert(r.receive(split.data,9,1,true).bytes[6]==4);
 Transaction reconnect(28,"чай",77,12);reconnect.start(r);r.connection(78);r.face(9);assert(reconnect.finish(r).bytes[6]==8);
 Transaction oversized(29,"чай",78,9);uint8_t tooLong[21]={};memcpy(tooLong,oversized.begin,20);assert(r.receive(tooLong,21,0,true).bytes[6]==2);
 // Maximum complete body, eight ordered 12-byte fragments, no partial publish.
 uint8_t full[96],begin[20]={2,0x10},data[20]={2,0x11},commit[8]={2,0x12};memset(full,'a',64);memset(full+64,'b',32);
 put32(begin+2,30);put32(begin+6,78);put32(begin+10,9);begin[14]=1;begin[15]=64;begin[16]=32;begin[17]=8;auto checksum=crc16(full,96);begin[18]=uint8_t(checksum);begin[19]=uint8_t(checksum>>8);
 assert(!r.receive(begin,20,0,true).send);revision=r.completed.revision;
 for(int i=0;i<8;i++){put32(data+2,30);data[6]=i;data[7]=12;memcpy(data+8,full+i*12,12);assert(!r.receive(data,20,i+1,true).send);assert(r.completed.revision==revision);}
 put32(commit+2,30);assert(r.receive(commit,8,10,true).bytes[6]==0);assert(strlen(r.completed.primary)==64&&strlen(r.completed.secondary)==32);
 // Valid fragment UTF-8 cannot cross the primary/secondary field boundary.
 Transaction boundary(31,"я",78,9);boundary.begin[15]=1;boundary.begin[16]=1;boundary.start(r);boundary.body(r);assert(boundary.finish(r).bytes[6]==4);
 Transaction invalidMode(32,"чай",78,9);invalidMode.begin[14]=6;assert(r.receive(invalidMode.begin,20,0,true).bytes[6]==2);
 const uint8_t invalids[][4]={{0xc0,0x80},{0xed,0xa0,0x80},{0xf4,0x90,0x80,0x80},{0,0},{0xd0,0}};
 for(const auto &v:invalids)assert(!utf8(v,2));
 // Expiry emits once, keeps the accepted card, and permits a later transaction.
 Receiver expiry;expiry.connection(77);expiry.face(9);
 Transaction accepted(40);accepted.start(expiry);accepted.body(expiry);assert(accepted.finish(expiry).bytes[6]==0);
 const Card saved=expiry.completed;
 Transaction partial(41,"нет");partial.start(expiry,100);
 assert(!expiry.expire(5099).send);
 assert(!partial.finish(expiry,5100).send); // no late commit publication before loop
 const auto timeout=expiry.expire(5100);assert(timeout.send&&timeout.bytes[6]==7&&timeout.bytes[7]==2&&u32(timeout.bytes+2)==41);
 assert(!expiry.expire(5101).send&&!expiry.expire(10000).send);
 assert(!memcmp(&saved,&expiry.completed,sizeof(Card)));
 assert(!expiry.receive(partial.data,partial.length+8,5101,true).send);
 assert(partial.finish(expiry,5102).bytes[6]==7);
 Transaction after(42,"нет");after.start(expiry,5200);after.body(expiry,5201);assert(after.finish(expiry,5202).bytes[6]==0);
 assert(!strcmp(expiry.completed.primary,"нет"));
 puts("Fixed-buffer receiver: atomic publish, nonce/face/stale checks, duplicates, UTF-8, CRC, bounds, and absolute expiry passed.");
}
