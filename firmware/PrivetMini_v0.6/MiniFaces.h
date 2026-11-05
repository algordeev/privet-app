#pragma once
#include <stdint.h>
#include <stdlib.h>
#include <math.h>
#include <initializer_list>
// Privet Mini's own face set on its 128x64 OLED: sleeping, the eleven app
// reactions and the local motion/button faces (see local()), all in one style (eyes 16x20 px, 36 px apart, a shine in each,
// 2 px strokes, extras only in the top band or at the sides, no corner dot:
// the front LED shows the connection). The desk robot's faces are not used.
//
// Everything is drawn pixel by pixel through plot(x, y, on), so the app's 3D
// figure (src/miniFaces.ts) can draw exactly the same pixels. Keep the two in
// sync; the host test scripts/test-mini-faces.cpp compares them.
// No display, BLE or Arduino calls here.
namespace MiniFaces {
static constexpr int W = 128, H = 64, EL = 46, ER = 82, EY = 30;
static constexpr double HALF_TURN = 3.14159265358979323846;
static constexpr uint32_t AMBIENT_WINDOW_MS = 60000;  // IDLE glances only this long after a command

template <class Plot> class Pen {
  Plot plot;
  bool on = true;
 public:
  explicit Pen(Plot p) : plot(p) {}
  void color(bool v) { on = v; }
  void set(int x, int y) { if (x >= 0 && y >= 0 && x < W && y < H) plot(x, y, on); }
  void hline(int x, int y, int w) { for (int i = 0; i < w; i++) set(x + i, y); }
  void vline(int x, int y, int h) { for (int i = 0; i < h; i++) set(x, y + i); }
  void box(int x, int y, int w, int h) { for (int j = 0; j < h; j++) hline(x, y + j, w); }
  void line(int x0, int y0, int x1, int y1) {
    const int dx = abs(x1 - x0), dy = -abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    int e = dx + dy;
    for (;;) {
      set(x0, y0);
      if (x0 == x1 && y0 == y1) break;
      const int e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // side: 0 the whole circle, -1 only its left half, 1 only its right half.
  void circle(int x0, int y0, int r, int side = 0) {
    int f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r;
    auto p = [&](int px, int py) { if (side == 0 || px == 0 || (px > 0 ? 1 : -1) == side) set(x0 + px, y0 + py); };
    p(0, r); p(0, -r); p(r, 0); p(-r, 0);
    while (x < y) {
      if (f >= 0) { y--; ddy += 2; f += ddy; }
      x++; ddx += 2; f += ddx;
      p(x, y); p(-x, y); p(x, -y); p(-x, -y); p(y, x); p(-y, x); p(y, -x); p(-y, -x);
    }
  }
  void disc(int x0, int y0, int r) {
    for (int y = -r; y <= r; y++) for (int x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) set(x0 + x, y0 + y);
  }
  void rbox(int x, int y, int w, int h, int r) {
    const int shortest = w < h ? w : h, maximum = (shortest - 1) >> 1;
    r = r < maximum ? r : maximum; if (r < 0) r = 0;
    for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) {
      const int dx = i < r ? r - i : i > w - 1 - r ? i - (w - 1 - r) : 0;
      const int dy = j < r ? r - j : j > h - 1 - r ? j - (h - 1 - r) : 0;
      if (dx * dx + dy * dy <= r * r + r) set(x + i, y + j);
    }
  }
  // Fills the pixels whose centres lie inside the polygon (even-odd rule).
  void poly(const double (*p)[2], int n) {
    double minX = p[0][0], maxX = p[0][0], minY = p[0][1], maxY = p[0][1];
    for (int i = 1; i < n; i++) {
      minX = p[i][0] < minX ? p[i][0] : minX;
      maxX = p[i][0] > maxX ? p[i][0] : maxX;
      minY = p[i][1] < minY ? p[i][1] : minY;
      maxY = p[i][1] > maxY ? p[i][1] : maxY;
    }
    for (int y = int(floor(minY)); y <= int(ceil(maxY)); y++) for (int x = int(floor(minX)); x <= int(ceil(maxX)); x++) {
      bool inside = false; const double cx = x + .5, cy = y + .5;
      for (int i = 0, j = n - 1; i < n; j = i++) {
        const double xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
        if ((yi > cy) != (yj > cy) && cx < (xj - xi) * (cy - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) set(x, y);
    }
  }
};

// ---- The face language ----
template <class P> void eyes(P &d, int dx = 0, int dy = 0, int h = 20) {
  for (int cx : {EL, ER}) {
    const int x = cx - 8 + dx;
    if (h <= 3) { d.box(x, EY - 1 + dy, 16, 2); continue; }
    const int y = EY - (h >> 1) + dy;
    d.rbox(x, y, 16, h, 6);
    if (h >= 12) { d.color(false); d.box(x + 3, y + 3, 4, 4); d.color(true); }  // the shine
  }
}
template <class P> void happyEyes(P &d, int dy = 0) {  // "^ ^"
  for (int cx : {EL, ER}) for (int t = 0; t < 3; t++) {
    d.line(cx - 7, EY + 2 + t + dy, cx - 3, EY - 2 + t + dy);
    d.line(cx - 3, EY - 2 + t + dy, cx + 3, EY - 2 + t + dy);
    d.line(cx + 3, EY - 2 + t + dy, cx + 7, EY + 2 + t + dy);
  }
}
template <class P> void closedEyes(P &d, int dy = 0) {  // sleeping
  for (int cx : {EL, ER}) for (int t = 0; t < 2; t++) {
    d.line(cx - 7, EY + t + dy, cx - 4, EY + 3 + t + dy);
    d.line(cx - 4, EY + 3 + t + dy, cx + 4, EY + 3 + t + dy);
    d.line(cx + 4, EY + 3 + t + dy, cx + 7, EY + t + dy);
  }
}
// Sad "puppy" eyes: outer top corners cut away, a big shine and a small one.
template <class P> void sadEyes(P &d, int dy = 0) {
  for (int side : {-1, 1}) {
    const int x = (side < 0 ? EL : ER) - 8, y = EY - 10 + dy;
    d.rbox(x, y, 16, 20, 6);
    d.color(false);
    if (side < 0) { const double cut[3][2] = {{x - 1., y - 1.}, {x + 12., y - 1.}, {x - 1., y + 7.}}; d.poly(cut, 3); }
    else { const double cut[3][2] = {{x + 17., y - 1.}, {x + 4., y - 1.}, {x + 17., y + 7.}}; d.poly(cut, 3); }
    d.box(x + (side < 0 ? 8 : 4), y + 7, 4, 4);
    d.box(x + (side < 0 ? 5 : 9), y + 13, 2, 2);
    d.color(true);
  }
}
template <class P> void starEyes(P &d, int radius) {
  for (int cx : {EL, ER}) {
    double pts[10][2];
    for (int i = 0; i < 10; i++) {
      const double a = -HALF_TURN / 2 + i * HALF_TURN / 5, r = i % 2 ? radius * .46 : radius;
      pts[i][0] = cx + .5 + cos(a) * r; pts[i][1] = EY + .5 + sin(a) * r;
    }
    d.poly(pts, 10);
  }
}
template <class P> void smile(P &d, int dy = 0, int dx = 0) {
  for (int t = 0; t < 2; t++) { d.line(59 + dx, 45 + t + dy, 61 + dx, 47 + t + dy); d.line(61 + dx, 47 + t + dy, 67 + dx, 47 + t + dy); d.line(67 + dx, 47 + t + dy, 69 + dx, 45 + t + dy); }
}
template <class P> void frown(P &d, int dy = 0) {
  for (int t = 0; t < 2; t++) { d.line(59, 49 + t + dy, 61, 47 + t + dy); d.line(61, 47 + t + dy, 67, 47 + t + dy); d.line(67, 47 + t + dy, 69, 49 + t + dy); }
}
template <class P> void openMouth(P &d, int dy = 0) {  // "D"
  d.hline(59, 45 + dy, 11); d.hline(59, 46 + dy, 11); d.hline(60, 47 + dy, 9); d.hline(61, 48 + dy, 7); d.hline(62, 49 + dy, 5);
}
template <class P> void oMouth(P &d, int dy = 0) { d.circle(64, 47 + dy, 2); }
template <class P> void slantMouth(P &d) { for (int t = 0; t < 2; t++) d.line(60, 48 + t, 67, 46 + t); }
template <class P> void sparkle(P &d, int x, int y, int r) {
  d.hline(x - r, y, 2 * r + 1); d.vline(x, y - r, 2 * r + 1);
  if (r >= 3) { d.set(x - 1, y - 1); d.set(x + 1, y - 1); d.set(x - 1, y + 1); d.set(x + 1, y + 1); }
}
template <class P> void zee(P &d, int x, int y, int s) { d.hline(x, y, s); d.line(x + s - 1, y, x, y + s - 1); d.hline(x, y + s - 1, s); }
// 3x5 glyphs for the combo count: rows top to bottom, bit 2 = left column.
template <class P> void text(P &d, int x, int y, const char *s) {
  static const uint8_t digits[10][5] = {{7,5,5,5,7},{2,6,2,2,7},{7,1,7,4,7},{7,1,7,1,7},{5,5,7,1,1},{7,4,7,1,7},{7,4,7,5,7},{7,1,1,1,1},{7,5,7,5,7},{7,5,7,1,7}};
  static const uint8_t cross[5] = {0,0,5,2,5};
  for (; *s; s++, x += 4) {
    const uint8_t *g = *s == 'x' ? cross : *s >= '0' && *s <= '9' ? digits[*s - '0'] : nullptr;
    if (g) for (int j = 0; j < 5; j++) for (int i = 0; i < 3; i++) if (g[j] & (4 >> i)) d.set(x + i, y + j);
  }
}
template <class P> void flame(P &d, int x, int y, int f) {
  d.disc(x, y + 8, 3);
  const double tri[3][2] = {{x - 3.5, y + 8.}, {x + 4.5, y + 8.}, {x + .5, double(y - f)}};
  d.poly(tri, 3);
  d.color(false); d.set(x, y + 9); d.set(x, y + 8); d.color(true);
}
template <class P> void bulb(P &d, int x, int y, bool lit) {
  d.circle(x, y, 4); d.hline(x - 2, y + 5, 5); d.hline(x - 1, y + 7, 3);
  if (lit) {
    d.disc(x, y, 2); d.hline(x - 9, y, 3); d.hline(x + 7, y, 3); d.vline(x, y - 9, 3);
    d.line(x - 7, y - 7, x - 6, y - 6); d.line(x + 7, y - 7, x + 6, y - 6);
  }
}
// The idle glance, in pixels: once per 7.8 s, alternating sides.
inline int glance(uint32_t age) {
  const uint32_t p = age % 7800U;
  if (p < 2200U || p >= 4000U) return 0;
  const double t = p - 2200.0, m = t < 300 ? t / 300 : t < 1500 ? 1 : (1800 - t) / 300;
  return int(((age / 7800U) % 2U ? -m : m) * 4);
}
inline int roundHalfUp(double v) { return int(floor(v + .5)); }

// ---- The faces: age = ms since the face began, now = the device clock ----
// Not connected: closed eyes breathe; three Zzz float up to the corner.
template <class P> void sleeping(P &d, uint32_t age) {
  const uint32_t p = age % 3200U;
  const int breathe = p < 1600U ? int(p / 800U) : int((3200U - p) / 800U);
  closedEyes(d, breathe); d.circle(64, 46 + breathe, 2);
  for (int k = 0; k < 3; k++) {
    const double q = fmod(age / 2400.0 + k / 3.0, 1.0);
    if (q < .9) zee(d, roundHalfUp(98 + q * 16), roundHalfUp(24 - q * 20), 3 + int(floor(q * 3)));
  }
}
// Reaction codes as in the app protocol: 1 HAPPY, 2 ENCOURAGE, 3 CELEBRATE,
// 4 IDLE, 5 LISTENING, 6 THINKING, 7 HINT, 8 STREAK, 9 CONNECTED, 11 NOD, 12 ON_FIRE.
template <class P> void reaction(P &d, uint8_t code, uint32_t age, uint32_t now, uint8_t combo) {
  switch (code) {
    case 9: {  // CONNECTED: eyes pop open with a small overshoot, smile, sparkles
      const int h = age < 300U ? 2 + int(age * 20U / 300U) : age < 420U ? 22 : 20;
      eyes(d, 0, 0, h);
      if (age >= 250U) smile(d);
      if (age >= 450U && age < 1500U) {
        static const int sizes[6] = {1, 2, 3, 3, 2, 1};
        const int r = sizes[(age - 450U) / 175U];
        sparkle(d, 24, 16, r); sparkle(d, 104, 16, r);
      }
      break;
    }
    case 1: {  // HAPPY
      const int dy = age < 150U ? -2 : age < 300U ? 0 : age < 420U ? -1 : 0;
      happyEyes(d, dy); openMouth(d, dy);
      break;
    }
    case 2:  // ENCOURAGE: puppy eyes and a tear, then a hopeful smile
      if (age < 1500U) {
        const int droop = age / 250U < 2U ? int(age / 250U) : 2;
        sadEyes(d, droop); frown(d, droop);
        if (age > 300U && age < 1400U) { const int ty = 41 + int((age - 300U) / 90U); d.disc(41, ty, 1); d.set(41, ty - 2); }
      } else {
        const int back = int((age - 1500U) / 150U), dy = back < 2 ? 2 - back : 0;
        eyes(d, 0, dy); smile(d, dy);
      }
      break;
    case 3: {  // CELEBRATE: confetti at the sides, bouncing joy, twinkling sparkles
      static const int lanes[6] = {5, 13, 24, 103, 114, 121};
      for (int i = 0; i < 6; i++) d.box(lanes[i], int(floor(fmod(age * (.018 + .004 * i) + i * 11, 72.0))) - 6, 2, 2);
      const int dy = (age / 180U) % 2U ? -2 : 0;
      happyEyes(d, dy); openMouth(d, dy);
      static const int spots[4][2] = {{16, 12}, {112, 10}, {20, 52}, {108, 54}};
      for (int k = 0; k < 4; k++) sparkle(d, spots[k][0], spots[k][1], 1 + int((age / 150U + k) % 3U));
      break;
    }
    case 8:  // STREAK: pulsing star eyes
      starEyes(d, (age / 220U) % 2U ? 10 : 9); openMouth(d);
      sparkle(d, 64, 8, 1 + int((age / 220U) % 2U));
      break;
    case 12: {  // ON_FIRE: flame and the combo above bouncing happy eyes
      const int dy = (age / 180U) % 2U ? -1 : 0;
      happyEyes(d, dy); openMouth(d, dy);
      flame(d, 58, 2, int((age / 120U) % 2U));
      if (combo >= 2) {  // "x3" .. "x255"
        char buf[5] = {'x'}; int n = 1;
        if (combo >= 100) buf[n++] = char('0' + combo / 100);
        if (combo >= 10) buf[n++] = char('0' + combo / 10 % 10);
        buf[n++] = char('0' + combo % 10); buf[n] = 0;
        text(d, 66, 6, buf);
      }
      const int r = (age / 180U) % 2U ? 1 : 3;
      sparkle(d, 16, 20, r); sparkle(d, 112, 20, r);
      break;
    }
    case 5: {  // LISTENING: wide eyes, small "o", sound waves on both sides
      eyes(d, 0, -2, now % 3000U < 120U ? 2 : 22); oMouth(d);
      const int n = 1 + int((age / 250U) % 3U);
      for (int i = 0; i < n; i++) { d.circle(30, 28, 5 + 4 * i, -1); d.circle(98, 28, 5 + 4 * i, 1); }
      break;
    }
    case 6: {  // THINKING: eyes up and right, thought dots fill in one by one
      const double k = (age < 500U ? age : 500U) / 500.0;
      eyes(d, roundHalfUp(3 * k), -roundHalfUp(3 * k), now % 5200U < 130U ? 2 : 20); slantMouth(d);
      const uint32_t p = age % 3000U;
      const int n = p < 600U ? 1 : p < 1200U ? 2 : p < 2400U ? 3 : 0;
      if (n >= 1) d.disc(101, 14, 1);
      if (n >= 2) d.disc(108, 9, 1);
      if (n >= 3) d.disc(116, 4, 2);
      break;
    }
    case 7:  // HINT: "aha!" with a flashing light bulb
      eyes(d, 0, -2, 22); openMouth(d); bulb(d, 110, 14, (age / 180U) % 2U == 0);
      break;
    case 11: {  // NOD: happy eyes, the face dips once
      const int dy = age < 450U ? int(age / 150U) : age < 900U ? int((900U - age) / 150U) : 0;
      happyEyes(d, dy); smile(d, dy);
      break;
    }
    default: {  // IDLE: blinks; glances aside during the first minute
      const int look = age < AMBIENT_WINDOW_MS ? glance(age) : 0;
      eyes(d, look, 0, now % 4300U < 130U ? 2 : 20); smile(d);
      break;
    }
  }
}

// ---- Local faces: motion and buttons on the Mini itself, never sent by the app ----
enum Local : uint8_t { STIR = 1, WHEE, DIZZY, GIGGLE, HUG, PROUD };
// HUG has no duration: it lasts while the left button is held.
static constexpr uint32_t STIR_MS = 2000, WHEE_MS = 2000, DIZZY_MS = 2500, GIGGLE_MS = 1200, PROUD_MS = 2200;

// Eye opening (rows) of the drowsy stir: open slowly, hold, one slow blink, sink shut.
inline int stirOpening(uint32_t t) {
  if (t < 400U) return int(t) * 9 / 400;
  if (t < 900U) return 9;
  if (t < 1100U) return 9 - int(t - 900U) * 7 / 200;
  if (t < 1300U) return 2 + int(t - 1100U) * 6 / 200;
  if (t < STIR_MS) return 8 - int(t - 1300U) * 8 / 700;
  return 0;
}
// Spiral eyes turned by `turn` radians, 2 px strokes, and a wobbly mouth.
template <class P> void dizzyFace(P &d, double turn) {
  for (int cx : {EL, ER}) {
    int px = cx, py = EY;
    for (int k = 1; k <= 14; k++) {
      const double a = turn + k * .7, r = 1 + k * .55;
      const int x = cx + roundHalfUp(cos(a) * r), y = EY + roundHalfUp(sin(a) * r);
      d.line(px, py, x, y); d.line(px + 1, py, x + 1, y);
      px = x; py = y;
    }
  }
  int py = 47;
  for (int x = 56; x <= 72; x += 2) {
    const int y = 47 + roundHalfUp(sin(x * .55 + turn) * 1.5);
    if (x > 56) { d.line(x - 2, py, x, y); d.line(x - 2, py + 1, x, y + 1); }
    py = y;
  }
}
// A 7x6 heart, top-left at x, y.
template <class P> void heart(P &d, int x, int y) {
  static const uint8_t rows[6] = {0x36, 0x7F, 0x7F, 0x3E, 0x1C, 0x08};
  for (int j = 0; j < 6; j++) for (int i = 0; i < 7; i++) if (rows[j] & (0x40 >> i)) d.set(x + i, y + j);
}

// t: ms since the local face began; now: the device clock.
template <class P> void local(P &d, uint8_t which, uint32_t t, uint32_t now) {
  (void)now;
  switch (which) {
    case STIR: {  // asleep and shaken, tossed or poked: heavy half-lids, then back to sleep
      const int open = stirOpening(t);
      if (open < 3) closedEyes(d);
      else for (int cx : {EL, ER}) {
        const int x = cx - 8, y = EY - 10;
        d.rbox(x, y, 16, 20, 6);
        d.color(false); d.box(x, y, 16, 20 - open); d.color(true);
        d.box(x - 2, y + 19 - open, 20, 2);  // the lid
      }
      d.circle(64, 46, 2);
      break;
    }
    case WHEE: {  // tossed: wide eyes, open smile, a little bounce, twinkling sparkles
      const int bounce = (t / 160U) % 2U ? -1 : 1;
      eyes(d, 0, bounce - 2, 22); openMouth(d, bounce);
      const int r = (t / 180U) % 2U ? 1 : 3;
      sparkle(d, 24, 16, r); sparkle(d, 104, 16, r);
      break;
    }
    case DIZZY:  // shaken: spirals spin fast and slow to a stop (about 14 radians)
      dizzyFace(d, 14.0 * (1.0 - exp(-double(t) / 700.0)));
      break;
    case GIGGLE: {  // a pat (left button): "^ ^" and an open smile, quick little hops
      const int dy = (t / 90U) % 2U ? -1 : 0;
      happyEyes(d, dy); openMouth(d, dy);
      break;
    }
    case HUG: {  // left button held: happy squint, smile, hearts float up at the sides
      happyEyes(d); smile(d);
      for (int k = 0; k < 2; k++) {
        const uint32_t q = (t + k * 700U) % 1400U;
        const int y = 40 - int(q * 30U / 1400U);
        if (q < 1200U) heart(d, k ? 104 : 17, y);
      }
      break;
    }
    case PROUD: {  // closing pocket words after five or more: star eyes and a grin
      starEyes(d, (t / 220U) % 2U ? 10 : 9); openMouth(d);
      sparkle(d, 20, 12, 1 + int((t / 160U) % 3U)); sparkle(d, 108, 12, 1 + int((t / 160U + 1) % 3U));
      break;
    }
  }
}

// IDLE with the eyes following the tilt: eyes dx, dy pixels (dy up to -8),
// the smile half as far; blinks as usual.
template <class P> void look(P &d, int dx, int dy, uint32_t now) {
  eyes(d, dx, dy, now % 4300U < 130U ? 2 : 20);
  smile(d, dy / 2, dx / 2);
}
}  // namespace MiniFaces
