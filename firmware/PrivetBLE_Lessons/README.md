# Privet ESP32 OLED-only companion firmware

[PrivetBLE_Lessons.ino](PrivetBLE_Lessons.ino) is the working electronics-prototype sketch for Privet's optional desk companion. It accepts four predefined face commands over BLE, acknowledges them, and renders an SSD1306 OLED. The phone owns lessons, answer checking, progress and pronunciation. This retained **OLED-only variant does not drive a servo**. For the current nine-state moving-screen prototype, use the separate [new-emotions sketch/setup](../PrivetBLE_Servo_New_Emotions_v2/README.md); this OLED-only sketch remains a legacy commands-1–4 variant. Neither variant implements Wi-Fi, arbitrary text transfer or BLE audio.

The project owner reports successful real-iPhone discovery/connection, happy testing, matching ACKs, disconnect/reconnect, screen-navigation continuity, lesson faces and the latest lock/background connection preservation. No exact device/software versions or session durations were supplied. Enclosure illustrations in the [main README](../../README.md#companion-concept-illustrations) remain concepts.

## Hardware and wiring

- ESP32 ESP-32S **30-pin** development board.
- SSD1306 **0.96-inch I2C OLED, 128×64**.
- USB data cable, jumper wires and suitable power through the development board.

**Disconnect power before rewiring. Follow the printed pin labels, not a photograph or an assumed pin position.**

| OLED pin | ESP32 pin |
| --- | --- |
| GND | GND |
| VCC | 3V3 |
| SDA | GPIO21 |
| SCL | GPIO22 |

The sketch uses `Wire.begin(21, 22)` and no separate OLED reset pin (`-1`). Confirm the module is the intended I2C SSD1306 and follow its pin labels. No servo or interaction buttons are driven by this OLED-only setup; the [servo variant](../PrivetBLE_Servo/README.md#hardware-and-wiring) adds GPIO25 and separate servo power requirements.

## Arduino IDE setup and upload

1. In Arduino IDE, install **esp32 by Espressif Systems** through Boards Manager. This sketch targets **Arduino-ESP32 3.x**; no exact tested patch version is recorded here.
2. Select **ESP32 Dev Module** as the board. It targets the classic ESP32/ESP-32S, not a different ESP32-family chip selected just because its name is similar.
3. Use the **BLE library bundled with Espressif Arduino-ESP32** (`BLEDevice.h`, `BLEServer.h`, `BLEUtils.h`, `BLE2902.h`). Do not substitute another BLE stack/library without deliberately porting the sketch. Duplicate external ESP32 BLE libraries can cause include/API conflicts.
4. In Library Manager, install **Adafruit SSD1306** and **Adafruit GFX Library**, accepting their required dependency installs, including **Adafruit BusIO**. `Wire` and the built-in BLE headers come from the ESP32 core. These instructions do not assert exact tested library versions.
5. Open [PrivetBLE_Lessons.ino](PrivetBLE_Lessons.ino) in its matching **PrivetBLE_Lessons** folder. The sketch and folder names must match.
6. Connect the board with a USB data cable, choose its port under Tools → Port, then upload. If the IDE cannot start the upload, check the selected port/data cable and follow the board's BOOT/EN upload procedure.
7. Open **Serial Monitor at 115200 baud**. Reset the board if necessary to see startup output.

The code has not been compiled or uploaded as part of the documentation update; these settings come from the provided sketch and requested hardware setup.

## Startup and OLED address detection

The sketch initializes I2C on GPIO21/GPIO22 and probes **0x3C**, then **0x3D**, using the first responding address. It does not scan all possible I2C addresses. A successful display initialization dims the screen deliberately and draws the ready/idle face.

Expected successful startup messages (illustrative, not a captured hardware-test log):

```text
Privet BLE + OLED lesson reactions starting...
[OLED] Initialized 128x64 at 0x3C
[BLE] Advertising as Privet-ESP32. Connect from the app.
```

The detected address may instead be `0x3D`. Failure messages include:

```text
[OLED] Not found at 0x3C or 0x3D. Check power/SDA/SCL.
[OLED] BLE will continue without display.
```

or:

```text
[OLED] Initialization failed; BLE will continue.
```

BLE remains operational without a working OLED. An accepted ACK therefore does **not** prove that the face was drawn. On the display, idle reads `Ready BLE` before connection and `Connected` after connection; the small top-right dot also changes. Idle blinks occasionally.

On a BLE connection the sketch logs `[BLE] iPhone connected. Waiting for a test command.` This is a fixed log label, not iPhone authentication or a restriction to iOS clients. A disconnect logs `[BLE] Disconnected. No reactions are queued.` and the main loop restarts advertising, logging `[BLE] Advertising again.` The app still requires manual Connect after actual connection loss.

## Faces and protocol

| Code | Reaction | Display behavior |
| --- | --- | --- |
| 1 | HAPPY | Joyful face, `Happy!`, 2000 ms |
| 2 | ENCOURAGE | Relaxed encouraging face, `Try again!`, 2200 ms |
| 3 | CELEBRATE | Joyful face with bobbing and sparkles, `Well done!`, 3200 ms |
| 4 | IDLE | Cancel temporary reaction; neutral face with occasional blink |

Temporary faces return to idle on their own. These are firmware timer constants, not measured end-to-end latencies. New commands replace the latest requested face; an animation does not block IDLE from being processed on the next loop update. Exact repeats of the most-recent packet are re-acknowledged without restarting the face, but there is no persistent duplicate history.

Packets are exactly eight bytes, with a version/type, little-endian uint32 request ID, code and argument/result. See [the shared protocol document](../../docs/companion-ble.md) for exact UUIDs, byte layout, hex examples, ACK results, duplicate-cache limitations, scheduler/lifecycle and security. Do not send human-readable text to the command characteristic.

Serial output includes `[RX]` bytes, `[REACTION]` name/request ID, `[ACK sent]` bytes, and rejection/duplicate diagnostics. `[ACK sent]` means the sketch called Notify; only the app receiving a matching ACK confirms receipt, and neither confirms completed animation or successful OLED rendering.

## Build and run the iPhone app

From the **repository root**, use the commands defined by `package.json` and the installed Capacitor CLI:

```sh
npm ci
npm run build:native
npx cap sync ios
npx cap open ios
```

`npm run sync:ios` combines build and sync. Choose the existing **App** scheme and your real iPhone in Xcode, then Run using the existing app ID/signing settings. BLE is unavailable in the iOS simulator. Native assets are local in `dist-native/`; do not sync the website/Pages build instead. Rebuild/reinstall to apply native plugin/plist changes.

Other project commands, when needed: `npm run dev` for the browser demo, `npm test` for logic tests, `npm run test:shells` for rendered-shell checks, and `npm run build` / `npm run build:pages` for website builds. The browser website uses a simulated companion and does not connect this device.

Connect through **Privet → Physical companion settings → Connect**, rather than manually pairing in iPhone Settings. The iOS Bluetooth permission prompt authorizes app access, not an authenticated/bonded relationship with this prototype. No passkey, bonding or owner authentication is configured by the sketch; see [security limits](../../docs/companion-ble.md#pairing-and-security-limits).

## First-run and lesson checklist

This is a bring-up checklist. The project owner's reported successes are listed in [verification](../../docs/companion-ble.md#verification); do not interpret every troubleshooting/fault case as tested.

1. With power disconnected, confirm GND/3V3/SDA21/SCL22 wiring by labels. Power on and check Serial Monitor at 115200, OLED address/initialization and advertising messages.
2. Launch Privet on a real iPhone. Connect from Physical companion settings, allow Bluetooth, select **Privet-ESP32**, and wait for the app to finish setup/IDLE synchronization. Check the connected face/indicator.
3. Tap **Test happy reaction**. Compare the request/ACK IDs in logs and the happy face; it should return to idle after the firmware timer. ACK alone is insufficient if the display is blank.
4. Open the café lesson without disconnecting. Try a wrong answer for encouragement, a correct answer for happy, and Continue for idle. Finish the lesson for celebration/sparkles. The phone handles all checking/audio.
5. Navigate home/profile/lesson/settings and verify the established connection remains. Try explicit Disconnect and manual Connect again.
6. Try locking/backgrounding and returning: the app pauses commands/audio, preserves the established native link when possible, verifies it and requires a fresh IDLE ACK before resuming. The owner confirmed general operation, not any exact duration or endurance result.

Longer/timed sessions, range loss, power loss while locked, Bluetooth toggling and force-quit/fault recovery remain separate [hardware tests](../../docs/companion-ble.md#remaining-hardware-tests). iOS/range/power can interrupt connectivity; no continuous JavaScript execution, automatic reconnect loop or persistence after OS termination is promised.

## Basic troubleshooting

| Symptom | Check |
| --- | --- |
| Missing port or upload fails | USB data cable, correct port, board power and ESP32 Dev Module selection; use the board's documented BOOT/EN procedure if needed. |
| Missing BLE headers or incompatible API errors | Espressif Arduino-ESP32 3.x and its bundled BLE library; inspect the IDE's selected library paths for conflicting external BLE libraries. |
| Missing Adafruit headers | Install SSD1306/GFX and their prompted dependencies through Library Manager. |
| Garbled/no serial output | 115200 baud, correct port and reset after opening Serial Monitor. |
| OLED missing at 0x3C/0x3D | Disconnect power, check all four wires/pin labels and power; confirm I2C SSD1306 rather than a different controller/interface. |
| BLE works but display is blank | Read the OLED startup logs. BLE intentionally continues after display failure; check power/wiring/controller and initialization. The sketch deliberately uses a dim display setting. |
| Device not discovered | Use native Privet on a real iPhone, enable/allow Bluetooth, confirm advertising/power and proximity. Discovery filters by the custom service UUID; the name may be in the scan response. |
| Test disabled or app says Checking | Wait for connection/subscription or foreground verification/IDLE ACK. A lost or unconfirmed link needs manual Connect; explicit Disconnect remains available. |
| Face stays briefly after the app pauses | A submitted write cannot be recalled. Firmware finishes/expires the temporary face without relying on a last-minute background IDLE. |
| ACK timeout or rejected command | Compare exact eight-byte packets and echoed ID/code against the protocol; malformed length/version/type and conflicting last-ID reuse receive no ACK. Check subscription and connection; the app does not silently replay commands. |

Do not use these checks to assume successful fault recovery, radio range or endurance. This OLED-only sketch is an unauthenticated local electronics prototype. Servo support lives in the separate variant; the production enclosure is not implemented.
