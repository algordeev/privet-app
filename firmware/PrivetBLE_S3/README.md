# PrivetBLE_S3: v2 companion firmware for the ESP32-S3

Port of [PrivetBLE_Servo_New_Emotions_v2](../PrivetBLE_Servo_New_Emotions_v2/README.md) to the v2 hardware.
The BLE protocol, device name (`Privet-ESP32`), the nine reactions and the learning cards are unchanged,
so the app connects exactly as before. The v2 sketch stays untouched in its own folder.

What changed:

- **Board:** ESP32-S3-DevKitC-1 N16R8.
- **Display:** 1.3" SH1106 over SPI instead of the 0.96" SSD1306 over I2C.
- **Head:** pan plus tilt. Pan keeps the original gestures. Tilt adds small nods: up for happy, celebrate,
  streak and hint, a gentle droop for encourage, and a "wake up" nod on connect.
  THINKING and LISTENING stay servo-quiet, as before.

## Setup

- Arduino IDE, **esp32 by Espressif** core 3.x, board **ESP32S3 Dev Module**.
  Set USB CDC On Boot = Enabled, Flash Size = 16MB, PSRAM = OPI PSRAM.
  Partition Scheme = 16M Flash (3MB APP/9.9MB FATFS); the BLE firmware does not fit the default 1.2MB app.
  Plug the cable into the port labelled **USB** (native); with CDC On Boot enabled, Serial only appears there.
- Libraries: **U8g2** and **ESP32Servo**.
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

These are constants near the top of the servo section in `PrivetBLE_S3.ino`:

- `TILT_INVERTED = true` if the head nods down when it should look up.
- `TILT_ENABLED = false` to test with the pan servo only.
- Use `U8G2_R2` in the `oled` constructor if the face is upside down.
- `SERVO_SPEED_US_S` (default 450) and `SERVO_ACCEL_US_S2` (default 1800) set how fast and how softly the head moves.
  About 10 µs is 1°. Lower them for calmer motion.
- Pulse limits are unchanged: 1300–1700 µs, centre 1500 µs.
  Fit the horns while the servos sit at centre after a reset.

## Motion

Each gesture is a path of target pulses. A smooth follower moves the real pulse toward that path with
limited speed and acceleration, braking in time so it never overshoots. A new reaction always starts from
where the head actually is, so interrupting a gesture or switching reactions never snaps or reverses instantly.

The servos are centred once at power-on. Each axis switches its PWM off 0.3 s after it reaches the end of a gesture
and stays still, so idle servos are silent, and switches it back on at the last commanded pulse when the next gesture
moves. There is no position feedback: if the head is pushed while PWM is off, it returns to its last position when the
next gesture starts.

Not yet compiled or run on hardware: the session that wrote it had no ESP32 toolchain.
The servo motion was checked in a host simulation: 10 minutes of random, often interrupted reactions with no jumps, a top speed of 450 µs/s, every reaction ending at 1500 µs, and PWM switched off whenever the head is still.
