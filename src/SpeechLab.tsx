import {useEffect,useMemo,useRef,useState} from 'react';
import {nativeLessons} from './curriculum/catalog';
import {gradeSpeech,type SpeechVerdict} from './speechMatch';
import {candidates,speechPlugin,type ListenResult,type SpeechSupport} from './speechRecognition';
import './speechLab.css';

// TEMPORARY test screen for the speaking-exercise spike (Settings › Speech lab).
// Not learner UI: it shows raw recogniser output so we can judge accuracy on a real iPhone.
type Target={id:string;group:'Words'|'Phrases'|'Replies';say:string;accepted:string[];guide?:string;cue?:string};
type Attempt={target:string;verdict:SpeechVerdict;result:ListenResult;options:string;at:string};
type Speech={speak:(text:string,onEnd?:()=>void,rate?:number)=>void;stop:()=>void;speaking:boolean};

function allTargets():Target[]{
 const words=new Map<string,Target>(),phrases:Target[]=[],replies:Target[]=[];
 for(const lesson of nativeLessons){
  for(const w of lesson.words)if(!words.has(w.text))words.set(w.text,{id:`w-${w.id}`,group:'Words',say:w.text,accepted:[w.text],guide:`${w.pronunciation} · ${w.meaning}`});
  for(const e of lesson.exercises){
   if(e.kind==='sentence'&&e.answer)phrases.push({id:`p-${lesson.id}-${e.id}`,group:'Phrases',say:e.answer,accepted:[e.answer,...(e.alsoAccepted??[])],guide:e.pronunciationGuide??e.translation});
   if(e.exchange)replies.push({id:`r-${lesson.id}-${e.id}`,group:'Replies',say:e.answer,accepted:[e.answer,...(e.alsoAccepted??[])],cue:e.exchange.text,guide:`${e.exchange.speaker}: ${e.exchange.meaning}`});
  }
 }
 return [...words.values(),...phrases,...replies];
}

const meterWidth=(db:number)=>`${Math.max(0,Math.min(100,(db+60)*100/50))}%`;
const verdictLabel:Record<SpeechVerdict['type'],string>={match:'✅ Match',close:'🟡 Close',wrong:'❌ Wrong',silence:'🔇 Nothing heard'};

