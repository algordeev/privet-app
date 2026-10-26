// Current curriculum only: shared by app/portable OLED layout validation.
import {nativeLessons} from '../src/curriculum/catalog.ts';
import {firstRunLesson} from '../src/firstRunLesson.ts';
import {CYRILLIC,referenceExample,letterAudioText} from '../src/cyrillic.ts';
import {companionDisplay,type DisplayAction} from '../src/companionDisplay.ts';
import {initialProgress} from '../src/engine.ts';
export function companionCardFixtures(){
 const cards=new Map<string,{context:string;primary:string;secondary:string}>();
 for(const definition of [...nativeLessons,firstRunLesson])for(const [index,e] of definition.exercises.entries()){
  const reference=CYRILLIC.map(item=>referenceExample(item,definition,e));
  const actions:DisplayAction[]=[{kind:'state'},{kind:'hint'},...definition.words.map(w=>({kind:'reveal' as const,word:w.id})),...[...definition.words.map(w=>w.text),...reference.flatMap(item=>[item.example,letterAudioText(item)].filter((t):t is string=>!!t)),...(e.pairs??[]).flat()].map(text=>({kind:'listen' as const,text})),...(e.pairs??[]).map((_,matched)=>({kind:'match' as const,matched}))];
  for(const feedback of [null,'incorrect','correct'] as const)for(const action of actions){
   const card=companionDisplay(definition,{...initialProgress(),index,feedback},action);if(card)cards.set(JSON.stringify(card),{context:`${definition.id}/${e.id}/${feedback}/${action.kind}`,primary:card.primary,secondary:card.secondary});
  }
 }
 return [...cards.values()];
}
