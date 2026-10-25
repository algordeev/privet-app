import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "making-plans",
 "number": "06",
 "title": "Making plans",
 "description": "Invite Alex for a walk and agree to meet tomorrow.",
 "icon": "↗",
 "motivationTags": [
  "Conversations",
  "Travel"
 ],
 "skills": [
  "invite someone",
  "agree a day"
 ],
 "prerequisiteIds": [
  "daily-life"
 ],
 "words": [
  {
   "id": "today",
   "text": "сегодня",
   "stressed": "сего́дня",
   "pronunciation": "see-VOD-nya",
   "meaning": "today"
  },
  {
   "id": "tomorrow",
   "text": "завтра",
   "stressed": "за́втра",
   "pronunciation": "ZAF-tra",
   "meaning": "tomorrow"
  },
  {
   "id": "walk",
   "text": "Давай гулять!",
   "stressed": "Дава́й гуля́ть!",
   "pronunciation": "da-VAI gu-LYAT",
   "meaning": "Let’s go for a walk! (informal)"
  },
  {
   "id": "agree",
   "text": "Давай!",
   "stressed": "Дава́й!",
   "pronunciation": "da-VAI",
   "meaning": "Let’s! / Sure! (informal)"
  },
  {
   "id": "meet",
   "text": "До завтра!",
   "stressed": "До за́втра!",
   "pronunciation": "da ZAF-tra",
   "meaning": "See you tomorrow!"
  }
 ],
 "exercises": [
  {
   "id": "discover",
   "kind": "vocabulary",
   "title": "A walk with Alex.",
   "instruction": "Invite Alex for a walk and agree to meet tomorrow. Explore these five expressions before you try them.",
   "prompt": "сегодня",
   "answer": "ready",
   "review": "Making plans expressions",
   "success": "You have the expressions for this visit. Let’s put them to use."
  },
  {
   "id": "meaning",
   "kind": "choice",
   "wordId": "today",
   "title": "Today or tomorrow?",
   "instruction": "Choose the meaning of сегодня",
   "prompt": "сегодня",
   "choices": [
    "today",
    "in the evening",
    "tomorrow"
   ],
   "answer": "today",
   "review": "сегодня → today",
   "success": "Yes—сегодня means “today”.",
   "retryFeedback": "This is the day you are living right now, not the next one.",
   "hint": "Look at the word in the first step and connect it to this situation."
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "Alex has an idea.",
   "instruction": "A short Давай! warmly accepts Alex’s informal invitation.",
   "prompt": "Давай гулять завтра!",
   "exchange": {
    "speaker": "ALEX",
    "text": "Давай гулять завтра!",
    "meaning": "Let’s go for a walk tomorrow!"
   },
   "choices": [
    "Давай!",
    "Сколько стоит?",
    "Меня зовут Анна."
   ],
   "answer": "Давай!",
   "review": "Давай гулять завтра! → Давай!",
   "success": "A short Давай! warmly accepts Alex’s informal invitation. Давай!",
   "retryFeedback": "Alex suggests something you can do together. A brief acceptance is enough.",
   "hint": "Choose a reply that fits the invitation or question, rather than starting a new topic."
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Agree on tomorrow.",
   "instruction": "Build “Let’s go for a walk tomorrow!”",
   "prompt": "Давай гулять завтра",
   "translation": "Let’s go for a walk tomorrow!",
   "tokens": [
    "завтра",
    "Давай",
    "гулять"
   ],
   "answer": "Давай гулять завтра",
   "alsoAccepted": [
    "Давай завтра гулять"
   ],
   "review": "Давай гулять завтра → Let’s go for a walk tomorrow!",
   "success": "That works: Давай гулять завтра. Let’s go for a walk tomorrow!",
   "retryFeedback": "The words are right; try a different order for this message.",
   "hint": "Start with the invitation, add the activity, then the day.",
   "pronunciationGuide": "Дава́й · da-VAI / гуля́ть · gu-LYAT / за́втра · ZAF-tra"
  },
  {
   "id": "type",
   "kind": "typed",
   "title": "Keep the date.",
   "instruction": "Type “tomorrow” in Russian. The letter buttons are here if you need them.",
   "prompt": "завтра",
   "translation": "tomorrow",
   "letters": [
    "т",
    "а",
    "в",
    "р",
    "з"
   ],
   "answer": "завтра",
   "review": "завтра → tomorrow",
   "success": "Yes: завтра means “tomorrow”. A useful word for this story.",
   "retryFeedback": "Remember the next-day word from the invitation. Check each letter.",
   "hint": "Not today: the next day. It starts with a z sound."
  }
 ],
 "summary": "You invited a friend for a walk, accepted a plan, and said see you tomorrow.",
 "completionTip": "Use Давай… with a friend or peer; it is informal."
};
