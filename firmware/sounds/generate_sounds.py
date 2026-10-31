#!/usr/bin/env python3
"""Generates the robot's DFPlayer sound files into sd/mp3/.

Run from anywhere: python3 firmware/sounds/generate_sounds.py
Needs ffmpeg (with libmp3lame). Output is deterministic, so regenerating only changes what you edit.
"""
import math
import random
import shutil
import subprocess
import sys
import tempfile
import wave
from array import array
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent / 'sd' / 'mp3'

# Harmonic recipes as (multiple, amplitude). A small speaker has almost no bass, so the
# sounds sit roughly between 500 Hz and 4 kHz and use harmonics to sound fuller.
SINE = [(1, 1)]
SOFT = [(1, 1), (2, .35), (3, .18)]
BUZZ = [(1, 1), (3, .33), (5, .2), (7, .14)]
BELL = [(1, 1), (2.76, .35), (5.4, .12)]

NOTE_INDEX = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}


def hz(name):
    """'C6' or 'F#5' -> frequency, A4 = 440 Hz."""
    sharp = '#' in name
    octave = int(name[-1])
    semis = NOTE_INDEX[name[0]] + (1 if sharp else 0) + (octave - 4) * 12
    return 440 * 2 ** (semis / 12)


def osc(dur, f0, f1=None, shape=SOFT, vib_rate=0.0, vib_depth=0.0):
    """Tone gliding exponentially from f0 to f1, with optional vibrato (depth as a fraction)."""
    n = int(dur * RATE)
    f1 = f1 or f0
    phase = 0.0
    out = []
    for i in range(n):
        f = f0 * (f1 / f0) ** (i / n)
        if vib_depth:
            f *= 1 + vib_depth * math.sin(2 * math.pi * vib_rate * i / RATE)
        phase += 2 * math.pi * f / RATE
        out.append(sum(a * math.sin(k * phase) for k, a in shape))
    return out


def env(s, attack=.005, release=.03, decay=None, gain=1.0):
    """Linear attack and release; `decay` adds an exponential fade (seconds to 1/e) for plucks and bells."""
    n = len(s)
    a = max(1, int(attack * RATE))
    r = max(1, int(release * RATE))
    out = []
    for i, x in enumerate(s):
        g = gain
        if i < a:
            g *= i / a
        if decay:
            g *= math.exp(-i / RATE / decay)
        if i > n - r:
            g *= (n - i) / r
        out.append(x * g)
    return out


def tremolo(s, rate, depth):
    return [x * (1 - depth / 2 + depth / 2 * math.sin(2 * math.pi * rate * i / RATE)) for i, x in enumerate(s)]


def noise(dur, cut0, cut1, seed):
    """White noise through a one-pole lowpass whose cutoff sweeps cut0 -> cut1, minus the rumble below ~300 Hz."""
    rnd = random.Random(seed)
    n = int(dur * RATE)
    lp = hp = 0.0
    hp_k = 1 - math.exp(-2 * math.pi * 300 / RATE)
    out = []
    for i in range(n):
        fc = cut0 * (cut1 / cut0) ** (i / n)
        lp += (1 - math.exp(-2 * math.pi * fc / RATE)) * (rnd.uniform(-1, 1) - lp)
        hp += hp_k * (lp - hp)
        out.append((lp - hp) * 3)
    return out


def cat(*parts):
    """Concatenates sample lists; a number is a gap of silence in seconds."""
    out = []
    for p in parts:
        out += [0.0] * int(p * RATE) if isinstance(p, (int, float)) else p
    return out


def mix(base, other, at=0.0, gain=1.0):
    start = int(at * RATE)
    out = base + [0.0] * max(0, start + len(other) - len(base))
    for i, x in enumerate(other):
        out[start + i] += x * gain
    return out


def pluck(name_or_hz, dur, shape=BELL, decay=.12, gain=1.0):
    f = hz(name_or_hz) if isinstance(name_or_hz, str) else name_or_hz
    return env(osc(dur, f, shape=shape), attack=.002, release=.02, decay=decay, gain=gain)


