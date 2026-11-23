// What the home robot says. Pure: NativeHome gathers the facts, this picks the first message that applies.
// Order (approved 2026-11-22): a tap reply, the Mini's sync note, a streak at risk, reviews due, a lesson
// in progress, a lesson (or chapter) just finished, the quick start nudge, an occasional freeze or
// learned-word line, and a greeting for the time of day. The connect prompt is a "second beat"
// (approved 2026-11-23): NativeHome switches it on a few seconds into a visit, and then it replaces
// everything except a tap reply or the Mini's note.
import type {ReviewState} from './review.ts';
import {reviewSource} from './review.ts';
import {hash} from './printContent.ts';

export type GreetingKind='tap'|'note'|'connect'|'streak'|'review'|'resume'|'chapter'|'finished'|'quick-start'|'freeze'|'word'|'hello';
export type Greeting={kind:GreetingKind;text:string};
export type GreetingFacts={
 hour:number;today:string;
 tap?:string;note?:string;
 // The connect prompt's moment has come on this visit.
 connect:boolean;
 streak:number;practisedToday:boolean;
 due:number;midLesson:boolean;
 // The lesson home is showing, when it is complete, and the chapter it completed (if it did).
 finished?:{title:string;chapter?:number};
 quickStartUnseen:boolean;anyPassed:boolean;
 freezes:number;word?:{text:string;meaning:string};
};
export const CONNECT_PROMPT='Have a physical companion? Let’s connect it.';
export const STREAK_HOUR=18;
// How long home shows its message before the day's connect prompt takes the bubble.
export const CONNECT_BEAT_MS=6000;
const dayNumber=(day:string)=>Math.floor(Date.parse(`${day}T12:00:00Z`)/86400000);
export function timeGreeting(hour:number){return hour>=5&&hour<12?'Good morning!':hour>=12&&hour<STREAK_HOUR?'Good afternoon!':'Good evening!';}

export function homeGreeting(f:GreetingFacts):Greeting{
 const say=(kind:GreetingKind,text:string):Greeting=>({kind,text});
 if(f.tap)return say('tap',f.tap);
 if(f.note)return say('note',f.note);
 if(f.connect)return say('connect',CONNECT_PROMPT);
 if(f.hour>=STREAK_HOUR&&f.streak>0&&!f.practisedToday)return say('streak',`Your ${f.streak}-day streak needs a lesson today.`);
 if(f.due>0&&!f.midLesson)return say('review',`Привет! ${f.due} to review today. Shall we?`);
 if(f.midLesson)return say('resume','Shall we pick up where we left off?');
 if(f.finished){
  const done=f.finished;
  // A lesson that finished its chapter says so instead.
  if(done.chapter)return say('chapter',`Chapter ${done.chapter} done. Nice!`);
  // The card below already says what's up next, so the bubble only celebrates.
  return say('finished',`Молодец! You finished ${done.title}.`);
 }
 if(f.quickStartUnseen&&!f.anyPassed)return say('quick-start','New to Cyrillic? Try the quick start.');
 // Now and then: one day in three each for a saved freeze and a learned word, when there is one.
 const slot=((dayNumber(f.today)%3)+3)%3;
 if(slot===0&&f.freezes>0)return say('freeze','You have a streak freeze saved.');
 if(slot===1&&f.word)return say('word',`Remember ${f.word.text}? It means ${f.word.meaning}.`);
 return say('hello',`${timeGreeting(f.hour)} Ready for a little Russian?`);
}

// A learned word for "Remember чай? It means tea.": weak or due ones first, picked by the date. Only
// single plain words, so the sentence reads well (no "Remember Сколько стоит??").
export function learnedWord(review:ReviewState,today:string){
 const plain=/^[^?!.,;:]+$/u;
 const learned=Object.entries(review.items).flatMap(([key,item])=>{
  const word=reviewSource(key)?.word;
  return word&&plain.test(word.text)&&plain.test(word.meaning)&&!word.text.includes(' ')?[{key,item,word}]:[];
 });
 const weak=learned.filter(({item})=>item.box<=1||item.due<=today);
 const pool=(weak.length?weak:learned).sort((a,b)=>a.key.localeCompare(b.key));
 if(!pool.length)return undefined;
 const pick=pool[hash(today)%pool.length].word;
 return {text:pick.text,meaning:pick.meaning};
}
