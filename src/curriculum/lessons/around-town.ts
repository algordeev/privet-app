import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "around-town",
 "number": "03",
 "title": "Around town",
 "description": "Ask a local about the metro, follow a direction, and thank them.",
 "icon": "⌖",
 "motivationTags": [
  "Travel"
 ],
 "skills": [
  "ask where",
  "understand direction"
 ],
 "prerequisiteIds": [
  "introductions"
 ],
 "words": [
  {
   "id": "where",
   "text": "Где метро?",
   "stressed": "Где метро́?",
   "pronunciation": "gdye meet-RO",
   "meaning": "Where is the metro?"
  },
  {
   "id": "right",
   "text": "Направо.",
   "stressed": "Напра́во.",
   "pronunciation": "na-PRA-va",
   "meaning": "To the right."
  },
  {
   "id": "left",
   "text": "Налево.",
   "stressed": "Нале́во.",
   "pronunciation": "na-LYE-va",
   "meaning": "To the left."
  },
  {
   "id": "straight",
   "text": "Прямо.",
   "stressed": "Пря́мо.",
   "pronunciation": "PRYA-ma",
   "meaning": "Straight ahead."
  },
  {
   "id": "thanks",
   "text": "Спасибо!",
   "stressed": "Спаси́бо!",
   "pronunciation": "spa-SEE-ba",
   "meaning": "Thank you!"
  }
 ],
 "exercises": [
  {
   "id": "discover",
   "kind": "vocabulary",
   "title": "One question at a street corner.",
   "instruction": "You need the metro. A local can help with a short answer. Explore the question and three directions; Спасибо is a familiar thank-you.",
   "prompt": "Где метро?",
   "answer": "ready",
   "review": "Asking about the metro and recognizing directions",
   "success": "You have a question to ask and directions to listen for. Time to find your way."
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Ask before you turn.",
   "instruction": "Ask the local where the metro is. Start with the question word.",
   "prompt": "Где метро?",
   "translation": "Where is the metro?",
   "answer": "Где метро?",
   "tokens": [
    "метро?",
    "Где"
   ],
   "review": "Где метро? → Where is the metro?",
   "success": "You’ve asked for the place you need. A short question is enough here.",
   "retryFeedback": "For this model, put the question word first and the place second.",
   "hint": "Begin with the word meaning “where”, then name the place.",
   "pronunciationGuide": "Где · gdye / метро́ · meet-RO"
  },
  {
   "id": "meaning",
   "kind": "choice",
   "title": "The local points right.",
   "instruction": "The local answers Направо. What should you do?",
   "prompt": "Направо.",
   "choices": [
    "Turn left.",
    "Turn right.",
    "Keep going straight."
   ],
   "answer": "Turn right.",
   "review": "Направо. → To the right.",
   "success": "You understood the turn the local meant. Налево would send you left instead.",
   "retryFeedback": "Keep the three directions separate: a turn right, a turn left, or no turn.",
   "hint": "This is a turn, not straight ahead. Its beginning is на-пра…",
   "wordId": "right"
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "A little thanks, then off you go.",
   "instruction": "The local has answered your question. Thank them before you leave.",
   "prompt": "Направо.",
   "choices": [
    "Спасибо!",
    "А тебя?",
    "Сколько стоит?"
   ],
   "answer": "Спасибо!",
   "review": "Thanking someone for directions: Спасибо!",
   "success": "You acknowledged the help. Now you can head towards the metro.",
   "retryFeedback": "You already have the direction; you don’t need a name or a price.",
   "hint": "Think of the expression you used when the barista handed over your drink.",
   "exchange": {
    "speaker": "LOCAL",
    "text": "Направо.",
    "meaning": "To the right."
   }
  },
  {
   "id": "type",
   "kind": "typed",
   "title": "Another useful direction.",
   "instruction": "Write the short Russian word. Use the letter buttons or your keyboard.",
   "translation": "straight ahead",
   "prompt": "прямо",
   "answer": "прямо",
   "letters": [
    "м",
    "о",
    "п",
    "я",
    "р"
   ],
   "review": "Прямо. → Straight ahead.",
   "success": "You remembered the direction for continuing without a turn.",
   "retryFeedback": "Check the five letters. The direction starts with a p sound.",
   "hint": "This direction means no left or right turn. Its first two letters are пр."
  }
 ],
 "summary": "You asked where the metro is, interpreted a right turn, thanked a local, and recalled straight ahead.",
 "completionTip": "Try Где метро? when you need the metro. The short question is ordinary conversational Russian.",
 "contentRevision": 2
};
