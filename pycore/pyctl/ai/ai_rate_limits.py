#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified local rate-limit enforcement for AI chat / gateway.

Official free-tier limits are encoded below (see RATE_LIMITS_LAST_UPDATED).
Usage is persisted under the user data directory so restarts keep counters.

Docs consulted:
  - GitHub Models rate limits (docs.github.com/en/github-models/.../prototyping-with-ai-models)
  - OpenRouter :free key limits (openrouter.ai/docs)
  - Google AI Studio Gemini free tier (ai.google.dev)
  - Groq console limits (console.groq.com/docs/rate-limits)
  - Cohere trial (docs.cohere.com)
  - Mistral experiment plan (docs.mistral.ai)
  - NVIDIA NIM (build.nvidia.com)
  - Cerebras (inference-docs.cerebras.ai)
  - DeepSeek: prepaid balance only — no RPM/RPD free tier (api-docs.deepseek.com)
"""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.system_paths import APP_DATA_DIR, get_core_node_root, get_local_data_dir
from pycore.pyctl.ai.ai_keys import PROVIDERS, PROVIDER_ORDER

# Last time limits table was verified against provider documentation.
RATE_LIMITS_LAST_UPDATED = "2026-06-13"

# Conservative fallback RPM for a registry free provider with no explicit row in
# _PROVIDER_LIMITS (keeps pycore and the Laravel side in lock-step: a newly added
# free provider is guarded + recorded on BOTH runtimes, never left unlimited).
_FREE_DEFAULT_RPM = 10

# --------------------------------------------------------------------------- #
# Shared rate-usage store (cross-runtime: pycore on Windows + Laravel in WSL). #
# --------------------------------------------------------------------------- #
# pycore runs on the Windows host while the Laravel apps run inside WSL, so a
# per-OS user-data path (APP_DATA_DIR -> D:\programing\Users\..\.core_node\data on Windows
# vs /var/_core_node/data inside WSL) resolves to DIFFERENT physical files — the
# two runtimes would each keep their OWN counters and the same provider key would
# get DOUBLE its real free-tier budget. The only filesystem location both see as
# a SINGLE file is the core_node repo root itself (D:\..\core_node on Windows ==
# /mnt/d/..\core_node in WSL via DrvFs), exactly how .secret_keys is already
# shared. So the canonical store now lives under <core_node>/.ai_state and the
# Laravel side reads/writes the identical file
# (App\Services\AiGateway\AiRateLimiter), giving one shared quota.
#
# Safety: writes go through a tmp file + atomic os.replace, and an in-process
# threading lock serializes this process. True cross-runtime file locking over
# DrvFs is not reliable, but free-tier requests are seconds apart so the
# lost-update window is negligible; atomic replace guarantees no corruption.
# Lives under <cache>/pycore/.ai_state; the prior <core_node>/.ai_state and the
# per-OS APP_DATA location are both migrated once on first access.
_SHARED_STATE_DIR = get_local_data_dir() / ".ai_state"
_OLD_SHARED_DIR = get_core_node_root() / ".ai_state"
_LEGACY_USAGE_FILE = APP_DATA_DIR / "ai_rate_usage.json"


def _resolve_usage_file():
    """Shared store path under the core_node root, migrating older locations once."""
    try:
        _SHARED_STATE_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        # core_node root not writable (e.g. read-only deploy): keep the per-OS path.
        return _LEGACY_USAGE_FILE
    shared = _SHARED_STATE_DIR / "ai_rate_usage.json"
    # One-time migration: seed the new shared store from the prior shared dir
    # (<core_node>/.ai_state) or, failing that, the old per-OS location — so
    # already-accumulated counters survive the move to <cache>/pycore/.ai_state.
    try:
        old_shared = _OLD_SHARED_DIR / "ai_rate_usage.json"
        if not shared.exists() and old_shared.is_file():
            os.replace(str(old_shared), str(shared))
        elif not shared.exists() and _LEGACY_USAGE_FILE.is_file():
            shared.write_text(
                _LEGACY_USAGE_FILE.read_text(encoding="utf-8"), encoding="utf-8"
            )
    except Exception:
        pass
    return shared


_USAGE_FILE = _resolve_usage_file()
_lock = threading.Lock()

# provider -> default limits; optional model keys override by exact id or suffix match.
# None = no local enforcement (paid / balance-only providers).
_PROVIDER_LIMITS: Dict[str, Dict[str, Any]] = {
    "github": {
        "rpm": 15,
        "rpd": 150,
        "note": "GitHub Models low tier (Copilot Free)",
    },
    "openrouter": {
        "rpm": 20,
        "rpd": 1000,
        "note": "OpenRouter :free router (~1000 req/day with >=$10 lifetime top-up); shared :free quota",
    },
    "gemini": {
        "rpm": 5,
        "rpd": 20,
        "note": "Gemini 2.5 Flash free tier (conservative)",
    },
    "groq": {
        "rpm": 30,
        "rpd": 1000,
        "models": {
            "llama-3.3-70b-versatile": {"rpm": 30, "rpd": 1000},
            "llama-3.1-8b-instant": {"rpm": 30, "rpd": 14400},
        },
        "note": "Groq free tier per model",
    },
    "cerebras": {
        "rpm": 30,
        "rpd": 1440,
        "note": "Cerebras free tier (approx daily cap from TPD docs)",
    },
    "mistral": {
        "rps": 1.0,
        "note": "Mistral experiment plan 1 req/s",
    },
    "cohere": {
        "rpm": 20,
        "rpm_month": 1000,
        "note": "Cohere trial 20/min, 1000/month",
    },
    "nvidia": {
        "rpm": 40,
        "note": "NVIDIA NIM free tier",
    },
    "huggingface": {
        "rpm": 10,
        "note": "HF serverless credits — conservative local guard",
    },
    "zhipuai": {
        "rpm": 20,
        "note": "Zhipu free tier (conservative; no public quota API)",
    },
    "cloudflare": {"rpm": 30, "rpd": 500, "note": "Workers AI daily allocation (conservative)"},
    "siliconflow": {"rpm": 20, "note": "SiliconFlow free-model RPM"},
    "dashscope": {"rpm": 10, "rpd": 100, "note": "DashScope qwen-turbo free tier"},
    "hunyuan": {"rpm": 20, "note": "Hunyuan lite free tier"},
    "qianfan": {"rpm": 20, "note": "Qianfan ERNIE speed/lite free tier"},
    "spark": {"rpm": 20, "note": "Spark Lite free tier"},
    # balance / paid — enforced only via gateway cooldown on 429, not local RPM
    "deepseek": None,
    "openai": None,
    "anthropic": None,
    "volcano": None,
    "moonshot": None,
    "minimax": None,
    "stepfun": None,
    "yi": None,
    "xai": None,
    "together": None,
}


@dataclass
class RateLimitSpec:
    rpm: Optional[int] = None
    rpd: Optional[int] = None
    rps: Optional[float] = None
    rpm_month: Optional[int] = None
    note: str = ""


@dataclass
class RateCheckResult:
    allowed: bool
    message: str = ""
    retry_after_s: float = 0.0
    limits: Optional[RateLimitSpec] = None


def limits_metadata() -> Dict[str, Any]:
    """Snapshot for UI / API (includes doc refresh date)."""
    return {
        "last_updated": RATE_LIMITS_LAST_UPDATED,
        "providers": {
            name: spec for name, spec in _PROVIDER_LIMITS.items()
        },
    }


def resolve_limit(provider: str, model: Optional[str] = None) -> Optional[RateLimitSpec]:
    """Resolve applicable limit spec for provider (+ optional model override)."""
    if provider in _PROVIDER_LIMITS:
        raw = _PROVIDER_LIMITS[provider]
    else:
        # Unlisted: a registry free provider still gets a conservative default
        # guard (so a newly-added free provider is never left unlimited and stays
        # in lock-step with the Laravel side); balance/paid stay unenforced.
        meta = PROVIDERS.get(provider) or {}
        raw = (
            {"rpm": _FREE_DEFAULT_RPM, "note": "Conservative default (unlisted free provider)"}
            if meta.get("tier") == "free"
            else None
        )
    if raw is None:
        return None
    base = dict(raw)
    models_map = base.pop("models", {}) or {}
    if model and model in models_map:
        base.update(models_map[model])
    return RateLimitSpec(
        rpm=base.get("rpm"),
        rpd=base.get("rpd"),
        rps=base.get("rps"),
        rpm_month=base.get("rpm_month"),
        note=base.get("note", ""),
    )


# Calendar boundaries use UTC so the daily/monthly budget resets at the SAME
# instant regardless of which runtime is asking. This store is shared with the
# Laravel side (AiRateLimiter), which runs under WSL with PHP pinned to UTC
# (config app.timezone) while pycore runs in the Windows local tz; computing the
# {date: count} bucket keys in local time would put the two runtimes in
# DIFFERENT day/month buckets for hours each day and silently split the shared
# counter. UTC is the one wall-clock both compute identically. RPD/monthly are
# calendar-bucketed counters ({date: count}); RPM stays a sliding 60s window.
def _month_key(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m")


def _day_key(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d")


def _seconds_to_next_utc_midnight(now: float) -> float:
    """Seconds until the next UTC 00:00 (when the daily budget resets)."""
    dt = datetime.fromtimestamp(now, timezone.utc)
    nxt = (dt + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(0.0, nxt.timestamp() - now)


def _seconds_to_next_utc_month(now: float) -> float:
    """Seconds until the 1st of next UTC month at 00:00 (monthly budget reset)."""
    dt = datetime.fromtimestamp(now, timezone.utc)
    if dt.month == 12:
        nxt = dt.replace(year=dt.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        nxt = dt.replace(month=dt.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return max(0.0, nxt.timestamp() - now)


def _as_count_map(value: Any) -> Dict[str, int]:
    """Coerce a calendar counter field to a {key: count} dict (else empty)."""
    return dict(value) if isinstance(value, dict) else {}


def _coerce_day_map(value: Any) -> Dict[str, int]:
    """
    Day counter as {YYYY-MM-DD: count}. Migrates the OLD rolling-window format
    (a list of timestamps) by bucketing each timestamp into its local calendar
    day, so today's count is preserved and past days drop out on the next prune.
    """
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, list):
        out: Dict[str, int] = {}
        for t in value:
            if isinstance(t, (int, float)):
                k = _day_key(float(t))
                out[k] = out.get(k, 0) + 1
        return out
    return {}


def _load_usage() -> Dict[str, Any]:
    try:
        if _USAGE_FILE.is_file():
            return json.loads(_USAGE_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {"providers": {}}


def _save_usage(data: Dict[str, Any]) -> None:
    try:
        _USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        data["saved_at"] = time.time()
        # tmp + atomic replace so a concurrent reader (incl. the Laravel side
        # sharing this file) never observes a half-written document.
        tmp = _USAGE_FILE.with_suffix(_USAGE_FILE.suffix + ".tmp")
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
        os.replace(str(tmp), str(_USAGE_FILE))
    except Exception:
        pass


def _provider_bucket(data: Dict[str, Any], provider: str) -> Dict[str, Any]:
    providers = data.setdefault("providers", {})
    bucket = providers.setdefault(provider, {"minute": [], "day": {}, "month": {}})
    return bucket


def _prune_timestamps(entries: List[float], window_s: float, now: float) -> List[float]:
    cutoff = now - window_s
    return [t for t in entries if t >= cutoff]


def check_rate_limit(provider: str, model: Optional[str] = None) -> RateCheckResult:
    """Return whether a request is allowed under local counters."""
    spec = resolve_limit(provider, model)
    if spec is None:
        return RateCheckResult(allowed=True, limits=None)

    now = time.time()
    with _lock:
        data = _load_usage()
        bucket = _provider_bucket(data, provider)
        minute = _prune_timestamps(bucket.get("minute", []), 60.0, now)
        day_count = int(_coerce_day_map(bucket.get("day")).get(_day_key(now), 0))
        month_count = int(_as_count_map(bucket.get("month")).get(_month_key(now), 0))

        if spec.rps and spec.rps > 0:
            min_gap = 1.0 / spec.rps
            last = minute[-1] if minute else 0.0
            if last and (now - last) < min_gap:
                wait = min_gap - (now - last)
                return RateCheckResult(
                    allowed=False,
                    message=(
                        f"Rate limit ({provider}): max {spec.rps} req/s "
                        f"(docs updated {RATE_LIMITS_LAST_UPDATED}). Retry in {wait:.0f}s."
                    ),
                    retry_after_s=round(wait, 1),
                    limits=spec,
                )

        if spec.rpm is not None and len(minute) >= spec.rpm:
            wait = 60.0 - (now - minute[0]) if minute else 60.0
            return RateCheckResult(
                allowed=False,
                message=(
                    f"Rate limit ({provider}): {spec.rpm} requests/minute exceeded. "
                    f"Retry in {max(wait, 1):.0f}s."
                ),
                retry_after_s=round(max(wait, 1), 1),
                limits=spec,
            )

        if spec.rpd is not None and day_count >= spec.rpd:
            wait = _seconds_to_next_utc_midnight(now)
            return RateCheckResult(
                allowed=False,
                message=(
                    f"Rate limit ({provider}): {spec.rpd} requests/day exceeded. "
                    f"Resets at UTC midnight (in {max(wait, 1):.0f}s)."
                ),
                retry_after_s=round(max(wait, 1), 1),
                limits=spec,
            )

        if spec.rpm_month is not None and month_count >= spec.rpm_month:
            wait = _seconds_to_next_utc_month(now)
            return RateCheckResult(
                allowed=False,
                message=(
                    f"Rate limit ({provider}): {spec.rpm_month} requests/month exceeded "
                    f"(resets on the 1st, in {max(wait, 60):.0f}s)."
                ),
                retry_after_s=round(max(wait, 60), 1),
                limits=spec,
            )

    return RateCheckResult(allowed=True, limits=spec)


def record_request(provider: str) -> None:
    """Record one successful chat request for local rate counters."""
    if resolve_limit(provider) is None:
        return
    now = time.time()
    with _lock:
        data = _load_usage()
        bucket = _provider_bucket(data, provider)
        bucket["minute"] = _prune_timestamps(bucket.get("minute", []), 60.0, now) + [now]
        # Calendar-day counter: increment today, drop past days (midnight reset).
        day_map = _coerce_day_map(bucket.get("day"))
        dk = _day_key(now)
        day_map[dk] = int(day_map.get(dk, 0)) + 1
        bucket["day"] = {dk: day_map[dk]}
        # Calendar-month counter: increment this month, drop past months.
        month_map = _as_count_map(bucket.get("month"))
        mk = _month_key(now)
        month_map[mk] = int(month_map.get(mk, 0)) + 1
        bucket["month"] = {mk: month_map[mk]}
        _save_usage(data)


def prune_expired() -> Dict[str, Any]:
    """
    Actively prune expired rate-counter entries for EVERY provider and persist.

    This is the tick-driven "auto-reset the quota by the AI's rate window": as
    time passes, requests older than their window (minute / day) age out and
    past months are dropped, so the persisted store (and therefore the UI and
    the next check_rate_limit) reflect the freed budget WITHOUT waiting for a
    record/read. Injected into pyheartbeat as a periodic callback (the heartbeat
    itself stays generic and AI-agnostic).

    Returns a summary: { changed, freed: {provider: {minute?, day?, month?}}, ts }.
    """
    now = time.time()
    changed = False
    freed: Dict[str, Dict[str, int]] = {}
    cur_day = _day_key(now)
    cur_month = _month_key(now)
    with _lock:
        data = _load_usage()
        providers = data.get("providers", {})
        for name, bucket in list(providers.items()):
            before_min = len(bucket.get("minute", []))
            raw_day = bucket.get("day")
            raw_month = bucket.get("month")
            day_map = _coerce_day_map(raw_day)
            month_map = _as_count_map(raw_month)

            minute = _prune_timestamps(bucket.get("minute", []), 60.0, now)
            # Keep only the CURRENT local calendar day / month -> past days and
            # months drop out at midnight / on the 1st (the real budget reset).
            new_day = {k: v for k, v in day_map.items() if k == cur_day}
            new_month = {k: v for k, v in month_map.items() if k == cur_month}

            day_changed = (not isinstance(raw_day, dict)) or (len(new_day) != len(day_map))
            month_changed = (not isinstance(raw_month, dict)) or (len(new_month) != len(month_map))

            if len(minute) != before_min or day_changed or month_changed:
                bucket["minute"] = minute
                bucket["day"] = new_day
                bucket["month"] = new_month
                changed = True
                f: Dict[str, int] = {}
                if before_min - len(minute) > 0:
                    f["minute"] = before_min - len(minute)
                dropped_day = sum(v for k, v in day_map.items() if k != cur_day)
                if dropped_day:
                    f["day"] = dropped_day
                dropped_month = sum(v for k, v in month_map.items() if k != cur_month)
                if dropped_month:
                    f["month"] = dropped_month
                if f:
                    freed[name] = f
        if changed:
            _save_usage(data)
    return {"changed": changed, "freed": freed, "ts": now}


def _resets_in(entries: List[float], window_s: float, now: float, at_limit: bool) -> Optional[float]:
    """
    Seconds until this window frees its next slot (the oldest in-window entry
    ages out). None when the window is already empty (nothing to reset).
    """
    if not entries:
        return None
    oldest = min(entries)
    remaining = window_s - (now - oldest)
    return round(max(0.0, remaining), 1)


def rate_status(provider: Optional[str] = None) -> Dict[str, Any]:
    """Current local usage vs encoded limits (for UI)."""
    now = time.time()
    with _lock:
        data = _load_usage()

    def one(name: str) -> Dict[str, Any]:
        spec = resolve_limit(name)
        if spec is None:
            return {"provider": name, "enforced": False, "note": "No local RPM/RPD (balance or paid)"}
        bucket = data.get("providers", {}).get(name, {})
        minute = _prune_timestamps(bucket.get("minute", []), 60.0, now)
        day_count = int(_coerce_day_map(bucket.get("day")).get(_day_key(now), 0))
        month_count = int(_as_count_map(bucket.get("month")).get(_month_key(now), 0))
        return {
            "provider": name,
            "enforced": True,
            "limits": {
                "rpm": spec.rpm,
                "rpd": spec.rpd,
                "rps": spec.rps,
                "rpm_month": spec.rpm_month,
                "note": spec.note,
            },
            "usage": {
                "minute": len(minute),
                "day": day_count,
                "month": month_count,
            },
            # Countdown to the next reset: RPM is a sliding 60s window; RPD resets
            # at UTC midnight; monthly resets on the 1st (UTC). null = nothing to reset.
            "resets_in": {
                "minute": _resets_in(minute, 60.0, now, spec.rpm is not None and len(minute) >= spec.rpm),
                "day": round(_seconds_to_next_utc_midnight(now), 1) if (spec.rpd is not None and day_count > 0) else None,
                "month": round(_seconds_to_next_utc_month(now), 1) if (spec.rpm_month is not None and month_count > 0) else None,
            },
            "last_updated": RATE_LIMITS_LAST_UPDATED,
        }

    if provider:
        return {"success": True, "status": one(provider.strip().lower())}
    # Every enforced provider in registry order — covers explicit _PROVIDER_LIMITS
    # rows AND any registry free provider picked up by resolve_limit's fallback.
    enforced = [n for n in PROVIDER_ORDER if resolve_limit(n) is not None]
    for extra in _PROVIDER_LIMITS:
        if extra not in enforced and resolve_limit(extra) is not None:
            enforced.append(extra)
    return {
        "success": True,
        "last_updated": RATE_LIMITS_LAST_UPDATED,
        "storage_path": str(_USAGE_FILE),
        "providers": [one(n) for n in enforced],
    }


def chat_nickname(provider: str, model: str) -> str:
    """Display name for chat bubbles: provider/model."""
    model = (model or "").strip()
    if model:
        return f"{provider}/{model}"
    return provider


__all__ = [
    "RATE_LIMITS_LAST_UPDATED",
    "check_rate_limit",
    "record_request",
    "rate_status",
    "prune_expired",
    "limits_metadata",
    "resolve_limit",
    "chat_nickname",
]
