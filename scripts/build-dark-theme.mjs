// Builds src/nativeDark.css: the app's dark theme, generated from its light stylesheets.
//
// The light styles stay exactly as they are (they are shared with the website). For every rule that
// sets a colour, this writes the same rule again under html.native-platform[data-theme="dark"],
// with each colour moved onto the dark palette (src/darkColours.ts). Run `npm run build:dark` after changing
// any colour in the app's styles; src/darkTheme.test.ts fails while the generated file is out of date.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PALETTE,SYSTEM,darkColour,heroBackground,roleOf} from '../src/darkColours.ts';

// The app's stylesheets, in the order main.tsx and the screens import them.
export const SOURCES=['styles.css','iphone.css','native.css','firstRun.css','speakExercise.css','streakScreen.css','gemsScreen.css',
 'plusScreen.css','reminders.css','onboardingArt.css','sentenceWords.css','countedNumber.css','nativeLessonTour.css','nativeCompanionImages.css'];
export const OUTPUT='nativeDark.css';
const DARK='html.native-platform[data-theme="dark"]';

// Left exactly as they are in dark: the robot and its screen faces, printed paper, and website-only parts.
const KEEP=[
 // The robot's own parts (not the stages it stands on, such as first run's spotlight).
 /\.robot-(head|screen|face|neck|body|feet|shadow|scene|assembly|3d)|native-robot|antenna|oled|face-strip|\.eye\b|\.open\b|head-screw|body-(speaker|button|light)|celebration-bits|brand-icon|brand-dot|home-scene/,
 /printer-preview img/,
 // Switch knobs stay white, as iOS switches do in dark mode.
 /input\[type=checkbox\]:before/,
 /^\.(site-|hero|demo-|lesson-device|lesson-phone|lesson-layout|lesson-side|ios-|approach|closing|roadmap|benefit|concept-|orbital|hand-note|tea-|phone-|preview-|mini-progress|wordmark|header-cta|menu-toggle|skip-link|product-feature|companion-gallery|global-notice|section-heading|eyebrow|feature-number|letter-example|stress-example|grammar-example|review-example|solo-note|simulation-tag|speech-bubble)/,
 /^(footer|header\.site|\.wrap)/,
];

// ---- A small CSS reader: style rules inside @media/@supports, keyframes skipped ----
const COLOUR=/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b|\brgba?\([^)]*\)/g;
// Colours set through variables that need their own dark versions: the named accents get a text
// version (--teal-text), and each lesson's inline tint (--t, --d) a dark one set beside it in HomeLessons.
const VARIANT=/var\(--(teal|first-green|streak|freeze|t|d)\)/g;
const HERO=[[/\.streak-hero(?![\w-])(?!\s+\S)/,'streak'],[/\.gems-balance(?![\w-])(?!\s+\S)/,'gem'],
 // First run: the robot stands on a light spotlight, which would turn into grey fog. A teal glow at its feet instead.
 [/\.first-hero-robot$|\.first-offer-hero \.first-robot$/,'brand','50% 80%']];
