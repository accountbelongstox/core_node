# -*- coding: utf-8 -*-
"""TTS utility package with lazy orchestrator compatibility exports."""

from importlib import import_module
from typing import Dict, Tuple


_EXPORTS: Dict[str, Tuple[str, str]] = {
    "TTS_ENGINE_PRIORITY": (
        "pycore.pyutils.tts.tts_orchestrator",
        "TTS_ENGINE_PRIORITY",
    ),
    "best_engine": ("pycore.pyutils.tts.tts_orchestrator", "best_engine"),
    "engine_available": (
        "pycore.pyutils.tts.tts_orchestrator",
        "engine_available",
    ),
    "report_tts_engine_startup": (
        "pycore.pyutils.tts.tts_orchestrator",
        "report_tts_engine_startup",
    ),
    "synthesize": ("pycore.pyutils.tts.tts_orchestrator", "synthesize"),
    "synthesize_engine": (
        "pycore.pyutils.tts.tts_orchestrator",
        "synthesize_engine",
    ),
    "tts_status": ("pycore.pyutils.tts.tts_orchestrator", "tts_status"),
    "tts_test": ("pycore.pyutils.tts.tts_orchestrator", "tts_test"),
}

__all__ = [*_EXPORTS, "tts_orchestrator"]


def __getattr__(name: str):
    if name == "tts_orchestrator":
        value = import_module("pycore.pyutils.tts.tts_orchestrator")
    else:
        export = _EXPORTS.get(name)
        if export is None:
            raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
        module_name, attribute_name = export
        value = getattr(import_module(module_name), attribute_name)
    globals()[name] = value
    return value


def __dir__():
    return sorted(set(globals()) | set(__all__))
