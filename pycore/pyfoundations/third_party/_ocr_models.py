# -*- coding: utf-8 -*-
"""
OCR prewarm spec (zh / en / cht) and installed-weight presence checks.

CnSTD/CnOCR weights are installed only by the shell step CNOCR_INSTALLER;
this module never downloads them.

Refs:
- CnOCR install: https://cnocr.readthedocs.io/zh-cn/stable/install/
- CnOCR models: https://cnocr.readthedocs.io/zh-cn/stable/models/
- HF collection: https://huggingface.co/collections/breezedeus/cnocr

CnSTD root: CNSTD_HOME (default <shared download cache>/ocr/cnstd), expects 1.2/ppocr/<model>/<model>_infer.onnx
CnOCR root: CNOCR_HOME (default <shared download cache>/ocr/cnocr), expects 2.3/ppocr/<model>/<model>_rec_infer.onnx
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_shared_download_cache_dir


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


# ---------------------------------------------------------------------------
# OCR model presence. CnSTD/CnOCR weights are installed only by the shell
# prerequisite step CNOCR_INSTALLER; runtime code checks presence and reports.
# ---------------------------------------------------------------------------
CNOCR_INSTALLER = "Model_Ocr.ps1 / 125_install_ocr.sh"


def _legacy_ocr_root(dir_name: str) -> Path:
    """The pre-migration per-user root (%APPDATA%\\<name> on Windows, ~/.<name> else)."""
    if os.name == "nt":
        return Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / dir_name
    return Path.home() / f".{dir_name}"


def _ocr_shared_root(env_key: str, dir_name: str) -> Path:
    """Shared OCR model root inside the cross-OS download cache.

    CnSTD/CnOCR models are multi-hundred-MB downloads; Windows previously kept
    them under %APPDATA% (C:). They now live in the shared cache
    (D:\\www\\cache\\ocr\\<name>; a dual-boot Linux reuses the SAME tree via
    /www/www/cache/ocr/<name>). The cnstd/cnocr libraries honor CNSTD_HOME /
    CNOCR_HOME (os.getenv at model-load time), which is set here with
    setdefault so an explicit operator override always wins and downloads and
    engine construction resolve to the same root. A pre-existing legacy root
    keeps being used until the shared root exists, so installed models are
    never silently re-downloaded.
    """
    existing = os.environ.get(env_key, "").strip()
    if existing:
        return Path(existing)
    shared = get_shared_download_cache_dir() / "ocr" / dir_name
    legacy = _legacy_ocr_root(dir_name)
    root = legacy if (legacy.is_dir() and not shared.exists()) else shared
    try:
        root.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        ColorPrint.yellow(f"[OCR] create model root {root} failed: {exc}")
    os.environ.setdefault(env_key, str(root))
    return root


def cnstd_root() -> Path:
    """CnSTD model root (CNSTD_HOME; default <shared cache>/ocr/cnstd)."""
    return _ocr_shared_root("CNSTD_HOME", "cnstd")


def cnocr_root() -> Path:
    """CnOCR model root (CNOCR_HOME; default <shared cache>/ocr/cnocr)."""
    return _ocr_shared_root("CNOCR_HOME", "cnocr")


def ocr_model_dir_present(root: Path, model: str) -> bool:
    """True when an installed model directory named ``model`` holds ONNX weights."""
    return any(path.is_dir() and any(path.rglob("*.onnx")) for path in root.rglob(model))


def missing_ocr_models(use_gpu: bool) -> List[str]:
    """Prewarm models whose weights are not installed under CNSTD_HOME / CNOCR_HOME.

    A language's recognizer counts as present when any model in its prewarm
    order (primary, then fallbacks) is installed."""
    missing: List[str] = []
    for lang in PREWARM_LANGUAGES:
        det, rec_order = prewarm_det_rec_for_lang(lang, use_gpu)
        if not ocr_model_dir_present(cnstd_root(), det):
            missing.append(f"cnstd:{det}")
        if not any(ocr_model_dir_present(cnocr_root(), rec) for rec in rec_order):
            missing.append(f"cnocr:{rec_order[0]}")
    return sorted(set(missing))


def report_ocr_models(use_gpu: bool) -> bool:
    """Report missing OCR weights with the installer step; True when all are present."""
    missing = missing_ocr_models(use_gpu)
    if missing:
        ColorPrint.yellow(
            f"[OCR] Missing CnSTD/CnOCR weights {missing} under {cnstd_root()} / {cnocr_root()}; "
            f"install them with {CNOCR_INSTALLER}"
        )
    return not missing
