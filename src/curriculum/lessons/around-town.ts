import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "around-town",
 "number": "03",
 "title": "Around town",
 "description": "Find the metro with help from a passer-by.",
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
   "pronunciation": "gde mi-TRO",
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
   "pronunciation": "na-LE-va",
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
   "title": "A station around the corner.",
   "instruction": "Find the metro with help from a passer-by. Explore these five expressions before you try them.",
   "prompt": "Где метро?",
   "answer": "ready",
   "review": "Around town expressions",
   "success": "You have the expressions for this visit. Let’s put them to use."
  },
  {
   "id": "meaning",
   "kind": "choice",
   "wordId": "right",
   "title": "Right or left?",
   "instruction": "Choose the meaning of Направо.",
   "prompt": "Направо.",
   "choices": [
    "To the left.",
    "To the right.",
    "Straight ahead."
   ],
   "answer": "To the right.",
   "review": "Направо. → To the right.",
   "success": "Yes—Направо. means “To the right.”.",
   "retryFeedback": "Picture the turn: one direction goes right and the other goes left.",
   "hint": "Look at the word in the first step and connect it to this situation."
  },
  {
   "id": "listen",
   "kind": "listen",
   "wordId": "left",
   "title": "Which way did they say?",
   "instruction": "Listen, then choose the direction you heard.",
   "prompt": "Налево.",
   "choices": [
    "Направо.",
    "Налево.",
    "Прямо."
   ],
   "answer": "Налево.",
   "review": "Налево. → To the left.",
   "success": "Yes: Налево. means “To the left.”",
   "retryFeedback": "Replay it and listen for the stressed syllable.",
   "hint": "Listen for the middle of the word: -пра- or -ле-?"
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Ask for the metro.",
   "instruction": "Build “Where is the metro?”",
   "prompt": "Где метро",
   "translation": "Where is the metro?",
   "tokens": [
    "метро",
    "Где"
   ],
   "answer": "Где метро",
   "review": "Где метро → Where is the metro?",
   "success": "That works: Где метро. Where is the metro?",
   "retryFeedback": "The words are right; try a different order for this message.",
   "hint": "Ask where first, then name the place.",
   "pronunciationGuide": "Где · gde / метро́ · mi-TRO"
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "A helpful passer-by.",
   "instruction": "Your directions are clear—thank the person who helped.",
   "prompt": "Метро? Прямо.",
   "exchange": {
    "speaker": "PASSER-BY",
    "text": "Метро? Прямо.",
    "meaning": "The metro? Straight ahead."
   },
   "choices": [
    "Спасибо!",
    "Пока!",
    "Меня зовут Анна."
   ],
   "answer": "Спасибо!",
   "review": "Метро? Прямо. → Спасибо!",
   "success": "Your directions are clear—thank the person who helped. Спасибо!",
   "retryFeedback": "A thank-you fits after someone gives you directions.",
   "hint": "Choose a reply that fits the invitation or question, rather than starting a new topic."
  },
  {
   "id": "type",
   "kind": "typed",
   "title": "Keep going straight.",
   "instruction": "Type “Straight ahead!” in Russian. The letter buttons are here if you need them.",
   "prompt": "прямо",
   "translation": "Straight ahead!",
   "letters": [
    "м",
    "о",
    "п",
    "я",
    "р"
   ],
   "answer": "прямо",
   "review": "прямо → Straight ahead!",
   "success": "Yes: прямо means “Straight ahead!”. A useful word for this story.",
   "retryFeedback": "The direction is one word. Listen again or check its letters.",
   "hint": "Remember the direction that takes you ahead, without turning."
  }
 ],
 "summary": "You asked where the metro is, recognized three directions, and thanked a passer-by.",
 "completionTip": "Try Где…? with a place you need to find."
};
