import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "culture",
 "number": "08",
 "title": "A Russian weekend",
 "description": "Meet Anna at a museum, then plan tea after your visit.",
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
   "pronunciation": "mu-ZEY",
   "meaning": "museum"
  },
  {
   "id": "interesting",
   "text": "Интересно!",
   "stressed": "Интере́сно!",
   "pronunciation": "in-ti-RES-na",
   "meaning": "Interesting!"
  },
  {
   "id": "invite",
   "text": "Давай в музей!",
   "stressed": "Дава́й в музе́й!",
   "pronunciation": "da-VAI v mu-ZEY",
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
   "title": "A weekend with Anna.",
   "instruction": "Meet Anna at a museum, then plan tea after your visit. Explore these five expressions before you try them.",
   "prompt": "музей",
   "answer": "ready",
   "review": "A Russian weekend expressions",
   "success": "You have the expressions for this visit. Let’s put them to use."
  },
  {
   "id": "type",
   "kind": "typed",
   "title": "A place worth visiting.",
   "instruction": "Type “museum” in Russian. The letter buttons are here if you need them.",
   "prompt": "музей",
   "translation": "museum",
   "letters": [
    "й",
    "з",
    "м",
    "е",
    "у"
   ],
   "answer": "музей",
   "review": "музей → museum",
   "success": "Yes: музей means “museum”. A useful word for this story.",
   "retryFeedback": "This cultural place ends in the short y letter. Check the middle letters too.",
   "hint": "A cultural place with five letters; the last is the short y letter."
  },
  {
   "id": "listen",
   "kind": "listen",
   "wordId": "tea",
   "title": "And after?",
   "instruction": "Anna has one more idea. Listen, then choose what you heard.",
   "prompt": "Потом чай?",
   "choices": [
    "Да, давай!",
    "Потом чай?",
    "Давай в музей!"
   ],
   "answer": "Потом чай?",
   "review": "Потом чай? → Tea afterwards?",
   "success": "Yes: Потом чай? means “Tea afterwards?”",
   "retryFeedback": "Replay it: Anna is asking about after the museum.",
   "hint": "It ends with чай, like in Lesson 1."
  },
  {
   "id": "meaning",
   "kind": "choice",
   "wordId": "interesting",
   "title": "Something catches your eye.",
   "instruction": "Choose the meaning of Интересно!",
   "prompt": "Интересно!",
   "choices": [
    "Interesting!",
    "See you tomorrow!",
    "How much is it?"
   ],
   "answer": "Interesting!",
   "review": "Интересно! → Interesting!",
   "success": "Yes—Интересно! means “Interesting!”.",
   "retryFeedback": "This reaction shows curiosity about what you see, rather than saying goodbye.",
   "hint": "Look at the word in the first step and connect it to this situation."
  },
  {
   "id": "match",
   "kind": "match",
   "title": "Your whole course.",
   "instruction": "Match each Russian expression with its meaning.",
   "prompt": "Match the pairs",
   "pairs": [
    ["Да, давай!", "Yes, let’s!"],
    ["До завтра!", "See you tomorrow!"],
    ["Потом чай?", "Tea afterwards?"],
    ["Давай в музей!", "Let’s go to the museum!"],
    ["Привет!", "Hi!"]
   ],
   "answer": "matched",
   "review": "Да, давай! → Yes, let’s! · До завтра! → See you tomorrow! · Потом чай? → Tea afterwards? · Давай в музей! → Let’s go to the museum! · Привет! → Hi!",
   "success": "All matched: words from your first lesson to your last.",
   "retryFeedback": "Check the pairs that didn't lock in.",
   "hint": "Two of these come from earlier lessons: a greeting and a goodbye."
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Tomorrow at the museum.",
   "instruction": "Build “Let’s go to the museum tomorrow!”",
   "prompt": "Давай в музей завтра",
   "translation": "Let’s go to the museum tomorrow!",
   "tokens": [
    "завтра",
    "музей",
    "Давай",
    "в"
   ],
   "answer": "Давай в музей завтра",
   "alsoAccepted": [
    "Давай завтра в музей"
   ],
   "review": "Давай в музей завтра → Let’s go to the museum tomorrow!",
   "success": "That works: Давай в музей завтра. Let’s go to the museum tomorrow!",
   "retryFeedback": "The words are right; try a different order for this message.",
   "hint": "Begin with the invitation; keep в directly before the place.",
   "pronunciationGuide": "Дава́й · da-VAI / в музе́й · v mu-ZEY / за́втра · ZAF-tra"
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "A visit, then a cup.",
   "instruction": "You accept both parts of Anna’s plan: a museum visit and tea.",
   "prompt": "Привет! Давай в музей! Потом чай?",
   "exchange": {
    "speaker": "ANNA",
    "text": "Привет! Давай в музей! Потом чай?",
    "meaning": "Hi! Let’s go to the museum! Tea afterwards?"
   },
   "choices": [
    "Да, давай!",
    "Где ты работаешь?",
    "Меня зовут Анна."
   ],
   "answer": "Да, давай!",
   "review": "Привет! Давай в музей! Потом чай? → Да, давай!",
   "success": "You accept both parts of Anna’s plan: a museum visit and tea. Да, давай!",
   "retryFeedback": "Anna has offered a friendly plan. Choose a reply that accepts it.",
   "hint": "Choose a reply that fits the invitation or question, rather than starting a new topic."
  },
  {
   "id": "visit",
   "kind": "choice",
   "title": "Inside the museum.",
   "instruction": "Anna asks what you think of the museum. You love it.",
   "prompt": "Интересно?",
   "exchange": {
    "speaker": "ANNA",
    "text": "Интересно?",
    "meaning": "Interesting?"
   },
   "translation": "Yes, very interesting!",
   "choices": [
    "Сколько стоит?",
    "Да, очень интересно!",
    "Я учусь."
   ],
   "answer": "Да, очень интересно!",
   "review": "Интересно? → Да, очень интересно!",
   "success": "Yes: очень makes it stronger, just like in Очень приятно!",
   "retryFeedback": "Anna wants your opinion of the museum.",
   "hint": "Add очень from Lesson 2 to make it stronger."
  }
 ],
 "summary": "You met Anna at a museum, said what you thought of it, and planned tea afterwards.",
 "completionTip": "Try planning a small outing with Давай… and finish with До завтра!"
};
