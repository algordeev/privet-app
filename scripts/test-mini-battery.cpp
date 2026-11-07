// Host checks for firmware/PrivetMini_v0.9/MiniBattery.h: the LiPo curve, smoothing, no cell, the
// charging guess with its hysteresis, low, the steady percentage, and the icon's pixels (fill,
// bolt, the cleared ring, clipping at the screen's edge). Also checks that the v0.9 faces never
// draw into the icon's corner, apart from the sleeping Zzz and the confetti, which pass behind it.
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "MiniBattery.h"
#include "MiniFaces.h"
using namespace MiniBattery;

static bool fb[64][128];
static bool touched[64][128];
static void clear() { memset(fb, 0, sizeof fb); memset(touched, 0, sizeof touched); }
static void plot(int x, int y, bool on) {
  assert(x >= 0 && y >= 0 && x < 128 && y < 64);
  fb[y][x] = on; touched[y][x] = true;
}
static int inkIn(int x0, int y0, int x1, int y1) {  // lit pixels in [x0, x1) x [y0, y1)
  int n = 0;
  for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) n += fb[y][x];
  return n;
}

int main() {
  // The curve: ends, a point on it, in between, monotonic.
  assert(percentOf(3000) == 0 && percentOf(3300) == 0 && percentOf(4200) == 100 && percentOf(4300) == 100);
  assert(percentOf(3800) == 45 && percentOf(3850) == 53);
  for (uint32_t mv = 3300; mv < 4200; mv++) assert(percentOf(mv) <= percentOf(mv + 1));

  {  // Nothing read yet: no cell, no icon.
    Gauge g;
    assert(!g.present() && g.percent() == -1 && !g.charging() && !g.low() && !visible(g, 0));
  }
  {  // The first reading is taken as it is; then each moves it a quarter of the way.
    Gauge g; g.feed(3900);
    assert(g.present() && g.millivolts() == 3900 && g.percent() == 62 && !g.charging() && !g.low());
    g.feed(3800);
    assert(g.millivolts() == 3875);
    for (int i = 0; i < 40; i++) g.feed(3800);
    assert(g.millivolts() <= 3803 && g.percent() >= 45 && g.percent() <= 46);
  }
  {  // ADC noise of +-10 mV around a level never moves the shown percentage.
    Gauge g; g.feed(3850);
    const int shown = g.percent();
    for (int i = 0; i < 200; i++) { g.feed(i % 2 ? 3860 : 3840); assert(g.percent() == shown); }
  }
  {  // No cell (the switch off on USB): no icon; then the switch on: the real level at once.
    Gauge g; g.feed(40);
    assert(!g.present() && g.percent() == -1 && !g.charging() && !visible(g, 0));
    g.feed(3700);
    assert(g.present() && g.millivolts() == 3700 && g.percent() == 28);
    g.feed(0);  // switched off again
    assert(!g.present() && g.percent() == -1 && !visible(g, 0));
  }
  {  // Charging: on at 4150 mV, off only under 4100 mV.
    Gauge g; g.feed(4140);
    assert(!g.charging());
    g.feed(4180); g.feed(4180); g.feed(4180);
    assert(g.millivolts() >= CHARGING_ON_MV && g.charging() && !g.low());
    g.feed(4105);
    for (int i = 0; i < 40 && g.millivolts() >= CHARGING_OFF_MV; i++) { assert(g.charging()); g.feed(4105); }
    assert(g.charging());  // 4105 is still above the off level
    for (int i = 0; i < 40; i++) g.feed(4050);
    assert(!g.charging());
  }
  {  // Low: at 10% or less, and not charging; it blinks (600 ms of each second).
    Gauge g; g.feed(3550);
    assert(g.percent() == 8 && g.low());
    assert(visible(g, 0) && visible(g, 599) && !visible(g, 600) && !visible(g, 999) && visible(g, 1000));
    Gauge ok; ok.feed(3700);
    for (uint32_t t = 0; t < 2000; t += 50) assert(visible(ok, t));
  }

  // Fill pixels: none at or under 10%, at least 1 above it, 9 when full.
  assert(fillPixels(0) == 0 && fillPixels(LOW_PERCENT) == 0 && fillPixels(LOW_PERCENT + 1) == 1);
  assert(fillPixels(50) == 5 && fillPixels(100) == 9);
  for (int p = 0; p < 100; p++) assert(fillPixels(p) <= fillPixels(p + 1));

  const int X = 128 - ICON_W - 1;  // where the sketch puts it
  {  // The icon: body, nub, fill; the ring around it cleared; nothing else touched.
    clear();
    for (int y = 0; y < 64; y++) for (int x = 0; x < 128; x++) fb[y][x] = true;
    icon(plot, X, 0, 50, false);
    for (int y = 0; y < 64; y++) for (int x = 0; x < 128; x++) {
      const bool inRing = x >= X - 1 && x <= X + ICON_W && y <= ICON_H;
      assert(touched[y][x] == inRing);
    }
    for (int x = X - 1; x <= X + ICON_W; x++) assert(!fb[ICON_H][x]);  // the cleared row below
    assert(fb[0][X + 1] && fb[0][X + 11] && !fb[0][X] && !fb[0][X + 12]);  // cut corners
    assert(fb[3][X] && fb[3][X + 12] && fb[3][X + 13] && fb[3][X + 14] && !fb[0][X + 13]);  // sides and nub
    assert(inkIn(X + 2, 2, X + 11, 5) == 5 * 3 && inkIn(X + 2, 2, X + 7, 5) == 15);  // 5 px of fill
    assert(!fb[1][X + 2] && !fb[5][X + 2] && !fb[3][X + 1] && !fb[3][X + 11]);  // the gap round the fill
  }
  {  // Low: an empty body.
    clear(); icon(plot, X, 0, 5, false);
    assert(inkIn(X + 1, 1, X + 12, 6) == 0);
  }
  {  // Charging: the inside solid with a bolt cut out, whatever the level.
    clear(); icon(plot, X, 0, 20, true);
    const int inside = inkIn(X + 1, 1, X + 12, 6);
    assert(inside == 11 * 5 - 13);  // the bolt is 13 px
    assert(!fb[1][X + 6] && !fb[3][X + 4] && !fb[3][X + 8] && !fb[5][X + 4] && fb[1][X + 1] && fb[5][X + 11]);
  }
  {  // At the screen's edge nothing is drawn off it (plot() asserts).
    clear(); icon(plot, 128 - ICON_W, 0, 80, false);
    clear(); icon(plot, -3, 60, 80, true);
  }

  // The v0.9 faces stay out of the icon's corner (with its ring), so nothing is hidden behind it.
  // Only the sleeping Zzz (shared pixel for pixel with the app) and CELEBRATE's confetti pass
  // under it; they are not checked.
  auto pen = MiniFaces::Pen<void (*)(int, int, bool)>(plot);
  auto corner = [&]() { return inkIn(X - 1, 0, 128, ICON_H + 1); };
  for (uint8_t code : {1, 2, 4, 5, 6, 7, 8, 9, 11, 12}) {
    for (uint32_t age = 0; age < 8000; age += 10) {
      clear(); pen.color(true);
      MiniFaces::reaction(pen, code, age, age, 7);
      assert(corner() == 0);
    }
  }
  for (uint32_t age = 0; age < 3000; age += 10) {  // CELEBRATE without the confetti lanes
    clear(); pen.color(true);
    MiniFaces::reaction(pen, 3, age, age, 0);
    for (int y = 0; y <= ICON_H; y++) for (int x : {114, 115, 121, 122}) fb[y][x] = false;
    assert(corner() == 0);
  }
  for (uint8_t which = MiniFaces::STIR; which <= MiniFaces::PROUD; which++)
    for (uint32_t t = 0; t < 3000; t += 10) { clear(); pen.color(true); MiniFaces::local(pen, which, t, t); assert(corner() == 0); }
  for (int dx = -12; dx <= 12; dx++)
    for (int dy = -8; dy <= 2; dy++) { clear(); pen.color(true); MiniFaces::look(pen, dx, dy, 1000); assert(corner() == 0); }

  printf("mini battery: ok\n");
  return 0;
}
