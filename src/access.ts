// Which lessons are open without Privet Plus.
export const FREE_LESSONS=3;

export type LessonAccess={index:number;plus:boolean;started:boolean;passed:boolean};

// Open with Plus, for the first FREE_LESSONS, and for a lesson already started or passed:
// a lesson in progress stays finishable (and a passed one revisitable) if Plus ends.
export const lessonOpen=({index,plus,started,passed}:LessonAccess)=>plus||index<FREE_LESSONS||started||passed;
