import type {LessonDefinition} from './lessons.ts';
import type {Exercise} from './lesson.ts';

export type LetterGroup='familiar'|'tricky'|'new'|'special';
export type CyrillicLetter={upper:string;lower:string;sound:string;example:string;meaning:string;group:LetterGroup;note?:string};
export const LETTER_GROUPS:Record<LetterGroup,string>={familiar:'Familiar letters',tricky:'Tricky look-alikes',new:'More useful letters',special:'Signs and special cases'};
const letter=(upper:string,sound:string,example:string,meaning:string,group:LetterGroup,note?:string):CyrillicLetter=>({upper,lower:upper.toLowerCase(),sound,example,meaning,group,note});
// Canonical Russian alphabet order, including Ё separately from Е. English
// spellings are deliberately rough sound guides, not exact phonetic notation.
export const CYRILLIC:readonly CyrillicLetter[]=[
 letter('А','a','Анна','Anna','familiar'),
 letter('Б','b','банк','bank','new'),
 letter('В','v','Ваш','your','tricky','Looks like B, sounds like v.'),
 letter('Г','g','город','city','new'),
 letter('Д','d','дом','home','new'),
 letter('Е','ye / e','еда','food','new','At a word’s start, as in еда, roughly ye. After a consonant, often indicates softness and sounds closer to e.'),
 letter('Ё','yo','ёж','hedgehog','special','The two dots matter: Ё is different from Е and is normally stressed. After a consonant, it can also indicate softness.'),
 letter('Ж','zh','журнал','magazine','new','Like the sound in “measure”.'),
 letter('З','z','зовут','called','new'),
 letter('И','ee','имя','name','new'),
 letter('Й','short y','йогурт','yogurt','new','A brief y sound, like the start of “yes”, not a full vowel.'),
 letter('К','k','кофе','coffee','familiar'),
 letter('Л','l','лимон','lemon','new'),
 letter('М','m','меня','me','familiar'),
 letter('Н','n','нет','no','tricky','Looks like H, sounds like n.'),
 letter('О','o','он','he','familiar','Unstressed о often sounds closer to a. These are rough guides.'),
 letter('П','p','привет','hi','new'),
 letter('Р','r','Россия','Russia','tricky','Looks like P; Russian r is usually tapped or rolled.'),
 letter('С','s','спасибо','thank you','tricky','Looks like C, sounds like s.'),
 letter('Т','t','ты','you, informal','familiar'),
 letter('У','oo','утро','morning','tricky','Looks like Y, sounds like oo in “food”.'),
 letter('Ф','f','фото','photo','new'),
 letter('Х','kh','хочу','I want','tricky','A breathy sound, like ch in Scottish “loch”.'),
 letter('Ц','ts','центр','centre','new','Like ts in “cats”.'),
 letter('Ч','ch','чай','tea','new'),
 letter('Ш','sh','школа','school','new'),
 letter('Щ','long soft sh','щётка','brush','new','Softer and longer than Ш; English has no exact equivalent.'),
 letter('Ъ','hard sign','подъезд','building entrance','special','No sound of its own. Separates a consonant from a following е, ё, ю or я. Normally not used at the start of ordinary Russian words.'),
 letter('Ы','rough ih','сыр','cheese','special','A vowel with no exact English equivalent. Normally not used at the start of ordinary Russian words.'),
 letter('Ь','soft sign','день','day','special','No sound of its own. Usually softens the preceding consonant. Normally not used at the start of ordinary Russian words.'),
 letter('Э','e','это','this','new','Like e in “met”, without an initial y.'),
 letter('Ю','yu','юг','south','new','After a consonant, can also indicate softness.'),
 letter('Я','ya','я','I','new','After a consonant, can also indicate softness.'),
];
export const QUICK_LETTERS=[['А','К','М','О','Т'],['В','Н','Р','С','У','Х'],['П','И','Е','Ф','Ч','Ш','Б','З','Й','Я','Ь']] as const;
export const READING_WORDS=[{text:'кофе',meaning:'coffee'},{text:'чай',meaning:'tea'},{text:'привет',meaning:'Hi!'},{text:'пока',meaning:'Bye!'}] as const;
const canonical=(text:string)=>text.toLowerCase().normalize('NFD').replace(/\u0301/g,'').normalize('NFC').replace(/[^а-яё]/g,'');
export function contextualLetters(definition:LessonDefinition,exercise:Exercise):CyrillicLetter[]{
 // Use the visible prompt/material, never the answer to assemble a solution.
 const material=exercise.kind==='vocabulary'?definition.words.map(w=>w.text).join(' '):[exercise.kind==='listen'?'':exercise.prompt,...exercise.choices??[],...exercise.tokens??[],...exercise.letters??[],exercise.exchange?.text??'',...(exercise.pairs??[]).map(([ru])=>ru)].join(' ');
 const letters=new Set(canonical(material));
 return CYRILLIC.filter(item=>letters.has(item.lower));
}
// Neutral whole-word alternatives cover every letter, including letters absent
// from safe lesson vocabulary. These are references, not additional lesson answers.
const NEUTRAL_EXAMPLES=[
 ['банк','bank'],['ваза','vase'],['гора','mountain'],['дом','home'],['река','river'],
 ['ёж','hedgehog'],['жук','beetle'],['зима','winter'],['мир','peace'],['музей','museum'],
 ['лампа','lamp'],['нос','nose'],['окно','window'],['парк','park'],['сыр','cheese'],
 ['торт','cake'],['утро','morning'],['фото','photo'],['хлеб','bread'],['центр','centre'],
 ['часы','clock'],['шар','ball'],['щётка','brush'],['подъезд','building entrance'],
 ['день','day'],['экран','screen'],['юбка','skirt'],['яблоко','apple'],
 ['автобус','bus'],['билет','ticket'],['ёлка','fir tree'],['игра','game'],['йод','iodine'],
 ['кот','cat'],['ель','spruce'],['фильм','film'],['объект','object'],['соль','salt'],['музыка','music'],['улица','street'],
 ['цветок','flower'],['щука','pike'],
].map(([example,meaning])=>({example,meaning}));
export function referenceExample(item:CyrillicLetter,definition?:LessonDefinition,exercise?:Exercise):CyrillicLetter{
 if(!definition||!exercise||exercise.kind==='vocabulary')return item;
 // English-only answers are not Russian comparison targets. Also avoid repeating
 // the Russian question word when its assessed answer is an English meaning.
 const forbidden=[exercise.answer,...exercise.alsoAccepted??[],exercise.prompt].filter(text=>/[а-яё]/iu.test(text)).map(canonical);
 const safe=(text:string)=>!forbidden.some(word=>word&&canonical(text).includes(word));
 if(safe(item.example))return item;
 const internal=['Ъ','Ы','Ь'].includes(item.upper);
 const alternative=[...definition.words.map(w=>({example:w.text,meaning:w.meaning})),...NEUTRAL_EXAMPLES,...CYRILLIC]
  .find(w=>(internal?canonical(w.example).includes(item.lower):canonical(w.example).startsWith(item.lower))&&safe(w.example));
 // Fail closed for impossible future cases (e.g. assessing a single letter):
 // keep the letter/sound visible, but never fall back to an unsafe example.
 return {...item,example:alternative?.example??'',meaning:alternative?.meaning??'Example omitted for this question.'};
}

// Split only for visual emphasis. Preserve the complete original string for
// accessible text and speech, including capitalization and any stress marks.
export function targetLetterParts(example:string,target:string){
 const characters=Array.from(new Intl.Segmenter('ru',{granularity:'grapheme'}).segment(example),part=>part.segment),index=characters.findIndex(character=>canonical(character)===canonical(target));
 return index<0?{before:example,target:'',after:''}:{before:characters.slice(0,index).join(''),target:characters[index],after:characters.slice(index+1).join('')};
}

// Device speech may read consonants as letter names, not isolated phonemes.
// Signs have no standalone sound; their example words remain playable.
export function letterAudioText(item:CyrillicLetter){
 return ['Ъ','Ь'].includes(item.upper)?null:item.lower;
}
