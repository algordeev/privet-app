// The "found" cards (companion and printer) share the screen: only one is open at a time. The other
// waits for its next scan update once this one closes.
let owner:'companion'|'printer'|null=null;
export const foundCardFree=(who:'companion'|'printer')=>owner===null||owner===who;
export function holdFoundCard(who:'companion'|'printer',open:boolean){if(open)owner=who;else if(owner===who)owner=null;}
// Which nearby printer home's card offers: the first one found, except the printer the app reconnects
// to by itself (auto-reconnect on), which connects without a card. With auto-reconnect off (after
// Disconnect), the remembered printer is offered like any other.
export function offeredPrinter<T extends {deviceId:string}>(devices:readonly T[],autoTarget?:string):T|undefined{
 return devices.find(device=>device.deviceId!==autoTarget);
}
