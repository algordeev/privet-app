import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechController,STARTUP_TIMEOUT_MS,type SpeechSnapshot} from './speechController.ts';

function harness(ready=true){
 let time=0,nextTimer=0,cancels=0;
 const timers=new Map<number,{at:number;fn:()=>void}>();
 const listeners=new Set<()=>void>();
 let voices=ready?[{lang:'ru-RU'} as SpeechSynthesisVoice]:[];
 const spoken:SpeechSynthesisUtterance[]=[];
 const queue:SpeechSynthesisUtterance[]=[];
 const snapshots:SpeechSnapshot[]=[];
 const synth={getVoices:()=>voices,speak:(u:SpeechSynthesisUtterance)=>{spoken.push(u);queue.push(u);},cancel:()=>{cancels++;queue.length=0;},addEventListener:(_name:string,fn:()=>void)=>{listeners.add(fn);},removeEventListener:(_name:string,fn:()=>void)=>{listeners.delete(fn);}};
 const audio=createSpeechController({synth:synth as unknown as SpeechSynthesis,
  utterance:text=>({text,onstart:null,onend:null,onerror:null}) as SpeechSynthesisUtterance,
  now:()=>time,setTimer:(fn,ms)=>{const id=++nextTimer;timers.set(id,{at:time+ms,fn});return id as unknown as ReturnType<typeof setTimeout>;},
  clearTimer:id=>{timers.delete(id as unknown as number);},
 },s=>snapshots.push(s));
 return {audio,spoken,queue,timers,listeners,snapshots,get cancels(){return cancels;},get state(){return snapshots.at(-1)!;},
  loadVoices(list=[{lang:'ru-RU'} as SpeechSynthesisVoice]){voices=list;for(const fn of [...listeners])fn();},
  tick(ms:number){time+=ms;for(const [id,t] of [...timers])if(t.at<=time){timers.delete(id);t.fn();}},
  // Capture handlers before cancellation to model callbacks already queued by WebKit.
  callbacks(index:number){const u=spoken[index];return {start:()=>u.onstart?.call(u,{} as SpeechSynthesisEvent),end:u.onend?.bind(u),error:u.onerror?.bind(u),lateStart:u.onstart?.bind(u)};},
 };
}

