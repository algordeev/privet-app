# Privet — Russian learning concept

A responsive React + TypeScript + Vite prototype for an upcoming iOS learning app and an optional ESP32 desk companion. Product naming is centralized in `src/config.ts`.

## Companion concept illustrations

White and coral explorations of the optional desk companion, showing the enclosure and planned OLED, servo, and ESP32 arrangement. These are concept illustrations, not photographs of a completed device. The interactive website companion remains a browser simulation.

| Warm white | Soft coral |
| --- | --- |
| [![White desk companion concept with enclosed and open rear views](public/images/companion-white.png)](public/images/companion-white.png) | [![Coral desk companion concept with enclosed and open rear views](public/images/companion-coral.png)](public/images/companion-coral.png) |

Illustrations supplied by the project creator. The original PNGs live in `public/images/` and also appear in the website’s companion gallery. On the website, click an illustration to open a same-page image viewer and switch between Warm white and Soft coral. Close with the close button, Escape, or the backdrop; left/right arrow keys also switch images. README image links open the original files.

## Run locally

Use Node.js 22.18+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the local address printed by Vite. `npm run build` performs TypeScript checks and creates `dist/`. `npm run preview` serves that production build. `npm test` runs the focused Node test suite without an additional test dependency.

## iOS app (existing Capacitor project)

The normal browser always renders the website. `Capacitor.isNativePlatform()` selects a separate app home and full-screen lesson in the native wrapper; neither screen size nor user agent chooses the app shell. The shared `LessonPanel` and `useLesson` controller retain the same exercises, checking, hints, feedback, audio fallback, completion, and replay. The lesson close button returns home without resetting the session.

Rebuild local assets, sync them into the existing iOS project, and open Xcode:

```sh
npm run build:native
npx cap sync ios
npx cap open ios
```

Or use `npm run sync:ios` for the first two steps. Select your existing simulator/device and press Run in Xcode. The app ID remains `com.algordeev.privet`; the existing iOS project, signing settings, and accounts are untouched.

`build:native` outputs `dist-native/` with relative asset paths. Capacitor's `webDir` points there. **Do not use the Pages build for Capacitor sync.** The native build bundles its assets locally, uses system fonts, and makes no Google Fonts request. There is no `server.url` or hosted-site dependency. `build` and `build:pages` continue to output the browser website to `dist/`.

The stock bridge uses a full-screen WKWebView. Its `ios.contentInset` is explicitly `never` (also the installed SDK default), so only the native root applies the CSS safe-area insets. The native HTML opts into `viewport-fit=cover`. A VisualViewport listener sizes the app to the visible area as the keyboard opens; it does not subtract keyboard height twice. The lesson body scrolls independently while the answer action remains outside that scroller. Keyboard input, safe areas, rotation, and voice playback still need hands-on checks on the intended iPhones.

Native progress, pending input, revealed vocabulary, mistakes, and requested hints are saved locally under a separate session key. Existing completion/preferences are retained; an earlier completion can migrate into the native results screen. Malformed sessions reset safely. Returning home preserves the current lesson, and reset clears progress/preferences. The companion remains a simulation; physical hardware and BLE are planned.

The native virtual companion reuses the existing coral SVG/CSS robot. A compact home greeting follows actual saved progress; tapping the robot gives a silent, predefined reply and a brief tilt. Correct/incorrect submissions add a small companion beside the existing feedback, and a newly completed lesson gets a short celebration and a truthful summary. No answers are exposed by the companion, no speech is autoplayed, and no hardware connection is implied. The lesson card remains the single Start/Continue/Results action.

The compact, top-right native lesson settings contain Stress marks and Pronunciation help, presented as labelled switches with short explanations and no heading block. A brief fade/scale animates opening and closing, with motion removed when reduced motion is enabled. Changes apply immediately and persist locally; there is no Done button. Tap outside, use the settings icon again, or press Escape to dismiss the popover. Previously saved companion preferences remain respected, and resetting saved lesson/preferences on the native home restores the default. Motion respects reduced-motion settings and pauses when the robot is outside the viewport or the app is inactive. Generation-guarded reaction timers are canceled on navigation, retry, restart, completion, backgrounding, and unmount. Existing audio cancellation remains unchanged.

