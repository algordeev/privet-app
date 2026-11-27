// Builds public/privet-chirp.wav, the sound of every reminder notification (`npm run build:chirp`).
// Chosen 2026-11-27: chirp B "При-вет trill" from https://claude.ai/artifact/GNCTWxk8HT5KNYPDMx3XyE,
// three happy rising notes. The recipe and synthesis match that page exactly, so the phone plays what was approved.
// The file sits at the top of public/ because the notification plugin looks for sounds only there.
import {writeFileSync} from 'node:fs';

const RATE=44100;
const NOTES=[
 {t:0,d:.07,f0:1319,f1:1319,tone:'triangle',g:.7},
 {t:.085,d:.07,f0:1568,f1:1568,tone:'triangle',g:.7},
 {t:.17,d:.16,f0:2093,f1:2093,tone:'triangle',g:.75,vib:7},
];

function wave(tone,phase,t){
 const s=Math.sin(phase);
 if(tone==='soft-square')return (s+Math.sin(3*phase)/3+Math.sin(5*phase)/6)*.8;
 if(tone==='triangle')return s-Math.sin(3*phase)/9+Math.sin(5*phase)/25;
 if(tone==='bell')return s+.45*Math.sin(2*phase)*Math.exp(-t*9)+.25*Math.sin(3.01*phase)*Math.exp(-t*14);
 return s;
}

export function synth(notes=NOTES){
 const end=Math.max(...notes.map(n=>n.t+n.d))+.03;
 const out=new Float32Array(Math.ceil(end*RATE));
 for(const n of notes){
  const start=Math.floor(n.t*RATE),len=Math.floor(n.d*RATE);
  let phase=0;
  for(let i=0;i<len;i++){
   const t=i/RATE,p=i/len;
   let f=n.f0*Math.pow(n.f1/n.f0,p);
   if(n.vib)f*=1+.012*Math.sin(2*Math.PI*n.vib*t);
   phase+=2*Math.PI*f/RATE;
   const attack=Math.min(1,t/.004);
   const release=n.tone==='bell'?Math.exp(-t*6):Math.min(1,(len-i)/(RATE*.02))*Math.exp(-t*4);
   out[start+i]+=wave(n.tone,phase,t)*attack*release*n.g;
  }
 }
 let peak=0;for(const v of out)peak=Math.max(peak,Math.abs(v));
 const k=.8/(peak||1);for(let i=0;i<out.length;i++)out[i]*=k;
 return out;
}

// 16-bit mono PCM WAV, a format iOS plays for notification sounds.
export function wav(samples){
 const data=Buffer.alloc(samples.length*2);
 samples.forEach((v,i)=>data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),i*2));
 const head=Buffer.alloc(44);
 head.write('RIFF',0);head.writeUInt32LE(36+data.length,4);head.write('WAVE',8);
 head.write('fmt ',12);head.writeUInt32LE(16,16);head.writeUInt16LE(1,20);head.writeUInt16LE(1,22);
 head.writeUInt32LE(RATE,24);head.writeUInt32LE(RATE*2,28);head.writeUInt16LE(2,32);head.writeUInt16LE(16,34);
 head.write('data',36);head.writeUInt32LE(data.length,40);
 return Buffer.concat([head,data]);
}

if(import.meta.url===`file://${process.argv[1]}`){
 const file=new URL('../public/privet-chirp.wav',import.meta.url);
 const samples=synth();
 writeFileSync(file,wav(samples));
 console.log(`Wrote public/privet-chirp.wav: ${(samples.length/RATE).toFixed(2)} s.`);
}
