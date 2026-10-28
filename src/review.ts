import {nativeLessons} from './curriculum/catalog.ts';
import type {Exercise,LessonDefinition,Word} from './curriculum/types.ts';
import {normalizedDisplay} from './companionDisplay.ts';
import {DISPLAY_MODE,validateCard,type LearningCard} from './learningProtocol.ts';
import {shiftDay,validDay} from './nativeStats.ts';
import {PRODUCT} from './config.ts';

// Leitner ladder: an item in box b comes back INTERVALS[b] days after a correct review.
export const INTERVALS=[1,3,7,16,35,90] as const;
export const MAX_BOX=INTERVALS.length-1;
export const SESSION_SIZE=10;
export const LOG_LIMIT=1000;
export const REVIEW_KEY=`${PRODUCT.storageKey}-native-review`;
export const REVIEW_LESSON_ID='review';

export type ReviewFormat='original'|'meaning'|'listen'|'recall'|'typed';
export type ReviewItem={box:number;due:string;lapses:number;reviews:number};
// The log keeps every graded review so a smarter scheduler (e.g. FSRS) can be fitted later.
export type ReviewLog={key:string;day:string;correct:boolean;format:ReviewFormat};
export type ReviewState={version:1;items:Record<string,ReviewItem>;log:ReviewLog[]};
export type ReviewSource={key:string;lesson:LessonDefinition;word?:Word;exercise?:Exercise};
export type ReviewSession={definition:LessonDefinition;items:{key:string;format:ReviewFormat}[]};

export const emptyReview=():ReviewState=>({version:1,items:{},log:[]});

// A word's typed exercise (or one tied to it by wordId) practises that word, so its result counts for the word.
function linkedWord(lesson:LessonDefinition,exercise:Exercise){
 if(exercise.wordId)return lesson.words.find(w=>w.id===exercise.wordId);
 return exercise.kind==='typed'?lesson.words.find(w=>normalizedDisplay(w.text)===normalizedDisplay(exercise.answer)):undefined;
}
function buildCatalog(){
 const sources:ReviewSource[]=[],byText=new Map<string,string>();
 for(const lesson of nativeLessons){
  for(const word of lesson.words){
   const text=normalizedDisplay(word.text);if(byText.has(text))continue;
   const key=`${lesson.id}/w/${word.id}`;byText.set(text,key);sources.push({key,lesson,word});
  }
  for(const exercise of lesson.exercises)if(exercise.kind!=='vocabulary'&&!linkedWord(lesson,exercise))sources.push({key:`${lesson.id}/e/${exercise.id}`,lesson,exercise});
 }
 return {sources,byKey:new Map(sources.map(s=>[s.key,s])),byText};
}
const catalog=buildCatalog();
export const reviewSources=():readonly ReviewSource[]=>catalog.sources;
export const reviewSource=(key:string)=>catalog.byKey.get(key);

// First-try result per review item for one finished lesson; a word is correct only if every exercise practising it was.
export function lessonItemResults(lesson:LessonDefinition,results:readonly boolean[]):Map<string,boolean>{
 const out=new Map<string,boolean>();
 if(results.length!==lesson.exercises.length)return out;
 for(const word of lesson.words){const key=catalog.byText.get(normalizedDisplay(word.text));if(key)out.set(key,true);}
 lesson.exercises.forEach((exercise,i)=>{
  if(exercise.kind==='vocabulary')return;
  const word=linkedWord(lesson,exercise);
  const key=word?catalog.byText.get(normalizedDisplay(word.text)):`${lesson.id}/e/${exercise.id}`;
  if(key)out.set(key,(out.get(key)??true)&&results[i]);
 });
 return out;
}
const seeded=(correct:boolean,today:string):ReviewItem=>({box:0,due:correct?shiftDay(today,INTERVALS[0]):today,lapses:0,reviews:0});
// Adds items for lessons already passed (including ones finished before review existed); never changes existing items.
export function syncLessons(state:ReviewState,completed:readonly {lessonId:string;results:readonly boolean[]}[],today:string):ReviewState{
 let items=state.items;
 for(const {lessonId,results} of completed){
  const lesson=nativeLessons.find(l=>l.id===lessonId);if(!lesson)continue;
  for(const [key,correct] of lessonItemResults(lesson,results))if(!Object.hasOwn(items,key)){if(items===state.items)items={...items};items[key]=seeded(correct,today);}
 }
 return items===state.items?state:{...state,items};
}
// A freshly finished lesson also brings its mistakes forward so they are due today.
export function recordLesson(state:ReviewState,lessonId:string,results:readonly boolean[],today:string):ReviewState{
 const lesson=nativeLessons.find(l=>l.id===lessonId);if(!lesson)return state;
 const items={...state.items};
 for(const [key,correct] of lessonItemResults(lesson,results)){
  const item=items[key];
  if(!item)items[key]=seeded(correct,today);
  else if(!correct&&item.due>today)items[key]={...item,due:today};
 }
 return {...state,items};
}
export function promote(item:ReviewItem,correct:boolean,today:string):ReviewItem{
 if(correct){const box=Math.min(item.box+1,MAX_BOX);return {box,due:shiftDay(today,INTERVALS[box]),lapses:item.lapses,reviews:item.reviews+1};}
 return {box:Math.max(0,item.box-2),due:shiftDay(today,1),lapses:item.lapses+1,reviews:item.reviews+1};
}
export function recordReview(state:ReviewState,items:ReviewSession['items'],results:readonly boolean[],today:string):ReviewState{
 if(results.length!==items.length)return state;
 const next={...state.items},log=[...state.log];
 items.forEach(({key,format},i)=>{const item=next[key];if(!item)return;next[key]=promote(item,results[i],today);log.push({key,day:today,correct:results[i],format});});
 return {...state,items:next,log:log.slice(-LOG_LIMIT)};
}

