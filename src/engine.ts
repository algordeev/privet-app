import { lesson,type Exercise } from './lesson.ts';
export type CompanionState = 'idle'|'prompting'|'thinking'|'correct'|'try-again'|'celebrating';
export type CompanionEvent = { type:'prompt'|'thinking'|'correct'|'incorrect'|'complete'|'reset'; text?:string };
export function companionReaction(event: CompanionEvent): { state:CompanionState; text:string } {
 const states = { prompt:'prompting', thinking:'thinking', correct:'correct', incorrect:'try-again', complete:'celebrating', reset:'idle' } as const;
 const labels = { prompt:'Привет!', thinking:'Хм…', correct:'Ура!', incorrect:'Ещё раз?', complete:'Молодец!', reset:'Привет!' };
 return { state:states[event.type], text:event.text || labels[event.type] };
}
export function normalizeAnswer(value:string) { return value.normalize('NFD').replace(/[\u0300\u0301]/g,'').normalize('NFC').trim().toLocaleLowerCase('ru').replace(/[.!?…]+$/u,'').trim().replace(/\s+/g,' '); }
export function checkAnswer(index:number, value:string, exercises:readonly Exercise[]=lesson) { return normalizeAnswer(value) === normalizeAnswer(exercises[index].answer); }
export const MAX_HEARTS=3;
export type Progress = { index:number; attempts:number; results:boolean[]; feedback:'correct'|'incorrect'|null; complete:boolean; hearts:number; combo:number; bestCombo:number; failed:boolean };
export const initialProgress = (): Progress => ({ index:0, attempts:0, results:[], feedback:null, complete:false,hearts:MAX_HEARTS,combo:0,bestCombo:0,failed:false });
export function lessonXp(progress:Pick<Progress,'failed'|'hearts'|'bestCombo'>,steps:number){return progress.failed?0:10+Math.min(Math.max(0,progress.hearts),MAX_HEARTS)+(steps>0&&progress.bestCombo>0&&progress.bestCombo<=steps?Math.ceil(5*progress.bestCombo/steps):0);}

// Assessment prompts never carry solutions. An explicit hint or a correct
// submission is the only way to reveal one on the companion.
export function lessonCompanionEvent(
 state: Progress,
 options: { thinking?:boolean; hintRequested?:boolean; vocabularyWord?:string|null } = {},
 exercises:readonly Exercise[]=lesson,
): CompanionEvent {
 if(state.failed) return {type:'incorrect'};
 if(state.complete) return {type:'complete'};
 const exercise=exercises[state.index];
 if(state.feedback==='incorrect') return {type:'incorrect'};
 if(state.feedback==='correct') return exercise.kind==='vocabulary'
  ? {type:'correct'} : {type:'correct',text:exercise.answer};
 if(exercise.kind==='vocabulary') return {type:'prompt',text:options.vocabularyWord || exercise.prompt};
 if(options.hintRequested) return {type:'prompt',text:exercise.answer};
 return options.thinking ? {type:'thinking'} : {type:'prompt',text:'?'};
}

export type Action = { type:'check'; value:string } | { type:'retry'|'continue'|'reset'|'revive'|'refill' };
export function progressReducer(state:Progress, action:Action, exercises:readonly Exercise[]=lesson, options:{unlimitedHearts?:boolean}={}):Progress {
 if(action.type==='reset') return initialProgress();
 if(action.type==='revive')return state.failed&&options.unlimitedHearts?{...state,failed:false,hearts:MAX_HEARTS,feedback:'incorrect'}:state;
 if(action.type==='refill')return state.failed?{...state,failed:false,hearts:MAX_HEARTS,feedback:'incorrect'}:state;
 if(state.complete||state.failed) return state;
 if(action.type==='check') {
  if(state.feedback) return state;
  const correct=checkAnswer(state.index, action.value,exercises);
  if(!correct){const hearts=options.unlimitedHearts?state.hearts:Math.max(0,state.hearts-1);return {...state,attempts:state.attempts+1,feedback:'incorrect',hearts,combo:0,failed:!options.unlimitedHearts&&hearts===0};}
  const combo=state.attempts===0?state.combo+1:state.combo;
  return {...state,attempts:state.attempts+1,feedback:'correct',combo,bestCombo:Math.max(state.bestCombo,combo)};
 }
 if(action.type==='retry') return state.feedback==='incorrect'?{...state,feedback:null}:state;
 if(action.type==='continue' && state.feedback==='correct') {
  const results=[...state.results, state.attempts===1];
  return { ...state,index:state.index+1,attempts:0,results,feedback:null,complete:state.index===exercises.length-1 };
 }
 return state;
}
