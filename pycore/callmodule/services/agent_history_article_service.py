# -*- coding: utf-8 -*-
"""Agent History -> raw batches -> OpenRouter article -> local TTS -> Laravel."""

from __future__ import annotations

import base64
import json
import re
import tempfile
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyctl.agent_history import get_agent_history_service
from pycore.pyctl.agent_history.agent_history_fragments import (
    build_raw_batches,
    collect_fragments,
    count_words,
    sanitize_fragment_text,
)
from pycore.pyctl.ai import generate_text
from pycore.pyctl.ai.ai_rate_limits import rate_status
from pycore.pyutils.tts import synthesize
from pycore.callmodule.services.sync.laravel_endpoint_manager import get_laravel_endpoint_manager

requests = get_third_package_requests()

_SECTION = "agent_history_article"
_DEFAULT_MODEL = "openrouter/free"
_JSON_OBJ_RE = re.compile(r"\{.*\}", re.DOTALL)
_LOG_RING_MAX = 120
# Target-language code -> TTS orchestrator language code (edge-tts voices).
_TTS_LANG_MAP = {
    "EN": "en", "CN": "zh", "JA": "ja", "KO": "ko", "FR": "fr", "DE": "de",
    "ES": "es", "RU": "ru", "AR": "ar", "PT": "pt", "IT": "it", "TH": "th",
    "VI": "vi", "HI": "hi", "NL": "nl", "PL": "pl", "TR": "tr", "ID": "id",
}

_service: Optional["AgentHistoryArticleService"] = None
_lock = threading.Lock()
_run_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_config() -> Dict[str, Any]:
    return {
        "enabled": False,
        "extract_as_article": False,
        "reference_lang": "CN",
        "target_lang": "EN",
        "min_raw_words": 200,
        "openrouter_model": _DEFAULT_MODEL,
        "phase": "idle",
        "live_listen": False,
        "cursor": {
            "fragment_index": 0,
            "after_ts": 0,
            "after_fragment_id": "",
            "raw_index": 0,
        },
        "last_error": None,
        "last_run_at": None,
        "published": [],
    }


