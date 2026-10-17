import { lesson } from './lesson.ts';
export type CompanionState = 'idle'|'prompting'|'thinking'|'correct'|'try-again'|'celebrating';
export type CompanionEvent = { type:'prompt'|'thinking'|'correct'|'incorrect'|'complete'|'reset'; text?:string };
export function companionReaction(event: CompanionEvent): { state:CompanionState; text:string } {
 const states = { prompt:'prompting', thinking:'thinking', correct:'correct', incorrect:'try-again', complete:'celebrating', reset:'idle' } as const;
 const labels = { prompt:'Привет!', thinking:'Хм…', correct:'Ура!', incorrect:'Ещё раз?', complete:'Молодец!', reset:'Привет!' };
 return { state:states[event.type], text:event.text || labels[event.type] };
}
export function normalizeAnswer(value:string) { return value.normalize('NFD').replace(/[\u0300\u0301]/g,'').normalize('NFC').trim().toLocaleLowerCase('ru').replace(/[.!?…]+$/u,'').trim().replace(/\s+/g,' '); }
export function checkAnswer(index:number, value:string) { return normalizeAnswer(value) === normalizeAnswer(lesson[index].answer); }
export type Progress = { index:number; attempts:number; results:boolean[]; feedback:'correct'|'incorrect'|null; complete:boolean };
export const initialProgress = (): Progress => ({ index:0, attempts:0, results:[], feedback:null, complete:false });
export type Action = { type:'check'; value:string } | { type:'retry'|'continue'|'reset' };
export function progressReducer(state:Progress, action:Action):Progress {
 if(action.type==='reset') return initialProgress();
 if(state.complete) return state;
 if(action.type==='check') {
  if(state.feedback) return state;
  const correct=checkAnswer(state.index, action.value);
  return { ...state, attempts:state.attempts+1, feedback:correct?'correct':'incorrect' };
 }
 if(action.type==='retry') return state.feedback==='incorrect'?{...state,feedback:null}:state;
 if(action.type==='continue' && state.feedback==='correct') {
  const results=[...state.results, state.attempts===1];
  return { index:state.index+1, attempts:0, results, feedback:null, complete:state.index===lesson.length-1 };
 }
 return state;
}
