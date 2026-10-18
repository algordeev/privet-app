# Privet — Russian learning app and companion prototype

Privet is a React + TypeScript + Vite learning prototype with a native Capacitor iOS app and an optional ESP32 OLED-and-servo desk companion. The project owner has tested the app and electronics on a real iPhone, including lesson reactions and the latest lock/background connection preservation. This is an electronics prototype, not a finished enclosure or production product. Product naming is centralized in `src/config.ts`.

| Part | Current experience |
| --- | --- |
| Browser website | Landing page, interactive café lesson inside a decorative phone, simulated robot, and enclosure concept gallery. No real Bluetooth connection. |
| Native iOS app | Capacitor selects an app home, profile/statistics and two full-screen lessons using `Capacitor.isNativePlatform()`. Content is bundled locally. |
| Virtual companion | Coral SVG/CSS robot with predefined greetings and reactions; works independently of physical hardware. |
| Optional physical companion | ESP32 ESP-32S with SSD1306 128×64 OLED and SG90-targeted servo firmware, receiving predefined emotion commands over native iOS BLE. |

The **phone** owns lessons, answer checking, progress/statistics and optional synthesized pronunciation. The **ESP32** displays predefined OLED faces/animations and drives the servo motion associated with them; it does not check answers or play audio. Lessons remain fully usable without hardware.

## Physical ESP32 OLED + servo companion

Open **Physical companion settings** from native home, tap Connect, choose the advertised companion, and use Test happy reaction. Connect through Privet, rather than manually pairing in iPhone Settings. Bluetooth access is requested only after Connect.

| Accepted lesson event | Companion reaction |
| --- | --- |
| Incorrect answer | Gentle encouraging face; servo targets center |
| Correct answer | Happy face and brief servo tilt/return |
| Continue to another exercise or retry | Neutral/idle face and return toward center |
| Actual lesson completion | Celebration with sparkles and alternating servo motion |

Opening/closing a lesson, restart, screen changes and fresh connections synchronize IDLE as defined in the protocol. Final Continue sends CELEBRATE only; reopening saved results does not replay it. Hardware feedback never blocks a lesson or replaces lesson/audio feedback.

- Current OLED + servo sketch: [PrivetBLE_Servo.ino](firmware/PrivetBLE_Servo/PrivetBLE_Servo.ino); [servo wiring, power, dependencies and upload setup](firmware/PrivetBLE_Servo/README.md).
- OLED-only baseline remains available: [PrivetBLE_Lessons.ino](firmware/PrivetBLE_Lessons/PrivetBLE_Lessons.ino) and [OLED-only setup](firmware/PrivetBLE_Lessons/README.md).
- UUIDs, exact packet/ACK format, firmware timing, security limits, scheduler and lifecycle: [BLE protocol and lifecycle](docs/companion-ble.md).

### Locking and backgrounding

An established connection is retained on ordinary lock/background transitions and across native screen navigation. Lesson-generated BLE commands and pronunciation audio pause while inactive; pending reactions/ACK waits are discarded. Leaving settings cancels scanning or an unfinished connection/subscription, but preserves an established link. Explicit Disconnect remains available.

On return, the app waits boundedly for any already-submitted native write, checks Bluetooth availability, queries native connected devices for the same service/device, validates the app-owned peripheral's services, then sends one fresh IDLE through the existing notification subscription. It requires that IDLE's accepted ACK before reporting Connected or resuming lesson commands. A lost/unconfirmed link offers manual Connect; old reactions are never replayed.

`bluetooth-central` enables native Core Bluetooth support, not continuous WKWebView JavaScript execution. iOS, range or power loss can interrupt the connection. There is no automatic reconnect loop, polling, heartbeat, background speech or process-termination restoration, and no promise of uninterrupted connectivity or persistence after force-quit/OS termination.

## Companion concept illustrations

White and coral explorations of the optional desk companion, showing a possible enclosure and internal arrangement. The ESP32/OLED/servo electronics prototype is implemented; the pictured enclosure and internal arrangement remain concepts. These are concept illustrations, not photographs of a completed device. The interactive website companion remains a browser simulation.

| Warm white | Soft coral |
| --- | --- |
| [![White desk companion concept with enclosed and open rear views](public/images/companion-white.png)](public/images/companion-white.png) | [![Coral desk companion concept with enclosed and open rear views](public/images/companion-coral.png)](public/images/companion-coral.png) |

