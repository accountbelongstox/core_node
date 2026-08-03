# -*- coding: utf-8 -*-
"""
DoneWordsCache - multi-pycore WORD-LEVEL coordination (Phase C).

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith. A short-TTL set of words ALREADY translated by SOME pycore, keyed by
(source_language, target_language, word). Fed by the HTTP event client from Laravel's
``word.translated`` broadcast. Before translating, the worker skips any word present
here (another pycore did it) so the same word is not re-translated across different
tasks/pycores.

Thread-safe; expired entries are pruned opportunistically. The worker delegates its
public ``mark_words_done`` / ``partition_words`` / ``done_words_count`` methods to an
instance of this class (those methods are part of the public API consumed by
get_status).
"""

import time
from typing import List, Optional, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method


class DoneWordsCache:
    """Short-TTL set of (src, dest, word) already translated by some pycore.

    Maps key -> monotonic expiry time. ``_done_word_ttl`` is the default TTL (the
    HTTP event client may override per call).
    """

    def __init__(self, ttl: int = 120) -> None:
        self._done_words: dict = {}
        self._done_word_ttl = ttl
        init_serialized_owner(self, "translation.done_words", "DoneWordsCacheState")

    @staticmethod
    def _word_key(word: str, source_language: str, target_language: str) -> Tuple[str, str, str]:
        """Normalized key for the done-words set: (src, dest, word) all lowercased."""
        return (
            (source_language or "auto").lower(),
            (target_language or "").lower(),
            (word or "").strip().lower(),
        )

    @serialized_method
    def mark_words_done(
        self,
        words: List[str],
        source_language: str,
        target_language: str,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        """
        Record words as ALREADY translated (by this or another pycore) so this
        worker skips them for a short TTL. Called by the HTTP event client when a
        `word.translated` Reverb event arrives, AND locally after this worker
        finishes a task (so its own just-done words also dedup future tasks).

        Thread-safe; expired entries are pruned opportunistically.
        """
        if not words:
            return
        ttl = self._done_word_ttl if ttl_seconds is None else max(1, int(ttl_seconds))
        now = time.monotonic()
        expiry = now + ttl
        for w in words:
            if w:
                self._done_words[self._word_key(w, source_language, target_language)] = expiry
        # Opportunistic prune (build-then-swap: build the pruned dict, assign once)
        # so the set never grows unbounded.
        if len(self._done_words) > 4096:
            self._done_words = {k: e for k, e in self._done_words.items() if e > now}

    @serialized_method
    def partition_words(
        self,
        words: List[str],
        source_language: str,
        target_language: str,
    ) -> Tuple[List[str], List[str]]:
        """
        Split ``words`` into (to_translate, already_done) using the recently-
        completed-words set. ``already_done`` are words another pycore finished
        within the TTL - this worker will skip translating them and report them as
        already-done so Laravel's write-back is idempotent.
        """
        if not words:
            return [], []
        now = time.monotonic()
        to_translate: List[str] = []
        already_done: List[str] = []
        for w in words:
            exp = self._done_words.get(self._word_key(w, source_language, target_language))
            if exp and exp > now:
                already_done.append(w)
            else:
                to_translate.append(w)
        return to_translate, already_done

    def done_words_count(self) -> int:
        """Read the live entry count without entering the cache owner queue."""
        now = time.monotonic()
        expiries = list(self._done_words.values())
        return sum(1 for e in expiries if e > now)
