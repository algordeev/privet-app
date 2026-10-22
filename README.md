# Privet — Russian learning app and companion prototype

Privet is a React + TypeScript + Vite learning prototype with a native Capacitor iOS app and an optional ESP32 OLED-and-servo desk companion. The project owner has tested the app and electronics on a real iPhone, including lesson reactions and the latest lock/background connection preservation. This is an electronics prototype, not a finished enclosure or production product. Product naming is centralized in `src/config.ts`.

| Part | Current experience |
| --- | --- |
| Browser website | Landing page, interactive café lesson inside a decorative phone, simulated robot, and enclosure concept gallery. No real Bluetooth connection. |
| Native iOS app | Capacitor selects an app home, profile/statistics and two full-screen lessons using `Capacitor.isNativePlatform()`. Content is bundled locally. |
| Virtual companion | Coral SVG/CSS robot with predefined greetings and reactions; works independently of physical hardware. |
| Optional physical companion | ESP32 ESP-32S with SSD1306 128×64 OLED and SG90-targeted servo firmware, receiving predefined emotion commands over native iOS BLE. |

The **phone** owns lessons, answer checking, progress/statistics and optional synthesized pronunciation. The **ESP32** displays predefined OLED faces/animations and drives the servo motion associated with them; it does not check answers or play audio. Lessons remain fully usable without hardware.

## First-time native welcome

Fresh iOS installs start with Welcome → motivation and level → companion introduction → a five-step **coffee, please** lesson → completion → concept offers → Home. Returning learners with saved lessons, statistics or an active Plus demo keep their existing home. The browser website and browser phone preview do not enter this flow.

The introduction reuses the lesson engine, speech controller, Cyrillic guide, hearts and companion events. Its separate `welcome-cafe` session introduces кофе, пожалуйста, ordering “Кофе, пожалуйста” and thanking the barista. Its first completion credits Café essentials once, leaving the existing lesson definitions available for normal practice and Lesson 2 up next. A durable `onboardingAwarded` receipt is stored atomically with statistics; reopening results cannot grant duplicate rewards.

Choosing **New to Russian** adds a skippable, two-screen Cyrillic introduction before the companion and café lesson: the letters in кофе, four tricky look-alikes, optional whole-word audio, and a reminder about the in-lesson АБВ guide. It adds no rewards or assessment.

Motivation, level, flow stage and completion live under `${PRODUCT.storageKey}-first-run` (currently `privet-demo-v1-first-run`). **Settings → Replay onboarding** uses fresh practice without changing existing lesson sessions, rewards, subscription state or the established BLE connection. Replay XP is labelled a practice score. From native Web Inspector, `window.privetResetOnboarding()` resets only the welcome flow, keeps personalization, and uses replay mode for previously completed onboarding so it cannot mint another reward.

All three offers are concepts, with no checkout, StoreKit or payment. Free preserves any existing Plus state. Monthly/annual Plus first shows a local confirmation, then activates the existing unlimited-hearts demo if no Plus plan is already active. Companion only confirms exploration of a preorder concept; no order, payment or lifetime entitlement is created. Full-course/practice access, advanced insights and the lifetime bundle are explicitly planned.

## Physical ESP32 OLED + servo companion

Open **Physical companion settings** from native home, tap Connect, choose the advertised companion, and use Test happy reaction. Connect through Privet, rather than manually pairing in iPhone Settings. Bluetooth access is requested only after Connect.

Use the current [new-emotions firmware and setup guide](firmware/PrivetBLE_Servo_New_Emotions/README.md). It supports nine protocol codes; STREAK is retained for compatibility but opening Profile is silent. The older [servo](firmware/PrivetBLE_Servo/README.md) and [OLED-only](firmware/PrivetBLE_Lessons/README.md) sketches support codes 1–4 and remain available as legacy variants.

Active lesson entry, resume, switching, replay, Continue and retry show THINKING. It persists until replaced. Correct/incorrect answers show HAPPY/ENCOURAGE; final completion sends CELEBRATE once. HINT returns to THINKING after 2.6 seconds unless a newer command replaces it. Pronunciation starts LISTENING; successful audio completion restores THINKING only while the question remains unanswered, with canceled/stale callbacks ignored. LISTENING retains its firmware time limit when no completion event arrives. Results/failed screens, close, home and ordinary reset use IDLE. Fresh subscribed connections send CONNECTED; foreground reconciliation uses ACK-gated IDLE.

