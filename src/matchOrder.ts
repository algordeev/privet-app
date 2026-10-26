// Fixed, content-independent scramble for the English column: alphabetical, so a
// lesson's pair order never lines up with its meanings and snapshots stay stable.
export function matchOrder<T extends readonly [string,string]>(pairs:readonly T[]):T[]{
 return [...pairs].sort((a,b)=>a[1].localeCompare(b[1],'en',{sensitivity:'base'}));
}
