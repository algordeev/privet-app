import React from 'react';
import ReactDOM from 'react-dom/client';
import {RuntimeApp,isNativeLayout} from './RuntimeApp';
import './styles.css';
import './iphone.css';
import './gallery.css';
import './native.css';
import {PRODUCT} from './config';
if(isNativeLayout()){
 document.documentElement.classList.add('native-platform');
 const viewport=document.querySelector<HTMLMetaElement>('meta[name=viewport]');
 if(viewport&&!viewport.content.includes('viewport-fit'))viewport.content+=', viewport-fit=cover';
}
document.title = `${PRODUCT.name} — A little Russian. A little every day.`;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><RuntimeApp/></React.StrictMode>);
