import type {Exercise,LessonDefinition} from './types.ts';

// Speaking steps, approved 2026-11-23. Every Russian line already appears in its lesson: Repeat says a
// lesson word aloud, Reply answers the lesson's own dialogue line. They are spliced into the lessons in
// catalog.ts (Repeat after the discovery step, Reply right after the dialogue choice), so the lesson
// files stay as they were. Saved progress from before (version 1) is moved onto the new steps in session.ts.
//
// A speak exercise with `exchange` is a Reply; otherwise it is a Repeat of `prompt`. Quiet versions
// (speaking off, paused or unavailable), picked so they don't repeat a neighbouring step (agreed 2026-11-24):
// a Repeat is a listening choice from Russian `choices`, or, with quiet:'meaning' (where the lesson has a
// listening step for the same phrase two steps later), "What does it mean?" from English `choices`.
// A Reply is "Hear it": both lines play and it counts as done.
type Repeat={wordId:string;choices:readonly [string,string,string];title:string;quiet?:'meaning'};
// scene: the instruction, ending with what to say (agreed 2026-11-27); translation: the English cue in the reply bubble;
// who: the other person, for "That's Anna's line." when the learner repeats their line instead of answering.
type Reply={after:string;scene:string;translation:string;title:string;who:string;success:string;hint:string};

const REPEAT_TEXT={instruction:'Listen, then say it in Russian.',retryFeedback:'Listen once more, then try again.'};
const REPLY_TEXT={retryFeedback:'Listen to the line again, then say your reply.'};

const SPEAKING:Readonly<Record<string,{repeat:Repeat;reply:Reply}>>={
 cafe:{
  repeat:{wordId:'hi',choices:['Привет!','Спасибо!','кофе'],title:'Say hello.'},
  reply:{after:'exchange',scene:'The barista hands you your tea. Thank them.',translation:'Thank you!',title:'Answer the barista.',who:'the barista',success:'A warm thank you, said out loud.',hint:'Say Спасибо! · spa-SEE-ba'},
 },
 introductions:{
  repeat:{wordId:'ask-name',choices:['Как тебя зовут?','А тебя?','Очень приятно!'],title:'Ask a name.'},
  reply:{after:'exchange',scene:'Alex tells you his name. Say you’re pleased to meet him.',translation:'Nice to meet you!',title:'Answer Alex.',who:'Alex',success:'Очень приятно! Out loud, it sounds even warmer.',hint:'Say Очень приятно! · O-chin pri-YAT-na'},
 },
 'around-town':{
  repeat:{wordId:'excuse',choices:['Извините!','Налево.','Спасибо!'],title:'Stop someone politely.'},
  reply:{after:'exchange',scene:'A passer-by points the way. Thank them.',translation:'Thank you!',title:'Answer the passer-by.',who:'the passer-by',success:'Спасибо! You found the metro and said thanks.',hint:'Say Спасибо! · spa-SEE-ba'},
 },
 shopping:{
  repeat:{wordId:'price',choices:['Сколько стоит?','Вот, пожалуйста.','Да, спасибо.'],title:'Ask the price.'},
  reply:{after:'exchange',scene:'The assistant checks your order. Say yes, and thank them.',translation:'Yes, thank you.',title:'Answer the assistant.',who:'the assistant',success:'Да, спасибо. Polite and clear.',hint:'Say Да, спасибо. · da spa-SEE-ba'},
 },
 'daily-life':{
  repeat:{wordId:'work',choices:['I work.','I relax.','I drink coffee.'],title:'Talk about your day.',quiet:'meaning'},
  reply:{after:'exchange',scene:'Anna asks about your evening. Tell her you relax.',translation:'I relax.',title:'Answer Anna.',who:'Anna',success:'Я отдыхаю. A calm evening, said out loud.',hint:'Say Я отдыхаю. · ya at-di-HA-yu'},
 },
 'making-plans':{
  repeat:{wordId:'walk',choices:['Давай гулять!','До завтра!','Давай!'],title:'Suggest a walk.'},
  reply:{after:'exchange',scene:'Alex suggests a walk. Say yes.',translation:'Let’s! / Sure!',title:'Answer Alex.',who:'Alex',success:'Давай! Short and friendly.',hint:'Say Давай! · da-VAI'},
 },
 studies:{
  repeat:{wordId:'work',choices:['Where do you work? (informal)','And you? (informal)','I study.'],title:'Ask about work.',quiet:'meaning'},
  reply:{after:'exchange',scene:'A classmate asks about you. Say that you work.',translation:'And I work.',title:'Answer your classmate.',who:'your classmate',success:'А я работаю. The little А makes the contrast.',hint:'Say А я работаю. · a ya ra-BO-ta-yu'},
 },
 culture:{
  repeat:{wordId:'interesting',choices:['Интересно!','Потом чай?','Да, давай!'],title:'Share your interest.'},
  reply:{after:'exchange',scene:'Anna plans the museum and tea. Say yes, let’s.',translation:'Yes, let’s!',title:'Answer Anna.',who:'Anna',success:'Да, давай! Museum first, then tea.',hint:'Say Да, давай! · da da-VAI'},
 },
};

function repeatStep(lesson:LessonDefinition,repeat:Repeat):Exercise{
 const word=lesson.words.find(w=>w.id===repeat.wordId);
 if(!word)throw new Error(`${lesson.id}: no word ${repeat.wordId} to repeat`);
 return {id:'say',kind:'speak',wordId:word.id,title:repeat.title,...REPEAT_TEXT,prompt:word.text,answer:word.text,
  translation:word.meaning,pronunciationGuide:word.pronunciation,choices:repeat.choices,...(repeat.quiet?{quiet:repeat.quiet}:{}),
  review:`Saying ${word.text} (${word.pronunciation})`,success:`${word.text} Clear and right.`,hint:`Sounds like: ${word.pronunciation}`};
}
function replyStep(lesson:LessonDefinition,reply:Reply):Exercise{
 const source=lesson.exercises.find(e=>e.id===reply.after);
 if(!source?.exchange)throw new Error(`${lesson.id}: ${reply.after} has no dialogue line`);
 return {id:'reply',kind:'speak',exchange:source.exchange,title:reply.title,instruction:reply.scene,...REPLY_TEXT,prompt:source.exchange.text,
  answer:source.answer,...(source.alsoAccepted?{alsoAccepted:source.alsoAccepted}:{}),translation:reply.translation,replyTo:reply.who,
  review:`Replying out loud: ${source.answer}`,success:reply.success,hint:reply.hint};
}

// The lesson with its speaking steps: Repeat right after the discovery step, Reply right after its dialogue step.
export function withSpeaking(lesson:LessonDefinition):LessonDefinition{
 const steps=SPEAKING[lesson.id];
 if(!steps)return lesson;
 const exercises:Exercise[]=[];
 for(const exercise of lesson.exercises){
  exercises.push(exercise);
  if(exercise.kind==='vocabulary')exercises.push(repeatStep(lesson,steps.repeat));
  if(exercise.id===steps.reply.after)exercises.push(replyStep(lesson,steps.reply));
 }
 return {...lesson,exercises};
}