test('delayed voice initialization followed by exercise navigation never plays the old word',()=>{
 const h=harness(false);h.audio.speak('кофе');assert.equal(h.state.status,'loading');
 const oldVoiceCallback=[...h.listeners][0];
 h.audio.stop(); // Lesson navigation synchronously cancels before dispatching.
 h.loadVoices();oldVoiceCallback();h.tick(STARTUP_TIMEOUT_MS+1);
 assert.equal(h.spoken.length,0);assert.equal(h.timers.size,0);assert.equal(h.state.status,'idle');
 h.audio.speak('чай');assert.deepEqual(h.spoken.map(u=>u.text),['чай']);
});
test('rapid taps replace pending utterances and ignore stale callbacks',()=>{
 const h=harness();h.audio.speak('кофе');const old=h.callbacks(0);
 h.audio.speak('чай');const latest=h.callbacks(1);
 old.lateStart?.({} as SpeechSynthesisEvent);old.error?.({} as SpeechSynthesisErrorEvent);old.end?.({} as SpeechSynthesisEvent);
 assert.equal(h.state.status,'loading');assert.deepEqual(h.queue.map(u=>u.text),['чай']);
 latest.start();assert.equal(h.state.status,'speaking');assert.equal(h.timers.size,0);
 old.end?.({} as SpeechSynthesisEvent);assert.equal(h.state.status,'speaking');
 latest.end?.({} as SpeechSynthesisEvent);assert.equal(h.state.status,'idle');
});
test('rapid taps during voice initialization start only the latest request',()=>{
 const h=harness(false);h.audio.speak('кофе');h.audio.speak('чай');h.audio.speak('Привет!');
 h.loadVoices();h.loadVoices();assert.deepEqual(h.spoken.map(u=>u.text),['Привет!']);assert.equal(h.timers.size,1);
});
test('closing a lesson cancels pending engine playback and late events',()=>{
 const h=harness();h.audio.speak('кофе');const old=h.callbacks(0);h.audio.stop();
 assert.equal(h.queue.length,0);assert.equal(h.timers.size,0);
 old.lateStart?.({} as SpeechSynthesisEvent);h.loadVoices();h.tick(10000);
 assert.equal(h.state.status,'idle');assert.equal(h.spoken.length,1);assert.ok(h.cancels>=2);
});
test('closing while voices are pending does not autoplay after reopening',()=>{
 const h=harness(false);h.audio.speak('кофе');h.audio.stop();h.loadVoices();
 assert.equal(h.spoken.length,0);h.audio.speak('чай');assert.equal(h.spoken[0].text,'чай');
});
test('startup timeout cancels a silent engine; late events cannot resurrect playback',()=>{
 const h=harness();h.audio.speak('кофе');const old=h.callbacks(0);
 h.tick(STARTUP_TIMEOUT_MS);assert.equal(h.state.status,'error');assert.match(h.state.message,/too long/);
 assert.equal(h.queue.length,0);assert.equal(h.timers.size,0);
 old.lateStart?.({} as SpeechSynthesisEvent);h.loadVoices();assert.equal(h.spoken.length,1);assert.equal(h.state.status,'error');
 h.audio.speak('чай');assert.equal(h.state.status,'loading');assert.equal(h.spoken.length,2);
});
test('voice-loading timeout cannot play after voices eventually arrive',()=>{
 const h=harness(false);h.audio.speak('кофе');h.tick(STARTUP_TIMEOUT_MS);h.loadVoices();
 assert.equal(h.spoken.length,0);assert.equal(h.state.status,'error');
});
test('playback errors are visible and never automatically retried',()=>{
 const h=harness();h.audio.speak('кофе');h.callbacks(0).error?.({} as SpeechSynthesisErrorEvent);
 assert.equal(h.state.status,'error');assert.match(h.state.message,/could not play/);h.loadVoices();h.tick(20000);
 assert.equal(h.spoken.length,1);assert.equal(h.timers.size,0);
});
test('background cancels active/pending audio and foreground never resumes it',()=>{
 for(const ready of [true,false]){
  const h=harness(ready);h.audio.speak('кофе');if(ready)h.callbacks(0).start();
  h.audio.setActive(false);h.loadVoices();h.audio.speak('чай');assert.equal(h.queue.length,0);
  h.audio.setActive(true);h.loadVoices();assert.equal(h.spoken.length,ready?1:0);
  h.audio.speak('Спасибо!');assert.equal(h.queue[0].text,'Спасибо!');
 }
});
test('disposal removes voice listeners and invalidates captured callbacks and timers',()=>{
 const h=harness(false);h.audio.speak('кофе');const oldVoice=[...h.listeners][0];const oldTimer=[...h.timers.values()][0].fn;
 h.audio.dispose();const count=h.snapshots.length;h.loadVoices();oldVoice();oldTimer();h.audio.speak('чай');
 assert.equal(h.listeners.size,0);assert.equal(h.timers.size,0);assert.equal(h.spoken.length,0);assert.equal(h.snapshots.length,count);
});
test('no Russian voice preserves text fallback without speaking another language',()=>{
 const h=harness(false);h.audio.speak('кофе');h.loadVoices([{lang:'en-US'} as SpeechSynthesisVoice]);
 assert.equal(h.state.available,false);assert.equal(h.state.status,'error');assert.match(h.state.message,/unavailable/);assert.equal(h.spoken.length,0);
});
test('a queued old timeout cannot cancel a newer request',()=>{
 const h=harness();h.audio.speak('кофе');const oldTimer=[...h.timers.values()][0].fn;
 h.audio.speak('чай');oldTimer();assert.equal(h.state.status,'loading');assert.equal(h.queue[0].text,'чай');
 h.callbacks(1).start();assert.equal(h.state.status,'speaking');
});
