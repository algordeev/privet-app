// The dark theme's colours: the approved palette (PALETTE), and the rule that moves any light colour of
// the app onto it. Used by scripts/build-dark-theme.mjs (which writes src/nativeDark.css) and by
// screens that set colours inline, such as each lesson's tint on home.

// The dark palette: Playful (chosen 2026-11-25, after Graphite felt flat and sad). A deep night-blue base,
// a bright mint for buttons (with dark text and a chunky edge, see nativeDarkPlayful.css) and Privet's teal
// for text. Earlier: Graphite greys (2026-11-24).
export const PALETTE={
 bg:'#121a2b',surface:'#1c2639',surface2:'#273249',line:'#2f3b55',
 ink:'#f5f7fc',muted:'#b6c0d6',faint:'#8c97b0',accent:'#46e0a4',
 button:'#3fd49a',buttonInk:'#08281c',buttonEdge:'#1f9e6c',
} as const;
// The in-between surfaces the light theme has (fills inside cards, tracks, lines) are worked out from
// these: a night-blue hue, never a plain grey.
const NIGHT={h:262,C:.035};

// The brand teal has two approved dark values: the button fill, and the brighter teal for text and lines.
const BRAND_TEAL='#246653';

// ---- Colour maths (sRGB <-> OKLab/OKLCh) ----
const toLinear=(v:number)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const fromLinear=(v:number)=>v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055;
function parseColour(text:string){
 let r=0,g=0,b=0,a=1;const t=text.trim().toLowerCase();
 if(t.startsWith('#')){
  let h=t.slice(1);if(h.length<=4)h=[...h].map(c=>c+c).join('');
  r=parseInt(h.slice(0,2),16);g=parseInt(h.slice(2,4),16);b=parseInt(h.slice(4,6),16);if(h.length===8)a=parseInt(h.slice(6,8),16)/255;
 }else{
  const p=t.slice(t.indexOf('(')+1,-1).split(/[\s,/]+/).filter(Boolean);
  [r,g,b]=p.slice(0,3).map(Number);if(p[3]!==undefined)a=p[3].endsWith('%')?parseFloat(p[3])/100:Number(p[3]);
 }
 return {r,g,b,a};
}
function oklch({r,g,b}:{r:number;g:number;b:number}){
 const [R,G,B]=[r,g,b].map(v=>toLinear(v/255));
 const l=Math.cbrt(.4122214708*R+.5363325363*G+.0514459929*B),m=Math.cbrt(.2119034982*R+.6806995451*G+.1073969566*B),s=Math.cbrt(.0883024619*R+.2817188376*G+.6299787005*B);
 const L=.2104542553*l+.793617785*m-.0040720468*s,A=1.9779984951*l-2.428592205*m+.4505937099*s,Bb=.0259040371*l+.7827717662*m-.808675766*s;
 return {L,C:Math.hypot(A,Bb),h:(Math.atan2(Bb,A)*180/Math.PI+360)%360};
}
function fromOklch({L,C,h}:{L:number;C:number;h:number}):number[]{
 // Reduce chroma until the colour fits in sRGB.
 for(let c=C;c>=0;c-=.002){
  const A=c*Math.cos(h*Math.PI/180),B=c*Math.sin(h*Math.PI/180);
  const l=(L+.3963377774*A+.2158037573*B)**3,m=(L-.1055613458*A-.0638541728*B)**3,s=(L-.0894841775*A-1.291485548*B)**3;
  const rgb=[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
  if(rgb.every(v=>v>=-1e-4&&v<=1+1e-4))return rgb.map(v=>Math.round(fromLinear(Math.min(1,Math.max(0,v)))*255));
 }
 return [0,0,0].map(()=>Math.round(fromLinear(Math.min(1,Math.max(0,L**3)))*255));
}
const hex=([r,g,b]:number[],a=1)=>'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')+(a<1?Math.round(a*255).toString(16).padStart(2,'0'):'');
const fixed=(name:keyof typeof PALETTE)=>{const c=parseColour(PALETTE[name]);return [c.r,c.g,c.b];};
const fixedHex=(name:keyof typeof PALETTE)=>PALETTE[name];
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const PAPER_L=oklch(parseColour('#f8f6f0')).L;

// What a colour is used for decides where it lands: text, a fill, or an edge (border, outline, shadow).
export type Role='text'|'fill'|'edge'|'accent';
export function roleOf(property:string,customName=''):Role{
 const p=property.toLowerCase();
 if(p.startsWith('--')){
  if(/soft|surface|page|card|paper|bg/.test(customName||p))return 'fill';
  if(/line|border/.test(customName||p))return 'edge';
  if(/ink|text|muted|quiet|body/.test(customName||p))return 'text';
  return 'accent';
 }
 if(/^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color)$/.test(p))return 'text';
 if(/^(background|background-color|background-image|accent-color)$/.test(p))return 'fill';
 return 'edge';
}

