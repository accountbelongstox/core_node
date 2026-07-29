#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ai_gateway_quota - TTL-cached dispatch snapshot + quota for the AI gateway.

The HOT PATH (generate_text / translation / gateway_status polling) uses the
registry catalog + local cooldown/rate state only — it NEVER calls probe_all().
Live /models probes run only when the UI explicitly requests them (or
``refresh=True`` on a one-off gateway refresh). This mirrors the TTS orchestrator:
unconfigured or dead providers stay disabled; rate-limited ones pause until the
budget resets.

Per-provider quota endpoints (openrouter /api/v1/key, deepseek /user/balance)
stay TTL-cached. Mutable cache dicts live in ai_gateway_state.
"""

import time
from typing import Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyctl.ai.ai_keys import PROVIDERS, PROVIDER_ORDER, first_secret, limits_note, is_configured
from pycore.pyctl.ai.ai_probe import (
    _PROBE_BY_NAME,
    _catalog_record,
    _ensure_catalog_models,
    _sort_key,
    probe_one,
    probe_skip_reason,
)
from pycore.pyctl.ai.ai_rate_limits import check_rate_limit
from pycore.pyctl.ai.ai_gateway_state import (
    _PROBE_TTL_S, _QUOTA_TTL_S, _in_cooldown,
)


_PROBE_CACHE_SIGNAL = 'pyctl.ai.gateway.probe_cache'
_QUOTA_CACHE_SIGNAL = 'pyctl.ai.gateway.quota_cache'
_VISION_CACHE_SIGNAL = 'pyctl.ai.gateway.vision_cache'


def available_providers(refresh: bool = False) -> List[Dict[str, Any]]:
    """Dispatch-ready providers (catalog + local state; no network on the hot path)."""
    return [p for p in _all_probed_providers(refresh) if p.get("available") and p.get("models")]


def _apply_pause_state(rec: Dict[str, Any]) -> Dict[str, Any]:
    """Mark a provider unavailable when cooldown or local rate budget blocks it."""
    name = rec.get("name", "")
    if _in_cooldown(name):
        rec["available"] = False
        rec["paused"] = True
        if not rec.get("error"):
            rec["error"] = "Provider paused (cooldown)"
        return rec
    rate = check_rate_limit(name)
    if not rate.allowed:
        rec["available"] = False
        rec["paused"] = True
        rec["error"] = rate.message or "Rate limit reached"
    return rec


def _dispatch_snapshot(name: str, *, live: bool = False) -> Dict[str, Any]:
    """
    One provider for gateway dispatch / status.

    ``live=False`` (default): registry catalog only — no network I/O.
    ``live=True``: run probe_one for configured providers that are not skipped.
    """
    rec = _catalog_record(name)
    _ensure_catalog_models(rec)

    if not is_configured(name):
        rec["available"] = False
        return _apply_pause_state(rec)

    skip = probe_skip_reason(name, force=live)
    if skip:
        rec["available"] = False
        rec["error"] = skip
        rec["paused"] = True
        return rec

    probe_cache = THREAD_BUS.get_signal(_PROBE_CACHE_SIGNAL, {}) or {}
    by_name = dict(probe_cache.get("by_name", {}) or {})
    cached = by_name.get(name) if isinstance(by_name.get(name), dict) else None
    if not live and cached and cached.get("live"):
        live_rec = dict(cached.get("rec") or {})
        if not live_rec.get("available"):
            live_rec.setdefault("paused", True)
            return live_rec

    if live:
        try:
            live_rec = probe_one(name, force=True)
        except Exception as e:
            ColorPrint.yellow(f"[ai_gateway] probe {name} failed: {e}")
            live_rec = dict(rec)
            live_rec["available"] = False
            live_rec["error"] = str(e)
            live_rec["tested"] = True
        by_name[name] = {"ts": time.time(), "rec": live_rec, "live": True}
        THREAD_BUS.signal(_PROBE_CACHE_SIGNAL, {
            **probe_cache,
            'by_name': by_name,
        })
        return live_rec

    rec["available"] = True
    rec["tested"] = False
    rec["error"] = None
    return rec


def _all_probed_providers(refresh: bool = False) -> List[Dict[str, Any]]:
    """Full provider snapshot for dispatch/status (sorted available-first)."""
    probe_cache = THREAD_BUS.get_signal(_PROBE_CACHE_SIGNAL, {}) or {}
    fresh = (time.time() - float(probe_cache.get("ts") or 0.0)) < _PROBE_TTL_S
    if not refresh and fresh and probe_cache.get("providers"):
        return list(probe_cache["providers"])

    providers: List[Dict[str, Any]] = []
    for name in PROVIDER_ORDER:
        if name not in _PROBE_BY_NAME:
            continue
        providers.append(_dispatch_snapshot(name, live=refresh))
    providers.sort(key=_sort_key)

    latest_cache = THREAD_BUS.get_signal(_PROBE_CACHE_SIGNAL, {}) or {}
    THREAD_BUS.signal(_PROBE_CACHE_SIGNAL, {
        **latest_cache,
        "providers": providers,
        "ts": time.time(),
    })
    return providers


def invalidate_probe_cache() -> None:
    """Force the next gateway read to rebuild (e.g. after keys change)."""
    THREAD_BUS.signal(_PROBE_CACHE_SIGNAL, {
        "ts": 0.0,
        "providers": [],
        "by_name": {},
    })
    THREAD_BUS.clear_signal(_QUOTA_CACHE_SIGNAL)
    THREAD_BUS.clear_signal(_VISION_CACHE_SIGNAL)


def _quota_openrouter(key: str) -> Dict[str, Any]:
    """OpenRouter key info: usage / limit / free tier (GET /api/v1/key)."""
    requests = get_third_package_requests()
    resp = requests.get(
        "https://openrouter.ai/api/v1/key",
        headers={"Authorization": f"Bearer {key}"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json().get("data", {})
    is_free = bool(data.get("is_free_tier"))
    return {
        "kind": "key-usage",
        "is_free_tier": is_free,
        "usage": data.get("usage"),
        "limit": data.get("limit"),
        "limit_remaining": data.get("limit_remaining"),
        "rate_limit": data.get("rate_limit"),
        "note": ":free models: 20 req/min; 50/day (<10 credits) or 1000/day",
    }


def _quota_deepseek(key: str) -> Dict[str, Any]:
    """DeepSeek prepaid balance (GET /user/balance)."""
    requests = get_third_package_requests()
    resp = requests.get(
        "https://api.deepseek.com/user/balance",
        headers={"Authorization": f"Bearer {key}"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    infos = data.get("balance_infos") or []
    first = infos[0] if infos else {}
    return {
        "kind": "balance",
        "is_available": bool(data.get("is_available")),
        "balance": first.get("total_balance"),
        "currency": first.get("currency"),
    }


def get_quota(provider: str, refresh: bool = False) -> Dict[str, Any]:
    """
    Quota/limit snapshot for one provider (TTL-cached).

    Providers without a quota API get a static descriptor; their live state is
    expressed through the cooldown (set on 429/quota errors).
    """
    quota_cache = THREAD_BUS.get_signal(_QUOTA_CACHE_SIGNAL, {}) or {}
    cached = quota_cache.get(provider)
    if cached and not refresh and (time.time() - cached["ts"]) < _QUOTA_TTL_S:
        return cached["quota"]

    key = first_secret(provider)
    if not key:
        quota: Dict[str, Any] = {"kind": "none", "note": "No API key configured"}
    elif provider == "openrouter":
        try:
            quota = _quota_openrouter(key)
        except Exception as e:
            quota = {"kind": "key-usage", "error": str(e)}
    elif provider == "deepseek":
        try:
            quota = _quota_deepseek(key)
        except Exception as e:
            quota = {"kind": "balance", "error": str(e)}
    elif provider == "gemini":
        quota = {"kind": "static", "is_free_tier": True, "note": limits_note("gemini")}
    elif provider in PROVIDERS and PROVIDERS[provider]["tier"] == "free":
        quota = {"kind": "static", "is_free_tier": True, "note": limits_note(provider)}
    else:
        quota = {"kind": "static", "is_free_tier": False, "note": limits_note(provider)}

    quota_cache = dict(
        THREAD_BUS.get_signal(_QUOTA_CACHE_SIGNAL, {}) or {}
    )
    quota_cache[provider] = {"ts": time.time(), "quota": quota}
    THREAD_BUS.signal(_QUOTA_CACHE_SIGNAL, quota_cache)
    return quota
