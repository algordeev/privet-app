import {Capacitor} from '@capacitor/core';
import {LocalNotifications} from '@capacitor/local-notifications';

// The iOS notification calls the reminder scheduler needs. The interaction checks replace this file with a
// fake, the same way they replace the Bluetooth driver.
export type ScheduledNotification={id:number;title:string;body:string;at:Date;extra:Record<string,string>};
export const notificationDriver={
 supported:()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('LocalNotifications'),
 permission:async()=>(await LocalNotifications.checkPermissions()).display as string,
 requestPermission:async()=>(await LocalNotifications.requestPermissions()).display as string,
 pendingIds:async()=>(await LocalNotifications.getPending()).notifications.map(({id})=>id),
 cancel:async(ids:number[])=>{await LocalNotifications.cancel({notifications:ids.map(id=>({id}))});},
 // Calls back when the learner taps a delivered notification (also one that launched the app); returns a stop function.
 onTap:(listener:(kind:string)=>void)=>{const handle=LocalNotifications.addListener('localNotificationActionPerformed',({notification})=>listener(String(notification.extra?.kind??'')));return ()=>{handle.then(h=>h.remove());};},
 schedule:async(items:ScheduledNotification[])=>{await LocalNotifications.schedule({notifications:items.map(({id,title,body,at,extra})=>({id,title,body,schedule:{at,allowWhileIdle:true},extra}))});},
};
