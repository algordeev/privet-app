import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "daily-life",
 "number": "05",
 "title": "My day",
 "description": "Tell Anna about a quiet morning and a busy evening.",
 "icon": "☀",
 "motivationTags": [
  "Conversations"
 ],
 "skills": [
  "describe daily actions",
  "recognize times of day"
 ],
 "prerequisiteIds": [
  "shopping"
 ],
 "words": [
  {
   "id": "morning",
   "text": "утром",
   "stressed": "у́тром",
   "pronunciation": "U-tram",
   "meaning": "in the morning"
  },
  {
   "id": "evening",
   "text": "вечером",
   "stressed": "ве́чером",
   "pronunciation": "VE-che-ram",
   "meaning": "in the evening"
  },
  {
   "id": "drink",
   "text": "Я пью кофе.",
   "stressed": "Я пью ко́фе.",
   "pronunciation": "ya pyu KO-fe",
   "meaning": "I drink coffee."
  },
  {
   "id": "work",
   "text": "Я работаю.",
   "stressed": "Я рабо́таю.",
   "pronunciation": "ya ra-BO-ta-yu",
   "meaning": "I work."
  },
  {
   "id": "rest",
   "text": "Я отдыхаю.",
   "stressed": "Я отдыха́ю.",
   "pronunciation": "ya at-di-HA-yu",
   "meaning": "I relax."
  }
 ],
 "exercises": [
  {
   "id": "discover",
   "kind": "vocabulary",
   "title": "Morning to evening.",
   "instruction": "Tell Anna about a quiet morning and a busy evening. Explore these five expressions before you try them.",
   "prompt": "утром",
   "answer": "ready",
   "review": "My day expressions",
   "success": "You have the expressions for this visit. Let’s put them to use."
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Coffee before work.",
   "instruction": "Build “In the morning I drink coffee.”",
   "prompt": "Утром я пью кофе",
   "translation": "In the morning I drink coffee.",
   "tokens": [
    "кофе",
    "пью",
    "Утром",
    "я"
   ],
   "answer": "Утром я пью кофе",
   "review": "Утром я пью кофе → In the morning I drink coffee.",
   "success": "That works: Утром я пью кофе. In the morning I drink coffee.",
   "retryFeedback": "The words are right; try a different order for this message.",
   "hint": "Start with when, then who, then the action and drink.",
   "pronunciationGuide": "У́тром · U-tram / я · ya / пью · pyu / ко́фе · KO-fe"
  },
  {
   "id": "meaning",
   "kind": "choice",
   "wordId": "evening",
   "title": "When do you unwind?",
   "instruction": "Choose the meaning of вечером",
   "prompt": "вечером",
   "choices": [
    "in the morning",
    "in the evening",
    "tomorrow"
   ],
   "answer": "in the evening",
   "review": "вечером → in the evening",
   "success": "Yes—вечером means “in the evening”.",
   "retryFeedback": "Think of the part of the day after work and before bedtime.",
   "hint": "Look at the word in the first step and connect it to this situation."
  },
  {
   "id": "type",
   "kind": "typed",
   "title": "An early start.",
   "instruction": "Type “in the morning” in Russian. The letter buttons are here if you need them.",
   "prompt": "утром",
   "translation": "in the morning",
   "letters": [
    "р",
    "м",
    "у",
    "о",
    "т"
   ],
   "answer": "утром",
   "review": "утром → in the morning",
   "success": "Yes: утром means “in the morning”. A useful word for this story.",
   "retryFeedback": "Think about the morning word from the first step. Check its ending.",
   "hint": "Think of the time of day when your first coffee usually happens."
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "Anna asks about later.",
   "instruction": "Anna asks about your evening. Tell her you relax.",
   "prompt": "А вечером?",
   "exchange": {
    "speaker": "ANNA",
    "text": "А вечером?",
    "meaning": "And in the evening?"
   },
   "choices": [
    "Я отдыхаю.",
    "Спасибо!",
    "Где метро?"
   ],
   "answer": "Я отдыхаю.",
   "review": "А вечером? → Я отдыхаю.",
   "success": "Anna asks about your evening. Tell her you relax. Я отдыхаю.",
   "retryFeedback": "Anna asks about your evening activity, not your name or location.",
   "hint": "Choose a reply that fits the invitation or question, rather than starting a new topic."
  }
 ],
 "summary": "You described a morning coffee, work, and relaxing in the evening.",
 "completionTip": "Try Утром я… to describe one thing you do each morning."
};
