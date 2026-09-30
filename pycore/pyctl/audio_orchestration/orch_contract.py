# -*- coding: utf-8 -*-
"""
Audio orchestration defaults shared with the pycore-manager UI and the wordnew
client composer: ``config/audio_orchestration_contract.json`` (one source for
the default output mode, segmentation and pattern on every end).
"""

import json
from typing import Any, Dict, List

from pycore.pyfoundations.system_paths import get_core_node_root

ORCH_CONTRACT_PATH = (get_core_node_root() / "config" / "audio_orchestration_contract.json").resolve()
ORCH_CONTRACT: Dict[str, Any] = json.loads(ORCH_CONTRACT_PATH.read_text(encoding="utf-8"))

DEFAULT_OUTPUT_MODE: str = str(ORCH_CONTRACT["default_output_mode"])
DEFAULT_SEGMENT_MODE: str = str(ORCH_CONTRACT["default_segment_mode"])
DEFAULT_SEGMENT_VALUE: int = int(ORCH_CONTRACT["default_segment_value"])
DEFAULT_WORD_MODE: str = str(ORCH_CONTRACT["default_word_mode"])
MAX_STEP_TIMES: int = int(ORCH_CONTRACT["max_step_times"])


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
    "default_pattern",
]
