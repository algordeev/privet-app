// Renders the Mini's menu screens (firmware/PrivetMini_v0.9/MiniScreens.h) with the real U8g2 C library
// and fonts on a computer, for previews and for checking that nothing overlaps or falls off the screen.
// Prints one line per screen: "name<TAB>1024 hex bytes" (U8g2's SSD1306 page layout).
// Build: c++ -std=c++17 -Ifirmware/PrivetMini_v0.9 -I<U8g2>/src scripts/render-mini-screens.cpp <U8g2>/src/clib/*.c
#include <stdio.h>
#include "MiniScreens.h"
using namespace MiniScreens;

static u8g2_t u;
template <class F> static void shot(const char *name, F draw) {
  u8g2_ClearBuffer(&u);
  u8g2_SetDrawColor(&u, 1);
  u8g2_SetFontMode(&u, 1);
  draw(&u);
  const uint8_t *b = u8g2_GetBufferPtr(&u);
  printf("%s\t", name);
  for (int i = 0; i < 1024; i++) printf("%02x", b[i]);
  printf("\n");
}

int main() {
  u8g2_Setup_ssd1306_128x64_noname_f(&u, U8G2_R0, u8x8_byte_empty, u8x8_dummy_cb);
  shot("menu-review", [](u8g2_t *g) { menu(g, REVIEW, "7 due", "23", "Medium"); });
  shot("menu-flashcards", [](u8g2_t *g) { menu(g, FLASHCARDS, "done", "23", "Loud"); });
  shot("menu-status", [](u8g2_t *g) { menu(g, STATUS, "none", "0", "Off", 82); });
  shot("menu-status-charging", [](u8g2_t *g) { menu(g, STATUS, "none", "0", "Off", 100, true); });
  shot("menu-battery-low", [](u8g2_t *g) { menu(g, REVIEW, "7 due", "23", "Medium", 8); });
  shot("menu-no-battery", [](u8g2_t *g) { menu(g, STATUS, "none", "0", "Off"); });
  shot("menu-sound", [](u8g2_t *g) { menu(g, SOUND, "7 due", "23", "Medium"); });
  shot("menu-exit", [](u8g2_t *g) { menu(g, EXIT, "7 due", "23", "Max"); });
  shot("review-front", [](u8g2_t *g) { reviewCard(g, 3, 7, 2, false, false, "Спасибо!", "Thank you!"); });
  shot("review-front-recall", [](u8g2_t *g) { reviewCard(g, 4, 7, 3, false, true, "Очень приятно.", "Nice to meet you."); });
  shot("review-back", [](u8g2_t *g) { reviewCard(g, 3, 7, 2, true, false, "Спасибо!", "Thank you!"); });
  shot("review-back-long", [](u8g2_t *g) { reviewCard(g, 5, 7, 4, true, true, "Как вас зовут?", "What is your name?"); });
  shot("review-done", [](u8g2_t *g) { reviewDone(g, 5, 7); });
  shot("review-finished", [](u8g2_t *g) { reviewEmpty(g, true); });
  shot("review-empty", [](u8g2_t *g) { reviewEmpty(g, false); });
  shot("flashcard-front", [](u8g2_t *g) { flashcard(g, 12, 23, false, "кофе", "coffee"); });
  shot("flashcard-back", [](u8g2_t *g) { flashcard(g, 12, 23, true, "кофе", "coffee"); });
  shot("flashcard-long", [](u8g2_t *g) { flashcard(g, 3, 23, true, "Я не понимаю, повторите, пожалуйста.", "Please repeat."); });
  shot("flashcards-empty", [](u8g2_t *g) { flashcardsEmpty(g); });
  shot("status", [](u8g2_t *g) { status(g, true, 23, 7, -1); });
  shot("status-battery", [](u8g2_t *g) { status(g, false, 1, 0, 82); });
  shot("status-battery-low", [](u8g2_t *g) { status(g, false, 1, 0, 6); });
  shot("status-charging", [](u8g2_t *g) { status(g, true, 23, 7, 97, true); });
  for (int level = 0; level < 5; level++) {
    static const char *const names[] = {"Off", "Quiet", "Medium", "Loud", "Max"};
    static char name[16];
    snprintf(name, sizeof name, "sound-%d", level);
    shot(name, [level](u8g2_t *g) { sound(g, level, 5, names[level]); });
  }
  shot("reconnecting", [](u8g2_t *g) { reconnecting(g); });
  return 0;
}
