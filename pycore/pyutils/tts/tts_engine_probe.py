# -*- coding: utf-8 -*-
"""
Cheap TTS engine install vs runtime-ready probes for status UI.

``engine_installed`` — prerequisites present (pip package, staging .deps_done,
cloned repo, or model cache) without network or heavy import.
``engine_unavailable_reason`` — coded hint (tts_reason_codes) when an engine is
off (not installed, missing config, server down, or model files absent); the
UI localizes it by code, logs use its English text.

qwen3tts and melotts are class-C isolated-venv HTTP servers (see
development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5): their
readiness is the DEDICATED per-engine venv via isolated_venv.venv_ready(),
NOT a main-interpreter qwen_tts/melo import -
those pinned packages are never installed in the main interpreter.
"""

import importlib.util
import os
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.system_paths import get_core_node_root, get_local_data_dir
from pycore.pyutils.common.python_env.runtime_policy import (
    base_interpreter_compatibility,
)
import pycore.pyutils.common.python_env.isolated_venv as isolated_venv
from pycore.pyutils.tts.engine_registry import tts_engine_registry
import pycore.pyutils.tts.fishspeech_engine as fishspeech_engine
from pycore.pyutils.tts.memory_gate import memory_gate_allows
from pycore.pyutils.tts.tts_reason_codes import (
    TTS_INSTALL_HINT_GENERIC,
    TTS_INSTALL_HINT_PREREQUISITES,
    TTS_REASON_BASE_PYTHON_UNAVAILABLE,
    TTS_REASON_EDGE_INIT_FAILED,
    TTS_REASON_FISHSPEECH_SOURCE_REQUIRED,
    TTS_REASON_MEMORY_GATE,
    TTS_REASON_MODEL_NOT_FOUND,
    TTS_REASON_NOT_INSTALLED,
    TTS_REASON_PACKAGE_MISSING,
    TTS_REASON_SECRET_REQUIRED,
    TTS_REASON_SERVER_MODEL_NOT_READY,
    TTS_REASON_SERVER_NOT_RUNNING,
    TTS_REASON_SETTING_REQUIRED,
    TTS_REASON_VENV_NOT_BUILT_BASE_READY,
    TTS_REASON_WEIGHTS_MISSING,
    tts_reason,
)


_STAGING_ENV: Dict[str, str] = {
    "chattts": "CHATTTS_DIR",
    "cosyvoice": "COSYVOICE_DIR",
    "fishspeech": "FISHSPEECH_DIR",
    "gptsovits": "GPTSOVITS_DIR",
    "f5tts": "F5TTS_DIR",
    "bark": "BARK_DIR",
    "parler": "PARLER_DIR",
    "qwen3tts": "QWEN3TTS_DIR",
    "voxcpm2": "VOXCPM2_DIR",
}

_NOT_INSTALLED = tts_reason(TTS_REASON_NOT_INSTALLED, installer=TTS_INSTALL_HINT_PREREQUISITES)
_AZURE_SPEECH_PACKAGE = "azure-cognitiveservices-speech"
_AZURE_SPEECH_SECRETS = "AZURE_SPEECH_KEY, AZURE_SPEECH_REGION"
_GPTSOVITS_REF_AUDIO_SETTING = "GPTSOVITS_REF_AUDIO"
_OFFLINE_TTS_PREREQUISITE = "offline TTS prerequisite (sherpa-onnx)"


def _spec(module: str) -> bool:
    try:
        return importlib.util.find_spec(module) is not None
    except (ImportError, ValueError, ModuleNotFoundError):
        return False


def staging_dir(engine: str) -> Path:
    env_key = _STAGING_ENV.get(engine)
    if env_key:
        override = (os.environ.get(env_key) or "").strip()
        if override:
            return Path(override)
    return get_local_data_dir() / engine


def staging_deps_done(engine: str) -> bool:
    return (staging_dir(engine) / ".deps_done").is_file()


def _staging_clone_ready(engine: str, markers: tuple[str, ...]) -> bool:
    root = staging_dir(engine)
    if not root.is_dir():
        return False
    for rel in markers:
        if (root / rel).exists():
            return True
    return (root / ".git").is_dir()


