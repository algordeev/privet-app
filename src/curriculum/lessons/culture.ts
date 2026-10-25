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
   "pronunciationGuide": "Дава́й · da-VAI / в музе́й · v mu-ZYEY / за́втра · ZAF-tra"
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
  }
 ],
 "summary": "You understood a museum-and-tea invitation and combined earlier greetings, plans, and tomorrow in a conversation.",
 "completionTip": "Try planning a small outing with Давай… and finish with До завтра!"
};