// One colour per meaning (set A from 2026-11-24, made brighter for the Playful palette). Surfaces stay
// the night-blue surfaces; colour goes on icons, numbers and labels, with a see-through tint of it behind pills,
// badges and tiles, and a stronger line around what is selected. The coral robot never changes.
export const SYSTEM={
 streak:'#ff9f1c',gem:'#ffd23f',heart:'#ff6b81',good:'#5df08f',freeze:'#59c3ff',brand:PALETTE.accent,purple:'#a98bff',
} as const;
export type Meaning=keyof typeof SYSTEM;
// What a coloured part means: first from its class name, then from its hue. Peach is the light theme's
// colour for mistakes, so names win over hue. Greens without a name are Privet teal, not "right".
const NAMED:[RegExp,Meaning][]=[
 [/incorrect|wrong|error|mistake|reset|heart|fail|danger|slip|mismatch|destructive/,'heart'],
 [/streak|flame|fire|medal/,'streak'],
 [/gem(?!s-(row|screen|list|section|page))|diamond/,'gem'], // the Gems page's own rows are not all about gems
 [/freeze|frost/,'freeze'],
 [/correct|right|success|matched|passed|done|earned/,'good'],
 // Privet's own boxes: companion messages, revealed words, the XP and Plus cards, the latest attempt.
 [/revealed|feedback|xp-breakdown|profile-plus|profile-result|review-box/,'brand'],
];
// `selector` may list several contexts, most specific first, separated by "|": the first one that names a meaning wins.
export function meaningOf(h:number,selector=''):Meaning{return meaningDetail(h,selector).meaning;}
// `own`: the element's own class or a state class names the meaning (the first two contexts); otherwise
// it came from an ancestor's class or the hue, which says less about this particular element.
function meaningDetail(h:number,selector=''):{meaning:Meaning;own:boolean}{
 const contexts=selector.split('|');
 for(const [index,context] of contexts.entries())for(const [pattern,meaning] of NAMED)if(pattern.test(context))return {meaning,own:index<Math.max(1,contexts.length-1)};
 return {meaning:hueMeaning(h),own:false};
}
function hueMeaning(h:number):Meaning{
 if(h<40||h>=345)return 'heart';
 if(h<75)return 'streak';
 if(h<110)return 'gem';
 if(h<215)return 'brand';
 if(h<275)return 'freeze';
 return 'purple';
}
const SMALL=/pill|badge|chip|icon|tile|tag|count|price|medal|dot|bar|track|unit|legend|svg|^i$|^b$/;
const LABEL=/^(a|button|strong|b|label|h[1-6]|svg|path|summary)\b|link|button|kicker|label|mark|check|icon|tag|count|hint|title|heading|tab|chip|badge|pill|action|cta|start|next|level|status|step/;
const rgba=(colour:string,alpha:number)=>{const c=parseColour(colour);return hex([c.r,c.g,c.b],Math.round(alpha*100)/100);};
// How strong a tint is: as strong as the light theme's tint was (a faint wash stays faint), within 8–20%.
const tintAlpha=(C:number)=>clamp(C*4,.08,.2);
// The large cards at the top of Streak and Gems, and the robot's stage in first run: grey, with only a
// small glow of their colour behind the icon or the robot.
export const heroBackground=(meaning:Meaning,at='50% 20%')=>`radial-gradient(45% 34% at ${at},${rgba(SYSTEM[meaning],.2)},transparent),${PALETTE.surface}`;

