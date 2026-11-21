import {nativeLessons} from './catalog.ts';

// The course in chapters. Chapter 1 is exactly the free lessons (FREE_LESSONS in access.ts).
export type Chapter={number:number;title:string;lessonIds:readonly string[]};
export const chapters:readonly Chapter[]=Object.freeze([
 {number:1,title:'First steps',lessonIds:['cafe','introductions','around-town']},
 {number:2,title:'Everyday life',lessonIds:['shopping','daily-life','making-plans']},
 {number:3,title:'Making friends',lessonIds:['studies','culture']},
]);

export const chapterOf=(lessonId:string)=>chapters.find(chapter=>chapter.lessonIds.includes(lessonId))??null;
// Lesson indices (positions in nativeLessons) of one chapter, in course order.
export const chapterIndices=(chapter:Chapter)=>chapter.lessonIds.map(id=>nativeLessons.findIndex(lesson=>lesson.id===id));
