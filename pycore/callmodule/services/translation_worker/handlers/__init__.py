# -*- coding: utf-8 -*-
"""
Per-lane task handlers for the translation worker.

Each handler is a module-level function taking the worker instance as its FIRST
argument (``worker``), invoked by ``TranslationWorkerService._process_task`` (the
dispatcher in worker.py). Handlers NEVER top-level import worker.py - that would
create a worker<->handler circular import (worker.py imports the handler modules
at its top level). The worker instance is passed AT CALL TIME, exposing
``_post_result`` / ``_record_task`` / ``partition_words`` / ``mark_words_done``
etc. via the instance.

Handlers keep delegating to the EXISTING engines (tts_orchestrator,
stt_orchestrator, word_audio_client, movie_poster_client, google_translator,
dictionary, prompt_translate, ai.generate_image, result_cache) - no engine logic
moves. Cross-handler helpers (e.g. prompt_translate needs audio.synthesize_word_
audio) import from a SIBLING handler module, never from worker.py.
"""
