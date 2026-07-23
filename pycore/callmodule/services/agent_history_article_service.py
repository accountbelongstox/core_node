# -*- coding: utf-8 -*-
"""Agent History -> raw batches -> OpenRouter CN article -> local-LLM EN translation -> TTS -> cache + Laravel."""

from __future__ import annotations

import base64
import json
import re
import tempfile
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services import agent_history_article_records as records
from pycore.pyctl.agent_history.agent_history_fragments import (
    build_raw_batches,
    collect_fragments,
    count_words,
    sanitize_fragment_text,
)
from pycore.pyctl.ai import generate_text
from pycore.pyctl.ai.ai_rate_limits import rate_status
from pycore.pyutils.llm.llm_orchestrator import chat as llm_orchestrator_chat
from pycore.pyutils.tts import synthesize
from pycore.callmodule.services.sync.laravel_endpoint_manager import get_laravel_endpoint_manager

_SECTION = "agent_history_article"
_DEFAULT_MODEL = "openrouter/free"
_JSON_OBJ_RE = re.compile(r"\{.*\}", re.DOTALL)
_LOG_RING_MAX = 120
# Consecutive failures of the SAME batch before it is skipped (deterministic
# failures must not retry forever, silently).
_MAX_BATCH_ATTEMPTS = 5
# Target-language code -> TTS orchestrator language code (edge-tts voices).
_TTS_LANG_MAP = {
    "EN": "en", "CN": "zh", "JA": "ja", "KO": "ko", "FR": "fr", "DE": "de",
    "ES": "es", "RU": "ru", "AR": "ar", "PT": "pt", "IT": "it", "TH": "th",
    "VI": "vi", "HI": "hi", "NL": "nl", "PL": "pl", "TR": "tr", "ID": "id",
}

class _RunGate:
    """Own the pipeline run token on one THREAD_BUS-backed state thread."""

    def __init__(self) -> None:
        self._token: Optional[object] = None
        init_serialized_owner(self, "agent_history.run_gate", "AgentHistoryRunGate")

    @serialized_method
    def acquire(self) -> Optional[object]:
        if self._token is not None:
            return None
        self._token = object()
        return self._token

    @serialized_method
    def release(self, token: object) -> None:
        if self._token is token:
            self._token = None


class _ArticleServiceProvider:
    """Create and return the process singleton through THREAD_BUS."""

    def __init__(self) -> None:
        self._service: Optional["AgentHistoryArticleService"] = None
        init_serialized_owner(self, "agent_history.provider", "AgentHistoryProvider")

    @serialized_method
    def get(self) -> "AgentHistoryArticleService":
        if self._service is None:
            self._service = AgentHistoryArticleService()
        return self._service


_run_gate = _RunGate()
_service_provider = _ArticleServiceProvider()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _try_acquire_run() -> Optional[object]:
    """Acquire the pipeline run token through THREAD_BUS."""
    return _run_gate.acquire()


