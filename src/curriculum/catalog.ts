import {cafeLesson as cafeBase} from './lessons/cafe.ts';
import {introductionsLesson as introductionsBase} from './lessons/introductions.ts';
import {lesson as lesson3} from './lessons/around-town.ts';
import {lesson as lesson4} from './lessons/shopping.ts';
import {lesson as lesson5} from './lessons/daily-life.ts';
import {lesson as lesson6} from './lessons/making-plans.ts';
import {lesson as lesson7} from './lessons/studies.ts';
import {lesson as lesson8} from './lessons/culture.ts';
import {withSpeaking} from './speaking.ts';
// The website's lesson preview keeps the original café lesson, without speaking steps (a browser has no recogniser).
export const websiteCafeLesson=cafeBase;
export const cafeLesson=withSpeaking(cafeBase),introductionsLesson=withSpeaking(introductionsBase);
export const nativeLessons=Object.freeze([cafeLesson,introductionsLesson,...[lesson3,lesson4,lesson5,lesson6,lesson7,lesson8].map(withSpeaking)]);
export function lessonById(id:string|undefined){return nativeLessons.find(item=>item.id===id)??cafeLesson;}
export function nextLesson(id:string){const index=nativeLessons.findIndex(item=>item.id===id);return index<0?undefined:nativeLessons[index+1];}
