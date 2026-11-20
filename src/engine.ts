import { lesson,type Exercise } from './lesson.ts';
export type CompanionState = 'idle'|'prompting'|'thinking'|'correct'|'try-again'|'celebrating';
export type CompanionEvent = { type:'prompt'|'thinking'|'correct'|'incorrect'|'complete'|'reset'; text?:string };
export function companionReaction(event: CompanionEvent): { state:CompanionState; text:string } {
 const states = { prompt:'prompting', thinking:'thinking', correct:'correct', incorrect:'try-again', complete:'celebrating', reset:'idle' } as const;
 const labels = { prompt:'Привет!', thinking:'Хм…', correct:'Ура!', incorrect:'Ещё раз?', complete:'Молодец!', reset:'Привет!' };
 return { state:states[event.type], text:event.text || labels[event.type] };
}
export function normalizeAnswer(value:string) { return value.normalize('NFD').replace(/[\u0300\u0301]/g,'').normalize('NFC').trim().toLocaleLowerCase('ru').replace(/[.!?…]+$/u,'').trim().replace(/\s+/g,' '); }
export function checkAnswer(index:number, value:string, exercises:readonly Exercise[]=lesson) { const exercise=exercises[index]; if(exercise.kind==='match') return value===matchValue(exercise.pairs!.map(([ru])=>ru),exercise); const {answer,alsoAccepted=[]}=exercise; return [answer,...alsoAccepted].some(accepted=>normalizeAnswer(value) === normalizeAnswer(accepted)); }
// Match exercises: each tapped pair is graded at once; the final check submits the matched Russian sides in content order.
export function isPair(exercise:Exercise,ru:string,en:string){return !!exercise.pairs?.some(pair=>pair[0]===ru&&pair[1]===en);}
export function matchValue(matched:readonly string[],exercise:Exercise){return (exercise.pairs??[]).filter(([ru])=>matched.includes(ru)).map(([ru])=>ru).join('\n');}
// Each lesson attempt has a few hearts; a wrong answer costs one, and losing the last fails the attempt.
export const MAX_HEARTS=3;
export type Progress={
 index:number;               // current step
 attempts:number;            // checks made on the current step
 results:boolean[];          // per finished step: right on the first try?
 feedback:'correct'|'incorrect'|null;
 complete:boolean;
 hearts:number;              // 0 to MAX_HEARTS
 combo:number;               // current run of first-try answers
 bestCombo:number;           // longest run in this attempt
 failed:boolean;             // out of hearts: waits for reset or restored hearts
};
export function initialProgress():Progress{
 return {index:0,attempts:0,results:[],feedback:null,complete:false,hearts:MAX_HEARTS,combo:0,bestCombo:0,failed:false};
}
// One XP per answer in the best first-try combo, so longer lessons can earn more.
export function comboXp(progress:Pick<Progress,'bestCombo'>,steps:number){return progress.bestCombo>0&&progress.bestCombo<=steps?progress.bestCombo:0;}
export function lessonXp(progress:Pick<Progress,'failed'|'hearts'|'bestCombo'>,steps:number){return progress.failed?0:10+Math.min(Math.max(0,progress.hearts),MAX_HEARTS)+comboXp(progress,steps);}

// Assessment prompts never carry solutions. An explicit hint or a correct
// submission is the only way to reveal one on the companion.
export function lessonCompanionEvent(
 state: Progress,
 options: { thinking?:boolean; hintRequested?:boolean; vocabularyWord?:string|null } = {},
 exercises:readonly Exercise[]=lesson,
): CompanionEvent {
 if(state.complete&&!state.failed) return {type:'complete'};
 const exercise=exercises[state.index];
 // Running out of hearts reads as a wrong answer: the companion encourages, it never celebrates.
 if(state.failed||state.feedback==='incorrect') return {type:'incorrect'};
 if(state.feedback==='correct') return exercise.kind==='vocabulary'
  ? {type:'correct'} : exercise.kind==='match' ? {type:'correct'} : {type:'correct',text:exercise.answer};
 if(exercise.kind==='vocabulary') return {type:'prompt',text:options.vocabularyWord || exercise.prompt};
 if(options.hintRequested&&exercise.kind!=='match') return {type:'prompt',text:exercise.answer};
 return options.thinking ? {type:'thinking'} : {type:'prompt',text:'?'};
}

// slipped: a match exercise had a wrong pair before this check; it is not a first try, but costs no heart.
// restoreHearts: back from a failed attempt, either because Plus gives unlimited hearts or paid with gems.
export type Action = { type:'check'; value:string; slipped?:boolean } | { type:'retry'|'continue'|'reset' } | { type:'restoreHearts'; by:'plus'|'gems' };
type HeartRules={unlimitedHearts?:boolean};

// A wrong answer ends the run of first tries and costs a heart (none with unlimited hearts).
function afterMistake(state:Progress,rules:HeartRules):Progress{
 const hearts=rules.unlimitedHearts?state.hearts:Math.max(0,state.hearts-1);
 return {...state,attempts:state.attempts+1,feedback:'incorrect',combo:0,hearts,failed:hearts===0&&!rules.unlimitedHearts};
}
function afterCorrect(state:Progress,slipped:boolean):Progress{
 const firstTry=state.attempts===0&&!slipped,combo=firstTry?state.combo+1:state.combo;
 return {...state,attempts:state.attempts+(slipped?2:1),feedback:'correct',combo,bestCombo:Math.max(state.bestCombo,combo)};
}
// Full hearts again on the same step, with "Try again" showing. Plus can only do this while it is active.
function restoreHearts(state:Progress,by:'plus'|'gems',rules:HeartRules):Progress{
 if(!state.failed||(by==='plus'&&!rules.unlimitedHearts))return state;
 return {...state,failed:false,hearts:MAX_HEARTS,feedback:'incorrect'};
}

export function progressReducer(state:Progress, action:Action, exercises:readonly Exercise[]=lesson, rules:HeartRules={}):Progress {
 if(action.type==='reset') return initialProgress();
 if(action.type==='restoreHearts') return restoreHearts(state,action.by,rules);
 // A finished or failed attempt waits for a reset (or restored hearts).
 if(state.complete||state.failed) return state;
 if(action.type==='check') {
  if(state.feedback) return state;
  return checkAnswer(state.index,action.value,exercises)?afterCorrect(state,!!action.slipped):afterMistake(state,rules);
 }
 if(action.type==='retry') return state.feedback==='incorrect'?{...state,feedback:null}:state;
 if(action.type==='continue' && state.feedback==='correct') {
  const results=[...state.results, state.attempts===1];
  const index=state.index+1;
  return {...state,index,attempts:0,results,feedback:null,complete:index===exercises.length};
 }
 return state;
}
