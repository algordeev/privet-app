export type Word = { id: string; text: string; stressed: string; pronunciation: string; meaning: string };
export const words: Word[] = [
  { id:'hi', text:'Привет!', stressed:'Приве́т!', pronunciation:'pree-VYET', meaning:'Hi!' },
  { id:'tea', text:'чай', stressed:'чай', pronunciation:'chai', meaning:'tea' },
  { id:'coffee', text:'кофе', stressed:'ко́фе', pronunciation:'KO-fyeh', meaning:'coffee' },
  { id:'want', text:'Я хочу чай.', stressed:'Я хочу́ чай.', pronunciation:'ya kha-CHOO chai', meaning:'I want tea.' },
  { id:'thanks', text:'Спасибо!', stressed:'Спаси́бо!', pronunciation:'spa-SEE-ba', meaning:'Thank you!' },
];
export const lesson = [
 { id:'discover', kind:'vocabulary', title:'A few words go a long way.', instruction:'Meet your café essentials. Tap each card to reveal its meaning.', prompt:'Привет!', answer:'ready', review:'Café essentials', success:'Five useful expressions, ready for your first café visit.' },
 { id:'meaning', kind:'choice', title:'What’s in your cup?', instruction:'Choose the meaning of кофе.', prompt:'кофе', choices:['tea','coffee','water'], answer:'coffee', review:'кофе → coffee', success:'Exactly! Кофе means coffee.', retryFeedback:'Not quite. Think back to the café words and choose another meaning.', hint:'This word sounds almost the same in many languages. Try saying it aloud.' },
 { id:'sentence', kind:'sentence', title:'Your first café order.', instruction:'Tap the words in order to say “I want tea.”', prompt:'Я хочу чай.', tokens:['чай','Я','хочу'], answer:'Я хочу чай', review:'Я хочу чай. → I want tea.', success:'You’ve got it. Я (I) + хочу (want) + чай (tea).', retryFeedback:'Almost. Try a different word order, then check again.', hint:'Start with Я (I), then хочу (want), then чай (tea).' },
 { id:'exchange', kind:'choice', title:'A little café conversation.', instruction:'The barista hands you your tea. What do you say?', prompt:'Ваш чай.', choices:['Спасибо!','Привет!','Я хочу чай.'], answer:'Спасибо!', review:'Спасибо! → Thank you!', success:'A lovely reply. Спасибо! means “Thank you!”', retryFeedback:'Not quite. Your drink has arrived—choose a reply for that moment.', hint:'Your order is here! Say Спасибо! to thank the barista.' },
 { id:'type', kind:'typed', title:'One last thank you.', instruction:'Type “Thank you!” in Russian. You can use the letter buttons below.', prompt:'Спасибо!', answer:'спасибо', review:'Writing спасибо', success:'Спаси́бо! You’re ready to make a small connection in Russian.', retryFeedback:'Not quite. Check the letters and try again. Capitalization and ending punctuation are optional.', hint:'Think back to the expression you used when the barista handed you your tea.' },
] as const;
