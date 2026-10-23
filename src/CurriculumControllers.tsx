import type {ReactNode} from 'react';
import {nativeLessons} from './curriculum/catalog';
import {useLesson,type LessonController} from './useLesson';
import type {Progress,Action} from './engine';

type Props={plus:boolean;onTransition:(previous:Progress,next:Progress,action:Action,id:string)=>void;children:(controllers:LessonController[])=>ReactNode};
// One stable component per registered lesson keeps hook order independent of
// catalogue length. Controllers share one speech engine and preference source.
export function CurriculumControllers(props:Props){return <LessonNode {...props} index={0} controllers={[]}/>;}
function LessonNode({index,controllers,...props}:Props&{index:number;controllers:LessonController[]}){
 const definition=nativeLessons[index],first=controllers[0];
 const controller=useLesson({persistSession:true,definition,unlimitedHearts:props.plus,sharedSpeech:first?.speech,sharedPreferences:first?{value:first.preferences,set:first.setPreferences}:undefined,onTransition:(previous,next,action)=>props.onTransition(previous,next,action,definition.id)});
 const next=[...controllers,controller];
 return index+1<nativeLessons.length?<LessonNode {...props} index={index+1} controllers={next}/>:props.children(next);
}