def chirp(dur, f0, f1, shape=SOFT, gain=1.0, **kw):
    return env(osc(dur, f0, f1, shape=shape, **kw), attack=.006, release=min(.04, dur / 3), gain=gain)


def sparkles(dur, count, seed, gain=.25):
    rnd = random.Random(seed)
    out = [0.0] * int(dur * RATE)
    for _ in range(count):
        out = mix(out, pluck(rnd.uniform(2600, 3800), .12, shape=SINE, decay=.04), rnd.uniform(0, dur - .12), gain)
    return out


# --- The sounds ---------------------------------------------------------------------------------

def s_boot():
    notes = cat(*(pluck(n, .1, shape=SOFT, decay=.09) for n in ('C5', 'E5', 'G5')))
    return cat(notes, env(osc(.35, hz('C6'), shape=SOFT, vib_rate=6, vib_depth=.012), release=.15))


def s_connected():
    return cat(chirp(.08, hz('G5'), hz('A5')), .02, chirp(.16, hz('C6'), hz('D6')))


def s_disconnected():
    return cat(chirp(.1, hz('C6'), hz('B5')), .03, chirp(.32, hz('G5'), hz('D5'), vib_rate=5, vib_depth=.015))


def s_happy():
    return cat(chirp(.09, 900, 1800), .03, chirp(.13, 1200, 2400))


def s_encourage():
    # A soft "aww" that ends on a hopeful lift; deliberately not a failure buzzer.
    aww = env(osc(.38, 1000, 700, shape=SINE, vib_rate=6, vib_depth=.03), attack=.03, release=.06)
    return cat(aww, .04, chirp(.16, 700, 950, shape=SINE))


def s_celebrate():
    tune = cat(*(pluck(n, .09, shape=SOFT, decay=.1) for n in ('G5', 'C6', 'E6', 'G6')), pluck('E6', .1, shape=SOFT, decay=.1))
    tune = cat(tune, env(osc(.5, hz('G6'), shape=SOFT, vib_rate=7, vib_depth=.012), release=.2))
    return mix(tune, sparkles(.7, 7, seed=3), at=.45)


def s_hint():
    return cat(chirp(.08, 700, 1400), pluck('E6', .35, decay=.12))


def s_streak():
    fanfare = cat(pluck('C6', .08, shape=BUZZ, decay=.06), pluck('C6', .08, shape=BUZZ, decay=.06),
                  pluck('C6', .08, shape=BUZZ, decay=.06), .04,
                  env(osc(.55, hz('G6'), shape=BUZZ, vib_rate=6, vib_depth=.01), release=.2, gain=.8))
    return mix(fanfare, sparkles(.8, 8, seed=8), at=.35)


def s_nod():
    return pluck(1500, .05, shape=SOFT, decay=.015)


def s_on_fire():
    # An excited warble that climbs, then lands on a chime.
    trill = env(osc(.35, 900, 1800, shape=SOFT, vib_rate=22, vib_depth=.06), attack=.02, release=.04)
    return cat(trill, pluck('G6', .3, shape=BELL, decay=.1))


def s_sleep():
    inhale = env(osc(.3, 900, 1300, shape=SINE), attack=.08, release=.05)
    exhale = env(osc(.85, 1300, 500, shape=SINE, vib_rate=4, vib_depth=.02), attack=.02, release=.3, decay=.6)
    return cat(inhale, exhale)


def s_wake():
    return cat(chirp(.12, 600, 900, shape=SINE), .06, chirp(.09, 900, 1600), .02, chirp(.1, 1100, 2000))


def s_giggle():
    hehe = [chirp(.06, b, b * 1.35, shape=SOFT, vib_rate=30, vib_depth=.04) for b in (1500, 1420, 1340, 1260, 1300)]
    return cat(*(x for h in hehe for x in (h, .035)))


def s_purr():
    trill = env(osc(1.0, 800, 760, shape=SOFT, vib_rate=3, vib_depth=.02), attack=.1, release=.3)
    return tremolo(trill, 24, .8)


