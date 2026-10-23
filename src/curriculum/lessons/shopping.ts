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
  "buy politely"
 ],
 "prerequisiteIds": [
  "around-town"
 ],
 "words": [
  {
   "id": "price",
   "text": "Сколько стоит?",
   "stressed": "Ско́лько сто́ит?",
   "pronunciation": "SKOL-ka STO-eet",
   "meaning": "How much does it cost?"
  },
  {
   "id": "bread",
   "text": "хлеб",
   "stressed": "хлеб",
   "pronunciation": "khlyep",
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
   "id": "sentence",
   "kind": "sentence",
   "title": "A small, polite order.",
   "instruction": "Build “Bread, please.”",
   "prompt": "Хлеб пожалуйста",
   "translation": "Bread, please.",
   "tokens": [
    "пожалуйста",
    "Хлеб"
   ],
   "answer": "Хлеб пожалуйста",
   "review": "Хлеб пожалуйста → Bread, please.",
   "success": "That works: Хлеб пожалуйста. Bread, please.",
   "retryFeedback": "The words are right; try a different order for this message.",
   "hint": "Name what you want, then add the polite word.",
   "pronunciationGuide": "Хлеб · khlyep / пожа́луйста · pa-ZHA-lu-sta"
  }
 ],
 "summary": "You asked a price, requested bread, and confirmed your purchase politely.",
 "completionTip": "At a counter, name an item and add пожалуйста."
};