// Most overdue and weakest first; ties are shuffled per day so one lesson's items don't arrive in a block.
export function dueKeys(state:ReviewState,today:string){
 return Object.entries(state.items).filter(([,item])=>item.due<=today).sort(([a,x],[b,y])=>x.due.localeCompare(y.due)||x.box-y.box||hash(today+a)-hash(today+b)||a.localeCompare(b)).map(([key])=>key);
}
export function nextDue(state:ReviewState,today:string){return Object.values(state.items).map(item=>item.due).filter(day=>day>today).sort()[0];}

// Recognition first, then listening, then recall; single words are finally typed.
const stripEnd=(text:string)=>text.replace(/[.!?…]+$/u,'').trim();
export function reviewFormat(source:ReviewSource,box:number):ReviewFormat{
 if(source.exercise||!source.word)return 'original';
 if(box===0)return 'meaning';
 if(box===1)return 'listen';
 return box>=3&&!/\s/.test(stripEnd(source.word.text))?'typed':'recall';
}
function hash(text:string){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h;}
const meaningKey=(meaning:string)=>normalizedDisplay(meaning.replace(/\s*\([^)]*\)/g,''));
// Two distractors: same lesson first, then other learned lessons, then the rest of the course.
function distractors(source:ReviewSource&{word:Word},learned:ReadonlySet<string>,pick:(w:Word)=>string,same:(w:Word)=>string,seed:string){
 const tiers=[[source.lesson],nativeLessons.filter(l=>l!==source.lesson&&learned.has(l.id)),nativeLessons.filter(l=>l!==source.lesson&&!learned.has(l.id))];
 const taken=new Set([same(source.word)]),chosen:{word:Word;lesson:LessonDefinition}[]=[];
 for(const tier of tiers){
  const candidates=tier.flatMap(lesson=>lesson.words.map(word=>({word,lesson}))).sort((a,b)=>hash(seed+pick(a.word))-hash(seed+pick(b.word)));
  for(const candidate of candidates){if(chosen.length===2)break;const id=same(candidate.word);if(!id||taken.has(id))continue;taken.add(id);chosen.push(candidate);}
 }
 return chosen;
}
function withAnswer(answer:string,others:string[],seed:string){const list=[...others];list.splice(hash(seed)%(list.length+1),0,answer);return list;}
const wordId=(lesson:LessonDefinition,word:Word)=>`${lesson.id}/${word.id}`;
function generated(source:ReviewSource&{word:Word},format:Exclude<ReviewFormat,'original'>,learned:ReadonlySet<string>,seed:string):{exercise:Exercise;lessons:LessonDefinition[]}{
 const {word,lesson,key}=source,s=seed+key,from=`You met this in “${lesson.title}”.`;
 const base={id:key,answer:'',review:`${word.text} → ${word.meaning}`,success:`Yes: ${word.text} means “${word.meaning}”.`};
 if(format==='meaning'){
  const others=distractors(source,learned,w=>w.meaning,w=>meaningKey(w.meaning),s);
  return {lessons:others.map(o=>o.lesson),exercise:{...base,kind:'choice',wordId:wordId(lesson,word),title:'What does it mean?',instruction:`Choose the meaning of ${word.text}`,prompt:word.text,choices:withAnswer(word.meaning,others.map(o=>o.word.meaning),s),answer:word.meaning,retryFeedback:'Not this one. Listen again and try another meaning.',hint:from}};
 }
 if(format==='listen'||format==='recall'){
  const others=distractors(source,learned,w=>w.text,w=>normalizedDisplay(w.text),s);
  const choices=withAnswer(word.text,others.map(o=>o.word.text),s);
  return format==='listen'
   ?{lessons:others.map(o=>o.lesson),exercise:{...base,kind:'listen',wordId:wordId(lesson,word),title:'What did you hear?',instruction:'Listen, then choose what you heard.',prompt:word.text,choices,answer:word.text,retryFeedback:'Replay it and listen for the stressed syllable.',hint:from}}
   :{lessons:others.map(o=>o.lesson),exercise:{...base,kind:'choice',title:'Say it in Russian.',instruction:`Choose the Russian for “${word.meaning}”`,prompt:word.meaning,translation:word.meaning,choices,answer:word.text,retryFeedback:'Not quite. Say each option to yourself and try again.',hint:`Sounds like: ${word.pronunciation}`}};
 }
 const answer=stripEnd(word.text).toLocaleLowerCase('ru');
 const letters=[...new Set(Array.from(answer))].sort((a,b)=>hash(s+a)-hash(s+b));
 return {lessons:[],exercise:{...base,kind:'typed',title:'Type it in Russian.',instruction:`Type “${word.meaning}” in Russian. The letter buttons are here if you need them.`,prompt:answer,translation:word.meaning,letters,answer,pronunciationGuide:`${stripEnd(word.stressed)} · ${word.pronunciation}`,retryFeedback:'Check the letters, or open the hint for how it sounds.',hint:`Sounds like: ${word.pronunciation}`}};
}

