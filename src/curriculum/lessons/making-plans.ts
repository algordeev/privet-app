import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "making-plans",
 "number": "06",
 "title": "Making plans",
 "description": "Arrange a walk tomorrow with Alex and close the chat.",
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
   "text": "Давай погуляем!",
   "stressed": "Дава́й погуля́ем!",
   "pronunciation": "da-VAI pa-gu-LYA-yem",
   "meaning": "Let’s go for a walk! (informal)"
  },
  {
   "id": "agree",
   "text": "Давай!",
   "stressed": "Дава́й!",
   "pronunciation": "da-VAI",
   "meaning": "Sure! / Let’s! (informal)"
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
   "title": "A message from Alex.",
   "instruction": "You and Alex are choosing something to do together. Explore a walk invitation, two days, and a friendly closing.",
   "prompt": "Давай погуляем!",
   "answer": "ready",
   "review": "An informal walk invitation and tomorrow’s plan",
   "success": "You have the pieces for a plan and a way to end the chat until tomorrow."
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "Say yes to a walk.",
   "instruction": "You like Alex’s idea. Accept the invitation without changing the day or ending the chat yet.",
   "prompt": "Давай завтра погуляем!",
   "choices": [
    "А сегодня?",
    "Давай!",
    "До завтра!"
   ],
   "answer": "Давай!",
   "review": "Accepting an informal invitation: Давай!",
   "success": "Alex knows you’re happy with the idea. That short reply is enough between friends.",
   "retryFeedback": "One reply asks about today, and another closes the conversation. You want to accept first.",
   "hint": "Choose the short acceptance, without an extra day or a goodbye.",
   "exchange": {
    "speaker": "ALEX",
    "text": "Давай завтра погуляем!",
    "meaning": "Let’s go for a walk tomorrow!"
   }
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Suggest tomorrow’s walk.",
   "instruction": "Make the invitation yourself. Use the order: Давай, then the day, then the activity.",
   "prompt": "Давай завтра погуляем!",
   "translation": "Let’s go for a walk tomorrow!",
   "answer": "Давай завтра погуляем!",
   "tokens": [
    "погуляем!",
    "Давай",
    "завтра"
   ],
   "review": "Давай завтра погуляем! → Let’s go for a walk tomorrow!",
   "success": "You’ve suggested both the walk and the day. No grammar terms needed to use the phrase.",
   "retryFeedback": "For this model, place the day between the invitation word and the activity.",
   "hint": "The middle word is the day after today.",
   "pronunciationGuide": "Дава́й · da-VAI / за́втра · ZAF-tra / погуля́ем · pa-gu-LYA-yem"
  },
  {
   "id": "type",
   "kind": "typed",
   "title": "Keep the day in mind.",
   "instruction": "Write the short Russian word. Use the letter buttons or your keyboard.",
   "translation": "tomorrow",
   "prompt": "завтра",
   "answer": "завтра",
   "letters": [
    "т",
    "а",
    "в",
    "р",
    "з"
   ],
   "review": "завтра → tomorrow",
   "success": "You remembered the day of your walk with Alex.",
   "retryFeedback": "Check the six letters. The word for tomorrow starts with з.",
   "hint": "Not today: the next day. The first sound is z."
  },
  {
   "id": "closing",
   "kind": "choice",
   "title": "Until tomorrow, then.",
   "instruction": "The walk is agreed for tomorrow. Close the chat until then.",
   "prompt": "Давай!",
   "choices": [
    "До завтра!",
    "А сегодня?",
    "Давай!"
   ],
   "answer": "До завтра!",
   "review": "До завтра! → See you tomorrow!",
   "success": "You finished the arrangement with a goodbye that matches your plan.",
   "retryFeedback": "You’ve already accepted. Now choose a closing, rather than accepting again or changing the day.",
   "hint": "Look for the expression meaning you’ll see Alex on the agreed day.",
   "exchange": {
    "speaker": "ALEX",
    "text": "Давай!",
    "meaning": "Sounds good!"
   }
  }
 ],
 "summary": "You accepted an invitation, suggested a walk tomorrow, recalled the day, and said see you tomorrow.",
 "completionTip": "Давай завтра погуляем! is a useful invitation to one friend. Learn it as a whole phrase; Давай is informal.",
 "contentRevision": 2
};
