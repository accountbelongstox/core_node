# -*- coding: utf-8 -*-
"""
Bilingual sentences for the orchestration video.

Every card of the video shows English AND Chinese. Book sentences arrive from
Laravel with both (``languages``); a prompt task holds only the language it was
written in, so the missing counterpart is translated once through the shared AI
batch translator (``pyctl/translation/ai_batch_translate``: gateway, cache,
chunking) and stored back on the task, never translated again. A translation
that fails leaves the sentence one-language; the video still renders.
"""

from typing import Any, Dict, List, Optional, Set, Tuple

from pycore.pyctl.audio_orchestration import orch_sources, orch_store
from pycore.pyctl.translation.ai_batch_translate import translate_lines

LANGUAGE_EN = "en"
LANGUAGE_ZH = "zh"
LANGUAGE_NAMES = {LANGUAGE_EN: "English", LANGUAGE_ZH: "Simplified Chinese"}
TRANSLATE_SOURCE = "audio_orch_video"


def _texts(sentence: Dict[str, Any]) -> Dict[str, str]:
    """The texts a sentence already has, by language."""
    languages = {code: str(text).strip() for code, text in (sentence.get("languages") or {}).items() if str(text).strip()}
    own = LANGUAGE_ZH if str(sentence.get("language") or "").lower().startswith(LANGUAGE_ZH) else LANGUAGE_EN
    if own not in languages and str(sentence.get("text") or "").strip():
        languages[own] = str(sentence["text"]).strip()
    return languages


def complete(
    task: Dict[str, Any],
    sentences: List[Dict[str, Any]],
    seqs: Optional[Set[Any]] = None,
) -> Tuple[List[Dict[str, Any]], int, int]:
    """``(sentences, translated, failed)``: the sentences (only those whose
    ``seq`` is in ``seqs``, when given) with the missing English / Chinese side
    filled in. Nothing is translated twice: a stored translation is kept."""
    pending: Dict[str, List[Tuple[int, str]]] = {LANGUAGE_ZH: [], LANGUAGE_EN: []}
    for index, sentence in enumerate(sentences):
        if seqs is not None and sentence.get("seq") not in seqs:
            continue
        texts = _texts(sentence)
        for target, source in ((LANGUAGE_ZH, LANGUAGE_EN), (LANGUAGE_EN, LANGUAGE_ZH)):
            if target not in texts and source in texts:
                pending[target].append((index, texts[source]))
    if not any(pending.values()):
        return sentences, 0, 0
    updated = [dict(sentence, languages=dict(sentence.get("languages") or {})) for sentence in sentences]
    translated = failed = 0
    for target, source in ((LANGUAGE_ZH, LANGUAGE_EN), (LANGUAGE_EN, LANGUAGE_ZH)):
        entries = pending[target]
        if not entries:
            continue
        pairs = translate_lines(
            [text for _index, text in entries], LANGUAGE_NAMES[source], LANGUAGE_NAMES[target], source=TRANSLATE_SOURCE,
        )
        by_text = {pair["word"]: pair["translation"] for pair in pairs}
        for index, text in entries:
            result = by_text.get(text.strip())
            if result:
                updated[index]["languages"][target] = result
                translated += 1
            else:
                failed += 1
    if translated and orch_sources.is_text_task(task):
        # A prompt task keeps its sentences on the record: store the translations.
        orch_store.patch_task(str(task["task_id"]), {"sentences": updated})
    return updated, translated, failed


__all__ = ["complete"]
