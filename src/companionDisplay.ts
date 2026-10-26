import {CYRILLIC,referenceExample,letterAudioText} from './cyrillic.ts';
import type {LessonDefinition,Exercise} from './curriculum/types.ts';
import type {Progress} from './engine.ts';
import {DISPLAY_MODE as MODE,fitText,validateCard,type LearningCard} from './learningProtocol.ts';
// Small OLED labels, independent of lesson prose/editorial changes. Never parse
// success/review strings to invent a translation or embed curriculum in firmware.
const labels:Readonly<Record<string,string>>={cafe:'At the cafe',introductions:'Meet Anna','around-town':'Find the metro',shopping:'At the shop','daily-life':'Your day','making-plans':'Make a plan',studies:'Study and work',culture:'A weekend together'};
const replies:Readonly<Record<string,{russian:string;meaning:string}>>={'studies/exchange':{russian:'А я работаю.',meaning:'And I work.'}};
export function normalizedDisplay(text:string){return text.normalize('NFD').replace(/[\u0300\u0301]/g,'').normalize('NFC').toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
export function containsAnswer(text:string,answer:string){const a=normalizedDisplay(answer),t=normalizedDisplay(text);return !!a&&(/[а-яё]/iu.test(answer)?t.includes(a):(` ${t} `).includes(` ${a} `));}
export function safeBeforeAnswer(exercise:Exercise,primary:string,secondary=''){return exercise.kind==='vocabulary'||![primary,secondary,primary+' '+secondary].some(text=>[exercise.answer,...exercise.alsoAccepted??[]].some(answer=>containsAnswer(text,answer)));}
// Register/context details remain on the phone; the OLED keeps the meaning.
export function compactMeaning(text:string){return text.replace(/ \(informal\)/g,'').replace('And you? (your name)','And your name?');}
function card(mode:LearningCard['mode'],primary:string,secondary=''){const result={mode,primary:fitText(primary,64),secondary:fitText(compactMeaning(secondary),32)};return validateCard(result)?result:undefined;}
export type DisplayAction={kind:'state'}|{kind:'reveal';word:string}|{kind:'hint'}|{kind:'listen';text:string}|{kind:'match';matched:number};
export function companionDisplay(definition:LessonDefinition,progress:Progress,action:DisplayAction={kind:'state'}):LearningCard|undefined{
 if(progress.complete||progress.failed)return;
 const e=definition.exercises[progress.index];if(!e)return;
 const label=labels[definition.id]??'See your phone';
 const safe=(mode:LearningCard['mode'],p:string,s='')=>{if(!safeBeforeAnswer(e,p,s))return;const result=card(mode,p,s);return result&&safeBeforeAnswer(e,result.primary,result.secondary)?result:undefined;};
 if(action.kind==='listen'){
  // Only phone-visible vocabulary, question words, exchange lines and safe
  // alphabet examples may be spoken before grading; never trust input text.
  if(progress.feedback==='correct')return card(MODE.PRONUNCIATION,action.text);
  // Listening exercises never show what is being spoken; a matching item alone (no meaning) is already on the phone.
  if(e.kind==='listen')return;
  if(e.kind==='match')return e.pairs?.some(([ru])=>ru===action.text)?safe(MODE.PRONUNCIATION,action.text):undefined;
  const guide=CYRILLIC.map(item=>referenceExample(item,definition,e));
  const reference=guide.some(item=>item.example===action.text||letterAudioText(item)===action.text);
  const visible=reference||definition.words.some(w=>w.text===action.text)&&(e.kind==='vocabulary'||definition.words.find(w=>w.id===e.wordId)?.text===action.text)||e.exchange?.text===action.text;
  return visible?safe(MODE.PRONUNCIATION,action.text):undefined;
 }
 if(action.kind==='reveal'&&e.kind==='vocabulary'){
  const word=definition.words.find(w=>w.id===action.word);return word?card(MODE.DISCOVERY,word.text,word.meaning):undefined;
 }
 if(action.kind==='hint')return safe(MODE.HINT,'See phone hint',label);
 if(e.kind==='match'){
  // Progress only: never a Russian/English pair.
  if(progress.feedback==='correct')return card(MODE.ANSWER,'All pairs matched',label);
  return action.kind==='match'?safe(MODE.SAFE_PROMPT,'Match the pairs',`${action.matched} of ${e.pairs?.length??0}`):safe(MODE.SAFE_PROMPT,'Match the pairs',label);
 }
 if(progress.feedback==='correct'){
  if(e.kind==='vocabulary')return;
  const word=definition.words.find(w=>w.id===e.wordId);
  if(word)return card(MODE.ANSWER,word.text,word.meaning);
  const curated=replies[`${definition.id}/${e.id}`];
  const meaning=e.translation??definition.words.find(w=>normalizedDisplay(w.text)===normalizedDisplay(e.answer))?.meaning??(curated&&normalizedDisplay(curated.russian)===normalizedDisplay(e.answer)?curated.meaning:undefined);
  return /[А-Яа-яЁё]/u.test(e.answer)&&meaning?card(MODE.ANSWER,e.answer,meaning):undefined;
 }
 if(e.kind==='vocabulary')return card(MODE.SAFE_PROMPT,'Tap a word',label);
 if(e.kind==='listen')return safe(MODE.SAFE_PROMPT,'Listen on phone',label);
 if(e.wordId){const word=definition.words.find(w=>w.id===e.wordId);if(word)return safe(MODE.SAFE_PROMPT,word.text,'Choose on phone');}
 if(e.exchange)return safe(MODE.SAFE_PROMPT,e.exchange.text,'Your reply?')??safe(MODE.SAFE_PROMPT,label,'Your reply?');
 return safe(MODE.SAFE_PROMPT,e.translation??label,'Try on your phone')??safe(MODE.SAFE_PROMPT,label);
}
