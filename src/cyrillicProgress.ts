import {PRODUCT} from './config.ts';
export const CYRILLIC_KEY=`${PRODUCT.storageKey}-cyrillic-quick-start`;
export type CyrillicProgress={version:1;status:'unseen'|'started'|'skipped'|'completed';page:number};
export const initialCyrillic=():CyrillicProgress=>({version:1,status:'unseen',page:0});
export function restoreCyrillic(raw:string|null):CyrillicProgress{
 try{
  const value=JSON.parse(raw??'null');
  if(!value||value.version!==1||!['unseen','started','skipped','completed'].includes(value.status)||!Number.isInteger(value.page)||value.page<0||value.page>3)return initialCyrillic();
  if((value.status==='unseen'||value.status==='skipped')&&value.page!==0||value.status==='completed'&&value.page!==3)return initialCyrillic();
  return {version:1,status:value.status,page:value.page};
 }catch{return initialCyrillic();}
}
export type CyrillicAction={type:'start'|'skip'|'complete'|'reset'}|{type:'page';page:number};
export function updateCyrillic(state:CyrillicProgress,action:CyrillicAction):CyrillicProgress{
 if(action.type==='reset')return initialCyrillic();
 if(action.type==='skip')return state.status==='unseen'?{version:1,status:'skipped',page:0}:state;
 if(action.type==='complete')return {version:1,status:'completed',page:3};
 if(state.status==='completed')return state;
 if(action.type==='start')return {...state,status:'started'};
 if(action.type!=='page')return state;
 return Number.isInteger(action.page)&&action.page>=0&&action.page<=3?{version:1,status:'started',page:action.page}:state;
}
export const recommendCyrillic=(state:CyrillicProgress,lessonHasProgress:boolean)=>state.status==='unseen'&&!lessonHasProgress;
