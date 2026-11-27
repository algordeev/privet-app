// Grades what the recogniser heard against an exercise's accepted answers. It checks
// which words were said, never accent or stress: the recogniser cannot judge those.
export type SpeechVerdict=
 |{type:'match';heard:string}
 |{type:'close';heard:string;missing:string[]}
 |{type:'wrong';heard:string}
 |{type:'silence'};

// Case, punctuation, hyphens, stress marks and ё/е never decide a spoken answer.
export function spokenWords(text:string):string[]{
 return text.normalize('NFD').replace(/[̀́]/g,'').normalize('NFC')
  .toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(' ').filter(Boolean);
}

const same=(a:string[],b:string[])=>a.length===b.length&&a.every((w,i)=>w===b[i]);

// Words of `expected` found in order in `heard` (longest common subsequence).
function matchedInOrder(expected:string[],heard:string[]):boolean[]{
 const n=expected.length,m=heard.length;
 const table=Array.from({length:n+1},()=>new Array<number>(m+1).fill(0));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
  table[i][j]=expected[i]===heard[j]?table[i+1][j+1]+1:Math.max(table[i+1][j],table[i][j+1]);
 const found=new Array<boolean>(n).fill(false);
 for(let i=0,j=0;i<n&&j<m;){
  if(expected[i]===heard[j]){found[i]=true;i++;j++;}
  else if(table[i+1][j]>=table[i][j+1])i++;else j++;
 }
 return found;
}

// candidates: the recogniser's alternatives, best first. accepted: answer + alsoAccepted.
export function gradeSpeech(candidates:readonly string[],accepted:readonly string[]):SpeechVerdict{
 const heard=candidates.filter(text=>spokenWords(text).length);
 if(!heard.length)return {type:'silence'};
 const answers=accepted.map(spokenWords).filter(words=>words.length);
 for(const text of heard)if(answers.some(words=>same(spokenWords(text),words)))return {type:'match',heard:text};
 // Close: a phrase where at least half its words were said, in order, by the best guess.
 const best=spokenWords(heard[0]);
 let close:{missing:string[];found:number}|undefined;
 for(const answer of accepted){
  const words=spokenWords(answer);
  if(words.length<2)continue;
  const found=matchedInOrder(words,best);
  const count=found.filter(Boolean).length;
  if(count*2>=words.length&&(!close||count>close.found)){
   const original=answer.replace(/[^\p{L}\p{N}\ś-]+/gu,' ').trim().split(/\s+/);
   const display=original.length===words.length?original:words;
   close={found:count,missing:display.filter((_,i)=>!found[i])};
  }
 }
 return close?{type:'close',heard:heard[0],missing:close.missing}:{type:'wrong',heard:heard[0]};
}

// A Reply where the learner said the other person's line (all of it, or most of a longer one) instead of
// answering. Checked only after the answer itself came back wrong; it gets a free retry and a nudge.
export function repeatsTheirLine(candidates:readonly string[],line:string):boolean{
 const verdict=gradeSpeech(candidates,[line]);
 return verdict.type==='match'||verdict.type==='close';
}

// What a graded spoken answer does. "Almost" (a phrase with a word missing) earns one free second
// try per step: right then counts as right first time; a second miss costs a heart like any mistake.
export type SpeakOutcome='pass'|'fail'|'almost'|'silence';
export function speakOutcome(verdict:SpeechVerdict,almostUsed:boolean):SpeakOutcome{
 if(verdict.type==='match')return 'pass';
 if(verdict.type==='silence')return 'silence';
 return verdict.type==='close'&&!almostUsed?'almost':'fail';
}