def engine_installed(name: str) -> bool:
    """True when install prerequisites are present (pip / staging / clone)."""
    if name == "chattts":
        return _spec("ChatTTS") or staging_deps_done("chattts")
    if name == "cosyvoice":
        return (
            isolated_venv.venv_ready("cosyvoice")
            or staging_deps_done("cosyvoice")
            or _staging_clone_ready(
                "cosyvoice", ("runtime/python/fastapi/server.py", "runtime/python"))
        )
    if name == "fishspeech":
        return (
            isolated_venv.venv_ready("fishspeech")
            or staging_deps_done("fishspeech")
            or _staging_clone_ready("fishspeech", ("tools/api_server.py",))
        )
    if name == "qwen3tts":
        # Class C: readiness is the isolated venv (real `import qwen_tts` inside it),
        # never a main-interpreter qwen_tts probe.
        return isolated_venv.venv_ready("qwen3tts")
    if name == "bark":
        return (_spec("transformers") and _spec("scipy")) or staging_deps_done("bark")
    if name == "parler":
        return _spec("parler_tts") and _spec("soundfile") and _spec("transformers")
    if name == "voxcpm2":
        # Class C: readiness is the isolated self-contained venv, never a
        # main-interpreter voxcpm probe (3.13 is outside the official window).
        return isolated_venv.venv_ready("voxcpm2") or staging_deps_done("voxcpm2")
    if name == "kokoro":
        return _spec("sherpa_onnx")
    if name == "gptsovits":
        root = staging_dir("gptsovits")
        models_sentinel = root / "GPT_SoVITS" / "pretrained_models" / ".snapshot_done"
        return (
            staging_deps_done("gptsovits")
            or models_sentinel.is_file()
            or _staging_clone_ready("gptsovits", ("api_v2.py", "GPT_SoVITS"))
        )
    if name == "f5tts":
        return staging_deps_done("f5tts") or _spec("f5_tts")
    if name == "melotts":
        # Class C: readiness is the per-engine isolated venv (real `import melo`
        # inside it), never a main-interpreter melo probe - melo pins an old
        # transformers and must not be installed in the main interpreter.
        return isolated_venv.venv_ready("melotts")
    if name == "sherpa":
        return _spec("sherpa_onnx")
    if name == "edge":
        return _spec("edge_tts")
    if name == "streamelements":
        return _spec("requests")
    if name == "gtts_web":
        return _spec("requests")
    if name == "azure":
        return _spec("azure.cognitiveservices.speech")
    return False


def _self_contained_reason(name: str) -> Optional[str]:
    """Status breakdown for the five self-contained class-C engines.

    Distinguishes "dedicated Python 3.10 runtime missing" from "venv not built
    yet" (plan step 14: the failure phase and the next action must be visible,
    never a bare unavailable). Compatibility is judged against the resolved
    BASE interpreter, never the host 3.13.
    """
    if isolated_venv.venv_ready(name):
        return None
    base = base_interpreter_compatibility(name)
    if not base.get("base_found"):
        return tts_reason(
            TTS_REASON_BASE_PYTHON_UNAVAILABLE, engine=name,
            detail=str(base.get("reason") or "python310_not_registered"),
        )
    if not base.get("compatible"):
        return tts_reason(
            TTS_REASON_BASE_PYTHON_UNAVAILABLE, engine=name,
            detail=str(base.get("reason") or "base interpreter incompatible"),
        )
    return tts_reason(
        TTS_REASON_VENV_NOT_BUILT_BASE_READY, engine=name,
        python_version=str(base.get("python_version") or ""), installer=TTS_INSTALL_HINT_GENERIC,
    )


def _server_not_running(name: str, adapter: Any) -> str:
    return tts_reason(TTS_REASON_SERVER_NOT_RUNNING, engine=name, url=adapter.base_url() if adapter else "")


