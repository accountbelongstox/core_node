# -*- coding: utf-8 -*-
"""HTTP routes for Vocabulary."""

import pycore.callmodule.rpc_routes.route_names as rn
import pycore.pyctl.vocabulary.service as vocab


def register_local_vocabulary_routes(server):
    def queue_batch_query(params, _request_id, _context):
        return vocab.vocab_tts_queue_batch_query(list((params or {}).get("items") or []))

    def library_words(params, _request_id, _context):
        request = params or {}
        query = dict(request)
        library_id = int(query.pop("library_id"))
        return vocab.vocab_library_words(library_id, query)

    def delete_library(params, _request_id, _context):
        return vocab.vocab_delete_library(int((params or {}).get("library_id")))

    def update_dictionary_word(params, _request_id, _context):
        request = dict(params or {})
        md5 = str(request.pop("md5", ""))
        return vocab.vocab_update_dictionary_word(
            md5,
            request,
        )

    def delete_dictionary_word(params, _request_id, _context):
        request = dict(params or {})
        md5 = str(request.pop("md5", ""))
        return vocab.vocab_delete_dictionary_word(
            md5,
            request,
        )

    def resource(params, _request_id, _context):
        return vocab.vocab_resource(str((params or {}).get("url") or ""))

    routes = (
        (rn.UI_VOCABULARY_VOCAB_TRANSLATION_LANGUAGES, vocab.vocab_translation_languages),
        (rn.UI_VOCABULARY_VOCAB_TRANSLATION_TRANSLATE, vocab.vocab_translation_translate),
        (rn.UI_VOCABULARY_VOCAB_TRANSLATION_QUEUE_BATCH_ADD, vocab.vocab_translation_queue_batch_add),
        (rn.UI_VOCABULARY_VOCAB_TTS_GENERATE, vocab.vocab_tts_generate),
        (rn.UI_VOCABULARY_VOCAB_TTS_QUEUE_BATCH_QUERY, queue_batch_query),
        (rn.UI_VOCABULARY_VOCAB_TTS_SENTENCE_AUDIO, vocab.vocab_tts_sentence_audio),
        (rn.UI_VOCABULARY_VOCAB_TTS_QUEUE_STATS, vocab.vocab_tts_queue_stats),
        (rn.UI_VOCABULARY_VOCAB_TTS_QUEUE_ITEMS, vocab.vocab_tts_queue_items),
        (rn.UI_VOCABULARY_VOCAB_ASSIST_OVERVIEW, vocab.vocab_assist_overview),
        (rn.UI_VOCABULARY_VOCAB_ASSIST_OVERVIEW_ITEMS, vocab.vocab_assist_overview_items),
        (rn.UI_VOCABULARY_VOCAB_COVER_RETRY, vocab.vocab_cover_retry),
        (rn.UI_VOCABULARY_VOCAB_LIBRARIES, vocab.vocab_libraries),
        (rn.UI_VOCABULARY_VOCAB_LIBRARY_WORDS, library_words),
        (rn.UI_VOCABULARY_VOCAB_DELETE_LIBRARY, delete_library),
        (rn.UI_VOCABULARY_VOCAB_STATISTICS, vocab.vocab_statistics),
        (rn.UI_VOCABULARY_VOCAB_LANGUAGE_BREAKDOWN, vocab.vocab_language_breakdown),
        (rn.UI_VOCABULARY_VOCAB_DICTIONARY_WORDS, vocab.vocab_dictionary_words),
        (rn.UI_VOCABULARY_VOCAB_CREATE_DICTIONARY_WORD, vocab.vocab_create_dictionary_word),
        (rn.UI_VOCABULARY_VOCAB_UPDATE_DICTIONARY_WORD, update_dictionary_word),
        (rn.UI_VOCABULARY_VOCAB_DELETE_DICTIONARY_WORD, delete_dictionary_word),
        (rn.UI_VOCABULARY_VOCAB_BATCH_DICTIONARY_WORDS, vocab.vocab_batch_dictionary_words),
        (rn.UI_VOCABULARY_VOCAB_DICTIONARY_SENTENCES, vocab.vocab_dictionary_sentences),
        (rn.UI_VOCABULARY_VOCAB_VALIDITY_REPORT, vocab.vocab_validity_report),
        (rn.UI_VOCABULARY_VOCAB_STORAGE_SUMMARY, vocab.vocab_storage_summary),
        (rn.UI_VOCABULARY_RESOURCE, resource),
    )
    server.register_routes(routes, group="vocabulary")

