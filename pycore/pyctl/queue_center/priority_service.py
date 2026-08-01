# -*- coding: utf-8 -*-
"""Queue priority commands (Laravel).

Audio-lane priority commands were retired with the domain-claim audio workers:
word/sentence audio priority now rides the queue-center bump API and the SSE
wake channel (pyctl/tts/laravel_audio_worker.py). Image/cover/poster lanes are
unchanged.
"""

from typing import Any, Dict, List

from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

_IMAGE_PATH = "/api/app_qy_v1/ai_tools/word_image/queue/add"
_COVER_PATH = "/api/app_qy_v1/assist/cover/retry"
_POSTER_PATH = "/api/app_qy_v1/assist/poster/priority"
_TIMEOUT = 30


def _post_laravel(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    base = laravel_endpoint_manager.resolve()
    if not base:
        return {"success": False, "error": "laravel endpoint not configured"}
    try:
        response = laravel_client.post(path, base_url=base, json=payload, timeout=_TIMEOUT)
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
