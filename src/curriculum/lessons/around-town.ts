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
  "get attention politely",
  "ask where",
  "understand direction"
 ],
 "prerequisiteIds": [
  "introductions"
 ],
 "words": [
  {
   "id": "excuse",
   "text": "Извините!",
   "stressed": "Извини́те!",
   "pronunciation": "iz-vi-NEE-te",
   "meaning": "Excuse me!"
  },
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
   "instruction": "Find the metro with help from a passer-by. Explore these six expressions before you try them.",
   "prompt": "Извините!",
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
   "id": "match",
   "kind": "match",
   "title": "Every direction.",
   "instruction": "Match each Russian expression with its meaning.",
   "prompt": "Match the pairs",
   "pairs": [
    ["Где метро?", "Where is the metro?"],
    ["Направо.", "To the right."],
    ["Прямо.", "Straight ahead."],
    ["Налево.", "To the left."]
   ],
   "answer": "matched",
   "review": "Где метро? → Where is the metro? · Направо. → To the right. · Прямо. → Straight ahead. · Налево. → To the left.",
   "success": "All matched: your question and all three directions.",
   "retryFeedback": "Check the pairs that didn't lock in.",
   "hint": "Направо and Налево differ in the middle: -пра- or -ле-."
  },
  {
   "id": "polite",
   "kind": "choice",
   "title": "Stop a stranger politely.",
   "instruction": "You need directions from someone you don’t know. How do you start?",
   "prompt": "Извините!",
   "choices": [
    "Привет!",
    "Извините!",
    "Пока!"
   ],
   "answer": "Извините!",
   "review": "To a stranger: Извините! → Excuse me!",
   "success": "Yes: Извините! politely gets a stranger’s attention.",
   "retryFeedback": "Привет! and Пока! are friendly words for people you know. A stranger needs a polite opener.",
   "hint": "Choose the polite way to get someone’s attention."
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Ask for the metro.",
   "instruction": "Build “Excuse me, where is the metro?”",
   "prompt": "Извините, где метро",
   "translation": "Excuse me, where is the metro?",
   "tokens": [
    "где",
    "Извините,",
    "метро"
   ],
   "answer": "Извините, где метро",
   "review": "Извините, где метро → Excuse me, where is the metro?",
   "success": "That works: Извините, где метро? Polite and clear.",
   "retryFeedback": "The words are right; try a different order for this message.",
   "hint": "Get their attention first, then ask where.",
   "pronunciationGuide": "Извини́те · iz-vi-NEE-te / где · gde / метро́ · mi-TRO"
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
 "summary": "You stopped a stranger politely, asked where the metro is, understood three directions, and said thank you.",
 "completionTip": "Try Где…? with a place you need to find."
};
