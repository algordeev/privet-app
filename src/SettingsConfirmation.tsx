import {NativeSheet} from './NativeSheet';

export type SettingsAction='reset'|'replay';
export function SettingsConfirmation({action,browserRedirect=false,onCancel,onConfirm}:{action:SettingsAction;browserRedirect?:boolean;onCancel:()=>void;onConfirm:()=>void}){
 const reset=action==='reset';
 return <NativeSheet id="settings-confirmation" title={reset?'Reset saved data?':'Restart onboarding?'} onClose={onCancel}>
  <div className="native-sheet-scroll native-settings-confirmation">
   {reset?<><p>This cannot be undone. This device’s saved data will be cleared:</p><ul><li>Lesson 1 and Lesson 2 progress, results and saved answers.</li><li>Statistics, XP, streak history and protected days.</li><li>Gems and streak freezes.</li><li>Cyrillic quick-start progress.</li><li>Display and virtual companion preferences.</li></ul><p><strong>Kept:</strong> your Plus demo, established Bluetooth connection, and welcome-tour progress and personalization.</p></>:<><p>The welcome tour starts again from the beginning. Its current position and offer selection will be replaced.</p><p><strong>Kept:</strong> lessons, statistics, gems, freezes, Cyrillic progress, preferences, personalization, Plus and the established Bluetooth connection.</p><p>Replay is practice only and adds no rewards.</p>{browserRedirect&&<p>This opens a separate browser preview, keeping your current demo data intact.</p>}</>}
   <div className="native-settings-confirmation-actions"><button className="button native-confirmation-cancel" onClick={onCancel}>Cancel</button><button className={`button native-confirmation-confirm ${reset?'native-confirmation-danger':'teal'}`} onClick={onConfirm}>{reset?'Reset saved data':'Restart onboarding'}</button></div>
  </div>
 </NativeSheet>;
}
