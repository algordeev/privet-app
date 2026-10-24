// Host QA against the installed U8g2 fonts, not estimated character widths.
#include <u8g2.h>
#include "LearningLayout.h"
#include <iostream>
#include <string>
#include <assert.h>
int main(){
 u8g2_t screen={};size_t count=0;std::string line;
 const auto measure=[&](const char *s){return u8g2_GetUTF8Width(&screen,s);};
 while(std::getline(std::cin,line)){
  auto split=line.find('\t');assert(split!=std::string::npos);
  auto a=line.substr(0,split),b=line.substr(split+1);
  u8g2_SetFont(&screen,u8g2_font_6x13_t_cyrillic);auto secondary=PrivetLayout::wrap(b.c_str(),measure);
  u8g2_SetFont(&screen,u8g2_font_9x15_t_cyrillic);auto primary=PrivetLayout::wrap(a.c_str(),measure);
  bool compact=!primary.complete||(primary.count==2&&secondary.count==2);
  if(compact){u8g2_SetFont(&screen,u8g2_font_6x13_t_cyrillic);primary=PrivetLayout::wrap(a.c_str(),measure);}
  if(!primary.complete||!secondary.complete){std::cerr<<"Overflow: "<<a<<" / "<<b<<"\n";return 1;}
  const PrivetLayout::Frame frame(primary.count,secondary.count,compact);int lastBottom=4;
  assert(frame.height<=59);
  auto check=[&](const PrivetLayout::Lines &lines,int baseline,int spacing){
   u8g2_SetFontRefHeightAll(&screen);
   for(int i=0;i<lines.count;i++){
    int y=baseline+i*spacing,asc=u8g2_GetAscent(&screen),desc=u8g2_GetDescent(&screen);
    if(measure(lines.text[i])>120||y-asc<=lastBottom||y-desc>=64){std::cerr<<"Bounds: "<<lines.text[i]<<" y="<<y<<" ascent="<<asc<<" descent="<<desc<<" prior bottom="<<lastBottom<<"\n";exit(1);}lastBottom=y-desc;
    for(const unsigned char *p=(const unsigned char*)lines.text[i];*p;){
     uint16_t cp=*p++;if(cp>=128){cp=((cp&31)<<6)|(*p++&63);}
     if(u8g2_GetGlyphWidth(&screen,cp)<=0){std::cerr<<"Missing glyph: "<<cp<<"\n";exit(1);}
    }
   }
  };
  check(primary,frame.primaryBaseline(0),frame.primaryStep);
  u8g2_SetFont(&screen,u8g2_font_6x13_t_cyrillic);check(secondary,frame.secondaryBaseline(0),frame.secondaryStep);
  count++;
 }
 std::cout<<"PASS: "<<count<<" distinct current cards fit actual U8g2 fonts without truncation, overlap or off-screen lines.\n";
}
