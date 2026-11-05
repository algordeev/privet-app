// Host checks for firmware/PrivetBLE_S3_v5/MotionSense.h with synthetic
// 50 Hz sensor data: resting, lifting and carrying, a steady hand, setting
// down, shaking, tipping over and back, gentle tilts, desk bumps, servo
// vibration and a long quiet run.
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <vector>
#include "MotionSense.h"
using namespace PrivetMotionSense;

static const Vec UP{0, 0, 1}, STILL_GYRO{0.8f, -0.5f, 0.3f};  // a constant gyro bias
static uint32_t now = 0;
static std::vector<Event> events;
static float noise(float amplitude) { return amplitude * float(2.0 * rand() / RAND_MAX - 1.0); }

// Feeds `ms` of samples; `at(t)` gives the acceleration t ms into the step.
template <class F> static void run(Detector &d, uint32_t ms, F at, float gyroDps = 0, bool servo = false) {
  for (uint32_t t = 0; t < ms; t += 20, now += 20) {
    const Vec gyro = STILL_GYRO + Vec{noise(gyroDps), noise(gyroDps), noise(gyroDps)};
    const Event e = d.update(at(t), gyro, now, servo);
    if (e != NONE) events.push_back(e);
  }
}
static Vec resting(uint32_t) { return UP + Vec{noise(.008f), noise(.008f), noise(.008f)}; }
static Vec tilted(float degrees, uint32_t) {
  const float r = degrees * 3.14159265f / 180;
  return Vec{sinf(r), 0, cosf(r)} + Vec{noise(.008f), noise(.008f), noise(.008f)};
}
static size_t count(Event e) { size_t n = 0; for (Event x : events) n += x == e; return n; }
static void expect(std::initializer_list<Event> want, const char *what) {
  if (std::vector<Event>(want) != events) {
    fprintf(stderr, "%s: got", what);
    for (Event e : events) fprintf(stderr, " %d", int(e));
    fprintf(stderr, "\n");
    assert(false);
  }
  events.clear();
}
static Detector calibrated() {
  Detector d(0, 1);
  run(d, 600, resting);
  assert(d.calibrated());
  run(d, 1500, resting);
  expect({}, "resting after calibration");
  return d;
}

int main() {
  srand(7);
  {  // Calibration waits for ~1 g; a robot moving at power-on calibrates later.
    Detector d(0, 1);
    run(d, 400, [](uint32_t t) { return UP * (t % 80 < 40 ? 1.6f : 0.4f); });
    assert(!d.calibrated());
    run(d, 600, resting);
    assert(d.calibrated());
    expect({}, "calibration");
  }
  {  // Lift, carry with hand jitter, a steady hand, then set down with a landing bump.
    Detector d = calibrated();
    run(d, 60, [](uint32_t) { return UP * 1.35f; });
    expect({PICKED_UP}, "lift");
    assert(d.held());
    run(d, 2000, [](uint32_t) { return UP + Vec{noise(.06f), noise(.06f), noise(.06f)}; }, 15);
    run(d, 4000, [](uint32_t) { return UP + Vec{noise(.02f), noise(.02f), noise(.02f)}; }, 6);
    expect({}, "carried and held steadily: still held");
    assert(d.held());
    run(d, 40, [](uint32_t) { return UP * 1.45f; });
    run(d, 1400, resting);
    expect({}, "landing bump is no new lift; not yet still long enough");
    run(d, 300, resting);
    expect({PUT_DOWN}, "set down");
    assert(!d.held());
  }
  {  // A single desk bump, or the head's servos moving, is no lift.
    Detector d = calibrated();
    run(d, 20, [](uint32_t) { return UP * 1.5f; });
    run(d, 1500, resting);
    run(d, 400, [](uint32_t t) { return UP * (t % 40 ? 1.3f : 0.8f); }, 2, true);
    run(d, 200, resting);
    expect({}, "bump and servo vibration");
  }
  {  // Shaking in the hand: one shake per gap, however long it goes on.
    Detector d = calibrated();
    run(d, 1000, [](uint32_t t) { return UP + Vec{t % 120 < 60 ? 1.2f : -1.2f, 0, 0}; }, 200);
    expect({SHAKEN}, "shake");
    run(d, 1000, [](uint32_t t) { return UP + Vec{t % 120 < 60 ? 1.2f : -1.2f, 0, 0}; }, 200);
    expect({}, "same shake within the gap");
    run(d, 3000, resting);
    run(d, 1000, [](uint32_t t) { return UP + Vec{0, t % 120 < 60 ? 1.2f : -1.2f, 0}; }, 200);
    expect({SHAKEN}, "a new shake after the gap");
  }
  {  // Tipped onto its side: once, until set upright again.
    Detector d = calibrated();
    run(d, 400, [](uint32_t t) { return tilted(90.0f * t / 400, t); }, 60);
    run(d, 2000, [](uint32_t t) { return tilted(90, t); });
    expect({TIPPED}, "tip over");
    assert(d.tipped() && d.side() == 0);
    run(d, 3000, [](uint32_t t) { return tilted(90, t); });
    expect({}, "lying still");
    run(d, 400, [](uint32_t t) { return tilted(90.0f - 90.0f * t / 400, t); }, 60);
    run(d, 1000, resting);
    expect({UPRIGHT}, "set upright");
    assert(!d.tipped());
  }
  {  // Gentle tilts move the eyes toward the low side; level and small tilts don't.
    Detector d = calibrated();
    assert(d.side() == 0);
    run(d, 600, [](uint32_t t) { return tilted(5, t); });
    assert(d.side() == 0);
    run(d, 800, [](uint32_t t) { return tilted(25, t); });
    const float right = d.side();
    run(d, 800, [](uint32_t t) { return tilted(-25, t); });
    const float left = d.side();
    assert(fabsf(right) > 0.4f && fabsf(left) > 0.4f && right * left < 0);
    run(d, 800, resting);
    assert(d.side() == 0);
    expect({}, "tilts");
    Detector flipped(0, -1);
    run(flipped, 2100, resting);
    run(flipped, 800, [](uint32_t t) { return tilted(25, t); });
    assert(flipped.side() * right < 0);
    Detector vertical(2, 1);  // an axis along "up" can't show left or right
    run(vertical, 2100, resting);
    run(vertical, 800, [](uint32_t t) { return tilted(25, t); });
    assert(vertical.side() == 0);
  }
  {  // Ten quiet minutes with sensor noise and occasional servo moves: no events.
    Detector d = calibrated();
    for (int i = 0; i < 300; i++) {
      run(d, 1500, resting);
      run(d, 500, [](uint32_t) { return UP + Vec{noise(.1f), noise(.1f), noise(.1f)}; }, 3, true);
    }
    expect({}, "quiet run");
    assert(count(PICKED_UP) == 0);
  }
  printf("motion sense ok\n");
  return 0;
}
