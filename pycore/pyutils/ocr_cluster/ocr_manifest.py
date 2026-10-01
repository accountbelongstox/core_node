# -*- coding: utf-8 -*-
"""OCR engine declarations: the ONE place OCR engine facts live.

Declaration order is the default engine priority.
"""

from pycore.pyutils.common.model_manifest import (
    CATEGORY_OCR,
    RUNTIME_LIBRARY,
    ModelEntry,
    model_manifest,
)

_OCR_INSTALLER = "Step46_InstallOcr.ps1 / 125_install_ocr.sh"

OCR_ENTRIES = (
    ModelEntry(
        "windows", CATEGORY_OCR, RUNTIME_LIBRARY,
        note="Windows.Media.Ocr (WinRT) - native, offline",
        aliases=("windows_ocr",), concurrency="serial",
        pip=("winrt.windows.media.ocr", "winrt-Windows.Media.Ocr"),
        library_name="windows_ocr", library_kind="pip", installer=_OCR_INSTALLER,
    ),
    ModelEntry(
        "easyocr", CATEGORY_OCR, RUNTIME_LIBRARY,
        note="EasyOCR (torch/GPU) - high accuracy, heavy",
        concurrency="serial", pip=("easyocr", "easyocr"), library_kind="pip",
        installer=_OCR_INSTALLER,
    ),
    ModelEntry(
        "cnocr", CATEGORY_OCR, RUNTIME_LIBRARY,
        note="CnOCR (onnxruntime) - GPU/CPU local OCR",
        concurrency="serial", pip=("cnocr", "cnocr"), library_kind="pip",
        installer=_OCR_INSTALLER,
    ),
)

model_manifest.register(OCR_ENTRIES)
