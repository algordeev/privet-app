# Privet ESP32 OLED/servo companion — protocol and lifecycle

Native iOS BLE central using `@capacitor-community/bluetooth-le` 8.3.0 with Capacitor 8 and Swift Package Manager. The native app root owns one transport across home, profile, lessons and companion settings. Website behavior, speech, saved progress, statistics and the virtual companion remain independent of hardware. There is no backend, saved device ID, offline queue or automatic reconnect. iOS declares `bluetooth-central` to allow the established native link to remain while the app is inactive; lesson commands remain foreground-only.

## Implementation and setup

Current firmware: [PrivetBLE_Servo_New_Emotions](../firmware/PrivetBLE_Servo_New_Emotions/README.md), for ESP32 ESP-32S, SSD1306 128×64 I2C OLED and SG90 on GPIO25. It supports codes 1–9. The older [servo](../firmware/PrivetBLE_Servo/README.md) and [OLED-only](../firmware/PrivetBLE_Lessons/README.md) variants support only 1–4; unsupported commands show an update notice without retrying or blocking lessons.

The phone owns lessons, checking, progress and pronunciation. Firmware owns OLED faces, durations and servo gestures. THINKING persists until replaced; HINT expires after 2600 ms into THINKING unless superseded. LISTENING is limited to 2600 ms in firmware; successful phone speech completion sends THINKING only for an unanswered question. Its request-scoped callback is invalidated by replacement, cancellation, submission, navigation, error, timeout, background or disposal. No duration guessing or app animation timer is used. Cyrillic quick-start pronunciation buttons also request LISTENING; successful speech completion, page changes during playback, and leaving the quick start restore IDLE because this is not an assessed question. They use the same speech cancellation safeguards. LISTENING/THINKING are servo-quiet, apart from returning an already displaced head toward center.

The current source is implemented, but the additional states and latest return-to-thinking changes have not been reported as uploaded/hardware-tested. Earlier user reports cover commands 1–4, servo movement and lock/background retention. Enclosure illustrations remain concepts.

## Peripheral contract (unchanged UUIDs)

Advertised name: **Privet-ESP32**. Advertise the service so a service-filtered iOS scan can discover the device. Service UUID, rather than the friendly name, is the scan filter; the picker shows discovered names.

| Purpose | UUID | Required property |
| --- | --- | --- |
| Service | `7b5e0001-6d8a-4f3b-9c2e-1a0d8f6b4c91` | Advertised custom service |
| Command | `7b5e0002-6d8a-4f3b-9c2e-1a0d8f6b4c91` | Write **with response** |
| Status | `7b5e0003-6d8a-4f3b-9c2e-1a0d8f6b4c91` | Notify |

Subscribe to Status before sending anything. Successful connection and subscription trigger one fresh CONNECTED command, never a replay of an earlier reaction. The happy test is enabled only after connection/subscription are ready and no command is pending. An unsupported CONNECTED ACK shows the firmware-update notice while keeping the link usable; it does not trigger retries or fallback replay. Foreground reconciliation is different: it still requires an accepted IDLE ACK.

## Packet format (version 1, exactly 8 bytes)

| Byte(s) | Command | Acknowledgement |
| --- | --- | --- |
| 0 | Version `1` | Version `1` |
| 1 | Message type `1` | Message type `2` |
| 2–5 | uint32 request ID, **little-endian** | Echo request ID, **little-endian** |
| 6 | Command code (table below) | Echo the command code |
| 7 | Argument `0` | Result: `0` accepted, `1` unsupported command, `2` invalid argument |

| Code | Name | Firmware behavior |
| --- | --- | --- |
| 1 | HAPPY | Brief positive reaction; user-verified firmware supports this |
| 2 | ENCOURAGE | Gentle encouragement, never a sad or punishing face; user-verified firmware supports this |
| 3 | CELEBRATE | Lesson completion celebration; user-verified firmware supports this |
| 4 | IDLE | Immediately cancel a temporary reaction and show a neutral face; user-verified firmware supports this |
| 5 | LISTENING | Explicit available pronunciation-button tap; intentionally servo-quiet |
| 6 | THINKING | Persistent unanswered-question state; intentionally servo-quiet |
| 7 | HINT | Explicit first hint request |
| 8 | STREAK | Retained for protocol compatibility; not triggered by profile navigation |
| 9 | CONNECTED | Fresh BLE connection after successful status subscription, once |

