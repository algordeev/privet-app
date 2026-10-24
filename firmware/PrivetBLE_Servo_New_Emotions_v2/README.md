# Privet OLED + servo: v2 learning-card firmware

Open [PrivetBLE_Servo_New_Emotions_v2.ino](PrivetBLE_Servo_New_Emotions_v2.ino) in its matching folder. This variant preserves the app’s nine reaction codes and adds capability-negotiated UTF-8 learning cards; the original new-emotions sketch remains face-only with commands 1–9, while the earlier OLED/servo variants support 1–4. See the [protocol and native event mapping](../../docs/companion-ble.md).

## Setup

- ESP32 ESP-32S 30-pin board; Arduino IDE **ESP32 Dev Module**, Espressif Arduino-ESP32 **3.x** and its bundled BLE library.
- Install **ESP32Servo** and **U8g2** (Arduino library by oliver, including its bundled U8x8 support). Choose the board's serial port and upload; Serial Monitor is **115200 baud**.
- SSD1306 0.96-inch 128×64 OLED: GND→GND, VCC→3V3, SDA→GPIO21, SCL→GPIO22. The sketch detects 0x3C/0x3D and rotates the screen 180°.
- SG90 signal→GPIO25; suitable external approximately 5 V supply and shared ESP32 ground. Do not power the servo from 3V3 or a GPIO. Disconnect power before rewiring; test unloaded with free travel first.
- Connect through **Privet → Physical companion settings**, not manual iPhone Settings pairing. Detailed [wiring/power and troubleshooting](../PrivetBLE_Servo/README.md#hardware-and-wiring) also apply.

## States

| Code | State | Firmware duration / return |
| --- | --- | --- |
| 1 | HAPPY | 2000 ms → IDLE |
| 2 | ENCOURAGE | 2200 ms → IDLE |
| 3 | CELEBRATE | 4500 ms → IDLE |
| 4 | IDLE | Until replaced |
| 5 | LISTENING | 2600 ms → IDLE; phone completion restores THINKING for unanswered exercises |
| 6 | THINKING | Until replaced |
| 7 | HINT | 2600 ms animation; optional hint card for 2000 ms, then THINKING |
| 8 | STREAK | 3600 ms → IDLE; not requested by Profile |
| 9 | CONNECTED | 2400 ms → IDLE |

New commands replace older reactions. Answer/close/completion commands and disconnect prevent an obsolete hint return. THINKING and LISTENING use animated faces without expressive servo movement; returning an off-center head toward center is still possible. Other gestures, timing and pulse slew are firmware-owned. PWM targets are 1300–1700 µs, center 1500 µs; there is no position feedback, and PWM release does not hold a loaded screen.

Link creation keeps the sleeping face visible; only the app’s ACK-tracked CONNECTED after subscription starts the welcome animation. Foreground reconciliation uses IDLE. Separate control code 10 negotiates bounded structured learning cards: primary 64 UTF-8 bytes, secondary 32, combined 96; 20-byte frames with at most 11 scalar-safe fragments. No unbounded arbitrary text, JSON, raw OLED/servo instructions or BLE audio are supported. ACK confirms acceptance only. No bonding/authentication or automatic app reconnect/force-quit restoration is implemented.

The owner reported earlier electronics/servo and lock/background checks. The new states and latest hint/audio/replay changes still need hardware validation; source and automated app checks do not prove upload, rendering or movement. Use the [hardware checklist](../../docs/companion-ble.md#remaining-hardware-tests). This milestone compiled for ESP32 Dev Module using the installed Arduino-ESP32 3.3.12, U8g2 and ESP32Servo: 1,161,546 bytes flash (88% of the default application partition), 44,884 bytes dynamic memory (13%). No upload or new hardware verification was performed.

## Learning cards

The phone owns lesson data and answer safety. Firmware owns layout, face-to-card timing, fixed 96-byte reassembly with an absolute five-second expiry, and atomic publication in `LearningCards.h`. No partial card is rendered. The app starts its 3500 ms transfer deadline before BEGIN and allows a separate two-second final ACK wait. A text failure leaves the accepted reaction working and disables cards until reconnection. The [wire specification and hardware checklist](../../docs/companion-ble.md#negotiated-utf-8-learning-cards-version-2) describe negotiation, modes and fallback.

Rendering uses U8g2 Cyrillic fonts, up to two primary and two translation lines, automatically choosing compact primary text when both sections need two lines. Current curriculum cards fit without truncation or scrolling; whole-word ellipsis is a fallback for future oversized content. THINKING transitions after 700 ms, LISTENING after 500 ms, and HAPPY/ENCOURAGE/HINT after their existing reactions. The hint card shows for 2 seconds after it first becomes visible, then returns to THINKING. Other cards retain their 30-second expiry without keep-alives. Text never drives another servo gesture. BLE callbacks only copy/validate bounded state; drawing, layout and servo updates remain in `loop()`. OLED initialization failure leaves BLE and servo available and advertises cards unavailable.

For compile-only verification with the installed Arduino tooling, select `esp32:esp32:esp32` (ESP32 Dev Module), core 3.x and the libraries above. Upload separately only when ready to perform the hardware checklist. Existing pin assignments and 1300–1700 µs pulse limits are unchanged. No button or buzzer is implemented.

The original [new-emotions firmware](../PrivetBLE_Servo_New_Emotions/README.md) is retained unchanged in its own folder. Open this v2 sketch from its matching `_v2` folder; `LearningCards.h`, `FacePresentation.h`, `ServoMotion.h` and `LearningLayout.h` must remain beside it.

Connection presentation: the sleeping face stays visible while the fresh link subscribes; the app’s accepted CONNECTED command wakes it once, then it returns to IDLE. U8g2 rounded-box radii are clamped during eye opening to prevent unsigned geometry underflow. This correction still requires an OLED check after uploading v2.

Servo presentation: all expressive gestures use eased paths from the last commanded pulse, including HINT’s tilt and return. OLED rows service the servo between I2C transfers at 400 kHz, rather than blocking it for a complete refresh. The 20 ms step gate, 10 µs step cap (4 µs for ENCOURAGE), 1300–1700 µs limits, centering and PWM release remain. LISTENING/THINKING stay servo-quiet. Verify smoothness on the actual powered, mounted hardware after uploading v2; commanded pulses are not position feedback.

OLED text is checked across all eight lessons, onboarding and alphabet-guide pronunciation. Short display meanings omit phone-only notes such as “(informal)”; the phone’s vocabulary, answers and speech stay unchanged. “Let’s go for a walk!” now appears in full. With an installed U8g2 library, run the actual-font check from the repository root:

```sh
node --experimental-strip-types scripts/check-oled-layout.mjs /path/to/Arduino/libraries/U8g2
```

This host check uses the same wrapping and frame geometry as firmware and tests actual U8g2 widths/ascent/descent. It does not replace checking the physical OLED.
