# -*- coding: utf-8 -*-
"""Queue priority commands (Laravel + local worker wakeups)."""

from typing import Any, Dict, List

from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services.sync.laravel_endpoint_manager import get_laravel_endpoint_manager
from pycore.callmodule.services.tts_sentence_worker_service import get_tts_sentence_worker_service
from pycore.callmodule.services.tts_queue_poller_service import get_tts_queue_poller_service
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat.heartbeat import get_heartbeat_system

_IMAGE_PATH = "/api/app_qy_v1/ai_tools/word_image/queue/add"
_SENTENCE_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/bump-batch"
_SENTENCE_ITEM_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/bump"
_WORD_AUDIO_PATH = "/api/app_qy_v1/ai_tools/tts/queue/batch/add"
_COVER_PATH = "/api/app_qy_v1/assist/cover/retry"
_POSTER_PATH = "/api/app_qy_v1/assist/poster/priority"
_TIMEOUT = 30


def _post_laravel(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    base = get_laravel_endpoint_manager().resolve()
    if not base:
        return {"success": False, "error": "laravel endpoint not configured"}
    try:
        response = get_laravel_client().post(path, base_url=base, json=payload, timeout=_TIMEOUT)
        body = response.json()
        if not isinstance(body, dict):
            body = {"success": False, "error": "invalid Laravel response"}
        if response.status_code >= 400:
            body["success"] = False
            body.setdefault("error", f"Laravel HTTP {response.status_code}")
        return body
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[QueuePriority] Laravel {path} failed: {exc}")
        return {"success": False, "error": str(exc)}


def prioritize_word_images(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    normalized = [
        item for item in items
        if isinstance(item, dict)
        and str(item.get("word") or "").strip()
        and str(item.get("language") or "").strip()
    ]
    if not normalized:
        return {"success": False, "error": "items are required"}
    return _post_laravel(
        _IMAGE_PATH,
        {"words": normalized, "priority": "front", "interactive": True},
    )


def prioritize_sentence_audio(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    normalized = [
        {"text": item["text"], "language": item["language"]}
        for item in items
        if isinstance(item, dict)
        and str(item.get("text") or "").strip()
        and str(item.get("language") or "").strip()
    ]
    if not normalized:
        return {"success": False, "error": "items are required"}
    result = _post_laravel(_SENTENCE_PATH, {"items": list(reversed(normalized))})
    if result.get("success") and get_heartbeat_system().is_callback_enabled("tts_sentence_worker"):
        get_tts_sentence_worker_service().notify_batch_bump()
    return result


def prioritize_sentence_audio_item(content_id: str, language: str) -> Dict[str, Any]:
    if not str(content_id or "").strip() or not str(language or "").strip():
        return {"success": False, "error": "content_id and language are required"}
    result = _post_laravel(_SENTENCE_ITEM_PATH, {
        "content_id": content_id,
        "language": language,
        "interactive": True,
        "create_task": True,
    })
    if ((result.get("success") or result.get("ok"))
            and get_heartbeat_system().is_callback_enabled("tts_sentence_worker")):
        get_tts_sentence_worker_service().notify_bump(
            content_id,
            language,
            int(result.get("priority") or 0),
        )
    return result


def prioritize_word_audio_words(words: List[str], language: str) -> Dict[str, Any]:
    cleaned = [str(word).strip() for word in words if str(word).strip()]
    if not cleaned or not str(language or "").strip():
        return {"success": False, "error": "words and language are required"}
    result = _post_laravel(_WORD_AUDIO_PATH, {
        "tasks": [
            {"content": word, "language": language, "type": "word"}
            for word in reversed(cleaned)
        ],
        "interactive": True,
    })
    if ((result.get("success") or result.get("status") == "success")
            and get_heartbeat_system().is_callback_enabled("tts_queue_poller")):
        get_tts_queue_poller_service().poll_and_process()
    return result


def prioritize_covers(ids: List[int], all_covers: bool = False) -> Dict[str, Any]:
    if not all_covers and not ids:
        return {"success": False, "error": "ids or all=true is required"}
    return _post_laravel(_COVER_PATH, {"ids": ids, "all": all_covers})


def prioritize_posters(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    normalized = [
        item for item in items
        if isinstance(item, dict) and int(item.get("id") or 0) > 0
    ]
    if not normalized:
        return {"success": False, "error": "items are required"}
    return _post_laravel(_POSTER_PATH, {"items": normalized})
