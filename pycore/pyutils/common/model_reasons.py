# -*- coding: utf-8 -*-
"""Stable codes of the cross-category "why is this model off" reasons.

The same ``CodedMessage`` contract as ``tts_reason_codes`` (English rendering +
code + params, localized by the UI). Every category (TTS, STT, OCR, LLM, cloud
AI, translate) reports the boot verdict reason through these codes.
"""

from typing import Any

from pycore.pyutils.common.coded_message import CodedMessage

MODEL_REASON_SECRET_MISSING = "model_secret_missing"
MODEL_REASON_PACKAGE_MISSING = "model_package_missing"
MODEL_REASON_WEIGHTS_MISSING = "model_weights_missing"
MODEL_REASON_SETTING_REQUIRED = "model_setting_required"
MODEL_REASON_LOAD_FAILED = "model_load_failed"
MODEL_REASON_NOT_INSTALLED = "model_not_installed"
MODEL_REASON_BINARY_MISSING = "model_binary_missing"
MODEL_REASON_PLATFORM_UNSUPPORTED = "model_platform_unsupported"
MODEL_REASON_DISABLED_BY_USER = "model_disabled_by_user"
MODEL_REASON_LOCAL_MODELS_ONLY = "model_local_models_only"
MODEL_REASON_SERVER_NOT_RUNNING = "model_server_not_running"
MODEL_REASON_SERVER_UNREACHABLE = "model_server_unreachable"
MODEL_REASON_INSTALL_REQUIRED = "model_install_required"
MODEL_REASON_INPUT_REQUIRED = "model_input_required"
MODEL_REASON_INPUT_INVALID = "model_input_invalid"
MODEL_REASON_NO_ENGINE_AVAILABLE = "model_no_engine_available"
MODEL_REASON_UNKNOWN_ENGINE = "model_unknown_engine"
MODEL_REASON_ENGINE_FAILED = "model_engine_failed"
MODEL_REASON_EMPTY_OUTPUT = "model_empty_output"

_TEMPLATES = {
    MODEL_REASON_SECRET_MISSING: "Set {secrets} in .secret_keys",
    MODEL_REASON_PACKAGE_MISSING: "{package} package not installed",
    MODEL_REASON_WEIGHTS_MISSING: "{model} model weights missing or incomplete",
    MODEL_REASON_SETTING_REQUIRED: "Set {setting}",
    MODEL_REASON_LOAD_FAILED: "{model} failed to load: {detail}",
    MODEL_REASON_NOT_INSTALLED: "{model} is not installed",
    MODEL_REASON_BINARY_MISSING: "{binary} executable not found",
    MODEL_REASON_PLATFORM_UNSUPPORTED: "{model} is not supported on {platform}",
    MODEL_REASON_DISABLED_BY_USER: "{model} is disabled in settings",
    MODEL_REASON_LOCAL_MODELS_ONLY: "{model} is a third-party service; {platform} nodes serve local GPU/CPU models only",
    MODEL_REASON_SERVER_NOT_RUNNING: "{model} server is not running (auto-starts on use when enabled)",
    MODEL_REASON_SERVER_UNREACHABLE: "{model} external server is not reachable; start it manually",
    MODEL_REASON_INSTALL_REQUIRED: "{model}: {item} missing - run {installer}",
    MODEL_REASON_INPUT_REQUIRED: "{field} is required",
    MODEL_REASON_INPUT_INVALID: "{field} is invalid: {detail}",
    MODEL_REASON_NO_ENGINE_AVAILABLE: "no {category} engine available",
    MODEL_REASON_UNKNOWN_ENGINE: "unknown {category} engine: {model}",
    MODEL_REASON_ENGINE_FAILED: "{model} failed: {detail}",
    MODEL_REASON_EMPTY_OUTPUT: "{model} returned no {item}",
}


def model_reason(code: str, **params: Any) -> CodedMessage:
    """One coded model availability reason."""
    return CodedMessage(code, params, _TEMPLATES.get(code))


__all__ = [name for name in globals() if name.startswith("MODEL_REASON_")] + ["model_reason"]
