import type {Exercise,LessonDefinition,Word} from './types.ts';
import {legacyPatches} from './legacyPatches.ts';

type ItemPatch={set:Record<string,unknown>;unset?:string[]};
type ListPatch={order?:string[];entries:Record<string,ItemPatch>};
type LegacyPatch={description?:string;summary?:string;completionTip?:string;words?:ListPatch;exercises:ListPatch};
const patches:Record<string,LegacyPatch>=legacyPatches;
function applyList<T extends {id:string}>(current:readonly T[],patch:ListPatch):T[]{
 return (patch.order??current.map(item=>item.id)).map(id=>{
  const item={...current.find(item=>item.id===id),...patch.entries[id]?.set} as Record<string,unknown>;
  for(const key of patch.entries[id]?.unset??[])delete item[key];
  return item as T;
 });
}
export function legacyLesson(current:LessonDefinition):LessonDefinition{
 const patch=patches[current.id];
 if(!patch||current.contentRevision!==2)return current;
 return {...current,...patch,contentRevision:1,words:patch.words?applyList<Word>(current.words,patch.words):current.words,exercises:applyList<Exercise>(current.exercises,patch.exercises)};
}
// Missing markers belong to the shipped revision 1. Never reinterpret a saved
// positional attempt as revision 2, including empty attempts and saved results.
// Invalid JSON is left to the existing storage validator; fresh starts use v2.
export function definitionForSaved(current:LessonDefinition,session:string|null,saved:string|null):LessonDefinition{
 if(current.contentRevision!==2)return current;
 try{
  if(session){const data=JSON.parse(session);if(data&&typeof data==='object'&&data.progress&&data.contentRevision!==2)return legacyLesson(current);return current;}
  if(saved){const data=JSON.parse(saved);if(data?.completion&&data.completion.contentRevision!==2)return legacyLesson(current);}
 }catch{/* Malformed storage is handled by normal restoration. */}
 return current;
}
