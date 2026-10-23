export type Word = { id: string; text: string; stressed: string; pronunciation: string; meaning: string };
export type Exercise = {
 id:string; kind:'vocabulary'|'choice'|'sentence'|'typed'; title:string; instruction:string; prompt:string;
 answer:string; review:string; success:string; retryFeedback?:string; hint?:string;
 choices?:readonly string[]; tokens?:readonly string[]; wordId?:string;
 exchange?:{speaker:string;text:string;meaning:string}; translation?:string;
 pronunciationGuide?:string; letters?:readonly string[];
};
export type Motivation='Travel'|'Conversations'|'Studies'|'Culture';
export type LessonDefinition={
 id:string;number:string;title:string;description:string;icon:string;
 motivationTags:readonly Motivation[];skills:readonly string[];prerequisiteIds:readonly string[];
 words:readonly Word[];exercises:readonly Exercise[];summary:string;completionTip:string;
};
