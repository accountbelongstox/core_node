# -*- coding: utf-8 -*-
from typing import Any, Dict

from pycore.pyutils.laravel.article_contract import compose_worker_text_fields
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader
from pycore.pyctl.agent_history.pipeline.config import get_config


_ARTICLE_TYPE = "daily"
_ARTICLE_SOURCE = "agent_history"
_ARTICLE_WORKER_API = "/api/app_qy_v1/ai_tools/article/worker"
_ARTICLE_WORKER_TIMEOUT = 30.0


def _parse_worker_response(resp: Any, action: str) -> Dict[str, Any]:
    """Shared worker-endpoint response contract: JSON body + success flag,
    otherwise a precise RuntimeError."""
    try:
        response_data = resp.json()
    except ValueError as exc:
        raise RuntimeError(
            f"Laravel {action} returned HTTP {resp.status_code} with invalid JSON"
        ) from exc

    if resp.status_code >= 400 or not isinstance(response_data, dict) or not response_data.get("success"):
        err = str(
            response_data.get("error") or response_data.get("message") or f"laravel {action} failed"
            if isinstance(response_data, dict)
            else f"laravel {action} failed"
        )
        raise RuntimeError(f"Laravel {action} failed: {err}")
    return response_data.get("data") or {}


def upload_to_laravel(
    article: Dict[str, Any],
    audio: Dict[str, Any],
    raw_text: str,
    idempotency_key: str,
) -> Dict[str, Any]:
    """Upload the generated article and audio to Laravel.

    The payload is composed through pyutils.laravel.article_contract - the
    single source of the worker/submit field bounds (title <= 255 etc.).
    pycore OWNS the composition: any document size is accepted internally,
    batch-generated/synthesized and combined, and delivered to Laravel as an
    already-contract-compliant payload; Laravel only validates and stores
    (out-of-contract fields would 422 and poison the retry lane)."""
    cfg = get_config()
    base = laravel_endpoint_manager.resolve()
    if not base:
        raise RuntimeError("No active Laravel endpoint available")

    fields = compose_worker_text_fields(article, raw_text)

    payload = {
        **fields,
        "reference_lang": cfg.get("reference_lang") or "CN",
        "target_lang": cfg.get("target_lang") or "EN",
        "language": "en",
        "article_type": _ARTICLE_TYPE,
        "source": _ARTICLE_SOURCE,
        "idempotency_key": str(idempotency_key or ""),
        "raw_word_count": len([w for w in raw_text.split() if w.strip()]),
        "audio_base64": audio.get("audio_base64"),
        "tts_engine": audio.get("engine"),
        "tts_model": audio.get("model"),
        "tts_chunked": bool(audio.get("chunked")),
        "tts_accent": audio.get("accent"),
        "openrouter_model": article.get("model"),
    }
    
    resp = laravel_client.post(
        f"{_ARTICLE_WORKER_API}/submit",
        base_url=base,
        json=payload,
        timeout=_ARTICLE_WORKER_TIMEOUT,
    )

    data = _parse_worker_response(resp, "upload")
    article_id = data.get("article_id")
    audio_url = data.get("audio_url")
    return {
        "article_id": article_id,
        "source_key": data.get("source_key"),
        "audio_url": audio_url,
        "audio_status": data.get("audio_status") or ("ready" if audio_url else "missing"),
        "article_type": data.get("article_type") or _ARTICLE_TYPE,
        "source": data.get("source") or _ARTICLE_SOURCE,
    }


def replace_audio_on_laravel(
    record: Dict[str, Any],
    audio_bytes: bytes,
) -> Dict[str, Any]:
    """Replace the published audio of an already-uploaded agent-history article.

    Laravel stores article audio at the deterministic <article_id>.mp3 path,
    so the replacement keeps the public audio_url stable; only the bytes and
    the provenance metadata move. Targets the Laravel record by its stored
    Laravel id or the stable Pycore source-record identity.
    """
    base = laravel_endpoint_manager.resolve()
    if not base:
        raise RuntimeError("No active Laravel endpoint available")

    payload = {
        "article_id": record.get("laravel_article_id"),
        "source_record_id": record.get("id"),
        "tts_engine": record.get("tts_engine") or "local",
        "tts_model": record.get("tts_model"),
        "tts_chunked": 1 if record.get("tts_chunked") else 0,
    }
    if not payload["article_id"] and not payload["source_record_id"]:
        raise RuntimeError("record has neither laravel_article_id nor source identity")
    if not audio_bytes:
        raise RuntimeError("empty replacement audio")

    data = laravel_progress_uploader.upload(
        f"{_ARTICLE_WORKER_API}/replace-audio",
        audio_bytes,
        base_url=base,
        params=payload,
    )
    return {
        "article_id": data.get("article_id"),
        "audio_url": data.get("audio_url"),
        "audio_status": "finalizing" if data.get("writeback_pending") else "ready",
        "result_sha256": data.get("result_sha256"),
        "writeback_pending": bool(data.get("writeback_pending")),
        "idempotent": bool(data.get("idempotent")),
    }
