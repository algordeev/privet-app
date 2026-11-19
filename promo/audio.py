#!/usr/bin/env python3
"""Soundtrack for the Privet promo: voiceover, the devices' real sounds, effects and an original
music bed, mixed to promo/out/soundtrack.wav.

  python3 promo/audio.py [--voice kokoro:af_heart | --voice "Zoe (Premium)"]

Inputs: promo/out/cues.json (written by promo/render.mjs: sound cues and the voiceover lines).
The robot's sounds are the firmware's own files (firmware/sounds/sd/mp3); the Mini's are synthesized
from its buzzer tunes (firmware/PrivetMini_v0.9/MiniSound.h). Everything else is synthesized here, so
the soundtrack is original and royalty-free. Needs numpy and ffmpeg; the voice uses macOS `say`.
Writes out/voice.json with each line's real start and end, which the stage uses for subtitles.
"""
import argparse, json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'promo', 'out')
SR = 48000
rng = np.random.default_rng(7)


def decode(path):
    """Any audio file → mono float32 at SR, through ffmpeg."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def env(n, attack=.005, release=.05):
    e = np.ones(n, np.float32)
    a, r = min(n, int(attack * SR)), min(n, int(release * SR))
    if a: e[:a] = np.linspace(0, 1, a)
    if r: e[-r:] *= np.linspace(1, 0, r)
    return e


def onepole(x, cutoff):
    """One-pole low-pass, computed per block with a convolution (no scipy needed)."""
    a = float(np.exp(-2 * np.pi * cutoff / SR))
    y = np.empty_like(x); acc = 0.0
    block = 4096
    for s in range(0, len(x), block):
        seg = x[s:s + block]
        # y[n] = (1-a) x[n] + a y[n-1]: closed form per block
        k = np.arange(1, len(seg) + 1)
        conv = np.convolve(seg * (1 - a), a ** np.arange(len(seg)))[:len(seg)]
        y[s:s + block] = conv + acc * a ** k
        acc = y[s + len(seg) - 1]
    return y


def highpass(x, cutoff):
    return x - onepole(x, cutoff)


# ---------------------------------------------------------------- devices
def robot(n):
    return decode(os.path.join(ROOT, 'firmware', 'sounds', 'sd', 'mp3', f'{n:04d}.mp3'))


def buzzer(steps, duty=.5):
    """A passive piezo playing MiniSound.h steps: {from Hz, to Hz (0 = steady), ms}."""
    parts = []
    for f0, f1, ms in steps:
        n = int(SR * ms / 1000)
        if f0 == 0:
            parts.append(np.zeros(n, np.float32)); continue
        f = np.full(n, f0, np.float64) if f1 in (0, f0) else np.linspace(f0, f1, n)
        phase = np.cumsum(f) / SR
        wave = np.where((phase % 1) < duty, 1.0, -1.0).astype(np.float32)
        parts.append(wave * env(n, .002, .004))
    x = np.concatenate(parts)
    return onepole(x, 5200) * .5  # a small piezo in a plastic case


MINI = {'happy': [(1319, 0, 70), (0, 0, 20), (1760, 0, 110)], 'flip': [(2800, 0, 20)]}


# ---------------------------------------------------------------- effects
def tap():
    n = int(.03 * SR); t = np.arange(n) / SR
    click = np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 260)
    noise = highpass(rng.standard_normal(n).astype(np.float32), 2500) * np.exp(-t * 400)
    return (click * .5 + noise * .25).astype(np.float32)


def whoosh(length=.55):
    n = int(length * SR); t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n).astype(np.float32)
    # A band of noise that sweeps up and fades: brighter as it passes.
    out = np.zeros(n, np.float32)
    for lo, hi, g in [(300, 1200, .6), (1200, 3800, .4)]:
        band = onepole(highpass(noise, lo), hi)
        out += band * g
    shape = np.sin(np.pi * t) ** 2
    return (out * shape * .5).astype(np.float32)


def printer(length=2.8):
    """A small thermal printer, kept soft: the paper motor's gentle whir and its stepper ticking
    line by line, all low-passed (no harsh buzz), easing in and out."""
    n = int(length * SR); t = np.arange(n) / SR
    whir = onepole(onepole(rng.standard_normal(n).astype(np.float32), 900), 900) * 2.2
    ticks = np.zeros(n, np.float32)
    for at in np.arange(0, length, 1 / 48):  # one soft tick per printed line
        i = int(at * SR); L = min(n - i, int(.006 * SR))
        ticks[i:i + L] += np.exp(-np.arange(L) / SR * 900) * .5
    ticks = onepole(highpass(ticks, 300), 2200)
    hum = np.sin(2 * np.pi * 96 * t) * .06
    return ((whir + ticks + hum) * env(n, .25, .45) * .5).astype(np.float32)


def magnet():
    n = int(.18 * SR); t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (180 * np.exp(-t * 30) + 60) * t) * np.exp(-t * 35)
    click = highpass(rng.standard_normal(n).astype(np.float32), 1500) * np.exp(-t * 180)
    return (thump * .8 + click * .35).astype(np.float32)


def bell(freqs, length=1.4, gain=.35):
    n = int(length * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for i, f in enumerate(freqs):
        start = int(i * .09 * SR); tt = t[:n - start]
        tone = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt * d) for m, a, d in [(1, 1, 3.2), (2.76, .35, 6), (5.4, .12, 10)])
        x[start:] += tone
    return (x * gain).astype(np.float32)


def confetti():
    n = int(.35 * SR); t = np.arange(n) / SR
    pop = highpass(rng.standard_normal(n).astype(np.float32), 900) * np.exp(-t * 28)
    return (pop * .45 + bell([1568, 2093, 2637], .9, .18)[:n]).astype(np.float32)


# ---------------------------------------------------------------- music
NOTE = lambda name: 440 * 2 ** ((name - 69) / 12)
BPM = 100; BEAT = 60 / BPM; BAR = 4 * BEAT
# Fmaj7 · Am7 · Dm7 · B♭maj9 (MIDI notes), the bass an octave below the root.
CHORDS = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60], [46, 50, 53, 57, 60]]


def music(duration, sections):
    n = int(duration * SR); t = np.arange(n) / SR
    pad = np.zeros(n, np.float32); pluck = np.zeros(n, np.float32); bass = np.zeros(n, np.float32)
    kick = np.zeros(n, np.float32); clap = np.zeros(n, np.float32); hat = np.zeros(n, np.float32)
    bars = int(duration / BAR) + 1
    for b in range(bars):
        chord = CHORDS[b % 4]; s = int(b * BAR * SR); e = min(n, int((b + 1) * BAR * SR))
        if s >= n: break
        tt = t[s:e] - t[s]
        for m in chord:  # warm pad: two detuned sines per note
            f = NOTE(m + 12)
            pad[s:e] += (np.sin(2 * np.pi * f * tt) + .6 * np.sin(2 * np.pi * f * 1.004 * tt + 1)) * .045
        for step in range(8):  # 8th-note pluck arpeggio
            ps = s + int(step * BEAT / 2 * SR); length = int(.5 * SR)
            if ps >= n: break
            pe = min(n, ps + length); u = t[ps:pe] - t[ps]
            f = NOTE(chord[[0, 2, 1, 3, 2, 1, 3, 2][step] % len(chord)] + 24)
            pluck[ps:pe] += (np.sin(2 * np.pi * f * u) + .3 * np.sin(4 * np.pi * f * u)) * np.exp(-u * 9) * .12
        for at, length in [(0, 1.5), (2.5, 1.5)]:  # bass on 1 and the "and" of 3
            bs = s + int(at * BEAT * SR); be = min(n, bs + int(length * BEAT * SR))
            if bs >= n: continue
            u = t[bs:be] - t[bs]; f = NOTE(chord[0] - 12)
            bass[bs:be] += np.tanh(2 * np.sin(2 * np.pi * f * u)) * np.exp(-u * 2.2) * .22
        for beat in range(4):
            ks = s + int(beat * BEAT * SR)
            if ks < n:
                L = min(n - ks, int(.3 * SR)); u = np.arange(L) / SR
                kick[ks:ks + L] += np.sin(2 * np.pi * (45 + 90 * np.exp(-u * 40)) * u) * np.exp(-u * 11) * .55
            if beat in (1, 3) and ks < n:
                L = min(n - ks, int(.2 * SR)); u = np.arange(L) / SR
                clap[ks:ks + L] += rng.standard_normal(L).astype(np.float32) * np.exp(-u * 22) * .16
            for half in (0, .5):
                hs = ks + int(half * BEAT * SR)
                if hs < n:
                    L = min(n - hs, int(.05 * SR)); u = np.arange(L) / SR
                    hat[hs:hs + L] += rng.standard_normal(L).astype(np.float32) * np.exp(-u * 90) * (.05 if half else .035)
    clap = onepole(highpass(clap, 900), 6000); hat = highpass(hat, 6000)
    pad = onepole(pad, 1800); pluck = onepole(pluck, 4200)

    def gate(spans):  # smooth on/off automation from (start, end, level) spans
        g = np.zeros(n, np.float32)
        for a, b, level in spans:
            i, j = int(a * SR), min(n, int(b * SR))
            g[i:j] = level
        k = int(.25 * SR)
        return np.convolve(g, np.ones(k) / k, mode='same').astype(np.float32)
    mix = (pad * gate(sections['pad']) + pluck * gate(sections['pluck']) + bass * gate(sections['bass'])
           + kick * gate(sections['drums']) + clap * gate(sections['drums']) + hat * gate(sections['hats']))
    # Tiny stereo width: a delayed copy on the right.
    d = int(.011 * SR)
    left = mix; right = np.concatenate([np.zeros(d, np.float32), mix[:-d]])
    return np.stack([left, right], 1)


# ---------------------------------------------------------------- voice
def voice_lines(lines, voice, rate):
    """Each line as audio. `voice` is a macOS voice name, or "kokoro:<voice>" for Kokoro (offline,
    open source, see kokoro_tts.py); `rate` is words per minute for macOS, ignored for Kokoro."""
    clips = []
    folder = os.path.join(OUT, 'voice'); os.makedirs(folder, exist_ok=True)
    texts = [text.replace('\u2019', "'") for _, _, text in lines]
    if voice.startswith('kokoro:'):
        python = os.path.join(OUT, '.venv', 'bin', 'python')
        if not os.path.exists(python):
            sys.exit('Kokoro is not set up: see promo/kokoro_tts.py for the one-time setup.')
        subprocess.run([python, os.path.join(ROOT, 'promo', 'kokoro_tts.py'), voice.split(':', 1)[1], '1.0', folder],
                       input=json.dumps(texts), text=True, check=True, stderr=subprocess.DEVNULL)
        paths = [os.path.join(folder, f'{i:02d}.wav') for i in range(len(texts))]
    else:
        paths = []
        for i, text in enumerate(texts):
            path = os.path.join(folder, f'{i:02d}.aiff')
            subprocess.run(['say', '-v', voice, '-r', str(rate), '-o', path, text], check=True)
            paths.append(path)
    for (start, _, text), path in zip(lines, paths):
        x = decode(path)
        # Trim the voice's own leading/trailing silence.
        idx = np.nonzero(np.abs(x) > .01)[0]
        x = x[max(0, idx[0] - int(.02 * SR)):idx[-1] + int(.06 * SR)] if len(idx) else x
        clips.append((start, x, text))
    return clips


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', default='kokoro:af_heart', help='macOS voice name, or kokoro:<voice>')
    ap.add_argument('--rate', type=int, default=178)
    a = ap.parse_args()
    data = json.load(open(os.path.join(OUT, 'cues.json')))
    duration = data['duration']; n = int(duration * SR)
    fx = np.zeros(n, np.float32)

    def place(sig, at, gain):
        i = int(at * SR)
        if i >= n: return
        j = min(n, i + len(sig)); fx[i:j] += sig[:j - i] * gain

    sounds = {'tap': (tap(), .22), 'whoosh': (whoosh(), .28), 'printer': (printer(), .14), 'magnet': (magnet(), .7),
              'confetti': (confetti(), .5), 'logo': (bell([1047, 1568], 1.6, .3), .8), 'sync': (bell([1319, 1976], 1.2, .3), .7),
              'robot-wake': (robot(12), .75), 'robot-happy': (robot(4), .75), 'robot-encourage': (robot(5), .7),
              'robot-celebrate': (robot(6), .75), 'mini-happy': (buzzer(MINI['happy']), .45), 'mini-flip': (buzzer(MINI['flip']), .5)}
    for c in data['cues']:
        sig, gain = sounds[c['name']]
        place(sig, c['t'], gain)

    # Voice: each line at its subtitle start; the real ends go back to the stage for subtitles.
    try:
        clips = voice_lines(data['subtitles'], a.voice, a.rate)
    except subprocess.CalledProcessError:
        sys.exit(f'The voice "{a.voice}" is not installed. Install it in System Settings → Accessibility → Spoken Content → System voice → Manage Voices, or pass --voice.')
    vo = np.zeros(n, np.float32); timing = []; problems = []
    for idx, (start, x, text) in enumerate(clips):
        i = int(start * SR); j = min(n, i + len(x)); vo[i:j] += x[:j - i] * .9
        end = start + len(x) / SR; timing.append([round(start, 3), round(end, 3), text])
        nxt = clips[idx + 1][0] if idx + 1 < len(clips) else duration
        if end > nxt - .05: problems.append(f'"{text}" runs {end - nxt + .05:.2f}s into the next line')
    json.dump(timing, open(os.path.join(OUT, 'voice.json'), 'w'), ensure_ascii=False, indent=1)
    # Separate subtitle file for players and platforms that take one.
    stamp = lambda x: f'{int(x // 3600):02d}:{int(x % 3600 // 60):02d}:{int(x % 60):02d},{int(round(x % 1 * 1000)) % 1000:03d}'
    with open(os.path.join(OUT, 'privet-promo.srt'), 'w') as srt:
        for i, (s0, e0, text) in enumerate(timing, 1):
            nxt = timing[i][0] if i < len(timing) else duration
            srt.write(f'{i}\n{stamp(s0)} --> {stamp(min(e0 + .35, nxt))}\n{text}\n\n')

    sections = {'pad': [(0, duration - .2, 1)], 'pluck': [(2.2, 56.4, 1), (56.4, duration, .5)],
                'bass': [(6.0, 56.2, 1)], 'drums': [(6.2, 30.2, 1), (30.6, 51.0, .85), (51.0, 56.0, 1)],
                'hats': [(6.2, 56.0, 1)]}
    bed = music(duration, sections)
    # Duck the music under the voice: smooth envelope from voice activity.
    active = np.convolve((np.abs(vo) > .02).astype(np.float32), np.ones(int(.3 * SR)) / int(.3 * SR), mode='same')
    duck = 1 - .55 * np.clip(active * 3, 0, 1)
    fade = np.ones(n, np.float32); f = int(1.2 * SR); fade[-f:] = np.linspace(1, 0, f) ** 1.5
    music_mix = bed * (duck * fade)[:, None] * .9
    stereo = music_mix + np.stack([vo + fx * .95, vo + fx * 1.0], 1)
    stereo = np.tanh(stereo * 1.1) / np.tanh(1.1)  # gentle limiter
    raw = os.path.join(OUT, 'soundtrack-raw.wav')
    pcm = (np.clip(stereo, -1, 1) * 32767).astype('<i2')
    import wave
    with wave.open(raw, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-ar', str(SR),
                    os.path.join(OUT, 'soundtrack.wav')], check=True)
    print('wrote promo/out/soundtrack.wav, voice.json and privet-promo.srt')
    for p in problems: print('timing:', p)


if __name__ == '__main__':
    main()
