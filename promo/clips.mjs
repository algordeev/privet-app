// The app sessions the promo films. Each clip starts from a fresh launch with a seeded learner:
// a six-day streak, gems, Lesson 02 passed, the Cyrillic quick start done and review words due.
// The fake devices are remembered, so the app reconnects to them by itself on launch.
const KEY='privet-demo-v1';
const day=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

function learner({mini=false}={}){
 const days={},xp={};
 [[-6,1,18],[-5,2,31],[-4,1,16],[-3,1,22],[-2,2,34],[-1,1,19]].forEach(([o,n,x])=>{days[day(o)]=n;xp[day(o)]=x;});
 const due=day(0),later=day(4);
 const items={};
 for(const [key,when,box] of [['cafe/w/tea',due,1],['cafe/w/coffee',due,0],['cafe/w/thanks',due,2],['introductions/w/hello',due,1],['introductions/w/bye',due,1],['introductions/w/name',later,3]])items[key]={box,due:when,lapses:box?0:1,reviews:box+1};
 const seed={
  [`${KEY}-native-stats`]:{version:3,days,xp,earlierFinishes:0,latest:{day:day(-1),firstTry:5,lessonId:'introductions'},gems:{balance:45,freezes:1,awarded:{},milestones:[],awards:{}},frozen:[]},
  [`${KEY}-introductions`]:{preferences:{stress:true,pronunciation:true},bestFirstTry:5,completion:{results:[true,true,true,true,true],date:new Date(Date.now()-864e5).toISOString(),hearts:3,bestCombo:5}},
  [`${KEY}-cyrillic-quick-start`]:{version:1,status:'completed',page:3},
  [`${KEY}-native-review`]:{version:1,items,log:[]},
  [`${KEY}-first-run`]:{version:1,stage:'done',reason:'Travel',level:'New to Russian',completed:true,replay:false,choice:'free'},
  [`${KEY}-ble-used`]:'1',
  [`${KEY}-companion-device`]:{deviceId:'promo-companion',name:mini?'Privet-Mini':'Privet-ESP32'},
  [`${KEY}-printer-device`]:{deviceId:'promo-printer',name:'SC03h'},
 };
 if(mini)seed['promo-mini']='1';
 return seed;
}

export const clips={
 // Home, then into the café lesson: reveal words, print спасибо, answer right, miss one, finish.
 lesson:{seed:()=>learner(),async run({hold,tap,scroll,type,js,step}){
  await hold(2.4);
  await tap('Start lesson');await hold(1.4);
  await tap('Привет!');await hold(.7);
  await tap('чай');await hold(.5);
  await tap('кофе');await hold(.5);
  await scroll(220);await tap('Спасибо!');await hold(1);
  await tap('Print a card for Thank you!');await hold(2.2);
  await tap('Print →',{exact:true});await hold(3.2);
  await tap('Close Word card');await hold(1.6);
  await tap('Я хочу');await hold(.6);
  await tap('Check answer');await hold(1.6);
  await tap('Continue');await hold(1);
  await tap('2coffee',{exact:true});await hold(.5);await tap('Check answer');await hold(2.2);
  await tap('Continue');await hold(1);
  // Sentence: one wrong order first (ENCOURAGE), then the right one (HAPPY).
  await tap('чай',{exact:true});await tap('Я',{exact:true});await tap('хочу',{exact:true});await hold(.4);await tap('Check answer');await hold(2.4);
  await tap('Try again');await hold(.8);
  for(const word of ['Remove хочу','Remove Я','Remove чай'])if(await js(`[...document.querySelectorAll('button')].some(b=>b.offsetParent&&!b.disabled&&b.getAttribute('aria-label')===${JSON.stringify(word)})`))await tap(word,{exact:true});await hold(.3);
  await tap('Я',{exact:true});await tap('хочу',{exact:true});await tap('чай',{exact:true});await hold(.3);await tap('Check answer');await hold(2.2);
  await tap('Continue');await hold(1);
  await tap('1Спасибо!',{});await hold(.4);await tap('Check answer');await hold(2);
  await tap('Continue');await hold(1);
  await type('Спасибо');await hold(.4);await tap('Check answer');await hold(2);
  await tap('Continue');await hold(4.5);
  await hold(3);
 }},
 // Home with the Mini connected: today's review words are on it.
 mini:{seed:()=>learner({mini:true}),settle:3500,async run({hold}){await hold(4);}},
};
