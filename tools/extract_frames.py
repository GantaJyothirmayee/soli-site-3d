#!/usr/bin/env python3
"""Extract a WebP frame sequence from a single clip (no crossfade/concat).
Usage: extract_frames.py <src.mp4> <out_dir> <fps> <width>
Writes frame_0001.webp... + manifest.json {count, pattern}
"""
import sys, os, subprocess
from PIL import Image

src, out_dir, fps, width = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
os.makedirs(out_dir, exist_ok=True)
for f in os.listdir(out_dir):
    if f.endswith((".webp", ".png")):
        os.remove(os.path.join(out_dir, f))

subprocess.run([
    "ffmpeg", "-y", "-v", "error", "-i", src,
    "-vf", f"fps={fps},scale={width}:-2",
    os.path.join(out_dir, "frame_%04d.png"),
], check=True)

pngs = sorted(f for f in os.listdir(out_dir) if f.endswith(".png"))
for f in pngs:
    p = os.path.join(out_dir, f)
    Image.open(p).convert("RGB").save(p.replace(".png", ".webp"), "WEBP", quality=82, method=5)
    os.remove(p)

import json
with open(os.path.join(out_dir, "manifest.json"), "w") as fh:
    json.dump({"count": len(pngs), "pattern": "frame_%04d.webp"}, fh)

size = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir)) / 1e6
print(f"{src} -> {len(pngs)} frames, {size:.1f} MB in {out_dir}")
