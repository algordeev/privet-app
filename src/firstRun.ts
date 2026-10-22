import {PRODUCT} from './config.ts';
import type {Progress} from './engine.ts';
export const FIRST_RUN_KEY=`${PRODUCT.storageKey}-first-run`;
export const REASONS=['Travel','Conversations','Studies','Culture'] as const;
export const LEVELS=['New to Russian','I know the Cyrillic alphabet','I know some Russian'] as const;
export type Offer='free'|'plus-monthly'|'plus-yearly'|'companion';
export type FirstRun={version:1;stage:'welcome'|'personalize'|'companion'|'lesson'|'offer'|'confirmation'|'done';reason:typeof REASONS[number]|null;level:typeof LEVELS[number]|null;completed:boolean;replay:boolean;choice:Offer|null};
export const initialFirstRun=():FirstRun=>({version:1,stage:'welcome',reason:null,level:null,completed:false,replay:false,choice:null});
export function restoreFirstRun(raw:string|null,existingLearner=false):FirstRun{
 if(raw===null)return existingLearner?{...initialFirstRun(),stage:'done',completed:true}:initialFirstRun();
 try{
  const s=JSON.parse(raw);
  if(s?.version!==1||!['welcome','personalize','companion','lesson','offer','confirmation','done'].includes(s.stage)||!(s.reason===null||REASONS.includes(s.reason))||!(s.level===null||LEVELS.includes(s.level))||typeof s.completed!=='boolean'||typeof s.replay!=='boolean'||!(s.choice===null||['free','plus-monthly','plus-yearly','companion'].includes(s.choice)))return initialFirstRun();
  if(['companion','lesson','offer','confirmation'].includes(s.stage)&&(!s.reason||!s.level)||s.stage==='done'&&!s.completed||s.stage==='confirmation'&&(!s.choice||s.choice==='free'))return initialFirstRun();
  return {version:1,stage:s.stage,reason:s.reason,level:s.level,completed:s.completed,replay:s.replay,choice:s.choice};
 }catch{return initialFirstRun();}
}
export type FirstRunAction={type:'start'|'personalized'|'lesson'|'offer'|'finish'|'replay'|'resetFlag'|'back'|'resumeLesson'}|{type:'reason';value:typeof REASONS[number]}|{type:'level';value:typeof LEVELS[number]}|{type:'choose';choice:Offer};
export function updateFirstRun(state:FirstRun,action:FirstRunAction):FirstRun{
 switch(action.type){
  case 'back':return {...state,stage:state.stage==='personalize'?'welcome':state.stage==='companion'?'personalize':state.stage==='lesson'?'companion':state.stage};
  case 'resumeLesson':return state.stage==='offer'?{...state,stage:'lesson'}:state;
  case 'start':return state.stage==='welcome'?{...state,stage:'personalize'}:state;
  case 'reason':return REASONS.includes(action.value)?{...state,reason:action.value}:state;
  case 'level':return LEVELS.includes(action.value)?{...state,level:action.value}:state;
  case 'personalized':return state.stage==='personalize'&&state.reason&&state.level?{...state,stage:'companion'}:state;
  case 'lesson':return state.stage==='companion'?{...state,stage:'lesson'}:state;
  case 'offer':return state.stage==='lesson'?{...state,stage:'offer'}:state;
  case 'choose':return state.stage==='offer'?{...state,choice:action.choice,stage:action.choice==='free'?'done':'confirmation',completed:action.choice==='free'||state.completed}:state;
  case 'finish':return state.stage==='confirmation'?{...state,stage:'done',completed:true}:state;
  case 'replay':return {...state,stage:'welcome',replay:true,choice:null};
  case 'resetFlag':return {...state,stage:'welcome',completed:false,replay:state.completed||state.replay,choice:null};
 }
}
export function validFirstLessonResult(progress:Progress){return progress.complete&&!progress.failed&&progress.index===5&&progress.results.length===5&&progress.results.every(value=>typeof value==='boolean')&&progress.hearts>0;}
