#pragma once
#include <stdint.h>

// The Mini's two buttons: debounce, short presses, holds and both held.
// Pure logic with no pins, so the host test (scripts/test-mini-buttons.cpp)
// runs exactly this code. Feed it the pressed state of each button about
// every 10 ms; it returns at most one event per call.
//
// - A press released before HOLD_MS is a SHORT (reported on release).
// - A press that reaches HOLD_MS reports HOLD at once, and RELEASE when it ends.
// - Once both buttons are down together, neither reports SHORT; a running
//   HOLD gets its RELEASE right away. Both held for BOTH_MS: BOTH_HELD, once.
namespace MiniButtons {

enum Event : uint8_t { NONE, LEFT_SHORT, LEFT_HOLD, LEFT_RELEASE, RIGHT_SHORT, RIGHT_HOLD, RIGHT_RELEASE, BOTH_HELD };

constexpr uint32_t DEBOUNCE_MS = 30;  // a level must hold this long to count
constexpr uint32_t HOLD_MS = 600;     // pressed this long: a hold
constexpr uint32_t BOTH_MS = 2000;    // both held this long: BOTH_HELD

class Reader {
 public:
  Event update(bool leftDown, bool rightDown, uint32_t now) {
    const bool leftChanged = left_.debounce(leftDown, now), rightChanged = right_.debounce(rightDown, now);
    if (left_.down && right_.down) {
      if (!chord_) {
        chord_ = true;
        bothSince_ = now;
        if (left_.holding) { left_.holding = false; push(LEFT_RELEASE); }
        if (right_.holding) { right_.holding = false; push(RIGHT_RELEASE); }
      }
      if (!bothFired_ && uint32_t(now - bothSince_) >= BOTH_MS) { bothFired_ = true; push(BOTH_HELD); }
    } else if (chord_) {
      if (!left_.down && !right_.down) { chord_ = false; bothFired_ = false; }
    } else {
      side(left_, leftChanged, now, LEFT_SHORT, LEFT_HOLD, LEFT_RELEASE);
      side(right_, rightChanged, now, RIGHT_SHORT, RIGHT_HOLD, RIGHT_RELEASE);
    }
    if (!queued_) return NONE;
    const Event e = queue_[0];
    for (uint8_t i = 1; i < queued_; i++) queue_[i - 1] = queue_[i];
    queued_--;
    return e;
  }

 private:
  struct Button {
    bool raw = false, down = false, holding = false;
    uint32_t changedAt = 0, downAt = 0;
    // True when the debounced state changes.
    bool debounce(bool level, uint32_t now) {
      if (level != raw) { raw = level; changedAt = now; }
      if (raw == down || uint32_t(now - changedAt) < DEBOUNCE_MS) return false;
      down = raw;
      if (down) downAt = changedAt;
      return true;
    }
  };
  void side(Button &b, bool changed, uint32_t now, Event shortPress, Event hold, Event release) {
    if (b.down && !b.holding && uint32_t(now - b.downAt) >= HOLD_MS) { b.holding = true; push(hold); }
    if (changed && !b.down) {
      if (b.holding) { b.holding = false; push(release); }
      else push(shortPress);
    }
  }
  void push(Event e) { if (queued_ < 4) queue_[queued_++] = e; }

  Button left_, right_;
  bool chord_ = false, bothFired_ = false;
  uint32_t bothSince_ = 0;
  Event queue_[4] = {};
  uint8_t queued_ = 0;
};

}  // namespace MiniButtons
