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
}


def model_reason(code: str, **params: Any) -> CodedMessage:
    """One coded model availability reason."""
    return CodedMessage(code, params, _TEMPLATES.get(code))


__all__ = [name for name in globals() if name.startswith("MODEL_REASON_")] + ["model_reason"]
