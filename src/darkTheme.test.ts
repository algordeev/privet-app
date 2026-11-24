import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GRAPHITE,SYSTEM,darkColour,meaningOf} from './darkColours.ts';
import {APPEARANCE_KEY,resolveTheme,restoreAppearance,savedAppearance} from './appearance.ts';
// @ts-expect-error The generator is a plain .mjs script without type declarations.
import {buildDarkCss,OUTPUT} from '../scripts/build-dark-theme.mjs';

test('the dark styles are generated from the current light styles (run npm run build:dark)',()=>{
 assert.equal(readFileSync(new URL(`./${OUTPUT}`,import.meta.url),'utf8'),buildDarkCss());
});

test('the dark styles only ever apply inside the app, and only when dark is on',()=>{
 const css=buildDarkCss() as string;
 const rules=css.split('\n').filter(line=>line&&!line.startsWith('/*'));
 for(const rule of rules){
  const selectors=rule.replace(/^(@[^{]+\{)+/,'').slice(0,rule.replace(/^(@[^{]+\{)+/,'').indexOf('{'));
  for(const selector of selectors.split(/,(?![^(]*\))/))assert.match(selector.trim(),/^(:where\()?html\.native-platform\[data-theme="dark"\]/,selector);
 }
 // The robot and its screen faces keep their own colours.
 assert.doesNotMatch(css,/robot-head|oled-|antenna/);
});

test('the app’s main colours land on the approved Graphite palette',()=>{
 assert.equal(darkColour('#f8f6f0','fill'),GRAPHITE.bg);// the page
 assert.equal(darkColour('#fffdf7','fill'),GRAPHITE.surface);// cards
 assert.equal(darkColour('#246653','fill'),GRAPHITE.button);// teal buttons
 assert.equal(darkColour('#246653','text'),GRAPHITE.accent);// teal labels
 assert.equal(darkColour('#232b29','text'),GRAPHITE.ink);// main text
 assert.equal(darkColour('#68716a','text'),GRAPHITE.muted);// secondary text
 assert.equal(darkColour('#ffffff','text'),'#ffffff');// white text on a coloured button stays white
});

test('dark rules keep the light rules’ priority, and change only the colour part of a shorthand',()=>{
 const css=buildDarkCss() as string;
 // The website's lesson border must stay removed by the app's own `border:0` (it was a line at the top of every lesson).
 assert.match(css,/:where\(html\.native-platform\[data-theme="dark"\]\) \.lesson-panel\{background-color:[^;]+;border-color:/);
 // The speaking word's fill is clipped to the text: the dark copy sets only the gradient, in text colours.
 assert.match(css,/speak-word\.is-sweeping > span\{background-image:linear-gradient\(90deg,#74c7a8 50%,#eceeed 50%\);-webkit-background-clip:text;background-clip:text;color:transparent\}/);
 // A later light rule that removes a colour is copied too, in order: the app's own `border:0`, and
 // reduce motion's `background:none` for the speaking word.
 assert.match(css,/\.native-app \.lesson-panel\{border:0;box-shadow:none;/);
 assert.match(css,/speak-word\.is-sweeping > span\{background:none;color:#74c7a8\}/);
});

test('colour set A: each meaning has one iOS system colour, and coloured boxes become see-through tints',()=>{
 // Names win over hue: the light theme's peach is the colour of mistakes.
 assert.equal(meaningOf(40,'.feedback.incorrect'),'heart');
 assert.equal(meaningOf(40,'.is-freeze|.gems-row-icon'),'freeze');
 assert.equal(meaningOf(130,'.gems-row-icon'),'brand');// a Gems page row is not a gem
 assert.equal(meaningOf(200,''),'brand');assert.equal(meaningOf(90,''),'gem');
 assert.equal(darkColour('#c4673f','text','.streak-count'),SYSTEM.streak);
 assert.equal(darkColour('#b9504b','text','.is-heart .gems-row-icon'),SYSTEM.heart);
 // A pale box becomes a tint of the meaning colour (8–20%), never a brown or olive grey.
 assert.match(darkColour('#faecdf','fill','.feedback.incorrect'),/^#ff6961[0-9a-f]{2}$/);
 assert.match(darkColour('#fff4cf','fill','.gem-pill'),/^#ffd60a[0-9a-f]{2}$/);
 // Faintly coloured text (dark green titles, grey-green labels) is plain text in the dark.
 assert.equal(darkColour('#8a957f','text','|span|.streak-weekdays span'),GRAPHITE.muted);
 assert.equal(darkColour('#31513a','text','.gems-row-text strong'),GRAPHITE.ink);

 // A class of its own that names a meaning wins over a muted light shade: the streak pill and its unit.
 assert.equal(darkColour('#7c5842','text','|.native-streak-badge|.native-streak-badge'),SYSTEM.streak);
 // A see-through colour stays see-through: the tour's 15% green dim layer and onboarding's 8% letters.
 assert.match(darkColour('#29493626','fill','|::backdrop|.native-lesson-tour::backdrop'),/^#[0-9a-f]{6}26$/);
 assert.match(darkColour('#53826c15','text','|span|.first-backdrop > span'),/^#[0-9a-f]{6}1[45]$/);// 8%, rounded
 // A gold or orange box stays grey (it would read brown); only small parts like pills get the tint.
 assert.doesNotMatch(darkColour('#fff4cf','fill','|.native-profile-gems|.native-profile-gems'),/^#ffd60a/);
 // Big green numbers (Profile stats, scores) stay Privet green.
 assert.equal(darkColour('#315a3c','text','|strong|.native-stat-grid dd strong',{big:true}),GRAPHITE.accent);
 // A warm grey box without a name is a plain grey surface, never olive.
 assert.doesNotMatch(darkColour('#eeeede','fill','|.native-profile-card|.native-profile-card'),/^#ffd60a/);
});

test('dark text stays readable: at least 4.5 : 1 on the cards',()=>{
 const lum=(h:string)=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 const ratio=(a:string,b:string)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 for(const text of [GRAPHITE.ink,GRAPHITE.muted,GRAPHITE.accent])assert.ok(ratio(text,GRAPHITE.surface)>=4.5,text);
 assert.ok(ratio('#ffffff',GRAPHITE.button)>=4.5,'white on a teal button');
 // Coloured text the light theme uses on cards: hearts, wrong, correct and link greens.
 for(const light of ['#a84d4b','#8e3b2e','#2f6a45','#3f7fa6','#7a5b0c'])assert.ok(ratio(darkColour(light,'text'),GRAPHITE.surface)>=4.5,light);
});

test('Appearance: nothing saved means System, which follows the iPhone',()=>{
 assert.equal(APPEARANCE_KEY,'privet-demo-v1-appearance');
 assert.equal(restoreAppearance(null),'system');
 assert.equal(restoreAppearance('not json'),'system');
 assert.equal(restoreAppearance(JSON.stringify({version:2,appearance:'dark'})),'system');
 for(const value of ['system','light','dark'] as const)assert.equal(restoreAppearance(savedAppearance(value)),value);
 assert.equal(resolveTheme('system',true),'dark');assert.equal(resolveTheme('system',false),'light');
 assert.equal(resolveTheme('light',true),'light');assert.equal(resolveTheme('dark',false),'dark');
});
