// Is the app in the foreground? True while the page is visible and, inside the
// native app, iOS reports the app as active. One shared store: the page and
// lifecycle listeners are set up once, however many screens read it, and only
// while at least one screen is reading.

export type PageSignals={
 hidden():boolean;
 // Starts listening for page changes; the returned function stops.
 watch(on:{change:()=>void;leave:()=>void}):()=>void;
};
export type AppLifecycle={
 // Starts listening for active/inactive changes; resolves to a function that stops.
 listen(onChange:(isActive:boolean)=>void):Promise<()=>void>;
 // Whether the app is active right now.
 current():Promise<boolean>;
};

export function createForegroundStore(page:PageSignals|null,lifecycle:()=>AppLifecycle|null){
 const readers=new Set<()=>void>();
 let visible=page?!page.hidden():true;
 let appActive=true;
 let stop:(()=>void)|null=null;

 const inForeground=()=>visible&&appActive;
 function update(nextVisible:boolean,nextAppActive:boolean){
  const before=inForeground();
  visible=nextVisible;appActive=nextAppActive;
  if(inForeground()!==before)for(const reader of readers)reader();
 }

 function start(){
  let running=true,appEvents=0,stopApp:(()=>void)|undefined;
  const stopPage=page?.watch({change:()=>update(!page.hidden(),appActive),leave:()=>update(false,appActive)});
  if(page)update(!page.hidden(),appActive);
  const app=lifecycle();
  if(app){
   app.listen(isActive=>{if(!running)return;appEvents++;update(visible,isActive);})
    .then(async stopListening=>{
     if(!running){stopListening();return;}
     stopApp=stopListening;
     // Ask once for the current state; an event that arrives meanwhile is newer, so it wins.
     const eventsBefore=appEvents,isActive=await app.current();
     if(running&&appEvents===eventsBefore)update(visible,isActive);
    })
    .catch(()=>{/* No app lifecycle available: rely on page visibility alone. */});
  }
  return ()=>{running=false;stopPage?.();stopApp?.();};
 }

 return {
  get:inForeground,
  subscribe(reader:()=>void){
   readers.add(reader);
   if(readers.size===1)stop=start();
   return ()=>{
    readers.delete(reader);
    if(readers.size===0){stop?.();stop=null;}
   };
  },
 };
}