// One light colour in one role -> its dark colour. `selector` is the CSS rule it comes from (empty for inline colours).
export function darkColour(text:string,role:Role,selector='',{big=false}:{big?:boolean}={}):string{
 const c=parseColour(text),{L,C,h}=oklch(c),a=c.a;
 if(text.trim().toLowerCase()===BRAND_TEAL)return role==='fill'||role==='accent'?PALETTE.button:PALETTE.accent;
 const {meaning,own}=meaningDetail(h,selector),solid=SYSTEM[meaning];
 // A see-through light colour stays see-through: a 15% green scrim must not become a solid green screen,
 // and an 8% watermark letter must not become solid teal text.
 const keep=(colour:string)=>a<1?rgba(colour,a):colour;
 if(role==='text'&&L<=.9){
  // Text whose own class names a meaning (the streak pill, "days", a gems count) takes that colour,
  // even where the light theme drew it in a dark, muted shade.
  if(own&&C>=.035)return keep(solid);
  // Big green numbers and headings (stats, scores, XP) stay Privet green: teal in the dark.
  if(big&&meaning==='brand'&&C>=.03)return keep(PALETTE.accent);
 }
 // A named box gets a clean tint of its colour. Gold and orange only on small things (pills, badges,
 // icon tiles): over a larger box they read as brown or olive, so those boxes stay grey (their outline
 // and text carry the colour).
 const small=SMALL.test(selector.split('|')[1]??selector);
 const warm=meaning==='gem'||meaning==='streak';
 if(role==='fill'&&L>.8&&own&&C>=(warm?.025:.008)&&a>=.6&&(small||!warm))return rgba(solid,Math.max(tintAlpha(C),.1));
 const warmBox=role==='fill'&&L>.8&&warm&&(!small||C<.025)&&selector!=='';
 // Light-theme text is a dark grey with a hint of green: it counts as neutral and becomes the dark ink.
 // Pale boxes without a name and with barely any colour (warm greys) become plain grey surfaces.
 const neutral=warmBox||C<(role==='text'&&L<.62?.06:.025);
 if(!neutral){
  if(role==='text'&&L>.9)return text; // white text sits on a coloured button or badge
  // Faintly coloured text (warm titles, olive captions, grey-green labels) is ordinary text in the dark:
  // white or grey. Clearly coloured text, icons and Privet's teal links keep their meaning colour.
  if(role==='text'&&L<.8&&C<.09&&!(meaning==='brand'&&C>=.08)&&!/icon|svg|medal|check/.test(selector))return keep(fixedHex(L<.45?'ink':L<.7?'muted':'faint'));
  // Strong green body text (paragraphs, notes) reads as plain text in the dark; teal stays on things
  // that act like labels: links, buttons, headings, kickers, checks, icons and counts.
  if(role==='text'&&meaning==='brand'&&!own&&!big&&!LABEL.test(selector.split('|')[1]??selector))return keep(fixedHex('ink'));
  if(role==='text'||role==='accent')return keep(meaning==='brand'&&role==='accent'&&L<.6?PALETTE.button:solid);
  if(role==='edge')return rgba(solid,Math.min(a,.55));
  // Fills: light tints become a see-through tint; solid colours (buttons, bars, medals) stay solid.
  if(L>.8)return rgba(solid,tintAlpha(C)*a);
  return keep(meaning==='brand'?PALETTE.button:solid);
 }
 let rgb:number[];
 if(role==='text'){
  if(L>.9)return text;
  // Very light grey "text" in light is a watermark (a faint icon behind a number): it stays faint.
  rgb=L>=.8?fromOklch({L:.38,C:NIGHT.C,h:NIGHT.h}):fixed(L<.45?'ink':L<.7?'muted':'faint'); // the same steps as faintly coloured text
 }else if(role==='fill'){
  if(L>.62){
   // Light neutrals keep their order of elevation: the page is darkest, cards a step up,
   // and the fills that sit inside cards (darker than paper in light) a step further.
   if(Math.abs(L-PAPER_L)<.006)rgb=fixed('bg');
   else if(L>.985)rgb=fixed('surface');
   else{const d=L-PAPER_L;rgb=fromOklch({L:clamp(.215+(d>0?d*1.6:-d*2.4),.19,.46),C:NIGHT.C,h:NIGHT.h});}
  }else{
   if(a<.6)return text; // shadows and scrims stay dark
   rgb=fromOklch({L:L<.4?.36:.42,C:NIGHT.C,h:NIGHT.h}); // a dark button stays visible on the dark page
  }
 }else if(role==='edge'){
  if(L<.5&&a<.6)return text; // shadows
  rgb=L>.75?fromOklch({L:clamp(.33+(.95-L)*.4,.3,.42),C:NIGHT.C,h:NIGHT.h}):fromOklch({L:clamp(1-L,.36,.75),C:NIGHT.C,h:NIGHT.h});
 }else{
  if(L>.9)return text;
  rgb=fixed(L<.4?'ink':'muted');
 }
 if(c.a<1&&role!=='text'&&L>.9)return hex(fixed('surface'),a); // white glass becomes dark glass
 return hex(rgb,a);
}

// A lesson's solid tile colour in the Playful dark theme: its own hue, bright enough for an emoji to sit on.
export function brightTile(colour:string):string{
 const {C,h}=oklch(parseColour(colour));
 return hex(fromOklch({L:.76,C:clamp(C*2.2,.1,.16),h}));
}
export const tileTint=(colour:string)=>rgba(brightTile(colour),.2);
