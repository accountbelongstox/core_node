"""Method A: crop, upscale, binarize and vectorize the source with potrace; writes the three logo forms."""
from __future__ import annotations

import sys
import cv2
import numpy as np
import potrace

from brand_common import *

UPSCALE = 8
BLUR_SIGMA = 1.6
TURD = 6
ALPHAMAX = 1.0
OPTTOL = 0.4
EYES_X = (170, 300)
EYES_Y = (68, 92)


def region_mask(gray: np.ndarray, box: tuple, threshold: float, upscale: int = UPSCALE) -> np.ndarray:
    x0, y0, x1, y1 = box
    crop = gray[y0:y1, x0:x1]
    big = cv2.resize(crop, None, fx=upscale, fy=upscale, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), BLUR_SIGMA)
    return big < threshold


def path_data(mask: np.ndarray, origin: tuple, upscale: int = UPSCALE) -> str:
    plist = potrace.Bitmap(~mask).trace(turdsize=TURD, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=ALPHAMAX, opticurve=True, opttolerance=OPTTOL)
    ox, oy = origin
    f = lambda p: f"{p.x / upscale + ox:.2f} {p.y / upscale + oy:.2f}"
    parts = []
    for curve in plist:
        parts.append("M" + f(curve.start_point))
        for seg in curve.segments:
            if seg.is_corner:
                parts.append("L" + f(seg.c) + "L" + f(seg.end_point))
            else:
                parts.append("C" + f(seg.c1) + " " + f(seg.c2) + " " + f(seg.end_point))
        parts.append("Z")
    return "".join(parts)


def trace_layers(gray: np.ndarray) -> dict:
    mark = region_mask(gray, MARK_BOX, MARK_THRESHOLD)
    eyes = region_mask(gray, MARK_BOX, EYE_THRESHOLD)
    window = np.zeros_like(mark)
    window[EYES_Y[0] * UPSCALE:EYES_Y[1] * UPSCALE, (EYES_X[0] - MARK_BOX[0]) * UPSCALE:(EYES_X[1] - MARK_BOX[0]) * UPSCALE] = True
    mark = mark | (eyes & window)
    glyph = region_mask(gray, GLYPH_BOX, GLYPH_THRESHOLD)
    sub = region_mask(gray, SUB_BOX, SUB_THRESHOLD)
    return {
        "mark": path_data(mark, MARK_BOX[:2]),
        "glyph": path_data(glyph, GLYPH_BOX[:2]),
        "sub": path_data(sub, SUB_BOX[:2]),
    }


if __name__ == "__main__":
    layers = trace_layers(source_gray())
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    (out / "layers.json").write_text(json.dumps(layers))
    print({k: len(v) for k, v in layers.items()})
