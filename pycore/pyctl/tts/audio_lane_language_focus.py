# -*- coding: utf-8 -*-
"""Sentence languages a node declares on a work-lease claim (contract
``work_leases.sentence_language_focus``).

Laravel splits a claim evenly over the open languages a node declares, so the
declaration (not its order) routes the work: a GPU notebook node (Colab) takes
only the notebook_gpu languages (Chinese), a desktop GPU node drops those while
an online GPU notebook node serves them and keeps English first. A narrowed
claim that returned no rows widens the next one to every language the engine
speaks, but only when the narrowed languages hold no pending row.
"""

import time
from typing import Any, Dict, FrozenSet, List

from pycore.pyctl.laravel.worker.work_leases import work_lease_client
from pycore.pyfoundations.notebook_policy import notebook_platform
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.http_client import redacted_http_error
from pycore.pyutils.common.queue_center_contract import SENTENCE_LANGUAGE_FOCUS

SENTENCE_LANE = "sentence_audio"
COMPUTE_CLASS_GPU = "gpu"
_DEFAULT_FOCUS = tuple(SENTENCE_LANGUAGE_FOCUS["default"])
_NOTEBOOK_GPU_FOCUS = tuple(SENTENCE_LANGUAGE_FOCUS["notebook_gpu"])
_PEER_REFRESH_SECONDS = float(SENTENCE_LANGUAGE_FOCUS["peer_refresh_seconds"])
_PEER_GRACE_SECONDS = float(SENTENCE_LANGUAGE_FOCUS["peer_grace_seconds"])


class SentenceLanguageFocus:
    """Language declaration of one sentence lane worker (single pull cycle)."""

    def __init__(self) -> None:
        self._widened = False
        self._restricted = False
        self._narrowed: List[str] = []
        self._peer_seen: Dict[str, float] = {}
        self._peers_at = 0.0
        self._error_logged = ""
        self._declaration_logged = ""

    def declared(self, languages: List[str], base_url: str, log_prefix: str) -> List[str]:
        """The claim's languages: focus first, narrowed unless the last narrowed claim came back empty."""
        notebook = bool(notebook_platform())
        focus = _NOTEBOOK_GPU_FOCUS if notebook else _DEFAULT_FOCUS
        ordered = [language for language in focus if language in languages] + [
            language for language in languages if language not in focus
        ]
        narrowed = ordered
        if not self._widened:
            if notebook:
                narrowed = [language for language in ordered if language in focus] or ordered
            else:
                served = self._notebook_gpu_languages(base_url, log_prefix)
                narrowed = [language for language in ordered if language not in served] or ordered
        self._restricted = len(narrowed) < len(ordered)
        self._narrowed = narrowed
        self._log_declaration(narrowed, ordered, log_prefix)
        return narrowed

    def note_claim(self, leased: int, progress: Any) -> None:
        """A narrowed claim without rows widens the next one only when the lane progress shows no
        pending row in the narrowed languages (or carries no per-language figures); any other claim narrows again."""
        if leased > 0 or not self._restricted:
            self._widened = False
            return
        languages = progress.get("languages") if isinstance(progress, dict) else None
        if not isinstance(languages, dict):
            self._widened = True
            return
        pending = 0
        for language in self._narrowed:
            figures = languages.get(language)
            if isinstance(figures, dict):
                pending += int(figures.get("pending") or 0)
        self._widened = pending <= 0

    def _log_declaration(self, narrowed: List[str], ordered: List[str], log_prefix: str) -> None:
        """One line per change of the declaration (which languages, and why some are held back)."""
        held = [language for language in ordered if language not in narrowed]
        state = f"declared={','.join(narrowed)} held_back={','.join(held) or '-'} widened={self._widened}"
        if state != self._declaration_logged:
            self._declaration_logged = state
            ColorPrint.gray(f"{log_prefix} sentence languages {state}")

    def _served(self, now: float) -> FrozenSet[str]:
        return frozenset(language for language, seen in self._peer_seen.items() if now - seen <= _PEER_GRACE_SECONDS)

    def _notebook_gpu_languages(self, base_url: str, log_prefix: str) -> FrozenSet[str]:
        """Notebook-GPU focus languages an online GPU notebook node declared for the lane within the
        grace window; a failed lookup keeps the last known peers and opens up only after the window."""
        now = time.monotonic()
        if self._peers_at and now - self._peers_at < _PEER_REFRESH_SECONDS:
            return self._served(now)
        self._peers_at = now
        try:
            nodes = work_lease_client.nodes(base_url)
        except (OSError, RuntimeError, ValueError) as exc:
            error = redacted_http_error(exc)
            if error != self._error_logged:
                self._error_logged = error
                ColorPrint.gray(f"{log_prefix} work nodes unavailable ({error}); keeping the last known peer languages")
            return self._served(now)
        self._error_logged = ""
        declared = {
            str(language).strip().lower()
            for node in nodes
            if node.get("online") and node.get("platform") and node.get("compute_class") == COMPUTE_CLASS_GPU
            for language in (node.get("lanes") or {}).get(SENTENCE_LANE) or []
        }
        for language in declared & set(_NOTEBOOK_GPU_FOCUS):
            self._peer_seen[language] = now
        return self._served(now)


__all__ = ["SentenceLanguageFocus"]
