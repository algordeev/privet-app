import type {ReactElement} from 'react';
import type {Appearance} from './appearance';
import {DEVICE} from './device';
import type {AppearanceController} from './useAppearance';

const icons:Record<Appearance,ReactElement>={
 system:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M12 7a5 5 0 0 1 0 10z" fill="currentColor" stroke="none"/></svg>,
 light:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>,
 dark:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/></svg>,
};
const labels:Record<Appearance,string>={system:'System',light:'Light',dark:'Dark'};

// Settings › Appearance: System (follows the iPhone), Light or Dark.
export function AppearanceSettingsCard({appearance}:{appearance:AppearanceController}){
 const note=appearance.appearance==='system'?`Follows your ${DEVICE}’s setting.`:appearance.appearance==='dark'?'Always dark.':'Always light.';
 return <section className="native-settings-card" aria-labelledby="settings-appearance-title">
  <h2 id="settings-appearance-title">Appearance</h2>
  <div className="native-appearance" role="radiogroup" aria-labelledby="settings-appearance-title">
   {(Object.keys(labels) as Appearance[]).map(value=><button key={value} type="button" role="radio" aria-checked={appearance.appearance===value} className="native-appearance-option" onClick={()=>appearance.setAppearance(value)}>
    {icons[value]}<span>{labels[value]}</span>
   </button>)}
  </div>
  <p className="native-appearance-note">{note}</p>
 </section>;
}
