import test from 'node:test';
import assert from 'node:assert/strict';
import {createForegroundStore,type AppLifecycle} from './foreground.ts';

function fakePage(hidden=false){
 const page={
  isHidden:hidden,
  on:null as null|{change:()=>void;leave:()=>void},
  hidden:()=>page.isHidden,
  watch(on:{change:()=>void;leave:()=>void}){page.on=on;return ()=>{page.on=null;};},
  show(){page.isHidden=false;page.on?.change();},
  hide(){page.isHidden=true;page.on?.change();},
 };
 return page;
}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fakeApp(){
 const listening=deferred<()=>void>(),answer=deferred<boolean>();
 const app={
  send:null as null|((isActive:boolean)=>void),
  stopped:false,
  listening,answer,
  lifecycle:{
   listen(onChange){app.send=onChange;return listening.promise;},
   current(){return answer.promise;},
  } as AppLifecycle,
  ready(){listening.resolve(()=>{app.stopped=true;});},
 };
 return app;
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('a visible page is in the foreground; with no page at all it counts as foreground',()=>{
 assert.equal(createForegroundStore(fakePage(),()=>null).get(),true);
 assert.equal(createForegroundStore(null,()=>null).get(),true);
});

test('hiding and showing the page switches the foreground and tells readers only on a change',()=>{
 const page=fakePage(),store=createForegroundStore(page,()=>null);let calls=0;
 store.subscribe(()=>calls++);
 page.hide();assert.equal(store.get(),false);
 page.hide();assert.equal(calls,1,'no second call without a change');
 page.show();assert.equal(store.get(),true);assert.equal(calls,2);
});

test('leaving the page counts as background even before it reports hidden',()=>{
 const page=fakePage(),store=createForegroundStore(page,()=>null);
 store.subscribe(()=>{});
 page.on!.leave();assert.equal(store.get(),false);
 page.on!.change();assert.equal(store.get(),true,'coming back (pageshow) restores it');
});

test('starting to read picks up a page that was hidden in the meantime',()=>{
 const page=fakePage(),store=createForegroundStore(page,()=>null);
 page.isHidden=true;
 store.subscribe(()=>{});assert.equal(store.get(),false);
});

test('the native app is in the foreground only while it is active and the page is visible',async()=>{
 const page=fakePage(),app=fakeApp(),store=createForegroundStore(page,()=>app.lifecycle);
 store.subscribe(()=>{});app.ready();await settle();
 app.send!(false);assert.equal(store.get(),false);
 app.send!(true);assert.equal(store.get(),true);
 page.hide();assert.equal(store.get(),false);
 app.send!(true);assert.equal(store.get(),false,'an active app behind a hidden page is still background');
});

test('the current app state is asked once at start and applied when nothing newer arrived',async()=>{
 const app=fakeApp(),store=createForegroundStore(fakePage(),()=>app.lifecycle);
 store.subscribe(()=>{});app.ready();await settle();
 app.answer.resolve(false);await settle();
 assert.equal(store.get(),false);
});

test('an app event that arrives while the start-up question is pending wins over the older answer',async()=>{
 const app=fakeApp(),store=createForegroundStore(fakePage(),()=>app.lifecycle);
 store.subscribe(()=>{});app.ready();await settle();
 app.send!(true);app.answer.resolve(false);await settle();
 assert.equal(store.get(),true);
});

test('when the last reader leaves, page and app listening stop and nothing more is reported',async()=>{
 const page=fakePage(),app=fakeApp(),store=createForegroundStore(page,()=>app.lifecycle);let calls=0;
 const first=store.subscribe(()=>calls++),second=store.subscribe(()=>calls++);
 app.ready();await settle();
 first();assert.ok(page.on,'still listening while one reader remains');
 second();assert.equal(page.on,null);assert.equal(app.stopped,true);
 app.send!(false);app.answer.resolve(false);await settle();
 assert.equal(calls,0);
});

test('stopping before the app listener is ready removes it as soon as it is, without changing state',async()=>{
 const app=fakeApp(),store=createForegroundStore(fakePage(),()=>app.lifecycle);
 const stop=store.subscribe(()=>{});stop();
 app.ready();await settle();
 assert.equal(app.stopped,true);assert.equal(store.get(),true);
});

test('without an app lifecycle (listener or question fails) the page alone decides',async()=>{
 const failing=fakeApp(),store=createForegroundStore(fakePage(),()=>failing.lifecycle);
 store.subscribe(()=>{});failing.listening.reject(new Error('unavailable'));await settle();
 assert.equal(store.get(),true);
 const unanswered=fakeApp(),other=createForegroundStore(fakePage(),()=>unanswered.lifecycle);
 other.subscribe(()=>{});unanswered.ready();await settle();unanswered.answer.reject(new Error('unavailable'));await settle();
 assert.equal(other.get(),true);
});
