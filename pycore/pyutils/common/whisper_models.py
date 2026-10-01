# -*- coding: utf-8 -*-
"""The one process-wide cache of loaded Whisper models (openai-whisper and
faster-whisper), shared by the STT orchestrator, the Whisper provider and the
video-extract subtitle engine. Loads run on the cache's owner thread; inference
runs on the caller's thread with the returned model.

Weights are installed only by the shell steps (FASTER_WHISPER_INSTALLER,
WHISPER_INSTALLER); this module resolves already-present weights and never
downloads."""

import importlib.util
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import get_hf_hub_cache_dir, get_shared_download_cache_dir
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import (
    get_third_package_faster_whisper,
    get_third_package_whisper,
)
from pycore.pyutils.common.model_checks import module_present

ENGINE_FASTER_WHISPER = "faster-whisper"
ENGINE_WHISPER = "whisper"
WHISPER_MODEL_CANDIDATES = ("tiny", "base", "small", "medium", "large-v3", "turbo")
FASTER_WHISPER_INSTALLER = "Step11_InstallFasterWhisper.ps1 / 151_install_faster_whisper.sh"
WHISPER_INSTALLER = "Step42_InstallWhisper.ps1 / 127_install_whisper.sh"

_LOADED_SIGNAL_PREFIX = "pyutils.common.whisper_models.loaded"
_LOAD_TIMEOUT_S = 900.0
# Model aliases resolved to the file / repo names the installers write.
_WHISPER_ALIASES = {"large": "large-v3", "turbo": "large-v3-turbo"}
_FASTER_WHISPER_ALIASES = {"turbo": "large-v3-turbo"}
_FASTER_WHISPER_WEIGHT_FILES = ("model.bin", "model.safetensors")


def _hf_hub_roots() -> List[Path]:
    """The shared HuggingFace hub cache (HF_HUB_CACHE, else <shared cache>/huggingface/hub)."""
    return [get_hf_hub_cache_dir()]


def _whisper_roots() -> List[Path]:
    """openai-whisper checkpoint roots: WHISPER_CACHE_DIR (else <shared cache>/whisper),
    then <XDG_CACHE_HOME>/whisper when the shared-cache layer exported it."""
    roots = [Path(os.environ.get("WHISPER_CACHE_DIR") or get_shared_download_cache_dir() / "whisper")]
    if os.environ.get("XDG_CACHE_HOME"):
        roots.append(Path(os.environ["XDG_CACHE_HOME"]) / "whisper")
    return list(dict.fromkeys(roots))


def faster_whisper_weights(model_name: str) -> Optional[Path]:
    """Local CTranslate2 model dir for a size name or path; None when not installed."""
    if Path(model_name).is_dir():
        return Path(model_name)
    name = _FASTER_WHISPER_ALIASES.get(model_name, model_name)
    for root in _hf_hub_roots():
        for repo in sorted(root.glob(f"models--*--faster-whisper-{name}")):
            for snapshot in sorted((repo / "snapshots").glob("*")):
                if (snapshot / "config.json").is_file() and any(
                    (snapshot / weight).is_file() for weight in _FASTER_WHISPER_WEIGHT_FILES
                ):
                    return snapshot
    return None


def whisper_weights(model_name: str) -> Optional[Path]:
    """Local openai-whisper .pt checkpoint for a size name or path; None when not installed."""
    if Path(model_name).is_file():
        return Path(model_name)
    file_name = f"{_WHISPER_ALIASES.get(model_name, model_name)}.pt"
    for root in _whisper_roots():
        if (root / file_name).is_file():
            return root / file_name
    return None


def weights_present(engine: str, model_name: str) -> bool:
    if engine == ENGINE_FASTER_WHISPER:
        return faster_whisper_weights(model_name) is not None
    return whisper_weights(model_name) is not None


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
    def faster_whisper(
        self,
        model_name: str,
        device: str,
        compute_type: str,
        cpu_fallback: bool = False,
    ) -> Optional[Any]:
        """A faster-whisper model from its installed weights; None when the
        package or the weights are missing. ``cpu_fallback`` (video-extract)
        exposes the NVIDIA DLL dirs and retries a failed load on CPU int8,
        returning None when every load fails; without it a load error raises."""
        key = (ENGINE_FASTER_WHISPER, model_name, device, compute_type)
        cached = self._models.get(key)
        if cached is not None:
            return cached
        weights = faster_whisper_weights(model_name)
        package = get_third_package_faster_whisper() if module_present("faster_whisper") else None
        if package is None or weights is None:
            ColorPrint.yellow(f"[whisper] faster-whisper {model_name} is not installed (package or weights)")
            return None
        if not cpu_fallback:
            return self._store(key, package.WhisperModel(
                str(weights), device=device, compute_type=compute_type, local_files_only=True,
            ))
        add_nvidia_dll_dirs()
        attempts = [(device, compute_type)]
        if device != "cpu":
            attempts.append(("cpu", "int8"))
        for attempt_device, attempt_compute in attempts:
            try:
                model = package.WhisperModel(
                    str(weights),
                    device=attempt_device,
                    compute_type=attempt_compute,
                    local_files_only=True,
                )
            except Exception as exc:  # noqa: BLE001 - third-party load boundary, reported
                ColorPrint.yellow(
                    f"[whisper] faster-whisper load {model_name} on "
                    f"{attempt_device}/{attempt_compute} failed: {exc}"
                )
                continue
            return self._store(key, model)
        return None

    @serialized_method
    def whisper(self, model_name: str) -> Optional[Any]:
        """An openai-whisper model from its installed checkpoint; None when the
        package or the checkpoint is missing (a load error raises)."""
        key = (ENGINE_WHISPER, model_name)
        cached = self._models.get(key)
        if cached is not None:
            return cached
        weights = whisper_weights(model_name)
        package = get_third_package_whisper() if module_present("whisper") else None
        if package is None or weights is None:
            ColorPrint.yellow(f"[whisper] openai-whisper {model_name} is not installed (package or checkpoint)")
            return None
        return self._store(key, package.load_model(str(weights)))

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
    "FASTER_WHISPER_INSTALLER",
    "WHISPER_INSTALLER",
    "WHISPER_MODEL_CANDIDATES",
    "add_nvidia_dll_dirs",
    "faster_whisper_weights",
    "weights_present",
    "whisper_models",
    "whisper_weights",
]
