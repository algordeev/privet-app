import {lesson,words,type Exercise,type Word} from './lesson.ts';

export type LessonDefinition={
 id:string;number:string;title:string;description:string;icon:string;
 words:readonly Word[];exercises:readonly Exercise[];summary:string;completionTip:string;
};
export const cafeLesson:LessonDefinition={
 id:'cafe',number:'01',title:'Café essentials',description:'Say hello, order something warm, and say thank you.',icon:'☕',
 words,exercises:lesson,summary:'You practised greetings, tea and coffee, ordering tea, and saying thank you.',
 completionTip:'Try saying Я хочу чай. next time you make a cup.',
};
export const introductionsLesson:LessonDefinition={
 id:'introductions',number:'02',title:'Nice to meet you',icon:'↗',
 description:'Introduce yourself, ask someone’s name, and say goodbye.',
 summary:'You practised introducing yourself, asking someone’s name, saying nice to meet you, and saying goodbye.',
 completionTip:'Try Меня зовут… with your own name. Анна was just our example.',
 words:[
  {id:'name',text:'Меня зовут Анна.',stressed:'Меня́ зову́т А́нна.',pronunciation:'mee-NYA za-VOOT AN-na',meaning:'My name is Anna.'},
  {id:'ask-name',text:'Как тебя зовут?',stressed:'Как тебя́ зову́т?',pronunciation:'kak tee-BYA za-VOOT',meaning:'What’s your name?'},
  {id:'and-you',text:'А тебя?',stressed:'А тебя́?',pronunciation:'a tee-BYA',meaning:'And you? (your name)'},
  {id:'nice',text:'Очень приятно!',stressed:'О́чень прия́тно!',pronunciation:'OH-chin pree-YAT-na',meaning:'Nice to meet you!'},
  {id:'bye',text:'Пока!',stressed:'Пока́!',pronunciation:'pa-KA',meaning:'Bye!'},
 ],
 exercises:[
  {id:'discover',kind:'vocabulary',title:'From hello to a new friend.',instruction:'Meet five expressions for a friendly introduction. These use informal ты: for a peer or someone you know. Анна (Anna) is our example name.',prompt:'Привет!',answer:'ready',review:'Introducing yourself',success:'Five expressions for meeting someone. Use your own name after Меня зовут.'},
  {id:'meaning',kind:'choice',wordId:'nice',title:'A warm first meeting.',instruction:'What does Очень приятно! mean?',prompt:'Очень приятно!',choices:['Thank you!','Nice to meet you!','Goodbye!'],answer:'Nice to meet you!',review:'Очень приятно! → Nice to meet you!',success:'Exactly. Очень приятно! is a friendly “Nice to meet you!”',retryFeedback:'Think about what you say just after meeting someone. Try another meaning.',hint:'Use this to show you’re glad to meet someone, just after introductions.'},
  {id:'sentence',kind:'sentence',title:'Tell someone your name.',instruction:'Build “My name is Anna.” Use Анна as the example name.',translation:'My name is Anna.',prompt:'Меня зовут Анна.',tokens:['Анна','Меня','зовут'],answer:'Меня зовут Анна',review:'Меня зовут… → My name is…',success:'Меня зовут literally means “They call me.” Add your own name after it—no extra word for “is”.',retryFeedback:'Start with the expression for “My name is”, then put the name last.',hint:'Меня means “me”. Start there, add зовут (“call”), and finish with the name.',pronunciationGuide:'Меня́ · mee-NYA   /   зову́т · za-VOOT   /   А́нна · AN-na'},
  {id:'exchange',kind:'choice',title:'Make a small connection.',instruction:'You’ve both said your names. How do you say “Nice to meet you”?',prompt:'Меня зовут Алекс.',exchange:{speaker:'ALEX',text:'Меня зовут Алекс.',meaning:'My name is Alex.'},choices:['Пока!','Очень приятно!','А тебя?'],answer:'Очень приятно!',review:'Replying after introductions: Очень приятно!',success:'Очень приятно! is just right. You’ve already exchanged names, so there’s no need to ask again.',retryFeedback:'You know each other’s names now. Choose a reply that welcomes the new connection.',hint:'Choose the expression that says you’re pleased to meet Alex.'},
  {id:'type',kind:'typed',title:'Until next time.',instruction:'Type “Bye!” in Russian. Use the letter buttons if you need them.',translation:'Bye!',prompt:'Пока!',letters:['п','о','к','а'],pronunciationGuide:'A little hint: pa-KA',answer:'пока',review:'Пока! → Bye!',success:'Пока́! A friendly goodbye to someone you know. You’ve made your first introduction.',retryFeedback:'Check the letters and try again. Capitals and ending punctuation are optional.',hint:'Think back to the short, informal goodbye from the first step. It has four letters.'},
 ],
};
export const nativeLessons=[cafeLesson,introductionsLesson] as const;
export function lessonById(id:string|undefined){return nativeLessons.find(item=>item.id===id)??cafeLesson;}
