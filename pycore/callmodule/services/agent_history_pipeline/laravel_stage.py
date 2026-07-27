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
    
    payload = {
        "title_cn": article.get("title_cn"),
        "reference_cn": article.get("reference_cn"),
        "title_en": article.get("title_en"),
        "article_en": article.get("article_en"),
        "word_count": article.get("word_count"),
        "audio_base64": audio.get("audio_base64"),
        "raw_text": raw_text,
        "source": "agent_history",
        "article_type": "agent_history",
        "language": str(cfg.get("target_lang") or "EN").upper(),
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
