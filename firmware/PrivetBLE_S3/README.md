# PrivetBLE_S3: v2 companion firmware for the ESP32-S3

Port of [PrivetBLE_Servo_New_Emotions_v2](../PrivetBLE_Servo_New_Emotions_v2/README.md) to the v2 hardware.
The BLE protocol, device name (`Privet-ESP32`), the nine reactions and the learning cards are unchanged,
so the app connects exactly as before. Two extra reactions, 11 NOD and 12 ON_FIRE, are advertised through
capability bit 8; the app sends them only to firmware that advertises it. The v2 sketch stays untouched in its own folder.

What changed:

- **Board:** ESP32-S3-DevKitC-1 N16R8.
- **Display:** 1.3" SH1106 over SPI instead of the 0.96" SSD1306 over I2C.
- **Head:** pan plus tilt, with a gesture for each emotion. The head rests about 8° up (`TILT_HOME_DEG` in
  `ServoMotion.h`), and vertical moves are large and quick (about 6–12° from rest), since tiny slow steps only
  make loaded servos buzz:

| Reaction | Head |
| --- | --- |
| HAPPY | Lifts and nods "yes, yes!" with a small side wiggle |
| ENCOURAGE | Sympathetic droop to one side, slow lift, one small nod |
| CELEBRATE | Bouncy side-to-side wiggle with up-bobs, then a proud head-up pose |
| THINKING | Still: the head rests (no servo noise while you think) |
| LISTENING | Still: the head rests; the listening face stays exactly as long as the phone speaks |
| HINT | Quick "aha!" perk-up (1.5 s), then the hint card |
| CONNECTED | Wake-up nod |
| NOD (11) | One tiny nod per correct match pair |
| ON_FIRE (12) | Head up with an excited shimmy, plus a flame and the combo ("x3") on the face, for each first try that extends a combo of two or more |
| IDLE | For a minute after the last command, the head follows the eyes' side glances |
| Phone away | The head slowly droops while the face sleeps; the wake-up nod lifts it |

## Setup

- Arduino IDE, **esp32 by Espressif** core 3.x, board **ESP32S3 Dev Module**.
  Set USB CDC On Boot = Enabled, Flash Size = 16MB, PSRAM = OPI PSRAM.
  Partition Scheme = 16M Flash (3MB APP/9.9MB FATFS); the BLE firmware does not fit the default 1.2MB app.
  Plug the cable into the port labelled **USB** (native); with CDC On Boot enabled, Serial only appears there.
- Library: **U8g2**. The servos use the ESP32 core's LEDC PWM directly (no ESP32Servo; see the note in the sketch).
- Serial Monitor: 115200 baud.

## Wiring

| Part | Pin | ESP32-S3 |
| --- | --- | --- |
| OLED | GND | GND |
| OLED | VCC | 3V3 |
| OLED | SCK | GPIO12 |
| OLED | SDA (MOSI) | GPIO11 |
| OLED | RES | GPIO14 |
| OLED | DC | GPIO13 |
| OLED | CS | GPIO10 |
| Pan servo | signal | GPIO4 |
| Tilt servo | signal | GPIO5 |
| Servos | + and − | external ~5V supply, GND shared with the ESP32 |

Put a 1000 µF capacitor across each servo's + and − (stripe to −). Don't power the servos from 3V3.
While USB is plugged in, don't also feed 5V into the DevKitC's 5V pin.

## Tuning

Angles are in degrees (0 = straight ahead, + = head up / turned toward the eyes' look). They are approximate:
the firmware converts them at about 11 µs per degree for an SG90.

In the tuning block at the top of `ServoMotion.h`:

- `TILT_HOME_DEG` (8): how far up the head rests. Tilt gestures are written relative to it, so they move with it.
- `SLEEP_TILT_DEG` (−9): where the head droops while the phone is away.
- `PAN_LIMIT_DEG` (±18), `TILT_MIN_DEG`/`TILT_MAX_DEG` (−18/+20): hard limits nothing can pass. Widen them only if the
  head moves that far freely; a servo pressed against a stop buzzes and heats up. If a setting would push a gesture
  past them, the sketch doesn't compile and the error says which setting to change.
- The gestures themselves: keyframe lists of `{time ms, degrees}`.

Near the top of the servo section in `PrivetBLE_S3.ino`:

- `TILT_INVERTED` (default `true`, matching the owner's head): flip it if the head nods down when it should look up,
  e.g. if it rises when going to sleep.
- `PAN_INVERTED = true` if the head turns away from the side the eyes look to.
- `TILT_ENABLED = false` to test with the pan servo only.
- Use `U8G2_R2` in the `oled` constructor if the face is upside down.
- Speed (°/s) and acceleration (°/s²) come in three styles: `SERVO_PERKY_*` (80, 540) for happy moments,
  `SERVO_SPEED_DEG_S`/`SERVO_ACCEL_DEG_S2` (50, 225) for connecting, and `SERVO_GENTLE_*` (32, 180) for
  encouragement, sleep and settling back to rest. Lower them for calmer motion.
- `IDLE_GLANCE_DEG` (5): how far the head follows the eyes when idle.
- Fit the horns while the servos sit at 0° (1500 µs) after a reset.

## Motion

Each gesture is a path of target pulses. A smooth follower moves the real pulse toward that path with
limited speed and acceleration, braking in time so it never overshoots. A new reaction always starts from
where the head actually is, so interrupting a gesture or switching reactions never snaps or reverses instantly.

The servos are centred once at power-on. Each axis switches its PWM off 0.3 s after it reaches the end of a gesture
and stays still, so idle servos are silent, and switches it back on at the last commanded pulse when the next gesture
moves. Each servo keeps one LEDC channel for the whole run and "off" is duty 0, never a detach: with ESP32Servo,
re-attaching could put both servos on the same MCPWM output, so the tilt copied the pan's pulse and the head
shot to its top position. There is no position feedback: if the head is pushed while PWM is off, it returns to its last position when the
next gesture starts.

Compiles for ESP32S3 Dev Module (Arduino-ESP32 3.3.12) with the settings above and runs on the owner's v2 hardware.
`npm test` runs a host simulation of `ServoMotion.h` (`scripts/test-servo-motion.cpp`): every gesture stays in range,
finishes before its reaction ends, remains visible after smoothing, and returns to the resting pose (sleep rests drooped),
plus 10 minutes of random, often interrupted reactions. It also requires every vertical gesture to move
at least 6° after smoothing.
