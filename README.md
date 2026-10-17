# Privet — Russian learning concept

A responsive React + TypeScript + Vite prototype for an upcoming iOS learning app and an optional ESP32 desk companion. Product naming is centralized in `src/config.ts`.

## Run locally

Use Node.js 22.18+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the local address printed by Vite. `npm run build` performs TypeScript checks and creates `dist/`. `npm run preview` serves that production build. `npm test` runs the focused Node test suite without an additional test dependency.

## What works

- An interactive iPhone-style app screen with device frame, iOS-style status bar, fixed answer action, scrolling lesson content, and a display-settings panel. This is a live web simulation, not a recorded video or a shipping iOS app.
- A five-step beginner café lesson: vocabulary reveal, meaning choice, tap-to-build sentence, café reply, and a typed translation with Russian letter helpers.
- Check, retry, explicit continue, completion, first-attempt results, a mistake practice list, replay, and reset.
- Optional stress marks and pronunciation hints. Canonical Russian stays separate from display aids.
- Optional browser speech synthesis when a Russian voice is available, including delayed voice loading and a listening variation. With no Russian voice, all text activities remain usable. Audio is synthesized; there is no microphone access or pronunciation assessment.
- Animated SVG/CSS robot reactions coordinated with the lesson, plus independent word, tilt, and celebration controls.
- Keyboard controls, visible focus, announced feedback, mobile layouts, and reduced-motion styles.
- Display preferences and completion results saved only in localStorage. The footer reset clears saved completion and restores default preferences. No accounts, analytics, backend, or personal data collection. If browser storage is blocked, the lesson still works for the current session.

## What is simulated

The iPhone illustration, OLED, expressive servo movement, buttons, and “Demo connection” are browser concepts. No hardware is paired and no Bluetooth APIs are invoked. The physical ESP32 device, iOS app, BLE integration, adaptive review, and learner pilot are planned. The app concept works independently of the companion.

## Source map

- `src/config.ts`: temporary product name and storage key.
- `src/lesson.ts`: structured lesson, canonical expressions, stress marks, pronunciation hints, and feedback.
- `src/engine.ts`: exact answer normalization/checking, progress reducer, and the lesson-to-companion event interface. Stress accents, capitalization, whitespace, and ending `. ! ? …` are normalized; incorrect words are rejected. Cyrillic letters such as й are preserved.
- `src/Companion.tsx`: reusable simulated companion with idle, prompting, thinking, correct, try-again, and celebrating states.
- `src/useSpeech.ts`: progressive browser audio enhancement.
- `src/App.tsx`: page, activities, preferences, persistence, and event coordination.
- `src/styles.css`: responsive page layout, character construction, focus styles, and reduced-motion support.
- `src/iphone.css`: the interactive iPhone frame, app navigation, settings, and native-style lesson presentation.
- `src/engine.test.ts`: normalization, invalid answers, retries, first-attempt tracking, explicit progression, completion, reset, and companion event tests.

## Verification

Run `npm run build` and `npm test`. Browser QA should cover a desktop and a 390 × 844 iPhone viewport, all five steps with a deliberate mistake, keyboard navigation, replay/reset, localStorage persistence, no-Russian-voice fallback, delayed voice availability, and the OS reduced-motion setting. This development session had no available browser surface, so visual/interactive browser verification, live speech playback, and reduced-motion emulation could not be performed. Local HTTP serving and production build are checked separately.

## Next steps

1. Gather qualitative feedback on the café flow and companion usefulness in an observed learner session; the prototype does not upload feedback.
2. Move the lesson dataset and reducer contract into an iOS prototype; validate pedagogy and pronunciation help with a Russian-language educator.
3. Define a small BLE message schema around the existing prompt/thinking/correct/incorrect/complete/reset events. The phone remains responsible for answers and audio.
4. Prototype the ESP32 OLED, servo limits, buttons, reconnect behavior, and battery/power constraints on real hardware.
5. Run a learner pilot before expanding content or making learning-effectiveness claims.

Typography uses DM Sans and Manrope from Google Fonts with system fallbacks; the lesson works without that network request. No image assets or paid services are required.

## GitHub Pages

The GitHub Actions workflow in `.github/workflows/pages.yml` tests, builds, and deploys `main` to https://algordeev.github.io/privet-app/. The repository Pages source must be **GitHub Actions**. Each push to `main` redeploys the demo; the workflow can also be run manually.

`npm run build:pages` builds with Vite’s `/privet-app/` base path, including the favicon and bundled assets. `npm run build` retains the root path for local previews and other hosting. Browser audio still depends on an available Russian system voice.
