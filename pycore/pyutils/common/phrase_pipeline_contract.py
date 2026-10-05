# -*- coding: utf-8 -*-
"""Phrase pipeline audio values of ``config/audio_orchestration_contract.json``
(``phrase_pipeline.audio``) for pyutils modules, which cannot import the pyctl
orchestration contract adapter."""

import json
from typing import Any, Dict

from pycore.pyfoundations.system_paths import get_core_node_root

PHRASE_PIPELINE_CONTRACT_PATH = (get_core_node_root() / "config" / "audio_orchestration_contract.json").resolve()
PHRASE_PIPELINE_AUDIO: Dict[str, Any] = json.loads(
    PHRASE_PIPELINE_CONTRACT_PATH.read_text(encoding="utf-8")
)["phrase_pipeline"]["audio"]

PHRASE_AUDIO_LANE: str = str(PHRASE_PIPELINE_AUDIO["lane"])
PHRASE_AUDIO_BATCH_CHUNK_SIZE: int = int(PHRASE_PIPELINE_AUDIO["batch_chunk_size"])


__all__ = [
    "PHRASE_AUDIO_BATCH_CHUNK_SIZE",
    "PHRASE_AUDIO_LANE",
    "PHRASE_PIPELINE_AUDIO",
    "PHRASE_PIPELINE_CONTRACT_PATH",
]
