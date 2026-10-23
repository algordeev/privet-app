import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "culture",
 "number": "08",
 "title": "A Russian weekend",
 "description": "Plan a museum outing with Anna, enjoy the visit, and agree to tea afterwards.",
 "icon": "✦",
 "motivationTags": [
  "Culture",
  "Conversations",
  "Travel"
 ],
 "skills": [
  "suggest a cultural visit",
  "combine greetings and plans"
 ],
 "prerequisiteIds": [
  "studies"
 ],
 "words": [
  {
   "id": "museum",
   "text": "музей",
   "stressed": "музе́й",
   "pronunciation": "mu-ZYEY",
   "meaning": "museum"
  },
  {
   "id": "interesting",
   "text": "Интересно!",
   "stressed": "Интере́сно!",
   "pronunciation": "een-tee-RYES-na",
   "meaning": "Interesting!"
  },
  {
   "id": "invite",
   "text": "Давай в музей!",
   "stressed": "Дава́й в музе́й!",
   "pronunciation": "da-VAI v mu-ZYEY",
   "meaning": "Let’s go to the museum! (informal)"
  },
  {
   "id": "tea",
   "text": "Потом чай?",
   "stressed": "Пото́м чай?",
   "pronunciation": "pa-TOM chai",
   "meaning": "Tea afterwards?"
  },
  {
   "id": "agree",
   "text": "Да, давай!",
   "stressed": "Да, дава́й!",
   "pronunciation": "da da-VAI",
   "meaning": "Yes, let’s!"
  }
 ],
 "exercises": [
  {
   "id": "discover",
   "kind": "vocabulary",
   "title": "A small weekend plan.",
   "instruction": "You and Anna want an outing, with time for a cup afterwards. Explore the museum words alongside familiar invitation and tea language.",
   "prompt": "музей",
   "answer": "ready",
   "review": "A museum outing, interest, and tea afterwards",
   "success": "You can suggest a place, show interest there, and make a small plan for afterwards."
  },
  {
   "id": "meaning",
   "kind": "choice",
   "title": "Suggest the outing.",
   "instruction": "You want to suggest a museum visit to Anna. Which phrase proposes that activity?",
   "prompt": "музей",
   "choices": [
    "Давай в музей!",
    "Потом чай?",
    "До завтра!"
   ],
   "answer": "Давай в музей!",
   "review": "Давай в музей! → Let’s go to the museum!",
   "success": "You proposed a place to visit together, using the invitation language from your walk with Alex.",
   "retryFeedback": "One option suggests tea later, and another says goodbye. Choose the museum proposal.",
   "hint": "Look for the invitation word followed by the place you want to visit."
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Set it for tomorrow.",
   "instruction": "Build the short informal proposal. Start with Давай, put the day next, and finish with в музей.",
   "prompt": "Давай завтра в музей!",
   "translation": "Let’s go to the museum tomorrow!",
   "answer": "Давай завтра в музей!",
   "tokens": [
    "музей!",
    "завтра",
    "Давай",
    "в"
   ],
   "review": "Давай завтра в музей! → Let’s go to the museum tomorrow!",
   "success": "You reused tomorrow’s planning language for a new outing.",
   "retryFeedback": "Other orders can be natural, but this model puts the day immediately after Давай.",
   "hint": "Keep the short place phrase together at the end, after the day.",
   "pronunciationGuide": "Дава́й · da-VAI / за́втра · ZAF-tra / в музе́й · v mu-ZYEY"
  },
  {
   "id": "interest",
   "kind": "choice",
   "title": "Something catches your eye.",
   "instruction": "During the visit, an exhibit catches your attention. Choose a short reaction showing interest.",
   "prompt": "музей",
   "choices": [
    "Сколько стоит?",
    "До завтра!",
    "Интересно!"
   ],
   "answer": "Интересно!",
   "review": "Интересно! → Interesting!",
   "success": "You shared your interest with Anna. This is a reaction you can use beyond a museum, too.",
   "retryFeedback": "You’re looking at an exhibit, not buying it or ending the visit.",
   "hint": "Choose the reaction about finding something interesting."
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "The visit ends. The tea can begin.",
   "instruction": "After the museum, Anna suggests tea. You’d like a cup too; accept her idea.",
   "prompt": "Потом чай?",
   "choices": [
    "Нет, спасибо.",
    "Да, давай!",
    "До завтра!"
   ],
   "answer": "Да, давай!",
   "review": "Потом чай? — Да, давай! → Tea afterwards? — Yes, let’s!",
   "success": "You followed the outing through to a friendly plan for tea. Familiar café language has a new setting.",
   "retryFeedback": "You want tea, so choose an acceptance rather than a refusal or goodbye.",
   "hint": "Combine a yes with the informal acceptance you used with Alex.",
   "exchange": {
    "speaker": "ANNA",
    "text": "Потом чай?",
    "meaning": "Tea afterwards?"
   }
  }
 ],
 "summary": "You suggested a museum outing, planned it for tomorrow, showed interest during the visit, and accepted tea afterwards.",
 "completionTip": "For an informal outing, try Давай завтра в музей! Afterwards, Потом чай? is a friendly tea suggestion.",
 "contentRevision": 2
};
