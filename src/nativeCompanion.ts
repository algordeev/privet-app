import type {Action,Progress} from './engine.ts';
import type {LessonSnapshot} from './session.ts';
import {PRODUCT} from './config.ts';

export const COMPANION_PREFERENCE_KEY=`${PRODUCT.storageKey}-native-companion-reactions`;
export type NativeExpression='idle'|'greeting'|'happy'|'encouraging'|'celebrating';
export type NativeCompanionView={expression:NativeExpression;message:string;revision:number;scope:'home'|'lesson';enabled:boolean;active:boolean};
export function initialCompanion(enabled=true):NativeCompanionView {
 return {expression:'idle',message:'',revision:0,scope:'home',enabled,active:true};
}
export function companionEnabled(raw:string|null){return raw!=='false';}
type StartedSnapshot=Pick<LessonSnapshot,'progress'|'revealed'|'selected'|'tokens'>&Partial<Pick<LessonSnapshot,'matches'>>;
export function lessonStarted(s:StartedSnapshot){
 return s.progress.complete||s.progress.index>0||s.progress.attempts>0||s.revealed.length>0||!!s.selected||s.tokens.length>0||!!s.matches?.length;
}
export function homeGreeting(s:StartedSnapshot,title='Café essentials'){
 return s.progress.complete?`Молодец! You finished ${title}.`:lessonStarted(s)?'Shall we pick up where we left off?':'Привет! Ready for a little Russian?';
}
export const completionSummary='You practised greetings, tea and coffee, ordering tea, and saying thank you.';
const correct=['A little connection made!','That clicked. Nicely done!','One useful phrase at a time.'];
const encouraging=['Take your time. You can try again.','A little practice helps. Have another go.','No rush. Try a different answer.'];
const friendly=['A little Russian, at your pace.','I’m here for the little wins.','One small step is a good start.'];
const stepCounts=['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];
export function nativeLessonReaction(progress:Progress):{expression:NativeExpression;message:string}|null {
 if(progress.complete)return {expression:'celebrating',message:`Молодец! ${stepCounts[progress.results.length]??'All'} small ${progress.results.length===1?'step':'steps'} complete.`};
 if(!progress.feedback)return null;
 const n=(progress.index+Math.max(0,progress.attempts-1))%3;
 return progress.feedback==='correct'?{expression:'happy',message:correct[n]}:{expression:'encouraging',message:encouraging[n]};
}

// Events are emitted by actual lesson transitions, never by render/effect polling.
// A generation guards timer callbacks even if cancellation loses a timer race.
export function createNativeCompanion(
 enabled:boolean,
 publish:(view:NativeCompanionView)=>void,
 clock:{set:(fn:()=>void,ms:number)=>ReturnType<typeof setTimeout>;clear:(id:ReturnType<typeof setTimeout>)=>void},
){
 let view=initialCompanion(enabled),generation=0,timer:ReturnType<typeof setTimeout>|undefined;
 let disposed=false,lastTransition='',taps=0;
 function cancel(){generation++;if(timer!==undefined)clock.clear(timer);timer=undefined;}
 function update(patch:Partial<NativeCompanionView>){view={...view,...patch};if(!disposed)publish(view);}
 function clear(){cancel();update({expression:'idle',message:''});}
 function react(reaction:{expression:NativeExpression;message:string}){
  cancel();if(disposed||!view.enabled||!view.active)return;
  const id=generation;
  update({...reaction,revision:view.revision+1});
  timer=clock.set(()=>{
   if(disposed||generation!==id)return;
   timer=undefined;
   // Keep the text stable: settling animation must not reannounce feedback.
   update({expression:'idle'});
  },reaction.expression==='celebrating'?2400:1400);
 }
 return {
  getSnapshot:()=>view,
  navigate(scope:'home'|'lesson'){if(disposed)return;lastTransition='';clear();update({scope});},
  setEnabled(value:boolean){if(disposed)return;clear();update({enabled:value});},
  setActive(value:boolean){if(disposed)return;if(!value)clear();update({active:value});},
  tap(){react({expression:'greeting',message:friendly[taps++%friendly.length]});},
  transition(previous:Progress,next:Progress,action:Action){
   if(disposed)return;
   if(action.type==='reset'){lastTransition='';clear();return;}
   if(previous===next)return;
   const key=`${previous.index}:${previous.attempts}:${previous.feedback}:${action.type}`;
   if(key===lastTransition)return; // Also guard rapid duplicate submissions.
   lastTransition=key;
   clear();
   if(view.scope!=='lesson')return;
   if(action.type==='check'||next.complete){const reaction=nativeLessonReaction(next);if(reaction)react(reaction);}
  },
  dispose(){if(disposed)return;cancel();disposed=true;},
 };
}
