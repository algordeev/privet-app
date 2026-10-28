import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProgress,progressReducer,MAX_HEARTS,matchValue,type Action,type Progress} from './engine.ts';
import {lesson} from './lesson.ts';
import {lessonById} from './curriculum/catalog.ts';
import {COMMAND,type CommandCode} from './bleProtocol.ts';
import {createPhysicalLessonEvents,physicalLessonCommand} from './physicalLessonEvents.ts';

test('actual correct, incorrect, retry, continue and restart transitions map to physical commands',()=>{
 let p={...initialProgress(),index:1};const codes:CommandCode[]=[];const events=createPhysicalLessonEvents(c=>codes.push(c));
 function dispatch(action:Action){const next=progressReducer(p,action);events(p,next,action);p=next;}
 dispatch({type:'check',value:'tea'});dispatch({type:'check',value:'coffee'}); // rejected duplicate while feedback is open
 dispatch({type:'retry'});dispatch({type:'check',value:'coffee'});dispatch({type:'continue'});dispatch({type:'reset'});
 assert.deepEqual(codes,[COMMAND.ENCOURAGE,COMMAND.THINKING,COMMAND.HAPPY,COMMAND.THINKING,COMMAND.IDLE]);
});
test('final Continue celebrates exactly once, with no immediate IDLE; saved completion never replays',()=>{
 const codes:CommandCode[]=[];const events=createPhysicalLessonEvents(c=>codes.push(c));let p=initialProgress();
 for(const exercise of lesson){let action:Action={type:'check',value:exercise.answer};let next=progressReducer(p,action);events(p,next,action);p=next;
  action={type:'continue'};next=progressReducer(p,action);events(p,next,action);events(p,next,action);p=next;
 }
 // A perfect run: its last answer extends the combo, so it is ON_FIRE before the celebration.
 assert.equal(codes.filter(c=>c===COMMAND.CELEBRATE).length,1);assert.deepEqual(codes.slice(-2),[COMMAND.ON_FIRE,COMMAND.CELEBRATE]);
 const before=codes.length;events(p,p,{type:'continue'});events(p,progressReducer(p,{type:'check',value:'спасибо'}),{type:'check',value:'спасибо'});assert.equal(codes.length,before);
 const restored={...p,results:[...p.results]};assert.equal(physicalLessonCommand(restored,restored,{type:'continue'}),null);
});
test('rapid duplicate submissions are emitted once while new retry attempts still react',()=>{
 const sent:CommandCode[]=[];const events=createPhysicalLessonEvents(c=>sent.push(c));const p={...initialProgress(),index:1};const check:Action={type:'check',value:'tea'};const wrong=progressReducer(p,check);
 events(p,wrong,check);events(p,progressReducer(p,check),check);const retry=progressReducer(wrong,{type:'retry'});events(wrong,retry,{type:'retry'});events(retry,progressReducer(retry,check),check);
 assert.deepEqual(sent,[COMMAND.ENCOURAGE,COMMAND.THINKING,COMMAND.ENCOURAGE]);
});
test('rejected retry/continue/check transitions never emit and restoring results is not an event',()=>{
 const p=initialProgress();for(const action of [{type:'retry'},{type:'continue'}] as Action[])assert.equal(physicalLessonCommand(p,progressReducer(p,action),action),null);
 const complete:Progress={...initialProgress(),index:5,attempts:0,results:[true,true,true,true,true],feedback:null,complete:true};const sent:CommandCode[]=[];createPhysicalLessonEvents(c=>sent.push(c));assert.deepEqual(sent,[]);
 assert.equal(physicalLessonCommand(complete,complete,{type:'continue'}),null);
});

test('out of hearts emits encouragement and cannot celebrate',()=>{
 let p={...initialProgress(),index:1,hearts:1};const sent:CommandCode[]=[];const events=createPhysicalLessonEvents(c=>sent.push(c));
 const action:Action={type:'check',value:'wrong'},failed=progressReducer(p,action);events(p,failed,action);assert.equal(failed.failed,true);
 events(failed,progressReducer(failed,{type:'continue'}),{type:'continue'});
 events(failed,progressReducer(failed,{type:'check',value:'coffee'}),{type:'check',value:'coffee'});
 assert.deepEqual(sent,[COMMAND.ENCOURAGE]);
});
test('reviving a failed lesson for Plus sends no companion command',()=>{
 const previous={...initialProgress(),index:2,hearts:0,failed:true,feedback:'incorrect' as const,attempts:1};
 const next={...previous,hearts:MAX_HEARTS,failed:false};
 assert.equal(physicalLessonCommand(previous,next,{type:'revive'}),null);
});

