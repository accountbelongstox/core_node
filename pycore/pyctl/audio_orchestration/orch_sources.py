# -*- coding: utf-8 -*-
"""
Task sources of the audio-orchestration library (source-agnostic tasks).

Every task record carries ``source`` (records without it are vocabulary-book
tasks). The source decides only where the ordered sentence list comes from:

- ``vocab_book``      Laravel book sentences (``book.source_key``, orch_books)
- text-input sources  inline ``sentences`` stored in the task record, built
                      from submitted text items (``build_text_sentences``)

Everything after the sentence list (manifest, resources, assembly) is the
same pipeline for every source.
"""

from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.text_parsing import split_sentences

from pycore.pyctl.audio_orchestration import orch_books, orch_store

ORCH_SOURCE_VOCAB_BOOK = "vocab_book"
ORCH_SOURCE_PROMPT_REWRITE = "prompt_rewrite"
ORCH_SOURCES = (ORCH_SOURCE_VOCAB_BOOK, ORCH_SOURCE_PROMPT_REWRITE)
ORCH_TEXT_SOURCES = (ORCH_SOURCE_PROMPT_REWRITE,)
ORCH_TEXT_TASK_RETENTION = 200
ORCH_TEXT_ITEM_CAP = 50
ORCH_TEXT_CHARS_CAP = 8000


def task_source(task: Dict[str, Any]) -> str:
    source = str(task.get("source") or "")
    return source if source in ORCH_SOURCES else ORCH_SOURCE_VOCAB_BOOK


def is_text_task(task: Dict[str, Any]) -> bool:
    return task_source(task) in ORCH_TEXT_SOURCES


def task_input(task: Dict[str, Any]) -> str:
    return "text" if is_text_task(task) else "book"


def task_label(task: Dict[str, Any]) -> str:
    """Short origin label for task event lines."""
    if is_text_task(task):
        return f"{task_source(task)} ({len(task.get('sentences') or [])} sentences)"
    return f"book {str((task.get('book') or {}).get('source_key') or '')}"


def build_text_sentences(items: Any) -> List[Dict[str, Any]]:
    """Submitted ``[{text, language?}]`` -> ordered sentence records (same shape
    as the book sentence cache)."""
    sentences: List[Dict[str, Any]] = []
    if not isinstance(items, list):
        return sentences
    for item in items[:ORCH_TEXT_ITEM_CAP]:
        if not isinstance(item, dict):
            continue
        # The sentence pattern steps address "en" / "zh" only.
        language = "zh" if str(item.get("language") or "").strip().lower().startswith("zh") else "en"
        for text in split_sentences(str(item.get("text") or "")[:ORCH_TEXT_CHARS_CAP]):
            sentences.append({
                "seq": len(sentences) + 1,
                "chapter_index": None,
                "language": language,
                "text": text,
                "languages": {language: text},
            })
    return sentences


def cached_task_sentences(task: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
    """Non-blocking sentence read (plan preview). None = not available yet."""
    if is_text_task(task):
        return list(task.get("sentences") or []) or None
    source_key = str((task.get("book") or {}).get("source_key") or "")
    sync = orch_books.sync_states().get(source_key) or {}
    if sync.get("status") == "running":
        return None
    cached = orch_store.load_book_sentences(source_key)
    sentences = cached.get("sentences") if isinstance(cached, dict) else None
    if not sentences:
        orch_books.sync_book_sentences(source_key)
        return None
    return sentences


def ensure_task_sentences(
    task: Dict[str, Any],
    cancel_requested: Optional[Callable[[], bool]] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """Blocking sentence resolution for generation (worker thread)."""
    if is_text_task(task):
        sentences = list(task.get("sentences") or [])
        if not sentences:
            return {"success": False, "error": "ORCH_TEXT_ITEMS_REQUIRED"}
        return {"success": True, "sentences": sentences}
    return orch_books.ensure_book_sentences(
        str((task.get("book") or {}).get("source_key") or ""),
        cancel_requested=cancel_requested,
        progress_callback=progress_callback,
    )


__all__ = [
    "ORCH_SOURCE_VOCAB_BOOK",
    "ORCH_SOURCE_PROMPT_REWRITE",
    "ORCH_SOURCES",
    "ORCH_TEXT_SOURCES",
    "ORCH_TEXT_TASK_RETENTION",
    "task_source",
    "is_text_task",
    "task_input",
    "task_label",
    "build_text_sentences",
    "cached_task_sentences",
    "ensure_task_sentences",
]
