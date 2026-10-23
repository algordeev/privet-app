import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "shopping",
 "number": "04",
 "title": "At the shop",
 "description": "Ask for bread, confirm your choice, and enquire about its price.",
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
   "title": "A stop for bread.",
   "instruction": "You’re at a small shop counter. Explore bread and the price question, with familiar words for being polite.",
   "prompt": "хлеб",
   "answer": "ready",
   "review": "Bread, a price question, and polite counter expressions",
   "success": "You can name the bread and ask its cost. Let’s try the counter conversation."
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Start with the item.",
   "instruction": "Ask for bread politely. Put the item first and the polite word second.",
   "prompt": "Хлеб, пожалуйста.",
   "translation": "Bread, please.",
   "answer": "Хлеб, пожалуйста.",
   "tokens": [
    "пожалуйста.",
    "Хлеб,"
   ],
   "review": "Хлеб, пожалуйста. → Bread, please.",
   "success": "You made a polite request without needing a long sentence.",
   "retryFeedback": "For this short request, name the item first. The comma stays with that word.",
   "hint": "You already know the polite word from the café. Place it after the item.",
   "pronunciationGuide": "Хлеб · khlyep / пожа́луйста · pa-ZHA-lu-sta"
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "The assistant checks your choice.",
   "instruction": "The assistant points to a loaf. Confirm that this is what you want.",
   "prompt": "Хлеб?",
   "choices": [
    "Да, спасибо.",
    "Сколько стоит?",
    "Вот, пожалуйста."
   ],
   "answer": "Да, спасибо.",
   "review": "Confirming the bread: Да, спасибо.",
   "success": "The assistant knows they have the right item. Your reply is polite, too.",
   "retryFeedback": "First confirm the choice; asking the cost is a different step.",
   "hint": "Begin with the short Russian word for “yes”, then add thanks.",
   "exchange": {
    "speaker": "SHOP ASSISTANT",
    "text": "Хлеб?",
    "meaning": "Bread?"
   }
  },
  {
   "id": "meaning",
   "kind": "choice",
   "title": "One question before you buy.",
   "instruction": "You’re pointing at the bread. Which question asks its price?",
   "prompt": "хлеб",
   "choices": [
    "Сколько стоит?",
    "Где метро?",
    "Как тебя зовут?"
   ],
   "answer": "Сколько стоит?",
   "review": "Сколько стоит? → How much does it cost?",
   "success": "You asked about the cost of the bread. Understanding a number is a skill for another lesson.",
   "retryFeedback": "Think about cost, rather than a location or a person’s name.",
   "hint": "Choose the question about “how much”, not “where” or “what is your name”."
  },
  {
   "id": "type",
   "kind": "typed",
   "title": "Remember what you came for.",
   "instruction": "Write the short Russian word. Use the letter buttons or your keyboard.",
   "translation": "bread",
   "prompt": "хлеб",
   "answer": "хлеб",
   "letters": [
    "е",
    "б",
    "х",
    "л"
   ],
   "review": "хлеб → bread",
   "success": "You can now recognize and write the item you asked for.",
   "retryFeedback": "Check the four letters, especially the first: it is the breathy kh sound.",
   "hint": "This word begins with х and ends with б."
  }
 ],
 "summary": "You requested bread politely, confirmed the item, and asked how much it costs.",
 "completionTip": "At a counter, Хлеб, пожалуйста. makes a polite short request. Pointing at an item gives Сколько стоит? its context.",
 "contentRevision": 2
};
