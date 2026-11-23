import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeLessons} from './curriculum/catalog.ts';
import {parseSaved,restoreSession,savedKey,sessionKey,speakingUpgrade} from './session.ts';
import {NATIVE_STATS_KEY,restoreStats} from './statsStorage.ts';
import {REVIEW_KEY,restoreReview} from './review.ts';
import {REMINDERS_KEY,restoreReminders} from './reminders.ts';
import {CYRILLIC_KEY,restoreCyrillic} from './cyrillicProgress.ts';
import {FIRST_RUN_KEY,restoreFirstRun} from './firstRun.ts';
import {SUBSCRIPTION_KEY,restoreSubscription} from './subscription.ts';

// What Privet 1.0 saves on a learner's device, frozen. Real people keep this data across updates, so
// every later version must read it back without losing anything. If a change to a saved shape makes
// this fail, add a conversion from the old shape (and raise that item's version); never edit the fixture.
const {storage}=JSON.parse(readFileSync(new URL('./fixtures/storage-1.0.json',import.meta.url),'utf8')) as {storage:Record<string,string>};
const stored=(key:string)=>{assert.ok(key in storage,`fixture has ${key}`);return storage[key];};
const parsed=(key:string)=>JSON.parse(stored(key));
const withoutVersion=({version:_,...rest}:Record<string,unknown>)=>rest;
const [cafe,introductions,aroundTown]=nativeLessons;

test('1.0 lesson results still read back: passed lessons, best scores and display choices',()=>{
 for(const lesson of [cafe,introductions]){
  const saved=parsed(savedKey(lesson));
  // Lesson data version 2 added speaking steps: 1.0 results move onto the longer lesson, the new steps
  // counting as done, and everything else (date, hearts, best run, choices) is kept as it was.
  const results=speakingUpgrade(lesson).results(saved.completion.results);
  assert.equal(results.length,lesson.exercises.length);
  assert.deepEqual(results.filter((_,i)=>lesson.exercises[i].kind!=='speak'),saved.completion.results);
  assert.deepEqual(parseSaved(stored(savedKey(lesson)),lesson),{preferences:saved.preferences,completion:{...saved.completion,results},bestFirstTry:Math.max(saved.bestFirstTry,results.filter(Boolean).length)});
 }
});

test('a 1.0 lesson in progress still resumes where it was',()=>{
 assert.deepEqual(restoreSession(stored(sessionKey(aroundTown)),aroundTown),withoutVersion(parsed(sessionKey(aroundTown))));
});

test('1.0 statistics, review schedule, reminders, quick start, welcome and Plus still read back unchanged',()=>{
 assert.deepEqual(restoreStats(stored(NATIVE_STATS_KEY)),parsed(NATIVE_STATS_KEY));
 assert.deepEqual(restoreReview(stored(REVIEW_KEY)),parsed(REVIEW_KEY));
 assert.deepEqual(restoreReminders(stored(REMINDERS_KEY)),parsed(REMINDERS_KEY));
 assert.deepEqual(restoreCyrillic(stored(CYRILLIC_KEY)),parsed(CYRILLIC_KEY));
 assert.deepEqual(restoreFirstRun(stored(FIRST_RUN_KEY)),parsed(FIRST_RUN_KEY));
 assert.deepEqual(restoreSubscription(stored(SUBSCRIPTION_KEY)),parsed(SUBSCRIPTION_KEY));
});

test('lesson data saved before versions existed reads as version 1',()=>{
 const saved=parsed(savedKey(cafe)),session=parsed(sessionKey(aroundTown));
 assert.deepEqual(parseSaved(JSON.stringify(withoutVersion(saved)),cafe),parseSaved(stored(savedKey(cafe)),cafe));
 assert.deepEqual(restoreSession(JSON.stringify(withoutVersion(session)),aroundTown),restoreSession(stored(sessionKey(aroundTown)),aroundTown));
});

test('lesson data from an unknown (newer) version is not misread',()=>{
 assert.equal(parseSaved(JSON.stringify({...parsed(savedKey(cafe)),version:99}),cafe).completion,undefined);
 assert.equal(restoreSession(JSON.stringify({...parsed(sessionKey(aroundTown)),version:99}),aroundTown).revealed.length,0);
});
