# -*- coding: utf-8 -*-
"""Orchestration task plan: pattern expansion into audio items, the segment
preview, and the durable manifest state a generation resumes from."""

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.sentence_segmenter import sentence_segmenter
from pycore.pyctl.audio_orchestration import orch_books, orch_store, orch_words

# Part of the plan signature: a manifest planned before sentences were cut at
# their verse markers never resumes.
SEGMENTATION_PLAN = "verses"


# --------------------------------------------------------------------------- #
# durable generation state (resume after crash / pycore restart)               #
# --------------------------------------------------------------------------- #
def plan_signature(task: Dict[str, Any], sentence_total: int) -> str:
    """Stable fingerprint of every input that shapes the manifest. A persisted
    manifest only resumes when the signature matches; any task edit (pattern,
    segmentation, word policy, book, sentence count) forces a fresh run."""
    payload = json.dumps({
        "source_key": str((task.get("book") or {}).get("source_key") or ""),
        "segment_mode": str(task.get("segment_mode") or "count"),
        "segment_value": int(task.get("segment_value") or 1),
        "pattern": task.get("pattern") or [],
        "word_mode": str(task.get("word_mode") or "all"),
        "new_only_max_read_count": int(task.get("new_only_max_read_count") or 0),
        "word_group_id": str(task.get("word_group_id") or ""),
        "sentence_total": int(sentence_total),
        "segmentation": SEGMENTATION_PLAN,
    }, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def save_manifest_state(
    task: Dict[str, Any],
    segment_items: List[List[Dict[str, Any]]],
    resolved: Dict[str, str],
    stats: Dict[str, Any],
    resource_meta: Optional[Dict[str, Any]] = None,
) -> None:
    orch_store.save_manifest(str(task["task_id"]), {
        "signature": str(task.get("plan_signature") or ""),
        "generation_id": str(task.get("generation_id") or ""),
        "segment_items": segment_items,
        "resolved": resolved,
        "stats": stats,
        "resource_meta": resource_meta or {},
        "updated_at": int(time.time()),
    })


def load_resume_state(
    task: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Reload the persisted manifest when it matches the CURRENT plan. Returns
    {segment_items, resolved, stats, resource_meta, generation_id} or None
    (fresh run)."""
    manifest = orch_store.load_manifest(str(task["task_id"]))
    if not isinstance(manifest, dict) or not manifest:
        return None
    if str(manifest.get("signature") or "") != str(task.get("plan_signature") or ""):
        return None
    segments = task.get("segments") or []
    segment_items = manifest.get("segment_items")
    if not segments or not isinstance(segment_items, list) or len(segment_items) != len(segments):
        return None
    resolved_raw = manifest.get("resolved")
    resolved = {
        str(resource_id): str(audio_path)
        for resource_id, audio_path in (resolved_raw.items() if isinstance(resolved_raw, dict) else [])
        if audio_path and Path(str(audio_path)).is_file()
    }
    stats_raw = manifest.get("stats")
    meta_raw = manifest.get("resource_meta")
    return {
        "segment_items": segment_items,
        "resolved": resolved,
        "stats": stats_raw if isinstance(stats_raw, dict) else {},
        "resource_meta": meta_raw if isinstance(meta_raw, dict) else {},
        "generation_id": str(manifest.get("generation_id") or ""),
    }


# --------------------------------------------------------------------------- #
# item plan                                                                    #
# --------------------------------------------------------------------------- #
def speakable_pieces(text: str) -> List[str]:
    """Sentences of one source text. Text that still carries glued verse
    markers is cut at them by the shared segmentation, so no lookup or
    synthesis ever receives several verses as one sentence."""
    text = str(text or "").strip()
    if not sentence_segmenter.has_verse_marker(text):
        return [text] if text else []
    return [row["text"] for row in sentence_segmenter.split_verses(text) if row["text"]]


def _sentence_lang_text(sentence: Dict[str, Any], lang: str) -> str:
    languages = sentence.get("languages") or {}
    text = str(languages.get(lang) or "").strip()
    if not text and lang == str(sentence.get("language") or ""):
        text = str(sentence.get("text") or "").strip()
    return text


def build_sentence_items(
    task: Dict[str, Any],
    sentence: Dict[str, Any],
    consume: bool,
    use_backend: bool = True,
    auth_record: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Expand the task pattern for one sentence into audio items.
    Item: {kind: word|sentence, language, text}."""
    language = str((task.get("book") or {}).get("language") or sentence.get("language") or "en")
    target_language = str((task.get("book") or {}).get("target_language") or "zh")
    items: List[Dict[str, Any]] = []
    for step in task.get("pattern") or []:
        step_type = str(step.get("type") or "")
        times = max(1, int(step.get("times") or 1))
        # Per-step word policy: "words_new"/"words_all" carry their own mode;
        # legacy "words" defers to the task-level word_mode.
        step_word_mode = {"words_new": "new_only", "words_all": "all"}.get(step_type)
        if step_type in ("words", "words_new", "words_all"):
            selected = orch_words.select_words(
                task,
                " ".join(speakable_pieces(str(sentence.get("text") or ""))),
                language,
                target_language,
                consume,
                use_backend=use_backend,
                auth_record=auth_record,
                word_mode=step_word_mode,
            )
            for _ in range(times):
                items.extend(
                    {"kind": "word", "language": language, "text": word}
                    for word in selected["words"]
                )
            continue
        lang = {"sentence_en": "en", "sentence_zh": "zh"}.get(step_type)
        if lang is None:
            continue
        pieces = speakable_pieces(_sentence_lang_text(sentence, lang))
        for _ in range(times):
            items.extend({"kind": "sentence", "language": lang, "text": piece} for piece in pieces)
    return items


def plan_task(task: Dict[str, Any], sentences: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute the segment partition + per-segment item counts WITHOUT consuming
    the virtual-read set (simulated on a copy)."""
    mode = str(task.get("segment_mode") or "count")
    value = int(task.get("segment_value") or 1)
    segments = []
    # One shared simulation across ALL segments: the virtual-read set carries
    # over segment boundaries exactly like the real generation does.
    simulated = dict(task)
    simulated["virtual_read"] = []
    simulated_auth = {"virtual_read": set()}
    for segment in orch_books.partition_sentences(sentences, mode, value):
        item_count = 0
        word_count = 0
        for index in range(segment["start"], segment["end"] + 1):
            # Relay-safe preview: local tokenization only - the per-sentence
            # backend read-state queries run later, inside background
            # generation where no relay deadline applies.
            items = build_sentence_items(simulated, sentences[index], consume=True, use_backend=False, auth_record=simulated_auth)
            item_count += len(items)
            word_count += sum(1 for item in items if item["kind"] == "word")
        segments.append({**segment, "item_count": item_count, "word_count": word_count})
    return {"segments": segments, "sentence_total": len(sentences)}


__all__ = [
    "build_sentence_items",
    "load_resume_state",
    "plan_signature",
    "speakable_pieces",
    "plan_task",
    "save_manifest_state",
]
