import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Capacitor} from '@capacitor/core';
import {createServer} from 'vite';

// Render the real runtime branch and shared lesson component, without browser
// emulation or a production-only "preview native" URL override.
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom'});
const platform=Capacitor.isNativePlatform;
const storageDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
const storage=new Map();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key)??null}});
try {
 const {PhysicalCompanionSettings,PhysicalCompanionHomeStatus,PhysicalCompanionChip}=await server.ssrLoadModule('/src/PhysicalCompanionSettings.tsx');
 const {initialBleState}=await server.ssrLoadModule('/src/bleTransport.ts');
 const {RuntimeApp}=await server.ssrLoadModule('/src/RuntimeApp.tsx');
 const {FIRST_RUN_KEY,initialFirstRun}=await server.ssrLoadModule('/src/firstRun.ts');
 const completedFirstRun={...initialFirstRun(),stage:'done',completed:true};storage.set(FIRST_RUN_KEY,JSON.stringify(completedFirstRun));
 const {useLesson}=await server.ssrLoadModule('/src/useLesson.ts');
 const {useSubscription}=await server.ssrLoadModule('/src/useSubscription.ts');
 const {PlusScreen}=await server.ssrLoadModule('/src/PlusScreen.tsx');
 const {SUBSCRIPTION_KEY}=await server.ssrLoadModule('/src/subscription.ts');
 const {useNativeStats}=await server.ssrLoadModule('/src/useNativeStats.ts');
 const {NativeProfile}=await server.ssrLoadModule('/src/NativeProfile.tsx');
 const {emptyStats}=await server.ssrLoadModule('/src/nativeStats.ts');
 const {NATIVE_STATS_KEY}=await server.ssrLoadModule('/src/statsStorage.ts');
 const {useNativeCompanion}=await server.ssrLoadModule('/src/useNativeCompanion.ts');
 const {homeGreeting} = await server.ssrLoadModule('/src/nativeCompanion.ts');
 const {COMPANION_PREFERENCE_KEY}=await server.ssrLoadModule('/src/nativeCompanion.ts');
 const {LessonPanel}=await server.ssrLoadModule('/src/LessonPanel.tsx');
 const {freshSession,NATIVE_SESSION_KEY}=await server.ssrLoadModule('/src/session.ts');
 const {lesson}=await server.ssrLoadModule('/src/lesson.ts');
 const {introductionsLesson,cafeLesson}=await server.ssrLoadModule('/src/lessons.ts');
 const {sessionKey}=await server.ssrLoadModule('/src/session.ts');
 Capacitor.isNativePlatform=()=>false;
 const website=renderToStaticMarkup(createElement(RuntimeApp));
 for(const marker of ['class="site-header wrap"','class="hero wrap"','class="lesson-phone"','class="ios-status-bar"','id="course"','id="app"','id="devices"','id="plans"','class="site-ticker"'])assert.ok(website.includes(marker),marker);
 assert.ok(!website.includes('class="native-app"'));
 const baseline=process.env.PRIVET_BROWSER_BASELINE;
 if(baseline&&existsSync(baseline)){assert.equal(website.replace('class="app-audio-note" role="status" aria-live="polite" aria-atomic="true"','class="app-audio-note"'),readFileSync(baseline,'utf8'));console.log('PASS: browser markup preserved, with accessible audio status attributes added.');}
 else console.log('PASS: browser runtime retains marketing, navigation, phone preview, lesson, and companion.');
 Capacitor.isNativePlatform=()=>true;
 storage.set(FIRST_RUN_KEY,JSON.stringify(initialFirstRun()));
 const welcome=renderToStaticMarkup(createElement(RuntimeApp));
 for(const text of ['Meet your Russian learning companion','Get started'])assert.ok(welcome.includes(text),`Phone welcome shows: ${text}`);
 assert.ok(!welcome.includes('site-header'),'Phone welcome has no website header');
 storage.set(FIRST_RUN_KEY,JSON.stringify(initialFirstRun()));Capacitor.isNativePlatform=()=>false;
 const {NativeApp}=await server.ssrLoadModule('/src/NativeApp.tsx');const browserPhone=renderToStaticMarkup(createElement(NativeApp));assert.ok(!browserPhone.includes('Get started'));assert.ok(browserPhone.includes('native-settings-open'));
 Capacitor.isNativePlatform=()=>true;
 storage.set(FIRST_RUN_KEY,JSON.stringify(completedFirstRun));
 const home=renderToStaticMarkup(createElement(RuntimeApp));
 for(const marker of ['class="native-app"','Café essentials','Show Café essentials','Your virtual companion','Have a physical companion? Let’s connect it.'])assert.ok(home.includes(marker),marker);
 for(const marker of ['site-header','class="hero','lesson-phone','ios-status-bar','dynamic-island','ios-home-area','Demo connection'])assert.ok(!home.includes(marker),marker);
 assert.ok(home.includes('Nice to meet you'));assert.ok(home.includes('02 · Nice to meet you'));
 console.log('PASS: Capacitor runtime renders app home with local lesson entry and simulated companion.');
 assert.ok(home.includes('Have a physical companion? Let’s connect it.'));assert.ok(!website.includes('native-companion-chip'));
 assert.ok(!home.includes('Physical companion settings'));assert.ok(home.includes('native-settings-open'));assert.ok(!home.includes('Reset saved lesson &amp; preferences'));
 assert.ok(!website.includes('Physical companion settings'));
 const noOp=()=>{};
 // usePhysicalCompanion() now exposes BLE state through a subscribable store
 // (useBleState/useSyncExternalStore) rather than a plain `state` field, so
 // these direct-render checks stub the same minimal shape a real controller
 // exposes instead of injecting a `state` prop directly.
 const stub=state=>({getState:()=>state,subscribe:()=>()=>{}});
 function ConnectedGreeting({definition=cafeLesson}){
  const controller=useLesson({persistSession:true,definition});
  return createElement(PhysicalCompanionChip,{controller:stub({...initialBleState(),phase:'connected',ready:true}),onOpen:noOp,greeting:homeGreeting(controller,definition.title)});
 }
 const connectedGreeting=(definition=cafeLesson)=>renderToStaticMarkup(createElement(ConnectedGreeting,{definition}));
 assert.ok(connectedGreeting().includes('Привет! Ready for a little Russian?'));
 function physical(state,remembered){return renderToStaticMarkup(createElement(PhysicalCompanionSettings,{controller:{...stub(state),scan:noOp,connect:noOp,disconnect:noOp,testHappy:noOp,remembered:()=>remembered},onClose:noOp}));}
 const disconnectedPhysical=physical(initialBleState());
 // A remembered companion: settings says it reconnects by itself; the app's own quiet look stays invisible.
 const mini={deviceId:'mini',name:'Privet-Mini'};
 assert.ok(physical(initialBleState(),mini).includes('Privet-Mini will reconnect by itself when it’s nearby.'));
 assert.ok(!disconnectedPhysical.includes('will reconnect by itself'));
 const looking=physical({...initialBleState(),phase:'scanning',quiet:true,devices:[{deviceId:'other',name:'Privet-ESP32'}]},mini);
 assert.ok(looking.includes('>Connect <')&&!looking.includes('Stop scanning')&&!looking.includes('Available companions')&&looking.includes('will reconnect by itself'));
 assert.ok(!physical({...initialBleState(),phase:'connected',ready:true},mini).includes('will reconnect by itself'));
 assert.ok(disconnectedPhysical.includes('Physical companion'));
 assert.ok(!disconnectedPhysical.includes('STAGE 1'));
 assert.ok(!disconnectedPhysical.includes('native-physical-note'));
 for(const phase of ['suspended','reconciling']){
  const checking=physical({...initialBleState(),phase,device:{deviceId:'test',name:'Privet-ESP32'}});
  assert.ok(checking.includes('>Disconnect</button>'));
  const status=renderToStaticMarkup(createElement(PhysicalCompanionHomeStatus,{controller:stub({...initialBleState(),phase}),onOpen:noOp}));
  assert.ok(!status.includes('Physical companion: Connected'));
 }
 assert.ok(!disconnectedPhysical.includes('Leaving this screen or backgrounding'));
 assert.ok(!home.includes('Physical companion: Disconnected. Open settings.'));
 for(const phase of ['disconnected','suspended','reconciling','connected']){
  const chip=renderToStaticMarkup(createElement(PhysicalCompanionChip,{controller:stub({...initialBleState(),phase,ready:phase==='connected'}),onOpen:noOp}));
  assert.equal(chip.includes('Companion connected'),phase==='connected');assert.ok(chip.includes('role="status"'));
 }
 const connectedHomeStatus=renderToStaticMarkup(createElement(PhysicalCompanionHomeStatus,{controller:stub({...initialBleState(),phase:'connected',ready:true,notice:'Companion update needed for all lesson reactions.'}),onOpen:noOp}));
 assert.ok(connectedHomeStatus.includes('Connected · Update needed'));
 assert.ok(connectedHomeStatus.includes('role="status"'));
 assert.ok(physical({...initialBleState(),phase:'connected',ready:true,notice:'Companion update needed for all lesson reactions.'}).includes('Companion update needed'));
 assert.ok(disconnectedPhysical.includes('disabled="">Test happy reaction'));
 for(const phase of ['scanning','connecting','suspended','reconciling','unavailable','permission-denied','error']){
  assert.ok(physical({...initialBleState(),phase}).includes('disabled="">Test happy reaction'));
 }
 const connectedPhysical=physical({...initialBleState(),phase:'connected',ready:true});
 assert.ok(connectedPhysical.includes('>Disconnect</button>'));
 assert.ok(!connectedPhysical.includes('disabled="">Test happy reaction'));
 assert.ok(physical({...initialBleState(),phase:'connected',ready:true,pending:true}).includes('disabled="">Sending reaction'));
 console.log('PASS: physical companion settings stay native-only; test requires subscribed connection and no pending command.');
 assert.ok(home.includes('Open your profile and statistics'));
 assert.ok(!home.includes('native-plus-open'));assert.ok(!home.includes('is-plus'));
 // Without Plus: lessons 1–3 open, lesson 4 readable and locked, 5–8 blurred behind one button (still read by VoiceOver).
 // Chapters: 1 First steps (free), 2 and 3 locked; the Up next card with its scene, the rest as rows.
 assert.ok(!home.includes('Chapter 1 · Free')&&!home.includes('Chapter 2 · Plus'),'Chapter headers show just the number');
 for(const text of ['Chapter 1','First steps','Everyday life','Making friends','Unlock chapters 2 and 3'])assert.ok(home.includes(text),text);
 // One big card at a time: a newcomer's is the recommended Cyrillic quick start, so lessons are rows.
 assert.equal((home.match(/class="home-hero[ "]/g)??[]).length,1);assert.ok(home.includes('class="home-hero home-cyrillic"'));assert.ok(home.includes('aria-label="Letter tiles spelling кофе'));
 assert.equal((home.match(/class="home-row is-locked"/g)??[]).length,5);assert.equal((home.match(/class="home-chapter is-locked"/g)??[]).length,2);
 assert.equal((home.match(/>Show [^<]+</g)??[]).length,3,'Open lesson rows grow on tap');assert.equal((home.match(/>Unlock with Plus</g)??[]).length,5,'Locked rows go to Plus instead');
 assert.ok(!home.includes('native-review-open'),'No review bar while nothing is due');
 assert.ok(home.includes('0-day learning streak'));
 function Profile(){const activity=useNativeStats();const subscription=useSubscription();return createElement(NativeProfile,{activity,subscription,onPlus:()=>{},onClose:()=>{}});}
 const emptyProfile=renderToStaticMarkup(createElement(Profile));
 assert.ok(!emptyProfile.includes('Practice days'));
 for(const marker of ['Current streak','Best streak','Lesson finishes','Today XP','Total XP','Your last seven days','Finish the lesson to see your first result here.'])assert.ok(emptyProfile.includes(marker));
 storage.set(NATIVE_STATS_KEY,JSON.stringify({...emptyStats(),days:{'2020-01-01':2},latest:{day:'2020-01-01',firstTry:4}}));
 const storedProfile=renderToStaticMarkup(createElement(Profile));
 assert.ok(storedProfile.includes('<strong>4<span>/5</span></strong>'));
 assert.ok(storedProfile.includes('January 1, 2020'));
 storage.delete(NATIVE_STATS_KEY);
 console.log('PASS: native home exposes profile/streak, and local statistics render zero and saved activity accurately.');
 function NativeLesson({settings=false}={}){const companion=useNativeCompanion();const controller=useLesson({persistSession:true,onTransition:companion.onTransition});if(settings)controller.lessonSettings=true;return createElement('div',{className:'native-app'},createElement(LessonPanel,{controller,native:true,nativeCompanion:companion,onClose:()=>{}}));}
 for(let index=0;index<lesson.length;index++){
  const s=freshSession();s.progress.index=index;s.progress.results=Array(index).fill(true);
  storage.set(NATIVE_SESSION_KEY,JSON.stringify(s));
  const html=renderToStaticMarkup(createElement(NativeLesson));
  assert.ok(html.includes(lesson[index].title));
  assert.ok(html.includes('Return to app home'));
  assert.ok(html.includes('Check answer'));
  for(const marker of ['lesson-phone','ios-status-bar','ios-island','ios-home-area','phone-hardware-key','Demo connection'])assert.ok(!html.includes(marker));
  assert.ok(!html.includes('native-companion-status'));
  assert.ok(!html.includes('native-companion-feedback')); // No large persistent lesson companion.
  const wrong={...s,progress:{...s.progress,attempts:1,feedback:'incorrect'}};
  storage.set(NATIVE_SESSION_KEY,JSON.stringify(wrong));
  const feedback=renderToStaticMarkup(createElement(NativeLesson));
  assert.ok(feedback.includes('native-companion-feedback'));
  assert.ok(feedback.includes('A little practice. You’ve got this.'));
  assert.ok(!feedback.includes('data-expression="encouraging"')); // Restoring old feedback does not replay a reaction.
 }
 console.log('PASS: all five native exercise views reuse LessonPanel without fake device chrome or answer leaks.');
 storage.clear();storage.set(FIRST_RUN_KEY,JSON.stringify(completedFirstRun));
 storage.set(NATIVE_SESSION_KEY,JSON.stringify({...freshSession(),revealed:['hi']}));
 storage.delete(FIRST_RUN_KEY);
 const partialHome=renderToStaticMarkup(createElement(RuntimeApp));
 assert.ok(partialHome.includes('Continue lesson'));
 assert.ok(connectedGreeting().includes('Shall we pick up where we left off?'));
 console.log('PASS: app home offers Continue for a saved partial lesson.');
 const completed={...freshSession(),progress:{...freshSession().progress,index:5,results:[true,false,true,true,true],complete:true}};
 storage.set(NATIVE_SESSION_KEY,JSON.stringify(completed));
 const results=renderToStaticMarkup(createElement(NativeLesson));
 assert.ok(results.includes('Replay the lesson'));
 assert.ok(results.includes('Progress saved on this iPhone.'));
 assert.ok(!results.includes('Check answer'));
 const completedHome=renderToStaticMarkup(createElement(RuntimeApp));
 // A passed lesson sits under Completed as a row with its score; tapping it shows See your results.
 assert.ok(completedHome.includes('Completed · <!-- -->1')||completedHome.includes('Completed · 1'));assert.ok(/home-row-score">\d+\/5 ✓/.test(completedHome.replace(/<!-- -->/g,'')));
 assert.ok(connectedGreeting().includes('Молодец! You finished Café essentials.'));
 assert.ok(!completedHome.includes('Practise again'));
 assert.ok(results.includes('You practised greetings, tea and coffee, ordering tea, and saying thank you.'));
 storage.set(COMPANION_PREFERENCE_KEY,'false');
 const settings=renderToStaticMarkup(createElement(NativeLesson,{settings:true}));
 assert.ok(!settings.includes('Companion reactions'));
 assert.ok(settings.includes('aria-label="Learning aids"'));
 assert.ok(!settings.includes('MAKE READING EASIER'));
 assert.ok(!settings.includes('Changes apply immediately.'));
 assert.ok(!settings.includes('native-settings-title'));
 assert.ok(!settings.includes('>Done</button>'));
 assert.equal((settings.match(/role="switch"/g)||[]).length,2);
 assert.ok(settings.includes('Reactions are turned off.'));
 assert.ok(!settings.includes('data-running="true"'));
 console.log('PASS: progress-based greetings, immediate learning-aid settings, disabled static robot, and truthful completion summary.');
 storage.clear();storage.set(FIRST_RUN_KEY,JSON.stringify(completedFirstRun));
 function SecondLesson(){const controller=useLesson({persistSession:true,definition:introductionsLesson});return createElement(LessonPanel,{controller,native:true});}
 for(const [index,exercise] of introductionsLesson.exercises.entries()){
  const snapshot={...freshSession(),progress:{...freshSession().progress,index,results:Array(index).fill(true)}};
  storage.set(sessionKey(introductionsLesson),JSON.stringify(snapshot));
  const html=renderToStaticMarkup(createElement(SecondLesson));
  assert.ok(html.includes(exercise.title));assert.ok(html.includes('Nice to meet you'));assert.ok(html.includes('Check answer'));
  assert.ok(!html.includes('Café essentials'));assert.ok(!html.includes('Ваш чай.'));
  if(index===4){assert.ok(html.includes('“Bye!”'));assert.ok(!html.includes('пока'));}
 }
 storage.set(sessionKey(introductionsLesson),JSON.stringify({...freshSession(),revealed:['name']}));
 const secondPartial=renderToStaticMarkup(createElement(RuntimeApp));
 assert.ok(secondPartial.includes('Continue lesson'));assert.ok(connectedGreeting(introductionsLesson).includes('Shall we pick up where we left off?'));
 storage.set(sessionKey(introductionsLesson),JSON.stringify(completed));
 const secondResults=renderToStaticMarkup(createElement(SecondLesson));
 assert.ok(secondResults.includes('You practised introducing yourself'));assert.ok(secondResults.includes('Очень приятно! → Nice to meet you!'));
 storage.set(sessionKey(introductionsLesson),JSON.stringify({...completed,progress:{...completed.progress,results:Array(5).fill(true)}}));
 assert.ok(renderToStaticMarkup(createElement(SecondLesson)).includes('Анна was just our example.'));
 const secondHome=renderToStaticMarkup(createElement(RuntimeApp));assert.ok(connectedGreeting(introductionsLesson).includes('Молодец! You finished Nice to meet you.'));
 storage.set(NATIVE_STATS_KEY,JSON.stringify({...emptyStats(),days:{'2020-01-01':1},latest:{day:'2020-01-01',firstTry:5,lessonId:'introductions'}}));
 assert.ok(renderToStaticMarkup(createElement(Profile)).includes('<h2 id="native-result-title">Nice to meet you</h2>'));
 console.log('PASS: second lesson renders all five exercises, separate progress/results, matching greeting and profile title.');
 for(const definition of (await server.ssrLoadModule('/src/curriculum/catalog.ts')).nativeLessons){
  function CurriculumLesson({help=true}={}){const controller=useLesson({persistSession:true,definition});controller.preferences={...controller.preferences,pronunciation:help};return createElement(LessonPanel,{controller,native:true});}
  for(const [index,exercise] of definition.exercises.entries()){
   storage.set(sessionKey(definition),JSON.stringify({...freshSession(),progress:{...freshSession().progress,index,results:Array(index).fill(true)}}));
   const html=renderToStaticMarkup(createElement(CurriculumLesson));assert.ok(html.includes(exercise.title));assert.ok(html.includes(definition.title));assert.ok(html.includes('Open Cyrillic guide'));
   // Listening hides option readings until answered: they would give away the sound.
   const readingCount=exercise.kind==='listen'?0:(exercise.choices??[]).filter(choice=>/[а-яё]/iu.test(choice)).length+(exercise.exchange?1:0)+(exercise.pairs?.length??0);
   assert.equal((html.match(/class="native-russian-reading"/g)??[]).length,readingCount,`${definition.id}/${exercise.id}: all visible Russian options/dialogue have readings`);
   const withoutHelp=renderToStaticMarkup(createElement(CurriculumLesson,{help:false}));assert.ok(!withoutHelp.includes('native-russian-reading'));

  }
  for(const [index,exercise] of definition.exercises.entries()){
   const at=(extra={})=>{storage.set(sessionKey(definition),JSON.stringify({...freshSession(),progress:{...freshSession().progress,index,results:Array(index).fill(true)},...extra}));return renderToStaticMarkup(createElement(CurriculumLesson));};
   if(exercise.kind==='listen'){
    // No speech synthesis in this shell: the written sound guide replaces audio, and the word itself is never printed as a prompt.
    const html=at(),word=definition.words.find(w=>w.id===exercise.wordId);
    assert.ok(html.includes('Audio isn’t available. Read how it sounds:')&&html.includes(word.pronunciation),`${definition.id}/${exercise.id}: no-voice fallback`);
    assert.ok(!html.includes('question-word')&&!html.includes('listen-play'));assert.equal((html.match(/class="choice /g)??[]).length,exercise.choices.length);
    const answered=at({selected:exercise.answer,progress:{...freshSession().progress,index,results:Array(index).fill(true),attempts:1,feedback:'correct'}});
    assert.equal((answered.match(/class="native-russian-reading"/g)??[]).length,exercise.choices.length,'readings return once answered');
   }
   if(exercise.kind==='match'){
    const html=at({matches:[exercise.pairs[1][0]]});
    assert.equal((html.match(/class="match-item /g)??[]).length,exercise.pairs.length*2);
    assert.equal((html.match(/class="match-item matched/g)??[]).length,2,'a restored pair stays locked on both sides');
    const english=[...html.matchAll(/<button class="match-item [^"]*"[^>]*>([^<]+)<\/button>/g)].map(m=>m[1].replaceAll('&#x27;','’'));
    assert.deepEqual(english,[...exercise.pairs].sort((a,b)=>a[1].localeCompare(b[1],'en',{sensitivity:'base'})).map(p=>p[1]),'English column uses the fixed scramble');
   }
  }
  storage.set(NATIVE_STATS_KEY,JSON.stringify({...emptyStats(),days:{'2020-01-01':1},latest:{day:'2020-01-01',firstTry:5,lessonId:definition.id}}));
  assert.ok(renderToStaticMarkup(createElement(Profile)).includes(`<h2 id="native-result-title">${definition.title}</h2>`));
 }
 console.log('PASS: all eight curriculum lessons render every exercise/Cyrillic entry and correct profile result title.');
 console.log('PASS: listen questions fall back to a written sound guide without a voice and hide option readings until answered; match pairs render both columns, restored locks and a fixed English scramble.');
 Capacitor.isNativePlatform=()=>false;
 const unchangedWebsite=renderToStaticMarkup(createElement(RuntimeApp));
 assert.ok(unchangedWebsite.includes('STEP 1 OF 5'));
 // The demo itself stays the café lesson; other lessons appear only in the course overview.
 const demo=unchangedWebsite.slice(unchangedWebsite.indexOf('id="demo"'),unchangedWebsite.indexOf('id="course"'));assert.ok(demo.includes('Café essentials'));assert.ok(!demo.includes('Nice to meet you'));assert.ok(unchangedWebsite.includes('Nice to meet you'));

 for(const html of [website,home]){
  assert.ok(!html.includes('Duolingo'));assert.ok(!html.includes('comparison-table'));assert.ok(!html.includes('native-compare'));assert.ok(!html.includes('href="#why"'));
 }
 for(const text of ['−20','Refill your hearts','−30','A streak freeze for a missed day','$4.99','$39.99','$59.99','Concept pricing · no checkout','Lifetime Privet Plus included','Planned'])assert.ok(website.includes(text),text);
 assert.ok(website.includes('The robots on this page are simulated'));assert.ok(website.includes('class="companion-gallery"'));assert.ok(!website.includes('id="companion"'));assert.ok(website.includes('Working prototype'));assert.ok(website.includes('Privet body is a concept'));assert.ok(!/iprint/i.test(website));
 // The website footer links the Support and Privacy pages published from public/.
 assert.ok(website.includes('href="support.html">Support</a>'));assert.ok(website.includes('href="privacy.html">Privacy Policy</a>'));assert.ok(website.includes('Independent app'));
 function Plus(){const subscription=useSubscription();return createElement(PlusScreen,{subscription,onClose:()=>{}});}
 storage.clear();storage.set(FIRST_RUN_KEY,JSON.stringify(completedFirstRun));const offer=renderToStaticMarkup(createElement(Plus));const lessonCount=(await server.ssrLoadModule('/src/curriculum/catalog.ts')).nativeLessons.length;for(const text of [`All ${lessonCount} lessons, and every new one`,'Unlimited hearts','$39.99 / year','$3.33 / month','$4.99 / month','Best value','Continue · $39.99/year','Renews automatically until cancelled','Restore','Terms of Use','Privacy Policy','Browser preview · No payment'])assert.ok(offer.includes(text),text);assert.ok(offer.indexOf('Yearly')<offer.indexOf('Monthly'),'Yearly is listed (and chosen) first');assert.ok(/role="radio" aria-checked="true"[^>]*><span class="plus-plan-name">Yearly/.test(offer),'Yearly starts selected');assert.ok(!offer.includes('Concept pricing'));
 storage.set(SUBSCRIPTION_KEY,JSON.stringify({version:1,plan:'monthly',since:'2026-10-18'}));
 const active=renderToStaticMarkup(createElement(Plus));assert.ok(active.includes('Plus is active'));assert.ok(active.includes('Monthly'));assert.ok(active.includes('Cancel Plus demo'));assert.ok(!active.includes('plus-buy'));assert.ok(renderToStaticMarkup(createElement(Profile)).includes('Manage Plus'));
 Capacitor.isNativePlatform=()=>true;
 const plusHome=renderToStaticMarkup(createElement(RuntimeApp));assert.ok(plusHome.includes('native-profile-open is-plus'));assert.ok(plusHome.includes('Plus active'));assert.ok(!plusHome.includes('native-plus-open'));assert.ok(!plusHome.includes('native-locked-group'));assert.ok(!plusHome.includes('is-locked'));
 const plusProfile=renderToStaticMarkup(createElement(Profile));assert.ok(plusProfile.includes('native-profile-avatar is-plus'));assert.ok(plusProfile.includes('native-profile-plus-tag'));
 Capacitor.isNativePlatform=()=>false;
 storage.clear();storage.set(FIRST_RUN_KEY,JSON.stringify(completedFirstRun));assert.ok(renderToStaticMarkup(createElement(Profile)).includes('Get Plus'));
 console.log('PASS: own-feature descriptions replace comparisons, prices/hardware states are accurate, and the Plus paywall and active plan render (browser demo store).');
 console.log('PASS: native completion/replay and saved results render; browser sessions still start fresh.');
 const {NativeAlphabetGuide,NativeCyrillicQuickStart,CyrillicExample}=await server.ssrLoadModule('/src/NativeCyrillic.tsx');
 const {CYRILLIC,targetLetterParts}=await server.ssrLoadModule('/src/cyrillic.ts');
 for(const item of CYRILLIC){
  const example=renderToStaticMarkup(createElement(CyrillicExample,{example:item.example,target:item.lower}));
  const parts=targetLetterParts(item.example,item.lower);
  assert.equal(example,`<span class="native-letter-example" lang="ru"><span aria-hidden="true">${parts.before}<strong class="native-target-letter">${parts.target}</strong>${parts.after}</span><span class="native-sr-only">${item.example}</span></span>`,'Visual emphasis is hidden from assistive technology, which gets one complete Russian word');
 }
 const {useCyrillicProgress}=await server.ssrLoadModule('/src/useCyrillicProgress.ts');
 const {CYRILLIC_KEY}=await server.ssrLoadModule('/src/cyrillicProgress.ts');
 assert.ok(home.includes('Cyrillic quick start'));assert.ok(home.includes('Recommended · About 3 min'));
 for(const [status,page,action] of [['skipped',0,'Open'],['started',1,'Continue'],['completed',3,'Review']]){
  storage.set(CYRILLIC_KEY,JSON.stringify({version:1,status,page}));Capacitor.isNativePlatform=()=>true;const compactHome=renderToStaticMarkup(createElement(RuntimeApp));assert.ok(compactHome.includes('home-row home-cyrillic'));assert.ok(compactHome.includes(`${action} Cyrillic quick start`));assert.ok(!compactHome.includes('Skip for now'));assert.ok(!compactHome.includes('Recommended · About 3 min'));assert.ok(compactHome.includes('Up next · Chapter 1'),'Without the recommendation, the lesson up next is the big card');
 }Capacitor.isNativePlatform=()=>false;
 assert.ok(!website.includes('home-cyrillic'));assert.ok(!website.includes('Open Cyrillic guide'));
 storage.clear();storage.set(FIRST_RUN_KEY,JSON.stringify(completedFirstRun));
 function QuickStart(){const onboarding=useCyrillicProgress();const controller=useLesson();return createElement(NativeCyrillicQuickStart,{onboarding,speech:controller.speech,onClose:noOp,onLesson:noOp});}
 for(const [status,page] of [['started',0],['started',1],['started',2],['started',3],['completed',3]]){
  storage.set(CYRILLIC_KEY,JSON.stringify({version:1,status,page}));
  const quick=renderToStaticMarkup(createElement(QuickStart));assert.ok(quick.includes('Cyrillic quick start'));assert.ok(!quick.includes('lesson-vitals'));assert.ok(!quick.includes('XP earned'));assert.ok(quick.includes('native-example-reading'));assert.ok(quick.includes(page===3&&status!=='completed'?'KO-fe':page===1?'vash':page===2?'pri-VET':'AN-na'));
 }
 function Guide(){const controller=useLesson();return createElement(NativeAlphabetGuide,{definition:controller.definition,exercise:controller.exercise,speech:controller.speech,onListen:noOp,onClose:noOp});}
 const guide=renderToStaticMarkup(createElement(Guide));assert.ok(guide.includes('Cyrillic guide'));assert.ok(guide.includes('Current exercise'));assert.ok(guide.includes('See full alphabet'));assert.ok(guide.includes('Russian audio unavailable'));assert.ok(guide.includes('native-example-reading'));assert.ok(!website.includes('native-russian-reading'));assert.ok(!website.includes('native-example-reading'));
 storage.clear();storage.set(FIRST_RUN_KEY,JSON.stringify(completedFirstRun));console.log('PASS: native-only optional Cyrillic card/pages and contextual guide render with accessible text/audio fallback; website excludes them.');


}finally{
 Capacitor.isNativePlatform=platform;
 if(storageDescriptor)Object.defineProperty(globalThis,'localStorage',storageDescriptor);else Reflect.deleteProperty(globalThis,'localStorage');
 await server.close();
}
