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
 letter('Б','b','Спасибо!','Thank you!','new'),
 letter('В','v','Привет!','Hi!','tricky','Looks like B, sounds like v.'),
 letter('Г','g','год','year','new'),
 letter('Д','d','дом','home','new'),
 letter('Е','ye / e','кофе','coffee','new','Often ye at a word’s start; after a consonant, usually softens it and sounds closer to e.'),
 letter('Ё','yo','ёж','hedgehog','special','The two dots matter: Ё is different from Е and is normally stressed.'),
 letter('Ж','zh','журнал','magazine','new','Like the sound in “measure”.'),
 letter('З','z','Меня зовут Анна.','My name is Anna.','new'),
 letter('И','ee','Привет!','Hi!','new'),
 letter('Й','short y','чай','tea','new','A brief y sound, like the start of “yes”, not a full vowel.'),
 letter('К','k','кофе','coffee','familiar'),
 letter('Л','l','Алекс','Alex','new'),
 letter('М','m','Меня зовут Анна.','My name is Anna.','familiar'),
 letter('Н','n','Анна','Anna','tricky','Looks like H, sounds like n.'),
 letter('О','o','кофе','coffee','familiar','Unstressed о often sounds closer to a. These are rough guides.'),
 letter('П','p','Пока!','Bye!','new'),
 letter('Р','r','Привет!','Hi!','tricky','Looks like P; Russian r is usually tapped or rolled.'),
 letter('С','s','Спасибо!','Thank you!','tricky','Looks like C, sounds like s.'),
 letter('Т','t','Как тебя зовут?','What’s your name?','familiar'),
 letter('У','oo','Я хочу чай.','I want tea.','tricky','Looks like Y, sounds like oo in “food”.'),
 letter('Ф','f','кофе','coffee','new'),
 letter('Х','kh','Я хочу чай.','I want tea.','tricky','A breathy sound, like ch in Scottish “loch”.'),
 letter('Ц','ts','центр','centre','new','Like ts in “cats”.'),
 letter('Ч','ch','чай','tea','new'),
 letter('Ш','sh','Ваш чай.','Your tea.','new'),
 letter('Щ','long soft sh','щётка','brush','new','Softer and longer than Ш; English has no exact equivalent.'),
 letter('Ъ','hard sign','подъезд','building entrance','special','No sound of its own. Separates a consonant from a following е, ё, ю or я.'),
 letter('Ы','rough ih','сыр','cheese','special','A vowel with no exact English equivalent. Listen to the example when available.'),
 letter('Ь','soft sign','Очень приятно!','Nice to meet you!','special','No sound of its own. Usually softens the preceding consonant.'),
 letter('Э','e','это','this','new','Like e in “met”, without an initial y.'),
 letter('Ю','yu','юг','south','new'),
 letter('Я','ya','Я хочу чай.','I want tea.','new'),
];
export const QUICK_LETTERS=[['А','К','М','О','Т'],['В','Н','Р','С','У','Х'],['П','И','Е','Ф','Ч','Ш','Б','З','Й','Я','Ь']] as const;
export const READING_WORDS=[{text:'кофе',meaning:'coffee'},{text:'чай',meaning:'tea'},{text:'привет',meaning:'Hi!'},{text:'пока',meaning:'Bye!'}] as const;
const canonical=(text:string)=>text.toLowerCase().normalize('NFD').replace(/\u0301/g,'').normalize('NFC').replace(/[^а-яё]/g,'');
export function contextualLetters(definition:LessonDefinition,exercise:Exercise):CyrillicLetter[]{
 // Use the visible prompt/material, never the answer to assemble a solution.
 const material=exercise.kind==='vocabulary'?definition.words.map(w=>w.text).join(' '):[exercise.prompt,...exercise.choices??[],...exercise.tokens??[],...exercise.letters??[],exercise.exchange?.text??''].join(' ');
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
].map(([example,meaning])=>({example,meaning}));
export function referenceExample(item:CyrillicLetter,definition?:LessonDefinition,exercise?:Exercise):CyrillicLetter{
 if(!definition||!exercise||exercise.kind==='vocabulary')return item;
 // English-only answers are not Russian comparison targets. Also avoid repeating
 // the Russian question word when its assessed answer is an English meaning.
 const forbidden=[exercise.answer,exercise.prompt].filter(text=>/[а-яё]/iu.test(text)).map(canonical);
 const safe=(text:string)=>!forbidden.some(word=>word&&canonical(text).includes(word));
 if(safe(item.example))return item;
 const alternative=[...definition.words.map(w=>({example:w.text,meaning:w.meaning})),...NEUTRAL_EXAMPLES,...CYRILLIC]
  .find(w=>canonical(w.example).includes(item.lower)&&safe(w.example));
 // Fail closed for impossible future cases (e.g. assessing a single letter):
 // keep the letter/sound visible, but never fall back to an unsafe example.
 return {...item,example:alternative?.example??'',meaning:alternative?.meaning??'Example omitted for this question.'};
}
