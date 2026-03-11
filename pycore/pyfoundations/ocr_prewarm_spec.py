# -*- coding: utf-8 -*-
"""
Single source of truth for OCR prewarm: zh / en / cht, each with latest models per language.
Drives both HF download (ocr_hf_models) and prewarm (third_party _init_cnocr_multilang).

Refs:
- CnOCR install: https://cnocr.readthedocs.io/zh-cn/stable/install/
  GPU vs CPU: onnxruntime and onnxruntime-gpu are mutually exclusive (uninstall onnxruntime then install onnxruntime-gpu).
- CnOCR models: https://cnocr.readthedocs.io/zh-cn/stable/models/
- HF collection: https://huggingface.co/collections/breezedeus/cnocr
"""
from __future__ import annotations

from typing import Tuple, Dict, Any

# ONNX Runtime: GPU and CPU packages are mutually exclusive (cnocr install doc).
# Use cnocr[ort-gpu] when CUDA available else cnocr[ort-cpu]; do not install both.

# Per-language latest: det/rec model names and HF source (repos or bundle zip).
# prewarm_det/rec are the model names passed to CnOcr(); when GPU we prefer _server variant when present.
PREWARM_SPEC: Dict[str, Dict[str, Any]] = {
    "zh": {
        "det_repos": (
            "breezedeus/cnstd-ppocr-ch_PP-OCRv5_det",
            "breezedeus/cnstd-ppocr-ch_PP-OCRv5_det_server",
        ),
        "rec_repos": (
            "breezedeus/cnocr-ppocr-ch_PP-OCRv5",
            "breezedeus/cnocr-ppocr-ch_PP-OCRv5_server",
        ),
        "det_zips": (),
        "rec_zips": (),
        "prewarm_det": "ch_PP-OCRv5_det",
        "prewarm_det_server": "ch_PP-OCRv5_det_server",
        "prewarm_rec": "ch_PP-OCRv5",
        "prewarm_rec_server": "ch_PP-OCRv5_server",
    },
    "en": {
        "det_repos": ("breezedeus/cnstd-ppocr-en_PP-OCRv3_det",),
        "rec_repos": (
            "breezedeus/cnocr-ppocr-en_PP-OCRv4",
            "breezedeus/cnocr-ppocr-en_PP-OCRv3",
        ),
        "det_zips": (),
        "rec_zips": (),
        "prewarm_det": "en_PP-OCRv3_det",
        "prewarm_det_server": None,
        "prewarm_rec": "en_PP-OCRv4",
        "prewarm_rec_fallbacks": ("en_PP-OCRv3",),
    },
    "cht": {
        "det_repos": (),
        "rec_repos": (),
        "det_zips": ("ch_PP-OCRv3_det_infer-onnx.zip",),
        "rec_zips": ("chinese_cht_PP-OCRv3_rec_infer-onnx.zip",),
        "prewarm_det": "ch_PP-OCRv3_det",
        "prewarm_det_server": None,
        "prewarm_rec": "chinese_cht_PP-OCRv3",
        "prewarm_rec_fallbacks": (),
    },
}

PREWARM_LANGUAGES: Tuple[str, ...] = ("zh", "en", "cht")

# Single config for CnOcr(rec_more_configs=...). Used by prewarm (OcrInitializer) and by CnOCREngine.init()
# so that initialization and engine creation stay aligned. font_path=None lets rapidocr use default font.
REC_MORE_CONFIGS_CNOCR: Dict[str, Any] = {"font_path": None}


def all_cnstd_repos() -> Tuple[str, ...]:
    """Union of all det repos from spec (for download)."""
    seen: set = set()
    for lang in PREWARM_LANGUAGES:
        for r in PREWARM_SPEC[lang]["det_repos"]:
            seen.add(r)
    return tuple(sorted(seen))


def all_cnocr_repos() -> Tuple[str, ...]:
    """Union of all rec repos from spec (for download)."""
    seen: set = set()
    for lang in PREWARM_LANGUAGES:
        for r in PREWARM_SPEC[lang]["rec_repos"]:
            seen.add(r)
    return tuple(sorted(seen))


def all_cnstd_zips() -> Tuple[str, ...]:
    """Union of all det zips from spec (bundle allowlist)."""
    seen: set = set()
    for lang in PREWARM_LANGUAGES:
        for z in PREWARM_SPEC[lang]["det_zips"]:
            seen.add(z)
    return tuple(sorted(seen))


def all_cnocr_zips() -> Tuple[str, ...]:
    """Union of all rec zips from spec (bundle allowlist)."""
    seen: set = set()
    for lang in PREWARM_LANGUAGES:
        for z in PREWARM_SPEC[lang]["rec_zips"]:
            seen.add(z)
    return tuple(sorted(seen))


def prewarm_det_rec_for_lang(lang: str, use_gpu: bool) -> Tuple[str, Tuple[str, ...]]:
    """
    Return (det_model_name, (rec_primary, rec_fallback, ...)) for CnOcr(det_model_name=..., rec_model_name=...).
    When use_gpu and spec has _server, prefer server variant for zh.
    """
    s = PREWARM_SPEC.get(lang)
    if not s:
        return "ch_PP-OCRv5_det", ("ch_PP-OCRv5",)
    det = s["prewarm_det"]
    if use_gpu and s.get("prewarm_det_server"):
        det = s["prewarm_det_server"]
    rec_primary = s["prewarm_rec"]
    if use_gpu and s.get("prewarm_rec_server"):
        rec_primary = s["prewarm_rec_server"]
    fallbacks = s.get("prewarm_rec_fallbacks") or ()
    rec_order = (rec_primary,) + fallbacks
    return det, rec_order
