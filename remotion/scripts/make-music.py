#!/usr/bin/env python3
"""
Generates an original, royalty-free cinematic music bed for the Represent
video, timed to its beats (soft intro -> riser into the ballot eruption at
~10s -> warm, uplifting resolve through the CTA). Output: public/music.wav

Run:  python3 scripts/make-music.py
Requires: numpy  (no ffmpeg needed; writes 16-bit PCM WAV)
"""
import os, wave, struct
import numpy as np

SR = 44100
DUR = 22.0
N = int(SR * DUR)
t = np.linspace(0, DUR, N, endpoint=False)
L = np.zeros(N)
R = np.zeros(N)

def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12.0)

def seg(t0, t1):
    a = max(0, int(t0 * SR)); b = min(N, int(t1 * SR))
    return a, b

def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)

def env_ar(length, attack, release):
    e = np.ones(length)
    a = int(attack * SR); r = int(release * SR)
    if a > 0: e[:a] = smoothstep(np.linspace(0, 1, a))
    if r > 0: e[-r:] = smoothstep(np.linspace(1, 0, r))
    return e

def add(buf_l, buf_r, t0, sig, pan=0.0):
    a = int(t0 * SR); b = min(N, a + len(sig))
    s = sig[: b - a]
    gl = np.cos((pan + 1) * np.pi / 4); gr = np.sin((pan + 1) * np.pi / 4)
    buf_l[a:b] += s * gl; buf_r[a:b] += s * gr

def pad(midis, t0, t1, gain, attack=0.8, release=0.9, detune=0.004):
    a, b = seg(t0, t1); length = b - a
    if length <= 0: return
    tt = np.arange(length) / SR
    sig = np.zeros(length)
    for m in midis:
        f = midi(m)
        for h, hg in [(1, 1.0), (2, 0.34), (3, 0.12)]:
            sig += hg * np.sin(2 * np.pi * f * h * (1 + detune) * tt)
            sig += hg * np.sin(2 * np.pi * f * h * (1 - detune) * tt)
    sig /= (len(midis) * 3)
    sig *= env_ar(length, attack, release) * gain
    add(L, R, t0, sig, -0.08); add(L, R, t0, sig, 0.08)

def bass(m, t0, t1, gain, attack=0.05, release=0.4):
    a, b = seg(t0, t1); length = b - a
    if length <= 0: return
    tt = np.arange(length) / SR; f = midi(m)
    sig = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * f * 2 * tt))
    sig *= env_ar(length, attack, release) * gain
    add(L, R, t0, sig)

def bell(m, t0, gain, dur=0.5, pan=0.0):
    length = int(dur * SR); tt = np.arange(length) / SR; f = midi(m)
    sig = (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 2 * tt)
           + 0.25 * np.sin(2 * np.pi * f * 3 * tt))
    sig *= np.exp(-tt * 6.0) * gain
    add(L, R, t0, sig, pan)

def riser(t0, t1, gain):
    a, b = seg(t0, t1); length = b - a
    if length <= 0: return
    tt = np.arange(length) / SR; k = tt / (tt[-1] if tt[-1] else 1)
    noise = np.random.randn(length)
    noise = np.diff(noise, prepend=noise[0])           # crude high-pass -> air
    env = (k ** 2.2) * gain
    swp = np.sin(2 * np.pi * (200 + 1400 * k ** 2) * tt) * 0.25
    sig = (noise * 0.5 + swp) * env
    add(L, R, t0, sig, -0.3); add(L, R, t0, sig[::-1] * 0 + sig, 0.3)

def impact(t0, gain):
    length = int(1.2 * SR); tt = np.arange(length) / SR
    boom = np.sin(2 * np.pi * (48 * np.exp(-tt * 1.5)) * tt) * np.exp(-tt * 3.5)
    burst = np.random.randn(length) * np.exp(-tt * 18) * 0.4
    sig = (boom * 1.0 + burst) * gain
    add(L, R, t0, sig)

# ---- arrangement -------------------------------------------------------
# soft intro
pad([57, 60, 64], 0.0, 6.2, 0.16, attack=1.6, release=1.0)      # Am
bass(45, 0.2, 6.2, 0.12, attack=1.0)
bell(69, 0.3, 0.20, dur=1.6, pan=0.2)                           # logo shimmer

# build (problem)
pad([53, 57, 60], 6.0, 10.1, 0.20, attack=1.0, release=0.6)     # F
bass(41, 6.0, 10.1, 0.16)
riser(8.0, 9.95, 0.5)

# eruption -> bright resolve (ballot box)
impact(9.9, 0.9)
pad([60, 64, 67, 72], 9.95, 14.6, 0.26, attack=0.06, release=0.8)  # C (open, bright)
bass(48, 9.95, 14.6, 0.20, attack=0.02)

# energetic arpeggio + heartbeat through ballot + shift
beat = 0.5
scale_c = [60, 64, 67, 72, 76]
i = 0
tcur = 10.0
while tcur < 17.4:
    n = scale_c[i % len(scale_c)]
    bell(n, tcur, 0.10 + 0.03 * ((i % 4) == 0), dur=0.45, pan=((i % 2) * 2 - 1) * 0.35)
    tcur += beat / 2
    i += 1
# soft heartbeat pulse
tp = 6.0
while tp < 17.4:
    bell(36, tp, 0.05, dur=0.3)
    tp += beat

# shift chord movement
pad([55, 59, 62], 14.6, 17.4, 0.22, attack=0.5, release=0.5)    # G

# CTA — warm, sustained, hopeful resolve
pad([60, 64, 67, 72], 17.3, 22.0, 0.30, attack=0.9, release=2.4)  # C major
bass(48, 17.3, 22.0, 0.20, attack=0.4, release=2.0)
bell(72, 17.5, 0.18, dur=2.5, pan=-0.25)
bell(79, 17.7, 0.12, dur=2.5, pan=0.25)
bell(84, 18.0, 0.08, dur=2.0, pan=0.0)

# ---- master ------------------------------------------------------------
mix = np.vstack([L, R])
# global fades
fi = int(0.4 * SR); fo = int(1.6 * SR)
mix[:, :fi] *= smoothstep(np.linspace(0, 1, fi))
mix[:, -fo:] *= smoothstep(np.linspace(1, 0, fo))
# normalize + soft limit
peak = np.max(np.abs(mix)) or 1.0
mix = mix / peak * 0.92
mix = np.tanh(mix * 1.05) * 0.96

out = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
path = os.path.join(os.path.dirname(__file__), '..', 'public', 'music.wav')
path = os.path.abspath(path)
with wave.open(path, 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(out.tobytes())
print('wrote', path, round(os.path.getsize(path) / 1e6, 2), 'MB')
