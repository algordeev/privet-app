import type {LessonDefinition} from './lessons.ts';
export const firstRunLesson:LessonDefinition={
 id:'welcome-cafe',number:'01',title:'Your first café order',icon:'☕',description:'A coffee, a please, and a little confidence.',
 summary:'You recognized кофе, used пожалуйста, ordered a coffee and said thank you.',completionTip:'Кофе, пожалуйста. Two words you can use on your next café visit.',
 words:[
  {id:'coffee',text:'кофе',stressed:'ко́фе',meaning:'coffee',pronunciation:'KO-fyeh'},
  {id:'please',text:'пожалуйста',stressed:'пожа́луйста',meaning:'please',pronunciation:'pa-ZHA-lu-sta'},
  {id:'thanks',text:'Спасибо!',stressed:'Спаси́бо!',meaning:'Thank you!',pronunciation:'spa-SEE-ba'},
 ],
 exercises:[
  {id:'discover',kind:'vocabulary',title:'Your café essentials.',instruction:'',prompt:'кофе',answer:'ready',review:'Café essentials',success:'Coffee, please, and thank you. A small beginning.'},
  {id:'recognize',kind:'choice',wordId:'coffee',title:'Something familiar.',instruction:'What does кофе mean?',prompt:'кофе',choices:['tea','coffee','water'],answer:'coffee',review:'кофе → coffee',success:'Exactly. Кофе means coffee.',hint:'This word sounds almost the same in many languages.',retryFeedback:'Try saying the word aloud, then choose another meaning.'},
  {id:'please',kind:'choice',wordId:'please',title:'A little politeness.',instruction:'What does пожалуйста mean when you order?',prompt:'пожалуйста',choices:['hello','please','goodbye'],answer:'please',review:'пожалуйста → please',success:'Пожалуйста makes your order a little warmer.',hint:'Think of the polite word you add when asking for something.',retryFeedback:'You are asking politely for a drink. Try another meaning.'},
  {id:'order',kind:'sentence',title:'Order your first coffee.',instruction:'Build “Coffee, please.” Tap words or drag them into order.',translation:'Coffee, please.',prompt:'Кофе, пожалуйста.',tokens:['пожалуйста','Кофе,'],answer:'Кофе, пожалуйста',review:'Кофе, пожалуйста. → Coffee, please.',success:'Кофе, пожалуйста. You just placed an order.',hint:'Start with what you want, then add the polite word.',pronunciationGuide:'Ко́фе · KO-fyeh / пожа́луйста · pa-ZHA-lu-sta'},
  {id:'exchange',kind:'choice',title:'A small conversation.',instruction:'Your coffee has arrived. What do you say?',prompt:'Ваш кофе.',exchange:{speaker:'BARISTA',text:'Ваш кофе.',meaning:'Here is your coffee.'},choices:['Привет!','Спасибо!','Пока!'],answer:'Спасибо!',review:'Спасибо! → Thank you!',success:'Спасибо! Your first café conversation is complete.',hint:'Choose the expression for thanking someone.',retryFeedback:'Your order has arrived. Choose a friendly thank you.'},
 ],
};
