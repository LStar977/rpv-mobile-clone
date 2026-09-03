"""Data-plates for the Represent investor deck ("The First Mark" system).

Every image is drawn from the company's true numbers. Plates render at 2x
and downsample LANCZOS; gold geometry gets a screen-blended glow; a whisper
of grain keeps the dark fields from banding. Backgrounds are exactly the
slide obsidian so plates merge seamlessly with the page.
"""
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OBSIDIAN = (4, 7, 7)
GOLD = (234, 186, 88)
INK = (244, 245, 246)
MUTED = (122, 125, 126)

FULL_W, FULL_H = 4000, 2250  # 300 px/in over 13.333 x 7.5


def ink_a(alpha):
    return INK + (int(255 * alpha),)


def gold_a(alpha=1.0):
    return GOLD + (int(255 * alpha),)


def muted_a(alpha):
    return MUTED + (int(255 * alpha),)


class Plate:
    """RGBA canvas at 2x with a separate gold layer for the glow pass."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.base = Image.new('RGB', (w * 2, h * 2), OBSIDIAN)
        self.ink_layer = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0))
        self.gold_layer = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0))
        self.ink = ImageDraw.Draw(self.ink_layer)
        self.gold = ImageDraw.Draw(self.gold_layer)

    def finish(self, path, glow_radius=36, glow_opacity=0.45):
        img = self.base.convert('RGB')
        img.paste(self.ink_layer, (0, 0), self.ink_layer)
        # glow: blurred gold copy, screen-blended beneath the sharp gold
        if self.gold_layer.getbbox():
            blur = self.gold_layer.filter(ImageFilter.GaussianBlur(glow_radius))
            faded = blur.point(lambda v: v)  # copy
            alpha = faded.split()[3].point(lambda v: int(v * glow_opacity))
            faded.putalpha(alpha)
            glow_rgb = Image.new('RGB', img.size, (0, 0, 0))
            glow_rgb.paste(faded, (0, 0), faded)
            img = Image.fromarray(
                (255 - (255 - np.asarray(img, np.uint16)) *
                 (255 - np.asarray(glow_rgb, np.uint16)) // 255).astype(np.uint8))
            img.paste(self.gold_layer, (0, 0), self.gold_layer)
        img = img.resize((self.w, self.h), Image.LANCZOS)
        arr = np.asarray(img, np.int16)
        rng = np.random.default_rng(7)
        arr = np.clip(arr + rng.integers(-2, 3, arr.shape), 0, 255).astype(np.uint8)
        Image.fromarray(arr).save(path, 'JPEG', quality=88)
        print(path)


# ── P01 · The silent centuries ──────────────────────────────────────────────

def p01_silent_centuries(path):
    p = Plate(FULL_W, FULL_H)
    X0, X1 = 800, 7200  # 2x coords
    year_x = lambda t: X0 + (X1 - X0) * (t - 1867) / 159.0
    rows = [(2360, 'CA'), (3000, 'UK'), (3640, 'US')]
    for y, nation in rows:
        p.ink.rectangle([X0, y, X1, y + 2], fill=ink_a(0.14))
        if nation == 'US':
            continue  # the bare, unbroken line IS the drawing
        for t in range(1867, 2027):
            x = year_x(t)
            tall = t % 10 == 0
            h = 80 if tall else 56
            a = 0.30 if tall else 0.20
            p.ink.rectangle([x - 2, y - h, x + 2, y], fill=ink_a(a))
    lit = {'CA': [1898, 1942, 1992], 'UK': [1975, 2011, 2016]}
    for y, nation in rows:
        for t in lit.get(nation, []):
            x = year_x(t)
            p.gold.rectangle([x - 4, y - 128, x + 4, y], fill=gold_a())
    # bracket: 1992 -> 2026 under the Canada row
    bx0, bx1, by = year_x(1992), year_x(2026), 2360 + 70
    p.ink.rectangle([bx0, by, bx1, by + 2], fill=ink_a(0.10))
    p.ink.rectangle([bx0, by - 16, bx0 + 2, by], fill=ink_a(0.10))
    p.ink.rectangle([bx1 - 2, by - 16, bx1, by], fill=ink_a(0.10))
    p.finish(path)


# ── P02 · The city that answered / dismantled ───────────────────────────────

def _calgary_dots(dim=1.0, seed=2018):
    """Exact 304,582 dots: first 171,750 by x are NO (muted), rest YES (ink)."""
    rng = random.Random(seed)
    cols, rows_n = 903, 338
    cells = [(c, r) for c in range(cols) for r in range(rows_n)]
    kill = set(rng.sample(range(len(cells)), cols * rows_n - 304582))
    X0, Y0 = 800, 1440
    CW, CH = (7200 - 800) / cols, (3840 - 1440) / rows_n
    dots = []
    for i, (c, r) in enumerate(cells):
        if i in kill:
            continue
        x = X0 + (c + 0.5) * CW + rng.uniform(-3.2, 3.2)
        y = Y0 + (r + 0.5) * CH + rng.uniform(-3.2, 3.2)
        dots.append((x, y))
    # soft seam: order by x plus noise, split at the exact NO count, so the
    # transition breathes over ~300px while totals stay exact
    dots.sort(key=lambda d: d[0] + rng.gauss(0, 150))
    out = []
    for i, (x, y) in enumerate(dots):
        if i < 171750:
            col, a = MUTED, rng.uniform(0.30, 0.52)
        else:
            col, a = INK, rng.uniform(0.42, 0.66)
        # feather the field edges so the crowd floats in obsidian
        fx = min(1.0, (x - 800) / 260.0, (7200 - x) / 260.0)
        fy = min(1.0, (y - 1440) / 200.0, (3840 - y) / 200.0)
        f = max(0.0, min(fx, fy))
        f = f * f * (3 - 2 * f)
        out.append((x, y, col + (int(255 * a * dim * f),)))
    return out


def p02_city(path, dismantled=False):
    p = Plate(FULL_W, FULL_H)
    dim = 0.38 if dismantled else 1.0
    for x, y, col in _calgary_dots(dim=dim):
        p.ink.ellipse([x - 2, y - 2, x + 2, y + 2], fill=col)
    if dismantled:
        p.gold.rectangle([800, 2634, 7200, 2646], fill=gold_a())
    p.finish(path)


# ── P03 · One of 300,000 ────────────────────────────────────────────────────

def p03_one_line(path):
    p = Plate(FULL_W, FULL_H)
    cx, cy, R = 2900, 2660, 1660
    rng = random.Random(300000)
    step = 5.37
    n = 0
    y = cy - R
    while y <= cy + R:
        half = math.sqrt(max(0.0, R * R - (y - cy) ** 2))
        x = cx - half
        while x <= cx + half:
            d = math.hypot(x - cx, y - cy) / R
            a = 0.09 + 0.22 * (1 - d) ** 2
            jx, jy = x + rng.uniform(-2, 2), y + rng.uniform(-2, 2)
            p.ink.ellipse([jx - 2, jy - 2, jx + 2, jy + 2], fill=ink_a(a))
            x += step
            n += 1
        y += step
    # the representative: one fully-lit dot, alone
    rx, ry = 6240, 2660
    p.ink.ellipse([rx - 12, ry - 12, rx + 12, ry + 12], fill=ink_a(1.0))
    # the single gold thread — the only channel
    pts = []
    x0, y0 = cx + R + 20, 2660
    bez = [(x0, y0), (5240, 2360), (5680, 2940), (rx - 28, ry)]
    for i in range(200):
        t = i / 199
        mt = 1 - t
        bx = (mt ** 3 * bez[0][0] + 3 * mt * mt * t * bez[1][0] +
              3 * mt * t * t * bez[2][0] + t ** 3 * bez[3][0])
        by = (mt ** 3 * bez[0][1] + 3 * mt * mt * t * bez[1][1] +
              3 * mt * t * t * bez[2][1] + t ** 3 * bez[3][1])
        pts.append((bx, by))
    p.gold.line(pts, fill=gold_a(), width=4)
    p.finish(path)
    return n


# ── P04 · The seal (half-slide) ─────────────────────────────────────────────

def p04_seal(path, open_fill=0.62, seal_counts=(4, 7, 2, 9)):
    p = Plate(2000, 2250)
    rng = random.Random(10)
    BX0, BX1, BH = 440, 3360, 184
    tops = [840, 1400, 1960, 2520, 3080]
    for i, ty in enumerate(tops):
        p.ink.rectangle([BX0, ty, BX1, ty + BH], outline=ink_a(0.30), width=2)
        if i < 4:
            static = Image.new('RGBA', (BX1 - BX0 - 8, BH - 8), (0, 0, 0, 0))
            arr = np.zeros((static.size[1], static.size[0], 4), np.uint8)
            mask = np.random.default_rng(i).random(arr.shape[:2]) < 0.38
            alpha = np.random.default_rng(i + 50).integers(90, 205, arr.shape[:2])
            arr[..., 0][mask] = INK[0]
            arr[..., 1][mask] = INK[1]
            arr[..., 2][mask] = INK[2]
            arr[..., 3][mask] = alpha[mask]
            static = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(1.2))
            p.ink_layer.paste(static, (BX0 + 4, ty + 4), static)
        else:
            fx = BX0 + 4 + (BX1 - BX0 - 8) * open_fill
            p.ink.rectangle([BX0 + 4, ty + 4, fx, ty + BH - 4], fill=ink_a(0.85))
            p.gold.rectangle([fx - 2, ty - 24, fx + 2, ty + BH + 24], fill=gold_a())
    p.finish(path)


# ── P05 · Three minutes inside three years ──────────────────────────────────

def p05_rings(path):
    p = Plate(2250, 2250)
    cx = cy = 2250
    for i in range(1095):
        a = 2 * math.pi * i / 1095 - math.pi / 2
        r0, r1 = 1880, 1970
        p.ink.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)),
                    (cx + r1 * math.cos(a), cy + r1 * math.sin(a))],
                   fill=ink_a(0.11), width=2)
    for i in range(180):
        a = 2 * math.pi * i / 180 - math.pi / 2
        minute_mark = i % 60 == 0
        r0 = 1430 if minute_mark else 1510
        r1 = 1640
        p.ink.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)),
                    (cx + r1 * math.cos(a), cy + r1 * math.sin(a))],
                   fill=ink_a(0.50 if minute_mark else 0.33), width=3)
    p.finish(path)


# ── P06 · True scale ────────────────────────────────────────────────────────

def _cluster(p, draw, x0, y_base, count, pitch, r, fill, cols):
    rows = math.ceil(count / cols)
    k = 0
    for rr in range(rows):
        for cc in range(cols):
            if k >= count:
                return
            x = x0 + cc * pitch
            y = y_base - (rows - 1 - rr) * pitch
            draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)
            k += 1


def p06_true_scale(path):
    """Traction at true scale. The verified-human cluster is drawn as an
    overlapping, glowing gold mass that cannot be counted off the slide —
    the canon says 'a few dozen' and no exact figure exists."""
    p = Plate(FULL_W, FULL_H)
    rng = random.Random(6)
    # reference swatch: exactly 10,000 voters at the Calgary dot grammar
    sx, sy, side = 1000, 2100, 1000
    cols = 100
    for i in range(10000):
        c, r = i % cols, i // cols
        x = sx + (c + 0.5) * side / cols + rng.uniform(-2.4, 2.4)
        y = sy + (r + 0.5) * side / cols + rng.uniform(-2.4, 2.4)
        p.ink.ellipse([x - 3, y - 3, x + 3, y + 3], fill=ink_a(0.45))
    base = 3100
    _cluster(p, p.ink, 3500, base, 157, 28, 4, ink_a(0.80), 13)
    _cluster(p, p.ink, 4900, base, 190, 28, 4, ink_a(0.80), 19)
    grng = random.Random(64)
    for _ in range(44):
        ang = grng.uniform(0, 2 * math.pi)
        rad = 120 * math.sqrt(grng.uniform(0, 1))
        x = 6450 + rad * math.cos(ang)
        y = base - 130 + rad * math.sin(ang) * 0.8
        p.gold.ellipse([x - 11, y - 11, x + 11, y + 11],
                       fill=gold_a(grng.uniform(0.55, 0.95)))
    p.finish(path)


# ── P07 · The tranche thread ────────────────────────────────────────────────

def p07_thread(path, nodes=4):
    p = Plate(FULL_W, FULL_H)
    x0, y0, x1, y1 = 800, 2840, 7200, 2760
    pts = []
    for i in range(400):
        t = i / 399
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + 26 * math.sin(t * math.pi * 1.7)
        pts.append((x, y))
    p.gold.line(pts, fill=gold_a(), width=4)
    p.gold.ellipse([x0 - 14, y0 - 14, x0 + 14, y0 + 14], fill=gold_a())
    for i in range(1, nodes + 1):
        t = i / nodes
        idx = min(399, int(t * 399))
        nx, ny = pts[idx]
        r = 46
        p.gold.ellipse([nx - r, ny - r, nx + r, ny + r],
                       outline=gold_a(), width=4)
        p.ink.ellipse([nx - r + 4, ny - r + 4, nx + r - 4, ny + r - 4],
                      fill=OBSIDIAN + (255,))
    p.finish(path)


if __name__ == '__main__':
    import sys
    which = sys.argv[1:] or ['p01', 'p02a', 'p02b', 'p03', 'p04', 'p05', 'p06', 'p07']
    if 'p01' in which:
        p01_silent_centuries('plate01.png')
    if 'p02a' in which:
        p02_city('plate02a.png')
    if 'p02b' in which:
        p02_city('plate02b.png', dismantled=True)
    if 'p03' in which:
        print('dots:', p03_one_line('plate03.png'))
    if 'p04' in which:
        p04_seal('plate04.png')
    if 'p05' in which:
        p05_rings('plate05.png')
    if 'p06' in which:
        p06_true_scale('plate06.png')
    if 'p07' in which:
        p07_thread('plate07.png')