Firmware owns animation timing and servo motion; LISTENING/THINKING add no expressive servo movement. The protocol carries predefined states only, not arbitrary text, JSON, OLED drawing, BLE audio or raw servo instructions. An ACK confirms acceptance, not rendering or finished movement. See the [exact protocol, event mapping and lifecycle](docs/companion-ble.md). Updated firmware must be uploaded separately; new-state hardware verification has not been reported.

### Locking and backgrounding

An established connection is retained on ordinary lock/background transitions and across native screen navigation. Lesson-generated BLE commands and pronunciation audio pause while inactive; pending reactions/ACK waits are discarded. Leaving settings cancels scanning or an unfinished connection/subscription, but preserves an established link. Explicit Disconnect remains available.

On return, the app waits boundedly for any already-submitted native write, checks Bluetooth availability, queries native connected devices for the same service/device, validates the app-owned peripheral's services, then sends one fresh IDLE through the existing notification subscription. It requires that IDLE's accepted ACK before reporting Connected or resuming lesson commands. A lost/unconfirmed link offers manual Connect; old reactions are never replayed.

`bluetooth-central` enables native Core Bluetooth support, not continuous WKWebView JavaScript execution. iOS, range or power loss can interrupt the connection. There is no automatic reconnect loop, polling, heartbeat, background speech or process-termination restoration, and no promise of uninterrupted connectivity or persistence after force-quit/OS termination.

## Companion concept illustrations

White and coral explorations of the optional desk companion, showing a possible enclosure and internal arrangement. The ESP32/OLED/servo electronics prototype is implemented; the pictured enclosure and internal arrangement remain concepts. These are concept illustrations, not photographs of a completed device. The interactive website companion remains a browser simulation.

| Warm white | Soft coral |
| --- | --- |
| [![White desk companion concept with enclosed and open rear views](public/images/companion-white.webp)](public/images/companion-white.webp) | [![Coral desk companion concept with enclosed and open rear views](public/images/companion-coral.webp)](public/images/companion-coral.webp) |

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

The native app offers an optional **Cyrillic quick start** before Lesson 1, plus an **АБВ** reference in both lesson headers. The guide starts with letters from the current exercise and can expand to all 33 letters. Quick-start progress is saved separately and clears with the full reset. Its home card stays compact after starting, skipping or completion, and remains available for review. It never changes lesson progress, hearts, XP, gems or streaks. Tap green letters for letter audio; the right-hand speaker plays the example word. Both share the existing optional Russian device speech. Voices may say letter names rather than isolated sounds; Ъ and Ь have no standalone sound.

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
- Native profile shows current/best streak, recorded lesson finishes including replays, last seven days and latest first-attempt result. A completed lesson earns one local-calendar practice day; same-day replays do not extend the streak. Reopening results does not count again. Reset clears saved lesson/preferences/statistics.

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
| `src/firstRun.ts`, `src/useFirstRun.ts` | Validated native welcome/personalization state and safe replay/reset |
| `src/firstRunLesson.ts`, `src/NativeFirstRun.tsx`, `src/firstRun.css` | Guided café content, native welcome/offer UI and scoped styles |
| `src/cyrillic.ts`, `src/cyrillicProgress.ts`, `src/useCyrillicProgress.ts` | Shared alphabet data and independent validated quick-start progress |
| `src/NativeCyrillic.tsx`, `src/NativeSheet.tsx` | Optional quick start and contextual/full-alphabet dialog |
| `src/Companion.tsx`, `src/nativeCompanion.ts`, `src/NativeRobot.tsx`, `src/useNativeCompanion.ts` | Simulated robot, semantic reactions, lifecycle and motion |
| `src/speechController.ts`, `src/useSpeech.ts` | Single guarded pronunciation controller and lifecycle cancellation |
| `src/nativeStats.ts`, `src/useNativeStats.ts`, `src/NativeProfile.tsx`, `src/GemsScreen.tsx` | Authoritative local activity, daily/attempt rewards, freezes, gems and profile |
| `src/subscription.ts`, `src/useSubscription.ts`, `src/PlusScreen.tsx` | Local Plus demo activation/cancellation; no billing |
| `src/bleProtocol.ts`, `src/bleTransport.ts` | Binary protocol/IDs, bounded scheduler, connection lifecycle/reconciliation |
| `src/bleDriver.ts`, `src/usePhysicalCompanion.ts` | Installed BLE plugin adapter and app-wide native lifecycle wiring |
| `src/physicalLessonEvents.ts`, `src/PhysicalCompanionSettings.tsx` | Accepted lesson-to-BLE mapping; connection/test UI and home status |
| `firmware/PrivetBLE_Servo_New_Emotions/PrivetBLE_Servo_New_Emotions.ino` | Owner-supplied commands-1–9 OLED/servo variant; new animations await hardware verification |
| `firmware/PrivetBLE_Servo/PrivetBLE_Servo.ino` | Legacy commands-1–4 servo variant: loop-driven pulse gestures, centering and PWM release |
| `firmware/PrivetBLE_Lessons/PrivetBLE_Lessons.ino` | OLED-only baseline with the same BLE protocol |
| `src/*.test.ts`, `scripts/check-shells.mjs` | Focused regressions and rendered browser/native shell checks |
| `src/styles.css`, `src/iphone.css`, `src/gallery.css` | Website layout, decorative phone, gallery, focus/reduced-motion styles |
| `vite.config.ts`, `capacitor.config.ts` | Separate browser/native builds and local Capacitor content |

