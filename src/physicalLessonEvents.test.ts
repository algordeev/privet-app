import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProgress,progressReducer,MAX_HEARTS,type Action,type Progress} from './engine.ts';
import {lesson} from './lesson.ts';
import {COMMAND,type CommandCode} from './bleProtocol.ts';
import {createPhysicalLessonEvents,physicalLessonCommand} from './physicalLessonEvents.ts';

test('actual correct, incorrect, retry, continue and restart transitions map to physical commands',()=>{
 let p={...initialProgress(),index:1};const codes:CommandCode[]=[];const events=createPhysicalLessonEvents(c=>codes.push(c));
 function dispatch(action:Action){const next=progressReducer(p,action);events(p,next,action);p=next;}
 dispatch({type:'check',value:'tea'});dispatch({type:'check',value:'coffee'}); // rejected duplicate while feedback is open
 dispatch({type:'retry'});dispatch({type:'check',value:'coffee'});dispatch({type:'continue'});dispatch({type:'reset'});
 assert.deepEqual(codes,[COMMAND.ENCOURAGE,COMMAND.IDLE,COMMAND.HAPPY,COMMAND.IDLE,COMMAND.IDLE]);
});
test('final Continue celebrates exactly once, with no immediate IDLE; saved completion never replays',()=>{
 const codes:CommandCode[]=[];const events=createPhysicalLessonEvents(c=>codes.push(c));let p=initialProgress();
 for(const exercise of lesson){let action:Action={type:'check',value:exercise.answer};let next=progressReducer(p,action);events(p,next,action);p=next;
  action={type:'continue'};next=progressReducer(p,action);events(p,next,action);events(p,next,action);p=next;
 }
 assert.equal(codes.filter(c=>c===COMMAND.CELEBRATE).length,1);assert.deepEqual(codes.slice(-2),[COMMAND.HAPPY,COMMAND.CELEBRATE]);
 const before=codes.length;events(p,p,{type:'continue'});events(p,progressReducer(p,{type:'check',value:'спасибо'}),{type:'check',value:'спасибо'});assert.equal(codes.length,before);
 const restored={...p,results:[...p.results]};assert.equal(physicalLessonCommand(restored,restored,{type:'continue'}),null);
});
test('rapid duplicate submissions are emitted once while new retry attempts still react',()=>{
 const sent:CommandCode[]=[];const events=createPhysicalLessonEvents(c=>sent.push(c));const p={...initialProgress(),index:1};const check:Action={type:'check',value:'tea'};const wrong=progressReducer(p,check);
 events(p,wrong,check);events(p,progressReducer(p,check),check);const retry=progressReducer(wrong,{type:'retry'});events(wrong,retry,{type:'retry'});events(retry,progressReducer(retry,check),check);
 assert.deepEqual(sent,[COMMAND.ENCOURAGE,COMMAND.IDLE,COMMAND.ENCOURAGE]);
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
