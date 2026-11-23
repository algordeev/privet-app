import {DEVICE} from './device';
import type {SpeakingController} from './useSpeaking';

// Settings › Speaking: the switch for speaking steps, and what the microphone allows.
// Hidden where speaking can never work (the browser, or no on-device Russian on this iPhone).
export function SpeakingSettingsCard({speaking}:{speaking:SpeakingController}){
 const {settings,support,reason}=speaking;
 if(!support||!support.recognizer||!support.onDevice)return null;
 const refused=reason==='denied';
 const microphone=refused?'Not allowed · speaking steps use their quiet version'
  :support.microphone==='granted'&&support.speech==='granted'?`Allowed · your voice is checked on this ${DEVICE}`
  :'iOS asks the first time you tap Tap to speak';
 return <section className="native-settings-card" aria-labelledby="settings-speaking-title">
  <h2 id="settings-speaking-title">Speaking</h2>
  <label className="native-settings-row"><span><strong>Speaking exercises</strong><small>{reason==='paused'?'Paused for a few minutes after Can’t speak now':'Say words aloud in lessons and Review'}</small></span>
   <input type="checkbox" role="switch" aria-label="Speaking exercises" checked={settings.enabled} onChange={event=>speaking.setEnabled(event.target.checked)}/></label>
  <div className="native-speaking-row"><span><strong>Microphone</strong><small>{microphone}</small></span>
   {refused&&<button className="native-text-button" onClick={speaking.openSettings}>Open iOS Settings</button>}</div>
 </section>;
}
