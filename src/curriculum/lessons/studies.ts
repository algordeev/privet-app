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
   "pronunciation": "ya u-CHOOS",
   "meaning": "I study."
  },
  {
   "id": "university",
   "text": "в университете",
   "stressed": "в университе́те",
   "pronunciation": "v u-nee-ver-see-TYE-te",
   "meaning": "at university"
  },
  {
   "id": "work",
   "text": "Где ты работаешь?",
   "stressed": "Где ты рабо́таешь?",
   "pronunciation": "gdye ty ra-BO-ta-yesh",
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
   "pronunciation": "a ty",
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
   "pronunciationGuide": "Я · ya / учу́сь · u-CHOOS / в университе́те · v u-nee-ver-see-TYE-te"
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
  }
 ],
 "summary": "You said you study at university, recognized at home, and asked a peer where they work.",
 "completionTip": "Где ты работаешь? is informal; use it with a peer, not a stranger you address formally."
};