An acknowledgement means **command accepted**, not that the animation finished, the display rendered successfully, or the servo reached a position. OLED initialization can fail while BLE continues accepting commands. The short labels drawn by firmware are predefined; this version carries no arbitrary text, JSON, raw OLED drawing commands, raw servo instructions or BLE audio. Commands 5–9 require the owner-added new-emotions variant; no claim of their hardware verification is made. The existing emotion code selects any servo gesture locally.

Hex examples use consecutive distinct IDs `0x12345678` through `0x12345680` (little-endian on the wire). Each ACK echoes its command's ID and code. Code 10 is unknown even in the new variant. Privet sends only codes 1–9 with argument 0.

```text
HAPPY:                   01 01 78 56 34 12 01 00
HAPPY accepted:          01 02 78 56 34 12 01 00
ENCOURAGE:               01 01 79 56 34 12 02 00
ENCOURAGE accepted:      01 02 79 56 34 12 02 00
CELEBRATE:               01 01 7A 56 34 12 03 00
CELEBRATE accepted:      01 02 7A 56 34 12 03 00
IDLE:                    01 01 7B 56 34 12 04 00
IDLE accepted:           01 02 7B 56 34 12 04 00
LISTENING:               01 01 7C 56 34 12 05 00
LISTENING accepted:      01 02 7C 56 34 12 05 00
THINKING:                01 01 7D 56 34 12 06 00
THINKING accepted:       01 02 7D 56 34 12 06 00
HINT:                    01 01 7E 56 34 12 07 00
HINT accepted:           01 02 7E 56 34 12 07 00
STREAK:                  01 01 7F 56 34 12 08 00
STREAK accepted:         01 02 7F 56 34 12 08 00
CONNECTED:               01 01 80 56 34 12 09 00
CONNECTED accepted:      01 02 80 56 34 12 09 00
Unknown code 10:          01 01 81 56 34 12 0A 00
Unsupported ACK:         01 02 81 56 34 12 0A 01
Nonzero IDLE argument:   01 01 82 56 34 12 04 01
Invalid argument ACK:    01 02 82 56 34 12 04 02
```

Actual requests use distinct, increasing nonzero IDs throughout the running JavaScript process, including across transport instances. IDs never wrap; exhaustion requires an app restart. A fresh process starts new IDs, so connection-generation scoping is also required. Match both request ID and command code against the current, non-obsolete in-flight request and connection. Ignore wrong lengths, versions, message types, command codes, result codes, IDs, duplicate ACKs and old connection callbacks. An ACK arriving before the write-response promise resolves is retained, but acceptance is reported only after the write also succeeds.

## Firmware behavior

The [current firmware guide](../firmware/PrivetBLE_Servo_New_Emotions/README.md) lists durations and setup. New commands replace the latest-state mailbox, not an animation queue; repeated commands with new IDs restart their state. OLED drawing and servo updates run in `loop()`, outside BLE callbacks. IDLE cancels the temporary face on the next loop and requests servo centering; physical motion is slewed rather than instantaneous. THINKING has no expiry; HINT returns to THINKING. Other timed states return to IDLE unless another command supersedes them.

