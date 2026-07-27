# -*- coding: utf-8 -*-
"""
Offline dictionary router — the local face of the ECDICT + WordNet word
dictionary (pyutils/translator/dictionary). A FREE, offline word-translation
source the FE surfaces alongside Google/AI translation.

Endpoints (prefix /api/local/dictionary):
  GET /status            -> { success, ecdict:{available,db_path,entries},
                              wordnet:{available} } — install/availability for the
                              UI (entries=0 + available:false means run the shell
                              prereq install_dictionaries.sh).
  GET /lookup?word=&target=zh
                         -> rich entry: { success, found, word, translation,
                              definition, phonetic, pos, tags[], collins, oxford,
                              bnc, frq, exchange, wordnet_definition, synonyms[],
                              source } (+ ``target_translation`` for the requested
                              target language).

Reads the in-process DictionaryService singleton — local SQLite, no network.
Plain ``def`` (FastAPI threadpool); the SQLite read is fast + lock-guarded.
"""

from typing import Optional

import fastapi

from pycore.pyutils.translator.dictionary import get_dictionary_service

router = fastapi.APIRouter(prefix="/api/local/dictionary",
                           tags=["Local Processing - Dictionary"])


@router.get("/status")
def dictionary_status():
    """ECDICT + WordNet availability + entry count (install hint when absent)."""
    status = get_dictionary_service().status()
    return {"success": True, **status}


@router.get("/lookup")
def dictionary_lookup(word: str, target: Optional[str] = "zh"):
    """Rich offline entry for ``word`` + the translation for ``target`` language.

    ``found`` is false when ECDICT has no entry (WordNet may still fill the
    English definition / synonyms). ``target_translation`` is the single-language
    answer for the requested target (None when ECDICT cannot serve that target)."""
    svc = get_dictionary_service()
    word = (word or "").strip()
    if not word:
        return {"success": False, "error": "word is required", "found": False}
    entry = svc.lookup(word)
    entry["success"] = True
    entry["target"] = target or "zh"
    entry["target_translation"] = svc.translate(word, target or "zh")
    return entry
