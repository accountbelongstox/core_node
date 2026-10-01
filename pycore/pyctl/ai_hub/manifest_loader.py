# -*- coding: utf-8 -*-
"""Imports every declaring leaf manifest and boot-check module so the registry
and the boot checks are complete before they are read."""

import pycore.pyctl.ai.ai_boot_checks  # noqa: F401
import pycore.pyctl.ai.ai_manifest  # noqa: F401
import pycore.pyutils.llm.llm_engines  # noqa: F401
import pycore.pyutils.llm.llm_manifest  # noqa: F401
import pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator  # noqa: F401
import pycore.pyutils.ocr_cluster.ocr_manifest  # noqa: F401
import pycore.pyutils.stt.stt_manifest  # noqa: F401
import pycore.pyutils.stt.stt_orchestrator  # noqa: F401
import pycore.pyutils.translator.translate_boot_checks  # noqa: F401
import pycore.pyutils.translator.translate_manifest  # noqa: F401
import pycore.pyutils.tts.engine_registry  # noqa: F401
import pycore.pyutils.tts.tts_manifest  # noqa: F401
from pycore.pyutils.common.model_manifest import ModelManifest, model_manifest


def load() -> ModelManifest:
    return model_manifest


__all__ = ["load"]
