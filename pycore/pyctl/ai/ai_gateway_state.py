#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ai_gateway_state - THREAD_BUS-owned runtime state for the AI gateway.

ALL module-level mutable gateway state lives HERE and nowhere else:
  - per-provider runtime counters + cooldown windows
  - recent task ring buffer

Every other ai_gateway_* sub-module imports these names from here; NONE ever
re-declares them, or cooldowns / records / caches silently split into two
independent copies and the gateway drifts (the core risk of this split).

This module is a LEAF: it imports NO sibling ai_gateway_* module, only the
pre-existing ai_keys / ai_rate_limits / ai_usage_log helpers + stdlib. It also
owns the persistence (load/save of the usage file), the error-class predicates
(quota / net-timeout / hard-disable), the per-key rate-cap resolver, and the
state-mutation primitives (_on_result / _in_cooldown / clear_expired_cooldowns
/ _record) that the orchestrator facade calls into.
"""

import json
import time
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyctl.ai.ai_keys import PROVIDER_ORDER
from pycore.pyctl.ai.ai_rate_limits import resolve_limit
from pycore.pyctl.ai.ai_usage_log import record_usage

# Dispatch tier order: free first, then prepaid balance, then post-paid.
_TIER_ORDER = ("free", "balance", "paid")

# Probe/quota caches - monitors may call the gateway every few seconds; never
# hit provider /models, /key or /balance endpoints that often.
_PROBE_TTL_S = 600.0
_QUOTA_TTL_S = 600.0

_COOLDOWN_BASE_S = 60.0
_COOLDOWN_MAX_S = 1800.0
_RECORDS_MAX = 100
_USAGE_FILE = APP_CONFIG_DIR / "ai_gateway_usage.json"

# Image network/time bounds. (connect, read) so a BLOCKED host fails in ~8s
# instead of hanging; a hard per-provider thread bound covers SDK calls (e.g. the
# google-genai client) that don't honour a requests timeout - so no single
# provider can stall the whole image request.
_IMG_HTTP_TIMEOUT: Tuple[int, int] = (8, 25)
_IMG_BOUND_S = 30.0
# Overall wall-clock budget for ONE generate_image call: once exceeded we stop
# trying further providers and return the last error, so a sequence of slow/dead
# providers can never make the request "stuck" (the dead ones get cooled + skipped
# on the next call, which is then fast).
_IMG_TOTAL_BUDGET_S = 80.0
# Cooldown applied to an image key when its provider is UNREACHABLE/timed-out, so
# a dead/blocked provider is skipped on subsequent calls (longer than the quota
# cooldown - the host is likely down or geo-blocked, not just rate-limited).
_IMG_UNREACHABLE_COOLDOWN_S = 300.0
# Cooldown for a provider that returns a NON-retryable / disabling error
# (paid-plan-only model, disabled/banned account, auth failure). Long, so the
# provider is SKIPPED on later tasks instead of failing every one; it auto-
# recovers (in case billing/keys get fixed) when the cooldown elapses.
_IMG_DISABLED_COOLDOWN_S = 3600.0

# Error fragments that mean "rate limit / quota" -> cooldown, not plain failure.
_QUOTA_ERROR_MARKS = (
    "429", "rate limit", "rate_limit", "ratelimit", "resource_exhausted",
    "quota", "insufficient", "overloaded", "402",
)

_NET_ERROR_MARKS = (
    "timed out", "timeout", "connection", "max retries", "unreachable",
    "failed to establish", "getaddrinfo", "connecterror", "read timed",
    "newconnectionerror", "name or service not known", "ssl",
)

# Specific, non-ambiguous markers only - bare "unauthorized" / "permission denied"
# were dropped because transient proxy/nginx 401/503 pages contain them and would
# wrongly cool a valid key for an hour. The provider-JSON forms below are precise.
_HARD_DISABLE_MARKS = (
    "401", "only available on paid", "paid plan", "paid tier", "upgrade your account",
    "账号已被禁用", "account disabled", "account has been disabled",
    "account is disabled", "请联系客服", "authentication_error",
    "invalid api key", "invalid_api_key", "permission_denied",
)

_GATEWAY_STATE_SIGNAL = 'pyctl.ai.gateway.state'

# Per-provider runtime stats: which AI worked, how often, and its cooldown.
_stats: Dict[str, Dict[str, Any]] = {
    name: {"calls": 0, "ok": 0, "failed": 0, "last_used": None,
           "last_error": None, "cooldown_until": 0.0, "strikes": 0}
    for name in PROVIDER_ORDER
}
# Recent task records (newest first when exported).
_records = []


def _load_stats() -> None:
    """Restore per-provider usage counters from local config (survives restarts)."""
    try:
        if not _USAGE_FILE.is_file():
            return
        data = json.loads(_USAGE_FILE.read_text(encoding="utf-8"))
        for name, st in (data.get("stats") or {}).items():
            if name not in _stats or not isinstance(st, dict):
                continue
            for k in ("calls", "ok", "failed", "last_used", "last_error", "cooldown_until", "strikes"):
                if k in st:
                    _stats[name][k] = st[k]
        saved_records = data.get("records") or []
        if isinstance(saved_records, list):
            for rec in saved_records[-_RECORDS_MAX:]:
                if isinstance(rec, dict):
                    _records.append(rec)
    except Exception as e:
        ColorPrint.yellow(f"[ai_gateway] could not load usage file: {e}")


def _save_stats() -> None:
    """Persist usage counters + recent records to local config."""
    try:
        APP_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        state = _gateway_state()
        stats = state['stats']
        payload = {
            "stats": {name: dict(stats[name]) for name in PROVIDER_ORDER},
            "records": list(state['records']),
        }
        _USAGE_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except Exception as e:
        ColorPrint.yellow(f"[ai_gateway] could not save usage file: {e}")


# Restore persisted counters exactly once, at first import of this leaf (every
# other ai_gateway_* module imports from here, so this runs before any gateway
# call mutates state).
_load_stats()
THREAD_BUS.signal(_GATEWAY_STATE_SIGNAL, {
    'stats': _stats,
    'records': tuple(_records[-_RECORDS_MAX:]),
})


def _gateway_state() -> Dict[str, Any]:
    """Return the current THREAD_BUS gateway snapshot."""
    return THREAD_BUS.get_signal(_GATEWAY_STATE_SIGNAL, {}) or {}


def _publish_gateway_state(
    stats: Dict[str, Dict[str, Any]],
    records,
) -> None:
    """Publish a complete gateway state snapshot."""
    THREAD_BUS.signal(_GATEWAY_STATE_SIGNAL, {
        'stats': stats,
        'records': tuple(records)[-_RECORDS_MAX:],
    })


def get_provider_stats(provider: str) -> Dict[str, Any]:
    """Return a detached provider statistics snapshot."""
    stats = _gateway_state().get('stats', {})
    return dict(stats.get(provider, {}))


def get_recent_records() -> list:
    """Return recent gateway records in storage order."""
    return list(_gateway_state().get('records', ()))


def _is_quota_error(error: Optional[str]) -> bool:
    e = (error or "").lower()
    return any(mark in e for mark in _QUOTA_ERROR_MARKS)


def _is_net_timeout_error(error: Optional[str]) -> bool:
    e = (error or "").lower()
    return any(mark in e for mark in _NET_ERROR_MARKS)


def _is_hard_disable_error(error: Optional[str]) -> bool:
    """A NON-retryable provider error (paid-only model, disabled/banned account,
    auth failure) - cool the provider LONG and skip it rather than retry on every
    task. Distinct from a transient 429 quota error (cooled briefly)."""
    e = (error or "").lower()
    return any(mark in e for mark in _HARD_DISABLE_MARKS)


def _rate_caps(provider: str, model: Optional[str] = None) -> Tuple[Optional[int], Optional[int]]:
    """(rpm, rpd) PER-KEY budget from the provider's free-tier limit spec (each
    key = its own account/quota). (None, None) when unenforced (paid/unlisted)."""
    try:
        spec = resolve_limit(provider, model)
    except Exception:  # noqa: BLE001 - never let rate lookup break a call
        return None, None
    if not spec:
        return None, None
    return getattr(spec, "rpm", None), getattr(spec, "rpd", None)


def _apply_failure_cooldown(
    stats: Dict[str, Dict[str, Any]],
    provider: str,
    error: Optional[str],
) -> None:
    """Pause a provider after quota/auth/unreachable failures."""
    st = stats[provider]
    st["failed"] += 1
    st["last_error"] = error
    if _is_quota_error(error):
        st["strikes"] += 1
        cooldown = min(_COOLDOWN_BASE_S * (2 ** (st["strikes"] - 1)), _COOLDOWN_MAX_S)
        st["cooldown_until"] = time.time() + cooldown
        ColorPrint.yellow(
            f"[ai_gateway] {provider} rate/quota limited - cooling down {cooldown:.0f}s")
    elif _is_hard_disable_error(error):
        st["strikes"] += 1
        st["cooldown_until"] = time.time() + _IMG_DISABLED_COOLDOWN_S
        ColorPrint.yellow(
            f"[ai_gateway] {provider} disabled ({(error or '')[:80]}) - "
            f"cooling down {int(_IMG_DISABLED_COOLDOWN_S)}s")
    elif _is_net_timeout_error(error):
        st["strikes"] += 1
        st["cooldown_until"] = time.time() + _IMG_UNREACHABLE_COOLDOWN_S
        ColorPrint.yellow(
            f"[ai_gateway] {provider} unreachable - cooling down {int(_IMG_UNREACHABLE_COOLDOWN_S)}s")


def _on_result(provider: str, ok: bool, error: Optional[str]) -> None:
    state = _gateway_state()
    stats = {
        name: dict(values)
        for name, values in state.get('stats', {}).items()
    }
    st = stats[provider]
    st["calls"] += 1
    st["last_used"] = time.time()
    if ok:
        st["ok"] += 1
        st["strikes"] = 0
        st["last_error"] = None
    else:
        _apply_failure_cooldown(stats, provider, error)
    _publish_gateway_state(stats, state.get('records', ()))
    _save_stats()


def _on_probe_result(provider: str, ok: bool, error: Optional[str]) -> None:
    """Record a live probe outcome and pause providers that cannot be used."""
    if ok:
        return
    state = _gateway_state()
    stats = {
        name: dict(values)
        for name, values in state.get('stats', {}).items()
    }
    _apply_failure_cooldown(stats, provider, error)
    _publish_gateway_state(stats, state.get('records', ()))
    _save_stats()


def _in_cooldown(provider: str) -> bool:
    stats = _gateway_state().get('stats', {})
    return time.time() < stats[provider]["cooldown_until"]


def clear_expired_cooldowns() -> Dict[str, Any]:
    """
    Reset the 429/quota cooldown for providers whose cooldown window has elapsed,
    so dispatch and the UI reflect the recovered provider WITHOUT waiting for the
    next call. Tick-driven (injected into pyheartbeat); complements
    ai_rate_limits.prune_expired() - together they auto-reset the AI budget by the
    AI's own rate windows. Returns { cleared: [provider, ...] }.
    """
    now = time.time()
    cleared = []
    state = _gateway_state()
    stats = {
        name: dict(values)
        for name, values in state.get('stats', {}).items()
    }
    for name, st in stats.items():
        if st.get("cooldown_until", 0.0) and now >= st["cooldown_until"]:
            st["cooldown_until"] = 0.0
            st["strikes"] = 0
            cleared.append(name)
    if cleared:
        _publish_gateway_state(stats, state.get('records', ()))
        _save_stats()
        ColorPrint.blue(f"[ai_gateway] cooldown cleared (recovered): {', '.join(cleared)}")
    return {"cleared": cleared}


def _record(kind: str, source: str, result: Dict[str, Any]) -> None:
    state = _gateway_state()
    records = list(state.get('records', ()))
    records.append({
        "ts": time.time(),
        "kind": kind,
        "source": source or "",
        "provider": result.get("provider", ""),
        "model": result.get("model", ""),
        "success": bool(result.get("success")),
        "latency_ms": result.get("latency_ms"),
        "error": result.get("error"),
    })
    _publish_gateway_state(state.get('stats', {}), records)
    _save_stats()
    # Mirror vision + image calls into the shared cross-runtime usage log so the
    # global usage history / per-provider rollup counts them and the CLI prints a
    # line (text is already logged per-attempt in chat_once; image ALSO keeps its
    # bytes in ai_image_history).
    if kind in ("vision", "image"):
        record_usage(kind, result.get("provider", ""), result.get("model", ""),
                     bool(result.get("success")), result.get("latency_ms"), source,
                     result.get("error"))
