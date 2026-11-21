import {useEffect,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {LEGAL,PRODUCT} from './config';

const ROWS=[
 {label:'Support',href:LEGAL.support},
 {label:`Email ${LEGAL.email}`,href:`mailto:${LEGAL.email}?subject=${encodeURIComponent(`${PRODUCT.name} support`)}`},
 {label:'Privacy Policy',href:LEGAL.privacy},
 {label:'Terms of Use',href:LEGAL.terms},
] as const;

// Settings › Help & privacy: support, the privacy policy Apple asks to be easy to find in the app, terms and the app version.
export function HelpSettings(){
 const [version,setVersion]=useState('');
 useEffect(()=>{
  if(!Capacitor.isNativePlatform())return;
  let alive=true;
  App.getInfo().then(info=>{if(alive)setVersion(`${PRODUCT.name} ${info.version}`);},()=>{});
  return ()=>{alive=false;};
 },[]);
 return <section className="native-settings-card native-settings-help" aria-labelledby="settings-help-title">
  <h2 id="settings-help-title">Help &amp; privacy</h2>
  <ul>
   {/* Links leave the app: web pages open in Safari, the address in Mail. */}
   {ROWS.map(row=><li key={row.label}><a href={row.href} target="_blank" rel="noopener noreferrer">{row.label}<span aria-hidden="true">›</span></a></li>)}
  </ul>
  {version&&<p className="native-settings-version">{version}</p>}
 </section>;
}
