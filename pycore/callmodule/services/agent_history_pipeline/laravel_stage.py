# -*- coding: utf-8 -*-
from typing import Any, Dict

from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services.sync.laravel_endpoint_manager import get_laravel_endpoint_manager
from pycore.callmodule.services.agent_history_pipeline.config import get_config


def upload_to_laravel(
    article: Dict[str, Any],
    audio: Dict[str, Any],
    raw_text: str,
) -> Dict[str, Any]:
    """Upload the generated article and audio to Laravel."""
    cfg = get_config()
    base = get_laravel_endpoint_manager().resolve()
    if not base:
        raise RuntimeError("No active Laravel endpoint available")
        
    client = get_laravel_client()
    
    # Mirror agent_history_article_service._upload_laravel field names so the
    # Laravel validator for worker/submit accepts the payload (article_text
    # min:10, title, lowercase language).
    payload = {
        "title": article.get("title_en") or article.get("title_cn") or "Agent history article",
        "title_cn": article.get("title_cn"),
        "reference_cn": article.get("reference_cn"),
        "article_text": article.get("article_en"),
        "reference_lang": cfg.get("reference_lang") or "CN",
        "target_lang": cfg.get("target_lang") or "EN",
        "language": "en",
        "source": "agent_history",
        "raw_preview": raw_text[:2000],
        "raw_word_count": len([w for w in raw_text.split() if w.strip()]),
        "audio_base64": audio.get("audio_base64"),
        "tts_engine": audio.get("engine"),
        "tts_accent": audio.get("accent"),
        "openrouter_model": article.get("model"),
    }
    
    resp = client.post(
        "/api/app_qy_v1/ai_tools/article/worker/submit",
        json_data=payload,
        timeout=30,
    )
    
    if not resp.get("success"):
        err = str(resp.get("error") or "laravel upload failed")
        raise RuntimeError(f"Laravel upload failed: {err}")
        
    data = resp.get("data") or {}
    return {
        "article_id": data.get("article_id"),
        "source_key": data.get("source_key"),
        "audio_url": data.get("audio_url"),
    }