test('rapid divergent submissions from the same pre-render state only emit the first accepted reaction',()=>{
 const p={...initialProgress(),index:1},sent:CommandCode[]=[];
 const events=createPhysicalLessonEvents(c=>sent.push(c));
 events(p,progressReducer(p,{type:'check',value:'tea'}),{type:'check',value:'tea'});
 events(p,progressReducer(p,{type:'check',value:'coffee'}),{type:'check',value:'coffee'});
 assert.deepEqual(sent,[COMMAND.ENCOURAGE]);
});

test('identical progress in different lessons is not suppressed as a duplicate',()=>{
 const p={...initialProgress(),index:1},sent:CommandCode[]=[];const events=createPhysicalLessonEvents(c=>sent.push(c));
 const action:Action={type:'check',value:'coffee'},next=progressReducer(p,action);
 events(p,next,action,'cafe');events(p,next,action,'introductions');events(p,next,action,'introductions');
 assert.deepEqual(sent,[COMMAND.HAPPY,COMMAND.HAPPY]);
});
test('listen and match transitions react once; a slipped match check still celebrates the answer with one HAPPY',()=>{
 for(const [id,kind] of [['around-town','listen'],['making-plans','match']] as const){
  const l=lessonById(id),index=l.exercises.findIndex(e=>e.kind===kind),e=l.exercises[index];
  const value=kind==='match'?matchValue(e.pairs!.map(p=>p[0]),e):e.answer;
  const sent:CommandCode[]=[];const events=createPhysicalLessonEvents(c=>sent.push(c));let p:Progress={...initialProgress(),index,results:Array(index).fill(true)};
  const run=(action:Action)=>{const next=progressReducer(p,action,l.exercises);events(p,next,action,id);events(p,next,action,id);p=next;};
  if(kind==='listen'){run({type:'check',value:'Прямо.'});run({type:'retry'});run({type:'check',value});}
  else run({type:'check',value,slipped:true});
  run({type:'continue'});
  assert.deepEqual(sent,kind==='listen'?[COMMAND.ENCOURAGE,COMMAND.THINKING,COMMAND.HAPPY,COMMAND.THINKING]:[COMMAND.HAPPY,COMMAND.THINKING]);
 }
});
test('a first try that extends a combo of two or more is ON_FIRE; other, retried and slipped correct answers stay HAPPY',()=>{
 const check:Action={type:'check',value:''};
 const at=(combo:number):Progress=>({...initialProgress(),index:combo,combo,bestCombo:combo,results:Array(combo).fill(true)});
 const firstTry=(p:Progress):Progress=>({...p,attempts:1,feedback:'correct',combo:p.combo+1,bestCombo:p.combo+1});
 assert.deepEqual([1,2,3,4,5,6].map(n=>physicalLessonCommand(at(n-1),firstTry(at(n-1)),check)),[1,12,12,12,12,12].map(code=>code as CommandCode));
 const retry={...at(3),attempts:1,feedback:null};
 assert.equal(physicalLessonCommand(retry,{...retry,attempts:2,feedback:'correct'},check),COMMAND.HAPPY,'a retried answer does not extend the combo');
 const slip=at(2);
 assert.equal(physicalLessonCommand(slip,{...slip,attempts:2,feedback:'correct'},{type:'check',value:'',slipped:true}),COMMAND.HAPPY,'a slipped match is not a first try');
 // A real lesson: the second straight first try starts the combo.
 const codes:CommandCode[]=[];const events=createPhysicalLessonEvents(c=>codes.push(c));let p=initialProgress();
 for(const exercise of lesson.slice(0,3)){const a:Action={type:'check',value:exercise.answer},next=progressReducer(p,a);events(p,next,a);p=progressReducer(next,{type:'continue'});}
 assert.deepEqual(codes,[COMMAND.HAPPY,COMMAND.ON_FIRE,COMMAND.ON_FIRE]);
});
