#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ai_gateway_quota - TTL-cached probe + quota snapshot for the AI gateway.

Wraps ai_probe.probe_all and the per-provider quota endpoints (openrouter
/api/v1/key, deepseek /user/balance) behind a shared TTL cache so monitors that
poll the gateway every few seconds never hammer provider /models, /key or
/balance endpoints. The mutable cache dicts (_probe_cache / _quota_cache /
_vision_model_cache) and _lock live in ai_gateway_state; this module only reads
+ refreshes them, never re-declares them.
"""

import time
from typing import Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyctl.ai.ai_keys import PROVIDERS, first_secret, limits_note
from pycore.pyctl.ai.ai_probe import probe_all
from pycore.pyctl.ai.ai_gateway_state import (
    _lock, _probe_cache, _quota_cache, _vision_model_cache,
    _PROBE_TTL_S, _QUOTA_TTL_S,
)


def available_providers(refresh: bool = False) -> List[Dict[str, Any]]:
    """Available providers from a TTL-cached probe (probe order preserved)."""
    return [p for p in _all_probed_providers(refresh) if p.get("available") and p.get("models")]


def _all_probed_providers(refresh: bool = False) -> List[Dict[str, Any]]:
    """Full probe snapshot (all providers, sorted available-first)."""
    with _lock:
        fresh = (time.time() - _probe_cache["ts"]) < _PROBE_TTL_S
        if refresh or not fresh or not _probe_cache["providers"]:
            try:
                _probe_cache["providers"] = probe_all().get("providers", [])
                _probe_cache["ts"] = time.time()
            except Exception as e:
                ColorPrint.yellow(f"[ai_gateway] probe failed: {e}")
        return list(_probe_cache["providers"])


def invalidate_probe_cache() -> None:
    """Force the next gateway call to re-probe (e.g. after keys change)."""
    with _lock:
        _probe_cache["ts"] = 0.0
        _quota_cache.clear()
        _vision_model_cache["ts"] = 0.0


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
    with _lock:
        cached = _quota_cache.get(provider)
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

    with _lock:
        _quota_cache[provider] = {"ts": time.time(), "quota": quota}
    return quota
