import {nativeLessons} from './curriculum/catalog.ts';
import type {Word} from './curriculum/types.ts';

// Reading aids, not IPA or letter-by-letter transliteration. Keep reviewed
// whole-word sounds (including vowel reduction) and existing lesson guides.
const key=(text:string)=>text.normalize('NFD').replace(/\u0301/g,'').normalize('NFC').toLowerCase().replace(/[^а-яё]+/gu,' ').trim();
const examples:Readonly<Record<string,string>>={
 'анна':'AN-na','банк':'bank','ваш':'vash','город':'GO-rat','дом':'dom',
 'еда':'yi-DA','ёж':'yosh','журнал':'zhur-NAL','зовут':'za-VUT','имя':'EE-mya',
 'йогурт':'YO-gurt','кофе':'KO-fe','лимон':'li-MON','меня':'mi-NYA','нет':'net',
 'он':'on','привет':'pri-VET','россия':'ra-SEE-ya','спасибо':'spa-SEE-ba','ты':'ti',
 'утро':'U-tra','фото':'FO-ta','хочу':'ha-CHU','центр':'tsentr','чай':'chai',
 'школа':'SHKO-la','щётка':'SHCHOT-ka','подъезд':'pad-YEST','сыр':'sir','день':'den',
 'это':'E-ta','юг':'yuk','я':'ya','пока':'pa-KA',
 // Neutral answer-safe reference alternatives need their own reading too.
 'ваза':'VA-za','гора':'ga-RA','река':'ri-KA','жук':'zhuk','зима':'zi-MA',
 'мир':'meer','музей':'mu-ZEY','лампа':'LAM-pa','нос':'nos','окно':'ak-NO',
 'парк':'park','торт':'tort','хлеб':'hlep','часы':'cha-SI','шар':'shar',
 'экран':'ek-RAN','юбка':'YUP-ka','яблоко':'YA-bla-ka','автобус':'af-TO-bus',
 'билет':'bi-LET','ёлка':'YOL-ka','игра':'ig-RA','йод':'yot','кот':'kot',
 'ель':'yel','фильм':'feelm','объект':'ab-YEKT','соль':'sol','музыка':'MU-zi-ka',
 'улица':'U-li-tsa','цветок':'tsvi-TOK','щука':'SHCHU-ka',
 // Visible dialogue lines/review choices that are not standalone Word entries.
 'ваш чай':'vash chai','ваш кофе':'vash KO-fe',
 'меня зовут алекс':'mi-NYA za-VUT A-leks',
 'метро прямо':'mi-TRO? PRYA-ma',
 'а вечером':'a VE-che-ram',
 'давай гулять завтра':'da-VAI gu-LYAT ZAF-tra',
 'я учусь в университете а ты':'ya u-CHUS v u-ni-ver-si-TE-te. A ti?',
 'а я работаю':'a ya ra-BO-ta-yu',
 'хлеб пожалуйста':'hlep pa-ZHA-lu-sta',
 'привет давай в музей потом чай':'pri-VET! da-VAI v mu-ZEY! pa-TOM chai?',
};
const lessonReadings=new Map(nativeLessons.flatMap(lesson=>lesson.words.map(word=>[key(word.text),word.pronunciation] as const)));
export function russianReading(text:string,words:readonly Word[]=[]):string|undefined{
 if(!/[а-яё]/iu.test(text))return undefined;
 const normalized=key(text);
 // Resolve from the actual safe/displayed Russian string, never from an answer.
 return words.find(word=>key(word.text)===normalized)?.pronunciation??lessonReadings.get(normalized)??examples[normalized];
}
