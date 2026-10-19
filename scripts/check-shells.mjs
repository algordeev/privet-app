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
 const {PhysicalCompanionSettings,PhysicalCompanionHomeStatus}=await server.ssrLoadModule('/src/PhysicalCompanionSettings.tsx');
 const {initialBleState}=await server.ssrLoadModule('/src/bleTransport.ts');
 const {RuntimeApp}=await server.ssrLoadModule('/src/RuntimeApp.tsx');
 const {useLesson}=await server.ssrLoadModule('/src/useLesson.ts');
 const {useSubscription}=await server.ssrLoadModule('/src/useSubscription.ts');
 const {PlusScreen}=await server.ssrLoadModule('/src/PlusScreen.tsx');
 const {SUBSCRIPTION_KEY}=await server.ssrLoadModule('/src/subscription.ts');
 const {useNativeStats}=await server.ssrLoadModule('/src/useNativeStats.ts');
 const {NativeProfile}=await server.ssrLoadModule('/src/NativeProfile.tsx');
 const {NATIVE_STATS_KEY}=await server.ssrLoadModule('/src/nativeStats.ts');
 const {useNativeCompanion}=await server.ssrLoadModule('/src/useNativeCompanion.ts');
 const {COMPANION_PREFERENCE_KEY}=await server.ssrLoadModule('/src/nativeCompanion.ts');
 const {LessonPanel}=await server.ssrLoadModule('/src/LessonPanel.tsx');
 const {freshSession,NATIVE_SESSION_KEY}=await server.ssrLoadModule('/src/session.ts');
 const {lesson}=await server.ssrLoadModule('/src/lesson.ts');
 const {introductionsLesson}=await server.ssrLoadModule('/src/lessons.ts');
 const {sessionKey}=await server.ssrLoadModule('/src/session.ts');
 Capacitor.isNativePlatform=()=>false;
 const website=renderToStaticMarkup(createElement(RuntimeApp));
 for(const marker of ['class="site-header wrap"','class="hero wrap"','class="lesson-phone"','class="ios-status-bar"','id="companion"'])assert.ok(website.includes(marker),marker);
 assert.ok(!website.includes('class="native-app"'));
 const baseline=process.env.PRIVET_BROWSER_BASELINE;
 if(baseline&&existsSync(baseline)){assert.equal(website.replace('class="app-audio-note" role="status" aria-live="polite" aria-atomic="true"','class="app-audio-note"'),readFileSync(baseline,'utf8'));console.log('PASS: browser markup preserved, with accessible audio status attributes added.');}
 else console.log('PASS: browser runtime retains marketing, navigation, phone preview, lesson, and companion.');
 Capacitor.isNativePlatform=()=>true;
 const home=renderToStaticMarkup(createElement(RuntimeApp));
 for(const marker of ['class="native-app"','Café essentials','Start lesson','Your virtual companion','Привет! Ready for a little Russian?'])assert.ok(home.includes(marker),marker);
 for(const marker of ['site-header','class="hero','lesson-phone','ios-status-bar','dynamic-island','ios-home-area','Demo connection'])assert.ok(!home.includes(marker),marker);
 assert.ok(home.includes('Nice to meet you'));assert.ok(home.includes('LESSON 02'));
 console.log('PASS: Capacitor runtime renders app home with local lesson entry and simulated companion.');
 assert.ok(home.includes('Physical companion settings'));
 assert.ok(!website.includes('Physical companion settings'));
 const noOp=()=>{};
 function physical(state){return renderToStaticMarkup(createElement(PhysicalCompanionSettings,{controller:{state,scan:noOp,connect:noOp,disconnect:noOp,testHappy:noOp},onClose:noOp}));}
 const disconnectedPhysical=physical(initialBleState());
 assert.ok(disconnectedPhysical.includes('Physical companion'));
 assert.ok(!disconnectedPhysical.includes('STAGE 1'));
 assert.ok(disconnectedPhysical.includes('An established connection can stay while your phone is locked.'));
 for(const phase of ['suspended','reconciling']){
  const checking=physical({...initialBleState(),phase,device:{deviceId:'test',name:'Privet-ESP32'}});
  assert.ok(checking.includes('>Disconnect</button>'));
  const status=renderToStaticMarkup(createElement(PhysicalCompanionHomeStatus,{state:{...initialBleState(),phase},onOpen:noOp}));
  assert.ok(!status.includes('Physical companion: Connected'));
 }
 assert.ok(!disconnectedPhysical.includes('Leaving this screen or backgrounding'));
 assert.ok(home.includes('Physical companion: Disconnected. Open settings.'));
 const connectedHomeStatus=renderToStaticMarkup(createElement(PhysicalCompanionHomeStatus,{state:{...initialBleState(),phase:'connected',ready:true,notice:'Companion update needed for all lesson reactions.'},onOpen:noOp}));
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
 assert.ok(home.includes('0-day learning streak'));
 function Profile(){const activity=useNativeStats();const subscription=useSubscription();return createElement(NativeProfile,{activity,subscription,onPlus:()=>{},onClose:()=>{}});}
 const emptyProfile=renderToStaticMarkup(createElement(Profile));
 assert.ok(!emptyProfile.includes('Practice days'));
 for(const marker of ['Current streak','Best streak','Lesson finishes','Today XP','Total XP','Your last seven days','Finish the lesson to see your first result here.'])assert.ok(emptyProfile.includes(marker));
 storage.set(NATIVE_STATS_KEY,JSON.stringify({version:1,days:{'2020-01-01':2},earlierFinishes:0,latest:{day:'2020-01-01',firstTry:4}}));
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
 storage.clear();
 storage.set(NATIVE_SESSION_KEY,JSON.stringify({...freshSession(),revealed:['hi']}));
 const partialHome=renderToStaticMarkup(createElement(RuntimeApp));
 assert.ok(partialHome.includes('Continue lesson'));
 assert.ok(partialHome.includes('Shall we pick up where we left off?'));
 console.log('PASS: app home offers Continue for a saved partial lesson.');
 const completed={...freshSession(),progress:{index:5,attempts:0,results:[true,false,true,true,true],feedback:null,complete:true}};
 storage.set(NATIVE_SESSION_KEY,JSON.stringify(completed));
 const results=renderToStaticMarkup(createElement(NativeLesson));
 assert.ok(results.includes('Replay the lesson'));
 assert.ok(results.includes('Progress saved on this iPhone.'));
 assert.ok(!results.includes('Check answer'));
 const completedHome=renderToStaticMarkup(createElement(RuntimeApp));
 assert.ok(completedHome.includes('See your results'));
 assert.ok(completedHome.includes('Молодец! You finished Café essentials.'));
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
 storage.clear();
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
 assert.ok(secondPartial.includes('Continue lesson'));assert.ok(secondPartial.includes('Shall we pick up where we left off?'));
 storage.set(sessionKey(introductionsLesson),JSON.stringify(completed));
 const secondResults=renderToStaticMarkup(createElement(SecondLesson));
 assert.ok(secondResults.includes('You practised introducing yourself'));assert.ok(secondResults.includes('Очень приятно! → Nice to meet you!'));
 storage.set(sessionKey(introductionsLesson),JSON.stringify({...completed,progress:{...completed.progress,results:Array(5).fill(true)}}));
 assert.ok(renderToStaticMarkup(createElement(SecondLesson)).includes('Анна was just our example.'));
 const secondHome=renderToStaticMarkup(createElement(RuntimeApp));assert.ok(secondHome.includes('Молодец! You finished Nice to meet you.'));
 storage.set(NATIVE_STATS_KEY,JSON.stringify({version:1,days:{'2020-01-01':1},earlierFinishes:0,latest:{day:'2020-01-01',firstTry:5,lessonId:'introductions'}}));
 assert.ok(renderToStaticMarkup(createElement(Profile)).includes('<h2 id="native-result-title">Nice to meet you</h2>'));
 console.log('PASS: second lesson renders all five exercises, separate progress/results, matching greeting and profile title.');
 Capacitor.isNativePlatform=()=>false;
 const unchangedWebsite=renderToStaticMarkup(createElement(RuntimeApp));
 assert.ok(unchangedWebsite.includes('STEP 1 OF 5'));assert.ok(!unchangedWebsite.includes('Nice to meet you'));

 for(const html of [website,home]){
  assert.ok(!html.includes('Duolingo'));assert.ok(!html.includes('comparison-table'));assert.ok(!html.includes('native-compare'));assert.ok(!html.includes('href="#why"'));
 }
 assert.ok(website.includes('20 gems'));assert.ok(website.includes('30 gems'));assert.ok(website.includes('no payment processing'));
 assert.ok(website.includes('robot on this website is simulated'));assert.ok(website.includes('working iPhone + ESP32 prototype'));
 function Plus(){const subscription=useSubscription();return createElement(PlusScreen,{subscription,onClose:()=>{}});}
 storage.clear();assert.ok(renderToStaticMarkup(createElement(Plus)).includes('Activate Plus demo'));
 storage.set(SUBSCRIPTION_KEY,JSON.stringify({version:1,plan:'monthly',since:'2026-10-18'}));
 assert.ok(renderToStaticMarkup(createElement(Plus)).includes('Cancel Plus'));assert.ok(renderToStaticMarkup(createElement(Profile)).includes('Manage Plus'));
 Capacitor.isNativePlatform=()=>true;
 const plusHome=renderToStaticMarkup(createElement(RuntimeApp));assert.ok(plusHome.includes('native-profile-open is-plus'));assert.ok(plusHome.includes('Plus demo active'));assert.ok(!plusHome.includes('native-plus-open'));
 const plusProfile=renderToStaticMarkup(createElement(Profile));assert.ok(plusProfile.includes('native-profile-avatar is-plus'));assert.ok(plusProfile.includes('native-profile-plus-tag'));
 Capacitor.isNativePlatform=()=>false;
 storage.clear();assert.ok(renderToStaticMarkup(createElement(Profile)).includes('Get Plus'));
 console.log('PASS: own-feature descriptions replace comparisons, prices/hardware states are accurate, and Plus demo screens render inactive/active states.');
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
 assert.ok(home.includes('Cyrillic quick start'));assert.ok(home.includes('RECOMMENDED · ABOUT 3 MIN'));
 for(const [status,page,action] of [['skipped',0,'Open'],['started',1,'Continue'],['completed',3,'Review']]){
  storage.set(CYRILLIC_KEY,JSON.stringify({version:1,status,page}));Capacitor.isNativePlatform=()=>true;const compactHome=renderToStaticMarkup(createElement(RuntimeApp));assert.ok(compactHome.includes('native-quick-card is-collapsed'));assert.ok(compactHome.includes(`${action} Cyrillic quick start`));assert.ok(!compactHome.includes('Skip for now'));assert.ok(!compactHome.includes('RECOMMENDED · ABOUT 3 MIN'));
 }Capacitor.isNativePlatform=()=>false;
 assert.ok(!website.includes('Cyrillic quick start'));assert.ok(!website.includes('Open Cyrillic guide'));
 storage.clear();
 function QuickStart(){const onboarding=useCyrillicProgress();const controller=useLesson();return createElement(NativeCyrillicQuickStart,{onboarding,speech:controller.speech,onClose:noOp,onLesson:noOp});}
 for(const [status,page] of [['started',0],['started',1],['started',2],['started',3],['completed',3]]){
  storage.set(CYRILLIC_KEY,JSON.stringify({version:1,status,page}));
  const quick=renderToStaticMarkup(createElement(QuickStart));assert.ok(quick.includes('Cyrillic quick start'));assert.ok(!quick.includes('lesson-vitals'));assert.ok(!quick.includes('XP earned'));
 }
 function Guide(){const controller=useLesson();return createElement(NativeAlphabetGuide,{definition:controller.definition,exercise:controller.exercise,speech:controller.speech,onListen:noOp,onClose:noOp});}
 const guide=renderToStaticMarkup(createElement(Guide));assert.ok(guide.includes('Cyrillic guide'));assert.ok(guide.includes('Current exercise'));assert.ok(guide.includes('See full alphabet'));assert.ok(guide.includes('Russian audio unavailable'));
 storage.clear();console.log('PASS: native-only optional Cyrillic card/pages and contextual guide render with accessible text/audio fallback; website excludes them.');


}finally{
 Capacitor.isNativePlatform=platform;
 if(storageDescriptor)Object.defineProperty(globalThis,'localStorage',storageDescriptor);else Reflect.deleteProperty(globalThis,'localStorage');
 await server.close();
}