// A synthetic lesson of real or generated exercises. Ids are namespaced by lesson so words from different lessons never collide.
export function buildReviewSession(state:ReviewState,today:string,size=SESSION_SIZE):ReviewSession|null{
 const keys=dueKeys(state,today).filter(key=>catalog.byKey.has(key)).slice(0,size);
 if(!keys.length)return null;
 const learned=new Set(Object.keys(state.items).map(key=>key.split('/')[0]));
 const lessons=new Set<LessonDefinition>(),exercises:Exercise[]=[],items:ReviewSession['items']=[];
 for(const key of keys){
  const source=catalog.byKey.get(key)!,format=reviewFormat(source,state.items[key].box);
  lessons.add(source.lesson);
  if(format==='original'){exercises.push({...source.exercise!,id:key});}
  else{const built=generated(source as ReviewSource&{word:Word},format,learned,today);built.lessons.forEach(l=>lessons.add(l));exercises.push(built.exercise);}
  items.push({key,format});
 }
 const words=[...lessons].flatMap(lesson=>lesson.words.map(word=>({...word,id:wordId(lesson,word)})));
 const n=items.length;
 return {items,definition:{id:REVIEW_LESSON_ID,number:'',title:'Review',description:'Words and phrases that are due today.',icon:'↻',motivationTags:[],skills:[],prerequisiteIds:[],words,exercises,summary:`You reviewed ${n} ${n===1?'item':'items'} from your lessons.`,completionTip:'Everything you missed comes back tomorrow; the rest returns a little later each time.'}};
}

// Only the count is shown; DISCOVERY cards return to the neutral face when they expire.
export function reviewHomeCard(due:number):LearningCard|undefined{
 if(!Number.isInteger(due)||due<=0)return;
 const card={mode:DISPLAY_MODE.DISCOVERY,primary:`${due} to review`,secondary:'Practice on phone'};
 return validateCard(card)?card:undefined;
}

const validItem=(v:any)=>!!v&&typeof v==='object'&&Number.isInteger(v.box)&&v.box>=0&&v.box<=MAX_BOX&&typeof v.due==='string'&&validDay(v.due)&&Number.isSafeInteger(v.lapses)&&v.lapses>=0&&Number.isSafeInteger(v.reviews)&&v.reviews>=0;
const formats:readonly ReviewFormat[]=['original','meaning','listen','recall','typed'];
const validLog=(v:any)=>!!v&&typeof v.key==='string'&&catalog.byKey.has(v.key)&&typeof v.day==='string'&&validDay(v.day)&&typeof v.correct==='boolean'&&formats.includes(v.format);
// Invalid or retired entries are dropped one by one; anything unreadable starts fresh and is re-seeded from passed lessons.
export function restoreReview(raw:string|null):ReviewState{
 try{
  const s=raw?JSON.parse(raw):null;
  if(s?.version!==1||!s.items||typeof s.items!=='object'||Array.isArray(s.items)||!Array.isArray(s.log))return emptyReview();
  const items=Object.fromEntries(Object.entries(s.items).filter(([key,item])=>catalog.byKey.has(key)&&validItem(item)).map(([key,item]:[string,any])=>[key,{box:item.box,due:item.due,lapses:item.lapses,reviews:item.reviews}]));
  return {version:1,items,log:s.log.filter(validLog).map((l:any)=>({key:l.key,day:l.day,correct:l.correct,format:l.format})).slice(-LOG_LIMIT)};
 }catch{return emptyReview();}
}
