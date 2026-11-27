import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lessonActivityState} from './useLessonActivity.ts';

test('the lesson island keeps its step count in range', () => {
 assert.deepEqual(lessonActivityState(6,12),{done:6,total:12});
 assert.deepEqual(lessonActivityState(14,12),{done:12,total:12});
 assert.deepEqual(lessonActivityState(-1,0),{done:0,total:1});
});

// cap sync copies the FIRST deployment target in the project file into CapApp-SPM/Package.swift. The widget's
// settings (iOS 16.2, for Live Activities) are kept after the app's (iOS 15) so the app keeps supporting iOS 15.
test('the app still supports iOS 15 while the widget extension needs 16.2', () => {
 const project=readFileSync(new URL('../ios/App/App.xcodeproj/project.pbxproj',import.meta.url),'utf8');
 assert.match(project,/IPHONEOS_DEPLOYMENT_TARGET = 15\.0;[\s\S]*IPHONEOS_DEPLOYMENT_TARGET = 16\.2;/,'the first deployment target must be the app\'s 15.0');
 assert.doesNotMatch(project.slice(0,project.indexOf('IPHONEOS_DEPLOYMENT_TARGET = 15.0;')),/IPHONEOS_DEPLOYMENT_TARGET/);
 assert.match(readFileSync(new URL('../ios/App/CapApp-SPM/Package.swift',import.meta.url),'utf8'),/platforms: \[\.iOS\(\.v15\)\]/);
});
