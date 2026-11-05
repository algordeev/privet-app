#pragma once
#include <math.h>
#include <stdint.h>

// Motion detection for the MPU6050 in the robot's base, from accelerometer (g)
// and gyroscope (degrees/s) samples at about 50 Hz. Pure logic with no I2C, so the host test
// (scripts/test-motion-sense.cpp) runs exactly this code.
namespace PrivetMotionSense {

enum Event : uint8_t { NONE, PICKED_UP, PUT_DOWN, SHAKEN, TIPPED, UPRIGHT };

// ---- Tuning (g and ms) ----
// A lift is an upward push above LIFT_G for LIFT_SAMPLES samples in a row,
// starting from at least REST_BEFORE_LIFT_MS of rest; a single bump of the
// desk is too short, and landing after being carried isn't "rest".
constexpr float LIFT_G = 1.2f;
constexpr uint8_t LIFT_SAMPLES = 2;
constexpr uint32_t REST_BEFORE_LIFT_MS = 1000;
// Still: moving less than STILL_G and turning less than STILL_DPS. The gyro
// tells a steady hand (a few degrees/s of tremor) from the desk. Held, still
// and upright this long means it was put down.
constexpr float STILL_G = 0.05f;
constexpr float STILL_DPS = 4.0f;
constexpr uint32_t PUT_DOWN_STILL_MS = 1500;
// Shaking: a decaying score of samples moving harder than SHAKE_G; above
// SHAKE_SCORE (about half of the last ~half second) it is a shake, at most once
// per SHAKE_GAP_MS.
constexpr float SHAKE_G = 0.6f;
constexpr float SHAKE_SCORE = 5.0f;
constexpr uint32_t SHAKE_GAP_MS = 3000;
// Orientation, as the cosine of the angle from upright: tipped beyond 60°,
// upright again within 30°, each held for TIP_HOLD_MS.
constexpr float TIPPED_COS = 0.5f;
constexpr float UPRIGHT_COS = 0.866f;
constexpr uint32_t TIP_HOLD_MS = 600;
// Gentle tilts between 12° and 45° move the eyes; smaller ones are just the desk.
constexpr float TILT_MIN_COS = 0.978f;
constexpr float TILT_MAX_SIN = 0.707f;
// Head servos shake the base a little: no lift while they move and this long after.
constexpr uint32_t SERVO_SETTLE_MS = 300;
// Upright reference and gyro bias: the average of this many samples near 1 g at start-up.
constexpr uint8_t CALIBRATION_SAMPLES = 25;

struct Vec {
  float x, y, z;
  Vec operator+(Vec o) const { return {x + o.x, y + o.y, z + o.z}; }
  Vec operator-(Vec o) const { return {x - o.x, y - o.y, z - o.z}; }
  Vec operator*(float k) const { return {x * k, y * k, z * k}; }
};
inline float dot(Vec a, Vec b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
inline float length(Vec a) { return sqrtf(dot(a, a)); }
inline Vec unit(Vec a) { const float n = length(a); return n > 1e-6f ? a * (1.0f / n) : Vec{0, 0, 1}; }

class Detector {
 public:
  // sideAxis: the sensor axis (0 x, 1 y, 2 z) that points to the screen's
  // right as you face the robot; sideSign flips it. Only the tilt peek uses it.
  Detector(uint8_t sideAxis, int8_t sideSign) : sideAxis_(sideAxis), sideSign_(sideSign) {}

  bool calibrated() const { return calibrated_; }
  bool held() const { return held_; }
  bool tipped() const { return tipped_; }
  // How far the robot leans toward the screen's right (+) or left (-), -1..1,
  // during a gentle tilt; 0 when level, held, tipped or moving.
  float side() const { return side_; }

  Event update(Vec a, Vec gyro, uint32_t now, bool servoBusy) {
    if (!calibrated_) return calibrate(a, gyro, now);
    const float turning = length(gyro - gyroBias_);

    grav_ = grav_ + (a - grav_) * 0.1f;  // ~0.2 s low-pass: the gravity direction
    const Vec g = unit(grav_);
    const float moving = length(a - grav_);
    const float cosUp = dot(g, up_);

    if (servoBusy) servoAt_ = now;
    const bool quiet = !servoBusy && uint32_t(now - servoAt_) >= SERVO_SETTLE_MS;
    const bool wasResting = uint32_t(now - stillSince_) >= REST_BEFORE_LIFT_MS;
    if (moving >= STILL_G || turning >= STILL_DPS) stillSince_ = now;
    const bool still = uint32_t(now - stillSince_) >= PUT_DOWN_STILL_MS;

    side_ = 0;
    if (!held_ && !tipped_ && sideValid_ && moving < 0.15f && cosUp < TILT_MIN_COS) {
      const float s = dot(g, side_axis_) / TILT_MAX_SIN;
      side_ = s > 1 ? 1 : s < -1 ? -1 : s;
    }

    // Orientation first: it outlasts every other state.
    const bool flipping = tipped_ ? cosUp > UPRIGHT_COS : cosUp < TIPPED_COS;
    if (!flipping) orientSince_ = 0;
    else if (!orientSince_) orientSince_ = now ? now : 1;
    else if (uint32_t(now - orientSince_) >= TIP_HOLD_MS) {
      orientSince_ = 0;
      tipped_ = !tipped_;
      held_ = false;
      liftCount_ = 0;
      return tipped_ ? TIPPED : UPRIGHT;
    }

    shake_ = shake_ * 0.9f + (moving > SHAKE_G ? 1.0f : 0.0f);
    if (shake_ > SHAKE_SCORE && (!shook_ || uint32_t(now - shakeAt_) >= SHAKE_GAP_MS)) {
      shook_ = true;
      shakeAt_ = now;
      return SHAKEN;
    }

    if (!held_ && !tipped_ && quiet && dot(a, up_) > LIFT_G && (liftCount_ || wasResting)) {
      if (++liftCount_ >= LIFT_SAMPLES) {
        liftCount_ = 0;
        held_ = true;
        return PICKED_UP;
      }
    } else {
      liftCount_ = 0;
    }

    if (held_ && still && cosUp > UPRIGHT_COS) {
      held_ = false;
      return PUT_DOWN;
    }
    return NONE;
  }

 private:
  Event calibrate(Vec a, Vec gyro, uint32_t now) {
    const float g = length(a);
    if (g < 0.8f || g > 1.2f) {
      sum_ = gyroSum_ = {0, 0, 0};
      count_ = 0;
      return NONE;
    }
    sum_ = sum_ + a;
    gyroSum_ = gyroSum_ + gyro;
    if (++count_ < CALIBRATION_SAMPLES) return NONE;
    grav_ = sum_ * (1.0f / count_);
    gyroBias_ = gyroSum_ * (1.0f / count_);
    up_ = unit(grav_);
    // The configured side axis, made perpendicular to "up".
    Vec axis{0, 0, 0};
    (sideAxis_ == 0 ? axis.x : sideAxis_ == 1 ? axis.y : axis.z) = sideSign_ < 0 ? -1.0f : 1.0f;
    const Vec flat = axis - up_ * dot(axis, up_);
    sideValid_ = length(flat) > 0.5f;
    // Leaning right brings the reading's "up" toward the left, hence the minus.
    side_axis_ = unit(flat) * -1.0f;
    stillSince_ = now;
    calibrated_ = true;
    return NONE;
  }

  uint8_t sideAxis_;
  int8_t sideSign_;
  bool calibrated_ = false, sideValid_ = false, held_ = false, tipped_ = false, shook_ = false;
  Vec sum_{0, 0, 0}, gyroSum_{0, 0, 0}, gyroBias_{0, 0, 0}, grav_{0, 0, 1}, up_{0, 0, 1}, side_axis_{1, 0, 0};
  uint8_t count_ = 0, liftCount_ = 0;
  uint32_t stillSince_ = 0, orientSince_ = 0, shakeAt_ = 0, servoAt_ = 0;
  float shake_ = 0, side_ = 0;
};

}  // namespace PrivetMotionSense
