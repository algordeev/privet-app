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
 const {RuntimeApp}=await server.ssrLoadModule('/src/RuntimeApp.tsx');
 const {useLesson}=await server.ssrLoadModule('/src/useLesson.ts');
 const {useNativeCompanion}=await server.ssrLoadModule('/src/useNativeCompanion.ts');
 const {COMPANION_PREFERENCE_KEY}=await server.ssrLoadModule('/src/nativeCompanion.ts');
 const {LessonPanel}=await server.ssrLoadModule('/src/LessonPanel.tsx');
 const {freshSession,NATIVE_SESSION_KEY}=await server.ssrLoadModule('/src/session.ts');
 const {lesson}=await server.ssrLoadModule('/src/lesson.ts');
 Capacitor.isNativePlatform=()=>false;
 const website=renderToStaticMarkup(createElement(RuntimeApp));
 for(const marker of ['class="site-header wrap"','class="hero wrap"','class="lesson-phone"','class="ios-status-bar"','id="companion"'])assert.ok(website.includes(marker),marker);
 assert.ok(!website.includes('class="native-app"'));
 const baseline=process.env.PRIVET_BROWSER_BASELINE;
 if(baseline&&existsSync(baseline)){assert.equal(website.replace('class="app-audio-note" role="status" aria-live="polite" aria-atomic="true"','class="app-audio-note"'),readFileSync(baseline,'utf8'));console.log('PASS: browser markup preserved, with accessible audio status attributes added.');}
 else console.log('PASS: browser runtime retains marketing, navigation, phone preview, lesson, and companion.');
 Capacitor.isNativePlatform=()=>true;
 const home=renderToStaticMarkup(createElement(RuntimeApp));
 for(const marker of ['class="native-app"','Café essentials','Start lesson','Virtual companion','Physical version planned','Привет! Ready for a little Russian?'])assert.ok(home.includes(marker),marker);
 for(const marker of ['site-header','class="hero','lesson-phone','ios-status-bar','dynamic-island','ios-home-area','Demo connection'])assert.ok(!home.includes(marker),marker);
 console.log('PASS: Capacitor runtime renders app home with local lesson entry and simulated companion.');
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
 Capacitor.isNativePlatform=()=>false;
 assert.ok(renderToStaticMarkup(createElement(RuntimeApp)).includes('STEP 1 OF 5'));
 console.log('PASS: native completion/replay and saved results render; browser sessions still start fresh.');

}finally{
 Capacitor.isNativePlatform=platform;
 if(storageDescriptor)Object.defineProperty(globalThis,'localStorage',storageDescriptor);else Reflect.deleteProperty(globalThis,'localStorage');
 await server.close();
}