class AgentHistoryArticleService:
    """Orchestrates history backfill then live fragment listening."""

    def __init__(self) -> None:
        # In-memory event ring (newest first) - mirrors tts_sentence_worker_service.
        self._events: Deque[Dict[str, Any]] = deque(maxlen=_LOG_RING_MAX)

    def _log(self, level: str, message: str, **extra: Any) -> None:
        """Append a UI-visible pipeline event (newest first)."""
        entry: Dict[str, Any] = {"at": int(time.time()), "level": level, "message": message[:280]}
        for key, value in extra.items():
            if value is not None:
                entry[key] = value
        self._events.appendleft(entry)

    @staticmethod
    def _tts_lang_code(target_lang: str) -> str:
        """Map a UI target-lang code (EN/CN/…) to a TTS orchestrator language code."""
        return _TTS_LANG_MAP.get(str(target_lang or "").upper(), "en")

    def get_config(self) -> Dict[str, Any]:
        store = get_user_data_store()
        cfg = store.get_section(_SECTION) or {}
        out = _default_config()
        out.update({k: v for k, v in cfg.items() if k in out or k == "cursor"})
        if not isinstance(out.get("cursor"), dict):
            out["cursor"] = _default_config()["cursor"]
        if not isinstance(out.get("published"), list):
            out["published"] = []
        return out

    def save_config(self, patch: Dict[str, Any]) -> Dict[str, Any]:
        cfg = self.get_config()
        for key in (
            "enabled", "extract_as_article", "reference_lang", "target_lang",
            "min_raw_words", "openrouter_model", "live_listen", "phase",
        ):
            if key in patch:
                cfg[key] = patch[key]
        if patch.get("enabled") is True:
            cfg["extract_as_article"] = True
        if cfg.get("extract_as_article") and cfg.get("phase") == "idle":
            cfg["phase"] = "backfill"
            cfg["live_listen"] = True
        get_user_data_store().set_section(_SECTION, cfg)
        return cfg

    def get_status(self) -> Dict[str, Any]:
        cfg = self.get_config()
        frags = collect_fragments(
            after_ts=int(cfg["cursor"].get("after_ts") or 0),
            after_fragment_id=str(cfg["cursor"].get("after_fragment_id") or ""),
        )
        return {
            "config": cfg,
            "pending_fragments": len(frags),
            "published_count": len(cfg.get("published") or []),
        }

    def list_articles(self, limit: int = 50) -> List[Dict[str, Any]]:
        cfg = self.get_config()
        rows = list(cfg.get("published") or [])
        rows.sort(key=lambda r: str(r.get("published_at") or ""), reverse=True)
        return rows[: max(1, min(int(limit or 50), 200))]

    def get_logs(self) -> Dict[str, Any]:
        """UI log panel snapshot: recent events + progress + openrouter rate usage."""
        cfg = self.get_config()
        cursor = cfg.get("cursor") or {}
        published = list(cfg.get("published") or [])
        pending = len(collect_fragments(
            after_ts=int(cursor.get("after_ts") or 0),
            after_fragment_id=str(cursor.get("after_fragment_id") or ""),
        )) if cfg.get("phase") in ("live", "done") else len(collect_fragments())
        ai_usage: Dict[str, Any] = {}
        try:
            ai_usage = rate_status("openrouter") or {}
        except Exception as e:  # noqa: BLE001
            ai_usage = {"provider": "openrouter", "enforced": False, "error": str(e)}
        return {
            "events": list(self._events)[:60],
            "progress": {
                "phase": str(cfg.get("phase") or "idle"),
                "live_listen": bool(cfg.get("live_listen")),
                "pending_fragments": pending,
                "published_count": len(published),
                "cursor": {
                    "fragment_index": int(cursor.get("fragment_index") or 0),
                    "raw_index": int(cursor.get("raw_index") or 0),
                    "after_ts": int(cursor.get("after_ts") or 0),
                    "after_fragment_id": str(cursor.get("after_fragment_id") or ""),
                },
                "last_run_at": cfg.get("last_run_at"),
                "last_error": cfg.get("last_error"),
                "reference_lang": cfg.get("reference_lang"),
                "target_lang": cfg.get("target_lang"),
                "min_raw_words": cfg.get("min_raw_words"),
            },
            "ai_usage": ai_usage,
        }

    def start_backfill(self) -> Dict[str, Any]:
        """Queue historical backfill; heartbeat tick processes one batch per pass."""
        if not _run_lock.acquire(blocking=False):
            return {"busy": True, **self.get_status()}
        try:
            cfg = self.save_config({
                "enabled": True,
                "extract_as_article": True,
                "phase": "backfill",
                "live_listen": True,
            })
            get_agent_history_service().extract(force=True)
            pending = len(collect_fragments())
            self._log("info", f"pipeline started: backfill ({pending} fragments pending)")
            return {
                "started": True,
                "phase": cfg.get("phase"),
                "pending_fragments": pending,
            }
        finally:
            _run_lock.release()

    def tick_pipeline(self) -> Optional[Dict[str, Any]]:
        """Process at most one raw batch per heartbeat (backfill then live)."""
        cfg = self.get_config()
        if not cfg.get("enabled") or not cfg.get("extract_as_article"):
            return None
        phase = str(cfg.get("phase") or "idle")
        if phase not in ("backfill", "live", "done"):
            return None
        if not _run_lock.acquire(blocking=False):
            return None
        try:
            cfg = self.get_config()
            phase = str(cfg.get("phase") or "idle")
            if phase == "backfill":
                return self._tick_backfill_batch(cfg)
            if phase in ("live", "done"):
                return self._tick_live_batch(cfg)
            return None
        finally:
            _run_lock.release()

    def tick_live(self) -> Optional[Dict[str, Any]]:
        return self.tick_pipeline()

    def _tick_backfill_batch(self, cfg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        frags = collect_fragments()
        min_words = int(cfg.get("min_raw_words") or 200)
        start_idx = int((cfg.get("cursor") or {}).get("fragment_index") or 0)
        batches, next_idx = build_raw_batches(frags, min_words=min_words, start_index=start_idx)
        raw_start = int((cfg.get("cursor") or {}).get("raw_index") or 0)
        for i, batch in enumerate(batches):
            if i < raw_start:
                continue
            self._log(
                "info",
                f"backfill batch #{i + 1}: raw={batch.get('word_count')} words, "
                f"{batch.get('fragment_count')} fragments",
            )
            try:
                published = self._publish_batch(cfg, batch, live=False)
                cfg = self.get_config()
                cfg["cursor"]["raw_index"] = i + 1
                cfg["cursor"]["fragment_index"] = next_idx
                cfg["last_run_at"] = _now_iso()
                if i + 1 >= len(batches):
                    cfg["phase"] = "live" if cfg.get("live_listen", True) else "done"
                    self._log("success", "backfill complete -> live listen")
                get_user_data_store().set_section(_SECTION, cfg)
                return published
            except Exception as e:  # noqa: BLE001
                err = str(e)
                cfg = self.get_config()
                cfg["last_error"] = err
                get_user_data_store().set_section(_SECTION, cfg)
                self._log("error", f"backfill batch failed: {err}")
                ColorPrint.red(f"[AgentHistoryArticle] backfill batch failed: {e}")
                return None
        cfg = self.get_config()
        cfg["phase"] = "live" if cfg.get("live_listen", True) else "done"
        cfg["last_run_at"] = _now_iso()
        self._log("success", "backfill complete -> live listen")
        get_user_data_store().set_section(_SECTION, cfg)
        return None

    def _tick_live_batch(self, cfg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        frags = collect_fragments(
            after_ts=int(cfg["cursor"].get("after_ts") or 0),
            after_fragment_id=str(cfg["cursor"].get("after_fragment_id") or ""),
        )
        min_words = int(cfg.get("min_raw_words") or 200)
        batches, _ = build_raw_batches(frags, min_words=min_words, start_index=0)
        if not batches:
            return None
        self._log(
            "info",
            f"live batch: {len(frags)} new fragments, raw={batches[0].get('word_count')} words",
        )
        try:
            published = self._publish_batch(cfg, batches[0], live=True)
            cfg = self.get_config()
            cfg["phase"] = "live"
            cfg["last_run_at"] = _now_iso()
            get_user_data_store().set_section(_SECTION, cfg)
            return published
        except Exception as e:  # noqa: BLE001
            cfg = self.get_config()
            cfg["last_error"] = str(e)
            get_user_data_store().set_section(_SECTION, cfg)
            self._log("error", f"live batch failed: {e}")
            ColorPrint.yellow(f"[AgentHistoryArticle] live batch failed: {e}")
            return None

    def _publish_batch(self, cfg: Dict[str, Any], batch: Dict[str, Any], *, live: bool) -> Dict[str, Any]:
        raw_text = sanitize_fragment_text(str(batch.get("raw_text") or ""))
        min_words = int(cfg.get("min_raw_words") or 200)
        raw_words = count_words(raw_text)
        if raw_words < min_words:
            raise ValueError("raw block below min word count")
        self._log("info", f"raw built: {raw_words} words (min {min_words})", live=live)
        article = self._generate_article(cfg, raw_text)
        audio = self._synthesize_article(cfg, str(article.get("article_en") or ""))
        laravel = self._upload_laravel(cfg, article, audio, raw_text)
        row = {
            "id": str(uuid.uuid4()),
            "title_en": article.get("title_en"),
            "title_cn": article.get("title_cn"),
            "reference_cn": article.get("reference_cn"),
            "article_en": article.get("article_en"),
            "word_count": article.get("word_count"),
            "raw_word_count": batch.get("word_count"),
            "live": live,
            "article_id": laravel.get("article_id"),
            "source_key": laravel.get("source_key"),
            "audio_url": laravel.get("audio_url"),
            "published_at": _now_iso(),
        }
        cfg = self.get_config()
        published = list(cfg.get("published") or [])
        published.insert(0, row)
        cfg["published"] = published[:500]
        if batch.get("last_fragment_id"):
            cfg["cursor"]["after_fragment_id"] = batch["last_fragment_id"]
        if batch.get("last_ts"):
            cfg["cursor"]["after_ts"] = int(batch["last_ts"])
        cfg["last_error"] = None
        get_user_data_store().set_section(_SECTION, cfg)
        self._log(
            "success",
            f"article published: '{row.get('title_en')}' ({row.get('word_count')} words)",
            article_id=row.get("article_id"),
            audio_url=row.get("audio_url"),
            live=live,
        )
        return row

    @staticmethod
    def _article_prompt(cfg: Dict[str, Any], raw_text: str) -> str:
        ref = str(cfg.get("reference_lang") or "CN").upper()
        tgt = str(cfg.get("target_lang") or "EN").upper()
        return (
            f"You are a language-learning editor. Reference language: {ref}. Target language: {tgt}.\n"
            "Using ONLY the RAW material below, write one coherent short article in fluent English.\n"
            "Rules:\n"
            "1. Preserve factual meaning from the raw fragments; do not invent unrelated topics.\n"
            "2. The English article must be at least 180 words.\n"
            "3. Include a concise Chinese reference summary in reference_cn.\n"
            "Return ONLY JSON (no markdown) shaped exactly:\n"
            '{"title_cn": string, "title_en": string, "reference_cn": string, '
            '"article_en": string, "word_count": number}\n\n'
            f"RAW:\n{raw_text}"
        )

    def _generate_article(self, cfg: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
        model = str(cfg.get("openrouter_model") or _DEFAULT_MODEL)
        self._log("info", f"AI generate start (openrouter: {model})")
        res = generate_text(
            prompt=self._article_prompt(cfg, raw_text),
            provider="openrouter",
            model=model,
            source="agent_history_article",
        ) or {}
        if not res.get("success"):
            err = str(res.get("error") or "article generation failed")
            self._log("error", f"AI generate failed: {err}")
            raise RuntimeError(err)
        text = str(res.get("text") or "")
        match = _JSON_OBJ_RE.search(text)
        blob = match.group(0) if match else text
        data = json.loads(blob)
        if not isinstance(data, dict):
            raise ValueError("article model returned non-object JSON")
        article_en = sanitize_fragment_text(str(data.get("article_en") or ""))
        if count_words(article_en) < 120:
            raise ValueError("generated article too short")
        data["article_en"] = article_en
        data["word_count"] = count_words(article_en)
        data["provider"] = res.get("provider")
        data["model"] = res.get("model") or model
        self._log(
            "success",
            f"AI ok: article={data['word_count']} words ({data.get('provider')}/{data.get('model')})",
        )
        return data

    def _synthesize_article(self, cfg: Dict[str, Any], text: str) -> Dict[str, Any]:
        clean = (text or "").strip()
        if not clean:
            raise ValueError("empty article for TTS")
        tts_lang = self._tts_lang_code(str(cfg.get("target_lang") or "EN"))
        accent = "us" if tts_lang == "en" else None
        self._log("info", f"TTS start (lang={tts_lang}, accent={accent or '-'})")
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            out = Path(tmp.name)
        try:
            result = synthesize(clean, tts_lang, out, accent=accent)
            if not result.get("success") or not out.is_file():
                err = str(result.get("error") or "TTS failed")
                self._log("error", f"TTS failed: {err}")
                raise RuntimeError(err)
            data = out.read_bytes()
            self._log(
                "success",
                f"TTS ok: engine={result.get('engine')}, {len(data)} bytes",
            )
            return {
                "audio_base64": base64.b64encode(data).decode("ascii"),
                "engine": result.get("engine"),
                "accent": result.get("accent"),
                "bytes": len(data),
            }
        finally:
            try:
                out.unlink(missing_ok=True)
            except OSError:
                pass

    def _upload_laravel(
        self,
        cfg: Dict[str, Any],
        article: Dict[str, Any],
        audio: Dict[str, Any],
        raw_text: str,
    ) -> Dict[str, Any]:
        if requests is None:
            raise RuntimeError("requests unavailable")
        base = get_laravel_endpoint_manager().resolve()
        if not base:
            raise RuntimeError("Laravel endpoint unreachable")
        url = f"{base.rstrip('/')}/api/app_qy_v1/ai_tools/article/worker/submit"
        self._log("info", f"upload -> laravel ({url})")
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
            "raw_word_count": count_words(raw_text),
            "audio_base64": audio.get("audio_base64"),
            "tts_engine": audio.get("engine"),
            "tts_accent": audio.get("accent"),
            "openrouter_model": article.get("model"),
        }
        resp = requests.post(url, json=payload, timeout=120)
        if resp.status_code >= 400:
            err = f"Laravel article submit HTTP {resp.status_code}: {resp.text[:400]}"
            self._log("error", f"laravel rejected: HTTP {resp.status_code}")
            raise RuntimeError(err)
        body = resp.json()
        if not body.get("success") and body.get("status") != "success":
            err = str(body.get("error") or body.get("message") or "Laravel rejected article")
            self._log("error", f"laravel rejected: {err}")
            raise RuntimeError(err)
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        self._log(
            "success",
            f"laravel ok: article_id={data.get('article_id')}, audio={data.get('audio_url') or 'none'}",
            article_id=data.get("article_id"),
            audio_url=data.get("audio_url"),
        )
        return {
            "article_id": data.get("article_id"),
            "source_key": data.get("source_key") or data.get("article_id"),
            "audio_url": data.get("audio_url"),
        }


def get_agent_history_article_service() -> AgentHistoryArticleService:
    global _service
    if _service is None:
        with _lock:
            if _service is None:
                _service = AgentHistoryArticleService()
    return _service
