// What the website says about the app, devices and plans. Built from the app's own catalogue, prices
// and gem rules, so the site can't drift from what the app does.
import {nativeLessons} from './curriculum/catalog.ts';
import type {Exercise} from './curriculum/types.ts';
import {COMPANION_PRICE,PLUS_MONTHLY_PRICE,PLUS_YEARLY_PRICE} from './subscription.ts';
import {GEM_RULES} from './gems.ts';

export const EXERCISE_KINDS:Record<Exercise['kind'],{label:string;example:string}>={
 vocabulary:{label:'Reveal new words',example:'Tap a card to see what it means and hear it.'},
 choice:{label:'Pick the meaning',example:'Choose the reply that fits.'},
 sentence:{label:'Build a sentence',example:'Tap the words into the right order.'},
 typed:{label:'Type it',example:'Write the Russian yourself.'},
 listen:{label:'Listen and choose',example:'Hear a line, find what was said.'},
 match:{label:'Match the pairs',example:'Pair each Russian word with its meaning.'},
};

export const siteLessons=nativeLessons.map(lesson=>({
 id:lesson.id,number:lesson.number,title:lesson.title,description:lesson.description,
 words:lesson.words.length,steps:lesson.exercises.length,
 kinds:[...new Set(lesson.exercises.map(exercise=>exercise.kind))],
}));
export const courseWords=nativeLessons.reduce((sum,lesson)=>sum+lesson.words.length,0);

const price=(text:string)=>Number(text.replace(/[^0-9.]/g,''));
// Annual against twelve monthly payments, in whole percent.
export const annualSaving=Math.round((1-price(PLUS_YEARLY_PRICE)/(price(PLUS_MONTHLY_PRICE)*12))*100);

export type SiteDevice={id:'desk'|'mini'|'printer';name:string;kind:string;line:string;features:string[];parts:string;status:string;concept:string};
export const siteDevices:SiteDevice[]=[
 {id:'desk',name:'Desk companion',kind:'ESP32 robot',line:'A face that reacts to every answer, and a head that moves with it.',
  features:['Happy, thinking, encouraging and celebrating faces as you learn','Head gestures for each emotion','Shows the word you just learned on its screen','Little sounds, and it notices touch, a shake or being picked up'],
  parts:'ESP32-S3 · 1.3″ OLED · two servos · speaker',status:'Working prototype',concept:'Enclosure is a concept'},
 {id:'mini',name:'Privet Mini',kind:'Keychain',line:'A pocket review deck that quizzes you away from the phone.',
  features:['Carries today’s due review words, up to 20','Flip, then “knew it” or “didn’t”: answers sync back on the next connection','Flashcards of the last words you learned','Eyes follow its tilt; it sleeps when the phone is away'],
  parts:'XIAO ESP32-S3 · 0.96″ OLED · two buttons · buzzer',status:'Working prototype',concept:'Enclosure is a concept'},
 {id:'printer',name:'Printer',kind:'57 mm thermal',line:'Small paper things to stick on the fridge: no ink, no cables.',
  features:['A word of the day card with an example from its lesson','Practice strips after a lesson or a review, with upside-down answers','A progress receipt: streak, new words, accuracy and weekly XP','Prints while a companion is connected too'],
  parts:'Any SC03h-type 57 mm Bluetooth printer',status:'Works with an SC03h today',concept:'Privet body is a concept'},
];

export type SitePlan={id:'free'|'plus'|'companion';name:string;price:string;per:string;line:string;features:{text:string;planned?:boolean}[]};
export const sitePlans:SitePlan[]=[
 {id:'free',name:'Free',price:'$0',per:'always',line:'The whole course, as it is today.',
  features:[{text:`All ${nativeLessons.length} lessons and review`},{text:'Cyrillic quick start and АБВ guide'},{text:'Virtual companion'},{text:'Three hearts per lesson'}]},
 {id:'plus',name:'Privet Plus',price:PLUS_MONTHLY_PRICE,per:'month',line:'More room to grow.',
  features:[{text:'Unlimited hearts'},{text:'Full course and practice access',planned:true},{text:'Advanced progress insights',planned:true}]},
 {id:'companion',name:'Companion bundle',price:COMPANION_PRICE,per:'one time',line:'A learning companion to call your own.',
  features:[{text:'The desk companion'},{text:'Lifetime Privet Plus included'},{text:'Expressive face, head movement, Bluetooth reactions'}]},
];
export const plusYearly={price:PLUS_YEARLY_PRICE,per:'year',saving:annualSaving};

export const gemRules=[
 {amount:`+${GEM_RULES.finish}`,text:'Finish a lesson (once per lesson a day)'},
 {amount:`+${GEM_RULES.perfect}`,text:'Every step right on the first try'},
 {amount:`+${GEM_RULES.streakWeek}`,text:'Each full week of streak'},
 {amount:`−${GEM_RULES.refill}`,text:'Refill your hearts'},
 {amount:`−${GEM_RULES.freeze}`,text:'A streak freeze for a missed day'},
];

export const roadmap=[
 {label:'Web concept',state:'done'},
 {label:'iOS app',state:'done'},
 {label:'Robot, Mini & printer',state:'done'},
 {label:'Enclosures & polish',state:'current'},
 {label:'Learner pilot',state:'next'},
] as const;

export const ticker=[`${nativeLessons.length} lessons`,'33 letters',`${Object.keys(EXERCISE_KINDS).length} kinds of exercise`,'Review that remembers your mistakes','3 Bluetooth devices','No account','No ads','Gems can’t be bought'];