def engine_unavailable_reason(name: str) -> Optional[str]:
    """Why an engine cannot synthesize now; None when no hint applies."""
    adapter = tts_engine_registry.get(name)
    if name == "voxcpm2":
        reason = _self_contained_reason(name)
        if reason:
            return reason
        return adapter.disabled_reason() if adapter else None

    if name == "qwen3tts":
        return adapter.disabled_reason() if adapter else _NOT_INSTALLED

    if name == "melotts":
        # Class C: readiness is the per-engine isolated venv (see engine_installed).
        if not isolated_venv.venv_ready("melotts"):
            return _self_contained_reason(name) or (
                adapter.disabled_reason() if adapter else _NOT_INSTALLED
            )
        return None

    if not engine_installed(name):
        if name in ("cosyvoice", "gptsovits", "fishspeech"):
            reason = _self_contained_reason(name)
            if reason and getattr(reason, "code", "") != TTS_REASON_VENV_NOT_BUILT_BASE_READY:
                return reason
        return _NOT_INSTALLED

    if name == "streamelements":
        return adapter.disabled_reason() if adapter else None

    if name == "cosyvoice":
        cfg = adapter.disabled_reason() if adapter else None
        if cfg:
            return cfg
        if not (os.environ.get("COSYVOICE_URL") or "").strip():
            reason = _self_contained_reason(name)
            if reason:
                return reason
        return _server_not_running(name, adapter)

    if name == "f5tts":
        cfg = adapter.disabled_reason() if adapter else None
        if cfg:
            return cfg
        return _server_not_running(name, adapter)

    if name == "chattts":
        if adapter is not None and not adapter.config_ready():
            return tts_reason(TTS_REASON_WEIGHTS_MISSING, engine=name, installer=TTS_INSTALL_HINT_GENERIC)
        reachable, model_ready = adapter.module.health_state() if adapter else (False, False)
        if reachable and not model_ready:
            return tts_reason(TTS_REASON_SERVER_MODEL_NOT_READY, engine=name)
        return _server_not_running(name, adapter)

    if name == "gptsovits":
        ref = (os.environ.get("GPTSOVITS_REF_AUDIO") or "").strip()
        if not ref or not Path(ref).exists():
            return tts_reason(TTS_REASON_SETTING_REQUIRED, setting=_GPTSOVITS_REF_AUDIO_SETTING)
        if not (os.environ.get("GPTSOVITS_URL") or "").strip():
            reason = _self_contained_reason(name)
            if reason:
                return reason
        return _server_not_running(name, adapter)

    if name == "fishspeech":
        if fishspeech_engine.fish_api_key() and (
            _spec("fishaudio") or isolated_venv.venv_ready("fishspeech")
        ):
            return None
        if not (os.environ.get("FISHSPEECH_URL") or "").strip() and not (
            os.environ.get("FISHSPEECH_UPSTREAM") or ""
        ).strip():
            reason = _self_contained_reason(name)
            if reason:
                return reason
        return tts_reason(TTS_REASON_FISHSPEECH_SOURCE_REQUIRED, url=adapter.base_url() if adapter else "")

    if name == "sherpa":
        if adapter and adapter.available():
            return None
        return tts_reason(TTS_REASON_MODEL_NOT_FOUND, engine=name, installer=_OFFLINE_TTS_PREREQUISITE)

    if name == "kokoro":
        if adapter and adapter.available():
            return None
        return tts_reason(TTS_REASON_MODEL_NOT_FOUND, engine=name, installer=_OFFLINE_TTS_PREREQUISITE)

    if name == "azure":
        if adapter and adapter.available():
            return None
        if not _spec("azure.cognitiveservices.speech"):
            return tts_reason(TTS_REASON_PACKAGE_MISSING, package=_AZURE_SPEECH_PACKAGE)
        return tts_reason(TTS_REASON_SECRET_REQUIRED, secrets=_AZURE_SPEECH_SECRETS)

    if name == "edge":
        return tts_reason(TTS_REASON_EDGE_INIT_FAILED)

    allowed, gate_reason = memory_gate_allows(name)
    if not allowed:
        return tts_reason(TTS_REASON_MEMORY_GATE, engine=name, detail=gate_reason)

    return None


__all__ = ["engine_installed", "engine_unavailable_reason", "staging_dir", "staging_deps_done"]
