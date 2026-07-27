# -*- coding: utf-8 -*-
"""Wire V11.2C remaining RPC routes."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "pycore" / "callmodule" / "rpc_routes"


def write_vocab_routes() -> None:
    content = '''# -*- coding: utf-8 -*-
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
'''
    (ROOT / "local_vocabulary_routes.py").write_text(content, encoding="utf-8")


def write_code_sync_routes() -> None:
    content = '''# -*- coding: utf-8 -*-
"""RPC Routes for code_sync."""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes import route_names as rn
from pycore.callmodule.services import code_sync_service as cs
from pycore.callmodule.services.code_sync_service import (
    ChangesRequest,
    DistributeRequest,
    DownloadRequest,
    InitialSyncRequest,
    PeerAddRequest,
    PeerConfigRequest,
    PeerRemoveRequest,
    PeerUpdateRequest,
    RegisterRequest,
    RoleRequest,
    SkipUpdateRequest,
)


def register_code_sync_routes(server):
    async def _call(coro):
        return await coro

    routes = [
        (rn.UI_CODE_SYNC_PING, lambda p: cs.ping()),
        (rn.UI_CODE_SYNC_GET_STATUS, lambda p: cs.get_status()),
        (rn.UI_CODE_SYNC_PEER_STATUS, lambda p: cs.peer_status()),
        (rn.UI_CODE_SYNC_PEER_CONFIG, lambda p: cs.peer_config(PeerConfigRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_PEER_HEARTBEAT, lambda p: cs.peer_heartbeat(p or {})),
        (rn.UI_CODE_SYNC_GET_PEERS, lambda p: cs.get_peers()),
        (rn.UI_CODE_SYNC_GET_SYNC_SETTINGS, lambda p: cs.get_sync_settings()),
        (rn.UI_CODE_SYNC_SET_SYNC_SETTINGS, lambda p: cs.set_sync_settings(p or {})),
        (rn.UI_CODE_SYNC_RESET_SYNC_SETTINGS, lambda p: cs.reset_sync_settings()),
        (rn.UI_CODE_SYNC_GET_SYNC_LOGS, lambda p: cs.get_sync_logs(int((p or {}).get("limit") or 100))),
        (rn.UI_CODE_SYNC_GET_FILE_TREE, lambda p: cs.get_file_tree()),
        (rn.UI_CODE_SYNC_GET_PEER_FILE_TREE, lambda p: cs.get_peer_file_tree(str((p or {}).get("peer_id") or ""))),
        (rn.UI_CODE_SYNC_ADD_PEER, lambda p: cs.add_peer(PeerAddRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_REMOVE_PEER, lambda p: cs.remove_peer(PeerRemoveRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_UPDATE_PEER, lambda p: cs.update_peer(PeerUpdateRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_SET_ROLE, lambda p: cs.set_role(RoleRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_SET_DISTRIBUTE, lambda p: cs.set_distribute(DistributeRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_SET_SKIP_UPDATE, lambda p: cs.set_skip_update(SkipUpdateRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_DISCOVER, lambda p: cs.discover()),
        (rn.UI_CODE_SYNC_SET_SERVER_MODE, lambda p: cs.set_server_mode()),
        (rn.UI_CODE_SYNC_SET_CLIENT_MODE, lambda p: cs.set_client_mode()),
        (rn.UI_CODE_SYNC_STOP_SYNC, lambda p: cs.stop_sync()),
        (rn.UI_CODE_SYNC_DOWNLOAD_FILE, lambda p: cs.download_file(DownloadRequest(**(p or {})))),
        (rn.UI_CODE_SYNC_TOGGLE_BACKUP, lambda p: cs.toggle_backup(p or {})),
    ]

    for route_name, fn in routes:
        async def handler(params, request_id, context, _fn=fn):
            return await _fn(params)

        server.route(name=route_name, handler=handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered code_sync RPC routes")


__all__ = ["register_code_sync_routes"]
'''
    (ROOT / "code_sync_routes.py").write_text(content, encoding="utf-8")


def write_web_routes() -> None:
    content = '''# -*- coding: utf-8 -*-
"""RPC Routes for web compatibility."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_WEB_HOMEPAGE,
    UI_WEB_GET_API_INFO,
    UI_WEB_PING,
    UI_WEB_GET_DESKTOP_UI,
    UI_WEB_GET_SUBTITLE_UI,
    UI_WEB_GET_FAVICON,
)
from pycore.callmodule.services import web_service as web


def register_web_routes(server):
    pairs = [
        (UI_WEB_HOMEPAGE, web.homepage),
        (UI_WEB_GET_API_INFO, web.get_api_info),
        (UI_WEB_PING, web.ping),
        (UI_WEB_GET_DESKTOP_UI, web.get_desktop_ui),
        (UI_WEB_GET_SUBTITLE_UI, web.get_subtitle_ui),
        (UI_WEB_GET_FAVICON, web.get_favicon),
    ]
    for route_name, fn in pairs:
        async def handler(params, request_id, context, _fn=fn):
            return await asyncio.to_thread(_fn)

        server.route(name=route_name, handler=handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered web RPC routes")


__all__ = ["register_web_routes"]
'''
    (ROOT / "web_routes.py").write_text(content, encoding="utf-8")


if __name__ == "__main__":
    write_vocab_routes()
    write_code_sync_routes()
    write_web_routes()
    print("wired C batch")
