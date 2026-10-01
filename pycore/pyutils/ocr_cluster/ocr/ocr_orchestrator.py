# -*- coding: utf-8 -*-
"""
OCR orchestrator — ONE entry that picks the highest-priority AVAILABLE local
OCR engine and extracts text from an image.

Priority (highest first), per project decision:
    1. windows  — Windows.Media.Ocr (WinRT). Native, offline, no GPU.
    2. easyocr  — torch/GPU OCR (heavy; high accuracy).
    3. cnocr    — CnOCR (onnxruntime, GPU/CPU; ships installed in this env).

The AI-vision fallback (transcribe the screenshot with a vision model) is NOT
here: it needs the pyctl AI gateway, and pyutils must not import pyctl. The
desktop pipeline calls extract_text() first and only falls back to the AI-vision
hook when this returns no text — see pyctl.desktop.processor.

Engines are ``OCREngine`` adapters on the shared ``EngineRegistry``.
Availability is probed cheaply (model_checks.module_present) so a status call
never imports torch or triggers a pip install. A real extract_text() call may
lazily build an engine, but only for engines whose package is already present —
it never triggers the WinRT/easyocr auto-install in the hot screenshot loop
(that is the install_ocr prerequisite's job).
"""

import base64
import binascii
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.system_paths import get_shared_download_cache_dir
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)
from pycore.pyfoundations.third_party.api import get_third_package_easyocr
from pycore.pyutils.common.coded_message import CodedMessage, message_fields
from pycore.pyutils.common.engine_registry import EngineAdapter, EngineRegistry
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_checks import dist_version, module_present, packages_check
from pycore.pyutils.common.model_manifest import (
    BOOT_READY,
    CATEGORY_OCR,
    BootVerdict,
    blocked,
    model_manifest,
    ready,
)
from pycore.pyutils.common.model_reasons import (
    MODEL_REASON_EMPTY_OUTPUT,
    MODEL_REASON_ENGINE_FAILED,
    MODEL_REASON_INPUT_INVALID,
    MODEL_REASON_INPUT_REQUIRED,
    MODEL_REASON_INSTALL_REQUIRED,
    MODEL_REASON_NO_ENGINE_AVAILABLE,
    MODEL_REASON_PACKAGE_MISSING,
    MODEL_REASON_PLATFORM_UNSUPPORTED,
    MODEL_REASON_UNKNOWN_ENGINE,
    model_reason,
)
from pycore.pyutils.common.ocr.cnocr_engine import CnOCREngine, cnocr_models_present
from pycore.pyutils.common.ocr.manager import ocr_manager
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_OCR_KEY,
    status_snapshot_cache,
)
from pycore.pyutils.ocr_cluster.ocr_windows_engine import create_windows_ocr
import pycore.pyutils.ocr_cluster.ocr_manifest as ocr_manifest

# Engine state (lazily built readers) is touched only on the OCR owner thread.
_OCR_QUEUE = "pyutils.ocr.orchestrator"
_OCR_WORKER = SerializedWorkerThread(_OCR_QUEUE, "OCROrchestratorThread")
_OCR_WORKER.start()
_OCR_TIMEOUT_S = 300.0
_EASYOCR_LANGS = ("ch_sim", "en")
# pycore lang code -> CnOCR model_type (cnocr handles mixed scripts within each).
_CNOCR_MODEL_BY_LANG = {
    "en": "english",
    "zh": "general",
    "cht": "chinese_traditional",
    "zh-tw": "chinese_traditional",
    "ja": "general",
    "ko": "general",
}


