// Host checks for firmware/PrivetMini_v0.6/MiniMotion.h with synthetic 50 Hz
// accelerometer data: learning "up", the eyes following tilts (also in a
// shaky hand), a swing on the key ring, walking, single flicks, a real shake,
// and a toss. The sensor's +Z points out of the screen.
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <vector>
#include "MiniMotion.h"
using namespace MiniMotion;

static uint32_t now = 0;
static std::vector<Event> events;
// Our own generator, so the noise (and the results) are the same with every C library: rand() differs
// between macOS and Linux.
static uint32_t seed = 11;
static float noise(float amplitude) {
  seed = seed * 1664525u + 1013904223u;
  return amplitude * (float(seed >> 8) / 8388608.0f - 1.0f);
}
static const float PI_F = 3.14159265f;

// The accelerometer's "up" reading for a pose: upright with the screen facing
// you is +Y; roll turns the right side down, pitch leans the top back.
static Vec pose(float rollDeg, float pitchDeg) {
  const float r = rollDeg * PI_F / 180, p = pitchDeg * PI_F / 180;
  return Vec{-sinf(r) * cosf(p), cosf(r) * cosf(p), sinf(p)};
}
template <class F> static void run(Detector &d, uint32_t ms, F at) {
  for (uint32_t t = 0; t < ms; t += 20, now += 20) {
    const Event e = d.update(at(t), now);
    if (e != NONE) events.push_back(e);
  }
}
static Vec held(Vec up, uint32_t) { return up + Vec{noise(.02f), noise(.02f), noise(.02f)}; }  // a steady hand
static void expect(std::initializer_list<Event> want, const char *what) {
  if (std::vector<Event>(want) != events) {
    fprintf(stderr, "%s: got", what);
    for (Event e : events) fprintf(stderr, " %d", int(e));
    fprintf(stderr, "\n");
    assert(false);
  }
  events.clear();
}
static void near(float value, float want, float tolerance, const char *what) {
  if (fabsf(value - want) > tolerance) { fprintf(stderr, "%s: %.3f, want %.3f\n", what, value, want); assert(false); }
}

