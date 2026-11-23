// What the printed learning cards say, built from the curriculum, reviews and stats. Pure: the canvas
// drawing lives in printRender.ts. No new Russian content: every Russian line comes from the lessons.
import {nativeLessons} from './curriculum/catalog.ts';
import type {LessonDefinition,Word} from './curriculum/types.ts';
import {normalizedDisplay} from './companionDisplay.ts';
import {reviewSource,type ReviewState} from './review.ts';
import {localDay,shiftDay} from './days.ts';
import {statsSummary} from './statsSummary.ts';
import {type NativeStats} from './nativeStats.ts';
import {stressText} from './stress.ts';
import {CYRILLIC as ALPHABET,QUICK_LETTERS,QUICK_TITLES,READING_WORDS,type CyrillicLetter} from './cyrillic.ts';
import {russianReading} from './pronunciation.ts';

export function hash(text:string){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h;}
const words=(text:string)=>normalizedDisplay(text).split(' ').filter(Boolean);
const dayLabel=(day:string)=>new Date(`${day}T12:00:00`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});

export type WordCard={key:string;lesson:LessonDefinition;word:Word;date:string;example?:{russian:string;english:string}};
// Russian lines of a lesson with their English: multi-word vocabulary, sentence exercises, exchanges.
export function lessonSentences(lesson:LessonDefinition){
 const out:{russian:string;english:string}[]=[],seen=new Set<string>();
 const add=(russian?:string,english?:string)=>{
  if(!russian||!english||words(russian).length<2)return;
  const key=normalizedDisplay(russian);if(seen.has(key))return;seen.add(key);
  out.push({russian:stressText(russian,lesson.words),english});
 };
 for(const word of lesson.words)add(word.stressed,word.meaning);
 for(const exercise of lesson.exercises){
  if(exercise.kind==='sentence')add(exercise.prompt,exercise.translation);
  if(exercise.exchange)add(exercise.exchange.text,exercise.exchange.meaning);
 }
 return out;
}
// Another line of the same lesson that uses the word (never the word itself).
export function exampleFor(lesson:LessonDefinition,word:Word){
 const target=words(word.text);
 if(!target.length)return undefined;
 return lessonSentences(lesson).find(line=>{
  const tokens=words(line.russian);
  if(normalizedDisplay(line.russian)===normalizedDisplay(word.text))return false;
  return tokens.some((_,i)=>target.every((t,j)=>tokens[i+j]===t));
 });
}
// Word of the day: one of the learned words (any word with a review item), picked by the date and
// preferring weak or due ones. Before anything is learned, the first lesson's words.
export function wordOfTheDay(review:ReviewState,today:string):WordCard{
 const learned=Object.entries(review.items).flatMap(([key,item])=>{const s=reviewSource(key);return s?.word?[{key,item,lesson:s.lesson,word:s.word}]:[];});
 const weak=learned.filter(({item})=>item.box<=1||item.due<=today);
 const pool=weak.length?weak:learned.length?learned:nativeLessons[0].words.map(word=>({key:`${nativeLessons[0].id}/w/${word.id}`,lesson:nativeLessons[0],word}));
 const sorted=[...pool].sort((a,b)=>a.key.localeCompare(b.key));
 const pick=sorted[hash(today)%sorted.length];
 return {key:pick.key,lesson:pick.lesson,word:pick.word,date:dayLabel(today),example:exampleFor(pick.lesson,pick.word)};
}
// A single word card, e.g. from a lesson's vocabulary.
export function wordCard(lesson:LessonDefinition,word:Word,today:string):WordCard{
 return {key:`${lesson.id}/w/${word.id}`,lesson,word,date:dayLabel(today),example:exampleFor(lesson,word)};
}

