import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProgress,progressReducer} from './engine.ts';
import {freshSession} from './session.ts';
import {companionEnabled,homeGreeting,lessonStarted,nativeLessonReaction,completionSummary,createNativeCompanion,type NativeCompanionView} from './nativeCompanion.ts';
import {lesson} from './lesson.ts';

function harness(enabled=true){
 let nextId=0;
 const timers=new Map<number,()=>void>();
 const snapshots:NativeCompanionView[]=[];
 const actor=createNativeCompanion(enabled,v=>snapshots.push(v),{
  set:fn=>{const id=++nextId;timers.set(id,fn);return id as unknown as ReturnType<typeof setTimeout>;},
  clear:id=>{timers.delete(id as unknown as number);},
 });
 return {actor,timers,snapshots,get view(){return actor.getSnapshot();},settle(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
test('home greetings reflect fresh, partial, attempted, and completed saved progress',()=>{
 const s=freshSession();assert.equal(lessonStarted(s),false);assert.equal(homeGreeting(s),'Привет! Ready for a little Russian?');
 for(const partial of [{...s,revealed:['hi']},{...s,selected:'спа'},{...s,tokens:['Я']},{...s,progress:{...s.progress,attempts:1}},{...s,progress:{...s.progress,index:1}}]){
  assert.equal(lessonStarted(partial),true);assert.equal(homeGreeting(partial),'Shall we pick up where we left off?');
 }
 assert.equal(homeGreeting({...s,progress:{...s.progress,complete:true,index:5,results:Array(5).fill(true)}}),'Молодец! You finished Café essentials.');
});
test('native feedback is concise, varied, and incorrect reactions never expose answers',()=>{
 for(let index=0;index<lesson.length;index++){
  const p={...initialProgress(),index,attempts:1};
  assert.equal(nativeLessonReaction(p),null);
  assert.equal(nativeLessonReaction({...p,feedback:'correct'})?.expression,'happy');
  const r=nativeLessonReaction({...p,feedback:'incorrect'})!;
  assert.equal(r.expression,'encouraging');assert.ok(r.message.length<65);
  for(const answer of ['Спасибо','спасибо','Я хочу','кофе','coffee','Привет'])assert.ok(!r.message.includes(answer));
 }
 assert.notEqual(nativeLessonReaction({...initialProgress(),attempts:1,feedback:'incorrect'})?.message,nativeLessonReaction({...initialProgress(),attempts:2,feedback:'incorrect'})?.message);
});
test('actual correct/incorrect transitions emit once, settling motion preserves announced text',()=>{
 const h=harness();h.actor.navigate('lesson');
 const before=initialProgress();const after=progressReducer(before,{type:'check',value:'wrong'});
 h.actor.transition(before,after,{type:'check',value:'wrong'});
 assert.equal(h.view.expression,'encouraging');const revision=h.view.revision,message=h.view.message;
 h.actor.transition(before,after,{type:'check',value:'wrong'});assert.equal(h.view.revision,revision);assert.equal(h.timers.size,1);
 h.settle();assert.equal(h.view.expression,'idle');assert.equal(h.view.message,message);
 const retry=progressReducer(after,{type:'retry'});h.actor.transition(after,retry,{type:'retry'});assert.equal(h.view.message,'');
 const correct=progressReducer(retry,{type:'check',value:'ready'});h.actor.transition(retry,correct,{type:'check',value:'ready'});assert.equal(h.view.expression,'happy');
});
test('completion replaces pending reactions and truthfully summarizes the practised content',()=>{
 const h=harness();h.actor.navigate('lesson');h.actor.tap();const stale=[...h.timers.values()][0];
 const previous={...initialProgress(),index:4,attempts:1,feedback:'correct' as const,results:[true,false,true,true]};
 const complete=progressReducer(previous,{type:'continue'});
 h.actor.transition(previous,complete,{type:'continue'});stale();
 assert.equal(h.view.expression,'celebrating');assert.match(h.view.message,/Five small steps complete/);assert.equal(h.timers.size,1);
 assert.match(completionSummary,/greetings, tea and coffee, ordering tea, and saying thank you/);
});
test('disabled reactions stay static, preserve exercise feedback, and create no timers',()=>{
 const h=harness(false);h.actor.navigate('lesson');h.actor.tap();
 const before=initialProgress(),after=progressReducer(before,{type:'check',value:'wrong'});
 h.actor.transition(before,after,{type:'check',value:'wrong'});
 assert.equal(h.view.expression,'idle');assert.equal(h.view.message,'');assert.equal(h.timers.size,0);assert.equal(after.feedback,'incorrect');
 h.actor.setEnabled(true);h.actor.tap();assert.equal(h.view.expression,'greeting');
 const stale=[...h.timers.values()][0];h.actor.setEnabled(false);stale();assert.equal(h.view.expression,'idle');assert.equal(h.view.message,'');assert.equal(h.timers.size,0);
});
test('navigation, restart, retry and exercise changes invalidate all pending callbacks',()=>{
 for(const boundary of ['close','open','reset','continue','retry'] as const){
  const h=harness();h.actor.navigate('lesson');h.actor.tap();const stale=[...h.timers.values()][0];
  const previous={...initialProgress(),attempts:1,feedback:boundary==='retry'?'incorrect' as const:'correct' as const};
  if(boundary==='close'||boundary==='open')h.actor.navigate(boundary==='close'?'home':'lesson');
  else {const action={type:boundary};h.actor.transition(previous,progressReducer(previous,action),action);}
  assert.equal(h.timers.size,0,boundary);assert.equal(h.view.message,'',boundary);
  h.actor.tap();const revision=h.view.revision;stale();assert.equal(h.view.revision,revision);assert.equal(h.view.expression,'greeting');
 }
});
test('background and disposal cancel timers; foreground and restored feedback do not replay reactions',()=>{
 const h=harness();h.actor.tap();const stale=[...h.timers.values()][0];h.actor.setActive(false);stale();h.actor.tap();
 assert.equal(h.view.expression,'idle');assert.equal(h.timers.size,0);h.actor.setActive(true);assert.equal(h.view.message,'');
 const saved={...initialProgress(),attempts:1,feedback:'correct' as const};h.actor.transition(saved,saved,{type:'check',value:'ready'});assert.equal(h.view.expression,'idle');
 h.actor.tap();const late=[...h.timers.values()][0];h.actor.dispose();const n=h.snapshots.length;late();h.actor.tap();
 assert.equal(h.timers.size,0);assert.equal(h.snapshots.length,n);
});
test('native preference defaults on and restores an explicit disabled value',()=>{
 assert.equal(companionEnabled(null),true);assert.equal(companionEnabled('true'),true);assert.equal(companionEnabled('false'),false);assert.equal(companionEnabled('corrupt'),true);
});
test('completion counts the lesson’s real steps and matched pairs count as a started lesson',()=>{
 for(const [n,word] of [[5,'Five'],[6,'Six']] as const)assert.equal(nativeLessonReaction({...initialProgress(),complete:true,index:n,results:Array(n).fill(true)})?.message,`Молодец! ${word} small steps complete.`);
 assert.equal(nativeLessonReaction({...initialProgress(),complete:true,index:1,results:[true]})?.message,'Молодец! One small step complete.');
 assert.equal(lessonStarted({...freshSession(),matches:['завтра']}),true);
});
test('the virtual companion is "on fire" exactly when the physical one is',()=>{
 const p={...initialProgress(),index:2,attempts:1,feedback:'correct' as const,combo:2,bestCombo:2};
 assert.deepEqual(nativeLessonReaction(p),{expression:'celebrating',message:'Two in a row!'});
 assert.deepEqual(nativeLessonReaction({...p,combo:3,bestCombo:3}),{expression:'celebrating',message:'Three in a row! You’re on fire.'});
 for(const other of [{...p,combo:1,bestCombo:1},{...p,attempts:2},{...p,feedback:'incorrect' as const}])assert.doesNotMatch(nativeLessonReaction(other)!.message,/in a row/);
});
