// Frozen revision-1 differences only. Required to resume positional saved attempts
// without changing their questions, accepted answers, inputs, or review results.
const discoverySuccess="You have the expressions for this visit. Let’s put them to use.";
const meaningHint="Look at the word in the first step and connect it to this situation.";
const sentenceRetry="The words are right; try a different order for this message.";
const dialogueHint="Choose a reply that fits the invitation or question, rather than starting a new topic.";
export const legacyPatches={
 "around-town": {
  "description": "Find the metro with help from a passer-by.",
  "summary": "You asked where the metro is, recognized three directions, and thanked a passer-by.",
  "completionTip": "Try Где…? with a place you need to find.",
  "exercises": {
   "order": [
    "discover",
    "meaning",
    "sentence",
    "exchange",
    "type"
   ],
   "entries": {
    "discover": {
     "set": {
      "title": "A station around the corner.",
      "instruction": "Find the metro with help from a passer-by. Explore these five expressions before you try them.",
      "review": "Around town expressions",
      "success": discoverySuccess
     }
    },
    "meaning": {
     "set": {
      "title": "Right or left?",
      "instruction": "Choose the meaning of Направо.",
      "choices": [
       "To the left.",
       "To the right.",
       "Straight ahead."
      ],
      "answer": "To the right.",
      "success": "Yes—Направо. means “To the right.”.",
      "retryFeedback": "Picture the turn: one direction goes right and the other goes left.",
      "hint": meaningHint
     }
    },
    "sentence": {
     "set": {
      "title": "Ask for the metro.",
      "instruction": "Build “Where is the metro?”",
      "prompt": "Где метро",
      "tokens": [
       "метро",
       "Где"
      ],
      "answer": "Где метро",
      "review": "Где метро → Where is the metro?",
      "success": "That works: Где метро. Where is the metro?",
      "retryFeedback": sentenceRetry,
      "hint": "Ask where first, then name the place."
     }
    },
    "exchange": {
     "set": {
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
      "review": "Метро? Прямо. → Спасибо!",
      "success": "Your directions are clear—thank the person who helped. Спасибо!",
      "retryFeedback": "A thank-you fits after someone gives you directions.",
      "hint": dialogueHint
     }
    },
    "type": {
     "set": {
      "title": "Keep going straight.",
      "instruction": "Type “Straight ahead!” in Russian. The letter buttons are here if you need them.",
      "translation": "Straight ahead!",
      "review": "прямо → Straight ahead!",
      "success": "Yes: прямо means “Straight ahead!”. A useful word for this story.",
      "retryFeedback": "The direction is one word. Listen again or check its letters.",
      "hint": "Remember the direction that takes you ahead, without turning."
     }
    }
   }
  }
 },
 "shopping": {
  "description": "Buy bread at a small neighbourhood shop.",
  "summary": "You asked a price, requested bread, and confirmed your purchase politely.",
  "completionTip": "At a counter, name an item and add пожалуйста.",
  "exercises": {
   "order": [
    "discover",
    "meaning",
    "type",
    "exchange",
    "sentence"
   ],
   "entries": {
    "discover": {
     "set": {
      "title": "A loaf for lunch.",
      "instruction": "Buy bread at a small neighbourhood shop. Explore these five expressions before you try them.",
      "prompt": "Сколько стоит?",
      "review": "At the shop expressions",
      "success": discoverySuccess
     }
    },
    "meaning": {
     "set": {
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
      "success": "Yes—Сколько стоит? means “How much does it cost?”.",
      "retryFeedback": "This expression asks about money, not a location or a name.",
      "hint": meaningHint
     }
    },
    "type": {
     "set": {
      "title": "Bread on the list.",
      "instruction": "Type “bread” in Russian. The letter buttons are here if you need them.",
      "success": "Yes: хлеб means “bread”. A useful word for this story.",
      "retryFeedback": "This is the short word for bread. Check the breathy first letter.",
      "hint": "Four letters: the first sound is the breathy kh."
     }
    },
    "exchange": {
     "set": {
      "title": "The assistant checks.",
      "instruction": "The assistant checks your choice. Confirm politely.",
      "choices": [
       "Да, спасибо.",
       "Где метро?",
       "Пока!"
      ],
      "review": "Хлеб? → Да, спасибо.",
      "success": "The assistant checks your choice. Confirm politely. Да, спасибо.",
      "retryFeedback": "The assistant wants to know whether bread is what you want.",
      "hint": dialogueHint
     }
    },
    "sentence": {
     "set": {
      "title": "A small, polite order.",
      "instruction": "Build “Bread, please.”",
      "prompt": "Хлеб пожалуйста",
      "tokens": [
       "пожалуйста",
       "Хлеб"
      ],
      "answer": "Хлеб пожалуйста",
      "review": "Хлеб пожалуйста → Bread, please.",
      "success": "That works: Хлеб пожалуйста. Bread, please.",
      "retryFeedback": sentenceRetry,
      "hint": "Name what you want, then add the polite word."
     }
    }
   }
  }
 },
 "daily-life": {
  "description": "Tell Anna about a quiet morning and a busy evening.",
  "summary": "You described a morning coffee, work, and relaxing in the evening.",
  "completionTip": "Try Утром я… to describe one thing you do each morning.",
  "exercises": {
   "order": [
    "discover",
    "sentence",
    "meaning",
    "type",
    "exchange"
   ],
   "entries": {
    "discover": {
     "set": {
      "title": "Morning to evening.",
      "instruction": "Tell Anna about a quiet morning and a busy evening. Explore these five expressions before you try them.",
      "review": "My day expressions",
      "success": discoverySuccess
     }
    },
    "sentence": {
     "set": {
      "title": "Coffee before work.",
      "instruction": "Build “In the morning I drink coffee.”",
      "prompt": "Утром я пью кофе",
      "tokens": [
       "кофе",
       "пью",
       "Утром",
       "я"
      ],
      "answer": "Утром я пью кофе",
      "review": "Утром я пью кофе → In the morning I drink coffee.",
      "success": "That works: Утром я пью кофе. In the morning I drink coffee.",
      "retryFeedback": sentenceRetry,
      "hint": "Start with when, then who, then the action and drink."
     }
    },
    "meaning": {
     "set": {
      "wordId": "evening",
      "title": "When do you unwind?",
      "instruction": "Choose the meaning of вечером",
      "prompt": "вечером",
      "choices": [
       "in the morning",
       "in the evening",
       "tomorrow"
      ],
      "answer": "in the evening",
      "review": "вечером → in the evening",
      "success": "Yes—вечером means “in the evening”.",
      "retryFeedback": "Think of the part of the day after work and before bedtime.",
      "hint": meaningHint
     }
    },
    "type": {
     "set": {
      "id": "type",
      "kind": "typed",
      "title": "An early start.",
      "instruction": "Type “in the morning” in Russian. The letter buttons are here if you need them.",
      "prompt": "утром",
      "translation": "in the morning",
      "letters": [
       "р",
       "м",
       "у",
       "о",
       "т"
      ],
      "answer": "утром",
      "review": "утром → in the morning",
      "success": "Yes: утром means “in the morning”. A useful word for this story.",
      "retryFeedback": "Think about the morning word from the first step. Check its ending.",
      "hint": "Think of the time of day when your first coffee usually happens."
     }
    },
    "exchange": {
     "set": {
      "title": "Anna asks about later.",
      "instruction": "Anna asks about your evening. Tell her you relax.",
      "choices": [
       "Я отдыхаю.",
       "Спасибо!",
       "Где метро?"
      ],
      "review": "А вечером? → Я отдыхаю.",
      "success": "Anna asks about your evening. Tell her you relax. Я отдыхаю.",
      "retryFeedback": "Anna asks about your evening activity, not your name or location.",
      "hint": dialogueHint
     }
    }
   }
  }
 },
 "making-plans": {
  "description": "Invite Alex for a walk and agree to meet tomorrow.",
  "summary": "You invited a friend for a walk, accepted a plan, and said see you tomorrow.",
  "completionTip": "Use Давай… with a friend or peer; it is informal.",
  "words": {
   "entries": {
    "walk": {
     "set": {
      "text": "Давай гулять!",
      "stressed": "Дава́й гуля́ть!",
      "pronunciation": "da-VAI gu-LYAT"
     }
    },
    "agree": {
     "set": {
      "meaning": "Let’s! / Sure! (informal)"
     }
    }
   }
  },
  "exercises": {
   "order": [
    "discover",
    "meaning",
    "exchange",
    "sentence",
    "type"
   ],
   "entries": {
    "discover": {
     "set": {
      "title": "A walk with Alex.",
      "instruction": "Invite Alex for a walk and agree to meet tomorrow. Explore these five expressions before you try them.",
      "prompt": "сегодня",
      "review": "Making plans expressions",
      "success": discoverySuccess
     }
    },
    "meaning": {
     "set": {
      "id": "meaning",
      "kind": "choice",
      "wordId": "today",
      "title": "Today or tomorrow?",
      "instruction": "Choose the meaning of сегодня",
      "prompt": "сегодня",
      "choices": [
       "today",
       "in the evening",
       "tomorrow"
      ],
      "answer": "today",
      "review": "сегодня → today",
      "success": "Yes—сегодня means “today”.",
      "retryFeedback": "This is the day you are living right now, not the next one.",
      "hint": meaningHint
     }
    },
    "exchange": {
     "set": {
      "title": "Alex has an idea.",
      "instruction": "A short Давай! warmly accepts Alex’s informal invitation.",
      "prompt": "Давай гулять завтра!",
      "exchange": {
       "speaker": "ALEX",
       "text": "Давай гулять завтра!",
       "meaning": "Let’s go for a walk tomorrow!"
      },
      "choices": [
       "Давай!",
       "Сколько стоит?",
       "Меня зовут Анна."
      ],
      "review": "Давай гулять завтра! → Давай!",
      "success": "A short Давай! warmly accepts Alex’s informal invitation. Давай!",
      "retryFeedback": "Alex suggests something you can do together. A brief acceptance is enough.",
      "hint": dialogueHint
     }
    },
    "sentence": {
     "set": {
      "title": "Agree on tomorrow.",
      "instruction": "Build “Let’s go for a walk tomorrow!”",
      "prompt": "Давай гулять завтра",
      "tokens": [
       "завтра",
       "Давай",
       "гулять"
      ],
      "answer": "Давай гулять завтра",
      "review": "Давай гулять завтра → Let’s go for a walk tomorrow!",
      "success": "That works: Давай гулять завтра. Let’s go for a walk tomorrow!",
      "retryFeedback": sentenceRetry,
      "hint": "Start with the invitation, add the activity, then the day.",
      "pronunciationGuide": "Дава́й · da-VAI / гуля́ть · gu-LYAT / за́втра · ZAF-tra"
     }
    },
    "type": {
     "set": {
      "title": "Keep the date.",
      "instruction": "Type “tomorrow” in Russian. The letter buttons are here if you need them.",
      "success": "Yes: завтра means “tomorrow”. A useful word for this story.",
      "retryFeedback": "Remember the next-day word from the invitation. Check each letter.",
      "hint": "Not today: the next day. It starts with a z sound."
     }
    }
   }
  }
 },
 "studies": {
  "description": "Meet a classmate and talk about where you study or work.",
  "summary": "You said you study at university, recognized at home, and asked a peer where they work.",
  "completionTip": "Где ты работаешь? is informal; use it with a peer, not a stranger you address formally.",
  "words": {
   "entries": {
    "study": {
     "set": {
      "text": "Я учусь.",
      "stressed": "Я учу́сь.",
      "pronunciation": "ya u-CHOOS",
      "meaning": "I study."
     }
    },
    "university": {
     "set": {
      "text": "в университете",
      "stressed": "в университе́те",
      "pronunciation": "v u-nee-ver-see-TYE-te",
      "meaning": "at university"
     }
    },
    "home": {
     "set": {
      "text": "дома",
      "stressed": "до́ма",
      "pronunciation": "DO-ma",
      "meaning": "at home"
     }
    },
    "you": {
     "set": {
      "text": "А ты?",
      "stressed": "А ты?",
      "pronunciation": "a ty",
      "meaning": "And you? (informal)"
     }
    }
   }
  },
  "exercises": {
   "order": [
    "discover",
    "meaning",
    "sentence",
    "type",
    "exchange"
   ],
   "entries": {
    "discover": {
     "set": {
      "title": "A new classmate.",
      "instruction": "Meet a classmate and talk about where you study or work. Explore these five expressions before you try them.",
      "prompt": "Я учусь.",
      "review": "Study and work expressions",
      "success": discoverySuccess
     }
    },
    "meaning": {
     "set": {
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
      "hint": meaningHint
     },
     "unset": [
      "translation",
      "tokens",
      "pronunciationGuide"
     ]
    },
    "sentence": {
     "set": {
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
      "retryFeedback": sentenceRetry,
      "hint": "Say who, then the action, then the two-word place phrase.",
      "pronunciationGuide": "Я · ya / учу́сь · u-CHOOS / в университе́те · v u-nee-ver-see-TYE-te"
     }
    },
    "type": {
     "set": {
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
    },
    "exchange": {
     "set": {
      "instruction": "Your classmate studies at university. You work. What do you say?",
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
      "success": "А я работаю. — “And I work.” Here, А introduces a contrast with your classmate.",
      "retryFeedback": "Your classmate asks about you. Choose the reply that describes what you do.",
      "hint": "Use the work expression from My day. The short word А introduces a contrast."
     }
    }
   }
  }
 },
 "culture": {
  "description": "Meet Anna at a museum, then plan tea after your visit.",
  "summary": "You understood a museum-and-tea invitation and combined earlier greetings, plans, and tomorrow in a conversation.",
  "completionTip": "Try planning a small outing with Давай… and finish with До завтра!",
  "exercises": {
   "order": [
    "discover",
    "type",
    "meaning",
    "sentence",
    "exchange"
   ],
   "entries": {
    "discover": {
     "set": {
      "title": "A weekend with Anna.",
      "instruction": "Meet Anna at a museum, then plan tea after your visit. Explore these five expressions before you try them.",
      "review": "A Russian weekend expressions",
      "success": discoverySuccess
     }
    },
    "type": {
     "set": {
      "id": "type",
      "kind": "typed",
      "title": "A place worth visiting.",
      "instruction": "Type “museum” in Russian. The letter buttons are here if you need them.",
      "prompt": "музей",
      "translation": "museum",
      "letters": [
       "й",
       "з",
       "м",
       "е",
       "у"
      ],
      "answer": "музей",
      "review": "музей → museum",
      "success": "Yes: музей means “museum”. A useful word for this story.",
      "retryFeedback": "This cultural place ends in the short y letter. Check the middle letters too.",
      "hint": "A cultural place with five letters; the last is the short y letter."
     }
    },
    "meaning": {
     "set": {
      "wordId": "interesting",
      "title": "Something catches your eye.",
      "instruction": "Choose the meaning of Интересно!",
      "prompt": "Интересно!",
      "choices": [
       "Interesting!",
       "See you tomorrow!",
       "How much is it?"
      ],
      "answer": "Interesting!",
      "review": "Интересно! → Interesting!",
      "success": "Yes—Интересно! means “Interesting!”.",
      "retryFeedback": "This reaction shows curiosity about what you see, rather than saying goodbye.",
      "hint": meaningHint
     }
    },
    "sentence": {
     "set": {
      "title": "Tomorrow at the museum.",
      "instruction": "Build “Let’s go to the museum tomorrow!”",
      "prompt": "Давай в музей завтра",
      "tokens": [
       "завтра",
       "музей",
       "Давай",
       "в"
      ],
      "answer": "Давай в музей завтра",
      "review": "Давай в музей завтра → Let’s go to the museum tomorrow!",
      "success": "That works: Давай в музей завтра. Let’s go to the museum tomorrow!",
      "retryFeedback": sentenceRetry,
      "hint": "Begin with the invitation; keep в directly before the place.",
      "pronunciationGuide": "Дава́й · da-VAI / в музе́й · v mu-ZYEY / за́втра · ZAF-tra"
     }
    },
    "exchange": {
     "set": {
      "title": "A visit, then a cup.",
      "instruction": "You accept both parts of Anna’s plan: a museum visit and tea.",
      "prompt": "Привет! Давай в музей! Потом чай?",
      "exchange": {
       "speaker": "ANNA",
       "text": "Привет! Давай в музей! Потом чай?",
       "meaning": "Hi! Let’s go to the museum! Tea afterwards?"
      },
      "choices": [
       "Да, давай!",
       "Где ты работаешь?",
       "Меня зовут Анна."
      ],
      "review": "Привет! Давай в музей! Потом чай? → Да, давай!",
      "success": "You accept both parts of Anna’s plan: a museum visit and tea. Да, давай!",
      "retryFeedback": "Anna has offered a friendly plan. Choose a reply that accepts it.",
      "hint": dialogueHint
     }
    }
   }
  }
 }
};
