import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {synth,wav} from '../scripts/build-chirp.mjs';

test('the reminder chirp file is built from its recipe (run npm run build:chirp after changing it)', () => {
 const file=readFileSync(new URL('../public/privet-chirp.wav',import.meta.url));
 assert.ok(file.equals(wav(synth())),'public/privet-chirp.wav is out of date');
 const seconds=(file.length-44)/2/44100;
 assert.ok(seconds>.2&&seconds<30,'iOS plays notification sounds up to 30 seconds');
});

test('every scheduled reminder names the chirp', () => {
 const driver=readFileSync(new URL('./notificationDriver.ts',import.meta.url),'utf8');
 assert.match(driver,/NOTIFICATION_SOUND='privet-chirp\.wav'/);
 assert.match(driver,/sound:NOTIFICATION_SOUND/);
});
