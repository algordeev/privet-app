// Host checks for firmware/PrivetMini_v0.6/PocketWords.h: which cards are
// kept, newest first, duplicates (ignoring case and punctuation) move to the front, a full deck forgets the
// oldest, and long text is cut without overflowing.
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "PocketWords.h"
using namespace PocketWords;

int main() {
  Deck d;
  assert(d.valid() && d.count == 0);
  // Kept: discovery (1) and answer (5) cards with Cyrillic and a meaning.
  assert(d.add(1, "привет", "hello"));
  assert(d.add(5, "Я работаю.", "I work."));
  // Not kept: prompts, hints, status cards, English-only or meaning-less cards.
  assert(!d.add(2, "кофе", "Choose on phone"));
  assert(!d.add(4, "See phone hint", "At the cafe"));
  assert(!d.add(1, "Lesson ready", "At the cafe"));
  assert(!d.add(5, "All pairs matched", "Review"));
  assert(!d.add(1, "спасибо", ""));
  assert(d.count == 2 && !strcmp(d.words[0].russian, "Я работаю.") && !strcmp(d.words[1].russian, "привет"));
  // The same word again: moves to the front, no duplicate; unchanged newest: no write.
  assert(d.add(1, "привет", "hi"));
  assert(d.count == 2 && !strcmp(d.words[0].russian, "привет") && !strcmp(d.words[0].meaning, "hi"));
  assert(!d.add(5, "привет", "hi"));
  // Case, punctuation, spaces and ё/е don't make a new word; the newest spelling wins.
  Deck c;
  assert(c.add(5, "Спасибо!", "Thank you!"));
  assert(c.add(1, "спасибо", "thank you"));
  assert(c.add(5, "СПАСИБО.", "thanks"));
  assert(c.add(1, "«Привет»", "hello"));
  assert(c.add(1, "привет", "hello"));
  assert(c.add(1, "Всё хорошо", "all good"));
  assert(c.add(5, "Все хорошо!", "All good!"));
  assert(c.count == 3 && !strcmp(c.words[0].russian, "Все хорошо!") && !strcmp(c.words[1].russian, "привет") && !strcmp(c.words[2].russian, "СПАСИБО."));
  assert(!c.add(5, "Все хорошо!", "All good!"));
  // Different words stay apart: a different letter, a different number, a missing word.
  assert(!Deck::sameWord("слово1", "слово10") && !Deck::sameWord("я работаю", "я работала") && !Deck::sameWord("доброе утро", "доброе"));
  assert(Deck::sameWord("Как дела?", "как  дела") && Deck::sameWord("Ёлка", "елка"));
  // An old deck with duplicates is cleaned up, keeping the newest of each.
  Deck old;
  strcpy(old.words[0].russian, "спасибо"); strcpy(old.words[1].russian, "кофе");
  strcpy(old.words[2].russian, "Спасибо!"); strcpy(old.words[3].russian, "Кофе.");
  old.count = 4;
  assert(old.dedupe() && old.count == 2 && !strcmp(old.words[0].russian, "спасибо") && !strcmp(old.words[1].russian, "кофе") && !old.words[2].russian[0]);
  assert(!old.dedupe());
  // Full: the oldest is forgotten.
  Deck f;
  char word[16];
  for (int i = 0; i < CAPACITY + 5; i++) { snprintf(word, sizeof word, "слово%d", i); assert(f.add(1, word, "word")); }
  assert(f.count == CAPACITY);
  snprintf(word, sizeof word, "слово%d", CAPACITY + 4); assert(!strcmp(f.words[0].russian, word));
  snprintf(word, sizeof word, "слово%d", 5); assert(!strcmp(f.words[CAPACITY - 1].russian, word));
  // A duplicate from the middle of a full deck keeps the count.
  snprintf(word, sizeof word, "слово%d", 10); assert(f.add(5, word, "ten"));
  assert(f.count == CAPACITY && !strcmp(f.words[0].russian, word));
  // Over-long text is cut and stays terminated.
  char longText[200]; memset(longText, 'a', sizeof longText); longText[199] = 0; memcpy(longText, "\xD0\xB4", 2);
  assert(d.add(1, longText, longText));
  assert(strlen(d.words[0].russian) == 64 && strlen(d.words[0].meaning) == 32);
  // A corrupted flash blob is not valid.
  Deck bad; bad.magic = 0; assert(!bad.valid());
  Deck big; big.count = CAPACITY + 1; assert(!big.valid());
  puts("words ok");
  return 0;
}
