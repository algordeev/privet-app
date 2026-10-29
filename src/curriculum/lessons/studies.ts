import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "studies",
 "number": "07",
 "title": "Study and work",
 "description": "Meet a classmate and talk about where you study or work.",
 "icon": "▱",
 "motivationTags": [
  "Studies",
  "Conversations"
 ],
 "skills": [
  "say where you study",
  "ask about someone’s work"
 ],
 "prerequisiteIds": [
  "making-plans"
 ],
 "words": [
  {
   "id": "study",
   "text": "Я учусь.",
   "stressed": "Я учу́сь.",
   "pronunciation": "ya u-CHUS",
   "meaning": "I study."
  },
  {
   "id": "university",
   "text": "в университете",
   "stressed": "в университе́те",
   "pronunciation": "v u-ni-ver-si-TE-te",
   "meaning": "at university"
  },
  {
   "id": "work",
   "text": "Где ты работаешь?",
   "stressed": "Где ты рабо́таешь?",
   "pronunciation": "gde ti ra-BO-ta-yesh",
   "meaning": "Where do you work? (informal)"
  },
  {
   "id": "home",
   "text": "дома",
   "stressed": "до́ма",
   "pronunciation": "DO-ma",
   "meaning": "at home"
  },
  {
   "id": "you",
   "text": "А ты?",
   "stressed": "А ты?",
   "pronunciation": "a ti",
   "meaning": "And you? (informal)"
  }
 ],
 "exercises": [
  {
   "id": "discover",
   "kind": "vocabulary",
   "title": "A new classmate.",
   "instruction": "Meet a classmate and talk about where you study or work. Explore these five expressions before you try them.",
   "prompt": "Я учусь.",
   "answer": "ready",
   "review": "Study and work expressions",
   "success": "You have the expressions for this visit. Let’s put them to use."
  },
  {
   "id": "meaning",
   "kind": "choice",
   "wordId": "home",
   "title": "Where do you work?",
   "instruction": "Choose the meaning of дома",
   "prompt": "дома",
   "choices": [
    "at home",
    "at university",
    "in the morning"
   ],
   "answer": "at home",
   "review": "дома → at home",
   "success": "Yes—дома means “at home”.",
   "retryFeedback": "Think of the place where you live, rather than a school or a time of day.",
   "hint": "Look at the word in the first step and connect it to this situation."
  },
  {
   "id": "listen",
   "kind": "listen",
   "wordId": "work",
   "title": "A question for you.",
   "instruction": "Your classmate asks you something. Listen, then choose what you heard.",
   "prompt": "Где ты работаешь?",
   "choices": [
    "Где метро?",
    "Я работаю.",
    "Где ты работаешь?"
   ],
   "answer": "Где ты работаешь?",
   "review": "Где ты работаешь? → Where do you work? (informal)",
   "success": "Yes: Где ты работаешь? means “Where do you work? (informal)”",
   "retryFeedback": "Replay it: it is a question with ты.",
   "hint": "It starts with где, like Где метро?"
  },
  {
   "id": "match",
   "kind": "match",
   "title": "Study, work and you.",
   "instruction": "Match each Russian expression with its meaning.",
   "prompt": "Match the pairs",
   "pairs": [
    ["дома", "at home"],
    ["в университете", "at university"],
    ["Где ты работаешь?", "Where do you work?"],
    ["А ты?", "And you?"],
    ["Я учусь.", "I study."]
   ],
   "answer": "matched",
   "review": "дома → at home · в университете → at university · Где ты работаешь? → Where do you work? · А ты? → And you? · Я учусь. → I study.",
   "success": "All matched: you can talk about where you study and work.",
   "retryFeedback": "Check the pairs that didn't lock in.",
   "hint": "Two of these are questions to your classmate."
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Your university.",
   "instruction": "Build “I study at university.”",
   "prompt": "Я учусь в университете",
   "translation": "I study at university.",
   "tokens": [
    "университете",
    "Я",
    "в",
    "учусь"
   ],
   "answer": "Я учусь в университете",
   "review": "Я учусь в университете → I study at university.",
   "success": "That works: Я учусь в университете. I study at university.",
   "retryFeedback": "The words are right; try a different order for this message.",
   "hint": "Say who, then the action, then the two-word place phrase.",
   "pronunciationGuide": "Я · ya / учу́сь · u-CHUS / в университе́те · v u-ni-ver-si-TE-te"
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "Different days, a new connection.",
   "instruction": "Your classmate studies at university. You work. What do you say?",
   "prompt": "Я учусь в университете. А ты?",
   "exchange": {
    "speaker": "CLASSMATE",
    "text": "Я учусь в университете. А ты?",
    "meaning": "I study at university. And you?"
   },
   "choices": [
    "А я работаю.",
    "До завтра!",
    "Хлеб, пожалуйста."
   ],
   "answer": "А я работаю.",
   "review": "А я работаю. → And I work.",
   "success": "А я работаю. — “And I work.” Here, А introduces a contrast with your classmate.",
   "retryFeedback": "Your classmate asks about you. Choose the reply that describes what you do.",
   "hint": "Use the work expression from My day. The short word А introduces a contrast."
  },
  {
   "id": "answer",
   "kind": "sentence",
   "title": "Your turn to answer.",
   "instruction": "Your classmate asks: Где ты работаешь? Build “I work at home.”",
   "prompt": "Я работаю дома",
   "translation": "I work at home.",
   "tokens": [
    "дома",
    "Я",
    "работаю"
   ],
   "answer": "Я работаю дома",
   "alsoAccepted": [
    "Я дома работаю",
    "дома Я работаю"
   ],
   "review": "Я работаю дома → I work at home.",
   "success": "That works: Я работаю дома. You answered your classmate.",
   "retryFeedback": "Start with я, then say what you do and where.",
   "hint": "Я работаю, ты работаешь: the ending changes with the person.",
   "pronunciationGuide": "Я · ya / рабо́таю · ra-BO-ta-yu / до́ма · DO-ma"
  },
  {
   "id": "type",
   "kind": "typed",
   "title": "Working from home.",
   "instruction": "Type “at home” in Russian. The letter buttons are here if you need them.",
   "prompt": "дома",
   "translation": "at home",
   "letters": [
    "м",
    "а",
    "д",
    "о"
   ],
   "answer": "дома",
   "review": "дома → at home",
   "success": "Yes: дома means “at home”. A useful word for this story.",
   "retryFeedback": "This word tells where, not what you do. Try its four letters again.",
   "hint": "This short place word begins with a d sound."
  }
 ],
 "summary": "You said where you study, answered where you work, and asked a classmate about their day.",
 "completionTip": "Где ты работаешь? is informal; use it with a peer, not a stranger you address formally."
};
