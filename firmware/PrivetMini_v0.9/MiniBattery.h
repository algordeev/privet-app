#pragma once
#include <stdint.h>
#include <stdlib.h>

// The battery: the cell's voltage (the divider already undone) to a level for the icon, smoothed,
// with a guess at charging, and the icon itself. Pure logic with no pins or ADC calls, so the host
// test (scripts/test-mini-battery.cpp) runs exactly this code.
//
// - Under NO_BATTERY_MV there is no cell to show: the switch is off while USB powers the board
//   (the divider sits after the switch), or nothing is fitted. The icon is left out.
// - Charging is a guess from the voltage, as the XIAO has no charge-status pin: the cell reads
//   over CHARGING_ON_MV only while the charger holds it near 4.2 V (or just after it comes off the
//   charger). It stays "charging" until it falls under CHARGING_OFF_MV. Early in a charge (a low
//   cell) the voltage is lower, so there is no bolt then; the fill just grows.
// - Each reading moves the level a quarter of the way (readings come every 10 s), and the shown
//   percentage only changes by 2 or more, so the fill does not flicker on a pixel boundary.
// - At LOW_PERCENT or less (and not charging) the icon is empty and blinks.
namespace MiniBattery {

constexpr uint32_t NO_BATTERY_MV = 3000;
constexpr uint32_t CHARGING_ON_MV = 4150, CHARGING_OFF_MV = 4100;
constexpr int LOW_PERCENT = 10;

// A LiPo cell at rest: millivolts to percent, interpolated.
inline int percentOf(uint32_t mv) {
  static const uint16_t curve[][2] = {{3300, 0}, {3500, 5}, {3600, 12}, {3700, 28}, {3800, 45}, {3900, 62}, {4000, 78}, {4100, 90}, {4200, 100}};
  if (mv <= curve[0][0]) return 0;
  for (size_t i = 1; i < sizeof curve / sizeof curve[0]; i++) {
    if (mv > curve[i][0]) continue;
    const uint32_t v0 = curve[i - 1][0], v1 = curve[i][0], p0 = curve[i - 1][1], p1 = curve[i][1];
    return int(p0 + (p1 - p0) * (mv - v0) / (v1 - v0));
  }
  return 100;
}

class Gauge {
 public:
  // One averaged reading of the cell, in millivolts.
  void feed(uint32_t mv) {
    // The first reading, or a cell appearing or going away, is taken as it is.
    const bool jump = !fed_ || (mv < NO_BATTERY_MV) != (mv_ < NO_BATTERY_MV);
    mv_ = jump ? mv : uint32_t(int32_t(mv_) + (int32_t(mv) - int32_t(mv_)) / 4);
    fed_ = true;
    if (!present()) { charging_ = false; percent_ = -1; return; }
    charging_ = mv_ >= (charging_ ? CHARGING_OFF_MV : CHARGING_ON_MV);
    const int p = percentOf(mv_);
    if (jump || percent_ < 0 || abs(p - percent_) >= 2 || p == 0 || p == 100) percent_ = p;
  }
  bool present() const { return fed_ && mv_ >= NO_BATTERY_MV; }
  bool charging() const { return charging_; }
  bool low() const { return present() && !charging_ && percent_ <= LOW_PERCENT; }
  int percent() const { return percent_; }  // -1: no cell
  uint32_t millivolts() const { return mv_; }

 private:
  uint32_t mv_ = 0;
  int percent_ = -1;
  bool fed_ = false, charging_ = false;
};

// ---- The icon: a battery 15 x 7 px, the nub on the right ----
// A fill of up to 9 px inside a 1 px gap. Charging: the inside solid with a bolt cut out of it,
// instead of the fill. Low: empty.
constexpr int ICON_W = 15, ICON_H = 7;
constexpr uint32_t BLINK_MS = 1000;  // low: shown 600 ms of each second

// Fill width in pixels (0..9): at least 1 above LOW_PERCENT, none at or below it.
inline int fillPixels(int percent) {
  if (percent <= LOW_PERCENT) return 0;
  const int px = (percent * 9 + 50) / 100;
  return px < 1 ? 1 : px > 9 ? 9 : px;
}

// Is the icon drawn at this moment? (No cell: never. Low: blinking.)
inline bool visible(const Gauge &g, uint32_t now) {
  if (!g.present()) return false;
  return !g.low() || now % BLINK_MS < 600U;
}

// Draws the icon with its top-left at x, y through px(x, y, on): on = the ink colour, off = the
// background. The 1 px ring around it is cleared too, so a face's extras pass behind it.
template <class Plot> void icon(Plot plot, int x, int y, int percent, bool charging) {
  const auto px = [&plot](int sx, int sy, bool on) { if (sx >= 0 && sy >= 0 && sx < 128 && sy < 64) plot(sx, sy, on); };
  for (int j = -1; j <= ICON_H; j++)
    for (int i = -1; i <= ICON_W; i++) px(x + i, y + j, false);
  // The body: 13 x 7 with its corners cut, and a 2 x 3 nub.
  for (int i = 1; i < 12; i++) { px(x + i, y, true); px(x + i, y + 6, true); }
  for (int j = 1; j < 6; j++) { px(x, y + j, true); px(x + 12, y + j, true); }
  for (int j = 2; j < 5; j++) { px(x + 13, y + j, true); px(x + 14, y + j, true); }
  if (charging) {
    // The inside filled solid, with a bolt cut out of it (11 x 5; bit 10 = the left column).
    static const uint16_t bolt[5] = {0x030, 0x060, 0x0F8, 0x060, 0x0C0};
    for (int j = 0; j < 5; j++)
      for (int i = 0; i < 11; i++) px(x + 1 + i, y + 1 + j, !(bolt[j] & (0x400 >> i)));
    return;
  }
  const int fill = fillPixels(percent);
  for (int j = 2; j < 5; j++)
    for (int i = 0; i < fill; i++) px(x + 2 + i, y + j, true);
}

}  // namespace MiniBattery
