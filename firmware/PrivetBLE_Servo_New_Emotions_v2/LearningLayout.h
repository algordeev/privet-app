#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>
namespace PrivetLayout {
struct Frame {
 int primaryStep,secondaryStep,gap,height,top,primaryLines;
 Frame(int primary,int secondary,bool compact):primaryStep(compact?14:16),secondaryStep(14),gap(secondary?2:0),height(primary*primaryStep+gap+secondary*secondaryStep),top(5+(59-height)/2),primaryLines(primary){}
 int primaryBaseline(int line)const{return top+primaryStep-3+line*primaryStep;}
 int secondaryBaseline(int line)const{return top+primaryLines*primaryStep+gap+11+line*secondaryStep;}
};
struct Lines {char text[2][65]={};uint8_t count=0;bool complete=true;};
inline size_t scalarBytes(const char *p){return uint8_t(*p)<128?1:2;}
// Bounded word wrapping shared with host regressions. The receiver permits
// ASCII/Russian scalars only. No allocations, broken words, or partial UTF-8.
template<class Measure> Lines wrap(const char *text,Measure width){
 Lines result;size_t pos=0;
 for(uint8_t line=0;line<2;line++){
  while(text[pos]==' ')pos++;
  if(!text[pos])break;
  size_t start=pos,end=pos,lastSpace=pos;
  char candidate[65]={};
  while(text[end]){
   size_t next=end+scalarBytes(text+end),length=next-start;
   memcpy(candidate,text+start,length);candidate[length]=0;
   if(width(candidate)>120)break;
   if(text[end]==' ')lastSpace=end;
   end=next;
  }
  if(text[end]&&text[end]!=' '&&lastSpace>start)end=lastSpace;
  size_t length=end-start;memcpy(result.text[line],text+start,length);result.text[line][length]=0;
  while(length&&result.text[line][length-1]==' ')result.text[line][--length]=0;
  result.count++;pos=end;
 }
 while(text[pos]==' ')pos++;
 if(text[pos]){
  result.complete=false;
  // Future oversized content gets whole-word ellipsis, never "wa...".
  char *last=result.text[result.count?result.count-1:0];size_t length=strlen(last);
  for(;;){char candidate[69];memcpy(candidate,last,length);strcpy(candidate+length,"...");if(width(candidate)<=120){strcpy(last,candidate);break;}
   while(length&&last[length-1]!=' ')length--;
   while(length&&last[length-1]==' ')length--;
  }
 }
 return result;
}
}
