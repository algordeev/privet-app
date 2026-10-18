// Privet vs Duolingo. Duolingo facts come from its public web app, analysed in
// docs/duolingo-mechanics.md. Keep every row checkable against that document or Privet's code.
export type ComparisonRow={id:string;feature:string;privet:string;duolingo:string};
export const comparisonRows:readonly ComparisonRow[]=[
 {id:'companion',feature:'Learning buddy',privet:'A real desk companion (ESP32 screen + moving head) reacts to every answer.',duolingo:'Animated characters on the screen only.'},
 {id:'hearts',feature:'Running out of hearts',privet:'Hearts are per lesson. Tap Try again and keep learning straight away.',duolingo:'Free hearts refill over time or cost gems, so you may have to wait.'},
 {id:'gems',feature:'Gems',privet:'Earned only by learning; one fixed price for everything.',duolingo:'Refilling hearts costs 350 gems, or 450 if you run out mid-lesson.'},
 {id:'ads',feature:'Ads',privet:'No ads.',duolingo:'The free plan shows ads, including after lessons.'},
 {id:'privacy',feature:'Account & your data',privet:'No account. Your progress never leaves your phone.',duolingo:'Progress is sent to and stored on Duolingo’s servers.'},
 {id:'offline',feature:'Internet',privet:'Lessons are built into the app and work offline.',duolingo:'The web app downloads each lesson from Duolingo’s servers.'},
 {id:'pronunciation',feature:'Pronunciation help',privet:'Every word shows how to say it (spa-SEE-ba) plus optional stress marks.',duolingo:'Audio, with a transliteration toggle in some courses.'},
];
export const comparisonFairNote='Duolingo is still ahead on course size: 40+ exercise types, many languages, leagues and friends. Privet focuses on a calm, private, hands-on start in Russian.';
