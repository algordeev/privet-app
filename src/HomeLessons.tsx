import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type ReactElement,type RefObject} from 'react';
import type {LessonController} from './useLesson';
import type {CyrillicController} from './useCyrillicProgress';
import {lessonStarted} from './nativeCompanion';
import {lessonOpen} from './access';
import {homeOrder} from './homeOrder';
import {glideFrom,positions,reducedMotion,REORDER_DELAY,useHomeReorder} from './useHomeReorder';
import {chapterOf,chapters,type Chapter} from './curriculum/chapters';
import {lessonArt} from './lessonArt';
import {homeMemory,newlyPassedSince} from './homeMemory';

// Home's lessons, grouped into chapters. One card at a time is big (its drawn scene, phrases, progress and
// button): by default the recommended Cyrillic quick start for a newcomer, otherwise the lesson up next.
// Tapping any other row makes that one big and the previous big card a row again. Passed lessons sit under
// "Completed"; a finished chapter folds into one line. A newly passed lesson glides down (useHomeReorder).
// `unlocked`: Plus was just bought from a locked lesson (focus) or the unlock button (no focus). Home first shows
// the locks, then they spring open one by one, top to bottom (useUnlockShow), and the tapped lesson glows once.
type Props={controllers:LessonController[];plus:boolean;onStart:(id:string)=>void;onUnlock?:()=>void;onboarding?:CyrillicController;onQuickStart?:()=>void;unlocked?:{focus:string|null}|null};
const CYRILLIC='cyrillic',NONE='none';
// Each lock waits this much after the one above it; one lock's own animation lasts LOCK_OFF.
const LOCK_STAGGER=80,LOCK_OFF=900,GLOW=1500;
type UnlockPhase='locked'|'opening'|'done'|null;

const tint=(id:string)=>({'--t':lessonArt[id]?.tint,'--d':lessonArt[id]?.ink}) as CSSProperties;
const best=({saved,progress}:LessonController)=>Math.max(saved.bestFirstTry??saved.completion?.results.filter(Boolean).length??0,progress.complete?progress.results.filter(Boolean).length:0);
const action=(item:LessonController,open:boolean)=>!open?'Unlock with Plus':item.progress.complete?'See your results':item.passed?'Continue practice':lessonStarted(item)?'Continue lesson':'Start lesson';
// A small drawn padlock; its shackle springs open while home shows Plus arriving.
const Padlock=()=><svg className="home-lock" viewBox="0 0 16 18" aria-hidden="true"><path className="home-lock-shackle" d="M4.6 8.2V5.6a3.4 3.4 0 0 1 6.8 0v2.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/><rect x="2.4" y="8" width="11.2" height="8.6" rx="2.3" fill="currentColor"/><circle cx="8" cy="12.3" r="1.3" fill="#fffdf7"/></svg>;
const listWords=(numbers:number[])=>numbers.length===1?`chapter ${numbers[0]}`:`chapters ${numbers.slice(0,-1).join(', ')} and ${numbers.at(-1)}`;
// The big card's picture; tapping it shrinks the card back to a row.
const Scene=({id,title,onClose}:{id:string;title:string;onClose:()=>void})=>lessonArt[id]?<button className="home-scene" aria-label={`${lessonArt[id].alt} Tap to show ${title} as a row.`} onClick={onClose}><span aria-hidden="true" dangerouslySetInnerHTML={{__html:lessonArt[id].scene}}/></button>:null;