Illustrations supplied by the project creator. The original PNGs live in `public/images/` and also appear in the website’s companion gallery. On the website, click an illustration to open a same-page image viewer and switch between Warm white and Soft coral. Close with the close button, Escape, or the backdrop; left/right arrow keys also switch images. README image links open the original files.

## Run locally

Use Node.js 22.18+ (Node 24 recommended). From the repository root:

```sh
npm ci
npm run dev
```

Open the address printed by Vite. `npm run build` performs TypeScript checks and creates the website in `dist/`; `npm run preview` serves that build. `npm test` runs the Node test suite without an additional test dependency.

## Native iOS app

Rebuild bundled assets, sync the existing iOS project, and open Xcode:

```sh
npm run build:native
npx cap sync ios
npx cap open ios
```

Or use `npm run sync:ios` for build plus sync. Select the existing **App** scheme and your real iPhone, then Run with the existing signing settings. BLE is unavailable in the iOS simulator. Reinstall after plist/native changes; a web reload cannot apply the background mode. App ID: `com.algordeev.privet`.

`build:native` outputs `dist-native/` with relative asset paths, system fonts and local content. Capacitor's `webDir` points there; there is no `server.url` or hosted-site dependency. **Do not sync the Pages build into Capacitor.** Both `build` and `build:pages` output the website to `dist/`.

The native root owns safe-area spacing once (`ios.contentInset: never`, `viewport-fit=cover`). VisualViewport handling sizes the app around the keyboard; lesson content scrolls while the main answer action remains outside its scroller. Detailed keyboard, rotation, accessibility and device-specific layout checks remain useful beyond the hardware checks reported below.

## Learning, audio and local state

Lessons use three session hearts, an in-lesson first-try combo and a local XP reward based on the lesson, remaining hearts and best combo. Daily XP appears in the native profile; completed lessons show Passed and the next lesson shows Up next while both remain open. See [Privet learning rewards](docs/learning-rewards.md).

**Privet Plus (simulated)** is an optional local subscription that gives native lessons unlimited hearts. It is a demo only: no payment is processed.

**Gems** are earned only by learning, at the same rate for everyone. A heart refill costs **20 gems** and a streak freeze costs **30 gems**; gems cannot be bought, there are no ads, and Plus has no gem advantage. Daily awards stay cumulative across replays, while completion screens show only that attempt’s reward. See [the full rules](docs/learning-rewards.md).

- Five café steps: reveal vocabulary, choose a meaning, build a sentence by tapping, reply to the barista, and type a translation. Check/retry/explicit Continue, first-attempt results, mistake review, replay and reset are implemented.
- **Native Lesson 02 — Nice to meet you:** five steps for Меня зовут Анна., Как тебя зовут?, А тебя?, Очень приятно! and Пока! Vocabulary, meaning selection, sentence building, a social exchange and typed goodbye use the same check/retry/hint/review flow. Informal address and the example name are explained. Both lessons are available without a prerequisite lock. The browser keeps its café demo.
- Optional stress marks and pronunciation help keep canonical Russian separate from display aids. Assessed companion prompts do not reveal answers before a correct response or explicit hint.
- Pronunciation uses a Russian system voice when available. Delayed voice loading, errors and a six-second startup timeout have visible feedback; text activities work without audio. No microphone, speech assessment or automatic speech is used.
- One cancellable speech controller replaces old taps and cancels active/pending audio on navigation, close, restart, completion, background and unmount. No automatic replay occurs on foregrounding.
- Native lesson settings apply immediately: Stress marks and Pronunciation help switches, restart, no Done button. Outside click/settings icon/Escape dismiss; reduced motion removes animation.
- The virtual robot follows saved progress, offers a silent predefined tap reply, and reacts beside feedback/completion. Motion pauses offscreen/inactive; stale reaction timers are canceled. It does not depend on BLE.
- Native lessons independently restore partial input, revealed words, hints and progress; display preferences and a single audio controller are shared. The browser demo starts fresh while saving completion/display preferences. State stays in localStorage; blocked storage falls back to session use.
- Native profile shows current/best streak, recorded lesson finishes including replays, distinct practice days, last seven days and latest first-attempt result. A completed lesson earns one local-calendar practice day; same-day replays do not extend the streak. Reopening results does not count again. Reset clears saved lesson/preferences/statistics.

