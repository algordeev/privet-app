export type Word = { id: string; text: string; stressed: string; pronunciation: string; meaning: string };
export type Exercise = {
 id:string; kind:'vocabulary'|'choice'|'sentence'|'typed'|'listen'|'match'|'speak'; title:string; instruction:string; prompt:string;
 answer:string; alsoAccepted?:readonly string[]; review:string; success:string; retryFeedback?:string; hint?:string;
 choices?:readonly string[]; tokens?:readonly string[]; wordId?:string;
 exchange?:{speaker:string;text:string;meaning:string}; translation?:string;
 pronunciationGuide?:string; letters?:readonly string[];
 // speak: said aloud. With `exchange` it is a Reply to that line, otherwise a Repeat of `prompt`. Quiet
 // versions: a Repeat is a listening choice from `choices`, or with quiet:'meaning' a meaning choice
 // (English `choices`, answer `translation`); a Reply is "Hear it" (both lines play, counts as done).
 quiet?:'meaning';
 // A Reply's other person, as named in "That's Anna's line." when the learner repeats their line (e.g. 'Anna', 'the barista').
 replyTo?:string;
 // match: [Russian, English] pairs, graded per pair as the learner taps them.
 pairs?:readonly (readonly [string,string])[];
};
export type Motivation='Travel'|'Conversations'|'Studies'|'Culture';
export type LessonDefinition={
 id:string;number:string;title:string;description:string;icon:string;
 motivationTags:readonly Motivation[];skills:readonly string[];prerequisiteIds:readonly string[];
 words:readonly Word[];exercises:readonly Exercise[];summary:string;completionTip:string;
};
