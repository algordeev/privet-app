import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "shopping",
 "number": "04",
 "title": "At the shop",
 "description": "Buy bread at a small neighbourhood shop.",
 "icon": "▤",
 "motivationTags": [
  "Travel"
 ],
 "skills": [
  "ask a price",
  "buy politely",
  "pay"
 ],
 "prerequisiteIds": [
  "around-town"
 ],
 "words": [
  {
   "id": "price",
   "text": "Сколько стоит?",
   "stressed": "Ско́лько сто́ит?",
   "pronunciation": "SKOL-ka STO-it",
   "meaning": "How much does it cost?"
  },
  {
   "id": "bread",
   "text": "хлеб",
   "stressed": "хлеб",
   "pronunciation": "hlep",
   "meaning": "bread"
  },
  {
   "id": "please",
   "text": "пожалуйста",
   "stressed": "пожа́луйста",
   "pronunciation": "pa-ZHA-lu-sta",
   "meaning": "please"
  },
  {
   "id": "here",
   "text": "Вот, пожалуйста.",
   "stressed": "Вот, пожа́луйста.",
   "pronunciation": "vot pa-ZHA-lu-sta",
   "meaning": "Here you are."
  },
  {
   "id": "yes",
   "text": "Да, спасибо.",
   "stressed": "Да, спаси́бо.",
   "pronunciation": "da spa-SEE-ba",
   "meaning": "Yes, thank you."
  }
 ],
 "exercises": [
  {
   "id": "discover",
   "kind": "vocabulary",
   "title": "A loaf for lunch.",
   "instruction": "Buy bread at a small neighbourhood shop. Explore these five expressions before you try them.",
   "prompt": "Сколько стоит?",
   "answer": "ready",
   "review": "At the shop expressions",
   "success": "You have the expressions for this visit. Let’s put them to use."
  },
  {
   "id": "meaning",
   "kind": "choice",
   "wordId": "price",
   "title": "Ask before you buy.",
   "instruction": "Choose the meaning of Сколько стоит?",
   "prompt": "Сколько стоит?",
   "choices": [
    "Where is it?",
    "How much does it cost?",
    "What is your name?"
   ],
   "answer": "How much does it cost?",
   "review": "Сколько стоит? → How much does it cost?",
   "success": "Yes—Сколько стоит? means “How much does it cost?”.",
   "retryFeedback": "This expression asks about money, not a location or a name.",
   "hint": "Look at the word in the first step and connect it to this situation."
  },
  {
   "id": "match",
   "kind": "match",
   "title": "Words for the counter.",
   "instruction": "Match each Russian expression with its meaning.",
   "prompt": "Match the pairs",
   "pairs": [
    ["Да, спасибо.", "Yes, thank you."],
    ["Сколько стоит?", "How much does it cost?"],
    ["пожалуйста", "please"],
    ["хлеб", "bread"],
    ["Вот, пожалуйста.", "Here you are."]
   ],
   "answer": "matched",
   "review": "Да, спасибо. → Yes, thank you. · Сколько стоит? → How much does it cost? · пожалуйста → please · хлеб → bread · Вот, пожалуйста. → Here you are.",
   "success": "All matched: you can ask, order, confirm and pay.",
   "retryFeedback": "Check the pairs that didn't lock in.",
   "hint": "Two of these contain пожалуйста. Which one hands something over?"
  },
  {
   "id": "listen",
   "kind": "listen",
   "wordId": "here",
   "title": "At the counter.",
   "instruction": "The assistant hands you the bread. Listen, then choose what you heard.",
   "prompt": "Вот, пожалуйста.",
   "choices": [
    "Сколько стоит?",
    "Вот, пожалуйста.",
    "Да, спасибо."
   ],
   "answer": "Вот, пожалуйста.",
   "review": "Вот, пожалуйста. → Here you are.",
   "success": "Yes: Вот, пожалуйста. means “Here you are.”",
   "retryFeedback": "Replay it: the assistant is handing something over, not asking.",
   "hint": "Listen for the short first word: вот."
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "A small, polite order.",
   "instruction": "Build “Bread, please.”",
   "prompt": "Хлеб, пожалуйста",
   "translation": "Bread, please.",
   "tokens": [
    "пожалуйста",
    "Хлеб,"
   ],
   "answer": "Хлеб, пожалуйста",
   "review": "Хлеб, пожалуйста → Bread, please.",
   "success": "That works: Хлеб, пожалуйста. Bread, please.",
   "retryFeedback": "The words are right; try a different order for this message.",
   "hint": "Name what you want, then add the polite word.",
   "pronunciationGuide": "Хлеб · hlep / пожа́луйста · pa-ZHA-lu-sta"
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "The assistant checks.",
   "instruction": "The assistant checks your choice. Confirm politely.",
   "prompt": "Хлеб?",
   "exchange": {
    "speaker": "SHOP ASSISTANT",
    "text": "Хлеб?",
    "meaning": "Bread?"
   },
   "choices": [
    "Да, спасибо.",
    "Где метро?",
    "Пока!"
   ],
   "answer": "Да, спасибо.",
   "review": "Хлеб? → Да, спасибо.",
   "success": "The assistant checks your choice. Confirm politely. Да, спасибо.",
   "retryFeedback": "The assistant wants to know whether bread is what you want.",
   "hint": "Choose a reply that fits the invitation or question, rather than starting a new topic."
  },
  {
   "id": "pay",
   "kind": "choice",
   "title": "Time to pay.",
   "instruction": "You hand the money to the assistant. What do you say?",
   "prompt": "Вот, пожалуйста.",
   "choices": [
    "Сколько стоит?",
    "Пока!",
    "Вот, пожалуйста."
   ],
   "answer": "Вот, пожалуйста.",
   "review": "Handing over money: Вот, пожалуйста. → Here you are.",
   "success": "Yes: Вот, пожалуйста. works both ways, for the assistant and for you.",
   "retryFeedback": "You are giving something, not asking a question or leaving.",
   "hint": "It is the same phrase the assistant used when handing you the bread."
  },
  {
   "id": "type",
   "kind": "typed",
   "title": "Bread on the list.",
   "instruction": "Type “bread” in Russian. The letter buttons are here if you need them.",
   "prompt": "хлеб",
   "translation": "bread",
   "letters": [
    "е",
    "б",
    "х",
    "л"
   ],
   "answer": "хлеб",
   "review": "хлеб → bread",
   "success": "Yes: хлеб means “bread”. A useful word for this story.",
   "retryFeedback": "This is the short word for bread. Check the breathy first letter.",
   "hint": "Four letters: the first sound is the breathy kh."
  }
 ],
 "summary": "You asked a price, ordered bread, and paid politely with Вот, пожалуйста.",
 "completionTip": "At a counter, name an item and add пожалуйста."
};
