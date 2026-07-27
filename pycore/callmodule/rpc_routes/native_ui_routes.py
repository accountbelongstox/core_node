# -*- coding: utf-8 -*-
"""Native RPC v2 handlers for the first migrated pycore-manager domains.

Handlers call application services/controllers directly.  No ASGI request,
HTTP verb, or FastAPI router is involved in this module.
"""

import asyncio
import base64
import os
import time
from typing import Any, Dict

from pycore import ColorPrint
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.pyctl.desktop import get_voice_subtitle_queue
from pycore.pyctl.desktop.task_manager import get_task_manager
from pycore.pyctl.desktop.processor import process_text_input
from pycore.pyctl.desktop.background_services import get_background_services
from pycore.pyctl.ai import probe_all, probe_one, catalog, balance_all, balance_one
from pycore.pyctl.ai.ai_rate_limits import rate_status
from pycore.pyctl.ai.ai_usage_log import usage_log
from pycore.pyctl.ai import ai_image_history, speech_history
from pycore.pyctl.ai.ai_keys import (
    PROVIDERS, PROVIDER_ORDER, key_count, key_status, image_key_status,
    is_configured, is_image_only, has_image_key, reset_text_key_cooldown,
    reset_image_key_cooldown,
)
from pycore.pyfoundations.secret_manager import set_secret_key_indexed, delete_secret_key, list_secret_key_names
from pycore.pyctl.ai.ai_gateway import invalidate_probe_cache
from pycore.pyutils.common import system_launcher
from pycore.pyutils.common.capabilities import capabilities_status, system_info, resolve_static_dir
from pycore.pyutils.translator.dictionary import get_dictionary_service
from pycore.pyutils.common import model_load_status
from pycore.callmodule.services.sync.laravel_endpoint_manager import get_laravel_endpoint_manager
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services import get_queue_monitor_service, get_translation_worker_service
from pycore.pyheartbeat import get_heartbeat_system
from pycore.pyutils.edge_tts.edge_tts_client import get_synth_timeout, set_synth_timeout
from pycore.pyutils.tts.tts_orchestrator import get_edge_cooldown_seconds, set_edge_cooldown_seconds
from pycore.pyutils.tts.tts_service_manager import (
    apply_server_settings, get_server_settings, is_server_engine, set_engine_enabled,
    start_server, stop_server,
)
from pycore.pyutils.llm.llm_orchestrator import llm_status as llm_orchestrator_status, chat as llm_chat
from pycore.pyutils.llm.llm_service_manager import (
    is_llm_engine, set_engine_enabled as set_llm_engine_enabled,
    start_server as start_llm_server, stop_server as stop_llm_server,
)
from pycore.callmodule.controllers.local_processing.books_controller import BooksController
from pycore.callmodule.controllers.local_processing.corebook_controller import CoreBookController
from pycore.callmodule.controllers.local_processing.user_data_controller import UserDataController
from pycore.callmodule.controllers.local_processing.video_extract_controller import VideoExtractController
from pycore.callmodule.controllers.local_processing.image_search_controller import ImageSearchController
from pycore.callmodule.services.version_service import get_version
from pycore.callmodule.services.queue_bump_hub import get_queue_bump_hub
from pycore.callmodule.services.task_capability_chains import get_chains, save_chain
from pycore.callmodule.services.sentence_audio_auto import apply_auto_start as apply_sentence_auto_start, get_status as get_sentence_status
from pycore.callmodule.services.word_tts_auto import apply_auto_start as apply_word_auto_start, get_status as get_word_status
from pycore.callmodule.services.tts_queue_poller_service import get_tts_queue_poller_service
from pycore.callmodule.services.tts_sentence_worker_service import get_tts_sentence_worker_service
from pycore.callmodule.services.sentence_queue_monitor_service import get_sentence_queue_monitor_service
from pycore.callmodule.services.heartbeat_worker_prefs import apply_callback_enabled, get_auxiliary_status
from pycore.callmodule.services.queue_center_contract import CALLBACK_QUEUE_ROLES
from pycore.pyctl.assist import load_assist_settings, save_assist_settings
from pycore.callmodule.services.assist_capability_sync import apply_assist_runtime
from pycore.callmodule.models.local_processing.video_extract_models import (
    VideoExtractRequest, VideoExtractOpenRequest, VideoExtractSegmentsRequest,
)
from pycore.callmodule.rpc_routes.route_names import (
    UI_BOOKS_ANALYZE,
    UI_BOOKS_ANALYZE_UPLOAD,
    UI_BOOKS_LIST,
    UI_BOOKS_SCAN,
    UI_BOOKS_STATE,
    UI_BOOKS_STATE_ADD,
    UI_BOOKS_STATE_REMOVE,
    UI_BOOKS_SUBMIT,
    UI_BOOKS_SUPPORTED_FORMATS,
    UI_COREBOOK_ADD_LANGUAGE,
    UI_COREBOOK_CONVERT,
    UI_COREBOOK_DELETE,
    UI_COREBOOK_FILL_AUDIO,
    UI_COREBOOK_GET,
    UI_COREBOOK_LIST,
    UI_COREBOOK_SUBMIT,
    UI_AI_CATALOG,
    UI_AI_PROBE,
    UI_AI_BALANCE,
    UI_AI_RATE_LIMITS,
    UI_AI_USAGE,
    UI_USER_DATA,
    UI_VIDEO_EXTRACT,
    UI_AI_KEYS,
    UI_AI_IMAGE,
    UI_SPEECH_HISTORY,
    UI_RUNTIME,
    UI_DICTIONARY,
    UI_TRANSLATION_QUEUE,
    UI_TTS,
    UI_LLM,
    UI_PING,
    UI_VOCABULARY,
    UI_IMAGE_SEARCH,
    UI_VERSION,
    UI_WORKERS,
    UI_ASSIST,
    UI_VOICE_QUEUE,
    UI_VOICE_QUEUE_CLEAR,
    UI_VOICE_QUEUE_INCREMENT,
    UI_VOICE_QUEUE_REMOVE,
    UI_VOICE_ADD_TEXT,
    UI_VOICE_QUEUE_SET_INDEX,
    UI_VOICE_QUEUE_TOGGLE,
    UI_VOICE_CLIPBOARD_STATUS,
    UI_VOICE_CLIPBOARD_START,
    UI_VOICE_CLIPBOARD_STOP,
    UI_VOICE_SCREENSHOT_STATUS,
    UI_VOICE_SCREENSHOT_START,
    UI_VOICE_SCREENSHOT_STOP,
    UI_VOICE_SCREENSHOT_LANGUAGE,
)