export function HomeLessons({controllers,plus:realPlus,onStart,onUnlock,onboarding,onQuickStart,unlocked}:Props){
 const list=useRef<HTMLDivElement>(null);
 const ids=controllers.map(item=>item.definition.id);
 const realAccess=(plus:boolean)=>controllers.map((item,index)=>{const started=lessonStarted(item);return {index,plus,started,passed:item.passed,open:lessonOpen({index,plus,started,passed:item.passed})};});
 const lockCount=realAccess(false).filter(lesson=>!lesson.open).length;
 // Right after a lesson was newly passed, its glide to Completed goes first and the locks open after it.
 const [restore]=useState(()=>!newlyPassedSince(ids.filter((_,index)=>realAccess(realPlus)[index].passed)));
 const phase=useUnlockShow(unlocked&&realPlus&&lockCount>0?unlocked:null,list,lockCount,restore?500:REORDER_DELAY+700);
 // While the locks are still on screen, home is drawn as it was without Plus.
 const plus=phase==='locked'||phase==='opening'?false:realPlus;
 const access=realAccess(plus);
 const shown=useHomeReorder(ids.filter((_,index)=>access[index].passed),ids.filter((_,index)=>access[index].started&&!access[index].passed),list);
 // The order may briefly show the last-seen state before it moves; what each card says follows the real state.
 const isPassed=(index:number)=>shown.passed.has(ids[index]);
 const order=homeOrder(access.map((lesson,index)=>({...lesson,passed:isPassed(index),started:shown.started.has(ids[index])||isPassed(index)})));
 // The big card and opened chapters come back as you left them, unless a lesson was just passed (restore, above).
 const [folds,setFolds]=useState<number[]>(()=>restore?homeMemory.folds:[]);
 const indicesOf=(chapter:Chapter)=>chapter.lessonIds.map(id=>ids.indexOf(id)).filter(index=>index>=0);
 const lead=order.upNext??order.upcoming[0]??null;
 const leadChapter=lead===null?null:chapterOf(ids[lead]);
 const cyrillicStatus=onboarding?.state.status;
 // Which card is big: the one tapped, otherwise the quick start for a true newcomer (no lesson started yet,
 // quick start never opened or skipped), otherwise the lesson that leads.
 // Locked lessons are never big without Plus; NONE is "all cards shrunk" after tapping a picture.
 const newcomer=cyrillicStatus==='unseen'&&access.every(lesson=>!lesson.started&&!lesson.passed);
 const [picked,setPicked]=useState<string|null>(()=>restore?homeMemory.picked:null);
 useEffect(()=>{homeMemory.picked=picked;homeMemory.folds=folds;},[picked,folds]);
 const canBeBig=(id:string)=>id===CYRILLIC?cyrillicStatus==='unseen':ids.includes(id)&&access[ids.indexOf(id)].open;
 const fallback=newcomer?CYRILLIC:lead!==null&&access[lead].open?ids[lead]:null;
 const big=picked===NONE?null:picked&&canBeBig(picked)?picked:fallback;
 // Changing the big card (or opening a folded chapter) glides the others into place.
 const before=useRef<Map<string,number>|null>(null);
 const remember=()=>{before.current=positions(list.current);};
 useLayoutEffect(()=>{const old=before.current;before.current=null;if(old)glideFrom(list.current,old);},[big,folds,cyrillicStatus]);

 const pending=chapters.filter(chapter=>indicesOf(chapter).some(index=>!isPassed(index)));
 const sections=leadChapter?[leadChapter,...pending.filter(chapter=>chapter!==leadChapter)]:pending;
 const finished=chapters.filter(chapter=>indicesOf(chapter).length>0&&indicesOf(chapter).every(isPassed));
 const loosePassed=order.completed.filter(index=>!finished.includes(chapterOf(ids[index])!));
 const lockedChapters=chapters.filter(chapter=>indicesOf(chapter).some(index=>!access[index].open)).map(chapter=>chapter.number);
 // Locks open in page order: render order is page order, so each lock takes the next turn as it is drawn.
 let turn=0;
 const lockTurn=()=>({'--i':turn++}) as CSSProperties;
 const ready=(id:string)=>phase==='done'&&unlocked?.focus===id?' is-ready':'';

 const chapterHead=(chapter:Chapter)=>{
  const indices=indicesOf(chapter),locked=indices.every(index=>!access[index].open);
  return <div className={`home-chapter${locked?' is-locked':''}`} style={locked?lockTurn():undefined} key={`chapter-${chapter.number}`} data-flip={`chapter-${chapter.number}`}>
   <span className="home-chapter-no" aria-hidden="true">{chapter.number}</span>
   <h2><small>{`Chapter ${chapter.number}`}</small>{chapter.title}</h2>
   {locked?<span className="home-chapter-state"><Padlock/> Plus</span>:<span className="home-chapter-dots" role="img" aria-label={`${indices.filter(index=>controllers[index].passed).length} of ${indices.length} passed`}>{indices.map(index=><i key={index} className={controllers[index].passed?'is-done':''}/>)}</span>}
  </div>;
 };
 const card=(index:number)=>{
  const item=controllers[index],{definition,progress}=item,open=access[index].open,chapter=chapterOf(definition.id)!;
  const total=definition.exercises.length,started=lessonStarted(item),last=chapter.lessonIds.at(-1)===definition.id;
  const words=definition.words.slice(0,3).map(word=>word.text),more=definition.words.length-words.length;
  const kicker=item.passed?`Completed · Lesson ${definition.number}`:!open?`${index===lead?'Next · ':''}Chapter ${chapter.number} · Plus`:index===order.upNext?`Up next · ${last?`Last lesson of chapter ${chapter.number}`:`Chapter ${chapter.number}`}`:`Chapter ${chapter.number} · Lesson ${definition.number}`;
  const meta=item.passed?[progress.complete?'Lesson complete':started?`Practising · step ${progress.index+1} of ${total}`:'Passed',`Best ${best(item)}/${total}`]:[started?`Step ${progress.index+1} of ${total}`:`${total} small steps`,started?'Progress saved':`Lesson ${definition.number}`];
  return <section className={`home-hero${open?'':' is-locked'}${ready(definition.id)}`} style={tint(definition.id)} aria-labelledby={`native-card-${definition.id}`} key={definition.id} data-flip={definition.id}>
   <Scene id={definition.id} title={definition.title} onClose={()=>{remember();setPicked(NONE);}}/>
   <div className="home-hero-body">
    <p className="home-kicker">{kicker}</p>
    <h2 id={`native-card-${definition.id}`}>{definition.title}</h2>
    <p className="home-hero-text">{definition.description}</p>
    <ul className="home-phrases" lang="ru" aria-label="Phrases in this lesson">{words.map(word=><li key={word}>{word}</li>)}{more>0&&<li lang="en">+{more}</li>}</ul>
    {open&&<><span className="home-bar"><progress max={total} value={item.passed&&!started?total:progress.index} aria-label={`${definition.title} lesson progress`}/></span>
    <p className="home-hero-meta"><span>{meta[0]}</span><span>{meta[1]}</span></p></>}
    <button className="button teal" onClick={()=>onStart(definition.id)}>{action(item,open)}<span aria-hidden="true">{open?'→':'∞'}</span></button>
   </div>
  </section>;
 };
 const row=(index:number)=>{
  const item=controllers[index],{definition,progress}=item,open=access[index].open,total=definition.exercises.length;
  const sub=item.passed?(progress.complete||!lessonStarted(item)?'Practice again':`Practising · step ${progress.index+1} of ${total}`):!open?definition.description:lessonStarted(item)?`Step ${progress.index+1} of ${total}`:`${total} small steps`;
  return <div className={`home-row${open?'':' is-locked'}${ready(definition.id)}`} style={{...tint(definition.id),...(open?{}:lockTurn())}} key={definition.id} data-flip={definition.id}>
   <span className="home-row-icon" aria-hidden="true">{definition.icon}</span>
   <h2 id={`native-card-${definition.id}`}><b>{definition.number} · {definition.title}</b><span>{sub}</span></h2>
   {item.passed?<span className="home-row-score">{best(item)}/{total} ✓</span>:!open?<span className="home-row-lock"><Padlock/></span>:<span className="home-row-chev" aria-hidden="true">›</span>}
   {open
    ?<button className="button home-row-open" aria-expanded={false} onClick={()=>{remember();setPicked(definition.id);}}><span className="native-sr-only">{`Show ${definition.title}`}</span></button>
    :<button className="button home-row-open" onClick={()=>onStart(definition.id)}><span className="native-sr-only">Unlock with Plus</span></button>}
  </div>;
 };
 // Big cards and rows in order; consecutive rows share one rounded group.
 const items=(indices:number[],key:string)=>{
  const out:ReactElement[]=[];let rows:number[]=[];
  const flush=()=>{if(rows.length)out.push(<div className="home-rows" key={`${key}-rows-${rows[0]}`}>{rows.map(row)}</div>);rows=[];};
  for(const index of indices){if(ids[index]===big){flush();out.push(card(index));}else rows.push(index);}
  flush();return out;
 };
 const cyrillic=()=>{
  if(!onboarding||!onQuickStart||!cyrillicStatus)return null;
  const label=cyrillicStatus==='completed'?'Review':cyrillicStatus==='started'?'Continue':cyrillicStatus==='unseen'?'Start':'Open';
  if(big===CYRILLIC)return <section className="home-hero home-cyrillic" style={tint(CYRILLIC)} aria-labelledby="native-quick-title" key={CYRILLIC} data-flip={CYRILLIC}>
   <Scene id={CYRILLIC} title="Cyrillic quick start" onClose={()=>{remember();setPicked(NONE);}}/>
   <div className="home-hero-body">
    <p className="home-kicker">Recommended · About 3 min</p>
    <h2 id="native-quick-title">Cyrillic quick start</h2>
    <p className="home-hero-text">Recognize the letters you’ll meet in your first lessons.</p>
    <button id="native-quick-open" className="button teal" onClick={onQuickStart}>Start quick start<span aria-hidden="true">→</span></button>
    <button className="native-text-button home-skip" onClick={()=>{remember();onboarding.dispatch({type:'skip'});setPicked(null);}}>Skip for now</button>
   </div>
  </section>;
  const sub=cyrillicStatus==='completed'?'Always here for reference.':cyrillicStatus==='started'?'Continue at your pace.':cyrillicStatus==='unseen'?'Recommended · about 3 min':'Optional alphabet help';
  return <div className="home-rows" key="cyrillic-rows"><div className="home-row home-cyrillic" style={tint(CYRILLIC)} data-flip={CYRILLIC}>
   <span className="home-row-icon" lang="ru" aria-hidden="true">Аа</span>
   <h2 id="native-quick-title"><b>Cyrillic quick start</b><span>{sub}</span></h2>
   <span className="home-row-go" aria-hidden="true">{label} →</span>
   <button id="native-quick-open" className="button home-row-open" aria-label={`${label} Cyrillic quick start`} onClick={onQuickStart}><span className="native-sr-only">{label}</span></button>
  </div></div>;
 };

 return <div className="native-lesson-list home-lessons" ref={list} data-unlock={phase??undefined}>
  {cyrillic()}
  {sections.map(chapter=>{
   const todo=indicesOf(chapter).filter(index=>!isPassed(index));
   // The lesson that leads goes first in its chapter.
   const ordered=chapter===leadChapter&&lead!==null?[lead,...todo.filter(index=>index!==lead)]:todo;
   return [chapterHead(chapter),...items(ordered,`chapter-${chapter.number}`)];
  })}
  {lockedChapters.length>0&&onUnlock&&<button className="home-plus" style={{'--i':turn} as CSSProperties} onClick={onUnlock} data-flip="unlock"><span aria-hidden="true">∞</span> {`Unlock ${listWords(lockedChapters)}`}<span aria-hidden="true">›</span></button>}
  {order.completed.length>0&&<h2 className="native-completed-title" data-flip="completed-title">Completed · {order.completed.length}</h2>}
  {items(loosePassed,'completed')}
  {finished.map(chapter=>{
   const opened=folds.includes(chapter.number),indices=indicesOf(chapter);
   return [<button className="home-fold" key={`fold-${chapter.number}`} data-flip={`fold-${chapter.number}`} aria-expanded={opened} onClick={()=>{remember();setFolds(list=>opened?list.filter(n=>n!==chapter.number):[...list,chapter.number]);}}>
     <span className="home-chapter-no" aria-hidden="true">✓</span><b>Chapter {chapter.number} · {chapter.title}</b><span>{indices.length}/{indices.length} <span aria-hidden="true">{opened?'⌃':'›'}</span></span>
    </button>,...(opened?items(indices,`fold-${chapter.number}`):[])];
  })}
 </div>;
}

