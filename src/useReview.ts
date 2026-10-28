import {useCallback,useRef,useState} from 'react';
import {appStorage} from './previewStorage';
import {localDay} from './nativeStats';
import type {Action,Progress} from './engine';
import {REVIEW_KEY,buildReviewSession,dueKeys,emptyReview,nextDue,recordLesson,recordReview,restoreReview,reviewHomeCard,syncLessons,type ReviewSession,type ReviewState} from './review';

function load(){try{return restoreReview(appStorage.getItem(REVIEW_KEY));}catch{return emptyReview();}}
export function useReview(){
 const state=useRef<ReviewState|null>(null);
 if(!state.current)state.current=load();
 const [snapshot,setSnapshot]=useState(state.current);
 const update=useCallback((transform:(current:ReviewState)=>ReviewState)=>{
  const next=transform(state.current!);if(next===state.current)return;
  state.current=next;setSnapshot(next);
  try{appStorage.setItem(REVIEW_KEY,JSON.stringify(next));}catch{/* Storage is optional. */}
 },[]);
 const today=localDay(new Date());
 const sync=useCallback((completed:{lessonId:string;results:readonly boolean[]}[])=>update(s=>syncLessons(s,completed,localDay(new Date()))),[update]);
 const onLessonTransition=useCallback((previous:Progress,next:Progress,action:Action,lessonId:string)=>{
  if(action.type!=='continue'||previous.complete||!next.complete||next.failed)return;
  update(s=>recordLesson(s,lessonId,next.results,localDay(new Date())));
 },[update]);
 const start=useCallback(()=>buildReviewSession(state.current!,localDay(new Date())),[]);
 const finish=useCallback((session:ReviewSession,results:readonly boolean[])=>update(s=>recordReview(s,session.items,results,localDay(new Date()))),[update]);
 const reset=useCallback(()=>update(()=>emptyReview()),[update]);
 const due=dueKeys(snapshot,today).length;
 return {state:snapshot,due,total:Object.keys(snapshot.items).length,nextDue:nextDue(snapshot,today),homeCard:reviewHomeCard(due),sync,onLessonTransition,start,finish,reset};
}
export type ReviewController=ReturnType<typeof useReview>;
