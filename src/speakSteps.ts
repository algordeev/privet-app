import type {Exercise} from './curriculum/types.ts';

// How a speaking step is shown. Spoken: as itself. Quiet (speaking off, paused, refused or unavailable),
// so the lesson keeps its length and the step its place: a Repeat becomes a listening choice, or a meaning
// choice where the lesson already listens to that phrase; a Reply becomes "Hear it" (still kind 'speak':
// both lines play and Continue counts it as done, see hearsReply).
export function presentExercise(exercise:Exercise,spoken:boolean):Exercise{
 if(exercise.kind!=='speak')return exercise;
 if(exercise.exchange)return spoken
  ?{...exercise,instruction:`${exercise.instruction} Say your reply out loud.`}
  :{...exercise,title:'Hear it out loud.',instruction:`${exercise.instruction} Listen to the whole exchange.`};
 if(spoken)return exercise;
 if(exercise.quiet==='meaning')return {...exercise,kind:'choice',title:'What does it mean?',instruction:`Choose the meaning of ${exercise.prompt}`,answer:exercise.translation??exercise.answer};
 return {...exercise,kind:'listen',title:'What did you hear?',instruction:'Listen, then choose what you heard.'};
}
// A quiet Reply: nothing to answer, the learner hears both lines and continues.
export const hearsReply=(exercise:Exercise,spoken:boolean)=>exercise.kind==='speak'&&!!exercise.exchange&&!spoken;
// What the model voice says: the other person's line for a Reply, the word itself for a Repeat.
export const modelLine=(exercise:Exercise)=>exercise.exchange?.text??exercise.prompt;