// Plus arriving on home: 'locked' (home as it was, the tapped lesson scrolled into view), then 'opening' (the locks
// shake, spring open and float away, in turn; CSS does it), then 'done' (home redrawn with Plus, the others gliding
// into the space the locks and the unlock button left; the tapped lesson glows), then null. Reduce Motion: 'done' at
// once, which crossfades. Plays once per mount; `wait` lets home's entrance (or a passed lesson's glide) finish first.
function useUnlockShow(unlocked:{focus:string|null}|null,list:RefObject<HTMLDivElement|null>,locks:number,wait:number):UnlockPhase{
 const [play]=useState(()=>unlocked);
 const [phase,setPhase]=useState<UnlockPhase>(()=>!play?null:reducedMotion()?'done':'locked');
 const before=useRef<Map<string,number>|null>(null);
 useEffect(()=>{
  if(!play)return;
  // The tapped lesson is where you were; if home's remembered scroll hides it, it comes into view.
  const target=play.focus&&list.current?.querySelector(`#native-card-${CSS.escape(play.focus)}`)?.closest<HTMLElement>('[data-flip]');
  const pane=list.current?.closest<HTMLElement>('.native-home-scroll');
  if(target&&pane){const box=target.getBoundingClientRect(),view=pane.getBoundingClientRect();if(box.top<view.top||box.bottom>view.bottom)target.scrollIntoView({block:'center'});}
  const timers:ReturnType<typeof setTimeout>[]=[];
  const later=(ms:number,run:()=>void)=>timers.push(setTimeout(run,ms));
  if(reducedMotion()){later(GLOW,()=>setPhase(null));return ()=>timers.forEach(clearTimeout);}
  later(wait,()=>setPhase('opening'));
  later(wait+LOCK_OFF+LOCK_STAGGER*locks,()=>{
   // Redrawing moves cards in the page, which would replay their entrance; home has settled by now.
   if(list.current)list.current.dataset.settled='true';
   before.current=positions(list.current);setPhase('done');
  });
  later(wait+LOCK_OFF+LOCK_STAGGER*locks+GLOW,()=>setPhase(null));
  return ()=>timers.forEach(clearTimeout);
 },[]);
 useLayoutEffect(()=>{const old=before.current;before.current=null;if(old)glideFrom(list.current,old);},[phase]);
 return phase;
}
