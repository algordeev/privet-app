import {Capacitor} from '@capacitor/core';
import {Haptics,ImpactStyle,NotificationType} from '@capacitor/haptics';
import type {HapticKind} from './haptics';

// Light taps for answers, iOS notification patterns for bigger moments. iPhone only; iOS's
// System Haptics switch still applies. Failures are ignored: haptics are never load-bearing.
export function playHaptic(kind:HapticKind|null){
 if(!kind||!Capacitor.isNativePlatform())return;
 const play=kind==='correct'||kind==='pair'?Haptics.impact({style:kind==='pair'?ImpactStyle.Light:ImpactStyle.Medium})
  :Haptics.notification({type:kind==='complete'?NotificationType.Success:kind==='failed'?NotificationType.Error:NotificationType.Warning});
 void play.catch(()=>{});
}