class OCREngine(EngineAdapter):
    """One local OCR engine; ``entry.pip`` is (import module, distribution)."""

    def __init__(self, name: str) -> None:
        super().__init__(name, CATEGORY_OCR)
        self.module, self.package = self.entry.pip

    def install_reason(self, item: str) -> CodedMessage:
        """Coded reason naming the shell step that installs ``item``."""
        return model_reason(
            MODEL_REASON_INSTALL_REQUIRED, model=self.name, item=item, installer=self.entry.installer,
        )

    def missing_reason(self) -> Optional[CodedMessage]:
        """Why the engine cannot run (package, weights); None when installed."""
        if not module_present(self.module):
            return self.install_reason(f"{self.package} package")
        return None

    def probe(self) -> bool:
        return self.missing_reason() is None

    def boot_check(self) -> BootVerdict:
        verdict = packages_check(
            (self.module,), model_reason(MODEL_REASON_PACKAGE_MISSING, package=self.package),
        )
        if verdict.state != BOOT_READY:
            return verdict
        reason = self.missing_reason()
        return blocked(reason) if reason else ready()

    def status_row(self, available: bool) -> Dict[str, Any]:
        row = super().status_row(available)
        row["version"] = dist_version(self.package) if available else None
        if not available:
            row.update(message_fields(self.boot_reason() or self.missing_reason(), "disabled_reason"))
        return row

    def extract(
        self,
        image_path: str,
        lang: Optional[str] = None,
        model_type: Optional[str] = None,
        languages: Optional[List[str]] = None,
    ) -> str:
        raise NotImplementedError


class WindowsOCREngine(OCREngine):
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self._engine: Any = None

    def missing_reason(self) -> Optional[CodedMessage]:
        if os.name != "nt":
            return model_reason(MODEL_REASON_PLATFORM_UNSUPPORTED, model=self.name, platform=sys.platform)
        return super().missing_reason()

    def extract(self, image_path, lang=None, model_type=None, languages=None) -> str:
        if self._engine is None:
            self._engine = create_windows_ocr() or False
        if not self._engine:
            return ""
        return (self._engine.ocr(img_path=image_path).get("text") or "").strip()


class EasyOCREngine(OCREngine):
    """EasyOCR on installed weights only (download_enabled=False)."""

    _DETECTOR_FILE = "craft_mlt_25k.pth"

    def __init__(self, name: str) -> None:
        super().__init__(name)
        self._reader: Any = None

    @staticmethod
    def model_dir() -> Path:
        return Path(os.environ.get("EASYOCR_MODULE_PATH") or get_shared_download_cache_dir() / "ocr" / "easyocr") / "model"

    def missing_reason(self) -> Optional[CodedMessage]:
        reason = super().missing_reason()
        if reason is None and not (self.model_dir() / self._DETECTOR_FILE).is_file():
            return self.install_reason(f"{self._DETECTOR_FILE} weights")
        return reason

    def _new_reader(self, langs: List[str]) -> Any:
        easyocr = get_third_package_easyocr()
        if easyocr is None:
            return None
        return easyocr.Reader(langs, model_storage_directory=str(self.model_dir()), download_enabled=False)

    def extract(self, image_path, lang=None, model_type=None, languages=None) -> str:
        if languages:
            # A custom language list gets a one-off reader (only the default set is cached).
            reader = self._new_reader(list(languages))
            result = reader.readtext(image_path, detail=0, paragraph=True) if reader else []
            return " ".join(result).strip() if result else ""
        if self._reader is None:
            self._reader = self._new_reader(list(_EASYOCR_LANGS)) or False
        if not self._reader:
            return ""
        # detail=0 -> list of plain strings, top-to-bottom reading order.
        lines = self._reader.readtext(image_path, detail=0, paragraph=True)
        return "\n".join(line for line in lines if line).strip()


class CnOCRLibraryEngine(OCREngine):
    def missing_reason(self) -> Optional[CodedMessage]:
        reason = super().missing_reason()
        if reason is None and not cnocr_models_present(CnOCREngine().model_name):
            return self.install_reason("CnSTD/CnOCR weights")
        return reason

    def extract(self, image_path, lang=None, model_type=None, languages=None) -> str:
        if model_type:
            recognized = CnOCREngine().recognize(image_path, model_type=model_type)
            return (recognized.text or "").strip() if recognized else ""
        model = _CNOCR_MODEL_BY_LANG.get((lang or "").lower(), "general")
        result = ocr_manager.recognize_image(image_path, model_type=model)
        return (result.get("text") or "").strip() if result.get("success") else ""


