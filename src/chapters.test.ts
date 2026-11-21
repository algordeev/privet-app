import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons} from './curriculum/catalog.ts';
import {chapterIndices,chapterOf,chapters} from './curriculum/chapters.ts';
import {FREE_LESSONS} from './access.ts';

test('every lesson is in exactly one chapter, and chapters follow course order',()=>{
 const flat=chapters.flatMap(chapter=>chapter.lessonIds);
 assert.deepEqual(flat,nativeLessons.map(lesson=>lesson.id));
 assert.deepEqual(chapters.map(chapter=>chapter.number),[1,2,3]);
 for(const lesson of nativeLessons)assert.ok(chapterOf(lesson.id));
 assert.equal(chapterOf('nope'),null);
});

test('chapter 1 is exactly the free lessons',()=>{
 assert.deepEqual(chapterIndices(chapters[0]),[...Array(FREE_LESSONS).keys()]);
});

test('lesson pictures are the agreed emoji',()=>{
 assert.deepEqual(nativeLessons.map(lesson=>lesson.icon),['☕','👋','🚇','🥖','☀️','🗓️','🎓','🏛️']);
});