export function SpeechLab({speech,onClose}:{speech:Speech;onClose:()=>void}){
 const targets=useMemo(allTargets,[]);
 const [targetId,setTargetId]=useState(targets[0]?.id??'');
 const [custom,setCustom]=useState('');
 const [support,setSupport]=useState<SpeechSupport|null>(null);
 const [onDeviceOnly,setOnDeviceOnly]=useState(true);
 const [bias,setBias]=useState(false);
 const [silenceMs,setSilenceMs]=useState(1200);
 const [state,setState]=useState<'idle'|'listening'|'checking'>('idle');
 const [db,setDb]=useState(-60);
 const [partial,setPartial]=useState('');
 const [error,setError]=useState('');
 const [log,setLog]=useState<Attempt[]>([]);
 const alive=useRef(true);
 const target:Target=custom.trim()?{id:'custom',group:'Words',say:custom.trim(),accepted:[custom.trim()]}:targets.find(t=>t.id===targetId)??targets[0];

 useEffect(()=>{
  alive.current=true;
  speechPlugin.status().then(s=>{if(alive.current)setSupport(s);},e=>setError(String(e?.message??e)));
  const handles=[
   speechPlugin.addListener('level',({db})=>setDb(db)),
   speechPlugin.addListener('partial',({text})=>setPartial(text)),
   speechPlugin.addListener('state',({state})=>{setState(state);if(state==='idle')setDb(-60);}),
  ];
  return ()=>{alive.current=false;void speechPlugin.stop().catch(()=>{});handles.forEach(h=>void h.then(x=>x.remove()));};
 },[]);

 async function authorize(){
  setError('');
  try{setSupport(await speechPlugin.authorize());}catch(e){setError(String((e as Error)?.message??e));}
 }

 async function listen(){
  setError('');setPartial('');speech.stop();
  const options={onDeviceOnly,contextualStrings:bias?target.accepted:[],silenceMs};
  try{
   const result=await speechPlugin.start(options);
   if(!alive.current)return;
   const verdict=gradeSpeech(candidates(result),target.accepted);
   setLog(list=>[{target:target.say,verdict,result,options:`${onDeviceOnly?'on-device':'server ok'}${bias?', biased':''}, pause ${silenceMs}ms`,at:new Date().toLocaleTimeString()},...list].slice(0,40));
  }catch(e){
   const err=e as {code?:string;message?:string};
   setError(`${err.code??'ERROR'}: ${err.message??String(e)}`);setState('idle');
  }
 }

 const play=(then?:()=>void)=>speech.speak(target.cue??target.say,then);
 const copyLog=()=>{void navigator.clipboard?.writeText(JSON.stringify(log,null,1)).catch(()=>{});};
 const latest=log[0];

 return <div className="native-profile-scroll native-settings-screen speech-lab">
  <header className="native-profile-navigation">
   <button className="app-icon-button" aria-label="Back to settings" onClick={()=>{void speechPlugin.stop().catch(()=>{});speech.stop();onClose();}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
   <h1 tabIndex={-1}>Speech lab</h1><span/>
  </header>
  <div className="native-settings-list">
   <section className="native-settings-card">
    <h2>Support</h2>
    {support?<dl className="speech-lab-status">
     <dt>Microphone</dt><dd>{support.microphone}</dd>
     <dt>Speech recognition</dt><dd>{support.speech}</dd>
     <dt>Russian recogniser</dt><dd>{support.recognizer?(support.available?'available':'not available now'):'none'}</dd>
     <dt>On-device Russian</dt><dd><strong>{support.onDevice?'yes':'NO'}</strong></dd>
    </dl>:<p>Checking…</p>}
    {support&&(support.microphone!=='granted'||support.speech!=='granted')&&<button className="button teal" onClick={authorize}>Allow microphone &amp; speech</button>}
   </section>

   <section className="native-settings-card">
    <h2>Target</h2>
    <select className="speech-lab-select" value={targetId} onChange={e=>{setTargetId(e.target.value);setCustom('');}}>
     {(['Words','Phrases','Replies'] as const).map(group=><optgroup key={group} label={group}>
      {targets.filter(t=>t.group===group).map(t=><option key={t.id} value={t.id}>{t.cue?`${t.cue} → ${t.say}`:t.say}</option>)}
     </optgroup>)}
    </select>
    <input className="speech-lab-input" placeholder="…or type any Russian" value={custom} onChange={e=>setCustom(e.target.value)} lang="ru"/>
    <div className="speech-lab-target">
     {target.cue&&<p className="speech-lab-cue">«{target.cue}» → reply:</p>}
     <p className="speech-lab-say" lang="ru">{target.say}</p>
     {target.guide&&<p className="speech-lab-guide">{target.guide}</p>}
     {target.accepted.length>1&&<p className="speech-lab-guide">Also accepted: {target.accepted.slice(1).join(' / ')}</p>}
    </div>
   </section>

   <section className="native-settings-card">
    <h2>Listen</h2>
    <div className="speech-lab-actions">
     <button className="button" disabled={state!=='idle'} onClick={()=>play()}>🔊 Play {target.cue?'cue':'model'}</button>
     <button className="button teal" disabled={state==='checking'} onClick={()=>state==='listening'?void speechPlugin.stop():void listen()}>{state==='listening'?'■ Stop':state==='checking'?'Checking…':'🎤 Record'}</button>
     <button className="button" disabled={state!=='idle'} onClick={()=>play(()=>void listen())}>🔊 then 🎤</button>
    </div>
    <div className={`speech-lab-meter ${state}`}><span style={{width:meterWidth(db)}}/></div>
    <p className="speech-lab-partial" lang="ru">{state==='idle'?' ':partial||'…'}</p>
    {error&&<p className="speech-lab-error">{error}</p>}
    <label className="speech-lab-option"><input type="checkbox" checked={onDeviceOnly} onChange={e=>setOnDeviceOnly(e.target.checked)}/> On-device only (off = Apple servers, comparison only)</label>
    <label className="speech-lab-option"><input type="checkbox" checked={bias} onChange={e=>setBias(e.target.checked)}/> Hint the expected answer to the recogniser</label>
    <label className="speech-lab-option">Stop after a pause of <select value={silenceMs} onChange={e=>setSilenceMs(Number(e.target.value))}>{[800,1200,1600,2000].map(ms=><option key={ms} value={ms}>{ms} ms</option>)}</select></label>
   </section>

   {latest&&<section className="native-settings-card">
    <h2>{verdictLabel[latest.verdict.type]}{latest.verdict.type==='close'?`, missing: ${latest.verdict.missing.join(' ')}`:''}</h2>
    <p className="speech-lab-guide">Ended by: {latest.result.reason} · listened {latest.result.listenedMs} ms · result {latest.result.checkMs} ms after the mic closed · {latest.result.onDevice?'on-device':'server'}</p>
    <ol className="speech-lab-alts" lang="ru">{latest.result.alternatives.map((a,i)=><li key={i}>{a.text||'(empty)'} <small>{a.confidence.toFixed(2)}</small></li>)}</ol>
    {latest.result.segments.some(s=>s.alternatives.length)&&<p className="speech-lab-guide" lang="ru">Per word: {latest.result.segments.map(s=>s.alternatives.length?`${s.text} (${s.alternatives.join(', ')})`:s.text).join(' · ')}</p>}
    {latest.result.error&&<p className="speech-lab-guide">Recogniser note: {latest.result.error}</p>}
    <p className="speech-lab-guide">After this, tap 🔊 Play: the model word should still come from the loudspeaker at normal volume.</p>
   </section>}

   {log.length>0&&<section className="native-settings-card">
    <h2>Attempts ({log.length})</h2>
    <ul className="speech-lab-log" lang="ru">{log.map((a,i)=><li key={i}><span>{verdictLabel[a.verdict.type].split(' ')[0]}</span> {a.target} → {a.verdict.type==='silence'?'—':a.verdict.heard} <small>{a.at} · {a.options}</small></li>)}</ul>
    <div className="speech-lab-actions">
     <button className="button" onClick={copyLog}>Copy log</button>
     <button className="native-text-button" onClick={()=>setLog([])}>Clear</button>
    </div>
   </section>}
  </div>
 </div>;
}
