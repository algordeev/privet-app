import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {companionCardFixtures} from '../scripts/companion-card-fixtures.ts';
import {buildPocketDeck,emptyReview,reviewSources} from './review.ts';
import {deckFrames} from './pocketProtocol.ts';
test('actual fixed-buffer firmware receiver passes portable C++ protocol regressions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'privet-cards-'));try{
  const compile=spawnSync('c++',['-std=c++11','-Wall','-Wextra','-Werror','-Ifirmware/PrivetBLE_Servo_New_Emotions_v2','scripts/test-learning-cards.cpp','-o',join(dir,'receiver')],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr||String(compile.error));
  const run=spawnSync(join(dir,'receiver'),[],{encoding:'utf8',input:companionCardFixtures().map(c=>c.primary+'\t'+c.secondary).join('\n')+'\n'});assert.equal(run.status,0,run.stdout+run.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('S3 servo gestures stay in range, finish within each reaction, survive smoothing and return home',()=>{
 const dir=mkdtempSync(join(tmpdir(),'privet-servo-'));try{
  const compile=spawnSync('c++',['-std=c++17','-Wall','-Wextra','-Werror','-Ifirmware/PrivetBLE_S3','scripts/test-servo-motion.cpp','-o',join(dir,'servo')],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr||String(compile.error));
  const run=spawnSync(join(dir,'servo'),[],{encoding:'utf8'});assert.equal(run.status,0,run.stdout+run.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('v5 motion sense detects lifts, set-downs, shakes, tipping and tilts, but not bumps, servo shake or a steady hand',()=>{
 const dir=mkdtempSync(join(tmpdir(),'privet-motion-'));try{
  const compile=spawnSync('c++',['-std=c++17','-Wall','-Wextra','-Werror','-Ifirmware/PrivetBLE_S3_v5','scripts/test-motion-sense.cpp','-o',join(dir,'motion')],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr||String(compile.error));
  const run=spawnSync(join(dir,'motion'),[],{encoding:'utf8'});assert.equal(run.status,0,run.stdout+run.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Privet Mini v0.6 motion (tilt look, shake, toss), buttons (short, hold, both), pocket words and power (dim, deep sleep) pass their host checks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'privet-mini-logic-'));try{
  for(const name of ['motion','buttons','words','power']){
   const compile=spawnSync('c++',['-std=c++17','-Wall','-Wextra','-Werror','-Ifirmware/PrivetMini_v0.6',`scripts/test-mini-${name}.cpp`,'-o',join(dir,name)],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr||String(compile.error));
   const run=spawnSync(join(dir,name),[],{encoding:'utf8'});assert.equal(run.status,0,name+': '+run.stdout+run.stderr);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Privet Mini v0.7 pocket deck: host checks pass, and every course word sent by the app loads in the firmware unchanged',()=>{
 const dir=mkdtempSync(join(tmpdir(),'privet-mini-deck-'));try{
  for(const name of ['deck','deck-wire']){
   const compile=spawnSync('c++',['-std=c++17','-Wall','-Wextra','-Werror','-Ifirmware/PrivetMini_v0.7',`scripts/test-mini-${name}.cpp`,'-o',join(dir,name)],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr||String(compile.error));
  }
  const run=spawnSync(join(dir,'deck'),[],{encoding:'utf8'});assert.equal(run.status,0,'deck: '+run.stdout+run.stderr);
  const words=reviewSources().filter(s=>s.word);
  for(let start=0;start<words.length;start+=20){
   const slice=words.slice(start,start+20);
   const state={...emptyReview(),items:Object.fromEntries(slice.map((w,i)=>[w.key,{box:i%2?3:0,due:'2026-11-01',lapses:0,reviews:0}]))};
   const built=buildPocketDeck(state,'2026-11-06',1000+start)!;
   const hex=deckFrames(start+1,built.deck.id,built.entries).map(f=>Buffer.from(f.buffer,f.byteOffset,f.byteLength).toString('hex')).join('\n')+'\n';
   const wire=spawnSync(join(dir,'deck-wire'),[],{encoding:'utf8',input:hex});assert.equal(wire.status,0,wire.stdout+wire.stderr);
   const [head,...cards]=wire.stdout.trim().split('\n');
   assert.equal(head,`deck ${built.deck.id} ${built.entries.length}`);
   assert.deepEqual(cards,built.entries.map(e=>`${e.englishFirst?1:0}\t${e.russian}\t${e.meaning}`));
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Privet Mini v0.8 sound (tunes, levels, Off, soft sounds, replacing) and its copied motion, buttons, words, power and deck pass their host checks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'privet-mini-v08-'));try{
  for(const name of ['sound','motion','buttons','words','power','deck']){
   const compile=spawnSync('c++',['-std=c++17','-Wall','-Wextra','-Werror','-Ifirmware/PrivetMini_v0.8',`scripts/test-mini-${name}.cpp`,'-o',join(dir,name)],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr||String(compile.error));
   const run=spawnSync(join(dir,name),[],{encoding:'utf8'});assert.equal(run.status,0,name+': '+run.stdout+run.stderr);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Privet Mini v0.8 advertises sound only with a working buzzer and accepts SET_VOLUME levels 0-4 with the preview bit',()=>{
 const source=readFileSync('firmware/PrivetMini_v0.8/PrivetMini_v0.8.ino','utf8');
 assert.match(source,/BUZZER_PIN = 9;\s+\/\/ D10/);
 assert.match(source,/\(buzzerReady\.load\(\) \? 16 : 0\)/);
 assert.match(source,/cmd == SET_VOLUME\) result = !buzzerReady\.load\(\) \? 1 : \(arg & ~VOLUME_PREVIEW\) >= MiniSound::LEVELS \? 2 : 0;/);
 assert.match(source,/if \(current == LISTENING\) stopSound\("phone speaking"\);/);
});
test('Privet Mini v0.9 battery (curve, smoothing, no cell, charging, low, the icon, faces clear of its corner) and its copied sound, motion, buttons, words, power and deck pass their host checks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'privet-mini-v09-'));try{
  for(const name of ['battery','sound','motion','buttons','words','power','deck']){
   const compile=spawnSync('c++',['-std=c++17','-Wall','-Wextra','-Werror','-Ifirmware/PrivetMini_v0.9',`scripts/test-mini-${name}.cpp`,'-o',join(dir,name)],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr||String(compile.error));
   const run=spawnSync(join(dir,name),[],{encoding:'utf8'});assert.equal(run.status,0,name+': '+run.stdout+run.stderr);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Privet Mini v0.9 reads the 10k/10k divider on D0 and draws the battery icon over faces only',()=>{
 const source=readFileSync('firmware/PrivetMini_v0.9/PrivetMini_v0.9.ino','utf8');
 assert.match(source,/BATTERY_PIN = 1;\s+\/\/ D0/);
 assert.match(source,/BATTERY_DIVIDER_FITTED = true;/);
 assert.match(source,/BATTERY_DIVIDER = 2\.0f;/);
 assert.match(source,/if \(screen != FACE\) \{ drawScreen\(now\); overFace = screen == REVIEW_FEEDBACK; \}/);
 assert.match(source,/drawCard\(cardLayout, shownCard\);\s+overFace = false;/);
 assert.match(source,/if \(overFace\) drawBatteryCorner\(now\);\s+oled\.sendBuffer\(\);/);
});
test('S3 servos use one fixed LEDC channel each and release by duty 0, never by detaching',()=>{
 const source=readFileSync('firmware/PrivetBLE_S3/PrivetBLE_S3.ino','utf8');
 assert.doesNotMatch(source,/#include <ESP32Servo\.h>|\.detach\(\)|\.attach\(/);
 assert.match(source,/ready = ledcAttach\(pin, SERVO_PWM_HZ, SERVO_PWM_BITS\);/);
 assert.match(source,/void release\(\) \{\s*ledcWrite\(pin, 0\);/);
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
test('Privet Mini faces (v0.6 and v0.9): every reaction and local face draws a face, and the app draws the firmware\'s exact sleeping, CONNECTED and IDLE pixels',async()=>{
 const {renderMiniFace}=await import('./miniFaces.ts');
 for(const folder of ['PrivetMini_v0.6','PrivetMini_v0.9']){
 const dir=mkdtempSync(join(tmpdir(),'privet-mini-faces-'));try{
  const compile=spawnSync('c++',['-std=c++17','-Wall','-Wextra','-Werror',`-Ifirmware/${folder}`,'scripts/test-mini-faces.cpp','-o',join(dir,'faces')],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr||String(compile.error));
  const cases:[('sleeping'|'connected'|'idle'),number,number][]=[];
  for(let t=0;t<9600;t+=40)cases.push(['sleeping',t,t]);
  for(let t=0;t<2400;t+=10)cases.push(['connected',t,t]);
  for(let t=0;t<16000;t+=25)cases.push(['idle',t,t+7]);
  cases.push(['idle',60000,61234],['idle',60000,4300*20+50]);
  const code={sleeping:'sleeping',connected:'9',idle:'4'};
  const run=spawnSync(join(dir,'faces'),[],{encoding:'utf8',maxBuffer:64<<20,input:cases.map(([face,age,now])=>`${code[face]} ${age} ${now}`).join('\n')+'\n'});assert.equal(run.status,0,run.stdout+run.stderr);
  const frames=run.stdout.trim().split('\n');assert.equal(frames.length,cases.length);
  cases.forEach(([face,age,now],i)=>assert.equal(Array.from(renderMiniFace(face,age,now)).join(''),frames[i],`${folder}: ${face} at ${age} ms (clock ${now})`));
 }finally{rmSync(dir,{recursive:true,force:true});}
 }
});
