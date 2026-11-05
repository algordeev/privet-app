import {useCallback,useRef,useState} from 'react';
import {appStorage} from './previewStorage';
import {localDay} from './nativeStats';
import type {Action,Progress} from './engine';
import {REVIEW_KEY,applyPocketAnswers,buildPocketDeck,buildReviewSession,dueKeys,emptyReview,nextDue,recordLesson,recordReview,restorePocketDeck,restoreReview,reviewHomeCard,syncLessons,type PocketApplied,type PocketDeck,type ReviewSession,type ReviewState} from './review';
import {PRODUCT} from './config';
import {dayKey,type PocketAnswer,type PocketEntry} from './pocketProtocol';

// The deck last copied onto the keychain Mini (which words, and how often each had been reviewed then).
export const POCKET_DECK_KEY=`${PRODUCT.storageKey}-pocket-deck`;
function pendingPocketDeck(){try{return restorePocketDeck(appStorage.getItem(POCKET_DECK_KEY));}catch{return undefined;}}

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
 const reset=useCallback(()=>{update(()=>emptyReview());try{appStorage.removeItem(POCKET_DECK_KEY);}catch{/* Nothing to forget. */}},[update]);
 // Pocket deck (keychain Mini): build today's deck, remember the one sent, apply the Mini's answers to it.
 const built=useRef<PocketDeck|undefined>(undefined);
 const [,pocketChanged]=useState(0);
 const pocket=useCallback(()=>({
  pendingDeck:()=>pendingPocketDeck()?.id,
  applyAnswers(answers:readonly PocketAnswer[]):PocketApplied[]{
   const deck=pendingPocketDeck();if(!deck)return [];
   let applied:PocketApplied[]=[];
   update(s=>{const r=applyPocketAnswers(s,deck,answers,localDay(new Date()),dayKey);applied=r.applied;return r.state;});
   return applied;
  },
  buildDeck(id:number):PocketEntry[]|null{const b=buildPocketDeck(state.current!,localDay(new Date()),id);built.current=b?.deck;return b?.entries??null;},
  rememberDeck(id:number){if(built.current?.id===id){try{appStorage.setItem(POCKET_DECK_KEY,JSON.stringify(built.current));}catch{/* Its answers just won't count. */}pocketChanged(n=>n+1);}},
  forgetDeck(){try{appStorage.removeItem(POCKET_DECK_KEY);}catch{/* Already gone. */}pocketChanged(n=>n+1);},
 }),[update]);
 // How many of today's due words are also on the Mini (copied there, not reviewed in the app since).
 const onMini=(()=>{const deck=pendingPocketDeck();if(!deck)return 0;const due=new Set(dueKeys(snapshot,today));return deck.items.filter(i=>due.has(i.key)&&snapshot.items[i.key]?.reviews===i.reviews).length;})();
 const due=dueKeys(snapshot,today).length;
 return {state:snapshot,due,total:Object.keys(snapshot.items).length,nextDue:nextDue(snapshot,today),homeCard:reviewHomeCard(due),onMini,sync,onLessonTransition,start,finish,reset,pocket};
}
export type ReviewController=ReturnType<typeof useReview>;
