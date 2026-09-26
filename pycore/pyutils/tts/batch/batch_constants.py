# -*- coding: utf-8 -*-
"""Shared constants center for the TTS batch libraries.

Every batch library (kokoro / gptsovits / parler / chattts) and the startup
self-check import from here so merge separators, silence-split parameters,
batch sizes and the shared cache directory stay defined exactly once.

Config (environment):
  TTS_BATCH_CACHE_DIR   - batch output root (default: <shared download cache>/tts/batch)
  TTS_BATCH_GROUP_SIZE  - words per merged synthesis (default 20)
  GPTSOVITS_BATCH_SIZE  - api_v2 internal fragment batch size (default 8)
  PARLER_BATCH_SIZE     - prompts per batched generate call (default 16)
  TTS_STARTUP_SELFCHECK - "1" enables the pyservice startup self-check
"""

import os
from pathlib import Path
from typing import Tuple

from pycore.pyfoundations.system_paths import get_shared_download_cache_dir
from pycore.pyutils.common.queue_center_contract import QUEUE_CENTER_WORD_AUDIO_BATCH

# --------------------------------------------------------------------------- #
# Environment keys                                                             #
# --------------------------------------------------------------------------- #
TTS_BATCH_CACHE_DIR_ENV = "TTS_BATCH_CACHE_DIR"
TTS_BATCH_GROUP_SIZE_ENV = "TTS_BATCH_GROUP_SIZE"
GPTSOVITS_BATCH_SIZE_ENV = "GPTSOVITS_BATCH_SIZE"
PARLER_BATCH_SIZE_ENV = "PARLER_BATCH_SIZE"
TTS_STARTUP_SELFCHECK_ENV = "TTS_STARTUP_SELFCHECK"

# --------------------------------------------------------------------------- #
# Merge + split parameters (shared by every merge-then-split strategy)         #
# --------------------------------------------------------------------------- #
MERGE_SEPARATOR_EN = ", "
MERGE_SEPARATOR_ZH = "，"
DEFAULT_GROUP_SIZE = int(QUEUE_CENTER_WORD_AUDIO_BATCH["default_batch_size"])

# Silence detection on merged audio: a window whose RMS stays below
# SILENCE_THRESHOLD_RATIO of the merged clip's peak RMS for at least
# MIN_SILENCE_MS marks a boundary; segments shorter than MIN_SEGMENT_MS are
# merged into their neighbor; each kept segment is padded by SEGMENT_PAD_MS.
SILENCE_THRESHOLD_RATIO = 0.02
MIN_SILENCE_MS = 150
MIN_SEGMENT_MS = 80
SEGMENT_PAD_MS = 40
WINDOW_MS = 10

# GPT-SoVITS api_v2: pause inserted between internal fragments; raised above the
# 0.3s default so silence splitting has a reliable boundary.
GPTSOVITS_FRAGMENT_INTERVAL_S = 0.5
GPTSOVITS_DEFAULT_BATCH_SIZE = 8

PARLER_DEFAULT_BATCH_SIZE = 16

# --------------------------------------------------------------------------- #
# Startup self-check                                                           #
# --------------------------------------------------------------------------- #
SELFCHECK_ENGINE_ORDER: Tuple[str, ...] = (
    "kokoro", "parler", "chattts", "gptsovits", "qwen3tts",
)
SELFCHECK_WORDS: Tuple[str, ...] = ("apple", "banana", "orange", "grape")
SELFCHECK_LANG = "en"
SELFCHECK_REPORT_NAME = "report.json"
SELFCHECK_BUS_SIGNAL = "pyutils.tts.batch.selfcheck"


def _env_int(key: str, default: int) -> int:
    try:
        value = int((os.environ.get(key) or "").strip())
        return value if value > 0 else default
    except (TypeError, ValueError):
        return default


def batch_cache_dir() -> Path:
    """Shared batch output root: env override > <shared download cache>/tts/batch."""
    override = (os.environ.get(TTS_BATCH_CACHE_DIR_ENV) or "").strip()
    if override:
        return Path(override)
    return get_shared_download_cache_dir() / "tts" / "batch"


def engine_output_dir(engine: str) -> Path:
    return batch_cache_dir() / (engine or "unknown").strip().lower()


def selfcheck_dir() -> Path:
    return batch_cache_dir() / "selfcheck"


def group_size() -> int:
    return _env_int(TTS_BATCH_GROUP_SIZE_ENV, DEFAULT_GROUP_SIZE)


def gptsovits_batch_size() -> int:
    return _env_int(GPTSOVITS_BATCH_SIZE_ENV, GPTSOVITS_DEFAULT_BATCH_SIZE)


def parler_batch_size() -> int:
    return _env_int(PARLER_BATCH_SIZE_ENV, PARLER_DEFAULT_BATCH_SIZE)


def merge_separator(lang: str) -> str:
    return MERGE_SEPARATOR_ZH if (lang or "").strip().lower().startswith("zh") else MERGE_SEPARATOR_EN


__all__ = [
    "TTS_BATCH_CACHE_DIR_ENV",
    "TTS_BATCH_GROUP_SIZE_ENV",
    "GPTSOVITS_BATCH_SIZE_ENV",
    "PARLER_BATCH_SIZE_ENV",
    "TTS_STARTUP_SELFCHECK_ENV",
    "MERGE_SEPARATOR_EN",
    "MERGE_SEPARATOR_ZH",
    "DEFAULT_GROUP_SIZE",
    "SILENCE_THRESHOLD_RATIO",
    "MIN_SILENCE_MS",
    "MIN_SEGMENT_MS",
    "SEGMENT_PAD_MS",
    "WINDOW_MS",
    "GPTSOVITS_FRAGMENT_INTERVAL_S",
    "GPTSOVITS_DEFAULT_BATCH_SIZE",
    "PARLER_DEFAULT_BATCH_SIZE",
    "SELFCHECK_ENGINE_ORDER",
    "SELFCHECK_WORDS",
    "SELFCHECK_LANG",
    "SELFCHECK_REPORT_NAME",
    "SELFCHECK_BUS_SIGNAL",
    "batch_cache_dir",
    "engine_output_dir",
    "selfcheck_dir",
    "group_size",
    "gptsovits_batch_size",
    "parler_batch_size",
    "merge_separator",
]
