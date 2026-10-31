# PrivetBLE_S3_v4: the ESP32-S3 companion with sound

[PrivetBLE_S3](../PrivetBLE_S3/README.md) plus a DFPlayer Mini that plays a short sound for each reaction.
Everything else is unchanged: device name (`Privet-ESP32`), reactions 1–9, 11 NOD and 12 ON_FIRE, learning cards,
faces and servo motion. The firmware picks the sound from the reaction. The only protocol addition is control code
13 `SET_VOLUME` for the app's volume setting (below). PrivetBLE_S3 stays untouched in its own folder.

## Sound

| Reaction | File | Sound |
| --- | --- | --- |
| CONNECTED | 0012 | Wake-up chirp |
| HAPPY | 0004 | Happy chirp |
| ENCOURAGE | 0005 | Soft "aww" with a hopeful lift |
| CELEBRATE | 0006 | Jingle |
| HINT | 0007 | "Aha!" |
| STREAK | 0008 | Fanfare |
| NOD | 0009 | Tiny tick |
| ON_FIRE | 0010 | Excited warble and chime |
| LISTENING, THINKING, IDLE | — | Silent |

The files are the robot sounds from [firmware/sounds](../sounds/README.md). To change the mapping, edit
`REACTION_SOUNDS` near the top of `PrivetBLE_S3_v4.ino`; a reaction left out of the table is silent.

Behaviour:

- **LISTENING** stops any robot sound at once: the phone is about to speak a Russian word.
- **No sound while the phone is away** or the face is asleep; a sound still playing stops when the face falls asleep.
- A new reaction's sound replaces the one playing, but no sooner than **250 ms** (`SOUND_COOLDOWN_MS`) after the last
  one started. A request inside that window waits for it, and the latest one wins, so a NOD for every match pair
  doesn't stutter. A silent reaction (THINKING, IDLE) cancels a waiting sound but lets a playing one finish.
- The DFPlayer is driven only from `loop()`, like the servos and display; BLE callbacks never touch it. It runs
  without ACKs, so no command waits for a reply (the library pauses 10 ms after sending each one).
- At start-up the sketch starts BLE first, then waits until 1.5 s after power-on (`SOUND_POWER_UP_MS`) and resets the
  DFPlayer. If the module doesn't answer or has no readable SD card, it prints one `[SOUND]` line and carries on with
  sound disabled. This check takes up to about 4 s with the module missing, about 2–3 s otherwise.
- Serial (115200) logs each track: `[SOUND] Playing /mp3/0004.mp3.`, `Finished`, `Stopped` and DFPlayer errors
  (error 6 means the file isn't in `/mp3`).

**Volume:** chosen in the app, on the companion settings screen under **Robot sound**: Off, Quiet, Medium, Loud or
Max. The row appears only while a robot with working sound is connected. Each pick plays the happy chirp (0004) at
the new level. The app sends the level with control code 13 `SET_VOLUME` (capability bit 16; see
[docs/companion-ble.md](../../docs/companion-ble.md)); it never changes the face or the head. The robot saves it in
flash (NVS, namespace `privet-sound`), so it survives power-off and the wake-up chirp already uses it.

The levels map to DFPlayer volumes in `SOUND_LEVEL_VOLUMES` near the top of the sketch: 0, 8, 13, 18 and 22 out of
30, default Loud (18). The speaker is only 0.5 W, so the sketch refuses to compile with any volume above 22.
The sound check at start-up runs after BLE starts: a phone that connects within those first seconds gets no volume
control until it reconnects.

## SD card

1. Format it as **FAT32** (32 GB or smaller works best).
2. Copy `firmware/sounds/sd/mp3` to the card's root, so the files are `/mp3/0001.mp3`, `/mp3/0002.mp3`, …
   A name may follow the number (`0004_happy.mp3`); the DFPlayer reads only the number.
3. On a Mac, remove the hidden `._` files before ejecting: `dot_clean -m /Volumes/<CARD>`.

The sketch plays files with `playMp3Folder(n)`, which finds them by name. `play(n)` would use the order the files
were copied instead.

## Hardware and head (as in PrivetBLE_S3)

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
- Libraries: **U8g2** and **DFRobotDFPlayerMini**. The servos use the ESP32 core's LEDC PWM directly (no ESP32Servo; see the note in the sketch).
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
| DFPlayer | VCC / GND | 5V rail / GND |
| DFPlayer | RX | GPIO17 (ESP32 TX), through ~1 kΩ (3 × 330 Ω in series) |
| DFPlayer | TX | GPIO18 (ESP32 RX) |
| DFPlayer | BUSY | GPIO16 (LOW while playing) |
| DFPlayer | SPK1 / SPK2 | 0.5 W 8 Ω speaker |

The DFPlayer runs on UART1 at 9600 baud. Reserved for later, so keep them free: NeoPixel 15, MPU6050 SDA 8 / SCL 9 /
INT 7, encoder 39/40/41, button 42, battery sense 1.

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

Compiles for ESP32S3 Dev Module (Arduino-ESP32 3.3.12, DFRobotDFPlayerMini 1.0.6) with the settings above:
669,602 bytes of program storage (21%), 33,348 bytes of global variables (10%). The owner has tested the reaction
sounds on the v2 hardware; the app volume setting (code 13) is not yet tested on hardware.
`ServoMotion.h` is an unchanged copy of PrivetBLE_S3's, which `npm test` checks in a host simulation
(`scripts/test-servo-motion.cpp`): every gesture stays in range,
finishes before its reaction ends, remains visible after smoothing, and returns to the resting pose (sleep rests drooped),
plus 10 minutes of random, often interrupted reactions. It also requires every vertical gesture to move
at least 6° after smoothing.
