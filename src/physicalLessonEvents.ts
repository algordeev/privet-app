import type {Action,Progress} from './engine.ts';
import {COMMAND,type CommandCode} from './bleProtocol.ts';

// A first try that extends a combo of two or more (the in-lesson "✦ N combo") is an "on fire" moment.
export function onFire(previous:Pick<Progress,'combo'>,next:Pick<Progress,'combo'>){return next.combo>previous.combo&&next.combo>=2;}
// Accepted reducer transitions only. No dependency on rendered feedback,
// virtual animation timers, input changes, storage restoration or audio.
export function physicalLessonCommand(previous:Progress,next:Progress,action:Action):CommandCode|null {
 if(action.type==='reset')return COMMAND.IDLE;
 if(previous===next||previous.complete)return null;
 if(action.type==='check'&&!previous.feedback&&next.attempts>previous.attempts){
  return next.feedback==='correct'?(onFire(previous,next)?COMMAND.ON_FIRE:COMMAND.HAPPY):next.feedback==='incorrect'?COMMAND.ENCOURAGE:null;
 }
 if(action.type==='continue'&&previous.feedback==='correct'&&next.index===previous.index+1){
  return next.complete?COMMAND.CELEBRATE:COMMAND.THINKING;
 }
 if(action.type==='retry'&&previous.feedback==='incorrect'&&!next.feedback)return COMMAND.THINKING;
 return null;
}
export function createPhysicalLessonEvents(send:(command:CommandCode,next:Progress,lessonId:string)=>unknown){
 let lastTransition='';
 return (previous:Progress,next:Progress,action:Action,lessonId='cafe')=>{
  const command=physicalLessonCommand(previous,next,action);if(command===null)return;
  // A rapid second dispatch can share the pre-render snapshot. The reducer
  // accepts only the first check, even when the second value differs.
  const key=JSON.stringify([lessonId,previous,action.type]);
  if(action.type!=='reset'&&key===lastTransition)return;
  lastTransition=key;send(command,next,lessonId);
 };
}
