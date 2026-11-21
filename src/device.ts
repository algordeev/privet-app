// "iPhone" or "iPad", for text like "Your progress stays on this iPad." iPadOS reports a desktop
// (Macintosh) user agent by default, so a touch screen on a "Mac" means an iPad. Elsewhere: iPhone.
export function deviceName(nav:{userAgent:string;maxTouchPoints?:number}|undefined=typeof navigator==='undefined'?undefined:navigator):'iPhone'|'iPad'{
 if(!nav)return 'iPhone';
 return /iPad/.test(nav.userAgent)||(/Macintosh/.test(nav.userAgent)&&(nav.maxTouchPoints??0)>1)?'iPad':'iPhone';
}
export const DEVICE=deviceName();
