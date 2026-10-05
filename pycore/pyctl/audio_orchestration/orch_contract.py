# -*- coding: utf-8 -*-
"""
Audio orchestration defaults shared with the pycore-manager UI and the wordnew
client composer: ``config/audio_orchestration_contract.json`` (one source for
the default output mode, segmentation and pattern on every end).
"""

import json
from typing import Any, Dict, List, Tuple

from pycore.pyfoundations.system_paths import get_core_node_root

ORCH_CONTRACT_PATH = (get_core_node_root() / "config" / "audio_orchestration_contract.json").resolve()
ORCH_CONTRACT: Dict[str, Any] = json.loads(ORCH_CONTRACT_PATH.read_text(encoding="utf-8"))

DEFAULT_OUTPUT_MODE: str = str(ORCH_CONTRACT["default_output_mode"])
DEFAULT_SEGMENT_MODE: str = str(ORCH_CONTRACT["default_segment_mode"])
DEFAULT_SEGMENT_VALUE: int = int(ORCH_CONTRACT["default_segment_value"])
DEFAULT_WORD_MODE: str = str(ORCH_CONTRACT["default_word_mode"])
MAX_STEP_TIMES: int = int(ORCH_CONTRACT["max_step_times"])
STEP_TYPES: Tuple[str, ...] = (*ORCH_CONTRACT["step_types"], *ORCH_CONTRACT["legacy_step_types"])
PHRASES_STEP_TYPE = "phrases"
BUNDLE_MAX_ITEMS: int = int(ORCH_CONTRACT["transfer"]["pycore_bundle_max_items"])
BUNDLE_MAX_BYTES: int = int(ORCH_CONTRACT["transfer"]["pycore_bundle_max_bytes"])
BUNDLE_MEDIA_TYPE: str = str(ORCH_CONTRACT["transfer"]["pycore_bundle_media_type"])
BOOK_PLAN: Dict[str, Any] = ORCH_CONTRACT["book_plan"]
PLAN_HINT_TTL_SECONDS: float = float(BOOK_PLAN["claim_hint_ttl_seconds"])
FAST_PASS_ENABLED: bool = bool(BOOK_PLAN["fast_pass"]["enabled"])
FAST_PASS_ENGINE: str = str(BOOK_PLAN["fast_pass"]["engine"])
QUALITY_ENGINE: str = str(BOOK_PLAN["fast_pass"]["quality_engine"])
QUALITY_VARIANT: str = str(BOOK_PLAN["fast_pass"]["quality_variant"])
PHRASE_PIPELINE: Dict[str, Any] = ORCH_CONTRACT["phrase_pipeline"]
PHRASE_KIND: str = str(PHRASE_PIPELINE["kind"])
PHRASE_LANGUAGES: Tuple[str, ...] = tuple(str(language) for language in PHRASE_PIPELINE["languages"])
PHRASE_MEANING_LANGUAGE: str = str(PHRASE_PIPELINE["meaning_language"])


def default_pattern() -> List[Dict[str, Any]]:
    """A fresh copy of the contract's default pattern."""
    return [{"type": str(step["type"]), "times": int(step["times"])} for step in ORCH_CONTRACT["default_pattern"]]


__all__ = [
    "ORCH_CONTRACT",
    "DEFAULT_OUTPUT_MODE",
    "DEFAULT_SEGMENT_MODE",
    "DEFAULT_SEGMENT_VALUE",
    "DEFAULT_WORD_MODE",
    "MAX_STEP_TIMES",
    "STEP_TYPES",
    "PHRASES_STEP_TYPE",
    "BUNDLE_MAX_ITEMS",
    "BUNDLE_MAX_BYTES",
    "BUNDLE_MEDIA_TYPE",
    "BOOK_PLAN",
    "PLAN_HINT_TTL_SECONDS",
    "FAST_PASS_ENABLED",
    "FAST_PASS_ENGINE",
    "QUALITY_ENGINE",
    "QUALITY_VARIANT",
    "PHRASE_PIPELINE",
    "PHRASE_KIND",
    "PHRASE_LANGUAGES",
    "PHRASE_MEANING_LANGUAGE",
    "default_pattern",
]
