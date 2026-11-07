#pragma once
#include <stdint.h>

// The Mini's sounds on a passive buzzer (D10), with no Arduino calls so the host tests can run them
// (scripts/test-mini-sound.cpp). Each sound is a short list of steps: a steady tone, a glide from one
// pitch to another, or a rest. The sketch asks the Player what the buzzer should do on every input
// tick (10 ms) and sets the PWM frequency and duty.
//
// Loudness is the PWM duty: a piezo is loudest at 50 % (512 of 1024) and gets quieter as the pulses
// get narrower. The levels are the app's (0 Off, 1 Quiet, 2 Medium, 3 Loud, 4 Max). The duties are a
// first guess for a small piezo; tune LEVEL_DUTY on the hardware.
//
// The pitches stay between about 600 Hz and 3 kHz: a small buzzer has almost no bass, and is
// loudest near its resonance (2-4 kHz on most).
namespace MiniSound {

enum Level : uint8_t { OFF, QUIET, MEDIUM, LOUD, MAX, LEVELS };
constexpr uint8_t DEFAULT_LEVEL = MEDIUM;  // a keychain: not too loud in a pocket or a quiet room
constexpr uint8_t DUTY_BITS = 10;          // duty out of 1024
constexpr uint16_t LEVEL_DUTY[LEVELS] = {0, 4, 24, 110, 512};

inline const char *levelName(uint8_t level) {
  static const char *const names[] = {"Off", "Quiet", "Medium", "Loud", "Max"};
  return level < LEVELS ? names[level] : "?";
}

enum Sound : uint8_t {
  NONE,
  // App reactions (the desk robot plays its own versions of these).
  WAKE, HAPPY, ENCOURAGE, CELEBRATE, HINT, STREAK, NOD, ON_FIRE,
  // Local faces.
  GIGGLE, HUG, DIZZY, WHEE, STIR,
  SOUNDS
};

inline const char *soundName(uint8_t sound) {
  static const char *const names[] = {"none", "wake", "happy", "encourage", "celebrate", "hint", "streak", "nod",
                                      "on fire", "giggle", "hug", "dizzy", "whee", "stir"};
  return sound < SOUNDS ? names[sound] : "?";
}

// from = 0: a rest. to = 0 (or the same as from): a steady tone; otherwise a straight glide.
struct Step { uint16_t from, to, ms; };
// soft: one level quieter than the setting (never silent unless the setting is Off).
struct Tune { const Step *steps; uint8_t count; bool soft; };

namespace tunes {
constexpr Step wake[] = {{800, 1600, 90}, {0, 0, 30}, {1800, 0, 70}};
constexpr Step happy[] = {{1319, 0, 70}, {0, 0, 20}, {1760, 0, 110}};
constexpr Step encourage[] = {{1000, 700, 260}, {0, 0, 70}, {800, 1150, 170}};  // a soft "aww", then a hopeful lift
constexpr Step celebrate[] = {{1047, 0, 90}, {0, 0, 20}, {1319, 0, 90}, {0, 0, 20}, {1568, 0, 90}, {0, 0, 20}, {2093, 0, 260}};
constexpr Step hint[] = {{1200, 0, 60}, {0, 0, 40}, {1300, 2000, 150}};  // "a-ha!"
constexpr Step streak[] = {{1568, 0, 90}, {0, 0, 30}, {1568, 0, 90}, {0, 0, 30}, {2093, 0, 120},
                           {0, 0, 20}, {2637, 0, 120}, {0, 0, 20}, {3136, 0, 280}};
constexpr Step nod[] = {{2400, 0, 20}};  // a tiny tick for every match pair
constexpr Step onFire[] = {{1200, 1700, 50}, {1700, 1200, 50}, {1200, 1700, 50}, {1700, 1200, 50}, {0, 0, 30}, {2093, 0, 180}};
constexpr Step giggle[] = {{1800, 2300, 50}, {0, 0, 30}, {1900, 2400, 50}, {0, 0, 30}, {2000, 2600, 60}};
constexpr Step hug[] = {{700, 850, 140}, {0, 0, 40}, {850, 650, 220}};  // a soft "mmm"
constexpr Step dizzy[] = {{2200, 1400, 150}, {1600, 900, 150}, {1100, 650, 200}};
constexpr Step whee[] = {{700, 2600, 320}};
constexpr Step stir[] = {{700, 0, 120}, {0, 0, 60}, {700, 950, 130}};  // a drowsy "mm-hm?"
}  // namespace tunes

#define MINI_TUNE(name, soft) Tune{tunes::name, uint8_t(sizeof tunes::name / sizeof tunes::name[0]), soft}
inline Tune tune(uint8_t sound) {
  switch (sound) {
    case WAKE: return MINI_TUNE(wake, false);
    case HAPPY: return MINI_TUNE(happy, false);
    case ENCOURAGE: return MINI_TUNE(encourage, true);
    case CELEBRATE: return MINI_TUNE(celebrate, false);
    case HINT: return MINI_TUNE(hint, false);
    case STREAK: return MINI_TUNE(streak, false);
    case NOD: return MINI_TUNE(nod, true);
    case ON_FIRE: return MINI_TUNE(onFire, false);
    case GIGGLE: return MINI_TUNE(giggle, false);
    case HUG: return MINI_TUNE(hug, true);
    case DIZZY: return MINI_TUNE(dizzy, false);
    case WHEE: return MINI_TUNE(whee, false);
    case STIR: return MINI_TUNE(stir, true);
    default: return Tune{nullptr, 0, false};
  }
}
#undef MINI_TUNE

inline uint32_t length(uint8_t sound) {
  const Tune t = tune(sound);
  uint32_t ms = 0;
  for (uint8_t i = 0; i < t.count; i++) ms += t.steps[i].ms;
  return ms;
}

inline uint16_t duty(uint8_t level, bool soft) {
  if (level == OFF || level >= LEVELS) return 0;
  return LEVEL_DUTY[soft && level > QUIET ? level - 1 : level];
}

// What the buzzer should do: hz = 0 or duty = 0 is silence.
struct Output {
  uint16_t hz = 0, duty = 0;
  bool silent() const { return !hz || !duty; }
};

// One sound at a time: a new one replaces the one playing.
class Player {
 public:
  void play(uint8_t sound, uint32_t now) {
    sound_ = sound < SOUNDS ? sound : uint8_t(NONE);
    started_ = now;
  }
  void stop() { sound_ = NONE; }
  uint8_t sound() const { return sound_; }
  bool playing() const { return sound_ != NONE; }

  Output update(uint32_t now, uint8_t level) {
    Output out;
    if (!sound_) return out;
    const Tune t = tune(sound_);
    uint32_t at = now - started_;
    for (uint8_t i = 0; i < t.count; i++) {
      const Step &s = t.steps[i];
      if (at >= s.ms) { at -= s.ms; continue; }
      if (!s.from) return out;  // a rest
      out.hz = s.to && s.to != s.from ? uint16_t(int32_t(s.from) + (int32_t(s.to) - int32_t(s.from)) * int32_t(at) / int32_t(s.ms)) : s.from;
      out.duty = duty(level, t.soft);
      return out;
    }
    sound_ = NONE;  // finished
    return out;
  }

 private:
  uint8_t sound_ = NONE;
  uint32_t started_ = 0;
};

}  // namespace MiniSound
