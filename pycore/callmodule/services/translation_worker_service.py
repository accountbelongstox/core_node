# -*- coding: utf-8 -*-
"""
Translation Worker Service - thin re-export SHIM.

The implementation was split into the ``translation_worker`` package per the
AGENTS.md Modular rule (the former monolith was 2252 lines). This module remains
at the ORIGINAL import path so every existing importer keeps working UNCHANGED:

  - pycore/callmodule/services/__init__.py
        (TranslationWorkerService, get_translation_worker_service, BingSeleniumTranslator)
  - pycore/callmodule/services/queue_monitor_service.py
        (get_translation_worker_service)
  - pycore/callmodule/services/translation_ws_client_service.py
        (get_translation_worker_service)
  - pycore/callmodule/callmodule_main.py / event_handlers.py
        (get_translation_worker_service)
  - pycore/callmodule/routers/local/{queue_overview,task_center,assist}_router.py
        (get_translation_worker_service)

Public API preserved: TranslationWorkerService, get_translation_worker_service,
BingSeleniumTranslator (and the instance methods poll_once, get_status,
get_queue_status, mark_words_done, partition_words, done_words_count).
"""

from .translation_worker.worker import (
    TranslationWorkerService,
    get_translation_worker_service,
)
from .translation_worker.bing_selenium import BingSeleniumTranslator

__all__ = [
    "TranslationWorkerService",
    "get_translation_worker_service",
    "BingSeleniumTranslator",
]