def _release_run(token: object) -> None:
    _run_gate.release(token)


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
            "attempts": 0,
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
        # Cached pending-fragment count so the 4s UI log poll never re-scans every
        # session file (that O(all-sessions) disk+regex scan blew the 12s GET
        # ceiling). The heartbeat tick is the ONLY place fragments are scanned; it
        # refreshes this cache via _set_pending_cache().
        self._pending_cache: int = 0
        self._pending_at: float = 0.0

    def _set_pending_cache(self, count: int) -> None:
        self._pending_cache = int(count)
        self._pending_at = time.time()

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
            "min_raw_words", "openrouter_model",
            "live_listen", "phase",
        ):
            if key in patch:
                cfg[key] = patch[key]
        if patch.get("enabled") is True:
            # ON toggle = master switch: the next heartbeat tick runs the full
            # pipeline automatically (backfill -> live), no manual start call.
            cfg["extract_as_article"] = True
            if cfg.get("phase") == "idle":
                cfg["phase"] = "backfill"
                cfg["live_listen"] = True
            elif cfg.get("phase") == "done":
                cfg["phase"] = "live"
                cfg["live_listen"] = True
            self._log("info", "pipeline enabled (auto backfill -> live)")
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
        """UI log panel snapshot: recent events + progress + openrouter rate usage.

        Pure in-memory (events ring + config JSON + cached pending count + rate
        status) so the 4s poll can NEVER exceed the GET ceiling regardless of how
        large the history is — the pending count is refreshed by the heartbeat tick,
        not recomputed here.
        """
        cfg = self.get_config()
        cursor = cfg.get("cursor") or {}
        published = list(cfg.get("published") or [])
        pending = int(self._pending_cache)
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
        """Explicit backfill RESTART: resets the cursor and reprocesses all
        history from the beginning; heartbeat tick processes one batch per pass."""
        token = _try_acquire_run()  # rule §4: busy-token, no lock
        if token is None:
            return {"busy": True, **self.get_status()}
        try:
            self.save_config({
                "enabled": True,
                "extract_as_article": True,
                "phase": "backfill",
                "live_listen": True,
            })
            cfg = self.get_config()
            cfg["cursor"] = {
                "fragment_index": 0,
                "after_ts": 0,
                "after_fragment_id": "",
                "raw_index": 0,
                "attempts": 0,
            }
            get_user_data_store().set_section(_SECTION, cfg)
            # Don't force a full re-extract inline (it blocks this request on a
            # user-dir walk); the heartbeat tick extracts continuously. Read the
            # already-extracted fragments to report the pending count + seed cache.
            pending = len(collect_fragments())
            self._set_pending_cache(pending)
            self._log("info", f"pipeline restarted: backfill ({pending} fragments pending)")
            return {
                "started": True,
                "phase": cfg.get("phase"),
                "pending_fragments": pending,
            }
        finally:
            _release_run(token)

    def tick_pipeline(self) -> Optional[Dict[str, Any]]:
        """Process at most one raw batch per heartbeat (backfill then live)."""
        cfg = self.get_config()
        if not cfg.get("enabled") or not cfg.get("extract_as_article"):
            return None
        phase = str(cfg.get("phase") or "idle")
        if phase == "idle":
            # Master switch on but never kicked (e.g. enabled in a stored config
            # from before the ON-toggle auto-start): begin backfill right away.
            cfg["phase"] = "backfill"
            get_user_data_store().set_section(_SECTION, cfg)
            phase = "backfill"
        if phase not in ("backfill", "live", "done"):
            return None
        token = _try_acquire_run()  # rule §4: busy-token, no lock
        if token is None:
            return None
        try:
            cfg = self.get_config()
            self._retry_pending_uploads(cfg)
            phase = str(cfg.get("phase") or "idle")
            if phase == "backfill":
                return self._tick_backfill_batch(cfg)
            if phase == "live" or (phase == "done" and cfg.get("live_listen")):
                return self._tick_live_batch(cfg)
            return None
        finally:
            _release_run(token)

    def tick_live(self) -> Optional[Dict[str, Any]]:
        return self.tick_pipeline()

    def _tick_backfill_batch(self, cfg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        cursor = cfg.get("cursor") or {}
        frags = collect_fragments(
            after_ts=int(cursor.get("after_ts") or 0),
            after_fragment_id=str(cursor.get("after_fragment_id") or ""),
        )
        self._set_pending_cache(len(frags))
        min_words = int(cfg.get("min_raw_words") or 200)
        batches, _ = build_raw_batches(frags, min_words=min_words, start_index=0)
        if batches:
            batch = batches[0]
            batch_number = int(cursor.get("raw_index") or 0) + 1
            next_idx = int(cursor.get("fragment_index") or 0) + int(batch.get("fragment_count") or 0)
            consumed_all = int(batch.get("next_fragment_index") or 0) >= len(frags)
            self._log(
                "info",
                f"backfill batch #{batch_number}: raw={batch.get('word_count')} words, "
                f"{batch.get('fragment_count')} fragments",
            )
            try:
                published = self._publish_batch(cfg, batch, live=False)
                cfg = self.get_config()
                cfg["cursor"]["raw_index"] = batch_number
                cfg["cursor"]["fragment_index"] = next_idx
                cfg["cursor"]["attempts"] = 0
                cfg["last_run_at"] = _now_iso()
                if consumed_all:
                    cfg["phase"] = "live" if cfg.get("live_listen", True) else "done"
                    self._log("success", "backfill complete -> live listen")
                get_user_data_store().set_section(_SECTION, cfg)
                return published
            except Exception as e:  # noqa: BLE001
                err = str(e)
                cfg = self.get_config()
                cfg["last_error"] = err
                attempts = int(cfg["cursor"].get("attempts") or 0) + 1
                cfg["cursor"]["attempts"] = attempts
                if attempts >= _MAX_BATCH_ATTEMPTS:
                    # Deterministic failure: skip the batch (advance like
                    # success) instead of retrying it forever, silently.
                    cfg["cursor"]["raw_index"] = batch_number
                    cfg["cursor"]["fragment_index"] = next_idx
                    cfg["cursor"]["after_ts"] = int(batch.get("last_ts") or 0)
                    cfg["cursor"]["after_fragment_id"] = str(batch.get("last_fragment_id") or "")
                    cfg["cursor"]["attempts"] = 0
                    if consumed_all:
                        cfg["phase"] = "live" if cfg.get("live_listen", True) else "done"
                    self._log(
                        "error",
                        f"backfill batch #{batch_number} skipped after {attempts} "
                        f"failed attempts: {err}",
                        event="batch_skipped", error=err,
                    )
                else:
                    self._log(
                        "error",
                        f"backfill batch failed (attempt {attempts}/{_MAX_BATCH_ATTEMPTS}): {err}",
                    )
                get_user_data_store().set_section(_SECTION, cfg)
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
        self._set_pending_cache(len(frags))
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
            cfg["cursor"]["attempts"] = 0
            cfg["last_run_at"] = _now_iso()
            get_user_data_store().set_section(_SECTION, cfg)
            return published
        except Exception as e:  # noqa: BLE001
            cfg = self.get_config()
            err = str(e)
            cfg["last_error"] = err
            attempts = int(cfg["cursor"].get("attempts") or 0) + 1
            cfg["cursor"]["attempts"] = attempts
            if attempts >= _MAX_BATCH_ATTEMPTS:
                batch = batches[0]
                cfg["cursor"]["after_ts"] = int(batch.get("last_ts") or 0)
                cfg["cursor"]["after_fragment_id"] = str(batch.get("last_fragment_id") or "")
                cfg["cursor"]["attempts"] = 0
                self._log(
                    "error",
                    f"live batch skipped after {attempts} failed attempts: {err}",
                    event="batch_skipped",
                    error=err,
                )
            else:
                self._log(
                    "error",
                    f"live batch failed (attempt {attempts}/{_MAX_BATCH_ATTEMPTS}): {err}",
                )
            get_user_data_store().set_section(_SECTION, cfg)
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
        record = records.save_record({
            "id": str(uuid.uuid4()),
            "created_at": _now_iso(),
            "title_cn": article.get("title_cn"),
            "title_en": article.get("title_en"),
            "reference_cn": article.get("reference_cn"),
            "article_en": article.get("article_en"),
            "word_count": article.get("word_count"),
            "openrouter_model": article.get("model"),
            "translation_engine": article.get("translation_engine"),
        }, base64.b64decode(audio["audio_base64"]))
        # Upload is best-effort: a Laravel outage must never stall the pipeline.
        # Failed records stay uploaded=false and are retried on later ticks.
        laravel: Dict[str, Any] = {}
        try:
            laravel = self._upload_laravel(cfg, article, audio, raw_text)
            records.mark_uploaded(record["id"])
            record["uploaded"] = True
        except Exception as e:  # noqa: BLE001
            self._log("warn", f"laravel upload deferred (will retry): {e}")
            ColorPrint.yellow(f"[AgentHistoryArticle] upload deferred for {record['id']}: {e}")
        row = {
            "id": record["id"],
            "record_id": record["id"],
            "title_en": article.get("title_en"),
            "title_cn": article.get("title_cn"),
            "reference_cn": article.get("reference_cn"),
            "article_en": article.get("article_en"),
            "word_count": article.get("word_count"),
            "raw_word_count": batch.get("word_count"),
            "translation_engine": article.get("translation_engine"),
            "uploaded": bool(record.get("uploaded")),
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
    def _article_prompt_cn(cfg: Dict[str, Any], raw_text: str) -> str:
        ref = str(cfg.get("reference_lang") or "CN").upper()
        return (
            f"You are a language-learning editor. Reference language: {ref}.\n"
            "Using ONLY the RAW material below, write one coherent short article in fluent Chinese.\n"
            "Rules:\n"
            "1. Preserve factual meaning from the raw fragments; do not invent unrelated topics.\n"
            "2. The Chinese article body goes in reference_cn (at least 150 characters).\n"
            "Return ONLY JSON (no markdown) shaped exactly:\n"
            '{"title_cn": string, "reference_cn": string}\n\n'
            f"RAW:\n{raw_text}"
        )

    @staticmethod
    def _translate_prompt(article_cn: Dict[str, Any]) -> str:
        return (
            "Translate the following Chinese article into fluent English.\n"
            "Rules:\n"
            "1. The English article in article_en must be at least 180 words.\n"
            "2. Preserve the factual meaning; do not add unrelated content.\n"
            "Return ONLY JSON (no markdown) shaped exactly:\n"
            '{"title_en": string, "article_en": string}\n\n'
            f"TITLE_CN: {article_cn.get('title_cn') or ''}\n"
            f"ARTICLE_CN:\n{article_cn.get('reference_cn') or ''}"
        )

    @staticmethod
    def _parse_json_obj(text: str) -> Dict[str, Any]:
        match = _JSON_OBJ_RE.search(text or "")
        data = json.loads(match.group(0) if match else text)
        if not isinstance(data, dict):
            raise ValueError("model returned non-object JSON")
        return data

    def _generate_chinese(self, cfg: Dict[str, Any], raw_text: str, model: str) -> Dict[str, Any]:
        self._log("info", f"AI generate CN start (openrouter: {model})")
        res = generate_text(
            prompt=self._article_prompt_cn(cfg, raw_text),
            provider="openrouter",
            model=model,
            source="agent_history_article",
        ) or {}
        if not res.get("success"):
            err = str(res.get("error") or "article generation failed")
            self._log("error", f"AI generate CN failed: {err}")
            raise RuntimeError(err)
        data = self._parse_json_obj(str(res.get("text") or ""))
        reference_cn = sanitize_fragment_text(str(data.get("reference_cn") or ""))
        if len(reference_cn) < 80:
            raise ValueError("generated Chinese article too short")
        data["reference_cn"] = reference_cn
        data["title_cn"] = str(data.get("title_cn") or "").strip()
        self._log("success", f"AI CN ok: {len(reference_cn)} chars ({res.get('provider')}/{res.get('model') or model})")
        return data

    def _translate_article(
        self,
        cfg: Dict[str, Any],
        article_cn: Dict[str, Any],
        model: str,
    ) -> Tuple[Dict[str, Any], str]:
        """Local LLM translates CN -> EN; falls back to OpenRouter on failure."""
        prompt = self._translate_prompt(article_cn)
        messages = [{"role": "user", "content": prompt}]
        self._log("info", "translate start (built-in local engine priority)")
        res = llm_orchestrator_chat(messages)
        if res.get("success"):
            try:
                used_engine = str(res.get("engine") or "direct")
                self._log("success", f"translate ok (local: {used_engine})")
                return self._parse_json_obj(str(res.get("text") or "")), f"local:{used_engine}"
            except (ValueError, json.JSONDecodeError) as e:
                self._log("warn", f"local translation unparseable, fallback to openrouter: {e}")
        else:
            self._log("warn", f"local translation failed ({res.get('error')}), fallback to openrouter")
            ColorPrint.yellow(f"[AgentHistoryArticle] local LLM translate failed: {res.get('error')}")
        res = generate_text(
            prompt=prompt,
            provider="openrouter",
            model=model,
            source="agent_history_translate",
        ) or {}
        if not res.get("success"):
            err = str(res.get("error") or "translation failed")
            self._log("error", f"translate failed (openrouter fallback): {err}")
            raise RuntimeError(err)
        data = self._parse_json_obj(str(res.get("text") or ""))
        self._log("success", "translate ok (openrouter fallback)")
        return data, "openrouter-fallback"

    def _generate_article(self, cfg: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
        model = str(cfg.get("openrouter_model") or _DEFAULT_MODEL)
        article_cn = self._generate_chinese(cfg, raw_text, model)
        translated, engine = self._translate_article(cfg, article_cn, model)
        article_en = sanitize_fragment_text(str(translated.get("article_en") or ""))
        if count_words(article_en) < 120:
            raise ValueError("translated article too short")
        data = {
            "title_cn": article_cn.get("title_cn"),
            "reference_cn": article_cn.get("reference_cn"),
            "title_en": str(translated.get("title_en") or "").strip() or article_cn.get("title_cn"),
            "article_en": article_en,
            "word_count": count_words(article_en),
            "provider": "openrouter",
            "model": model,
            "translation_engine": engine,
        }
        self._log(
            "success",
            f"AI ok: article={data['word_count']} words (translate: {engine})",
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
            result = synthesize(
                clean,
                tts_lang,
                out,
                accent=accent,
                priority_profile="default",
            )
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

    def _retry_pending_uploads(self, cfg: Dict[str, Any]) -> None:
        """Re-upload cached records whose Laravel upload previously failed."""
        pending = records.pending_uploads()
        if not pending:
            return
        for rec in pending[:3]:
            audio_bytes = records.read_audio(str(rec.get("id") or ""))
            if audio_bytes is None:
                continue
            article = {
                "title_en": rec.get("title_en"),
                "title_cn": rec.get("title_cn"),
                "reference_cn": rec.get("reference_cn"),
                "article_en": rec.get("article_en"),
                "model": rec.get("openrouter_model"),
            }
            audio = {"audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
                     "engine": None, "accent": None}
            try:
                self._upload_laravel(cfg, article, audio, "")
                records.mark_uploaded(str(rec["id"]))
                self._log("success", f"pending upload ok: {rec.get('title_en') or rec['id']}")
            except Exception as e:  # noqa: BLE001
                self._log("warn", f"pending upload retry failed: {e}")
                break

    def _upload_laravel(
        self,
        cfg: Dict[str, Any],
        article: Dict[str, Any],
        audio: Dict[str, Any],
        raw_text: str,
    ) -> Dict[str, Any]:
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
        resp = get_laravel_client().post(url, json=payload, timeout=120)
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
    return _service_provider.get()
