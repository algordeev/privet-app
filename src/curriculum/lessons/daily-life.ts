import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "daily-life",
 "number": "05",
 "title": "My day",
 "description": "Recognize Anna's work statement, and describe your own morning coffee and a relaxing evening.",
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
   "pronunciation": "OO-tram",
   "meaning": "in the morning"
  },
  {
   "id": "evening",
   "text": "вечером",
   "stressed": "ве́чером",
   "pronunciation": "VYE-che-ram",
   "meaning": "in the evening"
  },
  {
   "id": "drink",
   "text": "Я пью кофе.",
   "stressed": "Я пью ко́фе.",
   "pronunciation": "ya pyoo KO-fyeh",
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
   "pronunciation": "ya at-dy-KHA-yu",
   "meaning": "I relax."
  }
 ],
 "exercises": [
  {
   "id": "discover",
   "kind": "vocabulary",
   "title": "Coffee first. Then the day.",
   "instruction": "Anna is asking about your routine. Explore two times of day and three everyday actions.",
   "prompt": "утром",
   "answer": "ready",
   "review": "Morning and evening routines",
   "success": "You can talk about morning, work, and a calmer evening. Anna has a question."
  },
  {
   "id": "meaning",
   "kind": "choice",
   "title": "Anna’s working day.",
   "instruction": "Anna says Я работаю. What is she describing?",
   "prompt": "Я работаю.",
   "choices": [
    "Working.",
    "Having coffee.",
    "Relaxing."
   ],
   "answer": "Working.",
   "review": "Я работаю. → I work.",
   "success": "You recognized Anna’s work statement. The same expression can describe your day.",
   "retryFeedback": "Separate the action from a drink or a rest.",
   "hint": "This is the activity many people do as their job.",
   "wordId": "work"
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Your morning coffee.",
   "instruction": "Tell Anna your morning habit. Use the model that starts with Утром.",
   "prompt": "Утром я пью кофе.",
   "translation": "In the morning I drink coffee.",
   "answer": "Утром я пью кофе.",
   "tokens": [
    "кофе.",
    "пью",
    "Утром",
    "я"
   ],
   "review": "Утром я пью кофе. → In the morning I drink coffee.",
   "success": "Anna knows how your morning starts. Coffee before the busy part of the day.",
   "retryFeedback": "Other word orders can work in Russian; this model starts with the time of day.",
   "hint": "Start with when, then who, then the action and the drink.",
   "pronunciationGuide": "У́тром · OO-tram / я · ya / пью · pyoo / ко́фе · KO-fyeh"
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "And after work?",
   "instruction": "Your evenings are for relaxing. Answer Anna about that part of your day.",
   "prompt": "А вечером?",
   "choices": [
    "Я работаю.",
    "Я отдыхаю.",
    "Я пью кофе."
   ],
   "answer": "Я отдыхаю.",
   "review": "А вечером? — Я отдыхаю. → And in the evening? — I relax.",
   "success": "Anna understands that your evening is time to unwind.",
   "retryFeedback": "All three are activities, but you want the one for taking a rest.",
   "hint": "Look for the expression about relaxing rather than working or drinking.",
   "exchange": {
    "speaker": "ANNA",
    "text": "А вечером?",
    "meaning": "And in the evening?"
   }
  },
  {
   "id": "evening",
   "kind": "sentence",
   "title": "Put the evening into words.",
   "instruction": "Make a full evening statement. Start with Вечером.",
   "prompt": "Вечером я отдыхаю.",
   "translation": "In the evening I relax.",
   "answer": "Вечером я отдыхаю.",
   "tokens": [
    "отдыхаю.",
    "Вечером",
    "я"
   ],
   "review": "Вечером я отдыхаю. → In the evening I relax.",
   "success": "You’ve described two parts of your day, from a morning coffee to an evening rest.",
   "retryFeedback": "For this model, the time comes first, then the person and the activity.",
   "hint": "Reuse the evening time word and the relaxing expression you just chose.",
   "pronunciationGuide": "Ве́чером · VYE-che-ram / я · ya / отдыха́ю · at-dy-KHA-yu"
  }
 ],
 "summary": "You recognized a work statement and described morning coffee and evening relaxation.",
 "completionTip": "Try Утром я… for a morning habit and Вечером я… for an evening one.",
 "contentRevision": 2
};
