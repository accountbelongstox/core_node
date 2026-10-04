# -*- coding: utf-8 -*-
"""STT engine declarations: the ONE place STT engine facts live.

Declaration order is the default engine priority.
"""

from pycore.pyutils.common.model_manifest import (
    CATEGORY_STT,
    RUNTIME_CLOUD,
    RUNTIME_MODEL,
    ModelEntry,
    model_manifest,
)
from pycore.pyutils.common.whisper_models import FASTER_WHISPER_INSTALLER, WHISPER_INSTALLER

STT_ENTRIES = (
    ModelEntry(
        "faster-whisper", CATEGORY_STT, RUNTIME_MODEL,
        note="Faster-Whisper (CTranslate2; GPU large-v3 / CPU medium)",
        aliases=("faster_whisper",), managed_kind="model", concurrency="in_process",
        distribution="faster-whisper", tier_engine="faster_whisper",
        pip=("faster_whisper", "faster-whisper"), library_name="faster_whisper",
        library_kind="pip",
        installer=FASTER_WHISPER_INSTALLER,
    ),
    ModelEntry(
        "whisper", CATEGORY_STT, RUNTIME_MODEL,
        note="OpenAI Whisper (offline; GPU large-v3 / CPU medium)",
        managed_kind="model", concurrency="in_process", distribution="openai-whisper",
        tier_engine="whisper", pip=("whisper", "openai-whisper"), library_kind="pip",
        installer=WHISPER_INSTALLER,
    ),
    ModelEntry(
        "vosk", CATEGORY_STT, RUNTIME_MODEL,
        note="Vosk offline ASR (lightweight; needs a model dir)",
        managed_kind="model", concurrency="in_process", distribution="vosk",
        pip=("vosk", "vosk"), library_kind="pip",
        installer="Model_Vosk.ps1 / 129_install_vosk.sh",
    ),
    ModelEntry(
        "azure", CATEGORY_STT, RUNTIME_CLOUD,
        note="Azure Speech cloud STT (free F0 ~0.5M chars/mo; API fallback)",
        concurrency="cloud", cloud=True,
    ),
)

model_manifest.register(STT_ENTRIES)
