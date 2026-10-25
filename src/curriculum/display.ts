import {nativeLessons} from './catalog.ts';
import type {Word} from './types.ts';
const bare=(text:string)=>text.normalize('NFD').replace(/\u0301/g,'').normalize('NFC').replace(/[.,!?…]+$/u,'').toLowerCase();
// A token taught in a different lesson (e.g. "завтра" in making-plans) still
// needs its stress mark when a later lesson's sentence reuses it without
// re-teaching it as its own Word there (adding it would also add an unwanted
// vocabulary card). The current lesson's own words are always searched
// first and win on a match, exactly as before; this is only a fallback.
const allWords=nativeLessons.flatMap(lesson=>lesson.words);
// Presentation only: keep the actual token, punctuation and TTS/answer text intact.
export function stressedToken(text:string,words:readonly Word[]):string{
 for(const word of [...words,...allWords]){
  const canonical=word.text.split(' '),stressed=word.stressed.split(' ');
  const index=canonical.findIndex(token=>bare(token)===bare(text));
  if(index<0)continue;
  let result=stressed[index].replace(/[.,!?…]+$/u,'');
  if(/^[А-ЯЁ]/u.test(text))result=result[0].toUpperCase()+result.slice(1);
  else result=result[0].toLowerCase()+result.slice(1);
  return result+(text.match(/[.,!?…]+$/u)?.[0]??'');
 }
 return text;
}
