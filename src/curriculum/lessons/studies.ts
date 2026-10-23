import type {LessonDefinition} from '../types.ts';
export const lesson:LessonDefinition={
 "id": "studies",
 "number": "07",
 "title": "Study and work",
 "description": "Meet Anna’s classmate, ask about study and work, and say where you work.",
 "icon": "▱",
 "motivationTags": [
  "Studies",
  "Conversations"
 ],
 "skills": [
  "ask where a peer studies",
  "ask where a peer works",
  "say where you work"
 ],
 "prerequisiteIds": [
  "making-plans"
 ],
 "words": [
  {
   "id": "study",
   "text": "Я учусь в университете.",
   "stressed": "Я учу́сь в университе́те.",
   "pronunciation": "ya u-CHOOS v u-nee-ver-see-TYE-te",
   "meaning": "I study at university."
  },
  {
   "id": "university",
   "text": "Где ты учишься?",
   "stressed": "Где ты у́чишься?",
   "pronunciation": "gdye ty OO-cheesh-sya",
   "meaning": "Where do you study? (informal)"
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
   "text": "Я работаю дома.",
   "stressed": "Я рабо́таю до́ма.",
   "pronunciation": "ya ra-BO-ta-yu DO-ma",
   "meaning": "I work at home."
  },
  {
   "id": "you",
   "text": "А я работаю.",
   "stressed": "А я рабо́таю.",
   "pronunciation": "a ya ra-BO-ta-yu",
   "meaning": "And I work."
  }
 ],
 "exercises": [
  {
   "id": "discover",
   "kind": "vocabulary",
   "title": "Anna introduces Alex.",
   "instruction": "You’re visiting Anna on campus and meeting her classmate Alex. You work at home. Explore phrases for exchanging that information.",
   "prompt": "Я учусь в университете.",
   "answer": "ready",
   "review": "Study questions, work questions, and working at home",
   "success": "You can ask about Alex’s studies and work, and explain your own working day."
  },
  {
   "id": "exchange",
   "kind": "choice",
   "title": "Different days, a new connection.",
   "instruction": "Alex is a student. You work. Give a short contrasting reply about yourself.",
   "prompt": "Я учусь в университете. А ты?",
   "choices": [
    "А я работаю.",
    "До завтра!",
    "Где ты работаешь?"
   ],
   "answer": "А я работаю.",
   "review": "А я работаю. → And I work.",
   "success": "You told Alex what you do. А makes a natural contrast with being a student.",
   "retryFeedback": "Alex has asked about you. Answer before asking another question.",
   "hint": "Reuse the work statement from My day, with the short contrast word at the start.",
   "exchange": {
    "speaker": "ALEX",
    "text": "Я учусь в университете. А ты?",
    "meaning": "I study at university. And you?"
   }
  },
  {
   "id": "sentence",
   "kind": "sentence",
   "title": "Ask about studies.",
   "instruction": "Practise a question for a peer. Put “where” first, then “you”, then the study verb.",
   "prompt": "Где ты учишься?",
   "translation": "Where do you study?",
   "answer": "Где ты учишься?",
   "tokens": [
    "учишься?",
    "Где",
    "ты"
   ],
   "review": "Где ты учишься? → Where do you study?",
   "success": "You can ask a peer where they study, not just introduce yourself.",
   "retryFeedback": "Use the requested question model: place, person, then activity.",
   "hint": "Start with the same “where” word you used to ask about the metro.",
   "pronunciationGuide": "Где · gdye / ты · ty / у́чишься · OO-cheesh-sya"
  },
  {
   "id": "meaning",
   "kind": "sentence",
   "title": "A similar question about work.",
   "instruction": "Now ask where someone works, using the same three-part model.",
   "prompt": "Где ты работаешь?",
   "translation": "Where do you work?",
   "answer": "Где ты работаешь?",
   "tokens": [
    "ты",
    "работаешь?",
    "Где"
   ],
   "review": "Где ты работаешь? → Where do you work?",
   "success": "You changed the activity while keeping a useful question pattern.",
   "retryFeedback": "Keep the question word first. This time, choose the order for asking about work.",
   "hint": "The “where” and “you” words stay in place; the last word is about work.",
   "pronunciationGuide": "Где · gdye / ты · ty / рабо́таешь · ra-BO-ta-yesh"
  },
  {
   "id": "work-place",
   "kind": "choice",
   "title": "Your turn to answer.",
   "instruction": "Alex asks where you work. Tell him you work at home.",
   "prompt": "Где ты работаешь?",
   "choices": [
    "А я работаю.",
    "Я учусь в университете.",
    "Я работаю дома."
   ],
   "answer": "Я работаю дома.",
   "review": "Я работаю дома. → I work at home.",
   "success": "Alex now knows both what you do and where. You’ve asked questions and answered one, too.",
   "retryFeedback": "The question asks where. Choose a work reply that includes a place.",
   "hint": "Look for the work statement with the home word from the discovery step.",
   "exchange": {
    "speaker": "ALEX",
    "text": "Где ты работаешь?",
    "meaning": "Where do you work?"
   }
  }
 ],
 "summary": "You contrasted work with studying, built questions about study and work, and said you work at home.",
 "completionTip": "With a peer, try Где ты учишься? or Где ты работаешь? These use informal ты.",
 "contentRevision": 2
};
