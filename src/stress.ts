import {nativeLessons} from './curriculum/catalog.ts';
import type {Word} from './curriculum/types.ts';

const bare=(token:string)=>token.replace(/[.!?]$/,'');
// Each canonical token of every word paired with its stressed display form.
export const stressPairs=(words:readonly Word[])=>words.flatMap(word=>{
 const canonical=word.text.split(' '),stressed=word.stressed.split(' ');
 return canonical.map((token,index)=>[bare(token),bare(stressed[index])] as const);
});
const lookup=(words:readonly Word[])=>new Map(stressPairs(words).map(([token,stressed])=>[token.toLowerCase(),stressed.toLowerCase()]));
const curriculumStress=lookup(nativeLessons.flatMap(lesson=>lesson.words));
const matchCase=(source:string,stressed:string)=>source.length>1&&source===source.toUpperCase()?stressed.toUpperCase()
 :source[0]===source[0].toUpperCase()?stressed[0].toUpperCase()+stressed.slice(1):stressed;
// Stresses every Russian word in any display string: current lesson first, then any lesson's vocabulary.
// Used for display and speech; answers and companion text keep the canonical spelling.
export function stressText(text:string,words:readonly Word[]=[]):string{
 const lesson=lookup(words);
 return text.replace(/[а-яё́]+/giu,token=>{
  if(token.includes('́'))return token;
  const key=token.toLowerCase(),stressed=lesson.get(key)??curriculumStress.get(key);
  return stressed?matchCase(token,stressed):token;
 });
}
