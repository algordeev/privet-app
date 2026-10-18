# Privet OLED + servo companion firmware (legacy commands 1–4)

[PrivetBLE_Servo.ino](PrivetBLE_Servo.ino) adds SG90-targeted screen movement to the ESP32/SSD1306 companion. The project owner reports that the servo now moves the screen during emotions. The sketch itself is labelled for initial unloaded SG90 tests; this report does not establish safe travel, torque, loaded calibration or endurance for every screen mount.

This is the legacy **commands-1–4** variant. Use the [current new-emotions firmware](../PrivetBLE_Servo_New_Emotions/README.md) for commands 1–9, persistent THINKING and HINT→THINKING. Profile navigation is silent; the current [app event mapping](../../docs/companion-ble.md#lesson-and-navigation-events) is documented separately. This older sketch reports unsupported for codes 5–9; Privet shows an update notice without retrying or blocking lessons.

The phone handles lessons, answers, progress and pronunciation. Firmware chooses predefined faces and servo gestures. The unchanged version-1 eight-byte protocol carries no arbitrary text, JSON, OLED drawing, BLE audio or raw servo instructions; ACK means acceptance, not completed rendering/motion. The [OLED-only baseline](../PrivetBLE_Lessons/README.md) remains a separate sketch.

## Hardware and wiring

- Classic ESP32 ESP-32S 30-pin development board.
- SSD1306 0.96-inch I2C OLED, 128×64.
- SG90 servo target, USB data cable and jumper wires.
- A suitable regulated approximately 5 V servo supply, with current capacity appropriate for the actual servo/load, and a common ground with the ESP32.

**Disconnect power before rewiring and follow printed pin labels. Test initial motion unloaded, with free travel and no obstruction. Support the screen mechanically: PWM release does not actively hold it in place.**

| Connection | Destination |
| --- | --- |
| OLED GND | ESP32 GND |
| OLED VCC | ESP32 3V3 |
| OLED SDA | GPIO21 |
| OLED SCL | GPIO22 |
| Servo signal | GPIO25 |
| Servo power | Suitable regulated approximately 5 V servo supply |
| Servo ground | Servo supply ground **and** ESP32 GND |

Do not power the servo from the ESP32's 3V3 or a GPIO. Verify the actual servo's lead labels/pinout and supply requirements; wire colors and board power-pin arrangements can vary. Sharing a ground is necessary for the signal reference; do not join separate positive supply rails without a deliberate power design. The sketch does not measure supply voltage or motor current.

OLED I2C wiring matches the baseline. This variant uses `display.setRotation(2)` (180°) for an upside-down OLED mounting and deliberately dims the display. There is no separate OLED reset pin. The enclosure illustrations are still concepts; the implemented electronics/motion do not establish a finished enclosure design.

## Arduino IDE setup and upload

1. Install **esp32 by Espressif Systems**, Arduino-ESP32 **3.x**, through Boards Manager and select **ESP32 Dev Module** for the classic ESP32/ESP-32S.
2. Use the BLE library bundled with that ESP32 core (`BLEDevice.h`, `BLEServer.h`, `BLEUtils.h`, `BLE2902.h`). Avoid conflicting external BLE-stack libraries.
3. In Library Manager install **ESP32Servo**, **Adafruit SSD1306**, **Adafruit GFX Library** and their prompted dependencies (including Adafruit BusIO). Use an ESP32Servo release compatible with your Arduino-ESP32 3.x installation; no exact tested library/core patch versions were supplied.
4. Open [PrivetBLE_Servo.ino](PrivetBLE_Servo.ino) in its **PrivetBLE_Servo** folder. Keep the OLED-only sketch separate.
5. Connect the board with a USB data cable, choose its port, and upload. Check the selected board/port and use the board's BOOT/EN procedure if upload does not start.
6. Open **Serial Monitor at 115200 baud**; reset if needed to see startup logs. Make the first power/motion test unloaded and check clearance before attaching a screen load.

This documentation update did not compile, upload, calibrate or modify firmware. For OLED address detection/failure details, the [OLED-only setup guide](../PrivetBLE_Lessons/README.md#startup-and-oled-address-detection) also applies: the sketch probes 0x3C then 0x3D, and BLE continues if display initialization fails.

## Startup and diagnostics

Expected startup text (illustrative, not a captured test log):

```text
Privet BLE + OLED + SG90 starting...
[SERVO] GPIO25, 1300-1700 us; center 1500 us. PWM starts only for motion.
[OLED] Initialized 128x64 at 0x3C
[BLE] Advertising as Privet-ESP32. Connect from the app.
```

The detected OLED address can be 0x3D instead. GPIO25 is set LOW at boot; the servo is not attached or forced to center at startup. Motion attaches PWM only when needed. Later messages include:

- `[SERVO] PWM attach failed; BLE/OLED continue.` — an ACK does not prove PWM or movement succeeded.
- `[SERVO] Centered target; PWM released.` — the **commanded pulse** reached center and the settling interval ended, not a measured physical-position report.
- `[RX]`, `[REACTION]`, `[ACK sent]` and duplicate/rejection diagnostics — same BLE semantics as the baseline.

OLED failure does **not** disable servo updates: a command can move the servo even when no face is visible. The source constant `SERVO_ENABLED` is currently `true`; setting it to `false` in a local test copy can isolate OLED/BLE while diagnosing motor power/wiring. There is no app toggle for it.

## Emotion motion and timing

PWM uses GPIO25 at **50 Hz**. Center is **1500 µs**, and commanded pulses are clamped to **1300–1700 µs**. The library attachment range is 500–2500 µs, but the sketch does not command those extremes. These are pulse widths, not calibrated degrees or known screen travel limits.

| Command | OLED duration | Servo targets |
| --- | --- | --- |
| 1 HAPPY | 2000 ms | 1700 µs for gesture age <900 ms, then return to 1500 µs |
| 2 ENCOURAGE | 2200 ms | Stay/return at 1500 µs; no punitive head shaking |
| 3 CELEBRATE | **4500 ms** | 1300 → 1700 → 1300 → 1700 µs across four 900 ms phases, then 1500 µs |
| 4 IDLE | No expiry | Cancel the temporary reaction and request 1500 µs |

The earlier OLED-only CELEBRATE lasts 3200 ms; this variant extends it for the gesture. Motion is updated in `loop()` with OLED work, outside BLE callbacks. Pulse changes are limited to 10 µs per update, at intervals of at least 20 ms, so the servo slews toward targets instead of jumping. A new emotion replaces the pending/current gesture; accepted IDLE replaces the face on the next loop and begins a slewed return, not instantaneous physical centering.

After a gesture release threshold (1500 ms for HAPPY, 4100 ms for CELEBRATE, 0 for other states), the commanded pulse must equal center for a further 250 ms before PWM is detached and GPIO25 goes LOW. Exact wall-clock arrival depends on update timing and hardware. PWM release reduces active holding; it does not guarantee the screen stays centered under load.

The code remembers only its **last commanded pulse**, initially 1500 µs. It has no position sensor, calibrated angle, stall detection or movement-complete ACK. First motion can be larger if the physical start position differs from that assumption. Disconnect and reaction expiry request IDLE/centering; a last-minute phone-background command is not needed because temporary gestures expire locally.

## First-run and lesson checklist

1. Disconnect power, verify labels/GPIO25/common ground and servo supply design. Start without the screen load and with free horn travel; support any mounted screen before power/PWM release tests.
2. Upload using the matching sketch folder, inspect 115200-baud logs, and confirm OLED initialization/rotation and advertising. Attach no load until first-motion direction and extent are understood.
3. Connect through **Privet → Physical companion settings → Connect**, not manual iPhone Settings pairing. Wait for subscription and the fresh CONNECTED command (this legacy sketch returns unsupported and the app shows an update notice). Foreground resume instead requires accepted IDLE. Test happy reaction and observe the tilt, return and PWM-release log.
4. Check incorrect → encouraging face with centered servo; correct → happy/tilt; new app Continue/retry → THINKING (unsupported by this legacy sketch; use the new variant); completion → sparkles and alternating motion. Mounting determines the physical direction; do not infer angles from the pulse values.
5. Check an IDLE interrupt during HAPPY/CELEBRATE, normal disconnect/reconnect and expiry-to-center. An accepted ACK confirms neither rendering nor successful/safe mechanical movement.
6. Validate actual screen load, clearance and stable power separately, then repeat the app's existing navigation/lock/background checks. The user's report confirms screen movement, not quantified torque, endurance or every interruption/fault case.

The [protocol/lifecycle document](../../docs/companion-ble.md) gives unchanged UUIDs/packets, duplicate handling, app scheduling and remaining hardware tests. Pairing/authentication is not configured, and physical gestures now increase the importance of using this unauthenticated prototype only in a trusted local test environment. There is no automatic app reconnect loop or force-quit restoration.

For the app, from the repository root:

```sh
npm ci
npm run build:native
npx cap sync ios
npx cap open ios
```

`npm run sync:ios` combines build and sync. Use the existing App scheme and signing settings on a real iPhone; the simulator cannot test BLE. The browser website still uses a simulated robot.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing `ESP32Servo.h` or PWM API errors | Install ESP32Servo compatible with Arduino-ESP32 3.x; inspect IDE library paths for conflicts. |
| OLED upside down | This variant intentionally rotates 180° for its mounting; confirm physical orientation before changing a local copy. |
| BLE ACKs but no movement | Verify `SERVO_ENABLED`, power/common ground/GPIO25, attach-failure logs and which emotion was requested. ENCOURAGE/IDLE may not move an already centered, detached servo. |
| Movement resets ESP32 or disrupts BLE/OLED | Stop testing under load; check supply capacity, grounding and wiring before further motion. Neither ACKs nor a pulse clamp validate a power/mount design. |
| Buzzing, binding or unexpected first travel | Remove power; inspect unloaded travel, clearance and initial position. Software pulse assumptions are not feedback and do not establish safe angles. |
| Screen moves after PWM release | Detach removes active holding; review mechanical support/balance before testing a load again. |

Use the [baseline troubleshooting](../PrivetBLE_Lessons/README.md#basic-troubleshooting) for USB, OLED/I2C and BLE bring-up. No servo calibration, loaded endurance or firmware compilation was performed as part of this documentation change.
