# -*- coding: utf-8 -*-
"""Dependency exports and install probes for the third-party package."""

import importlib.util
import os
import platform
from typing import Optional

from pycore.pyfoundations.ai_runtime_policy import CUDA_TIERS, TORCH_CPU_INDEX
from pycore.pyfoundations.python_package_policy import (
    DEPENDENCY_MAP,
    GUI_ONLY_IMPORTS,
    OPTIONAL_PACKAGES,
    WINDOWS_OCR_WINRT_PACKAGES,
    WINDOWS_ONLY_PACKAGES,
)


PYTORCH_CUDA_INDEX_URL = os.environ.get("PYTORCH_CUDA_INDEX_URL", "").strip()
_PYTORCH_CUDA_WHEELS = tuple(
    (tier["minimum_driver_cv"] // 100, tier["minimum_driver_cv"] % 100, tier["tag"])
    for tier in CUDA_TIERS
)
_PYTORCH_CUDA_DEFAULT_TAG = CUDA_TIERS[-1]["tag"] if CUDA_TIERS else ""
PYTORCH_CPU_INDEX_URL = TORCH_CPU_INDEX

_INSTALL_PROBE_SUBMODULE = {
    "PySide6": "PySide6.QtWebEngineWidgets",
}


def _module_install_ok(import_name: Optional[str]) -> bool:
    """Return whether an import and its representative compiled module exist."""
    if not import_name:
        return False
    probe = _INSTALL_PROBE_SUBMODULE.get(import_name, import_name)
    try:
        return importlib.util.find_spec(probe) is not None
    except Exception:
        return False


def _is_headless_linux() -> bool:
    """Return whether Linux has no active desktop display."""
    if os.environ.get("PYCORE_FORCE_GUI") == "1":
        return False
    if os.environ.get("PYCORE_HEADLESS") == "1":
        return True
    if platform.system() != "Linux":
        return False
    return not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
