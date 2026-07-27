# -*- coding: utf-8 -*-
"""RPC Routes for vocabulary."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes import route_names as rn
from pycore.callmodule.services import vocabulary_service as vocab


def register_local_vocabulary_routes(server):
    pairs = [
        (rn.UI_VOCABULARY_VOCAB_TRANSLATION_LANGUAGES, lambda p: vocab.vocab_translation_languages()),
        (rn.UI_VOCABULARY_VOCAB_TRANSLATION_TRANSLATE, lambda p: vocab.vocab_translation_translate(p or {})),
        (rn.UI_VOCABULARY_VOCAB_TRANSLATION_QUEUE_BATCH_ADD, lambda p: vocab.vocab_translation_queue_batch_add(p or {})),
        (rn.UI_VOCABULARY_VOCAB_TTS_GENERATE, lambda p: vocab.vocab_tts_generate(p or {})),
        (rn.UI_VOCABULARY_VOCAB_TTS_QUEUE_BATCH_QUERY, lambda p: vocab.vocab_tts_queue_batch_query(p or [])),
        (rn.UI_VOCABULARY_VOCAB_TTS_SENTENCE_AUDIO, lambda p: vocab.vocab_tts_sentence_audio(p)),
        (rn.UI_VOCABULARY_VOCAB_TTS_QUEUE_STATS, lambda p: vocab.vocab_tts_queue_stats()),
        (rn.UI_VOCABULARY_VOCAB_TTS_QUEUE_ITEMS, lambda p: vocab.vocab_tts_queue_items(p)),
        (rn.UI_VOCABULARY_VOCAB_ASSIST_OVERVIEW, lambda p: vocab.vocab_assist_overview()),
        (rn.UI_VOCABULARY_VOCAB_ASSIST_OVERVIEW_ITEMS, lambda p: vocab.vocab_assist_overview_items(p)),
        (rn.UI_VOCABULARY_VOCAB_COVER_RETRY, lambda p: vocab.vocab_cover_retry(p or {})),
        (rn.UI_VOCABULARY_VOCAB_LIBRARIES, lambda p: vocab.vocab_libraries(p)),
        (rn.UI_VOCABULARY_VOCAB_LIBRARY_WORDS, lambda p: vocab.vocab_library_words(int(p.get("library_id")), p)),
        (rn.UI_VOCABULARY_VOCAB_DELETE_LIBRARY, lambda p: vocab.vocab_delete_library(int(p.get("library_id")))),
        (rn.UI_VOCABULARY_VOCAB_STATISTICS, lambda p: vocab.vocab_statistics(p)),
        (rn.UI_VOCABULARY_VOCAB_LANGUAGE_BREAKDOWN, lambda p: vocab.vocab_language_breakdown(p)),
        (rn.UI_VOCABULARY_VOCAB_DICTIONARY_WORDS, lambda p: vocab.vocab_dictionary_words(p)),
        (rn.UI_VOCABULARY_VOCAB_CREATE_DICTIONARY_WORD, lambda p: vocab.vocab_create_dictionary_word(p or {})),
        (rn.UI_VOCABULARY_VOCAB_UPDATE_DICTIONARY_WORD, lambda p: vocab.vocab_update_dictionary_word(str(p.get("md5") or ""), p or {})),
        (rn.UI_VOCABULARY_VOCAB_DELETE_DICTIONARY_WORD, lambda p: vocab.vocab_delete_dictionary_word(str(p.get("md5") or ""), p)),
        (rn.UI_VOCABULARY_VOCAB_BATCH_DICTIONARY_WORDS, lambda p: vocab.vocab_batch_dictionary_words(p or {})),
        (rn.UI_VOCABULARY_VOCAB_DICTIONARY_SENTENCES, lambda p: vocab.vocab_dictionary_sentences(p)),
        (rn.UI_VOCABULARY_VOCAB_VALIDITY_REPORT, lambda p: vocab.vocab_validity_report(p or {})),
        (rn.UI_VOCABULARY_VOCAB_STORAGE_SUMMARY, lambda p: vocab.vocab_storage_summary()),
    ]

    for route_name, fn in pairs:
        async def handler(params, request_id, context, _fn=fn):
            return await asyncio.to_thread(_fn, params)

        server.route(name=route_name, handler=handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered vocabulary RPC routes")


__all__ = ["register_local_vocabulary_routes"]
