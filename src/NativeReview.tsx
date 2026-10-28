import {useEffect} from 'react';
import {LessonPanel} from './LessonPanel';
import {useLesson,type LessonController} from './useLesson';
import {REVIEW_SESSION_PREFIX,localDay,shiftDay} from './nativeStats';
import type {NativeStatsController} from './useNativeStats';
import type {ReviewSession} from './review';
import type {ReviewController} from './useReview';
import type {NativeCompanionController} from './useNativeCompanion';
import type {PhysicalCompanionController} from './usePhysicalCompanion';

function whenDue(day:string|undefined){
 const today=localDay(new Date());
 if(!day)return 'later';
 if(day===shiftDay(today,1))return 'tomorrow';
 const days=Math.round((Date.parse(`${day}T12:00:00Z`)-Date.parse(`${today}T12:00:00Z`))/86400000);
 return `in ${days} days`;
}
export function ReviewHomeCard({review,onStart}:{review:ReviewController;onStart:()=>void}){
 if(!review.total)return null;
 const {due}=review;
 return <section className={`native-quick-card is-collapsed native-review-card${due?' is-due':''}`} aria-labelledby="native-review-title"><span className="native-quick-monogram" aria-hidden="true">↻</span><div><h2 id="native-review-title" tabIndex={-1}>Review</h2><p>{due?`${due} ${due===1?'word or phrase is':'words and phrases are'} ready.`:`All caught up. Next review ${whenDue(review.nextDue)}.`}</p></div>{due>0&&<button id="native-review-open" className="native-quick-open" aria-label={`Start review, ${due} due`} onClick={onStart}>Start <span aria-hidden="true">→</span></button>}</section>;
}

// One mounted session per started review; hearts are unlimited so review never costs or refills them.
export function NativeReviewSession({session,sessionId,shared,review,companion,physical,activity,onClose}:{session:ReviewSession;sessionId:string;shared:LessonController;review:ReviewController;companion:NativeCompanionController;physical:PhysicalCompanionController;activity:NativeStatsController;onClose:()=>void}){
 const controller=useLesson({definition:session.definition,persistSession:false,saveResults:false,unlimitedHearts:true,sharedSpeech:shared.speech,sharedPreferences:{value:shared.preferences,set:shared.setPreferences},onTransition:(previous,next,action)=>{
  companion.onTransition(previous,next,action);
  physical.onTransition(previous,next,action,session.definition.id);
  activity.onTransition(previous,next,action,`${REVIEW_SESSION_PREFIX}${sessionId}`);
  if(action.type==='continue'&&!previous.complete&&next.complete&&!next.failed)review.finish(session,next.results);
 }});
 useEffect(()=>{controller.lessonHeading.current?.focus({preventScroll:true});},[]);
 return <div className="native-lesson-view"><LessonPanel controller={controller} native review onListen={physical.onListen} onListenEnd={physical.onListenEnd} onHint={physical.onHint} onReveal={physical.onReveal} onMatchPair={physical.onMatchPair} nativeCompanion={companion} onClose={onClose}/></div>;
}
