# -*- coding: utf-8 -*-
"""
Per-task-type capability fallback chains (shared user_data).

translation: default google → ecdict → wordnet → ai
voice_tts:   mirrors tts_orchestrator order (chattts → cosyvoice → gptsovits → … → azure)
"""

from typing import Any, Dict, List

from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyutils.tts.tts_orchestrator import reload_tts_priority

_SECTION = "task_capability_chains"

_DEFAULT_TRANSLATION = ["google", "ecdict", "wordnet", "ai"]


def get_chains() -> Dict[str, Any]:
    # voice_tts always mirrors the live orchestrator order (reload migrates
    # legacy capability_priorities.tts / voice_tts into the same chain).
    order = reload_tts_priority()
    section = get_user_data_store().get_section(_SECTION) or {}
    translation = section.get("translation")
    if not isinstance(translation, list) or not translation:
        translation = list(_DEFAULT_TRANSLATION)
    return {
        "translation": [str(x) for x in translation if x],
        "voice_tts": list(order),
    }


def save_chain(task_type: str, priority: List[str]) -> Dict[str, Any]:
    store = get_user_data_store()
    section = dict(store.get_section(_SECTION) or {})
    key = task_type.strip().lower()
    if key not in ("translation", "voice_tts"):
        return {"ok": False, "error": f"unknown task type: {task_type}"}
    cleaned = [str(x).strip() for x in (priority or []) if str(x).strip()]
    section[key] = cleaned
    store.set_section(_SECTION, section)
    if key == "voice_tts":
        caps = store.get_section("capability_priorities") or {}
        caps["tts"] = cleaned
        store.set_section("capability_priorities", caps)
        reload_tts_priority()
    return {"ok": True, "chains": get_chains()}
