// Host checks for firmware/PrivetMini_v0.8/MiniSound.h: every sound plays and ends, glides move
// between their pitches, rests are silent, the levels get louder and never pass 50 % duty, Off is
// silent, soft sounds are one level quieter, and a new sound replaces the one playing.
#include <assert.h>
#include <stdio.h>
#include "MiniSound.h"
using namespace MiniSound;

int main() {
  // Levels: Off silent, each level louder than the last, Max at most 50 % (a piezo's loudest).
  assert(duty(OFF, false) == 0 && duty(OFF, true) == 0);
  for (uint8_t level = QUIET; level < LEVELS; level++) {
    assert(duty(level, false) > duty(level - 1, false));
    assert(duty(level, false) <= (1u << DUTY_BITS) / 2);
    // Soft: one level down, but never silent while the sound is on.
    assert(duty(level, true) == (level == QUIET ? duty(QUIET, false) : duty(level - 1, false)));
    assert(duty(level, true) > 0);
  }
  assert(DEFAULT_LEVEL > OFF && DEFAULT_LEVEL < LEVELS);
  assert(duty(LEVELS, false) == 0);

  // Every sound: steps that make sense, under 1.5 s, audible pitches, plays on every 10 ms tick
  // until its length and is silent after.
  for (uint8_t s = NONE + 1; s < SOUNDS; s++) {
    const Tune t = tune(s);
    assert(t.steps && t.count > 0);
    assert(t.steps[0].from != 0);                 // starts with a tone, not a rest
    assert(t.steps[t.count - 1].from != 0);       // ends on a tone
    const uint32_t ms = length(s);
    assert(ms >= 20 && ms <= 1500);
    for (uint8_t i = 0; i < t.count; i++) {
      const Step &st = t.steps[i];
      assert(st.ms > 0);
      if (st.from) assert(st.from >= 500 && st.from <= 3500);
      if (st.to) assert(st.from && st.to >= 500 && st.to <= 3500);
    }
    Player p;
    p.play(s, 1000);
    bool heard = false;
    for (uint32_t at = 0; at < ms; at += 10) {
      const Output o = p.update(1000 + at, MEDIUM);
      if (!o.silent()) {
        heard = true;
        assert(o.hz >= 500 && o.hz <= 3500);
        assert(o.duty == duty(MEDIUM, t.soft));
      }
      assert(p.playing());
    }
    assert(heard);
    assert(p.update(1000 + ms, MEDIUM).silent());
    assert(!p.playing());
    // Off: silent all the way through.
    Player off;
    off.play(s, 0);
    for (uint32_t at = 0; at < ms; at += 10) assert(off.update(at, OFF).silent());
    printf("%-10s %4u ms %s\n", soundName(s), unsigned(ms), t.soft ? "(soft)" : "");
  }

  {  // A glide moves straight from one pitch to the next: whee goes up.
    Player p;
    p.play(WHEE, 0);
    const Step &st = tune(WHEE).steps[0];
    assert(p.update(0, LOUD).hz == st.from);
    const uint16_t mid = p.update(st.ms / 2, LOUD).hz;
    assert(mid > st.from && mid < st.to);
    assert(p.update(st.ms - 1, LOUD).hz < st.to);
    assert(p.update(st.ms - 1, LOUD).hz > mid);
  }
  {  // A rest is silent: happy has a 20 ms gap after its first 70 ms note.
    Player p;
    p.play(HAPPY, 0);
    assert(p.update(0, LOUD).hz == 1319);
    assert(p.update(75, LOUD).silent());
    assert(p.update(95, LOUD).hz == 1760);
  }
  {  // A new sound replaces the one playing; stop silences at once.
    Player p;
    p.play(CELEBRATE, 0);
    assert(p.update(10, LOUD).hz == 1047);
    p.play(NOD, 50);
    assert(p.sound() == NOD && p.update(55, LOUD).hz == 2400);
    assert(p.update(70, LOUD).silent() && !p.playing());
    p.play(STREAK, 100);
    p.stop();
    assert(p.update(110, LOUD).silent() && !p.playing());
  }
  {  // Nothing and unknown sounds stay silent.
    Player p;
    assert(p.update(0, MAX).silent());
    p.play(SOUNDS + 3, 0);
    assert(!p.playing() && p.update(5, MAX).silent());
  }
  // Wrapping millis() does not break a sound in progress.
  {
    Player p;
    p.play(HAPPY, 0xFFFFFFF0u);
    assert(p.update(0xFFFFFFF0u + 30, LOUD).hz == 1319);
  }
  assert(levelName(OFF)[0] == 'O' && levelName(MAX)[0] == 'M' && levelName(LEVELS)[0] == '?');
  printf("mini sound: ok\n");
  return 0;
}
