#!/usr/bin/env python3
"""Shared bootstrap for the standalone TTS api servers.

Pure standard-library module (same contract as tts_text_chunking.py): no
pycore imports and no third-party imports, so it can be staged next to any
standalone API server and imported as a sibling.

Two jobs:

1. Load pycore.pyfoundations.network_constants FROM SOURCE - the single
   definition site of the shared ports / VRAM floors / speed bounds - for
   servers that run in isolated venvs or staging copies where ``import
   pycore`` is unavailable. The pycore package root resolves from
   PYCORE_PROJECT_ROOT (injected by tts_service_manager for staging launches)
   or from this file's own location when running straight from
   pycore/tts_install_assets.
2. Own the standalone scratch TMP_DIR (one platform branch shared by the
   fishspeech / f5tts servers; the pycore-side equivalent lives in
   pycore.pyfoundations.pygvar, which is not importable from isolated venvs).
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

_PYCORE_MODULE_NAME = "pycore"
_PYFOUNDATIONS_MODULE_NAME = "pycore.pyfoundations"
_NETWORK_CONSTANTS_MODULE_NAME = "pycore.pyfoundations.network_constants"

TMP_DIR = Path(r"D:\.tmp" if os.name == "nt" else "/var/_core_node/_tmp")


def pycore_package_root() -> Path:
    root = (os.environ.get("PYCORE_PROJECT_ROOT") or "").strip()
    if root:
        candidate = Path(root) / _PYCORE_MODULE_NAME
        if (candidate / "pyfoundations" / "network_constants.py").is_file():
            return candidate
    return Path(__file__).resolve().parents[1]


def register_pycore_namespace(package_root: Path) -> None:
    """Register minimal pycore / pycore.pyfoundations namespace packages so
    source-loaded pyfoundations modules can resolve their own relative
    imports (e.g. network_constants -> service_contract)."""
    pycore_module = sys.modules.get(_PYCORE_MODULE_NAME)
    if pycore_module is None:
        pycore_module = ModuleType(_PYCORE_MODULE_NAME)
        pycore_module.__path__ = [str(package_root)]
        sys.modules[_PYCORE_MODULE_NAME] = pycore_module
    pyfoundations_module = sys.modules.get(_PYFOUNDATIONS_MODULE_NAME)
    if pyfoundations_module is None:
        pyfoundations_module = ModuleType(_PYFOUNDATIONS_MODULE_NAME)
        pyfoundations_module.__path__ = [str(package_root / "pyfoundations")]
        sys.modules[_PYFOUNDATIONS_MODULE_NAME] = pyfoundations_module
    pycore_module.pyfoundations = pyfoundations_module


def load_source_module(module_name: str, module_path: Path) -> Any:
    existing_module = sys.modules.get(module_name)
    if existing_module is not None:
        return existing_module
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load source module: {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def load_network_constants() -> Any:
    package_root = pycore_package_root()
    register_pycore_namespace(package_root)
    return load_source_module(
        _NETWORK_CONSTANTS_MODULE_NAME,
        package_root / "pyfoundations" / "network_constants.py",
    )


__all__ = [
    "TMP_DIR",
    "load_network_constants",
    "load_source_module",
    "pycore_package_root",
    "register_pycore_namespace",
]
