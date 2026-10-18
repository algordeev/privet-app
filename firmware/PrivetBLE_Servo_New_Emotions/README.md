# Privet OLED + servo: current firmware

Open [PrivetBLE_Servo_New_Emotions.ino](PrivetBLE_Servo_New_Emotions.ino) in its matching folder. This variant supports the app's nine command codes; older sketches support only 1–4. See the [protocol and native event mapping](../../docs/companion-ble.md).

## Setup

- ESP32 ESP-32S 30-pin board; Arduino IDE **ESP32 Dev Module**, Espressif Arduino-ESP32 **3.x** and its bundled BLE library.
- Install **ESP32Servo**, **Adafruit SSD1306**, **Adafruit GFX Library** and prompted dependencies. Choose the board's serial port and upload; Serial Monitor is **115200 baud**.
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
| 7 | HINT | 2600 ms → THINKING while connected |
| 8 | STREAK | 3600 ms → IDLE; not requested by Profile |
| 9 | CONNECTED | 2400 ms → IDLE |

New commands replace older reactions. Answer/close/completion commands and disconnect prevent an obsolete hint return. THINKING and LISTENING use animated faces without expressive servo movement; returning an off-center head toward center is still possible. Other gestures, timing and pulse slew are firmware-owned. PWM targets are 1300–1700 µs, center 1500 µs; there is no position feedback, and PWM release does not hold a loaded screen.

The sketch shows CONNECTED on link creation; the app also sends it after subscription. Foreground reconciliation uses IDLE. No arbitrary text, JSON, raw OLED/servo instructions or BLE audio are supported. ACK confirms acceptance only. No bonding/authentication or automatic app reconnect/force-quit restoration is implemented.

The owner reported earlier electronics/servo and lock/background checks. The new states and latest hint/audio/replay changes still need hardware validation; source and automated app checks do not prove upload, rendering or movement. Use the [hardware checklist](../../docs/companion-ble.md#remaining-hardware-tests). No firmware was compiled or uploaded during this documentation review.