def s_pickup():
    return env(osc(.45, 600, 2200, shape=SOFT, vib_rate=9, vib_depth=.02), attack=.02, release=.08)


def s_shake():
    return env(osc(.9, 1200, 700, shape=SOFT, vib_rate=9, vib_depth=.25), attack=.02, release=.15)


def s_knocked_over():
    oof = chirp(.15, 900, 400, shape=BUZZ, gain=.8)
    dizzy = env(osc(.55, 1000, 800, shape=SINE, vib_rate=7, vib_depth=.2), attack=.03, release=.15, gain=.7)
    return cat(oof, .08, dizzy)


def s_reviews_due():
    return cat(pluck('G5', .17), pluck('C6', .17), pluck('E6', .6, decay=.2))


def s_streak_risk():
    ding = cat(pluck('E6', .12, decay=.08), pluck('A5', .16, decay=.08))
    return cat(ding, .1, ding, .1, pluck('E6', .4, decay=.15))


def s_curious():
    return env(osc(.22, 700, 1150, shape=SOFT, vib_rate=8, vib_depth=.015), attack=.02, release=.06)


def s_uh_oh():
    return cat(chirp(.11, 520, 500, shape=BUZZ, gain=.7), .07, chirp(.18, 430, 400, shape=BUZZ, gain=.7))


# (file number, name, synth, gain in dB relative to the common loudness)
EFFECTS = [
    (1, 'boot', s_boot, 0),
    (2, 'connected', s_connected, 0),
    (3, 'disconnected', s_disconnected, -2),
    (4, 'happy', s_happy, 0),
    (5, 'encourage', s_encourage, -2),
    (6, 'celebrate', s_celebrate, 0),
    (7, 'hint', s_hint, -1),
    (8, 'streak', s_streak, 0),
    (9, 'nod', s_nod, -6),
    (10, 'on_fire', s_on_fire, -2),
    (11, 'sleep', s_sleep, -4),
    (12, 'wake', s_wake, -2),
    (13, 'giggle', s_giggle, 0),
    (14, 'purr', s_purr, -5),
    (15, 'pickup', s_pickup, 0),
    (16, 'shake', s_shake, 0),
    (17, 'knocked_over', s_knocked_over, 0),
    (18, 'reviews_due', s_reviews_due, 0),
    (19, 'streak_risk', s_streak_risk, 0),
    (20, 'curious', s_curious, -3),
    (21, 'uh_oh', s_uh_oh, -2),
]

TARGET_RMS_DB = -13.0
PEAK = 10 ** (-1 / 20)  # -1 dBFS


def finish(samples, gain_db):
    """Even loudness, a soft limiter below -1 dBFS, 10 ms of lead-in and short fades against pops."""
    rms = math.sqrt(sum(x * x for x in samples) / len(samples)) or 1e-9
    g = 10 ** ((TARGET_RMS_DB + gain_db) / 20) / rms
    out = [PEAK * math.tanh(x * g / PEAK) for x in samples]
    out = env(out, attack=.003, release=.012)
    return [0.0] * int(.01 * RATE) + out + [0.0] * int(.03 * RATE)


def write_mp3(samples, path):
    """Mono 44.1 kHz 128 kbps CBR MP3 without ID3 tags or a Xing header, which some DFPlayer clones choke on."""
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / 'in.wav'
        with wave.open(str(wav_path), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(array('h', (int(max(-1, min(1, x)) * 32767) for x in samples)).tobytes())
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav_path), '-ac', '1', '-ar', str(RATE),
                        '-c:a', 'libmp3lame', '-b:a', '128k', '-map_metadata', '-1', '-id3v2_version', '0',
                        '-write_xing', '0', str(path)], check=True)


def main():
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg is required')
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.mp3'):
        old.unlink()
    for number, name, synth, gain_db in EFFECTS:
        write_mp3(finish(synth(), gain_db), OUT / f'{number:04d}.mp3')
        print(f'{number:04d}.mp3  {name}')


if __name__ == '__main__':
    main()