Statistics use `privet-demo-v1-native-stats`; resumable sessions have separate keys per lesson (the existing café keys are preserved). Latest results include their lesson title. Legacy results migrate without invented dates or streak history. No account, analytics, backend, personal profile data or feedback upload is required.

## Source map

| Source | Responsibility |
| --- | --- |
| `src/config.ts` | Temporary product name/storage key |
| `src/RuntimeApp.tsx`, `src/App.tsx` | Native runtime selection; browser landing/demo/gallery |
| `src/NativeApp.tsx`, `src/native.css`, `src/useNativeViewport.ts` | Native home/navigation, root ownership, safe areas and keyboard layout |
| `src/lesson.ts`, `src/lessons.ts`, `src/engine.ts` | Café content, native lesson catalogue/introductions content, exact answer normalization/checking and reducer transitions |
| `src/LessonPanel.tsx`, `src/useLesson.ts`, `src/session.ts` | Shared exercises, hints/feedback and native session persistence |
| `src/NativeLessonSettings.tsx` | Immediate native learning-aid settings |
| `src/Companion.tsx`, `src/nativeCompanion.ts`, `src/NativeRobot.tsx`, `src/useNativeCompanion.ts` | Simulated robot, semantic reactions, lifecycle and motion |
| `src/speechController.ts`, `src/useSpeech.ts` | Single guarded pronunciation controller and lifecycle cancellation |
| `src/nativeStats.ts`, `src/useNativeStats.ts`, `src/NativeProfile.tsx`, `src/GemsScreen.tsx` | Authoritative local activity, daily/attempt rewards, freezes, gems and profile |
| `src/subscription.ts`, `src/useSubscription.ts`, `src/PlusScreen.tsx` | Local Plus demo activation/cancellation; no billing |
| `src/bleProtocol.ts`, `src/bleTransport.ts` | Binary protocol/IDs, bounded scheduler, connection lifecycle/reconciliation |
| `src/bleDriver.ts`, `src/usePhysicalCompanion.ts` | Installed BLE plugin adapter and app-wide native lifecycle wiring |
| `src/physicalLessonEvents.ts`, `src/PhysicalCompanionSettings.tsx` | Accepted lesson-to-BLE mapping; connection/test UI and home status |
| `firmware/PrivetBLE_Servo/PrivetBLE_Servo.ino` | Current BLE/OLED/servo variant: loop-driven pulse gestures, centering and PWM release |
| `firmware/PrivetBLE_Lessons/PrivetBLE_Lessons.ino` | OLED-only baseline with the same BLE protocol |
| `src/*.test.ts`, `scripts/check-shells.mjs` | Focused regressions and rendered browser/native shell checks |
| `src/styles.css`, `src/iphone.css`, `src/gallery.css` | Website layout, decorative phone, gallery, focus/reduced-motion styles |
| `vite.config.ts`, `capacitor.config.ts` | Separate browser/native builds and local Capacitor content |

Answer normalization ignores case, stress accents, surrounding/repeated spaces and terminal punctuation while preserving letters such as й; incorrect words are not accepted through fuzzy matching.

## Verification

### User-reported real hardware

The project owner reports that the app runs on a real iPhone and confirms:

- Discovery, connection, Test happy reaction and matching acknowledgements.
- Explicit disconnect/reconnect and connection continuity across native screens.
- Incorrect answer → encouraging face; correct answer → happy face; Continue to another exercise → idle; completion → celebration with sparkles.
- The latest connection-preservation change works during locking/backgrounding.
- The servo now moves the screen when showing emotions. Gesture timing/pulse bounds below come from the sketch, not measured movement/position feedback.

No specific session duration, iPhone model, iOS/core version, latency, range, endurance or fault-recovery result was supplied. These are user reports, not hardware tests performed by the coding agent. The electronics prototype includes user-reported servo motion; the illustrated enclosure remains a concept. Servo load, calibration, torque, endurance and mechanical safety have not been established by those reports.

### Recorded automated checks

The earlier background-connection milestone recorded **85 Node tests**, TypeScript/rendered-shell checks, web/Pages/native production builds, iOS sync and an unsigned generic-iOS Debug build passing. The built plist contains `bluetooth-central`. Mocked native bridge UI checks at 375×667 and 430×932 covered retained links, native query/IDLE ordering, ACK-gated resume, cancellation, listener reuse, lost/off states and explicit Disconnect during checking. Website HTML matched the pre-change baseline; its full five-exercise/retry/replay flow passed in Chromium at 390×844. A pre-existing 2px mobile website overflow was reproduced and left unchanged.

