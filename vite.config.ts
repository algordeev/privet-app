import {defineConfig} from 'vite';

export default defineConfig(({mode})=>({
 plugins: mode==='native'?[{
  name:'local-native-content',
  enforce:'pre',
  // The native app uses system fonts and never needs the website's
  // self-hosted DM Sans/Manrope @font-face files bundled into its build.
  transform(code,id){if(id.split('?')[0].endsWith('/src/styles.css'))return code.replace(/@font-face\{[^}]*\}/g,'');},
  transformIndexHtml(html){return html.replace('content="width=device-width, initial-scale=1.0"','content="width=device-width, initial-scale=1.0, viewport-fit=cover"');},
 }]:[],
}));
