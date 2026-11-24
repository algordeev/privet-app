import {PRODUCT} from './config.ts';

// Settings › Appearance: follow the iPhone (System, the default), or always Light or Dark.
// Saved as {version:1,appearance}. Nothing saved, or anything unreadable, means System.
export const APPEARANCE_KEY=`${PRODUCT.storageKey}-appearance`;
export const APPEARANCES=['system','light','dark'] as const;
export type Appearance=typeof APPEARANCES[number];
export type Theme='light'|'dark';

export function restoreAppearance(raw:string|null):Appearance{
 try{
  const saved=raw?JSON.parse(raw):null;
  return saved?.version===1&&APPEARANCES.includes(saved.appearance)?saved.appearance:'system';
 }catch{return 'system';}
}
export const savedAppearance=(appearance:Appearance)=>JSON.stringify({version:1,appearance});
export const resolveTheme=(appearance:Appearance,systemDark:boolean):Theme=>appearance==='system'?(systemDark?'dark':'light'):appearance;

// The dark styles (src/nativeDark.css) apply while the app's root says data-theme="dark".
export function applyTheme(root:HTMLElement,theme:Theme){
 if(root.dataset.theme!==theme)root.dataset.theme=theme;
}
export const systemPrefersDark=()=>!!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
