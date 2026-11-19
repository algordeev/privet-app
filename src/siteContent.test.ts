import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLessons} from './curriculum/catalog.ts';
import {COMPANION_PRICE,PLUS_MONTHLY_PRICE,PLUS_YEARLY_PRICE} from './subscription.ts';
import {GEM_RULES} from './nativeStats.ts';
import {EXERCISE_KINDS,annualSaving,courseWords,gemRules,plusYearly,roadmap,siteDevices,siteLessons,sitePlans,ticker} from './siteContent.ts';

test('the website lists every lesson of the course, in order, with real counts',()=>{
 assert.deepEqual(siteLessons.map(l=>l.id),nativeLessons.map(l=>l.id));
 for(const [i,lesson] of siteLessons.entries()){
  assert.equal(lesson.steps,nativeLessons[i].exercises.length);assert.ok(lesson.words>0);assert.ok(lesson.description);
  for(const kind of lesson.kinds)assert.ok(EXERCISE_KINDS[kind],kind);
 }
 assert.equal(courseWords,nativeLessons.flatMap(l=>l.words).length);
 // Every kind the course uses has a label, and the site names no kind the course lacks.
 assert.deepEqual(new Set(Object.keys(EXERCISE_KINDS)),new Set(nativeLessons.flatMap(l=>l.exercises.map(e=>e.kind))));
 assert.ok(ticker.includes(`${nativeLessons.length} lessons`));
});

test('plans show the app’s own concept prices and the real annual saving',()=>{
 const plan=(id:string)=>sitePlans.find(p=>p.id===id)!;
 assert.equal(plan('plus').price,PLUS_MONTHLY_PRICE);assert.equal(plusYearly.price,PLUS_YEARLY_PRICE);assert.equal(plan('companion').price,COMPANION_PRICE);
 assert.equal(annualSaving,33);// $39.99 against 12 × $4.99, as the app's offer says.
 assert.ok(plan('companion').features.some(f=>/Lifetime Privet Plus/.test(f.text)));
 // Unbuilt Plus extras stay marked as planned.
 assert.deepEqual(plan('plus').features.filter(f=>f.planned).map(f=>f.text),['Full course and practice access','Advanced progress insights']);
});

test('gem rules, devices and roadmap say what the app and hardware actually do',()=>{
 assert.deepEqual(gemRules.map(r=>r.amount),[`+${GEM_RULES.finish}`,`+${GEM_RULES.perfect}`,`+${GEM_RULES.streakWeek}`,`−${GEM_RULES.refill}`,`−${GEM_RULES.freeze}`]);
 assert.deepEqual(siteDevices.map(d=>d.id),['desk','mini','printer']);
 for(const device of siteDevices){assert.ok(device.features.length>=3);assert.match(device.concept,/concept/);}
 // The printer is described by its type only, never by a brand or app name.
 assert.doesNotMatch(JSON.stringify(siteDevices),/iprint|cat printer/i);
 assert.equal(roadmap.filter(step=>step.state==='current').length,1);
});
