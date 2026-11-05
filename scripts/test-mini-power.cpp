// Host checks for firmware/PrivetMini_v0.6/MiniPower.h: dimming after a
// minute, deep sleep after 5 minutes without a phone (never with one), and
// what counts as use.
#include <assert.h>
#include <stdio.h>
#include "MiniPower.h"
using namespace MiniPower;

int main() {
  {  // Power on, nobody touches it, no phone: bright, then dim, then deep sleep.
    Idle p; p.begin(0);
    assert(p.update(DIM_AFTER_MS - 1, false) == ACTIVE);
    assert(p.update(DIM_AFTER_MS, false) == DIM);
    assert(p.update(SLEEP_AFTER_MS - 1, false) == DIM);
    assert(p.update(SLEEP_AFTER_MS, false) == SLEEP);
  }
  {  // Connected: dims, but never sleeps.
    Idle p; p.begin(0);
    assert(p.update(DIM_AFTER_MS, true) == DIM);
    assert(p.update(SLEEP_AFTER_MS * 10, true) == DIM);
    // The phone goes away (a touch), and the 5 minutes start from there.
    p.touch(SLEEP_AFTER_MS * 10);
    assert(p.update(SLEEP_AFTER_MS * 10 + 1, false) == ACTIVE);
    assert(p.update(SLEEP_AFTER_MS * 11 - 1, false) == DIM);
    assert(p.update(SLEEP_AFTER_MS * 11, false) == SLEEP);
  }
  {  // A touch brightens and restarts both timers.
    Idle p; p.begin(0);
    assert(p.update(90000, false) == DIM);
    p.touch(90000);
    assert(p.update(90001, false) == ACTIVE);
    assert(p.update(90000 + SLEEP_AFTER_MS - 1, false) == DIM);
    assert(p.update(90000 + SLEEP_AFTER_MS, false) == SLEEP);
  }
  {  // Tilting keeps it bright but does not keep it out of deep sleep.
    Idle p; p.begin(0);
    for (uint32_t t = 0; t < SLEEP_AFTER_MS; t += 20000) p.look((t / 20000) % 2 ? -.5f : .5f, 0, t);
    assert(p.update(SLEEP_AFTER_MS - 1, true) == ACTIVE);
    assert(p.update(SLEEP_AFTER_MS, false) == SLEEP);
    // A small wobble of the look is not use.
    Idle q; q.begin(0);
    for (uint32_t t = 0; t < 2 * DIM_AFTER_MS; t += 100) q.look((t / 100) % 2 ? .2f : 0, 0, t);
    assert(q.update(2 * DIM_AFTER_MS, true) == DIM);
  }
  {  // millis() wrapping round does not put it to sleep early.
    Idle p; p.begin(0xFFFFFFFFu - 1000);
    assert(p.update(5000, false) == ACTIVE);
  }
  puts("power ok");
  return 0;
}
