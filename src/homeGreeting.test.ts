import test from 'node:test';
import assert from 'node:assert/strict';
import {CONNECT_PROMPT,homeGreeting,learnedWord,type GreetingFacts} from './homeGreeting.ts';
import {emptyReview} from './review.ts';

// A quiet afternoon with nothing to report.
const base:GreetingFacts={hour:14,today:'2026-11-23',streak:0,practisedToday:false,due:0,midLesson:false,connect:false,quickStartUnseen:false,anyPassed:true,freezes:0};
const say=(facts:Partial<GreetingFacts>)=>homeGreeting({...base,...facts});

test('home greeting: the most important message wins, in the approved order',()=>{
 const all:Partial<GreetingFacts>={tap:'I’m here for the little wins.',note:'Your Mini: 2 reviewed, 1 known. Nice work!',hour:19,streak:4,due:3,finished:{title:'At the shop'},quickStartUnseen:true,anyPassed:false,freezes:1};
 assert.equal(say(all).kind,'tap');
 assert.equal(say({...all,tap:undefined}).kind,'note');
 assert.deepEqual(say({...all,tap:undefined,note:undefined}),{kind:'streak',text:'Your 4-day streak needs a lesson today.'});
 assert.deepEqual(say({...all,tap:undefined,note:undefined,hour:17}),{kind:'review',text:'Привет! 3 to review today. Shall we?'});
 // Mid-lesson beats reviews.
 assert.equal(say({due:3,midLesson:true}).text,'Shall we pick up where we left off?');
 assert.equal(say({finished:{title:'At the shop',next:'Your day'}}).text,'Молодец! You finished At the shop. Next up: Your day.');
 assert.equal(say({finished:{title:'Around town',chapter:1}}).text,'Chapter 1 done. Nice!');
});
test('home greeting: the streak line only from 18:00, only for a live streak not yet practised today',()=>{
 assert.equal(say({hour:18,streak:2}).kind,'streak');
 assert.notEqual(say({hour:17,streak:2}).kind,'streak');
 assert.notEqual(say({hour:20,streak:2,practisedToday:true}).kind,'streak');
 assert.notEqual(say({hour:20,streak:0}).kind,'streak');
});
test('home greeting: once its beat has come, the connect prompt replaces everything but a tap reply or the Mini note',()=>{
 assert.deepEqual(say({connect:true}),{kind:'connect',text:CONNECT_PROMPT});
 for(const busy of [{due:2},{midLesson:true},{hour:20,streak:3},{finished:{title:'Café essentials'}},{quickStartUnseen:true,anyPassed:false}])assert.equal(say({...busy,connect:true}).kind,'connect');
 assert.equal(say({connect:true,tap:'One small step is a good start.'}).kind,'tap');
 assert.equal(say({connect:true,note:'Your Mini: 2 reviewed, 1 known. Nice work!'}).kind,'note');
});
test('home greeting: the quick start nudge for newcomers, then freeze and word lines one day in three, else the time of day',()=>{
 assert.equal(say({quickStartUnseen:true,anyPassed:false}).text,'New to Cyrillic? Try the quick start.');
 assert.notEqual(say({quickStartUnseen:true,anyPassed:true}).kind,'quick-start');
 const word={text:'чай',meaning:'tea'};
 // Three days in a row cover the three slots once each.
 const kinds=['2026-11-23','2026-11-24','2026-11-25'].map(today=>say({today,freezes:1,word}).kind).sort();
 assert.deepEqual(kinds,['freeze','hello','word']);
 const wordDay=['2026-11-23','2026-11-24','2026-11-25'].find(today=>say({today,freezes:1,word}).kind==='word')!;
 assert.equal(say({today:wordDay,word}).text,'Remember чай? It means tea.');
 // No freeze or word: the slot falls back to the greeting.
 for(const today of ['2026-11-23','2026-11-24','2026-11-25'])assert.equal(say({today}).kind,'hello');
 assert.equal(say({hour:8,today:wordDay,word:undefined}).text,'Good morning! Ready for a little Russian?');
 assert.equal(say({hour:13,today:wordDay,word:undefined}).text,'Good afternoon! Ready for a little Russian?');
 assert.equal(say({hour:22,today:wordDay,word:undefined}).text,'Good evening! Ready for a little Russian?');
 assert.equal(say({hour:2,today:wordDay,word:undefined}).text,'Good evening! Ready for a little Russian?');
});
test('learned word: single plain words only, weak ones first; none before anything is learned',()=>{
 assert.equal(learnedWord(emptyReview(),'2026-11-23'),undefined);
 const review={...emptyReview(),items:{
  'cafe/w/tea':{box:4,due:'2026-12-30',lapses:0,reviews:5},
  'cafe/w/coffee':{box:0,due:'2026-11-20',lapses:1,reviews:1},
 }};
 for(const day of ['2026-11-23','2026-11-24'])assert.equal(learnedWord(review,day)?.text,'кофе');
 // Phrases with punctuation or spaces are never picked.
 const phrases={...emptyReview(),items:{'shopping/w/price':{box:0,due:'2026-11-20',lapses:0,reviews:1}}};
 assert.equal(learnedWord(phrases,'2026-11-23'),undefined);
});