// Practice strip: three fill-in-the-blank lines with three options each, a word to trace and write,
// and the answers (printed upside down).
export type PracticeItem={before:string;after:string;english:string;options:string[];answer:number};
export type PracticeStrip={lesson:LessonDefinition;items:PracticeItem[];trace?:{russian:string;english:string};answers:string[]};
const CYRILLIC=/[а-яё]/iu;
const bare=(token:string)=>token.replace(/[.,!?…:;«»"()]+/gu,'');
const matchCase=(model:string,text:string)=>model[0]&&model[0]!==model[0].toLowerCase()?text[0].toUpperCase()+text.slice(1):text.toLowerCase();
// Names (e.g. Анна, Алекс): capitalized somewhere other than the start of a sentence. Never blanked or
// offered as a wrong option, since they can't be lowercased.
function courseNames(){
 const names=new Set<string>();
 for(const lesson of nativeLessons)for(const line of [...lesson.words.map(w=>w.stressed),...lessonSentences(lesson).map(l=>l.russian)]){
  const tokens=line.split(/\s+/);
  tokens.forEach((token,i)=>{const b=bare(token);if(i>0&&!/[.!?…]$/u.test(tokens[i-1])&&CYRILLIC.test(b)&&b[0]!==b[0].toLowerCase())names.add(normalizedDisplay(b));});
 }
 return names;
}
// Single Russian words (stressed), first seen first: the pool of options.
function vocabulary(source:readonly LessonDefinition[],names:ReadonlySet<string>){
 const seen=new Map<string,string>();
 const add=(token:string,lesson:LessonDefinition)=>{const b=bare(token),key=normalizedDisplay(b);if(CYRILLIC.test(b)&&key.length>=2&&!names.has(key)&&!seen.has(key))seen.set(key,stressText(b,lesson.words).toLowerCase());};
 for(const lesson of source){
  for(const word of lesson.words)for(const token of word.stressed.split(/\s+/))add(token,lesson);
  for(const line of lessonSentences(lesson))for(const token of line.russian.split(/\s+/))add(token,lesson);
 }
 return [...seen.values()];
}
// focus: words to blank first, in order (a review strip puts the words you missed first).
export function practiceStrip(lesson:LessonDefinition,count=3,{focus=[]}:{focus?:readonly string[]}={}):PracticeStrip{
 const focusRank=(word:string)=>{const i=focus.indexOf(normalizedDisplay(word));return i<0?focus.length:i;};
 const names=courseNames(),sentences=lessonSentences(lesson);
 const own=vocabulary([lesson],names),course=vocabulary(nativeLessons,names).filter(w=>!own.includes(w));
 const lessonWords=new Set(lesson.words.map(w=>normalizedDisplay(w.text)));
 // Two wrong options: this lesson's words first, then the course's; never a word of the line itself.
 const distractorsFor=(answer:string,line:string,seed:string)=>{
  const exclude=new Set([normalizedDisplay(answer),...line.split(/\s+/).map(t=>normalizedDisplay(bare(t)))]);
  const order=(list:string[])=>list.filter(w=>!exclude.has(normalizedDisplay(w))).sort((a,b)=>hash(seed+a)-hash(seed+b));
  return [...order(own),...order(course)].slice(0,2);
 };
 const item=(answer:string,before:string,after:string,english:string,line:string):PracticeItem|undefined=>{
  const wrong=distractorsFor(answer,line,lesson.id+line+answer);
  if(wrong.length<2)return undefined;
  const at=hash(lesson.id+line+answer)%3,options=wrong.map(w=>matchCase(answer,w));options.splice(at,0,answer);
  return {before,after,english,options,answer:at};
 };
 // Every blankable word of every line: lesson vocabulary first, then longer words.
 const candidates=sentences.flatMap((line,s)=>{
  const tokens=line.russian.split(' ');
  return tokens.map((token,i)=>({line,s,tokens,i,word:bare(token)})).filter(c=>CYRILLIC.test(c.word)&&normalizedDisplay(c.word).length>=2&&!names.has(normalizedDisplay(c.word)));
 }).sort((a,b)=>focusRank(a.word)-focusRank(b.word)||Number(lessonWords.has(normalizedDisplay(b.word)))-Number(lessonWords.has(normalizedDisplay(a.word)))||b.word.length-a.word.length||hash(lesson.id+a.word)-hash(lesson.id+b.word));
 const items:PracticeItem[]=[],usedLines=new Set<number>(),usedWords=new Set<string>();
 const fromLine=(c:typeof candidates[number])=>{
  const token=c.tokens[c.i],at=token.indexOf(c.word),prefix=token.slice(0,at),suffix=token.slice(at+c.word.length);
  const head=c.tokens.slice(0,c.i).join(' '),tail=c.tokens.slice(c.i+1).join(' ');
  return item(c.word,(head?head+' ':'')+prefix,suffix+(tail?' '+tail:''),c.line.english,c.line.russian);
 };
 const take=(next:PracticeItem|undefined,word:string,line?:number)=>{if(!next)return;items.push(next);usedWords.add(normalizedDisplay(word));if(line!==undefined)usedLines.add(line);};
 const fromMeaning=(word:Word)=>{
  const russian=bare(word.stressed);
  if(words(word.text).length!==1||usedWords.has(normalizedDisplay(russian))||names.has(normalizedDisplay(russian)))return;
  take(item(russian,'','',word.meaning,russian),russian);
 };
 // With focus words (a review), in their order: each gets a blank in a line, or else a meaning item.
 for(const f of focus){
  if(items.length>=count)break;
  if(usedWords.has(f))continue;
  const c=candidates.find(c=>normalizedDisplay(c.word)===f&&!usedLines.has(c.s));
  if(c){take(fromLine(c),c.word,c.s);continue;}
  const word=lesson.words.find(w=>normalizedDisplay(w.text)===f);
  if(word)fromMeaning(word);
 }
 // 1) one blank per line; 2) a single word from its meaning (____ = coffee); 3) a second blank in a line.
 for(const c of candidates)if(items.length<count&&!usedLines.has(c.s)&&!usedWords.has(normalizedDisplay(c.word)))take(fromLine(c),c.word,c.s);
 for(const word of lesson.words)if(items.length<count)fromMeaning(word);
 for(const c of candidates)if(items.length<count&&!usedWords.has(normalizedDisplay(c.word)))take(fromLine(c),c.word,c.s);
 const typed=lesson.exercises.find(e=>e.kind==='typed');
 const single=lesson.words.find(w=>words(w.text).length===1);
 const traceWord=(typed&&lesson.words.find(w=>normalizedDisplay(w.text)===normalizedDisplay(typed.answer)))||single;
 // The word to trace and write has no stress marks: it is written as it would be by hand.
 const trace=traceWord?{russian:bare(traceWord.text),english:traceWord.meaning}:typed?{russian:typed.answer,english:typed.translation??''}:undefined;
 return {lesson,items,trace,answers:items.map((entry,i)=>`${i+1} ${entry.options[entry.answer]}`)};
}

// Review strip: the practice strip for a finished review session. Its lines come from the lessons
// the reviewed words belong to and contain at least one of them; words answered wrong are blanked
// first and the word to trace is the first one missed (else the first reviewed). No new Russian.
export type ReviewedItem={key:string;correct:boolean};
export function reviewStrip(items:readonly ReviewedItem[],today:string,count=3):PracticeStrip{
 const ordered=[...items.filter(i=>!i.correct),...items.filter(i=>i.correct)];
 const sources=ordered.map(i=>reviewSource(i.key)).filter((s):s is NonNullable<typeof s>=>!!s);
 const reviewed:Word[]=[],seen=new Set<string>();
 for(const s of sources)if(s.word&&!seen.has(normalizedDisplay(s.word.text))){seen.add(normalizedDisplay(s.word.text));reviewed.push(s.word);}
 const tokens=new Set(reviewed.flatMap(w=>words(w.text)));
 const lessons=[...new Set(sources.map(s=>s.lesson))];
 // Lines of those lessons that use a reviewed word (or come from a reviewed exercise).
 const exerciseLessons=new Set(sources.filter(s=>!s.word).map(s=>s.lesson));
 const lines=lessons.flatMap(lesson=>lessonSentences(lesson).filter(line=>exerciseLessons.has(lesson)||words(line.russian).some(t=>tokens.has(t))));
 const single=reviewed.find(w=>words(w.text).length===1);
 const label=new Date(`${today}T12:00:00`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
 const lesson:LessonDefinition={id:'review',number:'',title:`Review · ${label}`,description:'',icon:'↻',motivationTags:[],skills:[],prerequisiteIds:[],words:reviewed,
  exercises:[...lines.map((line,i)=>({id:`line-${i}`,kind:'sentence' as const,title:'',instruction:'',prompt:line.russian,translation:line.english,answer:'',review:'',success:''})),
   ...(single?[{id:'trace',kind:'typed' as const,title:'',instruction:'',prompt:single.text,answer:single.text,translation:single.meaning,review:'',success:''}]:[])],
  summary:'',completionTip:''};
 return practiceStrip(lesson,count,{focus:[...new Set(reviewed.flatMap(w=>words(w.text)))]});
}

// Progress receipt.
export type Receipt={date:string;streak:number;week:{label:string;done:boolean;today:boolean;future:boolean}[];newWords:number;reviewed:number;accuracy:number|null;words:{russian:string;english:string;stars:1|2|3}[];xp:{label:string;xp:number;today:boolean}[];todayXp:number;totalXp:number};
export type Completion={lessonId:string;date:string;results:readonly boolean[]};
const stars=(box:number|undefined):1|2|3=>box===undefined||box<=1?1:box<=3?2:3;
export function progressReceipt(stats:NativeStats,review:ReviewState,completions:readonly Completion[],now:Date,limit=8):Receipt{
 const summary=statsSummary(stats,now),today=summary.week.find(d=>d.today)!.day;
 // Mon–Sun of this week.
 const weekday=(new Date(`${today}T12:00:00Z`).getUTCDay()+6)%7,monday=shiftDay(today,-weekday);
 const week=['M','T','W','T','F','S','S'].map((label,i)=>{const day=shiftDay(monday,i);return {label,done:Object.hasOwn(stats.days,day)||(day<today&&stats.frozen.includes(day)),today:day===today,future:day>today};});
 const finished=completions.filter(c=>{const d=new Date(c.date);return !Number.isNaN(d.getTime())&&localDay(d)===today;});
 const lessonsToday=finished.map(c=>nativeLessons.find(l=>l.id===c.lessonId)).filter((l):l is LessonDefinition=>!!l);
 const logToday=review.log.filter(entry=>entry.day===today);
 // Today's words: from lessons finished today, then words reviewed today; each once.
 const seen=new Set<string>(),todayWords:Receipt['words']=[];
 const addWord=(lesson:LessonDefinition,word:Word,key:string)=>{const id=normalizedDisplay(word.text);if(seen.has(id))return;seen.add(id);todayWords.push({russian:word.stressed,english:word.meaning,stars:stars(review.items[key]?.box)});};
 for(const lesson of lessonsToday)for(const word of lesson.words)addWord(lesson,word,`${lesson.id}/w/${word.id}`);
 const newWords=todayWords.length;
 for(const entry of logToday){const s=reviewSource(entry.key);if(s?.word)addWord(s.lesson,s.word,entry.key);}
 const correct=finished.reduce((n,c)=>n+c.results.filter(Boolean).length,0)+logToday.filter(e=>e.correct).length;
 const total=finished.reduce((n,c)=>n+c.results.length,0)+logToday.length;
 return {
  date:new Date(`${today}T12:00:00`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})+' · '+now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),
  streak:summary.current,week,newWords,reviewed:logToday.length,accuracy:total?Math.round(correct/total*100):null,
  words:todayWords.slice(0,limit),
  xp:summary.week.map(d=>({label:new Date(`${d.day}T12:00:00`).toLocaleDateString('en-GB',{weekday:'narrow'}),xp:d.xp,today:d.today})),
  todayXp:summary.todayXp,totalXp:summary.totalXp,
 };
}

// Alphabet strip for one Cyrillic quick start page: that page's letters to trace and copy (pages 1-3),
// or its reading words (page 4). Everything comes from the quick start itself; the look-alike notes
// are kept only on the look-alikes page, where they are the point.
export type AlphabetLetter={upper:string;lower:string;sound:string;note?:string};
// spelling: letter for letter in Latin letters (the quick start words, to write them back); reading: how it
// sounds (a letter strip's example). A word shows its spelling when it has one.
export type AlphabetWord={russian:string;reading?:string;spelling?:string;english:string};
export type AlphabetStrip={page:number;pages:number;title:string;letters:AlphabetLetter[];words:AlphabetWord[]};
export function alphabetStrip(page:number):AlphabetStrip{
 const pages=QUICK_TITLES.length,at=Math.min(Math.max(0,Math.trunc(page)||0),pages-1);
 const group=QUICK_LETTERS[at] as readonly string[]|undefined;
 const letters=(group??[]).map(upper=>{
  const item=ALPHABET.find(letter=>letter.upper===upper);
  if(!item)throw new Error(`Unknown quick start letter ${upper}`);
  return {upper:item.upper,lower:item.lower,sound:item.sound,...(item.group==='tricky'&&item.note?{note:item.note}:{})};
 });
 const words=group?[]:READING_WORDS.map(word=>({russian:word.text,spelling:word.spelling,english:word.meaning}));
 return {page:at,pages,title:QUICK_TITLES[at].replace(/\.$/u,''),letters,words};
}

// Letter strip: one letter of the Cyrillic guide, printed from its card. The example is the one the card
// shows: during an exercise the guide swaps out any example that would give the answer away
// (referenceExample), and may leave it empty, in which case the strip has no word.
export type LetterStrip={position:number;letters:number;upper:string;lower:string;sound:string;note?:string;example?:AlphabetWord};
export function letterStrip(letter:CyrillicLetter,words:readonly Word[]=[]):LetterStrip{
 const position=ALPHABET.findIndex(item=>item.upper===letter.upper)+1;
 if(!position)throw new Error(`Unknown letter ${letter.upper}`);
 return {position,letters:ALPHABET.length,upper:letter.upper,lower:letter.lower,sound:letter.sound,
  ...(letter.note?{note:letter.note}:{}),
  ...(letter.example?{example:{russian:letter.example,reading:russianReading(letter.example,words),english:letter.meaning}}:{})};
}

// Write-from-memory strip, for the end of the Cyrillic quick start: each quick start page becomes a
// section of prompts (the letters' sounds, then the reading words' guides) to answer in Russian. The order
// is shuffled within each section on every print, so it doesn't give the answers away; the answers follow
// the printed order. The prompts are the sounds the quick start shows and the words' spellings in Latin letters.
export type RecallItem={prompt:string;answer:string};
export type RecallSection={title:string;kind:'letter'|'word';items:RecallItem[]};
export type RecallStrip={sections:RecallSection[]};
function shuffled<T>(items:readonly T[],random:()=>number){
 const out=[...items];
 for(let i=out.length-1;i>0;i--){const j=Math.min(i,Math.floor(random()*(i+1)));[out[i],out[j]]=[out[j],out[i]];}
 return out;
}
export function recallStrip(random:()=>number=Math.random):RecallStrip{
 const title=(page:number)=>QUICK_TITLES[page].replace(/\.$/u,'');
 const letters=QUICK_LETTERS.map((group,page)=>({title:title(page),kind:'letter' as const,items:shuffled(group.map(upper=>{
  const item=ALPHABET.find(letter=>letter.upper===upper);
  if(!item)throw new Error(`Unknown quick start letter ${upper}`);
  return {prompt:item.sound,answer:item.lower};
 }),random)}));
 const words={title:title(QUICK_LETTERS.length),kind:'word' as const,items:shuffled(READING_WORDS.map(word=>{
  // The spelling, not the reading guide: "pa-KA" says how пока sounds, but the learner writes it letter by letter.
  return {prompt:`${word.spelling}  ·  ${word.meaning}`,answer:word.text};
 }),random)};
 return {sections:[...letters,words]};
}
