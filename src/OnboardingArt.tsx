import {Companion} from './Companion';
import './onboardingArt.css';

// Behind the onboarding screens: three soft rings and four faint letters of "привет"
// (styled in onboardingArt.css; hidden when motion is reduced).
export function FirstBackdrop(){
 return <div className="first-backdrop" aria-hidden="true">
  <i/><i/><i/>
  {['п','р','и','в'].map(letter=><span key={letter}>{letter}</span>)}
 </div>;
}

// The companion's expressions on the offer card. Listening and Correct! are the desk
// companion's own idle and happy faces (Companion.tsx); Thinking and Celebrating extend them.
const roundEyes=(dx:number,dy:number,height:number)=><>
 <rect className="eye" x={30+dx} y={17+dy} width="17" height={height} rx="8"/>
 <rect className="eye" x={113+dx} y={17+dy} width="17" height={height} rx="8"/>
</>;
const smilingEyes=<path d="M29 29 Q39 12 49 29 M111 29 Q121 12 131 29"/>;
const faces=[
 {id:'listening',label:'Listening',drawing:<>{roundEyes(0,0,25)}<path d="M69 45 Q80 54 91 45"/></>},
 {id:'thinking',label:'Thinking',drawing:<>{roundEyes(5,-4,21)}<path d="M71 49 L89 45"/></>},
 {id:'correct',label:'Correct!',drawing:<>{smilingEyes}<path d="M66 43 Q80 61 94 43"/></>},
 {id:'celebrating',label:'Celebrating',drawing:<>{smilingEyes}<path className="open" d="M63 41 Q80 65 97 41 Z"/></>},
];
export function ExpressionStrip(){
 return <ul className="face-strip" aria-label="Your companion’s expressions">
  {faces.map(face=><li key={face.id}><svg viewBox="0 0 160 67" aria-hidden="true">{face.drawing}</svg><span>{face.label}</span></li>)}
 </ul>;
}

// One picture per welcome story.
export function StoryArt({kind}:{kind:'speak'|'letters'|'together'}){
 return <div className={`first-story-art is-${kind}`} aria-hidden="true">
  {kind==='speak'?<><span className="voice-bars"><i/><i/><i/></span><b lang="ru">Привет!</b></>
   :kind==='letters'?<><span className="first-letter-tile" lang="ru">АБВ</span><i>→</i><b>A B V</b></>
   :<><span className="first-story-robot"><Companion state="celebrating" text="✦" small/></span><b>♥</b></>}
 </div>;
}

// Gold sparkles that rise and fade once, above a finished lesson. [left %, top px] for each.
const sparks=[[5,22],[17,46],[29,9],[42,36],[56,12],[69,44],[81,19],[93,50]] as const;
export function Sparkles(){
 return <span className="sparkle-band" aria-hidden="true">
  {sparks.map(([left,top],index)=><i key={index} style={{left:`${left}%`,top,animationDelay:`${index*45}ms`}}>✦</i>)}
 </span>;
}
