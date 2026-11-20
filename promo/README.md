# Privet promo video

A one-minute 1920×1080 promo, built entirely from the project itself:

- **Phone footage** is the real app (native layout), driven through a scripted session with the
  Bluetooth radios faked the same way the interaction checks do it. The robot, Mini and printer
  "connections", print buttons and reactions are the app's own UI and logic.
- **Devices** are the app's 3D figures (`src/robotScene.ts`): the desk robot plays the firmware's
  HAPPY, ENCOURAGE and CELEBRATE faces and head gestures (`src/servoMotion.ts`, `src/oledFaces.ts`),
  the Mini shows its review card layout from `MiniScreens.h`.
- **The printed card** is drawn by the app's print renderer.
- **Sounds**: the robot's are its firmware files (`firmware/sounds/sd/mp3`), the Mini's are its buzzer
  tunes from `MiniSound.h`; effects and the music bed are synthesized in `audio.py` (original,
  royalty-free). The voiceover is Kokoro's "Heart" voice (open source, Apache 2.0), generated offline
  on this Mac; any macOS voice also works (`--voice "Zoe (Premium)"`).

## Build

```sh
node promo/capture-app.mjs                 # app footage → promo/out/app/<clip>/
node promo/render.mjs stills 4.5 23 45     # check frames → promo/out/stills/
python3 promo/audio.py                     # soundtrack, voice timing, subtitles (.srt)
node promo/render.mjs video                # frames → promo/out/video.mp4 (silent)
ffmpeg -i promo/out/video.mp4 -i promo/out/soundtrack.wav -c:v copy -c:a aac -b:a 192k -shortest promo/out/privet-promo.mp4
```

Run `audio.py` before the final `render.mjs video`: it writes `out/voice.json`, and the stage times
its burned-in subtitles to the recorded lines. Kokoro needs a one-time setup (a virtual environment
and the model files in `promo/out/`), described at the top of `kokoro_tts.py`.

| File | Role |
| --- | --- |
| `clips.mjs` | The app sessions to film and the seeded learner |
| `capture-app.mjs` | Records them (Chrome screencast, resampled to 30 fps) |
| `timeline.ts` | Scene windows, reaction moments and the voiceover lines |
| `stage.html`, `stage.css`, `stage.ts` | The composition: one deterministic page per frame |
| `render.mjs` | Steps the stage in headless Chrome; stills or an H.264 video |
| `audio.py` | Voiceover, device sounds, effects, music, ducking and loudness (−14 LUFS) |
| `kokoro_tts.py` | Records the voiceover lines with Kokoro, offline |

`promo/out/` holds everything generated and is not committed.
