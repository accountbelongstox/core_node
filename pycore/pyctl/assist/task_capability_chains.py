# -*- coding: utf-8 -*-
"""
Per-task-type capability fallback chains (shared user_data).

translation: default google -> local_ai -> ecdict -> wordnet -> ai; local-models-only
             nodes (Colab/Kaggle) run local_ai first and never google
voice_tts:   mirrors tts_orchestrator order (chattts -> cosyvoice -> gptsovits -> ... -> azure)
"""

from typing import Any, Dict, List

from pycore.pyfoundations.notebook_policy import local_models_only
from pycore.pyutils.common.user_data_store import (
    USER_DATA_SECTION_CAPABILITY_PRIORITIES,
    USER_DATA_SECTION_TASK_CAPABILITY_CHAINS,
    user_data_store,
)
from pycore.pyutils.translator.google_translator import GOOGLE_TRANSLATE_SERVICE
from pycore.pyctl.translation.local_ai_translator import LOCAL_AI_TRANSLATE_PROVIDER
from pycore.pyutils.tts.engine_policy import reload_tts_priority

_SECTION = USER_DATA_SECTION_TASK_CAPABILITY_CHAINS

_DEFAULT_TRANSLATION = [GOOGLE_TRANSLATE_SERVICE, LOCAL_AI_TRANSLATE_PROVIDER, "ecdict", "wordnet", "ai"]


def _effective_translation(chain: List[str]) -> List[str]:
    """Local-models-only nodes switch the chain to local AI translation first."""
    if not local_models_only():
        return chain
    rest = [x for x in chain if x not in (LOCAL_AI_TRANSLATE_PROVIDER, GOOGLE_TRANSLATE_SERVICE)]
    return [LOCAL_AI_TRANSLATE_PROVIDER] + rest


def get_chains() -> Dict[str, Any]:
    # voice_tts always mirrors the live orchestrator order (reload migrates
    # legacy capability_priorities.tts / voice_tts into the same chain).
    order = reload_tts_priority()
    section = user_data_store.get_section(_SECTION) or {}
    translation = section.get("translation")
    if not isinstance(translation, list) or not translation:
        translation = list(_DEFAULT_TRANSLATION)
    return {
        "translation": _effective_translation([str(x) for x in translation if x]),
        "voice_tts": list(order),
    }


def save_chain(task_type: str, priority: List[str]) -> Dict[str, Any]:
    store = user_data_store
    section = dict(store.get_section(_SECTION) or {})
    key = task_type.strip().lower()
    if key not in ("translation", "voice_tts"):
        return {"ok": False, "error": f"unknown task type: {task_type}"}
    cleaned = [str(x).strip() for x in (priority or []) if str(x).strip()]
    section[key] = cleaned
    store.set_section(_SECTION, section)
    if key == "voice_tts":
        caps = store.get_section(USER_DATA_SECTION_CAPABILITY_PRIORITIES) or {}
        caps["tts"] = cleaned
        store.set_section(USER_DATA_SECTION_CAPABILITY_PRIORITIES, caps)
        reload_tts_priority()
    return {"ok": True, "chains": get_chains()}
