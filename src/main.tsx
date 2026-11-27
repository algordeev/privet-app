import React from 'react';
import ReactDOM from 'react-dom/client';
import {RuntimeApp,phoneLayoutActive} from './RuntimeApp';
import './styles.css';
import './iphone.css';
import './gallery.css';
import './site.css';
import './native.css';
import './nativeDark.css';
import './nativeDarkPlayful.css';
import {PRODUCT} from './config';
import {appStorage,restoreStorageMirror} from './previewStorage';
import {APPEARANCE_KEY,applyTheme,resolveTheme,restoreAppearance,systemPrefersDark} from './appearance';
if(phoneLayoutActive()){
 document.documentElement.classList.add('native-platform');
 applyTheme(document.documentElement,resolveTheme('system',systemPrefersDark()));
 const viewport=document.querySelector<HTMLMetaElement>('meta[name=viewport]');
 if(viewport&&!viewport.content.includes('viewport-fit'))viewport.content+=', viewport-fit=cover';
}
document.title = `${PRODUCT.name} — A little Russian. A little every day.`;
// Resolves immediately in the browser/web preview; on native, a bounded
// bridge round-trip before every hook's first synchronous storage read.
void restoreStorageMirror().finally(()=>{
 // The saved appearance, before the first frame, so a dark start never flashes light.
 if(phoneLayoutActive())applyTheme(document.documentElement,resolveTheme(restoreAppearance(appStorage.getItem(APPEARANCE_KEY)),systemPrefersDark()));
 ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><RuntimeApp/></React.StrictMode>);
});
