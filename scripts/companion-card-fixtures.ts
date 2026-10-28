// Current curriculum only: shared by app/portable OLED layout validation.
import {nativeLessons} from '../src/curriculum/catalog.ts';
import {firstRunLesson} from '../src/firstRunLesson.ts';
import {CYRILLIC,referenceExample,letterAudioText} from '../src/cyrillic.ts';
import {companionDisplay,type DisplayAction} from '../src/companionDisplay.ts';
import {initialProgress} from '../src/engine.ts';
import {MAX_BOX,buildReviewSession,emptyReview,reviewFormat,reviewHomeCard,reviewSources} from '../src/review.ts';
// Every review item in every format: one synthetic review lesson per box where some format changes
// (later boxes repeat earlier formats; lesson exercises are identical in every box, so they appear once).
export function reviewDefinitions(){
 const seen=new Set<string>(),definitions=[];
 for(let box=0;box<=MAX_BOX;box++){
  const sources=reviewSources().filter(s=>!seen.has(`${s.key}/${reviewFormat(s,box)}`));
  if(!sources.length)continue;
  sources.forEach(s=>seen.add(`${s.key}/${reviewFormat(s,box)}`));
  const state={...emptyReview(),items:Object.fromEntries(sources.map(s=>[s.key,{box,due:'2026-01-01',lapses:0,reviews:0}]))};
  definitions.push(buildReviewSession(state,'2026-01-02',Infinity)!.definition);
 }
 return definitions;
}
let cached:{context:string;primary:string;secondary:string}[]|undefined;
export function companionCardFixtures(){
 if(cached)return cached;
 const cards=new Map<string,{context:string;primary:string;secondary:string}>();
 for(const due of [1,10,99,999]){const card=reviewHomeCard(due);if(card)cards.set(JSON.stringify(card),{context:`home/review/${due}`,primary:card.primary,secondary:card.secondary});}
 for(const definition of [...nativeLessons,firstRunLesson,...reviewDefinitions()])for(const [index,e] of definition.exercises.entries()){
  const reference=CYRILLIC.map(item=>referenceExample(item,definition,e));
  const actions:DisplayAction[]=[{kind:'state'},{kind:'hint'},...definition.words.map(w=>({kind:'reveal' as const,word:w.id})),...[...definition.words.map(w=>w.text),...reference.flatMap(item=>[item.example,letterAudioText(item)].filter((t):t is string=>!!t)),...(e.pairs??[]).flat()].map(text=>({kind:'listen' as const,text})),...(e.pairs??[]).map((_,matched)=>({kind:'match' as const,matched}))];
  for(const feedback of [null,'incorrect','correct'] as const)for(const action of actions){
   const card=companionDisplay(definition,{...initialProgress(),index,feedback},action);if(card)cards.set(JSON.stringify(card),{context:`${definition.id}/${e.id}/${feedback}/${action.kind}`,primary:card.primary,secondary:card.secondary});
  }
 }
 return cached=[...cards.values()];
}
