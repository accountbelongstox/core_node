# -*- coding: utf-8 -*-
"""The one process-wide cache of loaded Whisper models (openai-whisper and
faster-whisper), shared by the STT orchestrator, the Whisper provider and the
video-extract subtitle engine. Loads run on the cache's owner thread; inference
runs on the caller's thread with the returned model."""

import importlib.util
import os
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import (
    get_third_package_faster_whisper,
    get_third_package_whisper,
)
from pycore.pyutils.common.model_checks import module_present

ENGINE_FASTER_WHISPER = "faster-whisper"
ENGINE_WHISPER = "whisper"
WHISPER_MODEL_CANDIDATES = ("tiny", "base", "small", "medium", "large-v3", "turbo")

_LOADED_SIGNAL_PREFIX = "pyutils.common.whisper_models.loaded"
_LOAD_TIMEOUT_S = 900.0


def add_nvidia_dll_dirs() -> None:
    """Make pip-installed cuBLAS/cuDNN DLLs discoverable for CTranslate2 (Windows)."""
    if os.name != "nt":
        return
    for module in ("nvidia.cublas", "nvidia.cudnn"):
        if not module_present(module):
            continue
        spec = importlib.util.find_spec(module)
        if spec is None or not spec.submodule_search_locations:
            continue
        bin_dir = os.path.join(list(spec.submodule_search_locations)[0], "bin")
        if os.path.isdir(bin_dir):
            os.add_dll_directory(bin_dir)


class WhisperModelCache:
    def __init__(self) -> None:
        self._models: Dict[Tuple[str, ...], Any] = {}
        init_serialized_owner(
            self,
            "pyutils.common.whisper_models",
            "WhisperModelCacheThread",
            timeout=_LOAD_TIMEOUT_S,
        )

    @staticmethod
    def _signal(engine: str) -> str:
        return f"{_LOADED_SIGNAL_PREFIX}.{engine}"

    def _store(self, key: Tuple[str, ...], model: Any) -> Any:
        self._models[key] = model
        THREAD_BUS.signal(self._signal(key[0]), True)
        return model

    @serialized_method
    def faster_whisper(self, model_name: str, device: str, compute_type: str) -> Optional[Any]:
        """A faster-whisper model; a failed GPU load falls back to CPU int8.
        None when the package is missing or every load fails."""
        key = (ENGINE_FASTER_WHISPER, model_name, device, compute_type)
        cached = self._models.get(key)
        if cached is not None:
            return cached
        package = get_third_package_faster_whisper()
        if package is None:
            ColorPrint.yellow("[whisper] faster-whisper is not installed")
            return None
        add_nvidia_dll_dirs()
        attempts = [(device, compute_type)]
        if device != "cpu":
            attempts.append(("cpu", "int8"))
        for attempt_device, attempt_compute in attempts:
            try:
                model = package.WhisperModel(
                    model_name, device=attempt_device, compute_type=attempt_compute,
                )
            except (RuntimeError, ValueError, OSError) as exc:
                ColorPrint.yellow(
                    f"[whisper] faster-whisper load {model_name} on "
                    f"{attempt_device}/{attempt_compute} failed: {exc}"
                )
                continue
            return self._store(key, model)
        return None

    @serialized_method
    def whisper(self, model_name: str) -> Optional[Any]:
        """An openai-whisper model; None when the package is missing or the load fails."""
        key = (ENGINE_WHISPER, model_name)
        cached = self._models.get(key)
        if cached is not None:
            return cached
        package = get_third_package_whisper()
        if package is None:
            ColorPrint.yellow("[whisper] openai-whisper is not installed")
            return None
        try:
            model = package.load_model(model_name)
        except (RuntimeError, ValueError, OSError) as exc:
            ColorPrint.yellow(f"[whisper] openai-whisper load {model_name} failed: {exc}")
            return None
        return self._store(key, model)

    def is_loaded(self, engine: str) -> bool:
        return bool(THREAD_BUS.get_signal(self._signal(engine), False))

    @serialized_method
    def unload(self, engine: str) -> None:
        for key in [key for key in self._models if key[0] == engine]:
            self._models.pop(key, None)
        THREAD_BUS.signal(self._signal(engine), False)


whisper_models = WhisperModelCache()


__all__ = [
    "ENGINE_FASTER_WHISPER",
    "ENGINE_WHISPER",
    "WHISPER_MODEL_CANDIDATES",
    "add_nvidia_dll_dirs",
    "whisper_models",
]
