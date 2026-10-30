import type {Action,Progress} from './engine.ts';

export type HapticKind='correct'|'incorrect'|'failed'|'complete'|'pair';
// Accepted reducer transitions only, like the physical companion's reactions.
export function hapticFor(previous:Progress,next:Progress,action:Action):HapticKind|null {
 if(previous===next||previous.complete)return null;
 if(action.type==='check'&&!previous.feedback&&next.attempts>previous.attempts){
  if(next.failed&&!previous.failed)return 'failed';
  return next.feedback==='correct'?'correct':next.feedback==='incorrect'?'incorrect':null;
 }
 if(action.type==='continue'&&previous.feedback==='correct'&&next.complete)return 'complete';
 return null;
}
