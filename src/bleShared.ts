// The BLE plugin's global state, shared by every device driver (the robot/Mini and the printer), so each
// can be connected at the same time and one's cleanup never stops the other's scan or Bluetooth watch.
// - Initialization runs once.
// - iOS runs one scan at a time (a second requestLEScan stops the first) and BleClient keeps one scan
//   listener: every owner takes a lease on one shared native scan instead. It is unfiltered while any
//   lease needs that (the printer), otherwise filtered by the leases' services. Each result goes only
//   to the leases that accept it.
// - BleClient keeps one Bluetooth-enabled listener: it is fanned out to any number of watchers.
// Nothing here runs at import: only an explicit Connect/Print may ask for Bluetooth permission.
export type ScanResult={deviceId:string;name?:string;uuids?:string[]};
export type ScanLease={
 // Native service filter for this lease; omit it when the device doesn't reliably advertise a service.
 services?:readonly string[];
 accept:(result:ScanResult)=>boolean;
 callback:(result:ScanResult)=>void;
};
export interface BlePlugin {
 disableQueue():void;
 initialize():Promise<void>;
 requestLEScan(options:{services?:string[]},callback:(result:ScanResult)=>void):Promise<void>;
 stopLEScan():Promise<void>;
 startEnabledNotifications(callback:(enabled:boolean)=>void):Promise<void>;
 stopEnabledNotifications():Promise<void>;
}
export function createBleShared(plugin:BlePlugin){
 let initializing:Promise<void>|undefined;
 const leases=new Set<ScanLease>(),watchers=new Set<(enabled:boolean)=>void>();
 // The native scan's current filter: undefined = not scanning, null = unfiltered.
 let running:string[]|null|undefined;
 let scanChain:Promise<unknown>=Promise.resolve(),watchChain:Promise<unknown>=Promise.resolve();
 let watching=false;
 const serial=<T>(chain:'scan'|'watch',fn:()=>Promise<T>)=>{
  const next=(chain==='scan'?scanChain:watchChain).then(fn,fn);
  const settled=next.catch(()=>{});
  if(chain==='scan')scanChain=settled;else watchChain=settled;
  return next;
 };
 function wanted():string[]|null|undefined{
  if(!leases.size)return undefined;
  const services=new Set<string>();
  for(const lease of leases){if(!lease.services)return null;for(const s of lease.services)services.add(s.toLowerCase());}
  return [...services].sort();
 }
 const same=(a:string[]|null|undefined,b:string[]|null|undefined)=>a===b||(!!a&&!!b&&a.join()===b.join());
 function dispatch(result:ScanResult){
  for(const lease of [...leases])if(leases.has(lease)&&lease.accept(result))lease.callback(result);
 }
 // Brings the native scan in line with the leases. Runs one at a time.
 const reconfigure=()=>serial('scan',async()=>{
  const target=wanted();
  if(same(target,running))return;
  if(running!==undefined){running=undefined;await plugin.stopLEScan();}
  if(target===undefined)return;
  await plugin.requestLEScan(target?{services:target}:{},dispatch);
  running=target;
 });
 return {
  initialize(){
   if(!initializing){
    // Device transports serialize their own operations; cancellation must reach the plugin at once.
    plugin.disableQueue();
    initializing=plugin.initialize().catch(error=>{initializing=undefined;throw error;});
   }
   return initializing;
  },
  // Resolves once the native scan includes this lease; the returned function ends the lease.
  async acquireScan(lease:ScanLease):Promise<()=>Promise<void>>{
   leases.add(lease);
   const release=async()=>{if(leases.delete(lease))await reconfigure();};
   try{await reconfigure();}catch(error){leases.delete(lease);void reconfigure().catch(()=>{});throw error;}
   return release;
  },
  async watchEnabled(callback:(enabled:boolean)=>void):Promise<()=>Promise<void>>{
   watchers.add(callback);
   const remove=()=>serial('watch',async()=>{
    if(!watchers.delete(callback)||watchers.size||!watching)return;
    watching=false;await plugin.stopEnabledNotifications();
   });
   try{
    await serial('watch',async()=>{
     if(watching||!watchers.size)return;
     await plugin.startEnabledNotifications(enabled=>{for(const watcher of [...watchers])watcher(enabled);});
     watching=true;
    });
   }catch(error){watchers.delete(callback);throw error;}
   return remove;
  },
  // For tests and diagnostics.
  scanning:()=>running===undefined?'off':running===null?'unfiltered':running.join(','),
 };
}
export type BleShared=ReturnType<typeof createBleShared>;
