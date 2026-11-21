// The order of lessons on home: what to do next first, passed lessons last.
export type HomeLesson={index:number;passed:boolean;started:boolean;open:boolean};

// Up next is the open lesson you're in the middle of, otherwise the first open one not passed yet.
// It leads; the other lessons not passed follow in course order (locked ones included);
// passed lessons go to "Completed", in course order.
export function homeOrder(lessons:readonly HomeLesson[]){
 const pending=lessons.filter(lesson=>!lesson.passed);
 const upNext=pending.find(lesson=>lesson.open&&lesson.started)??pending.find(lesson=>lesson.open)??null;
 return {
  upNext:upNext?.index??null,
  upcoming:[...(upNext?[upNext]:[]),...pending.filter(lesson=>lesson!==upNext)].map(lesson=>lesson.index),
  completed:lessons.filter(lesson=>lesson.passed).map(lesson=>lesson.index),
 };
}
