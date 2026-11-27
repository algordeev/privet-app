import {useEffect,useRef} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';

// The Live Activity for a lesson or a review (agreed 2026-11-27; reviews added 2026-11-28, https://claude.ai/artifact/8GBaqd68M3urexcsbjrhkT): the robot head
// and your place in the lesson, in the Dynamic Island and on the Lock Screen while you're away from the app.
// iOS's side is ios/App/App/PrivetLiveActivityPlugin.swift and the PrivetWidgets extension. It starts when a lesson
// opens (iOS only lets an activity start while the app is in front) and ends when the lesson is finished or closed.
// There's no "finished" card: iOS hides an app's own activity while the app is open, so it would never be seen.
// It doesn't show the companion either: the user dropped that line, and the app suspends its Bluetooth link
// whenever it leaves the foreground, so it would have read "disconnected" anyway.
export type LessonActivityState={done:number;total:number};
type Plugin={
 start(options:{lessonId:string;title:string}&LessonActivityState):Promise<{started:boolean}>;
 update(options:LessonActivityState):Promise<void>;
 end():Promise<void>;
};
const plugin=registerPlugin<Plugin>('PrivetLiveActivity');
const available=()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('PrivetLiveActivity');

export const lessonActivityState=(done:number,total:number):LessonActivityState=>({done:Math.max(0,Math.min(done,Math.max(1,total))),total:Math.max(1,total)});

// The island's title, as shown: "Lesson 5 · Daily life", or "Review · 8 words" (reviews count for the streak too).
export const lessonActivityTitle=(number:number,title:string)=>`Lesson ${number} · ${title}`;
export const reviewActivityTitle=(words:number)=>`Review · ${words} ${words===1?'word':'words'}`;

type Lesson={id:string;title:string};
export function useLessonActivity({lesson,active,finished,done,total}:{lesson:Lesson;active:boolean;finished:boolean;done:number;total:number}){
 // Calls go to iOS one after another, so an update never overtakes the start it belongs to.
 const queue=useRef<Promise<unknown>>(Promise.resolve());
 const send=(call:()=>Promise<unknown>)=>{queue.current=queue.current.then(call).catch(()=>{/* No island this time; the lesson is unaffected. */});};
 const running=useRef(false);
 const state=lessonActivityState(done,total);
 const latest=useRef(state);latest.current=state;

 // Leaving the lesson (or switching to another) ends it at once.
 useEffect(()=>{
  if(!available()||!active)return;
  return ()=>{if(running.current){running.current=false;send(()=>plugin.end());}};
 },[active,lesson.id]);

 // An open, unfinished lesson starts it (also when a finished one is replayed); finishing ends it.
 useEffect(()=>{
  if(!available()||!active)return;
  if(!finished&&!running.current){running.current=true;send(()=>plugin.start({lessonId:lesson.id,title:lesson.title,...latest.current}));}
  else if(finished&&running.current){running.current=false;send(()=>plugin.end());}
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[active,lesson.id,finished]);

 useEffect(()=>{
  if(!available()||!active||finished||!running.current)return;
  send(()=>plugin.update(latest.current));
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[state.done,state.total]);
}
