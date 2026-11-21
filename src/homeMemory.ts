// What home looked like when you left it (it unmounts while a lesson, Profile or Settings is open):
// where it was scrolled, which card was big and which finished chapters were opened. Coming back
// restores it, except right after a lesson was newly passed: then home opens at the top in its
// default state, so the passed lesson's glide down to Completed is seen.
export const homeMemory={scroll:0,picked:null as string|null,folds:[] as number[],passed:null as ReadonlySet<string>|null};

export const newlyPassedSince=(passed:readonly string[])=>homeMemory.passed!==null&&passed.some(id=>!homeMemory.passed!.has(id));
