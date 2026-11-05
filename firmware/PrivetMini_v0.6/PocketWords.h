#pragma once
#include <stdint.h>
#include <string.h>

// Pocket words: the last words the app showed on the Mini with their meaning,
// kept in flash so they can be reviewed later without the phone. Pure logic
// with no flash or display code, so the host test
// (scripts/test-mini-words.cpp) runs exactly this code.
//
// Only cards that already carry a Russian word and its English meaning are
// kept: DISCOVERY (mode 1, a word tapped in a lesson) and ANSWER (mode 5,
// after a correct answer), with Cyrillic in the word. Status and prompt
// cards ("See your phone", "Match the pairs", questions) are never kept.
// Nothing is invented on the device.
namespace PocketWords {

constexpr uint8_t CAPACITY = 30;
constexpr uint8_t MODE_DISCOVERY = 1, MODE_ANSWER = 5;
constexpr uint32_t MAGIC = 0x50574431;  // "PWD1": the flash layout version

struct Word {
  char russian[65];
  char meaning[33];
};

// Plain data, saved to flash as one blob. Index 0 is the newest word.
struct Deck {
  uint32_t magic = MAGIC;
  uint8_t count = 0;
  Word words[CAPACITY] = {};

  bool valid() const { return magic == MAGIC && count <= CAPACITY; }

  static bool hasCyrillic(const char *s) {
    for (; *s; s++) if (uint8_t(*s) == 0xD0 || uint8_t(*s) == 0xD1) return true;
    return false;
  }
  static bool keeps(uint8_t mode, const char *russian, const char *meaning) {
    return (mode == MODE_DISCOVERY || mode == MODE_ANSWER) && hasCyrillic(russian) && meaning[0];
  }

  // Adds a word as the newest. A word already in the deck moves to the front
  // (with the latest meaning); a full deck forgets its oldest word. Returns
  // true when the deck changed.
  bool add(uint8_t mode, const char *russian, const char *meaning) {
    if (!keeps(mode, russian, meaning)) return false;
    Word w = {};
    strncpy(w.russian, russian, sizeof w.russian - 1);
    strncpy(w.meaning, meaning, sizeof w.meaning - 1);
    uint8_t at = count < CAPACITY ? count : CAPACITY - 1;  // the slot that falls off
    for (uint8_t i = 0; i < count; i++) {
      if (strcmp(words[i].russian, w.russian) == 0) {
        if (i == 0 && strcmp(words[0].meaning, w.meaning) == 0) return false;
        at = i;
        break;
      }
    }
    if (at == count) count++;
    memmove(&words[1], &words[0], at * sizeof(Word));
    words[0] = w;
    return true;
  }
};

}  // namespace PocketWords
