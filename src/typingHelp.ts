import {CYRILLIC} from './cyrillic.ts';

// Helps for typing steps with the letter buttons (agreed 2026-11-28, https://claude.ai/artifact/4nTzEtgWrSQFBU71V7YMoY):
// each button shows its sound, the answer shows one box per letter, and Lesson 1 gives the first letter.

// Short sounds for the buttons: the alphabet guide's (src/cyrillic.ts), shortened where it uses words. They follow
// the app's spelling everywhere else: у is "u" and х is "h" (as in "U-tram" and "hlep").
const SHORTER:Readonly<Record<string,string>>={е:'ye',й:'y',ё:'yo',ж:'zh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'hard',ь:'soft',ы:'y',э:'e',ю:'yu'};
export function letterSound(letter:string):string{
 const lower=letter.toLocaleLowerCase('ru');
 return SHORTER[lower]??CYRILLIC.find(item=>item.lower===lower)?.sound??'';
}

// The letters a typed answer needs, one box each (capitals and ending punctuation stay optional).
export const answerLetters=(answer:string)=>Array.from(answer.toLocaleLowerCase('ru').replace(/[^\p{L}\s-]/gu,'').trim());

// The letters already filled in for the learner (Lesson 1 gives the first one), or ''.
export const givenLetters=(answer:string,given=0)=>answerLetters(answer).slice(0,Math.max(0,given)).join('');

// What each box shows: the typed letter (the first one as a capital), or nothing yet.
export function boxes(answer:string,typed:string){
 const letters=answerLetters(answer),chars=Array.from(typed);
 return letters.map((_,i)=>{const char=chars[i]??'';return i===0?char.toLocaleUpperCase('ru'):char;});
}
