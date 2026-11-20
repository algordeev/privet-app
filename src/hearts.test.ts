import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProgress,lessonCompanionEvent,lessonXp,MAX_HEARTS,progressReducer,type Action,type Progress} from './engine.ts';
import {lesson} from './lesson.ts';
import {COMMAND,type CommandCode} from './bleProtocol.ts';
import {createPhysicalLessonEvents,physicalLessonCommand} from './physicalLessonEvents.ts';

const plus={unlimitedHearts:true};
const run=(state:Progress,actions:readonly Action[],rules={})=>actions.reduce((s,a)=>progressReducer(s,a,lesson,rules),state);
const right=(index:number):Action=>({type:'check',value:lesson[index].answer});
const wrong:Action={type:'check',value:'definitely not this'};
const retry:Action={type:'retry'},next:Action={type:'continue'};
// Restoring hearts after running out: with Plus, or paid with gems.
const byPlus:Action={type:'restoreHearts',by:'plus'},byGems:Action={type:'restoreHearts',by:'gems'};
const outOfHearts=()=>run({...initialProgress(),index:1},[wrong,retry,wrong,retry,wrong]);

test('an attempt starts with full hearts, no run of first tries and not failed',()=>{
 const start=initialProgress();
 assert.equal(MAX_HEARTS,3);
 assert.deepEqual({hearts:start.hearts,combo:start.combo,bestCombo:start.bestCombo,failed:start.failed},{hearts:3,combo:0,bestCombo:0,failed:false});
});

test('each wrong answer costs one heart; losing the last one fails the attempt',()=>{
 let s=run(initialProgress(),[wrong]);assert.equal(s.hearts,2);assert.equal(s.failed,false);
 s=run(s,[retry,wrong]);assert.equal(s.hearts,1);assert.equal(s.failed,false);
 s=run(s,[retry,wrong]);assert.equal(s.hearts,0);assert.equal(s.failed,true);assert.equal(s.feedback,'incorrect');
});

test('a failed attempt ignores answers, retries and continues until it is reset',()=>{
 const failed=outOfHearts();
 for(const action of [retry,next,right(1),wrong])assert.deepEqual(progressReducer(failed,action),failed);
 assert.deepEqual(progressReducer(failed,{type:'reset'}),initialProgress());
});

test('first tries build a run; a mistake ends it, and a later correct answer neither extends nor resets it',()=>{
 let s=run(initialProgress(),[right(0),next,right(1),next]);assert.equal(s.combo,2);assert.equal(s.bestCombo,2);
 s=run(s,[wrong]);assert.equal(s.combo,0);assert.equal(s.bestCombo,2);
 s=run(s,[retry,right(2)]);assert.equal(s.combo,0,'correct after a mistake is not a first try');
 s=run(s,[next,right(3)]);assert.equal(s.combo,1);assert.equal(s.bestCombo,2);
});

test('moving to the next step keeps hearts and the current run',()=>{
 const s=run(initialProgress(),[wrong,retry,right(0),next,right(1)]);
 const moved=progressReducer(s,next);
 assert.equal(moved.index,2);assert.equal(moved.hearts,2);assert.equal(moved.combo,1);
});

test('with unlimited hearts mistakes cost nothing and never fail, but still end the run',()=>{
 let s=run(initialProgress(),[right(0),next],plus);
 for(let i=0;i<6;i++){s=run(s,[wrong],plus);assert.equal(s.hearts,MAX_HEARTS);assert.equal(s.failed,false);assert.equal(s.combo,0);s=run(s,[retry],plus);}
});

test('Plus restores hearts only for a failed attempt, on the same step with Try again showing',()=>{
 const failed=outOfHearts();
 assert.deepEqual(progressReducer(failed,byPlus),failed,'without unlimited hearts nothing changes');
 const back=progressReducer(failed,byPlus,lesson,plus);
 assert.deepEqual({hearts:back.hearts,failed:back.failed,feedback:back.feedback,index:back.index,attempts:back.attempts},{hearts:MAX_HEARTS,failed:false,feedback:'incorrect',index:failed.index,attempts:failed.attempts});
 assert.deepEqual(progressReducer(initialProgress(),byPlus,lesson,plus),initialProgress(),'nothing to restore');
});

test('gems restore hearts for a failed attempt whatever the plan, and only then',()=>{
 const failed=outOfHearts();
 const back=progressReducer(failed,byGems);
 assert.deepEqual({hearts:back.hearts,failed:back.failed,feedback:back.feedback,index:back.index},{hearts:MAX_HEARTS,failed:false,feedback:'incorrect',index:failed.index});
 assert.deepEqual(progressReducer(back,retry).feedback,null,'Try again then works as usual');
 const partly=run(initialProgress(),[wrong]);
 assert.deepEqual(progressReducer(partly,byGems),partly);
});

test('the companion encourages a failed attempt and never celebrates it',()=>{
 const failed=outOfHearts();
 assert.deepEqual(lessonCompanionEvent(failed),{type:'incorrect'});
 const sent:CommandCode[]=[];const events=createPhysicalLessonEvents(code=>sent.push(code));
 const beforeLast=run({...initialProgress(),index:1},[wrong,retry,wrong,retry]);
 events(beforeLast,progressReducer(beforeLast,wrong),wrong);
 for(const action of [next,right(1)])events(failed,progressReducer(failed,action),action);
 assert.deepEqual(sent,[COMMAND.ENCOURAGE]);
 assert.ok(!sent.includes(COMMAND.CELEBRATE));
});

test('restoring hearts sends the robot nothing',()=>{
 const failed=outOfHearts();
 assert.equal(physicalLessonCommand(failed,progressReducer(failed,byGems),byGems),null);
 assert.equal(physicalLessonCommand(failed,progressReducer(failed,byPlus,lesson,plus),byPlus),null);
});

test('lesson XP: 10, plus hearts left, plus the best run; nothing for a failed attempt',()=>{
 const xp=(fields:Partial<Progress>,steps=5)=>lessonXp({...initialProgress(),...fields},steps);
 assert.equal(xp({bestCombo:5}),18);
 assert.equal(xp({hearts:2,bestCombo:4}),16);
 assert.equal(xp({hearts:1,bestCombo:1}),12);
 assert.equal(xp({failed:true,bestCombo:5}),0);
 assert.equal(xp({bestCombo:8},8),21);
 assert.equal(xp({bestCombo:9},8),13,'an impossible run earns no run bonus');
});

test('with Plus, mistakes keep the full-hearts XP bonus',()=>{
 let s=run(initialProgress(),[right(0),next,right(1),next,wrong,retry,right(2),next],plus);
 for(let i=3;i<lesson.length;i++)s=run(s,[right(i),next],plus);
 assert.equal(s.complete,true);assert.equal(s.hearts,MAX_HEARTS);assert.equal(s.bestCombo,2);
 assert.equal(lessonXp(s,lesson.length),15);
});
