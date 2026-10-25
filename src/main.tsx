import React from 'react';
import ReactDOM from 'react-dom/client';
import {RuntimeApp,isNativeLayout} from './RuntimeApp';
import './styles.css';
import './iphone.css';
import './gallery.css';
import './native.css';
import {PRODUCT} from './config';
import {restoreStorageMirror} from './previewStorage';
if(isNativeLayout()){
 document.documentElement.classList.add('native-platform');
 const viewport=document.querySelector<HTMLMetaElement>('meta[name=viewport]');
 if(viewport&&!viewport.content.includes('viewport-fit'))viewport.content+=', viewport-fit=cover';
}
document.title = `${PRODUCT.name} — A little Russian. A little every day.`;
// Resolves immediately in the browser/web preview; on native, a bounded
// bridge round-trip before every hook's first synchronous storage read.
void restoreStorageMirror().finally(()=>{
 ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><RuntimeApp/></React.StrictMode>);
});