int main() {
  Detector d(1);
  {  // Lying flat at power-on: no "up" yet, and no look.
    run(d, 1000, [](uint32_t t) { return held(pose(0, 90), t); });
    assert(!d.hasUp());
    expect({}, "flat at start");
  }
  {  // Held upright and still: learns "up" once.
    run(d, 1500, [](uint32_t t) { return held(pose(0, 0), t); });
    expect({LEARNED_UP}, "learning up");
    assert(d.hasUp());
    near(d.up().y, 1, .02f, "up is +Y");
    near(d.lookX(), 0, .01f, "upright: x");
    near(d.lookY(), 0, .01f, "upright: y");
  }
  {  // Tilts: right side down -> look right; left -> left; small tilts ignored.
    run(d, 600, [](uint32_t t) { return held(pose(30, 0), t); });
    // A sideways tilt lowers the upright reading a little (cos 30° = 0.87), so the eyes rise by about
    // 0.05 of their range: under one pixel (LOOK_MAX_UP_PX is 8), never a visible look up.
    assert(d.lookX() > .5f && fabsf(d.lookY()) < .1f);
    run(d, 600, [](uint32_t t) { return held(pose(-30, 0), t); });
    assert(d.lookX() < -.5f);
    run(d, 600, [](uint32_t t) { return held(pose(4, 0), t); });
    near(d.lookX(), 0, .01f, "4 degrees is level");
    run(d, 600, [](uint32_t t) { return held(pose(60, 0), t); });
    near(d.lookX(), 1, .01f, "60 degrees: full look");
    expect({}, "tilting");
  }
  {  // Leaning back: eyes look up; lying on its back: fully up, centred.
    run(d, 600, [](uint32_t t) { return held(pose(0, 45), t); });
    assert(d.lookY() < -.2f && d.lookY() > -.6f);
    run(d, 600, [](uint32_t t) { return held(pose(0, 90), t); });
    near(d.lookY(), -1, .01f, "on its back: y");
    near(d.lookX(), 0, .05f, "on its back: x");
    expect({}, "leaning back");
  }
  {  // A swing on the key ring (big, slow) and walking: nothing.
    run(d, 4000, [](uint32_t t) { const float s = sinf(t * 2 * PI_F / 700); return pose(35 * s, 0) * (1 + .5f * s * s) + Vec{0, 0, .3f * s}; });
    run(d, 4000, [](uint32_t t) { return pose(0, 0) + Vec{noise(.05f), .4f * sinf(t * 2 * PI_F / 550), .2f * sinf(t * 2 * PI_F / 1100)}; });
    expect({}, "swinging and walking");
  }
  {  // Single flicks of the wrist, a few seconds apart: nothing.
    for (int i = 0; i < 4; i++) {
      run(d, 60, [](uint32_t) { return pose(0, 0) + Vec{3.5f, 0, 0}; });
      run(d, 60, [](uint32_t) { return pose(0, 0) + Vec{-1.0f, 0, 0}; });
      run(d, 1500, [](uint32_t t) { return held(pose(0, 0), t); });
    }
    expect({}, "single flicks");
  }
  {  // A small wobble (0.7 g peaks, 5 Hz) for 2 s: nothing.
    run(d, 2000, [](uint32_t t) { return pose(0, 0) + Vec{0.7f * sinf(t * 2 * PI_F / 200), 0, 0}; });
    run(d, 1000, [](uint32_t t) { return held(pose(0, 0), t); });
    expect({}, "gentle wobble");
  }
  {  // A real shake, about 5 Hz at 3 g, for 1.5 s: exactly one SHAKEN, no toss.
    run(d, 1500, [](uint32_t t) { return pose(0, 0) + Vec{3.0f * sinf(t * 2 * PI_F / 200), noise(.2f), noise(.2f)}; });
    run(d, 1000, [](uint32_t t) { return held(pose(0, 0), t); });
    expect({SHAKEN}, "real shake");
    // A moderate shake (1.5 g, 5 Hz, 1 s) also counts.
    now += 3000;
    run(d, 1000, [](uint32_t t) { return pose(0, 0) + Vec{1.5f * sinf(t * 2 * PI_F / 200), 0, 0}; });
    run(d, 1000, [](uint32_t t) { return held(pose(0, 0), t); });
    expect({SHAKEN}, "moderate shake");
    // Shaking on and off for a while: at most one per cooldown.
    run(d, 4000, [](uint32_t t) { return pose(0, 0) + Vec{0, 3.0f * sinf(t * 2 * PI_F / 180), 0}; });
    run(d, 1000, [](uint32_t t) { return held(pose(0, 0), t); });
    assert(events.size() == 2);
    events.clear();
  }
  {  // A toss: push up, 280 ms of free fall, a catch. Then a short dip: nothing.
    run(d, 100, [](uint32_t) { return pose(0, 0) * 1.8f; });
    run(d, 280, [](uint32_t) { return Vec{noise(.05f), noise(.05f), noise(.05f)}; });
    run(d, 80, [](uint32_t) { return pose(0, 0) * 2.2f; });
    run(d, 1500, [](uint32_t t) { return held(pose(0, 0), t); });
    expect({TOSSED}, "toss");
    run(d, 40, [](uint32_t) { return pose(0, 0) * 0.2f; });
    run(d, 1500, [](uint32_t t) { return held(pose(0, 0), t); });
    expect({}, "a 40 ms dip is not a toss");
  }
  {  // Face down, still or waved about upside down: no event.
    run(d, 1500, [](uint32_t t) { return held(pose(0, -90), t); });
    run(d, 2000, [](uint32_t t) { return pose(0, -90) + Vec{.6f * sinf(t * 2 * PI_F / 400), .6f * cosf(t * 2 * PI_F / 400), 0}; });
    run(d, 1500, [](uint32_t t) { return held(pose(0, 0), t); });
    expect({}, "face down");
  }
  {  // A saved "up" is used at once; within the first 10 s it is relearned once.
    now = 0;
    Detector e(1);
    e.setUp({1, 0, .2f});
    assert(e.hasUp());
    near(e.up().x, 1, .001f, "saved up");
    run(e, 1500, [](uint32_t t) { return held(pose(0, 0), t); });
    expect({LEARNED_UP}, "relearn after start-up");
    now = 20000;
    run(e, 1500, [](uint32_t t) { return held(pose(20, 0), t); });
    expect({}, "no relearning later");
  }
  {  // The other screen sign mirrors left and right.
    now = 0;
    Detector e(1), f(-1);
    run(e, 1500, [](uint32_t t) { return held(pose(0, 0), t); });
    run(e, 1000, [](uint32_t t) { return held(pose(25, 0), t); });
    now = 0;
    run(f, 1500, [](uint32_t t) { return held(pose(0, 0), t); });
    run(f, 1000, [](uint32_t t) { return held(pose(25, 0), t); });
    events.clear();
    assert(fabsf(e.lookX()) > .3f);
    // Each detector sees its own hand noise, so allow for that (about 0.03 apart at most).
    near(f.lookX(), -e.lookX(), .05f, "sign -1 mirrors x");
  }
  {  // The spring settles on its target with a small overshoot.
    Spring s;
    float peak = 0;
    for (int i = 0; i < 60; i++) { s.step(10, .033f); peak = s.pos > peak ? s.pos : peak; }
    assert(peak > 10.2f && peak < 13);
    near(s.pos, 10, .2f, "spring settles");
  }
  puts("motion ok");
  return 0;
}