Answer normalization ignores case, stress accents, surrounding/repeated spaces and terminal punctuation while preserving letters such as й; incorrect words are not accepted through fuzzy matching.

## Verification

Latest local app validation: **159 Node tests**, shell checks, web/Pages/native builds, iOS sync and `git diff --check` passed. Isolated Chromium checks at 320×568, 375×667, 390×844 and 430×932 cover lessons, replay, first-time welcome/lesson/offers/replay, Cyrillic reference, letter highlighting and answer concealment, audio-completion safeguards, rewards/Plus and mock BLE navigation. Mouse/touch/keyboard checks also cover repeated sentence words and saved-session restoration. Website HTML matched 36 pre-change states exactly, including completion and failure screens. These are local automated checks with fake BLE/speech, not real-device, real-audio or GitHub CI verification.

The project owner reports real-iPhone discovery/connection/ACKs, disconnect/reconnect, navigation continuity, commands 1–4, lock/background retention and servo movement. New states and the latest thinking/hint/audio/replay changes still need hardware validation. No exact device/software versions, timing, range or endurance results were supplied. Earlier milestone checks are historical; the current [protocol checklist](docs/companion-ble.md#verification) distinguishes remaining tests.

```sh
npm test
npm run test:shells
npm run test:interactions
npm run build
npm run build:pages
npm run build:native
```

## Next steps and limits

1. Run longer lock/background sessions and fault tests: out of range, ESP32 power loss while locked, Bluetooth toggling, delayed notifications and force-quit behavior. These remain unverified; see [the hardware checklist](docs/companion-ble.md#remaining-hardware-tests).
2. Validate keyboard/safe areas/accessibility on intended iPhones and review Russian content/pronunciation help with an educator; gather learner feedback before further expansion or claiming learning effectiveness.
3. Develop the enclosure/mount, validate the servo travel and power under the actual screen load, then evaluate buttons and battery design. The current servo sketch uses GPIO25, 1300–1700 µs targets and a 1500 µs center; these are commanded pulses, not measured angles or guarantees of safe mechanical travel.
4. Design arbitrary text transfer, BLE audio or stronger authenticated ownership/pairing only as future features; none is in the current eight-byte emotion-command protocol; servo movement is chosen locally by firmware, not sent as raw angles/pulses. Automatic fault recovery and process-termination restoration are also unimplemented.
5. Run a learner pilot. The current app does not collect feedback remotely.

## GitHub Pages

The [Pages workflow](.github/workflows/pages.yml) tests, builds and deploys `main` to https://algordeev.github.io/privet-app/ when pushed, or through workflow dispatch. The repository Pages source must be **GitHub Actions**. This documentation update does not commit, push or deploy anything.

`npm run build:pages` uses `/privet-app/`, including favicon/assets. `npm run build` uses the root path for local previews/other hosting. Browser typography uses DM Sans/Manrope from Google Fonts with system fallbacks; native uses local system fonts. The website, including the simulated companion, works without real BLE hardware or paid services.