Servo output uses GPIO25 at 50 Hz, center 1500 µs and clamped targets 1300–1700 µs. The sketch slews toward targets and releases PWM after settling; it does not measure position or guarantee that the screen stays centered under load. LISTENING/THINKING add no expressive gesture. See [servo wiring, power and motion limitations](../firmware/PrivetBLE_Servo/README.md#hardware-and-wiring); that guide also preserves the older sketch's gesture details. The current OLED is rotated 180° and uses faces without captions.

The current sketch starts CONNECTED locally when the BLE link is created; the app independently sends command 9 once status subscription succeeds. This may restart the welcome animation. Retained-link foreground return uses IDLE, not CONNECTED.

### Validation and duplicate handling

- Length other than 8, version other than 1, or type other than 1: log and ignore without ACK.
- Unknown command code: result 1. For a supported code with nonzero argument: result 2. Unsupported-code validation takes precedence over argument validation.
- Accepted packets update the mailbox; rejected packets do not change the face. Both accepted and rejected packets become the most-recent cached request/ACK.
- An exact duplicate of the **most recent** eight-byte command resends its cached ACK without executing/restarting the reaction. Reusing that most-recent request ID with different bytes is logged and ignored without ACK.
- The cache is reset on BLE connect and disconnect. It holds only one request: replaying an older request after an intervening command is not deduplicated. There is no persistent replay history or authenticated anti-replay protection.
- The app allocates nonzero IDs; firmware parses the uint32 but does not separately reject ID 0. This does not change the app's nonzero-ID policy.

Connect/disconnect reset the duplicate cache. The current sketch requests CONNECTED on connect and IDLE on disconnect; legacy sketches request IDLE for both. Disconnect schedules advertising to restart in `loop()`; this makes the device discoverable again, not an automatic app reconnection. An OLED missing at both 0x3C/0x3D or failing initialization leaves BLE running, so even a matching accepted ACK does not establish that the screen worked. `notify()` itself is not proof that the app received the ACK; the app uses its own matching/deadline logic.

## Lesson and navigation events

Lesson reactions come from explicit accepted reducer transitions. LISTENING and HINT start only on explicit taps. A guarded successful speech-completion callback can restore THINKING; voice initialization, rerenders, keystrokes, stored results and virtual animation timers emit no commands. Profile entry is silent. Optional callbacks leave the shared website lesson independent of BLE.

| User event | Command |
| --- | --- |
| Incorrect answer | 2 ENCOURAGE |
| Correct answer | 1 HAPPY |
| Continue to next exercise | 6 THINKING |
| Try again | 6 THINKING |
| Final lesson completion | 3 CELEBRATE |
| Available audio button, explicit tap | 5 LISTENING |
| Pronunciation finishes with an unanswered exercise still open | 6 THINKING |
| Show hint, first explicit tap | 7 HINT |
| Open profile/statistics from home | No command (no reaction or movement) |
| Fresh subscribed connection | 9 CONNECTED |
| Open/resume/switch to an unanswered active lesson | 6 THINKING |
| Open completed results, failed screen or existing answer feedback | 4 IDLE |
| Replay a completed lesson (fresh first question) | 6 THINKING |
| Other reset, close lesson, home, foreground reconciliation | 4 IDLE |

Final Continue sends CELEBRATE **only**, exactly once, without an immediate THINKING/IDLE. Restoring/reopening results never celebrates. Lesson entry resolves the target controller before changing selection: unanswered active exercises request THINKING, while completed, failed or existing-feedback views request IDLE. Direct lesson switches use the same semantic entry method even when the lesson view is already open. Opening profile/statistics is silent, including return from a Plus overlay. STREAK remains code 8 for protocol compatibility but is not requested by navigation. An unavailable audio control sends nothing; an available explicit tap requests LISTENING then starts existing phone speech normally. An already-shown hint remains disabled and sends nothing again. Other neutral screen changes request IDLE (profile entry is the silent exception). Foreground return checks the retained link then requires an accepted IDLE ACK before resuming commands; it never replays CONNECTED.

Rapid duplicate transitions are deduplicated independently of React rerenders. None of these callbacks awaits BLE. Hardware errors and update notices appear in companion settings/home connection status, never in lesson or audio feedback. No hardware is necessary to complete the lesson.

## Connection ownership and lifecycle

- The root `NativeApp` hook owns one transport across screens. Navigating between home/profile/lessons/settings preserves an established connection and its listeners. Leaving settings cancels scanning/unfinished connection or subscription only.
- Ordinary inactive/background/pagehide events (including locking) **do not intentionally disconnect an established link**. They mark it suspended/unconfirmed, disable commands, clear the unsent latest slot, invalidate ACK matchers/waits and cancel app-side deadlines. No last-minute IDLE is issued. Firmware independently expires temporary faces (HINT returns to THINKING; other timed states return to IDLE). Persistent THINKING stays visible while the link is retained, until a later command (including foreground IDLE) or disconnect clears it.
- Scanning and unfinished connection/subscription attempts are stopped/canceled on background. No new scan or connect is started while inactive. There is no background scanning feature, polling, heartbeat, keep-alive or reconnect loop.
- A write already submitted to the native bridge cannot be recalled. Its actual promise remains tracked even after the request's UI/ACK wait is canceled. Return-to-foreground must await settlement with a new bounded deadline before another write can begin. There is never a second overlapping native write, nor a replay of the canceled reaction.
- Explicit Disconnect, actual native connection loss, Bluetooth becoming unavailable and root disposal still invalidate the connection and clean up. Disconnect remains available while suspended or checking. A later foreground callback cannot undo it.
- Audio cancellation and virtual-companion motion pausing are unchanged. No background speech, automatic lesson progression or lesson-generated BLE commands are introduced.
- The home/settings UI reports **Reactions paused** or **Checking connection**, rather than assuming Connected before reconciliation succeeds.

### Foreground reconciliation

Each inactive/active transition has a revision independent of the connection generation. Returning with a retained device starts one bounded reconciliation, not a new connection:

1. Wait for any pre-background submitted native write to settle (up to 4 seconds after return). Reactions attempted while paused/checking are dropped.
2. Call supported `BleClient.isEnabled()` (5-second bound). If Bluetooth is off, report unavailable and offer manual connection.
3. Call supported `BleClient.getConnectedDevices([serviceUUID])` and find the same device ID. The installed plugin implements this using `CBCentralManager.retrieveConnectedPeripherals(withServices:)`. This is a system connection query, not a scan or reconnect.
4. Call `BleClient.getServices(deviceId)` to confirm the plugin's existing app-owned `CBPeripheral` is connected and exposes the expected Write and Notify characteristics. In the installed iOS implementation, `getServices` rejects when that peripheral's state is not connected. The adapter's `connected(id)` function composes these supported APIs; there is no invented native `isConnected` API. The query/validation step has a 5-second bound.
5. Retain the existing status subscription and JavaScript listener. The plugin does not expose an `isNotifying` query; characteristic properties alone cannot prove delivery. Send **one fresh IDLE** and require its matching accepted ACK to prove the existing notification path is usable before reporting Connected/enabling lesson commands. No repeated subscription or listener registration is needed.

If verification fails, times out or cannot confirm the connection, report an honest disconnected/unavailable/error status, clear retained work and offer explicit Connect. A missing/rejected IDLE ACK also fails reconciliation with bounded cleanup. There is no automatic reconnect or fallback command. Delayed native disconnect/Bluetooth-off callbacks are respected even while inactive; queries cover callbacks not delivered until after suspension. Every asynchronous step checks both lifecycle revision and connection generation. Another background event, explicit Disconnect, loss callback or disposal cancels its authority to resume the session.

### iOS support and limitations

`Info.plist` adds `bluetooth-central` to `UIBackgroundModes`, preserving the usage description and any other background-mode entries. This enables supported **native Core Bluetooth** behavior; it does not grant WKWebView JavaScript continuous execution. Native callbacks or JavaScript timers can be delayed until return. No timer is used to keep the app alive or claim a connection stayed connected.

The inspected 8.3.0 plugin constructs `CBCentralManager(delegate:self, queue:DispatchQueue.main)` and keeps native device/subscription objects in memory. It does not opt into a restoration identifier or implement this milestone's process-termination restoration. No plugin code was modified or forked. Preservation is best effort within the existing app process: iOS, radio range, Bluetooth being disabled, peripheral power loss, force-quit or OS termination can interrupt the link. **No guaranteed persistence or automatic restoration after force-quit/termination is claimed.** A fresh app process starts disconnected and requires explicit Connect.

References checked: [plugin iOS/background configuration](https://github.com/capacitor-community/bluetooth-le#ios), [supported connected-device query](https://github.com/capacitor-community/bluetooth-le#getconnecteddevices), the installed plugin's `DeviceManager.swift`, `Plugin.swift`, `Device.swift`, and [Apple's Core Bluetooth background guidance](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html).

## Scheduler, cancellation and time bounds

The scheduler has **one in-flight command and at most one replaceable latest pending command**. There is no reaction FIFO. Same-context HAPPY, ENCOURAGE, LISTENING and HINT reactions replace the unsent pending reaction. Context-changing IDLE, THINKING, STREAK, CONNECTED and CELEBRATE mark the in-flight request obsolete, invalidate its ACK matcher/wait, and replace unsent old-context work. A context command already waiting for the native write slot is preserved ahead of fleeting reactions; those may be dropped rather than skip the required context. Another context may replace that pending context. CELEBRATE can replace any unsent earlier IDLE, THINKING, reaction or other state.

A new context cancels the old **ACK wait immediately**. It cannot cancel a native write already handed to CoreBluetooth, so the scheduler preserves that write's serialization and bounded deadline, then sends the newest pending command without waiting out the old ACK timeout. Late ACKs for canceled requests are ignored, including an unsupported result that would otherwise show a stale update notice. A context change before the native bridge call prevents the obsolete command from being written at all.

| Operation | Bound |
| --- | --- |
| Bluetooth initialization | 15 seconds |
| State/listener setup, scan start/stop | 5 seconds per operation |
| Scan window after preparation | 12 seconds |
| Connect/service discovery | 10 seconds |
| Status subscription | 5 seconds |
| Native write with response | 4 seconds |
| Current request's ACK after write response | 5 seconds (at most 9 seconds total per non-canceled command) |

While foregrounded, a genuine write error/timeout still invalidates the connection even when navigation made its reaction obsolete: starting another physical write would be unsafe. ACK timeout also drops the link and clears pending work. For ordinary commands, explicit negative ACKs (unsupported/invalid argument) report the problem and keep the link usable; a foreground-resume IDLE needs an accepted ACK, so rejection fails that reconciliation. There are no retries or replay loops. Disconnected/background/checking events are dropped and cannot appear after reconnect or resume.

A new session cannot begin while earlier native promises/cleanup are still settling. Late native settlement from an invalidated connection triggers cleanup again. Settlement of a submitted write on an ordinarily paused, retained connection does not intentionally disconnect it. If the native bridge is stuck, the UI explains that the previous connection is still finishing and may require reopening Privet. BLE cleanup touches only BLE listeners, preserving App listeners owned by audio and the virtual companion. The plugin queue is disabled so cancellation can reach native code; the app scheduler serializes writes itself.

CoreBluetooth cannot recall a write already delivered. A canceled request or disconnect may therefore leave acceptance unknown; a neutral face on return is the fresh IDLE's responsibility; temporary faces otherwise expire autonomously in firmware. The app never claims that a canceled request was physically undone. No firmware reaction is driven by an app animation timer.

## Pairing and security limits

Connect through Privet's device picker, not manual pairing in iPhone Settings. The app requests iOS Bluetooth permission on Connect and filters discovery by service UUID. These are discovery/access controls, not proof of device or user identity.

The sketch uses ordinary `PROPERTY_WRITE` and `PROPERTY_NOTIFY` characteristics and a `BLE2902` notification descriptor. It configures no passkey, bonding, authentication, encrypted-write requirement, owner allowlist or application secret. The app does not initiate bonding or authenticate the peripheral. Do not assume link encryption, authenticated pairing or exclusive ownership. Another compatible nearby BLE central could issue these face commands; the advertised name/UUIDs and request IDs are not credentials. Keep this prototype for a trusted local test environment; it has no protocol facility for sensitive content.

Authenticated ownership/pairing, broader recovery and process-termination restoration are future work. There are no arbitrary text payloads, raw OLED drawing commands, raw servo instructions or BLE audio in this protocol. The nine predefined state commands select local firmware behavior; the legacy servo variant accepts only codes 1–4. Predefined face labels come from the sketch, while pronunciation remains on the phone.

## Source and native integration

- `src/bleProtocol.ts`: unchanged UUIDs/version, commands 1–9, binary codec and process-wide IDs.
- `src/bleDriver.ts`: installed plugin adapter, supported native connection queries and existing listener/subscription ownership.
- `src/bleTransport.ts`: app-wide connection state, separate lifecycle revisions, foreground reconciliation, bounded scheduler and cancellation.
- `src/physicalLessonEvents.ts`: accepted lesson transition mapping and duplicate-event suppression.
- `src/usePhysicalCompanion.ts`: root ownership, lifecycle and semantic event wiring.
- `src/NativeApp.tsx`: explicit native navigation/lesson callbacks; website not involved.
- `src/PhysicalCompanionSettings.tsx`: settings and accessible home connection status.
- `src/bleProtocol.test.ts`, `src/bleTransport.test.ts`, `src/physicalLessonEvents.test.ts`: binary, lifecycle, event and scheduler regression tests.
- `firmware/PrivetBLE_Servo_New_Emotions/PrivetBLE_Servo_New_Emotions.ino`: owner-added nine-state source; no upload or new-animation hardware verification claimed.
- `firmware/PrivetBLE_Servo/PrivetBLE_Servo.ino`: legacy commands-1–4 BLE/OLED/servo variant with clamped pulse targets, loop-driven slew and PWM release.
- `firmware/PrivetBLE_Lessons/PrivetBLE_Lessons.ino`: retained OLED-only baseline; same packet contract, earlier celebration duration.

The existing local Swift package `CapacitorCommunityBluetoothLe` remains in `ios/App/CapApp-SPM/Package.swift`. `NSBluetoothAlwaysUsageDescription` is unchanged; `UIBackgroundModes` now includes `bluetooth-central`. No signing/app-ID change, new plugin, network service, `server.url` or plugin fork was introduced. Native content remains bundled locally; GitHub Pages keeps its own base path.

## Rebuild and sync

From the repository root:

```sh
npm ci
npm test
npm run test:shells
npm run build:native
npx cap sync ios
npx cap open ios
```

Or use `npm run sync:ios` for build plus sync. Select the existing **App** scheme and your connected/unlocked real iPhone in Xcode, then Run with existing signing settings. BLE requires a real iPhone; a simulator can verify layout but cannot test the radio.

## Verification

### Automated app checks

Latest recorded validation: **133 Node tests**, rendered-shell checks, web/Pages/native builds, iOS sync and `git diff --check` passed. Isolated Chromium checks at 320×568, 375×667, 390×844 and 430×932 cover target-lesson entry/resume/switching, completed/failed views, replay, hint/audio actions, stale audio completion, rewards/Plus and disconnected behavior. Unit tests cover packet validation, accepted transitions, bounded replacement, ACK matching/cancellation, serialized writes, errors and lifecycle races. Website HTML matched 31 baseline states.

BLE and speech are mocked. These results do not verify real radio, audio, OLED rendering or servo motion. No new firmware compile/upload or real-device test was performed by the coding agent. An older background-lifecycle milestone recorded an unsigned Xcode build; that is not a build result for the latest changes.

### User-reported real-hardware checks

The project owner confirms real-iPhone discovery, connection, matching ACKs, happy test, disconnect/reconnect, navigation continuity, commands 1–4, lock/background connection retention and servo movement. Those reports used the earlier Continue/retry→IDLE mapping. They do not establish the new THINKING, LISTENING, HINT or CONNECTED behavior, recent return-to-thinking fixes, exact session durations, device/software versions, range, endurance or fault recovery.

### Remaining hardware tests

- Upload the current new-emotions sketch separately. Check active lesson start/resume/switch/replay and Continue/retry→persistent THINKING; results/failed screens and close→IDLE. Profile must remain silent.
- Check audio→LISTENING→THINKING and HINT→THINKING, including answer/close interrupts. Verify no late return overwrites feedback or completion; final Continue must celebrate once.
- Confirm servo-quiet LISTENING/THINKING, safe unloaded/loaded travel, clearance, power stability and return/PWM release. ACKs do not confirm physical success.
- Connect→lock for 30 seconds→unlock→test; switch apps for two minutes→return→test. Extend for endurance; these durations are planned tests, not recorded passes.
- Power off ESP32 while locked, go out of range, or toggle Bluetooth. Verify honest status and manual reconnection; explicit Disconnect during reconciliation must remain effective.
- Confirm fresh CONNECTED versus retained-link ACK-gated IDLE, no background/replayed reactions, bounded failures, and no overlapping writes or duplicate subscriptions.
- Test force-quit/relaunch and native keyboard/accessibility separately. No automatic reconnection or process-termination restoration is promised.
