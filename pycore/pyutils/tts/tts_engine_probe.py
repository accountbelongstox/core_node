# -*- coding: utf-8 -*-
"""
Cheap TTS engine install vs runtime-ready probes for status UI.

``engine_installed`` — prerequisites present (pip package, staging .deps_done,
cloned repo, or model cache) without network or heavy import.
``engine_unavailable_reason`` — human hint when an engine is off (not installed,
missing config, server down, or model files absent).
"""

import importlib.util
import os
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.system_paths import get_core_node_root, get_local_data_dir

from pycore.pyutils.tts import streamelements_engine
from pycore.pyutils.tts import cosyvoice_engine
from pycore.pyutils.tts import f5tts_engine
from pycore.pyutils.tts import chattts_engine
from pycore.pyutils.tts import gptsovits_engine
from pycore.pyutils.tts import fishspeech_engine
from pycore.pyutils.tts import sherpa_engine
from pycore.pyutils.tts import kokoro_engine
from pycore.pyutils.tts import azure_engine


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

_NOT_INSTALLED = "Not installed — run PreparePycorePrerequisites"


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
        return staging_deps_done("cosyvoice") or _staging_clone_ready(
            "cosyvoice", ("runtime/python/fastapi/server.py", "runtime/python"))
    if name == "fishspeech":
        return (
            staging_deps_done("fishspeech")
            or _spec("fishaudio")
            or _staging_clone_ready("fishspeech", ("tools/api_server.py",))
        )
    if name == "qwen3tts":
        return _spec("qwen_tts") or staging_deps_done("qwen3tts")
    if name == "bark":
        return (_spec("transformers") and _spec("scipy")) or staging_deps_done("bark")
    if name == "parler":
        return _spec("parler_tts") or staging_deps_done("parler")
    if name == "voxcpm2":
        return _spec("voxcpm") or staging_deps_done("voxcpm2")
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
        return _spec("melo")
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


def engine_unavailable_reason(name: str) -> Optional[str]:
    """Why an engine cannot synthesize now; None when no hint applies."""
    if not engine_installed(name):
        return _NOT_INSTALLED

    if name == "streamelements":
        return streamelements_engine.disabled_reason()

    if name == "cosyvoice":
        cfg = cosyvoice_engine.disabled_reason()
        if cfg:
            return cfg
        return f"CosyVoice API server not reachable ({cosyvoice_engine.base_url()})"

    if name == "f5tts":
        cfg = f5tts_engine.disabled_reason()
        if cfg:
            return cfg
        return f"F5-TTS API server not running ({f5tts_engine.base_url()})"

    if name == "chattts":
        reachable, model_ready = chattts_engine._probe_health()
        if reachable and not model_ready:
            return "ChatTTS model not loaded (first synth downloads from HuggingFace)"
        return f"ChatTTS API server not running ({chattts_engine.base_url()})"

    if name == "gptsovits":
        ref = (os.environ.get("GPTSOVITS_REF_AUDIO") or "").strip()
        if not ref or not Path(ref).exists():
            return "Set GPTSOVITS_REF_AUDIO to a reference clip"
        return f"GPT-SoVITS API server not running ({gptsovits_engine.base_url()})"

    if name == "fishspeech":
        if (os.environ.get("FISH_API_KEY") or "").strip() and _spec("fishaudio"):
            return None
        return (
            f"Start Fish Speech server ({fishspeech_engine.base_url()}) "
            "or set FISH_API_KEY with fish-audio-sdk"
        )

    if name == "sherpa":
        if sherpa_engine.available():
            return None
        return "Sherpa-ONNX model not found — run offline TTS prerequisite"

    if name == "kokoro":
        if kokoro_engine.available():
            return None
        return "Kokoro model not found — run Kokoro / sherpa prerequisite"

    if name == "azure":
        if azure_engine.available():
            return None
        if not _spec("azure.cognitiveservices.speech"):
            return "azure-cognitiveservices-speech package not installed"
        return "Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .secret_keys"

    if name == "edge":
        return "edge-tts client failed to initialize (check package / network)"

    if name in ("melotts", "bark", "parler", "qwen3tts", "voxcpm2", "gtts_web"):
        return None

    return None


__all__ = ["engine_installed", "engine_unavailable_reason", "staging_dir", "staging_deps_done"]