def _voice_queue(_params: Dict[str, Any]) -> Dict[str, Any]:
    queue = get_voice_subtitle_queue()
    return {"success": True, "queue": queue.get_queue(),
            "current_index": queue.get_current_index(), "enabled": queue.is_enabled()}


# The voice queue ops below go through call_serialized (up to 30s wait). They
# must run via asyncio.to_thread — calling them directly in the async handler
# would freeze the whole uvicorn event loop (every route times out together)
# whenever the queue's state owner is busy.
def _voice_clear() -> Dict[str, Any]:
    get_voice_subtitle_queue().clear_queue()
    return {"success": True, "message": "Queue cleared"}


def _voice_toggle() -> Dict[str, Any]:
    enabled = get_voice_subtitle_queue().toggle_enabled()
    return {"success": True, "enabled": enabled}


def _voice_set_index(index: int) -> Dict[str, Any]:
    if not get_voice_subtitle_queue().set_current_index(index):
        return {"success": False, "error": "Invalid index"}
    return {"success": True, "current_index": index}


def _voice_increment(index: Any) -> Dict[str, Any]:
    get_voice_subtitle_queue().increment_play_count(index)
    return {"success": True}


def _voice_remove(indices: list) -> Dict[str, Any]:
    removed = get_voice_subtitle_queue().remove_items(indices)
    return {"success": True, "removed_count": removed}


