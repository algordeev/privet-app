import {useState} from 'react';
import './nativeCompanionImages.css';

export function NativeCompanionImages(){
 const [color,setColor]=useState<'coral'|'white'>('coral');
 return <figure className="native-companion-images">
  <img src={`images/companion-${color}.png`} width="1536" height="1024" alt={`${color==='coral'?'Coral':'Warm white'} Privet enclosure concept: assembled companion beside an open view showing the OLED, servo and ESP32.`}/>
  <figcaption>Enclosure concept · Working electronics prototype</figcaption>
  <div role="group" aria-label="Companion concept color"><button aria-pressed={color==='coral'} onClick={()=>setColor('coral')}><i className="is-coral" aria-hidden="true"/>Soft coral</button><button aria-pressed={color==='white'} onClick={()=>setColor('white')}><i className="is-white" aria-hidden="true"/>Warm white</button></div>
 </figure>;
}
