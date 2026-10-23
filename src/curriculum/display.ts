import type {Word} from './types.ts';
const bare=(text:string)=>text.normalize('NFD').replace(/\u0301/g,'').normalize('NFC').replace(/[.,!?…]+$/u,'').toLowerCase();
// Presentation only: keep the actual token, punctuation and TTS/answer text intact.
export function stressedToken(text:string,words:readonly Word[]):string{
 for(const word of words){
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
