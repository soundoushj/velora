#!/usr/bin/env python3
"""
VELORA — normalise perfume photos so every bottle sits centred in a square canvas
with the same visual scale.

  originals:  assets-originals/perfumes/<id>.jpg   (never modified)
  output:     public/assets/perfumes/<id>.jpg      (900x900, same filenames)

For each photo the script
  1. flattens the background to white (some shots are light grey / cream),
  2. removes thin full-width studio lines (e.g. the baseline under Bad Boy Cobalt),
  3. finds the bottle's bounding box,
  4. scales it (aspect ratio preserved, never stretched) to a consistent size,
  5. centres it on a white square canvas with balanced margins.

Run:  pip install pillow numpy && python3 scripts/normalize-perfumes.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-originals" / "perfumes"
DST = ROOT / "public" / "assets" / "perfumes"

SIZE = 900            # output canvas (px). Cards display ~300-450 css px, so 2x is crisp.
FIT_MAX = 0.80        # slim / tall bottles: longest side = 80 % of the canvas
FIT_MIN = 0.71        # boxy / square bottles: slightly smaller so they don't look bigger
OBJECT_THRESHOLD = 232  # min-channel value below which a pixel counts as "bottle"
EDGE_IGNORE = 0.012   # ignore a thin frame at the image border (scan artefacts)


def flatten_background(a: np.ndarray) -> np.ndarray:
    """Divide by the border colour so a grey/cream backdrop becomes white."""
    h, w, _ = a.shape
    b = max(2, int(min(h, w) * 0.01))
    border = np.concatenate([a[:b].reshape(-1, 3), a[-b:].reshape(-1, 3),
                             a[:, :b].reshape(-1, 3), a[:, -b:].reshape(-1, 3)])
    # use the lightest common border colour (ignores dark baseline lines at the edge)
    bg = np.percentile(border, 70, axis=0)
    out = np.clip(a * (255.0 / np.maximum(bg, 1)), 0, 255)
    out[(out >= 248).all(axis=2)] = 255
    return out


def remove_rule_lines(a: np.ndarray) -> np.ndarray:
    """Paint over thin, near full-width dark horizontal lines (studio baselines).

    Only short runs of rows (<= 1.5 % of the image height) are treated as lines,
    so a tall dark bottle body is never mistaken for one."""
    h, w, _ = a.shape
    dark = a.min(axis=2) < 120
    is_line = dark.mean(axis=1) > 0.9
    a = a.copy()
    y = 0
    while y < h:
        if is_line[y]:
            y2 = y
            while y2 < h and is_line[y2]:
                y2 += 1
            if (y2 - y) <= max(2, int(h * 0.015)):
                a[y:y2, :, :] = 255
            y = y2
        else:
            y += 1
    return a


def bottle_bbox(a: np.ndarray):
    h, w, _ = a.shape
    mask = a.min(axis=2) < OBJECT_THRESHOLD
    ey, ex = int(h * EDGE_IGNORE), int(w * EDGE_IGNORE)
    mask[:ey, :] = False; mask[h - ey:, :] = False
    mask[:, :ex] = False; mask[:, w - ex:] = False
    # require a few pixels per row/column so isolated specks don't stretch the box
    rows = np.where(mask.sum(axis=1) >= 3)[0]
    cols = np.where(mask.sum(axis=0) >= 3)[0]
    return cols[0], rows[0], cols[-1] + 1, rows[-1] + 1


def process(path: Path) -> dict:
    src = Image.open(path).convert("RGB")
    a = np.asarray(src).astype(np.float32)
    a = remove_rule_lines(flatten_background(a))
    x0, y0, x1, y1 = bottle_bbox(a)
    bw, bh = x1 - x0, y1 - y0

    ratio = min(bw, bh) / max(bw, bh)
    t = min(max((ratio - 0.5) / 0.45, 0.0), 1.0)
    fit = FIT_MAX - (FIT_MAX - FIT_MIN) * t
    scale = fit * SIZE / max(bw, bh)

    # crop a little beyond the bbox so soft shadows / reflections are kept, then scale
    pad = int(max(bw, bh) * 0.04)
    cx0, cy0 = max(0, x0 - pad), max(0, y0 - pad)
    cx1, cy1 = min(a.shape[1], x1 + pad), min(a.shape[0], y1 + pad)
    crop = Image.fromarray(a[cy0:cy1, cx0:cx1].astype(np.uint8))
    nw, nh = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
    crop = crop.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGB", (SIZE, SIZE), (255, 255, 255))
    # centre the *bottle* (not the padded crop) on the canvas
    bcx = ((x0 + x1) / 2 - cx0) * scale
    bcy = ((y0 + y1) / 2 - cy0) * scale
    canvas.paste(crop, (round(SIZE / 2 - bcx), round(SIZE / 2 - bcy)))
    canvas.save(DST / path.name, "JPEG", quality=92, optimize=True, progressive=True, subsampling=0)
    return dict(name=path.name, src=src.size, bbox=(bw, bh), fit=round(fit, 3), upscale=round(scale, 2))


if __name__ == "__main__":
    DST.mkdir(parents=True, exist_ok=True)
    for p in sorted(SRC.glob("*.jpg")):
        r = process(p)
        flag = "  <- low-res source, consider a sharper photo" if r["upscale"] > 2.2 else ""
        print(f"{r['name']:42s} src={r['src']} bottle={r['bbox']} fit={r['fit']} x{r['upscale']}{flag}")
