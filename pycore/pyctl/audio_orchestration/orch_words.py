# -*- coding: utf-8 -*-
"""
Word selection for audio orchestration (Word New Only / All words).

Read state comes from the Laravel qy-app sentence-word resolver:
    POST /api/app_qy_v1/learning/sentence-words   (auth: sanctum bearer token)
which returns one row per tokenized word with ``group_read_count`` /
``play_count`` / ``eligible_for_new_only`` against the user's default Word
Group (AppQyV1SentenceWordTableService::resolve).

The VIRTUAL READ set is pycore-local (stored on the task record): once a word
has been emitted for an earlier sentence of the task it is appended to the
task's ``virtual_read`` list and never emitted again in later sentences. Nothing
is written back to the backend Word Groups.
"""

import re
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.laravel.client import laravel_client

from pycore.pyctl.audio_orchestration import orch_store

_LARAVEL_SENTENCE_WORDS = "/api/app_qy_v1/learning/sentence-words"
_CLIENT_KEY = "audio_orchestration"
_REQUEST_TIMEOUT = 60
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'\-]*")


def tokenize(sentence: str) -> List[str]:
    """Unique alphabetic tokens of one sentence, lower-cased, order kept."""
    seen = set()
    words: List[str] = []
    for match in _WORD_RE.finditer(str(sentence or "")):
        word = match.group(0).strip("'-").lower()
        if len(word) < 2 or word in seen:
            continue
        seen.add(word)
        words.append(word)
    return words


def resolve_sentence_words(
    sentence: str,
    language: str,
    target_language: Optional[str],
    max_read_count: int,
    auth_record: Optional[Dict[str, Any]] = None,
    group_id: Optional[str] = None,
) -> Optional[List[Dict[str, Any]]]:
    """Query the backend word rows for one sentence with the stored qy login.
    Returns None when logged out or on any transport error (caller then falls
    back to local tokenization)."""
    record = auth_record if auth_record is not None else orch_store.load_auth() or {}
    token = str(record.get("token") or "")
    if not token:
        return None
    try:
        resp = laravel_client.post(
            _LARAVEL_SENTENCE_WORDS,
            json={
                "sentence": sentence,
                "language": language or "en",
                "target_language": target_language or None,
                "client_key": _CLIENT_KEY,
                "group_id": group_id or None,
                "max_read_count": max(0, int(max_read_count)),
            },
            headers={"Authorization": f"Bearer {token}"},
            base_url=record.get("base_url") or None,
            timeout=_REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            if resp.status_code == 401 and orch_store.auth_token() == token:
                orch_store.clear_auth()
            ColorPrint.yellow(
                f"[AudioOrch] sentence-words HTTP {resp.status_code}"
            )
            return None
        body = resp.json()
        data = body.get("data") if isinstance(body, dict) else None
        words = data.get("words") if isinstance(data, dict) else None
        return words if isinstance(words, list) else None
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] sentence-words failed: {exc}")
        return None


def select_words(
    task: Dict[str, Any],
    sentence: str,
    language: str,
    target_language: Optional[str],
    consume: bool,
    use_backend: bool = True,
    auth_record: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Pick the words to read for one sentence of a task.

    word_mode="all"      -> every tokenized word (no virtual-read dedup).
    word_mode="new_only" -> words whose backend group read count is within
                           ``new_only_max_read_count`` AND which are not in the
                           task's virtual_read set yet.
    With ``consume=True`` (new_only only) the selected words are appended to
    the task's virtual_read set (the caller persists the task record).
    ``use_backend=False`` skips the per-sentence Laravel call (plan previews
    must stay relay-safe; generation always uses the backend when logged in).

    Returns {words: [...], source: "backend"|"local"|"none"}.
    """
    word_mode = str(task.get("word_mode") or "all")
    max_read_count = int(task.get("new_only_max_read_count") or 0)
    virtual_read = set(str(w).lower() for w in (task.get("virtual_read") or []))
    # Virtual-read dedup applies to new_only only: "all" repeats words whenever
    # they occur in a sentence and never consumes the virtual set.
    apply_virtual = word_mode == "new_only"

    rows = (
        resolve_sentence_words(sentence, language, target_language, max_read_count, auth_record, task.get("word_group_id"))
        if use_backend and word_mode == "new_only"
        else None
    )
    if rows is not None:
        words: List[str] = []
        for row in rows:
            word = str(row.get("word") or "").strip().lower()
            if not word or (apply_virtual and word in virtual_read):
                continue
            if word_mode == "new_only":
                read_count = int(row.get("group_read_count") or row.get("play_count") or 0)
                if read_count > max_read_count:
                    continue
            words.append(word)
        if consume and apply_virtual and words:
            existing = list(task.get("virtual_read") or [])
            existing.extend(w for w in words if w not in virtual_read)
            task["virtual_read"] = existing
        return {"words": words, "source": "backend"}

    # Logged out or backend unreachable: local fallback. new_only degrades to
    # "not yet read inside this task" (the virtual set still applies).
    words = [w for w in tokenize(sentence) if not apply_virtual or w not in virtual_read]
    if consume and apply_virtual and words:
        existing = list(task.get("virtual_read") or [])
        existing.extend(w for w in words if w not in virtual_read)
        task["virtual_read"] = existing
    return {"words": words, "source": "local"}


__all__ = ["tokenize", "resolve_sentence_words", "select_words"]