## What works

- An interactive iPhone-style app screen with device frame, iOS-style status bar, fixed answer action, scrolling lesson content, and a display-settings panel. This is a live web simulation, not a recorded video or a shipping iOS app.
- A five-step beginner café lesson: vocabulary reveal, meaning choice, tap-to-build sentence, café reply, and a typed translation with Russian letter helpers.
- Check, retry, explicit continue, completion, first-attempt results, a mistake practice list, replay, and reset.
- Optional stress marks and pronunciation hints. Canonical Russian stays separate from display aids.
- Optional browser speech synthesis when a Russian voice is available, including delayed voice loading and a listening variation. With no Russian voice, all text activities remain usable. Audio is synthesized; there is no microphone access or pronunciation assessment.
- Animated SVG/CSS robot reactions coordinated with the lesson, plus independent word, tilt, and celebration controls. Assessed prompts stay neutral until a correct answer or an explicit hint; incorrect feedback never reveals solutions automatically. Sentence-order and typed-answer pronunciation aids follow the same rule. Vocabulary introduction cards are unchanged.
- Keyboard controls, visible focus, announced feedback, mobile layouts, and reduced-motion styles.
- Display preferences and completion results saved only in localStorage. The footer reset clears saved completion and restores default preferences. No accounts, analytics, backend, or personal data collection. If browser storage is blocked, the lesson still works for the current session.

Audio uses one controller shared by the hero and lesson. Each tap cancels the previous request; lesson actions, close, restart, completion, backgrounding, and unmount cancel both queued and active speech. Voice-list callbacks, utterance events, and the six-second startup timeout are generation-guarded. There are no automatic retries or resume-on-foreground behavior. Loading, playback, timeout, and error messages appear in the audio status area; text remains available. The official Capacitor App plugin supplies native lifecycle events. Simulator voice-installation/engine failures can still prevent audio; these are reported rather than replayed later.

## What is simulated

The iPhone illustration, OLED, expressive servo movement, buttons, and “Demo connection” are browser concepts. No hardware is paired and no Bluetooth APIs are invoked. The physical ESP32 device, BLE integration, adaptive review, and learner pilot are planned; the Capacitor iOS app shell is now implemented. The app concept works independently of the companion.

## Source map

- `src/config.ts`: temporary product name and storage key.
- `src/lesson.ts`: structured lesson, canonical expressions, stress marks, pronunciation hints, and feedback.
- `src/engine.ts`: exact answer normalization/checking, progress reducer, and the lesson-to-companion event interface. Stress accents, capitalization, whitespace, and ending `. ! ? …` are normalized; incorrect words are rejected. Cyrillic letters such as й are preserved.
- `src/Companion.tsx`: reusable simulated companion with idle, prompting, thinking, correct, try-again, and celebrating states.
- `src/speechController.ts`: single cancellable speech queue, request generations, bounded six-second startup, and loading/error state.
- `src/useSpeech.ts`: speech controller lifecycle, voice-list events, browser visibility/page events, and native `@capacitor/app` background cancellation.
- `src/speechController.test.ts`: delayed initialization, navigation/close cancellation, repeated taps, timeout, errors, background, disposal, and voice fallback regressions.
- `src/App.tsx`: browser website and decorative lesson phone.
- `src/RuntimeApp.tsx`: Capacitor runtime selection.
- `src/NativeApp.tsx` and `src/native.css`: native home, full-screen lesson container, and scoped app styling.
- `src/nativeCompanion.ts` and its tests: progress greetings, predefined reactions, transition handling, and timer invalidation.
- `src/useNativeCompanion.ts` and `src/NativeRobot.tsx`: native preference/lifecycle wiring, accessible robot interaction, and visibility-aware motion. The website keeps using its existing companion behavior.
- `src/LessonPanel.tsx` and `src/useLesson.ts`: shared lesson UI and state controller.
- `src/session.ts` and `src/session.test.ts`: native resumable sessions, legacy completion migration, and persistence tests.
- `src/useNativeViewport.ts`: visible viewport sizing and keyboard focus handling.
- `vite.config.ts`: native-only font import removal and viewport metadata.
- `scripts/check-shells.mjs`: rendered browser/native branch and shared-exercise checks.
- `src/styles.css`: responsive page layout, character construction, focus styles, and reduced-motion support.
- `src/iphone.css`: the interactive iPhone frame, app navigation, settings, and native-style lesson presentation.
- `src/engine.test.ts`: normalization, invalid answers, retries, first-attempt tracking, explicit progression, completion, reset, and companion event tests.

