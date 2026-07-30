# -*- coding: utf-8 -*-
from typing import Any, Dict

from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyctl.agent_history.pipeline.config import get_config


def upload_to_laravel(
    article: Dict[str, Any],
    audio: Dict[str, Any],
    raw_text: str,
) -> Dict[str, Any]:
    """Upload the generated article and audio to Laravel."""
    cfg = get_config()
    base = laravel_endpoint_manager.resolve()
    if not base:
        raise RuntimeError("No active Laravel endpoint available")
        
    client = laravel_client
    
    # Match the Laravel worker/submit contract (article_text min:10, title,
    # lowercase language).
    # Laravel validator limits: reference_cn max 5000 chars, article_text max
    # 50000. Truncate instead of failing the whole upload with a silent 422.
    reference_cn = str(article.get("reference_cn") or "")[:4800]
    article_text = str(article.get("article_en") or "")[:49000]
    title_en = str(article.get("title_en") or "").strip()
    if not title_en:
        # Never fall back to the Chinese title — wordnew Daily Reading shows
        # the English version and must not receive a CN title as title_en.
        title_en = " ".join(article_text.split()[:8]).strip() or "Agent history article"

    payload = {
        "title": title_en,
        "title_en": title_en,
        "title_cn": article.get("title_cn"),
        "reference_cn": reference_cn,
        "article_text": article_text,
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
