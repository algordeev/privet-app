import {nativeLessons} from './curriculum/catalog.ts';
import type {Word} from './curriculum/types.ts';

// Reading aids, not IPA or letter-by-letter transliteration. Keep reviewed
// whole-word sounds (including vowel reduction) and existing lesson guides.
const key=(text:string)=>text.normalize('NFD').replace(/\u0301/g,'').normalize('NFC').toLowerCase().replace(/[^а-яё]+/gu,' ').trim();
const examples:Readonly<Record<string,string>>={
 'анна':'AN-na','банк':'bank','ваш':'vash','город':'GO-rat','дом':'dom',
 'еда':'yee-DA','ёж':'yosh','журнал':'zhoor-NAL','зовут':'za-VOOT','имя':'EE-mya',
 'йогурт':'YO-goort','кофе':'KO-fyeh','лимон':'lee-MON','меня':'mee-NYA','нет':'nyet',
 'он':'on','привет':'pree-VYET','россия':'ra-SEE-ya','спасибо':'spa-SEE-ba','ты':'ty',
 'утро':'OO-tra','фото':'FO-ta','хочу':'kha-CHOO','центр':'tsentr','чай':'chai',
 'школа':'SHKO-la','щётка':'SHCHYOT-ka','подъезд':'pad-YEST','сыр':'syr','день':'dyen',
 'это':'EH-ta','юг':'yook','я':'ya','пока':'pa-KA',
 // Neutral answer-safe reference alternatives need their own reading too.
 'ваза':'VA-za','гора':'ga-RA','река':'ree-KA','жук':'zhook','зима':'zee-MA',
 'мир':'meer','музей':'mu-ZYEY','лампа':'LAM-pa','нос':'nos','окно':'ak-NO',
 'парк':'park','торт':'tort','хлеб':'khlyep','часы':'cha-SY','шар':'shar',
 'экран':'ek-RAN','юбка':'YOOP-ka','яблоко':'YA-bla-ka','автобус':'af-TO-boos',
 'билет':'bee-LYET','ёлка':'YOL-ka','игра':'eeg-RA','йод':'yot','кот':'kot',
 'ель':'yel','фильм':'feelm','объект':'ab-YEKT','соль':'sol','музыка':'MOO-zy-ka',
 'улица':'OO-lee-tsa','цветок':'tsvee-TOK','щука':'SHCHOO-ka',
 // Visible dialogue lines/review choices that are not standalone Word entries.
 'ваш чай':'vash chai','ваш кофе':'vash KO-fyeh',
 'меня зовут алекс':'mee-NYA za-VOOT A-leks',
 'а вечером':'a VYE-che-ram',
 'давай завтра погуляем':'da-VAI ZAF-tra pa-gu-LYA-yem',
 'а сегодня':'a se-VOD-nya',
 'нет спасибо':'nyet spa-SEE-ba',
 'я учусь в университете а ты':'ya u-CHOOS v u-nee-ver-see-TYE-te. A ty?',
 'а я работаю':'a ya ra-BO-ta-yu',
 'хлеб пожалуйста':'khlyep pa-ZHA-lu-sta',
};
const lessonReadings=new Map(nativeLessons.flatMap(lesson=>lesson.words.map(word=>[key(word.text),word.pronunciation] as const)));
export function russianReading(text:string,words:readonly Word[]=[]):string|undefined{
 if(!/[а-яё]/iu.test(text))return undefined;
 const normalized=key(text);
 // Resolve from the actual safe/displayed Russian string, never from an answer.
 return words.find(word=>key(word.text)===normalized)?.pronunciation??lessonReadings.get(normalized)??examples[normalized];
}
