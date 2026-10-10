"""Method A: crop, upscale, binarize and vectorize the source (potrace or vtracer); returns the three logo layers."""
from __future__ import annotations

import re

import cv2
import numpy as np
import potrace

from brand_common import *

UPSCALE = 8
TURD = 6
SUB_ALPHA = 0.396
EYES_X = (170, 300)
EYES_Y = (68, 92)


def region_mask(gray: np.ndarray, box: tuple, threshold: float, blur: float) -> np.ndarray:
    x0, y0, x1, y1 = box
    big = cv2.resize(gray[y0:y1, x0:x1], None, fx=UPSCALE, fy=UPSCALE, interpolation=cv2.INTER_CUBIC)
    return cv2.GaussianBlur(big, (0, 0), blur) < threshold


def masks(gray: np.ndarray, blur: float) -> dict:
    mark = region_mask(gray, MARK_BOX, MARK_THRESHOLD, blur)
    eyes = region_mask(gray, MARK_BOX, EYE_THRESHOLD, blur)
    window = np.zeros_like(mark)
    window[EYES_Y[0] * UPSCALE:EYES_Y[1] * UPSCALE, (EYES_X[0] - MARK_BOX[0]) * UPSCALE:(EYES_X[1] - MARK_BOX[0]) * UPSCALE] = True
    return {
        "mark": (mark | (eyes & window), MARK_BOX[:2]),
        "glyph": (region_mask(gray, GLYPH_BOX, GLYPH_THRESHOLD, blur), GLYPH_BOX[:2]),
        "sub": (region_mask(gray, SUB_BOX, SUB_THRESHOLD, blur), SUB_BOX[:2]),
    }


def potrace_path(mask: np.ndarray, origin: tuple, alphamax: float, opttol: float) -> str:
    plist = potrace.Bitmap(~mask).trace(turdsize=TURD, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=alphamax, opticurve=True, opttolerance=opttol)
    ox, oy = origin
    f = lambda p: f"{p.x / UPSCALE + ox:.2f} {p.y / UPSCALE + oy:.2f}"
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


def vtracer_elements(mask: np.ndarray, origin: tuple) -> list:
    import vtracer
    image = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).convert("RGB")
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    svg = vtracer.convert_raw_image_to_svg(buf.getvalue(), img_format="png", colormode="binary", hierarchical="cutout", mode="spline",
                                            filter_speckle=4, corner_threshold=60, length_threshold=4.0, splice_threshold=45, path_precision=2)
    ox, oy = origin
    out = []
    for m in re.finditer(r'<path[^>]*?d="([^"]+)"[^>]*?transform="translate\(([-\d.]+),([-\d.]+)\)"', svg):
        d, tx, ty = m.group(1), float(m.group(2)), float(m.group(3))
        out.append({"d": d, "kind": "fill", "transform": f"translate({ox} {oy}) scale({1 / UPSCALE}) translate({tx} {ty})"})
    return out


def trace_layers(gray: np.ndarray, tool: str = "potrace", blur: float = 1.6, alphamax: float = 1.0, opttol: float = 0.4) -> dict:
    layers = {}
    for key, (mask, origin) in masks(gray, blur).items():
        if tool == "potrace":
            els = [{"d": potrace_path(mask, origin, alphamax, opttol), "kind": "fill"}]
        else:
            els = vtracer_elements(mask, origin)
        if key == "sub":
            for el in els:
                el["alpha"] = SUB_ALPHA
        layers[key] = els
    return layers
