# -*- coding: utf-8 -*-
"""
Stable codes of the TTS engine availability reasons.

Every "why is this engine off" hint is a ``CodedMessage``: the status UI
localizes it by code and params (``disabled_reason_code`` /
``disabled_reason_params``), while logs keep the English rendering below.
This module is a leaf (engine modules, the probe and the status use it).
"""

from typing import Any

from pycore.pyutils.common.coded_message import CodedMessage

TTS_REASON_NOT_INSTALLED = "tts_not_installed"
TTS_REASON_VENV_NOT_BUILT = "tts_venv_not_built"
TTS_REASON_VENV_NOT_BUILT_BASE_READY = "tts_venv_not_built_base_ready"
TTS_REASON_BASE_PYTHON_UNAVAILABLE = "tts_base_python_unavailable"
TTS_REASON_WEIGHTS_MISSING = "tts_model_weights_missing"
TTS_REASON_MODEL_NOT_FOUND = "tts_model_not_found"
TTS_REASON_SERVER_NOT_RUNNING = "tts_server_not_running"
TTS_REASON_SERVER_MODEL_NOT_READY = "tts_server_model_not_ready"
TTS_REASON_SETTING_REQUIRED = "tts_setting_required"
TTS_REASON_SECRET_REQUIRED = "tts_secret_required"
TTS_REASON_PACKAGE_MISSING = "tts_package_missing"
TTS_REASON_FISHSPEECH_SOURCE_REQUIRED = "tts_fishspeech_source_required"
TTS_REASON_FISHSPEECH_BRIDGE_NOT_READY = "tts_fishspeech_bridge_not_ready"
TTS_REASON_AUTH_COOLDOWN = "tts_auth_cooldown"
TTS_REASON_EDGE_INIT_FAILED = "tts_edge_init_failed"
TTS_REASON_MEMORY_GATE = "tts_memory_gate"
TTS_REASON_ENGINE_UNAVAILABLE = "tts_engine_unavailable"
TTS_REASON_QUOTA_EXHAUSTED = "tts_quota_exhausted"

# Installer hints (script names; not UI text).
TTS_INSTALL_HINT_GENERIC = "Step5x_Install*.ps1 / 1xx_install_*.sh"

_TEMPLATES = {
    TTS_REASON_NOT_INSTALLED: "Not installed - run {installer}",
    TTS_REASON_VENV_NOT_BUILT: "{engine} isolated venv not built - run {installer}",
    TTS_REASON_VENV_NOT_BUILT_BASE_READY: (
        "{engine} isolated venv not built - base Python {python_version} is ready; run {installer}"
    ),
    TTS_REASON_BASE_PYTHON_UNAVAILABLE: "{engine} base Python unavailable: {detail}",
    TTS_REASON_WEIGHTS_MISSING: "{engine} model weights missing or incomplete - run {installer}",
    TTS_REASON_MODEL_NOT_FOUND: "{engine} model not found - run {installer}",
    TTS_REASON_SERVER_NOT_RUNNING: "{engine} API server not running ({url})",
    TTS_REASON_SERVER_MODEL_NOT_READY: "{engine} server is reachable but its model is not ready",
    TTS_REASON_SETTING_REQUIRED: "Set {setting}",
    TTS_REASON_SECRET_REQUIRED: "Set {secrets} in .secret_keys",
    TTS_REASON_PACKAGE_MISSING: "{package} package not installed",
    TTS_REASON_FISHSPEECH_SOURCE_REQUIRED: "Start Fish Speech server ({url}) or set FISH_API_KEY with fish-audio-sdk",
    TTS_REASON_FISHSPEECH_BRIDGE_NOT_READY: (
        "Fish Speech bridge is up but cannot synthesize - set FISH_API_KEY, "
        "FISHSPEECH_UPSTREAM, or start fish-speech tools/api_server.py"
    ),
    TTS_REASON_AUTH_COOLDOWN: "{engine} auth failure cooldown ({seconds}s remaining)",
    TTS_REASON_EDGE_INIT_FAILED: "edge-tts client failed to initialize (check package / network)",
    TTS_REASON_MEMORY_GATE: "Masked by memory gate: {detail}",
    TTS_REASON_ENGINE_UNAVAILABLE: "{engine} unavailable",
    TTS_REASON_QUOTA_EXHAUSTED: "{engine} quota exhausted: {detail}",
}


def tts_reason(code: str, **params: Any) -> CodedMessage:
    """One coded TTS availability reason (English rendering + code + params)."""
    return CodedMessage(code, params, _TEMPLATES.get(code))


__all__ = [name for name in globals() if name.startswith("TTS_")] + ["tts_reason"]
