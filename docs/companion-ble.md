# Privet ESP32 OLED/servo companion — protocol and lifecycle

Native iOS BLE central using `@capacitor-community/bluetooth-le` 8.3.0 with Capacitor 8 and Swift Package Manager. The native app root owns one transport across home, profile, lessons and companion settings. Website behavior, speech, saved progress, statistics and the virtual companion remain independent of hardware. There is no backend, saved device ID, offline queue or automatic reconnect. iOS declares `bluetooth-central` to allow the established native link to remain while the app is inactive; lesson commands remain foreground-only.

## Implementation and setup

The current moving-screen variant is [PrivetBLE_Servo.ino](../firmware/PrivetBLE_Servo/PrivetBLE_Servo.ino), with [servo wiring/power/upload instructions](../firmware/PrivetBLE_Servo/README.md). It targets the ESP32 ESP-32S, SSD1306 128×64 I2C OLED and an SG90 servo on GPIO25. The older [PrivetBLE_Lessons.ino](../firmware/PrivetBLE_Lessons/PrivetBLE_Lessons.ino) and [OLED-only setup](../firmware/PrivetBLE_Lessons/README.md) remain as a separate baseline. Both implement the same four emotion commands and packet format; no app/BLE change is needed to select firmware-local gestures.

The phone owns lessons, checking, progress and pronunciation. The ESP32 owns predefined OLED rendering, reaction timing and (in the servo variant) pulse-based motion. The project owner reports real-iPhone lesson/lock-background verification and now reports servo movement of the screen during emotions. Automated evidence, user reports and remaining hardware tests are separated under [Verification](#verification). The pictured enclosure remains a concept; no arbitrary text payloads, direct servo-angle/pulse commands or BLE audio are implemented.

## Peripheral contract (unchanged UUIDs)

Advertised name: **Privet-ESP32**. Advertise the service so a service-filtered iOS scan can discover the device. Service UUID, rather than the friendly name, is the scan filter; the picker shows discovered names.

| Purpose | UUID | Required property |
| --- | --- | --- |
| Service | `7b5e0001-6d8a-4f3b-9c2e-1a0d8f6b4c91` | Advertised custom service |
| Command | `7b5e0002-6d8a-4f3b-9c2e-1a0d8f6b4c91` | Write **with response** |
| Status | `7b5e0003-6d8a-4f3b-9c2e-1a0d8f6b4c91` | Notify |

Subscribe to Status before sending anything. Successful connection and subscription trigger one fresh IDLE synchronization, never a replay of an earlier reaction. The happy test is enabled only when the connection is ready and no command is pending.

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

An acknowledgement means **command accepted**, not that the animation finished, the display rendered successfully, or the servo reached a position. OLED initialization can fail while BLE continues accepting commands. The short labels drawn by firmware are predefined; this version carries no arbitrary text, JSON, raw servo commands or audio. The existing emotion code selects any servo gesture locally.

Hex examples use consecutive distinct IDs `0x12345678` through `0x1234567D` (little-endian on the wire). Each ACK echoes its command's ID and code. The last two pairs illustrate diagnostic rejection cases; Privet normally sends only codes 1–4 with argument 0.

```text
HAPPY:                    01 01 78 56 34 12 01 00
HAPPY accepted:           01 02 78 56 34 12 01 00
ENCOURAGE:                01 01 79 56 34 12 02 00
ENCOURAGE accepted:       01 02 79 56 34 12 02 00
CELEBRATE:                01 01 7A 56 34 12 03 00
CELEBRATE accepted:       01 02 7A 56 34 12 03 00
IDLE:                     01 01 7B 56 34 12 04 00
IDLE accepted:            01 02 7B 56 34 12 04 00
Unsupported code:         01 01 7C 56 34 12 05 00
Unsupported ACK:          01 02 7C 56 34 12 05 01
Nonzero IDLE argument:    01 01 7D 56 34 12 04 01
Invalid argument ACK:     01 02 7D 56 34 12 04 02
```

Actual requests use distinct, increasing nonzero IDs throughout the running JavaScript process, including across transport instances. IDs never wrap; exhaustion requires an app restart. A fresh process starts new IDs, so connection-generation scoping is also required. Match both request ID and command code against the current, non-obsolete in-flight request and connection. Ignore wrong lengths, versions, message types, command codes, result codes, IDs, duplicate ACKs and old connection callbacks. An ACK arriving before the write-response promise resolves is retained, but acceptance is reported only after the write also succeeds.

## Firmware behavior verified from the sketches

| Command | Face/animation | OLED-only duration | OLED + servo duration |
| --- | --- | --- | --- |
| HAPPY | Joyful eyes, larger smile, `Happy!` | 2000 ms | 2000 ms |
| ENCOURAGE | Relaxed eyes, small smile, `Try again!`; no punitive frown | 2200 ms | 2200 ms |
| CELEBRATE | Joyful face, bobbing and sparkles, `Well done!` | 3200 ms | 4500 ms |
| IDLE | Neutral face with occasional blink; `Connected` or `Ready BLE` | No expiry | No expiry |

Durations are code constants, not measured radio/display/movement latencies. A temporary reaction returns to IDLE after its timer expires; its timer starts when `loop()` observes the new mailbox revision. New commands replace the latest-state mailbox rather than append an animation queue. Accepted IDLE replaces the face on the next loop update and bypasses the normal 50 ms drawing throttle. It also requests servo centering in the servo variant; physical motion still slews, so this is not instantaneous arrival at neutral.

CELEBRATE changes its OLED bob/sparkles on a 180 ms phase; idle blink uses a 4300 ms cycle with a 130 ms blink window. `loop()` has a 10 ms delay. I2C/drawing and servo updates stay in `loop()`, outside BLE callbacks. The servo variant rotates the OLED 180° with `display.setRotation(2)` for its upside-down screen mounting; the baseline does not.

A new command with the same reaction but a different request ID advances the mailbox revision and restarts timing. If several commands arrive before `loop()` consumes them, only the latest state may appear/move, even though each accepted command can have an ACK. Duplicate handling below applies to both sketches and does not restart the face or servo gesture.

### Servo motion (servo variant only)

`SERVO_ENABLED` is `true`. GPIO25 drives an ESP32Servo PWM output at 50 Hz. The current command is tracked in microseconds: center 1500 µs, clamped targets 1300–1700 µs. `attach(..., 500, 2500)` configures the library's broader pulse mapping, but the sketch's commanded pulses remain within 1300–1700 µs. No app command supplies a raw angle or pulse.

| Emotion | Servo target sequence from gesture start |
| --- | --- |
| HAPPY | 1700 µs for age <900 ms, then 1500 µs |
| ENCOURAGE | 1500 µs; no punitive head shaking |
| CELEBRATE | 1300 µs for <900 ms; 1700 for 900–1799; 1300 for 1800–2699; 1700 for 2700–3599; then 1500 |
| IDLE / disconnect / reaction expiry | Request 1500 µs and return toward center |

The pulse changes by at most 10 µs per update at intervals of at least 20 ms. Target changes therefore produce slewed motion, not immediate jumps to each target. PWM attaches only when HAPPY/CELEBRATE or an off-center last-commanded pulse needs motion. There is no forced centering movement at boot: GPIO25 starts LOW and the software initially assumes a 1500 µs commanded pulse.

When the gesture's release threshold has passed (HAPPY 1500 ms, CELEBRATE 4100 ms, other states 0 ms) and the commanded pulse equals center, a 250 ms settling interval precedes detaching PWM and setting GPIO25 LOW. These are software thresholds, not measured completion times. Detaching releases active holding; gravity/load may move the screen. There is no position feedback, measured angle, stall detection or confirmation of physical centering. An unknown starting position can cause a larger first movement.

The sketch header targets initial **unloaded SG90 testing**. The user reports actual screen movement, but safe loaded travel, mounting clearance, power stability and endurance still need validation. See the [servo setup/checklist](../firmware/PrivetBLE_Servo/README.md) before first use. OLED initialization failure does not disable servo logic; an accepted command can still move a connected servo even with a blank display. A PWM attach failure logs an error while BLE/OLED continue, and an ACK is not a servo-success report.

### Validation and duplicate handling

- Length other than 8, version other than 1, or type other than 1: log and ignore without ACK.
- Unknown command code: result 1. For a supported code with nonzero argument: result 2. Unsupported-code validation takes precedence over argument validation.
- Accepted packets update the mailbox; rejected packets do not change the face. Both accepted and rejected packets become the most-recent cached request/ACK.
- An exact duplicate of the **most recent** eight-byte command resends its cached ACK without executing/restarting the reaction. Reusing that most-recent request ID with different bytes is logged and ignored without ACK.
- The cache is reset on BLE connect and disconnect. It holds only one request: replaying an older request after an intervening command is not deduplicated. There is no persistent replay history or authenticated anti-replay protection.
- The app allocates nonzero IDs; firmware parses the uint32 but does not separately reject ID 0. This does not change the app's nonzero-ID policy.

Connect/disconnect request IDLE and reset the duplicate cache. Disconnect schedules advertising to restart in `loop()`; this makes the device discoverable again, not an automatic app reconnection. An OLED missing at both 0x3C/0x3D or failing initialization leaves BLE running, so even a matching accepted ACK does not establish that the screen worked. `notify()` itself is not proof that the app received the ACK; the app uses its own matching/deadline logic.

## Lesson and navigation events

Events come from explicit accepted reducer transitions, not render effects, keystrokes, stored results, idle blinks, pronunciation controls or virtual animation timers.

| Event | Command |
| --- | --- |
| Incorrect submission | ENCOURAGE |
| Correct submission (including vocabulary check-in) | HAPPY |
| Retry after incorrect feedback | IDLE |
| Continue to a new exercise | IDLE |
| Final Continue that actually completes the lesson | CELEBRATE **only**, exactly once |
| Restart/reset lesson | IDLE |
| Open/close a lesson, return home | IDLE |
| Other native screen changes | IDLE (new neutral context) |
| Fresh connection plus successful subscription | IDLE once |
| Foreground return with a retained link | Native verification, then one IDLE; enable lesson commands only after its accepted ACK |
| Restore/reopen saved results | No celebration; opening the view only synchronizes IDLE |

Rapid duplicate transitions are deduplicated independently of React rerenders. None of these callbacks awaits BLE. Hardware errors and update notices appear in companion settings/home connection status, never in lesson or audio feedback. No hardware is necessary to complete the lesson.

## Connection ownership and lifecycle

- The root `NativeApp` hook owns one transport across screens. Navigating between home/profile/lessons/settings preserves an established connection and its listeners. Leaving settings cancels scanning/unfinished connection or subscription only.
- Ordinary inactive/background/pagehide events (including locking) **do not intentionally disconnect an established link**. They mark it suspended/unconfirmed, disable commands, clear the unsent latest slot, invalidate ACK matchers/waits and cancel app-side deadlines. No last-minute IDLE is issued. Firmware independently returns temporary faces to idle after bounded durations.
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

The scheduler has **one in-flight command and at most one replaceable latest pending command**. There is no reaction FIFO. Same-context reactions replace the unsent pending reaction. IDLE and CELEBRATE mark the in-flight request obsolete, invalidate its ACK matcher/wait, and replace unsent old-context work. IDLE already waiting for the write slot is prioritized over fleeting HAPPY/ENCOURAGE requests; those may be dropped rather than skip the neutral synchronization. Completion can replace unsent IDLE or other reactions.

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

Authenticated ownership/pairing, broader recovery and process-termination restoration are future work. There are no arbitrary text payloads, raw OLED drawing commands, raw servo instructions or BLE audio in this protocol. The four emotion commands can trigger local servo gestures in the servo variant. Predefined face labels come from the sketch, while pronunciation remains on the phone.

## Source and native integration

- `src/bleProtocol.ts`: unchanged UUIDs/version, commands 1–4, binary codec and process-wide IDs.
- `src/bleDriver.ts`: installed plugin adapter, supported native connection queries and existing listener/subscription ownership.
- `src/bleTransport.ts`: app-wide connection state, separate lifecycle revisions, foreground reconciliation, bounded scheduler and cancellation.
- `src/physicalLessonEvents.ts`: accepted lesson transition mapping and duplicate-event suppression.
- `src/usePhysicalCompanion.ts`: root ownership, lifecycle and semantic event wiring.
- `src/NativeApp.tsx`: explicit native navigation/lesson callbacks; website not involved.
- `src/PhysicalCompanionSettings.tsx`: settings and accessible home connection status.
- `src/bleProtocol.test.ts`, `src/bleTransport.test.ts`, `src/physicalLessonEvents.test.ts`: binary, lifecycle, event and scheduler regression tests.
- `firmware/PrivetBLE_Servo/PrivetBLE_Servo.ino`: current BLE/OLED/servo variant with clamped pulse targets, loop-driven slew and PWM release.
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

### Recorded automated checks

The preceding implementation validation recorded **85 Node tests**, TypeScript/rendered-shell checks, web/Pages/native production builds, iOS sync and an unsigned generic-iOS Debug build passing. The built plist contained `bluetooth-central`. The repository still contains the 85 test cases; the existing build log records `BUILD SUCCEEDED`.

Mocked native bridge checks at 375×667 and 430×932 covered retained connections, query-before-IDLE ordering, ACK-gated resume, dropped pending work, listener/subscription reuse, explicit Disconnect during reconciliation, lost/off states, canceled scanning and no automatic lesson progression. The checking-state screenshot was inspected. Website HTML matched its pre-change baseline and its full lesson/retry/replay flow passed at 390×844; the pre-existing 2px mobile website overflow remained unchanged.

These are automated/fake-driver/mock-bridge results, not evidence of physical radio endurance, display rendering, real permission dialogs or fault recovery. Earlier 74-test/foreground-only milestone notes are historical and superseded. No app builds, firmware compilation or hardware tests were rerun for this documentation-only update; source comparison, link/hex checks and `git diff --check` validate the documentation edits.

### User-reported real-hardware checks

The project owner reports:

- The app runs on a real iPhone.
- Discovery, connection, Test happy reaction and matching acknowledgements work.
- Explicit disconnect/reconnect works; an established connection survives navigation between native screens.
- Incorrect answer → encouraging face; correct answer → happy face; Continue to another exercise → idle face; lesson completion → celebration with sparkles.
- The latest change preserving connection during locking/backgrounding works.
- The added servo moves the screen when showing emotions. Specific pulse/gesture parameters are documented from source, not inferred measurements of the physical screen.

These reports supply no exact lock/background durations, iPhone model, iOS version, Arduino board-package version, latency, range, endurance or successful fault-recovery results. None is inferred. The coding agent did not perform these hardware checks. The ESP32/OLED/servo electronics prototype is user-reported; servo load/angle/torque/endurance results are not supplied; enclosure illustrations remain concepts.

### Remaining hardware tests

The general lock/background behavior is user-confirmed. The following extended, timed and fault scenarios are **not recorded as passed**:

- Connect → lock for a measured 30 seconds → unlock → test; then extend to longer sessions. Record duration/device/software versions rather than assuming them from the prior report.
- Connect → switch apps for a measured two minutes → return → test; repeat/extend for endurance and listener/reaction duplication checks.
- Verify fresh native-state checks and one IDLE ACK on return, no replay/extra background writes, and no unnecessary new connect.
- Power off ESP32 while locked, then unlock: verify honest lost/unavailable/error status, no stale Connected indication, and manual recovery after power returns.
- Move out of range and return; toggle Bluetooth while inactive and restore it. Check honest status and manual Connect rather than assume automatic recovery.
- Explicit Disconnect during a delayed foreground check/IDLE ACK and through later lock/unlock: it must remain effective. Normal explicit disconnect/reconnect is already user-confirmed; these races are separate tests.
- Background during scanning, connection or subscription; delay native writes/ACKs and send malformed/wrong-ID/duplicate notifications. Verify bounded failures, no overlapping writes, stale callback rejection and no lesson/audio interruption on hardware.
- Force-quit/OS termination and relaunch: document actual behavior and manual Connect. No persistence/restoration guarantee is implemented or claimed.
- Validate unloaded servo travel before the screen load, actual mounting clearance/direction, power stability during motion, safe loaded travel, return/release behavior and endurance. Check IDLE/disconnect interrupts gestures without assuming PWM release holds the screen. These are not confirmed by an ACK.
- Check no background audio or automatic lesson progression; check keyboard, safe areas, accessibility and display/PWM-failure behavior on intended devices.

Use the current [servo setup and first-run checks](../firmware/PrivetBLE_Servo/README.md#first-run-and-lesson-checklist), or the [OLED-only baseline checklist](../firmware/PrivetBLE_Lessons/README.md#first-run-and-lesson-checklist), for the selected variant. This checklist is a validation plan, not a list of completed fault-recovery results.
