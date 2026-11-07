#pragma once
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include "clib/u8g2.h"
#include "LearningLayout.h"
#include "MiniBattery.h"

// The Mini's menu screens, drawn with U8g2's C API so the same code also renders on a computer
// (scripts/render-mini-screens.cpp makes the previews). No state here: the sketch decides what is on
// screen and passes it in.
//
// Every screen keeps the same frame, so the two buttons always read the same way:
//   - a header: REVIEW is a solid bar with a progress bar under it (the scored mode); FLASHCARDS and
//     STATUS are a light outline (nothing is scored there);
//   - the content in the middle;
//   - a footer naming what each button does: left on the left, right on the right ("back" / "open",
//     "didn't" / "knew it" ...). Right always moves forward, left goes back or says no.
namespace MiniScreens {

constexpr int W = 128, H = 64;
constexpr int FOOTER_TOP = 55;  // the footer's rule; its labels sit on the bottom row

enum Icon : uint8_t { NO_ICON, ICON_BACK, ICON_NEXT, ICON_NO, ICON_YES };

inline void centered(u8g2_t *u, int baseline, const char *text) {
  u8g2_DrawUTF8(u, (W - int(u8g2_GetUTF8Width(u, text))) / 2, baseline, text);
}

// Small drawn icons (fonts have no tick or cross).
inline void cross(u8g2_t *u, int x, int y) { u8g2_DrawLine(u, x, y, x + 4, y + 4); u8g2_DrawLine(u, x + 4, y, x, y + 4); }
inline void tick(u8g2_t *u, int x, int y) { u8g2_DrawLine(u, x, y + 2, x + 2, y + 4); u8g2_DrawLine(u, x + 2, y + 4, x + 6, y); }
inline void arrowLeft(u8g2_t *u, int x, int y) { u8g2_DrawTriangle(u, x, y + 2, x + 3, y - 1, x + 3, y + 5); }
inline void arrowRight(u8g2_t *u, int x, int y) { u8g2_DrawTriangle(u, x + 3, y + 2, x, y - 1, x, y + 5); }
inline void icon(u8g2_t *u, Icon which, int x, int y) {
  switch (which) {
    case ICON_BACK: arrowLeft(u, x, y); break;
    case ICON_NEXT: arrowRight(u, x, y); break;
    case ICON_NO: cross(u, x, y); break;
    case ICON_YES: tick(u, x - 1, y); break;
    default: break;
  }
}

// The two button labels. An empty label leaves that side blank (the button does nothing there).
inline void footer(u8g2_t *u, const char *left, Icon leftIcon, const char *right, Icon rightIcon) {
  for (int x = 0; x < W; x += 2) u8g2_DrawPixel(u, x, FOOTER_TOP);
  u8g2_SetFont(u, u8g2_font_5x8_tr);
  if (left && *left) {
    icon(u, leftIcon, 1, 58);
    u8g2_DrawStr(u, leftIcon ? 9 : 1, 63, left);
  }
  if (right && *right) {
    const int width = int(u8g2_GetStrWidth(u, right));
    const int x = W - 1 - width - (rightIcon ? 8 : 0);
    u8g2_DrawStr(u, x, 63, right);
    icon(u, rightIcon, W - 5, 58);
  }
}

// Headers. Review: solid, with the sitting's progress below. Flashcards and status: outlined.
inline void solidHeader(u8g2_t *u, const char *title, const char *corner, int done, int total) {
  u8g2_DrawRBox(u, 0, 0, W, 10, 2);
  u8g2_SetDrawColor(u, 0);
  u8g2_SetFont(u, u8g2_font_5x8_tr);
  u8g2_DrawStr(u, 4, 8, title);
  if (corner) u8g2_DrawStr(u, W - 4 - int(u8g2_GetStrWidth(u, corner)), 8, corner);
  u8g2_SetDrawColor(u, 1);
  if (total > 0) {
    u8g2_DrawFrame(u, 0, 12, W, 3);
    const int filled = done >= total ? W : (W * done) / total;
    if (filled) u8g2_DrawBox(u, 0, 12, filled, 3);
  }
}
inline void outlineHeader(u8g2_t *u, const char *title, const char *corner) {
  u8g2_DrawRFrame(u, 0, 0, W, 10, 2);
  u8g2_SetFont(u, u8g2_font_5x8_tr);
  u8g2_DrawStr(u, 4, 8, title);
  if (corner) u8g2_DrawStr(u, W - 4 - int(u8g2_GetStrWidth(u, corner)), 8, corner);
}

// A word card between `top` and `bottom` (exclusive): the main text large, centred, up to two lines
// (smaller if it would not fit with what is below), then the second text, or a small cue.
inline void card(u8g2_t *u, int top, int bottom, const char *primary, const char *secondary, const char *cue) {
  const auto measure = [u](const char *t) { return int(u8g2_GetUTF8Width(u, t)); };
  u8g2_SetFont(u, u8g2_font_9x15_t_cyrillic);
  PrivetLayout::Lines main = PrivetLayout::wrap(primary, measure);
  const bool below = (secondary && *secondary) || (cue && *cue);
  bool small = !main.complete || (main.count == 2 && below);
  if (small) { u8g2_SetFont(u, u8g2_font_6x13_t_cyrillic); main = PrivetLayout::wrap(primary, measure); }
  const int mainStep = small ? 13 : 15, mainAscent = small ? 10 : 11;
  PrivetLayout::Lines second;
  if (secondary && *secondary) { u8g2_SetFont(u, u8g2_font_6x13_t_cyrillic); second = PrivetLayout::wrap(secondary, measure); }
  const int secondHeight = second.count ? 3 + second.count * 13 : (cue && *cue) ? 3 + 8 : 0;
  const int height = main.count * mainStep + secondHeight;
  int y = top + ((bottom - top) - height) / 2;
  u8g2_SetFont(u, small ? u8g2_font_6x13_t_cyrillic : u8g2_font_9x15_t_cyrillic);
  for (uint8_t i = 0; i < main.count; i++, y += mainStep) centered(u, y + mainAscent, main.text[i]);
  y += 3;
  if (second.count) {
    u8g2_SetFont(u, u8g2_font_6x13_t_cyrillic);
    for (uint8_t i = 0; i < second.count; i++, y += 13) centered(u, y + 10, second.text[i]);
  } else if (cue && *cue) {
    u8g2_SetFont(u, u8g2_font_5x8_tr);
    centered(u, y + 7, cue);
  }
}

// ---- Screens ----

// The menu: five rows, the chosen one filled. `review` is "7 due", "done" or "none"; `sound` the
// level ("Medium"). Exit goes back to the face (so does hold left, and 10 s untouched).
enum MenuItem : uint8_t { REVIEW, FLASHCARDS, STATUS, SOUND, EXIT, MENU_ITEMS };
constexpr int MENU_ROW = 11;  // 5 rows of 11 px end just above the footer's rule
static_assert(MENU_ITEMS * MENU_ROW <= FOOTER_TOP, "the menu rows run into the footer");
inline void speaker(u8g2_t *u, int x, int y) {  // a small speaker, 6 x 7 px
  u8g2_DrawBox(u, x, y + 2, 2, 3);
  u8g2_DrawTriangle(u, x + 1, y + 3, x + 5, y - 1, x + 5, y + 8);
}
inline void menuIcon(u8g2_t *u, MenuItem item, int x, int y) {
  switch (item) {
    case REVIEW:  // a circular arrow
      u8g2_DrawCircle(u, x + 4, y + 4, 4, U8G2_DRAW_UPPER_LEFT | U8G2_DRAW_LOWER_LEFT | U8G2_DRAW_LOWER_RIGHT);
      u8g2_DrawTriangle(u, x + 6, y - 1, x + 6, y + 4, x + 10, y + 2);
      break;
    case FLASHCARDS:  // two stacked cards
      u8g2_DrawFrame(u, x + 2, y, 8, 6);
      u8g2_DrawBox(u, x, y + 3, 8, 6);
      break;
    case STATUS:  // an "i" in a circle
      u8g2_DrawCircle(u, x + 4, y + 4, 4, U8G2_DRAW_ALL);
      u8g2_DrawPixel(u, x + 4, y + 2);
      u8g2_DrawVLine(u, x + 4, y + 4, 3);
      break;
    case SOUND:  // a speaker with a wave
      speaker(u, x, y + 1);
      u8g2_DrawCircle(u, x + 5, y + 4, 4, U8G2_DRAW_UPPER_RIGHT | U8G2_DRAW_LOWER_RIGHT);
      break;
    default:  // exit: an arrow back to the left
      u8g2_DrawHLine(u, x + 1, y + 4, 8);
      u8g2_DrawLine(u, x + 1, y + 4, x + 4, y + 1);
      u8g2_DrawLine(u, x + 1, y + 4, x + 4, y + 7);
      break;
  }
}
// The battery icon (MiniBattery.h) in U8g2; `inverted` on a filled row.
inline void battery(u8g2_t *u, int x, int y, int percent, bool charging, bool inverted = false) {
  MiniBattery::icon([u, inverted](int px, int py, bool ink) { u8g2_SetDrawColor(u, ink != inverted); u8g2_DrawPixel(u, px, py); },
                    x, y, percent, charging);
  u8g2_SetDrawColor(u, !inverted);
}

// `batteryPercent` -1: no cell measured, and the Status row shows nothing; otherwise the
// percentage and the battery icon (v0.9).
inline void menu(u8g2_t *u, MenuItem selected, const char *review, const char *flashcards, const char *sound,
                 int batteryPercent = -1, bool charging = false) {
  static const char *const names[] = {"Review", "Flashcards", "Status", "Sound", "Exit"};
  char percent[6] = "";
  if (batteryPercent >= 0) snprintf(percent, sizeof percent, "%d%%", batteryPercent);
  const char *values[] = {review, flashcards, percent, sound, ""};
  for (int i = 0; i < MENU_ITEMS; i++) {
    const int y = i * MENU_ROW;
    const bool on = i == selected;
    if (on) { u8g2_DrawRBox(u, 0, y, W, MENU_ROW, 3); u8g2_SetDrawColor(u, 0); }
    menuIcon(u, MenuItem(i), 5, y + 1);
    u8g2_SetFont(u, u8g2_font_6x10_tr);
    u8g2_DrawStr(u, 21, y + 9, names[i]);
    int right = W - 5;  // where the value ends
    if (i == STATUS && batteryPercent >= 0) {
      right -= MiniBattery::ICON_W;
      battery(u, right, y + 2, batteryPercent, charging, on);
      right -= 3;
    }
    if (values[i] && *values[i]) {
      u8g2_SetFont(u, u8g2_font_5x8_tr);
      u8g2_DrawStr(u, right - int(u8g2_GetStrWidth(u, values[i])), y + 8, values[i]);
    }
    u8g2_SetDrawColor(u, 1);
  }
  footer(u, "next", ICON_BACK, "open", ICON_NEXT);
}

// A review card. Front: the word and a cue ("what does it mean?" / "say it in Russian"). Back: the
// Russian and its meaning; then left = didn't, right = knew it.
inline void reviewCard(u8g2_t *u, int number, int total, int answered, bool back, bool englishFirst, const char *russian, const char *meaning) {
  char corner[8];
  snprintf(corner, sizeof corner, "%d/%d", number, total);
  solidHeader(u, "REVIEW", corner, answered, total);
  if (!back) card(u, 16, FOOTER_TOP, englishFirst ? meaning : russian, nullptr, englishFirst ? "say it in Russian" : "what does it mean?");
  else card(u, 16, FOOTER_TOP, russian, meaning, nullptr);
  if (back) footer(u, "didn't", ICON_NO, "knew it", ICON_YES);
  else footer(u, "quit", ICON_BACK, "flip", ICON_NEXT);
}
inline void reviewDone(u8g2_t *u, int known, int answered) {
  solidHeader(u, "REVIEW", "done", 1, 1);
  u8g2_SetFont(u, u8g2_font_9x15_t_cyrillic);
  centered(u, 32, "Well done!");
  char line[24];
  snprintf(line, sizeof line, "%d of %d known", known, answered);
  u8g2_SetFont(u, u8g2_font_6x13_tr);
  centered(u, 48, line);
  footer(u, "", NO_ICON, "ok", ICON_NEXT);
}
// Nothing to review: `finished` when today's cards are all answered (they go to the app on the next
// connection), otherwise no deck yet.
inline void reviewEmpty(u8g2_t *u, bool finished) {
  solidHeader(u, "REVIEW", nullptr, 0, 0);
  u8g2_SetFont(u, u8g2_font_6x13_tr);
  centered(u, 30, finished ? "All done for now!" : "Nothing to review");
  u8g2_SetFont(u, u8g2_font_5x8_tr);
  centered(u, 44, finished ? "Answers go to the app" : "Today's words arrive");
  centered(u, 52, finished ? "when you connect" : "when you connect");
  footer(u, "back", ICON_BACK, "", NO_ICON);
}

// A flashcard: the Russian, and its meaning once flipped. No score, no progress bar.
inline void flashcard(u8g2_t *u, int number, int total, bool back, const char *russian, const char *meaning) {
  char corner[10];
  snprintf(corner, sizeof corner, "%d/%d", number, total);
  outlineHeader(u, "FLASHCARDS", corner);
  card(u, 11, FOOTER_TOP, russian, back ? meaning : nullptr, back ? nullptr : "");
  footer(u, "back", ICON_BACK, back ? "next" : "flip", ICON_NEXT);
}
inline void flashcardsEmpty(u8g2_t *u) {
  outlineHeader(u, "FLASHCARDS", nullptr);
  u8g2_SetFont(u, u8g2_font_6x13_tr);
  centered(u, 31, "No words yet");
  u8g2_SetFont(u, u8g2_font_5x8_tr);
  centered(u, 45, "Words you meet in the");
  centered(u, 53, "app collect here");
  footer(u, "back", ICON_BACK, "", NO_ICON);
}

// Sound: the level's name and a meter of four bars; right steps up (Max -> Off) and plays a chirp.
// `levelName` is "Off" ... "Max", `level` 0-4.
inline void sound(u8g2_t *u, int level, int levels, const char *levelName) {
  outlineHeader(u, "SOUND", nullptr);
  u8g2_SetFont(u, u8g2_font_9x15_tr);
  centered(u, 29, levelName);
  const int bars = levels - 1, barW = 10, gap = 4, left = (W - (bars * barW + (bars - 1) * gap)) / 2, bottom = 50;
  for (int i = 0; i < bars; i++) {
    const int h = 4 + i * 3, x = left + i * (barW + gap);
    if (i < level) u8g2_DrawBox(u, x, bottom - h, barW, h);
    else u8g2_DrawFrame(u, x, bottom - h, barW, h);
  }
  footer(u, "back", ICON_BACK, level >= levels - 1 ? "off" : "louder", ICON_NEXT);
}

// Status: the link, what is saved, the battery (if measured: the icon and its percentage, or
// "charging"); right restarts Bluetooth.
inline void status(u8g2_t *u, bool connected, int flashcards, int due, int batteryPercent, bool charging = false) {
  outlineHeader(u, "STATUS", "Privet Mini");
  char line[32];
  u8g2_SetFont(u, u8g2_font_6x13_tr);
  u8g2_DrawStr(u, 4, 23, connected ? "Phone connected" : "Not connected");
  u8g2_SetFont(u, u8g2_font_5x8_tr);
  snprintf(line, sizeof line, "%d flashcard%s", flashcards, flashcards == 1 ? "" : "s");
  u8g2_DrawStr(u, 4, 34, line);
  if (due > 0) snprintf(line, sizeof line, "%d to review", due);
  else snprintf(line, sizeof line, "nothing to review");
  u8g2_DrawStr(u, 4, 43, line);
  if (batteryPercent >= 0) {
    battery(u, 4, 45, batteryPercent, charging);
    if (charging) snprintf(line, sizeof line, "charging");
    else snprintf(line, sizeof line, "%d%%%s", batteryPercent, batteryPercent <= MiniBattery::LOW_PERCENT ? " - charge me" : "");
    u8g2_DrawStr(u, 4 + MiniBattery::ICON_W + 4, 52, line);
  }
  footer(u, "back", ICON_BACK, "reconnect", ICON_NEXT);
}
inline void reconnecting(u8g2_t *u) {
  outlineHeader(u, "STATUS", "Privet Mini");
  u8g2_SetFont(u, u8g2_font_6x13_tr);
  centered(u, 30, "Reconnecting...");
  u8g2_SetFont(u, u8g2_font_5x8_tr);
  centered(u, 44, "Tap Connect in the app");
}

}  // namespace MiniScreens
