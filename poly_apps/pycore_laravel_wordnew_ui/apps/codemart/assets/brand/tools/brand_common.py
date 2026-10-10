"""Shared geometry, regions and scoring for the CodeMart brand candidates."""
from __future__ import annotations

import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

BRAND_DIR = Path(__file__).resolve().parent.parent
SOURCE = BRAND_DIR / "source" / "codemart-logo-source.jpg"
CANDIDATES_DIR = BRAND_DIR / "candidates"
MANIFEST = BRAND_DIR / "manifest.json"
SRC_W, SRC_H = 619, 162
MARK_BOX = (140, 0, 335, SRC_H)
GLYPH_BOX = (340, 0, SRC_W, 108)
SUB_BOX = (340, 108, SRC_W, SRC_H)
GLYPH_COLOR = "#000000"
SUB_COLOR = "#9a9a9a"
MARK_COLOR = "#000000"
GLYPH_THRESHOLD = 128
SUB_THRESHOLD = 205
MARK_THRESHOLD = 128
EYE_THRESHOLD = 205
SCORE_SCALE = 4


def source_gray() -> np.ndarray:
    return np.array(Image.open(SOURCE).convert("L"), dtype=np.float32)


def render_svg(svg: str, width: int, height: int | None = None) -> Image.Image:
    import resvg_py
    data = resvg_py.svg_to_bytes(svg_string=svg, width=width, height=height) if height else resvg_py.svg_to_bytes(svg_string=svg, width=width)
    return Image.open(io.BytesIO(bytes(data))).convert("RGBA")


def flatten_gray(image: Image.Image) -> np.ndarray:
    base = Image.new("RGBA", image.size, (255, 255, 255, 255))
    base.alpha_composite(image)
    return np.array(base.convert("L"), dtype=np.float32)


def score_gray(candidate: np.ndarray, reference: np.ndarray | None = None) -> dict:
    from skimage.metrics import structural_similarity
    ref = source_gray() if reference is None else reference
    if candidate.shape != ref.shape:
        candidate = np.array(Image.fromarray(candidate.astype(np.uint8)).resize((ref.shape[1], ref.shape[0]), Image.LANCZOS), dtype=np.float32)
    a, b = ref < 160, candidate < 160
    union = np.logical_or(a, b).sum()
    iou = float(np.logical_and(a, b).sum() / union) if union else 1.0
    ssim = float(structural_similarity(ref, candidate, data_range=255))
    return {"iou": round(iou, 4), "ssim": round(ssim, 4), "score": round(0.5 * iou + 0.5 * ssim, 4)}