The second-lesson update passed **91 Node tests**, TypeScript/rendered-shell checks, Pages/native production builds, iOS sync and `git diff --check`. Headless Chromium with a test-only native environment exercised Lesson 02 at 375×667 and 430×932: wrong answers/retries, stress marks, switching lessons, restoring partial sentences after reload, completion/review/profile, replay and reset. These checks covered both unavailable Russian audio and visible pronunciation controls, reduced-motion mode and one shared speech controller. Actual synthesized audio and the iOS keyboard were not tested by this browser harness. The website landing page plus 61 café lesson display states matched the prior website HTML. No simulator, real-device, hardware or Xcode build was run for this lesson update.

The hearts/XP/Plus review adds regressions for automatic freeze consumption followed by completion, cumulative daily versus latest-attempt gem awards, and saved-data migration. `npm run test:interactions` launches an isolated local Chrome/Chromium profile and exercises Plus activation/cancellation/reload, zero-heart recovery, lifecycle freeze consumption, replay rewards, and the 20/30-gem purchases at 375×667 and 430×932. Set `PRIVET_CHROME_PATH` if Chrome/Chromium is not installed in a standard location. It uses test-only native-platform/voice shims, not real iPhone, ESP32, speech or billing services.

These checks are implementation evidence, not real-radio, OLED-rendering, native screen-reader or lock-screen endurance tests. To run the project's checks:

```sh
npm test
npm run test:shells
npm run test:interactions
npm run build
npm run build:pages
npm run build:native
```

Earlier milestones recorded smaller suites (including 74 tests) and a foreground-only disconnect policy; those are historical and superseded by the lifecycle above. Earlier agent-only notes saying hardware had not been verified are superseded by the explicitly attributed user reports. Detailed automated/user/remaining hardware checks are separated in [the protocol document](docs/companion-ble.md#verification).

### Research provenance

Historical [competitor web-client research](docs/research/duolingo-web-observations.md) is kept separately from product documentation. Earlier work downloaded and inspected public client bundles; removing the comparison UI does not undo that history. The research record contains prose observations and provenance, not downloaded bundles or extracted source files. It is not a current competitor feature claim.

The public website distinguishes its simulated robot from the working iPhone + ESP32 electronics prototype; enclosure illustrations remain concepts. The existing source comment in `src/bleProtocol.ts` still notes that older firmware needs commands 2–4; current checked-in firmware implements them.

## Next steps and limits

1. Run longer lock/background sessions and fault tests: out of range, ESP32 power loss while locked, Bluetooth toggling, delayed notifications and force-quit behavior. These remain unverified; see [the hardware checklist](docs/companion-ble.md#remaining-hardware-tests).
2. Validate keyboard/safe areas/accessibility on intended iPhones and review Russian content/pronunciation help with an educator; gather learner feedback before further expansion or claiming learning effectiveness.
3. Develop the enclosure/mount, validate the servo travel and power under the actual screen load, then evaluate buttons and battery design. The current servo sketch uses GPIO25, 1300–1700 µs targets and a 1500 µs center; these are commanded pulses, not measured angles or guarantees of safe mechanical travel.
4. Design arbitrary text transfer, BLE audio or stronger authenticated ownership/pairing only as future features; none is in the current eight-byte emotion-command protocol; servo movement is chosen locally by firmware, not sent as raw angles/pulses. Automatic fault recovery and process-termination restoration are also unimplemented.
5. Run a learner pilot. The current app does not collect feedback remotely.

## GitHub Pages

The [Pages workflow](.github/workflows/pages.yml) tests, builds and deploys `main` to https://algordeev.github.io/privet-app/ when pushed, or through workflow dispatch. The repository Pages source must be **GitHub Actions**. This documentation update does not commit, push or deploy anything.

`npm run build:pages` uses `/privet-app/`, including favicon/assets. `npm run build` uses the root path for local previews/other hosting. Browser typography uses DM Sans/Manrope from Google Fonts with system fallbacks; native uses local system fonts. The website, including the simulated companion, works without real BLE hardware or paid services.
