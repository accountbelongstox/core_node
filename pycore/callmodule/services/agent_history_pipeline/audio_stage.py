# -*- coding: utf-8 -*-
import base64
import time
import uuid
from typing import Any, Dict

from pycore.pyfoundations.system_paths import get_app_cache_dir
from pycore.pyfoundations.tts_engine_policy import configured_tts_priority
from pycore.pyutils.tts.tts_orchestrator import synthesize
from pycore.pyutils.tts.tts_orchestrator import engine_available
from pycore.callmodule.services.agent_history_pipeline.config import get_config

_NO_LOCAL_TTS = "no local TTS engine available"
_TTS_LANG_MAP = {
    "EN": "en", "CN": "zh", "JA": "ja", "KO": "ko", "FR": "fr", "DE": "de",
    "ES": "es", "RU": "ru", "AR": "ar", "PT": "pt", "IT": "it", "TH": "th",
    "VI": "vi", "HI": "hi", "NL": "nl", "PL": "pl", "TR": "tr", "ID": "id",
}

def _tts_lang_code(target_lang: str) -> str:
    """Map a UI target-lang code (EN/CN/…) to a TTS orchestrator language code."""
    return _TTS_LANG_MAP.get(str(target_lang or "").upper(), "en")

def synthesize_audio(text: str) -> Dict[str, Any]:
    """Synthesize audio for the given text."""
    clean = (text or "").strip()
    if not clean:
        raise ValueError("empty article for TTS")
        
    cfg = get_config()
    tts_lang = _tts_lang_code(str(cfg.get("target_lang") or "EN"))
    accent = "us" if tts_lang == "en" else None
    
    local_order = configured_tts_priority("agent_history")
    if not any(engine_available(name) for name in local_order):
        raise RuntimeError(_NO_LOCAL_TTS)
        
    cache_dir = get_app_cache_dir() / "agent_history_tts"
    cache_dir.mkdir(parents=True, exist_ok=True)
    out = cache_dir / f"article_{uuid.uuid4().hex}.mp3"
    
    try:
        result = synthesize(
            clean,
            tts_lang,
            out,
            accent=accent,
            priority_profile="agent_history",
        )
        
        engine = str(result.get("engine") or "")
        if engine in ("edge", "streamelements", "gtts_web", "azure"):
            raise RuntimeError(f"TTS rejected cloud engine: {engine}")
            
        if not result.get("success") or not out.is_file():
            err = str(result.get("error") or _NO_LOCAL_TTS)
            raise RuntimeError(err if err else _NO_LOCAL_TTS)
            
        data = out.read_bytes()
        if len(data) < 1024:
            # A few-hundred-byte "mp3" is an engine error page / truncated
            # stream — uploading it would publish a daily-reading article with
            # broken audio. Fail the stage so the item retries instead.
            raise RuntimeError(f"TTS produced suspiciously small audio ({len(data)} bytes)")
        
        return {
            "audio_base64": base64.b64encode(data).decode("ascii"),
            "engine": engine,
            "accent": result.get("accent"),
            "bytes": len(data),
        }
    finally:
        for _attempt in range(5):
            if not out.exists():
                break
            try:
                out.unlink(missing_ok=True)
                break
            except OSError:
                time.sleep(0.05 * (_attempt + 1))
