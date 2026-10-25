import {defineConfig} from 'vite';

export default defineConfig(({mode})=>({
 plugins: mode==='native'?[{
  name:'local-native-content',
  enforce:'pre',
  // The native app uses system fonts and never needs a Google Fonts request.
  transform(code,id){if(id.split('?')[0].endsWith('/src/styles.css'))return code.replace(/@import\s+url\(['"]https:\/\/fonts\.googleapis\.com[^'"]+['"]\);?\s*/g,'');},
  transformIndexHtml(html){return html.replace('content="width=device-width, initial-scale=1.0"','content="width=device-width, initial-scale=1.0, viewport-fit=cover"');},
 }]:[],
}));
