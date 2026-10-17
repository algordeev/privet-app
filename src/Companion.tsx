import type { CompanionState } from './engine';
type Props={ state?:CompanionState; text?:string; small?:boolean };
export function Companion({state='idle',text='Привет!',small=false}:Props) {
 return <div className={`robot-scene ${small?'small':''} state-${state}`} role="img" aria-label={`Simulated desk companion: ${state.replace('-',' ')}, displaying ${text}`}>
  <div className="robot-shadow"/>
  <div className="robot-assembly">
   <div className="antenna"><span/></div>
   <div className="robot-head">
    <div className="head-screw left"/><div className="head-screw right"/>
    <div className="robot-screen">
     <div className="oled-status"><span/> <span>01</span></div>
     <svg className="robot-face" viewBox="0 0 160 67" aria-hidden="true">
      {state==='correct'||state==='celebrating'?<><path d="M29 29 Q39 12 49 29 M111 29 Q121 12 131 29"/><path d="M66 43 Q80 61 94 43"/></>:state==='try-again'?<><path d="M29 28 L49 25 M111 25 L131 28"/><path d="M70 47 Q80 42 90 47"/></>:<><rect className="eye" x="30" y="17" width="17" height="25" rx="8"/><rect className="eye" x="113" y="17" width="17" height="25" rx="8"/><path d="M69 45 Q80 54 91 45"/></>}
     </svg>
     <span className="oled-word" lang="ru">{text}</span>
    </div>
   </div>
   <div className="robot-neck"/>
   <div className="robot-body"><span className="body-speaker">▤</span><span className="body-button"/><span className="body-light"/></div>
   <div className="robot-feet"><i/><i/></div>
  </div>
  {state==='celebrating'&&<div className="celebration-bits" aria-hidden="true">✧ <span>✦</span> ✧</div>}
 </div>;
}