## Verification

Run `npm test`, `npm run test:shells`, `npm run build`, `npm run build:pages`, and `npm run build:native`. The 33 focused logic/persistence/audio/companion tests cover greetings, correct/incorrect/completion reactions, disabled reactions, and stale callback cleanup as well as the existing lesson/audio safeguards. Rendered-shell checks cover both runtime branches, all native exercises, saved progress, the immediate learning-aid settings, static disabled feedback, and completion. These are automated component checks, not device tests.

The website’s initial HTML was compared byte-for-byte with a baseline captured before the native companion changes. Website source/styles/assets, the original robot, audio controller, dependency lockfiles, app ID/signing, icon, and Pages deployment configuration were preserved. Isolated headless Chromium checks exercised the native branch at 375 × 667 and 430 × 932, using test-only Capacitor platform and audio/lifecycle mocks. They covered all five exercises with a mistake/retry, keyboard robot interaction, saved preferences, offscreen/background motion pausing, reduced motion, stable action positioning, completion/replay, no horizontal overflow, and no automatic speech. Native home, incorrect-feedback, and completion screenshots were visually inspected. The original website also completed all five exercises, retry, and replay in Chromium at 1280 × 900 and 390 × 844, without native controls appearing. At 390px, a two-pixel document overflow was reproduced with the pre-change static HTML and unchanged website styles; it was left unchanged to preserve the website scope.

These checks do not establish actual WKWebView, iPhone keyboard/safe-area, screen-reader announcement, native lifecycle, or speech-engine behavior. No simulator or real-device verification was performed for this change. An earlier unsigned simulator `xcodebuild` attempt was interrupted after Apple’s asset-catalog/storyboard tools stalled; a successful iOS binary build still needs verification in Xcode.

## Next steps

1. Gather qualitative feedback on the café flow and companion usefulness in an observed learner session; the prototype does not upload feedback.
2. Validate the iOS app shell on smaller iPhones and test the lesson content and pronunciation help with a Russian-language educator.
3. Define a small BLE message schema around the existing prompt/thinking/correct/incorrect/complete/reset events. The phone remains responsible for answers and audio.
4. Prototype the ESP32 OLED, servo limits, buttons, reconnect behavior, and battery/power constraints on real hardware.
5. Run a learner pilot before expanding content or making learning-effectiveness claims.

Typography uses DM Sans and Manrope from Google Fonts with system fallbacks; the lesson works without that network request. Companion concept illustrations are bundled locally; no paid services are required.

## GitHub Pages

The GitHub Actions workflow in `.github/workflows/pages.yml` tests, builds, and deploys `main` to https://algordeev.github.io/privet-app/. The repository Pages source must be **GitHub Actions**. Each push to `main` redeploys the demo; the workflow can also be run manually.

`npm run build:pages` builds with Vite’s `/privet-app/` base path, including the favicon and bundled assets. `npm run build` retains the root path for local previews and other hosting. Browser audio still depends on an available Russian system voice.