def register_native_ui_routes(server) -> None:
    """Register controller-backed UI operations on the RPC v2 server."""
    books = BooksController()
    corebook = CoreBookController()
    user_data = UserDataController()
    video_extract = VideoExtractController()
    image_search = ImageSearchController()

    async def voice_queue(params, request_id, context):
        return await asyncio.to_thread(_voice_queue, params or {})

    async def voice_clear(params, request_id, context):
        return await asyncio.to_thread(_voice_clear)

    async def voice_toggle(params, request_id, context):
        return await asyncio.to_thread(_voice_toggle)

    async def voice_set_index(params, request_id, context):
        index = int((params or {}).get("index", 0))
        return await asyncio.to_thread(_voice_set_index, index)

    async def voice_increment(params, request_id, context):
        return await asyncio.to_thread(_voice_increment, (params or {}).get("index"))

    async def voice_remove(params, request_id, context):
        indices = list((params or {}).get("indices") or [])
        return await asyncio.to_thread(_voice_remove, indices)

    async def voice_add_text(params, request_id, context):
        params = params or {}
        text = str(params.get("text") or "")
        if not text.strip():
            return {"success": False, "error": "text is required"}
        task_manager = get_task_manager()
        task_id = task_manager.create_task(task_type="text", input_data=params, estimated_time=5)

        async def executor(task):
            result = await process_text_input(text, params.get("langs") or ["en"], params.get("category") or "normal")
            if not result.get("success"):
                raise RuntimeError(result.get("error", "text processing failed"))
            return result

        task_manager.execute_task(task_id, executor)
        return {"success": True, "task_id": task_id, "message": "Text processing started"}

    async def voice_clipboard_status(params, request_id, context):
        services = get_background_services()
        return {"success": True, "enabled": services.is_clipboard_enabled()}

    async def voice_clipboard_start(params, request_id, context):
        get_background_services().start_clipboard_monitor()
        return {"success": True}

    async def voice_clipboard_stop(params, request_id, context):
        get_background_services().stop_clipboard_monitor()
        return {"success": True}

    async def voice_screenshot_status(params, request_id, context):
        services = get_background_services()
        return {"success": True, "enabled": services.is_screenshot_enabled(),
                "interval": services.get_screenshot_interval(), "lang": services.get_screenshot_lang()}

    async def voice_screenshot_start(params, request_id, context):
        params = params or {}
        get_background_services().start_screenshot_monitor(
            interval=int(params.get("interval", 10)), lang=params.get("lang", "en"))
        return {"success": True}

    async def voice_screenshot_stop(params, request_id, context):
        get_background_services().stop_screenshot_monitor()
        return {"success": True}

    async def voice_screenshot_language(params, request_id, context):
        lang = str((params or {}).get("lang") or "en")
        get_background_services().set_screenshot_lang(lang)
        return {"success": True, "lang": lang}

    async def books_supported(params, request_id, context):
        return books.supported_formats()

    async def books_scan(params, request_id, context):
        params = params or {}
        return await await_bus_task(books.scan, params.get("path"), params.get("formats"))

    async def books_analyze(params, request_id, context):
        params = params or {}
        return await await_bus_task(books.analyze, params.get("path"), params.get("formats"),
                                    params.get("language"), params.get("preview_chars", 800),
                                    params.get("max_files"), params.get("persist", False),
                                    params.get("languages"))

    async def books_state(params, request_id, context):
        return books.get_state()

    async def books_state_add(params, request_id, context):
        params = params or {}
        return books.add_source(params.get("path"), params.get("mode"), params.get("language"))

    async def books_state_remove(params, request_id, context):
        return books.remove_source((params or {}).get("path"))

    async def books_submit(params, request_id, context):
        params = params or {}
        return await await_bus_task(books.submit, params.get("paths"), params.get("language"),
                                    params.get("languages"), params.get("source_type"))

    async def books_list(params, request_id, context):
        params = params or {}
        return await await_bus_task(books.list_items, params.get("path"), params.get("kind"),
                                    params.get("start", 0), params.get("limit", 0),
                                    params.get("formats"), params.get("language"), params.get("refresh", False),
                                    params.get("max_files"), params.get("chapter_index"), params.get("languages"),
                                    params.get("grain"), params.get("sort_order"), params.get("query"),
                                    params.get("view_language"))

    async def books_analyze_upload(params, request_id, context):
        params = params or {}
        uploads = []
        for item in params.get("files") or []:
            try:
                content = base64.b64decode(item.get("data_b64") or "", validate=False)
            except (TypeError, ValueError):
                content = b""
            uploads.append((item.get("name") or "book", content))
        return await await_bus_task(books.analyze_upload, uploads, params.get("language"),
                                    max(0, min(20000, int(params.get("preview_chars", 800)))),
                                    bool(params.get("persist")), params.get("languages"),
                                    params.get("source_type", "book"))

    async def corebook_list(params, request_id, context):
        return corebook.list_books()

    async def corebook_convert(params, request_id, context):
        params = params or {}
        return await await_bus_task(corebook.convert, params.get("path"), params.get("language"),
                                    params.get("languages"), params.get("source_type"), params.get("text"))

    async def corebook_get(params, request_id, context):
        params = params or {}
        return await await_bus_task(corebook.get, params.get("source_key"), params.get("start", 0), params.get("limit", 0))

    async def corebook_delete(params, request_id, context):
        return await await_bus_task(corebook.delete, (params or {}).get("source_key"))

    async def corebook_add_language(params, request_id, context):
        params = params or {}
        return await await_bus_task(corebook.add_language, params.get("source_key"), params.get("target_language"),
                                    params.get("source_language"), params.get("chunk_size"), params.get("grain"))

    async def corebook_fill_audio(params, request_id, context):
        params = params or {}
        return await await_bus_task(corebook.fill_audio, params.get("source_key"), params.get("languages"),
                                    params.get("rate"), params.get("grain"))

    async def corebook_submit(params, request_id, context):
        params = params or {}
        return await await_bus_task(corebook.submit, params.get("source_key"), params.get("upload_audio"),
                                    params.get("request_assist"), params.get("assist_items"))

    async def ai_catalog(params, request_id, context):
        return await asyncio.to_thread(catalog)

    async def ai_probe(params, request_id, context):
        provider = (params or {}).get("provider")
        return await asyncio.to_thread(probe_one, provider) if provider else await asyncio.to_thread(probe_all)

    async def ai_balance(params, request_id, context):
        provider = (params or {}).get("provider")
        return await asyncio.to_thread(balance_one, provider) if provider else await asyncio.to_thread(balance_all)

    async def ai_rate_limits(params, request_id, context):
        return await asyncio.to_thread(rate_status, (params or {}).get("provider"))

    async def ai_usage(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(usage_log, int(params.get("limit", 100)), params.get("kind"))

    async def user_data_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "system_settings_get":
            return user_data.get_system_settings()
        if action == "system_settings_set":
            return user_data.set_system_settings(params.get("settings") or {})
        if action == "video_history_get":
            return user_data.get_video_extract()
        if action == "video_history_add":
            return user_data.add_video_extract(params.get("path"), params.get("mode"))
        if action == "video_history_remove":
            return user_data.remove_video_extract(params.get("path"))
        if action == "video_options_set":
            return user_data.set_options(params.get("options") or {})
        if action == "pick_path":
            return user_data.pick_path(params.get("mode"), params.get("initial"))
        raise ValueError(f"Unsupported user-data operation: {action}")

    async def video_extract_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "capabilities":
            return video_extract.capabilities()
        if action == "open":
            return video_extract.open(VideoExtractOpenRequest(**params))
        if action == "preview":
            return await asyncio.to_thread(video_extract.preview, VideoExtractRequest(**params))
        if action == "start":
            return await asyncio.to_thread(video_extract.start, VideoExtractRequest(**params))
        if action == "segments":
            return await asyncio.to_thread(video_extract.segments, VideoExtractSegmentsRequest(**params))
        if action == "task":
            task = get_task_manager().get_task(params.get("task_id"))
            return {"success": bool(task), "task": task.to_dict() if task else None,
                    **({} if task else {"error": "task not found"})}
        if action in ("cancel", "pause", "resume"):
            task = get_task_manager().get_task(params.get("task_id"))
            if not task:
                return {"success": False, "error": "task not found"}
            setattr(task, "_cancel" if action == "cancel" else "_pause", action == "cancel" or action == "pause")
            return {"success": True, "message": f"{action} requested"}
        raise ValueError(f"Unsupported video-extract operation: {action}")

    async def ai_keys_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "list":
            providers = []
            for name in PROVIDER_ORDER:
                meta = PROVIDERS.get(name, {})
                providers.append({"name": name, "key_base": meta.get("key_base", ""),
                                  "keyless": bool(meta.get("keyless")), "image_only": is_image_only(name),
                                  "configured": is_configured(name), "image_ready": has_image_key(name),
                                  "key_count": key_count(name), "keys": key_status(name),
                                  "image_keys": image_key_status(name) if meta.get("image") else []})
            return {"success": True, "providers": providers, "raw_key_files": sorted(list_secret_key_names())}
        if action == "set":
            provider = str(params.get("provider") or "")
            meta = PROVIDERS.get(provider, {})
            base = str(params.get("base_name") or meta.get("key_base") or "")
            if not base or not str(params.get("value") or "").strip():
                return {"success": False, "error": "provider/base_name and value are required"}
            target = f"{base}_IMAGE" if params.get("image") else base
            index = max(1, int(params.get("index", 1)))
            ok = set_secret_key_indexed(target, params.get("value"), index)
            if ok:
                invalidate_probe_cache()
            return {"success": bool(ok), "key_name": f"{target}_{index}"}
        if action == "reset_cooldown":
            provider = str(params.get("provider") or "")
            fn = reset_image_key_cooldown if params.get("image") else reset_text_key_cooldown
            return {"success": True, "reset": fn(provider, params.get("index"))}
        if action == "delete":
            removed = delete_secret_key(str(params.get("key_name") or ""))
            if removed:
                invalidate_probe_cache()
            return {"success": bool(removed)}
        raise ValueError(f"Unsupported AI-key operation: {action}")

    async def ai_image_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        # MIGRATION: 'generate' and 'test' actions removed — image generation is now
        # handled exclusively by mcp-chrome workers (see mcp-chrome/web-ai-translate-worker
        # and global_tasks with capability='media_image'). Pycore no longer owns image gen
        # as a direct RPC entry point.
        if action in ("generate", "test"):
            return {
                "success": False,
                "error": "Image generation has been migrated to mcp-chrome. "
                         "Submit a media_image global task via Laravel instead.",
                "migrated": True,
            }
        if action == "history":
            return {"success": True, "entries": ai_image_history.list_history(int(params.get("limit", 50)))}
        if action == "delete":
            return {"success": ai_image_history.delete_entry(str(params.get("id") or ""))}
        if action == "clear":
            return {"success": True, "removed": ai_image_history.clear_history()}
        if action == "reveal":
            path = ai_image_history.entry_path(str(params.get("id") or ""))
            if not path:
                return {"success": False, "error": "file not found"}
            return {"success": bool(system_launcher.open_dir(os.path.dirname(path))), "path": path}
        raise ValueError(f"Unsupported AI-image operation: {action}")

    async def speech_history_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "history":
            return {"success": True, "entries": speech_history.list_history(int(params.get("limit", 50)))}
        if action == "delete":
            return {"success": speech_history.delete_entry(str(params.get("id") or ""))}
        if action == "clear":
            return {"success": True, "removed": speech_history.clear_history()}
        if action == "reveal":
            path = speech_history.entry_path(str(params.get("id") or ""))
            if not path:
                return {"success": False, "error": "file not found"}
            return {"success": bool(system_launcher.open_dir(os.path.dirname(path))), "path": path}
        raise ValueError(f"Unsupported speech-history operation: {action}")

    async def runtime_route(params, request_id, context):
        action = (params or {}).get("action")
        if action == "resources":
            return await asyncio.to_thread(video_extract.system_resources)
        if action == "capabilities":
            return await asyncio.to_thread(capabilities_status)
        if action == "info":
            return system_info()
        if action == "open_dir":
            key = (params or {}).get("key")
            path = resolve_static_dir(key)
            return {"success": bool(path and system_launcher.open_dir(path)), "path": path}
        if action == "engine_load_status":
            return model_load_status.snapshot()
        raise ValueError(f"Unsupported runtime operation: {action}")

    async def dictionary_route(params, request_id, context):
        params = params or {}
        service = get_dictionary_service()
        if params.get("action") == "status":
            return {"success": True, **service.status()}
        word = str(params.get("word") or "").strip()
        if not word:
            return {"success": False, "error": "word is required", "found": False}
        entry = service.lookup(word)
        entry["success"] = True
        entry["target"] = params.get("target") or "zh"
        entry["target_translation"] = service.translate(word, params.get("target") or "zh")
        return entry

    async def translation_queue_route(params, request_id, context):
        params = params or {}
        monitor = get_queue_monitor_service()
        action = params.get("action")
        if action == "snapshot":
            return await asyncio.to_thread(monitor.get_snapshot, bool(params.get("refresh")))
        if action == "priority":
            return await asyncio.to_thread(monitor.set_priority, params.get("task_id"), params.get("priority"))
        if action == "stack":
            result = await asyncio.to_thread(monitor.stack, words=params.get("words") or [],
                                             language=params.get("language"), target_language=params.get("target_language"),
                                             priority=params.get("priority"))
            if result.get("success") is not False and get_heartbeat_system().is_callback_enabled("translation_worker"):
                await asyncio.to_thread(get_translation_worker_service().poll_once)
            return result
        if action == "task":
            return await asyncio.to_thread(monitor.get_task_detail, params.get("task_id"))
        raise ValueError(f"Unsupported translation-queue operation: {action}")

    async def tts_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "settings":
            srv = get_server_settings()
            return {"success": True, "synth_timeout_s": get_synth_timeout(),
                    "edge_cooldown_s": get_edge_cooldown_seconds(), **{
                        key: srv.get(key) for key in ("server_auto_manage", "server_single_active",
                                                       "server_idle_shutdown_s", "server_enabled")}}
        if action == "settings_update":
            patch = params.get("patch") or {}
            if patch.get("synth_timeout_s") is not None:
                set_synth_timeout(patch["synth_timeout_s"])
            if patch.get("edge_cooldown_s") is not None:
                set_edge_cooldown_seconds(patch["edge_cooldown_s"])
            server_patch = {key: patch[key] for key in ("server_auto_manage", "server_single_active",
                            "server_idle_shutdown_s", "server_enabled") if key in patch}
            srv = apply_server_settings(server_patch) if server_patch else get_server_settings()
            return {"success": True, "synth_timeout_s": get_synth_timeout(),
                    "edge_cooldown_s": get_edge_cooldown_seconds(), **{
                        key: srv.get(key) for key in ("server_auto_manage", "server_single_active",
                                                       "server_idle_shutdown_s", "server_enabled")}}
        if action == "server":
            engine = str(params.get("engine") or "").strip().lower()
            if not is_server_engine(engine):
                return {"success": False, "error": f"Unknown server engine: {engine}"}
            if params.get("enabled") is not None:
                return set_engine_enabled(engine, bool(params["enabled"]), start_now=bool(params.get("start")))
            if params.get("start") is True:
                return start_server(engine)
            if params.get("start") is False:
                return stop_server(engine)
            return get_server_settings()
        raise ValueError(f"Unsupported TTS operation: {action}")

    async def llm_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "status":
            return await asyncio.to_thread(llm_orchestrator_status)
        if action == "test":
            prompt = str(params.get("text") or "Reply with the single word: ok")
            return await asyncio.to_thread(llm_chat, [{"role": "user", "content": prompt}],
                                           params.get("engine"), params.get("model"))
        if action == "settings":
            srv = get_server_settings()
            return {"success": True, **{key: srv.get(key) for key in ("llm_auto_manage", "llm_single_active",
                                                                         "llm_idle_shutdown_s", "llm_enabled")}}
        if action == "settings_update":
            patch = params.get("patch") or {}
            allowed = {key: patch[key] for key in ("llm_auto_manage", "llm_single_active", "llm_idle_shutdown_s", "llm_enabled") if key in patch}
            srv = apply_server_settings(allowed) if allowed else get_server_settings()
            return {"success": True, **{key: srv.get(key) for key in ("llm_auto_manage", "llm_single_active",
                                                                         "llm_idle_shutdown_s", "llm_enabled")}}
        if action == "server":
            engine = str(params.get("engine") or "").strip().lower()
            if not is_llm_engine(engine):
                return {"success": False, "error": f"Unknown LLM engine: {engine}"}
            if params.get("enabled") is not None:
                return set_llm_engine_enabled(engine, bool(params["enabled"]), start_now=bool(params.get("start")))
            if params.get("start") is True:
                return start_llm_server(engine)
            if params.get("start") is False:
                return stop_llm_server(engine)
            return get_server_settings()
        raise ValueError(f"Unsupported LLM operation: {action}")

    async def ping_route(params, request_id, context):
        # Lightweight liveness probe. Distinguishes "WS open but RPC path
        # unresponsive" from "RPC healthy" on the front-end. Kept intentionally
        # trivial — no serialized table access, no external I/O.
        return {"success": True, "status": "ok", "service": "pycore", "ts": time.time()}

    async def vocabulary_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        paths = {
            "translation_languages": ("GET", "/api/app_qy_v1/ai_tools/translation/languages"),
            "translation_translate": ("POST", "/api/app_qy_v1/ai_tools/translation/translate"),
            "translation_queue_add": ("POST", "/api/app_qy_v1/ai_tools/translation/queue/batch/add"),
            "tts_generate": ("POST", "/api/app_qy_v1/ai_tools/tts/generate"),
            "tts_queue_query": ("POST", "/api/app_qy_v1/ai_tools/tts/queue/batch/query"),
            "tts_sentence_audio": ("GET", "/api/app_qy_v1/ai_tools/tts/sentence/audio"),
            "tts_queue_stats": ("GET", "/api/app_qy_v1/ai_tools/tts/queue/stats"),
            "tts_queue_items": ("GET", "/api/app_qy_v1/tts/queue/items"),
            "assist_overview": ("GET", "/api/app_qy_v1/assist/overview"),
            "assist_overview_items": ("GET", "/api/app_qy_v1/assist/overview/items"),
            "cover_retry": ("POST", "/api/app_qy_v1/assist/cover/retry"),
            "libraries": ("GET", "/api/app_qy_v1/vocabulary/libraries"),
            "library_words": ("GET", f"/api/app_qy_v1/vocabulary/libraries/{params.get('library_id')}/words"),
            "library_delete": ("DELETE", f"/api/app_qy_v1/learning/libraries/{params.get('library_id')}"),
            "statistics": ("GET", "/api/app_qy_v1/vocabulary/statistics"),
            "language_breakdown": ("GET", "/api/app_qy_v1/vocabulary/language-breakdown"),
            "dictionary_words": ("GET", "/api/app_qy_v1/dictionary/words"),
            "dictionary_words_add": ("POST", "/api/app_qy_v1/dictionary/words"),
            "dictionary_word_update": ("POST", f"/api/app_qy_v1/dictionary/words/{params.get('md5')}"),
            "dictionary_word_delete": ("DELETE", f"/api/app_qy_v1/dictionary/words/{params.get('md5')}"),
            "dictionary_words_batch": ("POST", "/api/app_qy_v1/dictionary/words/batch"),
            "dictionary_sentences": ("GET", "/api/app_qy_v1/dictionary/sentences"),
            "validity_report": ("POST", "/api/app_qy_v1/vocabulary/validity/report"),
            "storage_summary": ("GET", "/api/servermanager/v1/system/static-resources"),
        }
        method, path = paths.get(action, (None, None))
        if not method:
            raise ValueError(f"Unsupported vocabulary operation: {action}")
        base = get_laravel_endpoint_manager().resolve() or ""
        if not base:
            return {"success": False, "error": "laravel endpoint not configured"}
        body = params.get("body")
        query = params.get("query")
        try:
            response = await asyncio.to_thread(get_laravel_client().request, method, path,
                                               base_url=base, params=query, json=body, timeout=600)
            if response.status_code >= 400:
                return {"success": False, "error": f"HTTP {response.status_code}: {response.text[:200]}"}
            return response.json()
        except Exception as exc:
            return {"success": False, "error": f"proxy error: {exc}"}

    async def image_search_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "status":
            return await asyncio.to_thread(image_search.status)
        if action == "search":
            return await asyncio.to_thread(image_search.search, params.get("query"),
                                           num=params.get("num") or 12, country=params.get("country"),
                                           record=params.get("record", True))
        if action == "ai":
            return await asyncio.to_thread(image_search.search_ai, params.get("query"),
                                           size=params.get("size"), model=params.get("model"))
        if action == "compare":
            return await asyncio.to_thread(image_search.compare, params.get("query"),
                                           num=params.get("num") or 12, country=params.get("country"),
                                           size=params.get("size"), model=params.get("model"))
        if action == "history":
            return await asyncio.to_thread(image_search.history, int(params.get("limit", 50)))
        if action == "delete":
            return await asyncio.to_thread(image_search.delete_history, params.get("id"))
        if action == "clear":
            return await asyncio.to_thread(image_search.clear_history)
        raise ValueError(f"Unsupported image-search operation: {action}")

    async def version_route(params, request_id, context):
        return await asyncio.to_thread(get_version)

    async def workers_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "word_tts_status":
            return await asyncio.to_thread(get_word_status)
        if action == "word_tts_config":
            return await asyncio.to_thread(apply_word_auto_start, bool(params.get("auto_start")), params.get("concurrency"))
        if action == "word_tts_run_once":
            return await asyncio.to_thread(get_tts_queue_poller_service().poll_and_process)
        if action == "sentence_status":
            return await asyncio.to_thread(get_sentence_status)
        if action == "sentence_config":
            return await asyncio.to_thread(apply_sentence_auto_start, bool(params.get("auto_start")), params.get("concurrency"))
        if action == "sentence_run_once":
            return await asyncio.to_thread(get_tts_sentence_worker_service().poll_and_process)
        if action == "sentence_queue":
            worker = get_tts_sentence_worker_service().get_status()
            queue = get_sentence_queue_monitor_service().get_snapshot()
            return {"success": True, "worker": worker, "queue": queue, "bumps": get_queue_bump_hub().snapshot()}
        if action == "bumps":
            return get_queue_bump_hub().snapshot(limit=int(params.get("limit", 30)))
        if action == "chains":
            return {"success": True, "chains": get_chains()}
        if action == "chain_update":
            result = save_chain(params.get("task_type"), params.get("priority") or [])
            return {"success": bool(result.get("ok")), **result}
        if action == "heartbeat_status":
            stats = get_heartbeat_system().get_stats()
            callbacks = []
            for name, info in sorted((stats.get("heartbeat") or {}).get("callbacks", {}).items()):
                callbacks.append({"name": name, "enabled": bool(info.get("enabled")),
                                  "interval": int(info.get("interval") or 0), "run_count": int(info.get("run_count") or 0),
                                  "queue_role": CALLBACK_QUEUE_ROLES.get(name)})
            return {"success": True, "callbacks": callbacks, "auxiliary": get_auxiliary_status(),
                    "word_tts": get_word_status(), "sentence_audio": get_sentence_status()}
        if action == "heartbeat_config":
            result = apply_callback_enabled(str(params.get("callback_name") or ""), bool(params.get("enabled")))
            return {"success": bool(result.get("ok")), **result}
        raise ValueError(f"Unsupported worker operation: {action}")

    async def assist_route(params, request_id, context):
        params = params or {}
        action = params.get("action")
        if action == "status":
            settings = load_assist_settings()
            return {"enabled": settings.get("enabled", False), "capabilities": settings.get("capabilities", {}),
                    "endpoint": None, "laravel_reachable": False, "running": False,
                    "circuit": {"open": False, "cooldown_s": 0}, "counters": {},
                    "last_error": None, "last_cycle_at": None, "claimer": None, "laravel_status": None}
        if action == "config":
            patch = {}
            if "enabled" in params:
                patch["enabled"] = bool(params.get("enabled"))
            if params.get("capabilities") is not None:
                patch["capabilities"] = params.get("capabilities")
            config = save_assist_settings(patch)
            apply_assist_runtime(config)
            return {"ok": True, "config": config}
        if action == "cycle":
            settings = load_assist_settings()
            if not settings.get("enabled"):
                return {"success": False, "error": "queue processing is disabled — enable it first"}
            result = {"success": True, "triggered": 0, "errors": []}
            try:
                await asyncio.to_thread(get_translation_worker_service().poll_once)
                result["triggered"] += 1
            except Exception as exc:
                result["errors"].append(f"translation: {exc}")
            try:
                await asyncio.to_thread(get_tts_queue_poller_service().poll_and_process)
                result["triggered"] += 1
            except Exception as exc:
                result["errors"].append(f"word_audio: {exc}")
            return result
        raise ValueError(f"Unsupported assist operation: {action}")

    handlers = {
        UI_VOICE_QUEUE: voice_queue, UI_VOICE_QUEUE_CLEAR: voice_clear,
        UI_VOICE_QUEUE_TOGGLE: voice_toggle, UI_VOICE_QUEUE_SET_INDEX: voice_set_index,
        UI_VOICE_QUEUE_INCREMENT: voice_increment, UI_VOICE_QUEUE_REMOVE: voice_remove,
        UI_VOICE_ADD_TEXT: voice_add_text,
        UI_VOICE_CLIPBOARD_STATUS: voice_clipboard_status, UI_VOICE_CLIPBOARD_START: voice_clipboard_start,
        UI_VOICE_CLIPBOARD_STOP: voice_clipboard_stop, UI_VOICE_SCREENSHOT_STATUS: voice_screenshot_status,
        UI_VOICE_SCREENSHOT_START: voice_screenshot_start, UI_VOICE_SCREENSHOT_STOP: voice_screenshot_stop,
        UI_VOICE_SCREENSHOT_LANGUAGE: voice_screenshot_language,
        UI_BOOKS_SUPPORTED_FORMATS: books_supported, UI_BOOKS_SCAN: books_scan, UI_BOOKS_ANALYZE: books_analyze,
        UI_BOOKS_STATE: books_state, UI_BOOKS_STATE_ADD: books_state_add, UI_BOOKS_STATE_REMOVE: books_state_remove,
        UI_BOOKS_SUBMIT: books_submit, UI_BOOKS_LIST: books_list,
        UI_BOOKS_ANALYZE_UPLOAD: books_analyze_upload,
        UI_AI_CATALOG: ai_catalog, UI_AI_PROBE: ai_probe, UI_AI_BALANCE: ai_balance,
        UI_AI_RATE_LIMITS: ai_rate_limits, UI_AI_USAGE: ai_usage,
        UI_USER_DATA: user_data_route, UI_VIDEO_EXTRACT: video_extract_route,
        UI_AI_KEYS: ai_keys_route, UI_AI_IMAGE: ai_image_route,
        UI_SPEECH_HISTORY: speech_history_route,
        UI_RUNTIME: runtime_route, UI_DICTIONARY: dictionary_route,
        UI_TRANSLATION_QUEUE: translation_queue_route,
        UI_TTS: tts_route, UI_LLM: llm_route,
        UI_VOCABULARY: vocabulary_route,
        UI_IMAGE_SEARCH: image_search_route,
        UI_VERSION: version_route,
        UI_WORKERS: workers_route,
        UI_ASSIST: assist_route,
        UI_COREBOOK_LIST: corebook_list, UI_COREBOOK_CONVERT: corebook_convert, UI_COREBOOK_GET: corebook_get,
        UI_COREBOOK_DELETE: corebook_delete, UI_COREBOOK_ADD_LANGUAGE: corebook_add_language,
        UI_COREBOOK_FILL_AUDIO: corebook_fill_audio, UI_COREBOOK_SUBMIT: corebook_submit,
    }
    for name, handler in handlers.items():
        server.route(name=name, handler=handler, sync=False, description="Native pycore-manager operation")

    # ui.ping is a liveness probe: register it as sync so it bypasses the
    # ACK/durable pipeline. Front-end health check calls this with a 3s
    # timeout to distinguish "WS open but RPC unresponsive" from a real
    # WS-connected/RPC-healthy state.
    server.route(name=UI_PING, handler=ping_route, sync=True, description="Liveness probe")
    ColorPrint.green(f"[ConfigBuilder] Registered {len(handlers) + 1} native pycore-manager RPC routes")


__all__ = ["register_native_ui_routes"]
