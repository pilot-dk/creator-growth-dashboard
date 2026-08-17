#!/usr/bin/env python3
"""Generate the app icon.

Renders a macOS-style squircle with the app's red-to-purple brand gradient and
three ascending bars, then emits the full .iconset and a packed .icns.

Everything is drawn at 4x and downsampled with LANCZOS so the curves stay clean
at the 16px sizes macOS uses in the Finder sidebar and Cmd-Tab switcher.

Usage: python3 scripts/make-icon.py
"""
import math
import pathlib
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw

SIZE = 1024
SS = 4  # supersample factor
W = SIZE * SS

# Brand colors, matching --youtube and --twitch in the renderer stylesheet.
C1 = (255, 77, 94)    # #FF4D5E
C2 = (169, 112, 255)  # #A970FF

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"


def squircle_points(cx, cy, r, n=5.0, steps=1440):
    """Superellipse outline — closer to Apple's continuous corners than a plain
    rounded rectangle, which looks visibly wrong beside other macOS icons."""
    pts = []
    e = 2.0 / n
    for i in range(steps):
        t = 2 * math.pi * i / steps
        ct, st = math.cos(t), math.sin(t)
        x = cx + r * math.copysign(abs(ct) ** e, ct)
        y = cy + r * math.copysign(abs(st) ** e, st)
        pts.append((x, y))
    return pts


def build_master():
    # Diagonal gradient across the full canvas.
    grad = Image.new("RGB", (W, W))
    gd = ImageDraw.Draw(grad)
    # Draw as diagonal bands: color depends on (x+y), so step over that sum.
    for s in range(2 * W):
        t = s / (2 * W - 1)
        col = tuple(round(C1[i] + (C2[i] - C1[i]) * t) for i in range(3))
        gd.line([(s, 0), (0, s)], fill=col, width=2)

    # Squircle mask, inset to match Apple's icon grid (824/1024 of the canvas).
    mask = Image.new("L", (W, W), 0)
    md = ImageDraw.Draw(mask)
    md.polygon(squircle_points(W / 2, W / 2, 412 * SS), fill=255)

    icon = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    icon.paste(grad, (0, 0), mask)

    # Ascending bars, drawn into their own layer so they can be composited
    # with a single alpha rather than blending each one separately.
    bars = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bars)
    bottom, top = 720, 300
    span = bottom - top
    bar_w, gap, x0 = 108, 50, 300
    for i, frac in enumerate((0.45, 0.72, 1.0)):
        x = x0 + i * (bar_w + gap)
        y = bottom - span * frac
        bd.rounded_rectangle(
            [x * SS, y * SS, (x + bar_w) * SS, bottom * SS],
            radius=30 * SS,
            fill=(255, 255, 255, 240),
        )
    icon = Image.alpha_composite(icon, bars)

    return icon.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    if shutil.which("iconutil") is None:
        sys.exit("iconutil not found — this script needs macOS.")

    BUILD.mkdir(exist_ok=True)
    master = build_master()
    master.save(BUILD / "icon.png")

    # electron-builder wants a .icns for mac and a 512px .png for other targets.
    iconset = BUILD / "icon.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir()

    for base in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            px = base * scale
            suffix = "@2x" if scale == 2 else ""
            master.resize((px, px), Image.LANCZOS).save(
                iconset / f"icon_{base}x{base}{suffix}.png"
            )

    subprocess.run(
        ["iconutil", "-c", "icns", str(iconset), "-o", str(BUILD / "icon.icns")],
        check=True,
    )
    shutil.rmtree(iconset)
    print(f"wrote {BUILD/'icon.icns'} and {BUILD/'icon.png'}")


if __name__ == "__main__":
    main()
