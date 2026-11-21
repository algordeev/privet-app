import {useEffect} from 'react';
import {LessonPanel} from './LessonPanel';
import {useLesson,type LessonController} from './useLesson';
import {REVIEW_SESSION_PREFIX} from './nativeStats';
import type {NativeStatsController} from './useNativeStats';
import type {ReviewSession} from './review';
import type {ReviewController} from './useReview';
import type {NativeCompanionController} from './useNativeCompanion';
import type {PhysicalCompanionController} from './usePhysicalCompanion';

// Home: a slim one-line bar while words are due for review; nothing otherwise.
export function ReviewBar({review,onStart}:{review:ReviewController;onStart:()=>void}){
 const {due,onMini}=review;
 if(!due)return null;
 return <button id="native-review-open" className="native-review-bar" aria-label={`Start review, ${due} due`} onClick={onStart}>
  <span className="native-review-bar-icon" aria-hidden="true">↻</span>
  <span className="native-review-bar-text">{due} {due===1?'word':'words'} to review{onMini>0&&<small>{onMini===due?(due===1?'Also on your Mini':'All on your Mini too'):`${onMini} on your Mini too`}</small>}</span>
  <span className="native-review-bar-go">Start <span aria-hidden="true">→</span></span>
 </button>;
}

// One mounted session per started review; hearts are unlimited so review never costs or refills them.
// onPrint: print a strip from this review, with each item's first-try result (only while a printer is connected).
export function NativeReviewSession({session,sessionId,shared,review,companion,physical,activity,onClose,onPrint}:{onPrint?:(session:ReviewSession,results:readonly boolean[])=>void;session:ReviewSession;sessionId:string;shared:LessonController;review:ReviewController;companion:NativeCompanionController;physical:PhysicalCompanionController;activity:NativeStatsController;onClose:()=>void}){
 const controller=useLesson({definition:session.definition,persistSession:false,saveResults:false,unlimitedHearts:true,sharedSpeech:shared.speech,sharedPreferences:{value:shared.preferences,set:shared.setPreferences},onTransition:(previous,next,action)=>{
  companion.onTransition(previous,next,action);
  physical.onTransition(previous,next,action,session.definition.id);
  activity.onTransition(previous,next,action,`${REVIEW_SESSION_PREFIX}${sessionId}`);
  if(action.type==='continue'&&!previous.complete&&next.complete&&!next.failed)review.finish(session,next.results);
 }});
 useEffect(()=>{controller.lessonHeading.current?.focus({preventScroll:true});},[]);
 return <div className="native-lesson-view"><LessonPanel controller={controller} native review onListen={physical.onListen} onListenEnd={physical.onListenEnd} onHint={physical.onHint} onReveal={physical.onReveal} onMatchPair={physical.onMatchPair} nativeCompanion={companion} onPrintPractice={onPrint&&controller.progress.complete?()=>onPrint(session,controller.progress.results):undefined} onClose={onClose}/></div>;
}
