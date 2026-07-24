# -*- coding: utf-8 -*-
"""
translation_worker package

Split out of the former monolithic ``translation_worker_service.py`` (2252 lines)
per the AGENTS.md Modular rule (split any source file over 800 lines). The
ORIGINAL module path ``pycore/callmodule/services/translation_worker_service.py``
is kept as a thin re-export SHIM so every existing importer
(queue_monitor_service, translation_ws_client_service, callmodule_main,
event_handlers, the routers, services/__init__) keeps working UNCHANGED.

Layout:
  base_laravel_worker.py  - BaseLaravelWorkerService: singleton __new__ (uses
                            cls so the concrete subclass singleton works),
                            candidate discovery, HTTP register/heartbeat/pull/
                            _post_result, conn-fail hint, circuit breaker.
  lane_gating.py          - _cfg + all _*_enabled gates + effective caps/types.
  done_words_cache.py     - DoneWordsCache (multi-pycore word-dedup set).
  task_heap.py            - per-backend priority heap + jittered fast-drain
                            burst (reuses tts_sentence_worker_service.
                            SentencePriorityQueue, extended to per-backend keying).
  handlers/               - per-lane task processing (translation/audio/stt/
                            media/ai_translate/prompt_translate). Each handler
                            takes the worker instance AT CALL TIME - handlers
                            NEVER top-level import worker.py (avoids the
                            worker<->handler circular import).
  worker.py               - slimmed TranslationWorkerService + accessor.
  bing_selenium.py        - BingSeleniumTranslator scaffold (TODO provider).

REUSE-FIRST (per plan):
  BaseLaravelWorkerService is the strongest win - tts_queue_poller_service.py
  and tts_sentence_worker_service.py duplicate this scaffold. They are NOT
  retrofitted in this split (deferred to a later reuse batch); a TODO lives in
  base_laravel_worker.py.
"""

from .worker import TranslationWorkerService, get_translation_worker_service
from .bing_selenium import BingSeleniumTranslator

__all__ = [
    "TranslationWorkerService",
    "get_translation_worker_service",
    "BingSeleniumTranslator",
]
