import {useCallback,useEffect,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {appStorage} from './previewStorage';
import {APPEARANCE_KEY,applyTheme,resolveTheme,restoreAppearance,savedAppearance,systemPrefersDark,type Appearance} from './appearance';

// iOS's side of the choice (ios/App/App/PrivetAppearancePlugin.swift): the status bar, keyboard and
// system sheets follow the app's Light or Dark even when the iPhone is set the other way.
const appearancePlugin=registerPlugin<{set(options:{appearance:Appearance}):Promise<void>}>('PrivetAppearance');

// The app-wide appearance: the saved choice, the iPhone's own setting, and the theme on the page root.
export function useAppearance(){
 const [appearance,setAppearanceState]=useState<Appearance>(()=>{try{return restoreAppearance(appStorage.getItem(APPEARANCE_KEY));}catch{return 'system';}});
 const [systemDark,setSystemDark]=useState(systemPrefersDark);
 useEffect(()=>{
  const query=globalThis.matchMedia?.('(prefers-color-scheme: dark)');if(!query)return;
  const change=()=>setSystemDark(query.matches);
  change();query.addEventListener('change',change);
  return ()=>query.removeEventListener('change',change);
 },[]);
 const theme=resolveTheme(appearance,systemDark);
 useEffect(()=>{applyTheme(document.documentElement,theme);},[theme]);
 useEffect(()=>{
  if(Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('PrivetAppearance'))void appearancePlugin.set({appearance}).catch(()=>{/* iOS keeps following the iPhone. */});
 },[appearance]);
 const setAppearance=useCallback((next:Appearance)=>{
  setAppearanceState(next);
  try{appStorage.setItem(APPEARANCE_KEY,savedAppearance(next));}catch{/* Still applies for this run. */}
 },[]);
 return {appearance,theme,setAppearance};
}
export type AppearanceController=ReturnType<typeof useAppearance>;