class OCREngineRegistry(EngineRegistry[OCREngine]):
    def get(self, name: str) -> Optional[OCREngine]:
        """Resolve an id or a manifest alias (``windows_ocr`` -> ``windows``)."""
        entry = model_manifest.get(str(name or ""), CATEGORY_OCR)
        return super().get(entry.id if entry else name)


_ENGINE_CLASSES = {
    "windows": WindowsOCREngine,
    "easyocr": EasyOCREngine,
    "cnocr": CnOCRLibraryEngine,
}
ocr_engine_registry = OCREngineRegistry(
    _ENGINE_CLASSES[entry.id](entry.id) for entry in ocr_manifest.OCR_ENTRIES
)

model_boot.register_checks(CATEGORY_OCR, tuple(
    (adapter.name, adapter.boot_check) for adapter in ocr_engine_registry.values()
))


def ocr_status() -> Dict[str, Any]:
    """Return the shared cached OCR availability panel (no OCR run, no install)."""
    return status_snapshot_cache.get(STATUS_SNAPSHOT_OCR_KEY, ocr_engine_registry.panel)


def _extract_text(image_path: str, lang: Optional[str] = None) -> Dict[str, Any]:
    """Walk the priority order; the first available engine that returns text
    wins, an engine that errors or returns nothing falls through. ``lang`` is
    the UI recognition-language hint (steers CnOCR; windows/easyocr auto-detect).

    Returns {success, text, engine, error, tried: [names]}."""
    if not image_path or not Path(image_path).exists():
        return {"success": False, "text": "", "engine": None,
                "error": f"Image file not found: {image_path}", "tried": []}

    tried: List[str] = []
    last_error: Optional[str] = None
    for adapter in ocr_engine_registry.values():
        if not adapter.available():
            continue
        tried.append(adapter.name)
        try:
            text = adapter.extract(image_path, lang)
        except Exception as exc:  # noqa: BLE001 - try the next engine, surface the last error
            last_error = f"{adapter.name}: {exc}"
            ColorPrint.yellow(f"[ocr] {adapter.name} failed on {image_path} ({exc}); trying next engine")
            continue
        if text:
            return {"success": True, "text": text, "engine": adapter.name,
                    "error": None, "tried": tried}
        ColorPrint.gray(f"[ocr] {adapter.name} returned no text; trying next engine")

    return {
        "success": False,
        "text": "",
        "engine": None,
        "error": last_error or ("No OCR engine available" if not tried
                                else "All OCR engines returned no text"),
        "tried": tried,
    }


def _extract_text_engine(engine: str, image_path: str, lang: Optional[str] = None,
                         model_type: Optional[str] = None,
                         languages: Optional[List[str]] = None) -> Dict[str, Any]:
    """Extract text with ONE specific engine (no fallback).

    Per-engine extra params:
    - model_type (cnocr): "general" | "scene" | "doc" | "number" | "english" | "chinese_traditional"
    - languages (easyocr): e.g. ["en", "ch_sim"] to override the default ["ch_sim", "en"]"""
    adapter = ocr_engine_registry.get(engine)
    if adapter is None:
        return _ocr_failure(engine, model_reason(MODEL_REASON_UNKNOWN_ENGINE, category=CATEGORY_OCR, model=engine))
    if adapter.boot_blocked():
        return _ocr_failure(adapter.name, adapter.boot_reason() or f"{adapter.name} is blocked")
    missing = adapter.missing_reason()
    if missing:
        return _ocr_failure(adapter.name, missing)
    try:
        text = adapter.extract(image_path, lang, model_type=model_type, languages=languages)
    except Exception as exc:  # noqa: BLE001 - surface the engine failure, do not fall through
        ColorPrint.yellow(f"[ocr] {adapter.name} failed on {image_path}: {exc}")
        return _ocr_failure(adapter.name, model_reason(MODEL_REASON_ENGINE_FAILED, model=adapter.name, detail=str(exc)))
    text = (text or "").strip()
    if not text:
        return _ocr_failure(adapter.name, model_reason(MODEL_REASON_EMPTY_OUTPUT, model=adapter.name, item="text"))
    return {"success": True, "text": text, "engine": adapter.name, "error": None}


