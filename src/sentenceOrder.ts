// Move a selected word to a different sentence position without changing its
// canonical text or mutating the stored answer. Invalid/canceled moves are inert.
export function moveSentenceWord(words:string[],from:number,to:number):string[]{
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=words.length||to>=words.length||from===to)return words;
 const next=[...words];const [word]=next.splice(from,1);next.splice(to,0,word);return next;
}
