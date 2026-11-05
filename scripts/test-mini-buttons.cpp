// Host checks for firmware/PrivetMini_v0.6/MiniButtons.h with 10 ms samples:
// contact bounce, short presses, holds, glitches, both buttons held, and
// presses that overlap.
#include <assert.h>
#include <stdio.h>
#include <vector>
#include "MiniButtons.h"
using namespace MiniButtons;

static uint32_t now = 0;
static std::vector<Event> events;

// Holds the given levels for `ms`, sampling every 10 ms.
static void hold(Reader &r, bool left, bool right, uint32_t ms) {
  for (uint32_t t = 0; t < ms; t += 10, now += 10) {
    const Event e = r.update(left, right, now);
    if (e != NONE) events.push_back(e);
  }
}
// One button pressed for `ms`, with contact bounce at both ends.
static void press(Reader &r, bool left, uint32_t ms) {
  for (int i = 0; i < 3; i++) { hold(r, left, !left, 10); hold(r, false, false, 10); }
  hold(r, left, !left, ms);
  for (int i = 0; i < 2; i++) { hold(r, false, false, 10); hold(r, left, !left, 10); }
  hold(r, false, false, 200);
}
static void expect(std::initializer_list<Event> want, const char *what) {
  if (std::vector<Event>(want) != events) {
    fprintf(stderr, "%s: got", what);
    for (Event e : events) fprintf(stderr, " %d", int(e));
    fprintf(stderr, "\n");
    assert(false);
  }
  events.clear();
}

int main() {
  Reader r;
  hold(r, false, false, 500);
  expect({}, "idle");
  press(r, true, 150); expect({LEFT_SHORT}, "left short");
  press(r, false, 150); expect({RIGHT_SHORT}, "right short");
  press(r, true, 1500); expect({LEFT_HOLD, LEFT_RELEASE}, "left hold");
  press(r, false, 900); expect({RIGHT_HOLD, RIGHT_RELEASE}, "right hold");
  {  // HOLD comes while still held, not on release.
    hold(r, true, false, 700); expect({LEFT_HOLD}, "hold reported at once");
    hold(r, false, false, 200); expect({LEFT_RELEASE}, "then its release");
  }
  hold(r, true, false, 20); hold(r, false, false, 200); expect({}, "a 20 ms glitch");
  {  // Both held for 2 s: one BOTH_HELD while still held, nothing on release.
    hold(r, true, false, 100); hold(r, true, true, 1900); expect({}, "both, not yet 2 s");
    hold(r, true, true, 3000); expect({BOTH_HELD}, "both held");
    hold(r, false, true, 900); hold(r, false, false, 200); expect({}, "releasing both, one slowly");
  }
  {  // Both pressed briefly: no event at all, not even a short press.
    hold(r, true, true, 300); hold(r, true, false, 100); hold(r, false, false, 200); expect({}, "brief chord");
  }
  {  // A hug (left hold) that turns into both held: the hug is released first.
    hold(r, true, false, 800); expect({LEFT_HOLD}, "hug starts");
    hold(r, true, true, 2100); expect({LEFT_RELEASE, BOTH_HELD}, "chord ends the hug");
    hold(r, false, false, 200); expect({}, "release after the chord");
  }
  {  // After a chord, single presses work again.
    press(r, true, 150); expect({LEFT_SHORT}, "short after a chord");
  }
  {  // The right button pressed as the left is released: both count.
    hold(r, true, false, 200); hold(r, false, true, 150); hold(r, false, false, 200);
    expect({LEFT_SHORT, RIGHT_SHORT}, "hand-over");
  }
  {  // The clock wrapping around does not break the timing.
    now = 0xFFFFFF00U;
    press(r, true, 900); expect({LEFT_HOLD, LEFT_RELEASE}, "hold across the wrap");
  }
  puts("buttons ok");
  return 0;
}
