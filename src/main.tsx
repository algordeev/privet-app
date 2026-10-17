import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './iphone.css';
import {PRODUCT} from './config';
document.title = `${PRODUCT.name} — A little Russian. A little every day.`;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
