// Move a selected word to a different sentence position without changing its
// canonical text or mutating the stored answer. Invalid/canceled moves are inert.
export function moveSentenceWord(words:string[],from:number,to:number):string[]{
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=words.length||to>=words.length||from===to)return words;
 const next=[...words];const [word]=next.splice(from,1);next.splice(to,0,word);return next;
}

// Occurrence ordinals are derived UI identities only; answers remain string[].
export function sentenceOccurrences(words:readonly string[]){
 const counts=new Map<string,number>();
 return words.map(word=>{const occurrence=counts.get(word)??0;counts.set(word,occurrence+1);return {word,occurrence,key:JSON.stringify([word,occurrence])};});
}
export function sentenceBank(source:readonly string[],selected:readonly string[]){
 const counts=new Map<string,number>();for(const word of selected)counts.set(word,(counts.get(word)??0)+1);
 return sentenceOccurrences(source).map(item=>({...item,selected:(counts.get(item.word)??0)>item.occurrence}));
}
export function selectSentenceWord(selected:string[],source:readonly string[],index:number):string[]{
 const item=sentenceBank(source,selected)[index];
 return item&&!item.selected?[...selected,item.word]:selected;
}
export function removeSentenceWord(words:string[],index:number):string[]{
 return Number.isInteger(index)&&index>=0&&index<words.length?words.filter((_,position)=>position!==index):words;
}
export function validSentenceTokens(tokens:unknown,source:readonly string[]):tokens is string[]{
 if(!Array.isArray(tokens))return false;
 const remaining=new Map<string,number>();for(const word of source)remaining.set(word,(remaining.get(word)??0)+1);
 return tokens.every(word=>{if(typeof word!=='string')return false;const count=remaining.get(word)??0;if(!count)return false;remaining.set(word,count-1);return true;});
}
