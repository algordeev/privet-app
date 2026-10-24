import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {companionCardFixtures} from '../scripts/companion-card-fixtures.ts';
test('actual fixed-buffer firmware receiver passes portable C++ protocol regressions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'privet-cards-'));try{
  const compile=spawnSync('c++',['-std=c++11','-Wall','-Wextra','-Werror','-Ifirmware/PrivetBLE_Servo_New_Emotions_v2','scripts/test-learning-cards.cpp','-o',join(dir,'receiver')],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr||String(compile.error));
  const run=spawnSync(join(dir,'receiver'),[],{encoding:'utf8',input:companionCardFixtures().map(c=>c.primary+'\t'+c.secondary).join('\n')+'\n'});assert.equal(run.status,0,run.stdout+run.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('firmware connection callback cannot independently start CONNECTED; callback has no rendering/servo',()=>{
 const source=readFileSync('firmware/PrivetBLE_Servo_New_Emotions_v2/PrivetBLE_Servo_New_Emotions_v2.ino','utf8');const connect=source.slice(source.indexOf('void onConnect('),source.indexOf('void onDisconnect('));assert.doesNotMatch(connect,/requestFace\(CONNECTED\)|startServoReaction|drawFace/);
 const callback=source.slice(source.indexOf('class CommandCallbacks'),source.indexOf('\nvoid setup()'));assert.doesNotMatch(callback,/getValue\(|drawFace\(|startServoReaction\(|Wire\.|delay\(/);assert.match(source,/wakeTransition\.awake\(phoneConnected\.load\(\)\)/);
 assert.match(callback,/requestFace\(packet\[6\]\);\s* wakeTransition\.acceptReaction\(\)/);
 assert.match(source,/requested != seenMailbox \|\| waking/);
 const loop=source.slice(source.indexOf('void loop()'));assert.match(loop,/portENTER_CRITICAL\(&cardsMux\);\s*const auto expired=cards\.expire\(millis\(\)\);\s*portEXIT_CRITICAL\(&cardsMux\);\s*if\(expired\.send/);
 assert.match(source,/PrivetMotion::target/);assert.match(source,/updateServo\(millis\(\)\);\s*u8x8_DrawTile/);assert.doesNotMatch(source,/oled\.sendBuffer\(/);assert.match(source,/displayRefresh\.present\(oled\.getBufferPtr\(\)/);
 assert.match(source,/PrivetFaces::roundedRadius\(w,h,r\)/);assert.match(source,/U8G2_R2/);assert.match(source,/SERVO_MIN_US = 1300/);assert.match(source,/SERVO_MAX_US = 1700/);
});