def extract_text(image_path: str, lang: Optional[str] = None) -> Dict[str, Any]:
    """Extract text through the OCR owner thread."""
    return call_serialized(_OCR_QUEUE, _extract_text, image_path, lang, timeout=_OCR_TIMEOUT_S)


def extract_text_engine(engine: str, image_path: str, lang: Optional[str] = None,
                        model_type: Optional[str] = None,
                        languages: Optional[List[str]] = None) -> Dict[str, Any]:
    """Run one OCR engine through the OCR owner thread."""
    return call_serialized(
        _OCR_QUEUE,
        _extract_text_engine,
        engine,
        image_path,
        lang,
        model_type,
        languages,
        timeout=_OCR_TIMEOUT_S,
    )


def _ocr_failure(engine: Optional[str], reason: str, **extra: Any) -> Dict[str, Any]:
    """Failed OCR result: English ``error`` plus ``error_code``/``error_params``."""
    return {"success": False, "text": "", "engine": engine, **extra, **message_fields(reason, "error")}


def ocr_recognize(engine: Optional[str] = None, image_path: Optional[str] = None,
                  image_data: Optional[str] = None, lang: Optional[str] = None,
                  # Per-engine extra params.
                  model_type: Optional[str] = None,
                  languages: Optional[List[str]] = None,
                  **extra_params: Any) -> Dict[str, Any]:
    """OCR with ONE engine (or the best available). Resolves the image
    from a base64 data-URL / raw base64 (``image_data``) or a filesystem path
    (``image_path``), runs the engine, and returns
    {success, engine, text, latency_ms, error, model_type}. The decoded base64
    image is written to a temp file and removed afterwards; a caller-supplied
    ``image_path`` is never deleted.

    Per-engine params:
    - model_type (cnocr): "general"|"scene"|"doc"|"number"|"english"|"chinese_traditional"
    - languages (easyocr): list of language codes to override default ["ch_sim", "en"]"""
    name = engine or ocr_engine_registry.best()
    if not name:
        return _ocr_failure(None, model_reason(MODEL_REASON_NO_ENGINE_AVAILABLE, category=CATEGORY_OCR), latency_ms=0)

    tmp_path: Optional[str] = None
    resolved = image_path
    if not resolved and image_data:
        raw = image_data.strip()
        # Strip an optional data-URL prefix: data:image/png;base64,XXXX
        if raw.startswith("data:") and "," in raw:
            raw = raw.split(",", 1)[1]
        try:
            tmp_dir = TMP_DIR / "pycore_ocr"
            tmp_dir.mkdir(parents=True, exist_ok=True)
            tmp_path = str(tmp_dir / f"{uuid.uuid4().hex}.png")
            Path(tmp_path).write_bytes(base64.b64decode(raw))
            resolved = tmp_path
        except (binascii.Error, ValueError, OSError) as exc:
            ColorPrint.yellow(f"[ocr] image_data decode failed: {exc}")
            return _ocr_failure(
                name, model_reason(MODEL_REASON_INPUT_INVALID, field="image_data", detail=str(exc)), latency_ms=0,
            )

    if not resolved or not Path(resolved).exists():
        return _ocr_failure(name, model_reason(MODEL_REASON_INPUT_REQUIRED, field="image"), latency_ms=0)

    t0 = time.monotonic()
    try:
        result = extract_text_engine(name, resolved, lang,
                                     model_type=model_type, languages=languages)
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
    result["latency_ms"] = round((time.monotonic() - t0) * 1000)
    if model_type:
        result["model_type"] = model_type
    if languages:
        result["languages"] = languages
    return result


def ocr_test(**params: Any) -> Dict[str, Any]:
    """Live OCR test: ``ocr_recognize`` tagged with the test route."""
    result = ocr_recognize(**params)
    result["route"] = "/api/local/ocr/test"
    return result


__all__ = [
    "OCREngine",
    "ocr_engine_registry",
    "ocr_recognize",
    "ocr_status",
    "extract_text",
    "extract_text_engine",
    "ocr_test",
]
