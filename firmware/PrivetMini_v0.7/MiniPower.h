#pragma once
#include <math.h>
#include <stdint.h>

// When the keychain dims its screen and when it goes to deep sleep. Pure
// logic with no pins or sleep calls, so the host test
// (scripts/test-mini-power.cpp) runs exactly this code.
//
// - "Touch": a button, a shake or a toss, the phone connecting or
//   disconnecting, or a command from the app.
// - "Look": the tilt moving the eyes noticeably (only while connected, the
//   only time the eyes follow the tilt).
// - ACTIVE -> DIM after DIM_AFTER_MS with neither; any touch or look brightens.
// - DEEP SLEEP after SLEEP_AFTER_MS without a touch while no phone is
//   connected (never while connected). Only the right button wakes it.
namespace MiniPower {

enum Stage : uint8_t { ACTIVE, DIM, SLEEP };

constexpr uint32_t DIM_AFTER_MS = 60000;          // 1 min
constexpr uint32_t SLEEP_AFTER_MS = 300000;       // 5 min, no phone
constexpr float LOOK_MOVE = 0.25f;                // look change that counts as use

class Idle {
 public:
  void begin(uint32_t now) { touchAt_ = lookAt_ = now; }
  void touch(uint32_t now) { touchAt_ = lookAt_ = now; }
  // The look target (-1..1 each way); a move of LOOK_MOVE from the last
  // counted position keeps the screen bright.
  void look(float x, float y, uint32_t now) {
    if (fabsf(x - lookX_) < LOOK_MOVE && fabsf(y - lookY_) < LOOK_MOVE) return;
    lookX_ = x; lookY_ = y; lookAt_ = now;
  }
  Stage update(uint32_t now, bool phoneConnected) const {
    if (!phoneConnected && uint32_t(now - touchAt_) >= SLEEP_AFTER_MS) return SLEEP;
    return uint32_t(now - lookAt_) >= DIM_AFTER_MS ? DIM : ACTIVE;
  }

 private:
  uint32_t touchAt_ = 0, lookAt_ = 0;
  float lookX_ = 0, lookY_ = 0;
};

}  // namespace MiniPower
