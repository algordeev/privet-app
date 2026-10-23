import {nativeLessons} from './catalog.ts';
import type {Motivation,LessonDefinition} from './types.ts';
// Stable topological ranking. Dependencies always come first; ties keep catalogue order.
// The visible app uses nativeLessons, not this future recommendation extension point.
export function curriculumForMotivation(reason:Motivation|null):readonly LessonDefinition[]{
 const remaining=[...nativeLessons],result:LessonDefinition[]=[];
 while(remaining.length){
  const eligible=remaining.filter(item=>item.prerequisiteIds.every(id=>result.some(done=>done.id===id)));
  if(!eligible.length)throw new Error('Invalid curriculum prerequisites');
  const chosen=(reason&&eligible.find(item=>item.motivationTags.includes(reason)))||eligible[0];
  result.push(chosen);remaining.splice(remaining.indexOf(chosen),1);
 }
 return result;
}
