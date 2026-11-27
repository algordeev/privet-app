import {Capacitor,registerPlugin} from '@capacitor/core';

// The printing Live Activity (agreed 2026-11-27, https://claude.ai/artifact/8GBaqd68M3urexcsbjrhkT, section 1):
// a paper strip and a mint ring in the Dynamic Island and on the Lock Screen while a print runs and you're away.
// iOS's side is ios/App/App/PrivetLiveActivityPlugin.swift and PrivetWidgets/PrivetPrintLiveActivity.swift.
// Leaving the app no longer pauses a print (backgroundTime.ts), and the printer prints most of it from its own
// memory, so the island counts down from the estimated finish by itself. It reads "Printed ✓ Tear it off" when
// the printer says it's done (or once the estimate has passed), then goes after PRINTED_SHOWN_MS.
type Plugin={
 startPrint(options:{title:string;seconds:number}):Promise<{started:boolean}>;
 printPrinted():Promise<void>;
 endPrint():Promise<void>;
};
const plugin=registerPlugin<Plugin>('PrivetLiveActivity');
const available=()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('PrivetLiveActivity');

// How long "Printed ✓ Tear it off" stays in the island before it goes.
export const PRINTED_SHOWN_MS=5000;

// The paper's estimated time in seconds: the printer's learnt speed in rows per second (see learnRate).
export const printSeconds=(rows:number,rowsPerSecond:number)=>Math.max(2,Math.round(rows/Math.max(1,rowsPerSecond)*10)/10);

export function createPrintActivity(){
 // Calls go to iOS one after another, so "printed" never overtakes the start it belongs to.
 let queue:Promise<unknown>=Promise.resolve();
 const send=(call:()=>Promise<unknown>)=>{if(!available())return;queue=queue.then(call).catch(()=>{/* No island this time; printing is unaffected. */});};
 return {
  start:(title:string,seconds:number)=>send(()=>plugin.startPrint({title,seconds})),
  printed:()=>send(()=>plugin.printPrinted()),
  end:()=>send(()=>plugin.endPrint()),
  // Resolves once every call so far has reached iOS.
  settled:()=>queue,
 };
}
