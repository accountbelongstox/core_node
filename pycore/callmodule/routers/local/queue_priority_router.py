# -*- coding: utf-8 -*-
"""Unified Wordnew -> pycore -> Laravel queue-priority surface."""

from typing import Any, Dict, List

import fastapi
from pydantic import BaseModel, Field

from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services.sync.laravel_endpoint_manager import get_laravel_endpoint_manager
from pycore.callmodule.services.tts_sentence_worker_service import get_tts_sentence_worker_service
from pycore.callmodule.services.tts_queue_poller_service import get_tts_queue_poller_service
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import get_heartbeat_system

router = fastapi.APIRouter(prefix="/api/local/queue-priority", tags=["Local Processing - Queue Priority"])

_IMAGE_PATH = "/api/app_qy_v1/ai_tools/word_image/queue/add"
_SENTENCE_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/bump-batch"
_SENTENCE_ITEM_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/bump"
_WORD_AUDIO_PATH = "/api/app_qy_v1/ai_tools/tts/queue/batch/add"
_COVER_PATH = "/api/app_qy_v1/assist/cover/retry"
_POSTER_PATH = "/api/app_qy_v1/assist/poster/priority"
_TIMEOUT = 30


class WordImageItem(BaseModel):
    word: str
    language: str


class WordImagePriorityRequest(BaseModel):
    items: List[WordImageItem]


class SentencePriorityItem(BaseModel):
    text: str
    language: str
    content_id: str = ""


class SentencePriorityRequest(BaseModel):
    items: List[SentencePriorityItem]


class SentenceItemPriorityRequest(BaseModel):
    content_id: str
    language: str


class WordAudioWordsPriorityRequest(BaseModel):
    words: List[str]
    language: str


class CoverPriorityRequest(BaseModel):
    ids: List[int] = Field(default_factory=list)
    all: bool = False


class PosterPriorityItem(BaseModel):
    media_type: str
    id: int


class PosterPriorityRequest(BaseModel):
    items: List[PosterPriorityItem]


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
    except Exception as exc:  # noqa: BLE001 - queue priority must fail gracefully
        ColorPrint.yellow(f"[QueuePriority] Laravel {path} failed: {exc}")
        return {"success": False, "error": str(exc)}


@router.post("/word-image")
def prioritize_word_images(request: WordImagePriorityRequest):
    items = [item.dict() for item in request.items if item.word.strip() and item.language.strip()]
    if not items:
        return {"success": False, "error": "items are required"}
    return _post_laravel(
        _IMAGE_PATH,
        {"words": items, "priority": "front", "interactive": True},
    )


@router.post("/sentence-audio")
def prioritize_sentence_audio(request: SentencePriorityRequest):
    items = [
        {"text": item.text, "language": item.language}
        for item in request.items
        if item.text.strip() and item.language.strip()
    ]
    if not items:
        return {"success": False, "error": "items are required"}
    result = _post_laravel(_SENTENCE_PATH, {"items": list(reversed(items))})
    if result.get("success") and get_heartbeat_system().is_callback_enabled("tts_sentence_worker"):
        get_tts_sentence_worker_service().notify_batch_bump()
    return result


@router.post("/sentence-audio/item")
def prioritize_sentence_audio_item(request: SentenceItemPriorityRequest):
    if not request.content_id.strip() or not request.language.strip():
        return {"success": False, "error": "content_id and language are required"}
    result = _post_laravel(_SENTENCE_ITEM_PATH, {
        "content_id": request.content_id,
        "language": request.language,
        "interactive": True,
        "create_task": True,
    })
    if ((result.get("success") or result.get("ok"))
            and get_heartbeat_system().is_callback_enabled("tts_sentence_worker")):
        get_tts_sentence_worker_service().notify_bump(
            request.content_id,
            request.language,
            int(result.get("priority") or 0),
        )
    return result


@router.post("/word-audio")
def prioritize_word_audio_words(request: WordAudioWordsPriorityRequest):
    words = [word.strip() for word in request.words if word.strip()]
    if not words or not request.language.strip():
        return {"success": False, "error": "words and language are required"}
    result = _post_laravel(_WORD_AUDIO_PATH, {
        "tasks": [
            {"content": word, "language": request.language, "type": "word"}
            for word in reversed(words)
        ],
        "interactive": True,
    })
    if ((result.get("success") or result.get("status") == "success")
            and get_heartbeat_system().is_callback_enabled("tts_queue_poller")):
        get_tts_queue_poller_service().poll_and_process()
    return result


@router.post("/cover")
def prioritize_covers(request: CoverPriorityRequest):
    if not request.all and not request.ids:
        return {"success": False, "error": "ids or all=true is required"}
    result = _post_laravel(_COVER_PATH, {"ids": request.ids, "all": request.all})
    return result


@router.post("/poster")
def prioritize_posters(request: PosterPriorityRequest):
    items = [item.dict() for item in request.items if item.id > 0]
    if not items:
        return {"success": False, "error": "items are required"}
    return _post_laravel(_POSTER_PATH, {"items": items})
