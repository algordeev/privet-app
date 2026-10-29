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
   "id": "listen",
   "kind": "listen",
   "wordId": "work",
   "title": "What does Anna do?",
   "instruction": "Anna tells you what she does. Listen, then choose what you heard.",
   "prompt": "Я работаю.",
   "choices": [
    "Я отдыхаю.",
    "Я пью кофе.",
    "Я работаю."
   ],
   "answer": "Я работаю.",
   "review": "Я работаю. → I work.",
   "success": "Yes: Я работаю. means “I work.”",
   "retryFeedback": "Replay it: listen for the word after я.",
   "hint": "This one is about her job."
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
   "id": "match",
   "kind": "match",
   "title": "Your day, piece by piece.",
   "instruction": "Match each Russian expression with its meaning.",
   "prompt": "Match the pairs",
   "pairs": [
    ["утром", "in the morning"],
    ["Я пью кофе.", "I drink coffee."],
    ["вечером", "in the evening"],
    ["Я отдыхаю.", "I relax."],
    ["Я работаю.", "I work."]
   ],
   "answer": "matched",
   "review": "утром → in the morning · Я пью кофе. → I drink coffee. · вечером → in the evening · Я отдыхаю. → I relax. · Я работаю. → I work.",
   "success": "All matched: two times of day and three things you do.",
   "retryFeedback": "Check the pairs that didn't lock in.",
   "hint": "утром and вечером end the same way; listen to how they start."
  },
  {
   "id": "evening",
   "kind": "sentence",
   "title": "Same pattern, new time.",
   "instruction": "Build “In the evening I drink tea.”",
   "prompt": "Вечером я пью чай",
   "translation": "In the evening I drink tea.",
   "tokens": [
    "чай",
    "я",
    "Вечером",
    "пью"
   ],
   "answer": "Вечером я пью чай",
   "alsoAccepted": [
    "я Вечером пью чай",
    "я пью чай Вечером"
   ],
   "review": "Вечером я пью чай → In the evening I drink tea.",
   "success": "That works: Вечером я пью чай. The same pattern as your morning coffee.",
   "retryFeedback": "Start with the time, then say what you do.",
   "hint": "With я, these verbs end in -ю: пью, работаю, отдыхаю.",
   "pronunciationGuide": "Ве́чером · VE-che-ram / я · ya / пью · pyu / чай · chai"
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
  }
 ],
 "summary": "You described your morning coffee, your work, an evening tea, and a quiet evening rest.",
 "completionTip": "Try Утром я… to describe one thing you do each morning."
};
