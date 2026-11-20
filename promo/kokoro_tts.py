#!/usr/bin/env python3
"""Records voiceover lines with Kokoro (open-source TTS, Apache 2.0), fully offline.

  promo/out/.venv/bin/python promo/kokoro_tts.py <voice> <speed> <out_dir> < lines.json

lines.json is a JSON list of strings; writes <out_dir>/<index>.wav for each. Setup (once):
  python3 -m venv promo/out/.venv && promo/out/.venv/bin/pip install kokoro-onnx soundfile
  and the model files kokoro-v1.0.onnx + voices-v1.0.bin in promo/out/models/
  (https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0).
"""
import json, os, sys
import soundfile as sf
from kokoro_onnx import Kokoro

models = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'models')
voice, speed, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
kokoro = Kokoro(os.path.join(models, 'kokoro-v1.0.onnx'), os.path.join(models, 'voices-v1.0.bin'))
os.makedirs(out, exist_ok=True)
for i, text in enumerate(json.load(sys.stdin)):
    audio, sr = kokoro.create(text, voice=voice, speed=speed, lang='en-us')
    sf.write(os.path.join(out, f'{i:02d}.wav'), audio, sr)
