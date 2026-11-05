#pragma once
#include <math.h>
#include <stdint.h>

// Motion for the keychain, from MPU6050 accelerometer samples (g) at about 50 Hz.
// Pure logic with no I2C, so the host test (scripts/test-mini-motion.cpp)
// runs exactly this code.
//
// Unlike the desk robot (PrivetBLE_S3_v5/MotionSense.h), the Mini lives in a
// hand or a pocket, so nothing here waits for it to rest on a table:
// - the eyes follow the tilt all the time (look());
// - a shake needs several hard back-and-forth jolts, not one flick;
// - a toss is a short free fall;
// - face down turns the screen off, face up again plays peekaboo.
//
// The MPU6050 lies flat behind the screen, so its Z axis is the screen's
// normal; screenSign = +1 if +Z points out of the screen towards you. "Up" in
// the screen plane is learned while the Mini is held still with the screen
// upright (and can be restored from flash with setUp()).
namespace MiniMotion {

enum Event : uint8_t { NONE, SHAKEN, TOSSED, FACE_DOWN, FACE_UP, LEARNED_UP };

// ---- Tuning (g, ms) ----
// Shake: a "jolt" is the acceleration beyond gravity going over SHAKE_G; each
// jolt must point roughly opposite to the previous one. SHAKE_JOLTS of them,
// each within SHAKE_GAP_MS of the last, make a shake; then nothing for
// SHAKE_COOLDOWN_MS. A swing on the key ring or walking stays far below.
constexpr float SHAKE_G = 1.0f;     // about a 1 cm shake at 5 Hz
constexpr uint8_t SHAKE_JOLTS = 6;  // five reversals, ~0.6 s of shaking
constexpr uint32_t SHAKE_GAP_MS = 350;
constexpr uint32_t SHAKE_COOLDOWN_MS = 2000;
// Toss: under FREE_FALL_G for FREE_FALL_SAMPLES samples in a row (~80 ms),
// not during a shake. A gentle 10 cm toss falls for ~280 ms.
constexpr float FREE_FALL_G = 0.35f;
constexpr uint8_t FREE_FALL_SAMPLES = 4;
constexpr uint32_t TOSS_COOLDOWN_MS = 1500;
// Face down: the screen within ~37° of facing the floor, held fairly still
// (moving less than FACE_DOWN_STILL_G), for FACE_DOWN_MS; face up again past
// ~60° for FACE_UP_MS. Moving it around never turns the screen off.
constexpr float FACE_DOWN_COS = 0.8f;
constexpr float FACE_UP_COS = 0.5f;
constexpr uint32_t FACE_DOWN_MS = 700;
constexpr uint32_t FACE_UP_MS = 300;
constexpr float FACE_DOWN_STILL_G = 0.25f;
// Learning "up": still (within STILL_G of a steady 1 g) for LEARN_SAMPLES
// samples with the screen within ~20° of vertical. At start-up it relearns
// during the first LEARN_WINDOW_MS; without a saved "up" it keeps trying.
constexpr float STILL_G = 0.06f;
constexpr uint8_t LEARN_SAMPLES = 25;
constexpr float UPRIGHT_MAX_NORMAL = 0.34f;
constexpr uint32_t LEARN_WINDOW_MS = 10000;
// Looking: tilts under ~5° (sideways) or ~21° (backwards) are ignored; a
// ~38° sideways tilt or lying on its back is the full look.
constexpr float LOOK_DEAD_X = 0.08f, LOOK_GAIN_X = 1.6f;
constexpr float LOOK_DEAD_Y = 0.1f, LOOK_GAIN_Y = 1.5f;

struct Vec {
  float x, y, z;
  Vec operator+(Vec o) const { return {x + o.x, y + o.y, z + o.z}; }
  Vec operator-(Vec o) const { return {x - o.x, y - o.y, z - o.z}; }
  Vec operator*(float k) const { return {x * k, y * k, z * k}; }
};
inline float dot(Vec a, Vec b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
inline Vec cross(Vec a, Vec b) { return {a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x}; }
inline float length(Vec a) { return sqrtf(dot(a, a)); }
inline Vec unit(Vec a) { const float n = length(a); return n > 1e-6f ? a * (1.0f / n) : Vec{0, 1, 0}; }
inline float clamp1(float v) { return v > 1 ? 1 : v < -1 ? -1 : v; }

class Detector {
 public:
  explicit Detector(int8_t screenSign) : normal_{0, 0, screenSign < 0 ? -1.0f : 1.0f} {}

  // An "up" saved earlier (a unit vector in the screen plane).
  void setUp(Vec up) { up_ = unit(up - normal_ * dot(up, normal_)); hasUp_ = true; }
  bool hasUp() const { return hasUp_; }
  Vec up() const { return up_; }
  bool faceDown() const { return faceDown_; }
  // Where the eyes should look, -1..1: x towards the screen's right (down the
  // slope), y towards the screen's bottom (negative: up). 0, 0 when upright.
  float lookX() const { return lookX_; }
  float lookY() const { return lookY_; }

  Event update(Vec a, uint32_t now) {
    if (!started_) { started_ = true; grav_ = a; }
    grav_ = grav_ + (a - grav_) * 0.15f;  // ~0.13 s low-pass: where gravity is
    const Vec motion = a - grav_;
    const float jolt = length(motion), g = length(a);
    const Vec upNow = unit(grav_);  // the accelerometer reads "up" at rest
    const float facing = dot(upNow, normal_);  // +1 lying on its back, -1 face down

    // Look: down the slope sideways; up when leaning back.
    if (hasUp_) {
      const Vec right = cross(up_, normal_);
      const float side = -dot(upNow, right), upright = dot(upNow, up_);
      lookX_ = shape(side, LOOK_DEAD_X, LOOK_GAIN_X);
      lookY_ = -shape(1 - (upright > 0 ? upright : 0), LOOK_DEAD_Y, LOOK_GAIN_Y);
    }

    // Learn "up" from a still, upright moment.
    const bool still = jolt < STILL_G && fabsf(g - 1) < 0.1f;
    stillCount_ = still ? (stillCount_ < 255 ? stillCount_ + 1 : 255) : 0;
    if ((!hasUp_ || (!learned_ && now < LEARN_WINDOW_MS)) && stillCount_ >= LEARN_SAMPLES && fabsf(facing) < UPRIGHT_MAX_NORMAL) {
      setUp(upNow);
      learned_ = true;
      return LEARNED_UP;
    }

    // Face down / face up, with hold times.
    const bool flipping = faceDown_ ? facing > -FACE_UP_COS : facing < -FACE_DOWN_COS && jolt < FACE_DOWN_STILL_G;
    if (!flipping) flipSince_ = 0;
    else if (!flipSince_) flipSince_ = now ? now : 1;
    else if (uint32_t(now - flipSince_) >= (faceDown_ ? FACE_UP_MS : FACE_DOWN_MS)) {
      flipSince_ = 0;
      faceDown_ = !faceDown_;
      return faceDown_ ? FACE_DOWN : FACE_UP;
    }

    // Shake: alternating hard jolts.
    if (jolts_ && uint32_t(now - joltAt_) > SHAKE_GAP_MS) jolts_ = 0;
    if (jolt > SHAKE_G) {
      const Vec dir = motion * (1.0f / jolt);
      if (!jolts_ || dot(dir, joltDir_) < -0.5f) {
        jolts_++;
        joltDir_ = dir;
        joltAt_ = now;
        // Back and forth, not one push (a toss's fall is one long push).
        if (jolts_ >= 2) shakeActiveAt_ = now ? now : 1;
        if (jolts_ >= SHAKE_JOLTS) {
          jolts_ = 0;
          if (!shook_ || uint32_t(now - shakeAt_) >= SHAKE_COOLDOWN_MS) {
            shook_ = true;
            shakeAt_ = now;
            return SHAKEN;
          }
        }
      } else {
        joltAt_ = now;  // still pushing the same way
      }
    }

    // Toss: a short free fall, not in the middle of a shake.
    const bool shaking = shakeActiveAt_ && uint32_t(now - shakeActiveAt_) < 500;
    fall_ = g < FREE_FALL_G && !shaking ? (fall_ < 255 ? fall_ + 1 : 255) : 0;
    if (fall_ == FREE_FALL_SAMPLES && (!tossed_ || uint32_t(now - tossAt_) >= TOSS_COOLDOWN_MS)) {
      tossed_ = true;
      tossAt_ = now;
      return TOSSED;
    }
    return NONE;
  }

 private:
  static float shape(float v, float dead, float gain) {
    const float m = fabsf(v) - dead;
    if (m <= 0) return 0;
    return clamp1((v < 0 ? -m : m) * gain);
  }

  Vec normal_, up_{0, 1, 0}, grav_{0, 0, 0}, joltDir_{0, 0, 0};
  bool started_ = false, hasUp_ = false, learned_ = false, faceDown_ = false, shook_ = false, tossed_ = false;
  uint8_t stillCount_ = 0, jolts_ = 0, fall_ = 0;
  uint32_t flipSince_ = 0, joltAt_ = 0, shakeActiveAt_ = 0, shakeAt_ = 0, tossAt_ = 0;
  float lookX_ = 0, lookY_ = 0;
};

// The eyes' springy follow: a little overshoot, settles in about half a second.
struct Spring {
  float pos = 0, vel = 0;
  void step(float target, float dt) {
    if (dt > 0.05f) dt = 0.05f;
    vel += ((target - pos) * 160.0f - vel * 14.0f) * dt;
    pos += vel * dt;
  }
};

}  // namespace MiniMotion