// A few places where one shared light style covers parts that mean different things in the dark.
// They come last, so they win over a generated rule of equal priority.
const EXTRA=[
 // Profile: stat numbers in Privet teal, the current streak in streak orange; gems in gold, freezes in blue.
 ['.native-stat-grid dd strong',`color:${PALETTE.accent}`],
 ['.native-stat-grid > .native-stat-streak dd strong',`color:${SYSTEM.streak}`],
 ['.native-profile-gems > div:first-child strong',`color:${SYSTEM.gem}`],
 ['.native-profile-gems > div:last-child strong',`color:${SYSTEM.freeze}`],
 // The lesson tour dims the screen like iOS does in the dark: black around the spotlight only, so the
 // highlighted part keeps its full brightness, and a solid tip card (nothing shows through it).
 ['.native-app .native-lesson-tour::backdrop','background-color:transparent'],
 ['.native-app .native-tour-spotlight','box-shadow:0 0 0 9999px #00000099'],
 ['.native-app .native-tour-card',`background-color:${PALETTE.surface}`],
];
// The palette as CSS variables (--dk-bg, --dk-button-ink, --dk-good…) for the hand-written
// src/nativeDarkPlayful.css, so its colours always match the generated ones.
const kebab=name=>name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
const PALETTE_VARIABLES=[...Object.entries(PALETTE),...Object.entries(SYSTEM)].map(([name,value])=>`--dk-${kebab(name)}:${value}`).join(';');
const NAMED_WHITE=/(^|[\s,(])(white|black)(?=$|[\s,)])/g;
function rules(css){
 css=css.replace(/\/\*[\s\S]*?\*\//g,'');
 const out=[];let i=0;
 function block(context){
  while(i<css.length){
   let j=i;
   while(j<css.length&&!'{};'.includes(css[j])){if(css[j]==='"'||css[j]==="'"){const q=css[j++];while(j<css.length&&css[j]!==q)j++;}j++;}
   if(j>=css.length){i=j;return;}
   const prelude=css.slice(i,j).trim();
   if(css[j]==='}'){i=j+1;return;}
   if(css[j]===';'){i=j+1;continue;}
   if(/^@(media|supports|layer)/.test(prelude)){i=j+1;block([...context,prelude]);continue;}
   let k=j+1,depth=1;while(k<css.length&&depth){if(css[k]==='{')depth++;else if(css[k]==='}')depth--;k++;}
   if(!prelude.startsWith('@'))out.push({context,selector:prelude,body:css.slice(j+1,k-1)});
   i=k;
  }
 }
 block([]);
 return out;
}
function splitTop(text,sep){
 const parts=[];let depth=0,start=0;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===sep&&!depth){parts.push(text.slice(start,i));start=i+1;}}
 parts.push(text.slice(start));return parts;
}
// Each dark rule keeps exactly the priority (specificity) of the light rule it copies: the dark condition
// sits inside :where(), which adds none. So the light cascade decides as before (the app's `border:0`
// still beats the website's lesson border), and among equals the dark copy wins by coming last.
const WHERE=`:where(${DARK})`;
function darkSelector(selector){
 const kept=splitTop(selector,',').map(s=>s.trim()).filter(s=>s&&!KEEP.some(r=>r.test(s)));
 return kept.map(s=>{
  if(s.startsWith(':root'))return DARK+s.slice(5);
  if(s.startsWith('html.native-platform'))return DARK+s.slice('html.native-platform'.length);
  if(/^html\b/.test(s))return DARK+s.slice(4);
  return `${WHERE} ${s}`;
 }).join(',');
}
// Shorthands reset everything they cover. A dark copy that only changes a colour therefore sets just
// the colour part: `border-color`, `background-color` and `background-image`. Otherwise a dark
// `background` would undo the light rule's background-clip:text (the speaking word fill) or size.
const GRADIENT=/^\s*(repeating-)?(linear|radial|conic)-gradient\(.*\)\s*$/s;
const COLOUR_ONLY=/^\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|var\([^)]*\)|transparent)\s*(!important)?\s*$/;
function longhands(property,value){
 const important=/!important/.test(value)?' !important':'';
 const plain=value.replace(/!important/,'').trim();
 if(/^(border(-top|-right|-bottom|-left|-block|-inline)?|outline)$/.test(property)){
  const colours=[...plain.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|var\([^)]*\)/g)];
  return colours.length===1?[`${property}-color:${colours[0][0]}${important}`]:[`${property}:${value}`];
 }
 if(property==='background'){
  if(COLOUR_ONLY.test(plain))return [`background-color:${plain}${important}`];
  const layers=splitTop(plain,',').map(layer=>layer.trim());
  const last=layers[layers.length-1];
  const images=COLOUR_ONLY.test(last)?layers.slice(0,-1):layers;
  if(images.length&&images.every(layer=>GRADIENT.test(layer)))
   return [`background-image:${images.join(',')}${important}`,...(images.length<layers.length?[`background-color:${last}${important}`]:[])];
 }
 return [`${property}:${value}`];
}
// Properties that paint colour. Their declarations without a colour (background:none, border:0,
// box-shadow:none, background-clip:text) are copied unchanged, so the dark rules keep the light rules'
// order: a later light rule that turns a colour off still turns the dark colour off.
const PAINT=/^(-webkit-)?(background(-color|-image|-clip)?|border(-top|-right|-bottom|-left|-block|-inline)?(-color)?|outline(-color)?|box-shadow|text-shadow|color|fill|stroke|text-fill-color)$/;
// One selector's dark declarations, as [text, mapped]: mapped is true where a colour was moved to dark.
function darkDeclarations(selector,parts,{clippedText,size}){
 const out=[];
 // What the colour means is read from the most specific place first: a variable's own name, or a
 // state class (is-freeze, incorrect), then the last part of the selector, then the whole selector.
 const last=selector.split(/[\s>+~]+/).pop();
 const states=(selector.match(/\.(is-[\w-]+|correct|incorrect|wrong|right|matched|mismatch|revealed|selected)\b/g)||[]).join(' ');
 for(const [property,value] of parts){
  const role=clippedText&&/^(-webkit-)?background/.test(property)?'text':roleOf(property,property);
  const coloured=value.match(COLOUR)||new RegExp(VARIANT.source).test(value)||(value.match(NAMED_WHITE)&&/^(color|background|background-color)$/.test(property));
  if(!coloured){if(PAINT.test(property))out.push([`${property}:${value}`,false]);continue;}
  // The big Streak and Gems cards: grey with a small glow, never a large orange or yellow wash.
  const hero=/background/.test(property)&&HERO.find(([pattern])=>pattern.test(selector));
  if(hero){out.push(...longhands('background',heroBackground(hero[1],hero[2])).map(text=>[text,true]));continue;}
  const context=property.startsWith('--')?property:`${states}|${last}|${selector}`;
  let dark=value.replace(COLOUR,c=>darkColour(c,role,context,{big:size>=20})).replace(VARIANT,(m,name)=>{
   if(name==='t'||name==='d')return `var(--${name}-dark)`;
   return role==='text'||role==='edge'?`var(--${name}-text)`:m;
  });
  // A named colour used both as a fill and as text also gets its text version.
  if(role==='accent'&&value.match(COLOUR))out.push([`${property}-text:${value.replace(COLOUR,c=>darkColour(c,'text',property))}`,true]);
  if(/^(background|background-color)$/.test(property))dark=dark.replace(NAMED_WHITE,(m,pre,name)=>pre+(name==='white'?PALETTE.surface:name));
  if(dark!==value)out.push(...longhands(property,dark).map(text=>[text,true]));
  else if(PAINT.test(property))out.push([`${property}:${value}`,false]);
 }
 // Mint buttons need dark text: white text on a rule that paints the mint button colour becomes button ink.
 if(out.some(([text])=>/^background/.test(text)&&text.includes(PALETTE.button)))
  for(const entry of out){const m=entry[0].match(/^color:\s*(#fff\b|#ffffff\b|#fffdf7\b|#fffefa\b|white\b)(.*)$/i);if(m){entry[0]=`color:${PALETTE.buttonInk}${m[2]}`;entry[1]=true;}}
 return out;
}
export function buildDarkCss(read=name=>readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8')){
 const lines=['/* Generated by scripts/build-dark-theme.mjs from the app\'s light styles. Do not edit by hand: run npm run build:dark. */',
  `${DARK}{color-scheme:dark;background:${PALETTE.bg};color:${PALETTE.ink};${PALETTE_VARIABLES}}`];
 for(const file of SOURCES){
  lines.push(`/* ${file} */`);
  for(const {context,selector,body} of rules(read(file))){
   // A gradient clipped to the text is the text's colour; big type (20px or more) may stay green.
   const clippedText=/background-clip\s*:\s*text/.test(body);
   const size=Number((body.match(/font-size\s*:\s*([\d.]+)px/)||[])[1]||0);
   const parts=splitTop(body,';').map(declaration=>{const colon=declaration.indexOf(':');return colon<0?null:[declaration.slice(0,colon).trim(),declaration.slice(colon+1).trim()];}).filter(Boolean);
   // Each selector of a list is judged on its own: one `.subtle-button` in a list must not make every
   // other item a teal label. Selectors that come out the same are listed together again.
   const groups=new Map();
   for(const single of splitTop(selector,',').map(item=>item.trim()).filter(Boolean)){
    const declarations=darkDeclarations(single,parts,{clippedText,size});
    if(!declarations.some(([,mapped])=>mapped))continue;
    const sel=darkSelector(single);if(!sel)continue;
    const key=declarations.map(([text])=>text).join(';');
    groups.set(key,[...(groups.get(key)??[]),sel]);
   }
   for(const [declarations,selectors] of groups){
    const rule=`${selectors.join(',')}{${declarations}}`;
    lines.push(context.reduceRight((inner,at)=>`${at}{${inner}}`,rule));
   }
  }
 }
 lines.push('/* Hand-placed colours (EXTRA in the script) */',...EXTRA.map(([selector,declarations])=>`${WHERE} ${selector}{${declarations}}`));
 return lines.join('\n')+'\n';
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const css=buildDarkCss();
 writeFileSync(new URL(`../src/${OUTPUT}`,import.meta.url),css);
 console.log(`Wrote src/${OUTPUT}: ${css.split('\n').length-1} lines.`);
}
