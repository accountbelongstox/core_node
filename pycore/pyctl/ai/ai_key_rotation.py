#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Per-KEY rotation state for AI providers (multi-key redundancy).

A provider may have several keys (``<BASE>_1`` .. ``<BASE>_N``, see
secret_manager.get_all_secret_keys_indexed). This module tracks, per
(provider, key slot):
  - a cooldown_until (set when that key hits a rate-limit / quota / 429), so the
    next request rotates to the NEXT key instead of hammering the exhausted one;
  - live counters (used / ok / failed / last_used / last_error) for the UI.

``select_active(provider, keys)`` returns the first key NOT in cooldown (or, when
all are cooled, the one whose cooldown expires soonest) — this is what
``ai_keys.first_secret`` / ``image_first_secret`` now return, so EVERY call site
(text / vision / image / probe) rotates through keys with one central change.

State is in-process only (cooldowns are short-lived and a restart simply re-tries
every key). Thread-safe. No raw keys are stored — only a masked form for display.
All imports at file top (PYTHON_PYCORE.md §1.4); ColorPrint logging.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_local_data_dir
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

# Default cooldown applied to a key on a rate-limit / quota failure (seconds).
DEFAULT_KEY_COOLDOWN_S = 120.0

# Persistent per-key usage store (counts + per-day windows survive restarts).
# Lives beside the other shared AI state; pycore-local schema (Laravel keeps its
# own per-key store). cooldown_until / minute windows are transient (NOT saved).
_USAGE_FILE = get_local_data_dir() / ".ai_state" / "ai_key_usage.json"
_SAVE_THROTTLE_S = 5.0

_WORK_QUEUE = 'pyctl.ai.key_rotation.operations'
# provider -> { slot_index -> state dict }
_state: Dict[str, Dict[int, Dict[str, Any]]] = {}
_loaded = False
_last_save = 0.0


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _ensure_loaded() -> None:
    """Lazy-load persisted per-key counters into ``_state`` (once)."""
    global _loaded
    if _loaded:
        return
    _loaded = True
    try:
        if _USAGE_FILE.is_file():
            data = json.loads(_USAGE_FILE.read_text(encoding="utf-8"))
            for prov, slots in (data.get("providers") or {}).items():
                if not isinstance(slots, dict):
                    continue
                bucket = _state.setdefault(prov, {})
                for idx_str, st in slots.items():
                    try:
                        idx = int(idx_str)
                    except (TypeError, ValueError):
                        continue
                    s = _slot_raw(bucket, idx)
                    for k in ("used", "ok", "failed", "last_used", "last_error"):
                        if k in st:
                            s[k] = st[k]
                    if isinstance(st.get("day"), dict):
                        s["day"] = dict(st["day"])
    except Exception as e:  # noqa: BLE001 — a bad usage file must never crash callers
        ColorPrint.yellow(f"[ai_key_rotation] usage load failed ({e}); starting fresh")


def _save_persisted(force: bool = False) -> None:
    """Persist per-key counters + day windows (throttled, atomic)."""
    global _last_save
    now = time.time()
    if not force and (now - _last_save) < _SAVE_THROTTLE_S:
        return
    _last_save = now
    doc = {"saved_at": now, "providers": {}}
    for prov, slots in _state.items():
        doc["providers"][prov] = {
            str(idx): {"used": s["used"], "ok": s["ok"], "failed": s["failed"],
                       "last_used": s["last_used"], "last_error": s["last_error"],
                       "day": s.get("day", {})}
            for idx, s in slots.items()
        }
    try:
        _USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = _USAGE_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, _USAGE_FILE)
    except Exception:  # noqa: BLE001 — persistence is best-effort
        pass


def _slot_raw(prov: Dict[int, Dict[str, Any]], idx: int) -> Dict[str, Any]:
    return prov.setdefault(idx, {
        "index": idx, "masked": "", "cooldown_until": 0.0,
        "used": 0, "ok": 0, "failed": 0, "last_used": None, "last_error": None,
        "minute": [], "day": {},
    })


def _mask(key: str) -> str:
    """first4…last4 (never the whole key); short keys fully ellipsized."""
    key = (key or "").strip()
    if len(key) <= 8:
        return "…"
    return f"{key[:4]}…{key[-4:]}"


def _slot(provider: str, idx: int) -> Dict[str, Any]:
    _ensure_loaded()
    return _slot_raw(_state.setdefault(provider, {}), idx)


def _select_active(provider: str, keys: List[str]) -> Tuple[int, str]:
    """
    Pick the active key: the first slot NOT in cooldown; if every key is cooling
    down, the slot whose cooldown expires soonest (so we still try the best one).

    Returns (slot_index, key) — (-1, "") when ``keys`` is empty. ``slot_index`` is
    the position in ``keys`` (0-based; UI shows it as KEY{index+1}).
    """
    if not keys:
        return -1, ""
    now = time.monotonic()
    best_cooled: Optional[Tuple[float, int]] = None
    for idx, key in enumerate(keys):
        state = _slot(provider, idx)
        state["masked"] = _mask(key)
        cooldown_until = state["cooldown_until"]
        if cooldown_until <= now:
            return idx, key
        if best_cooled is None or cooldown_until < best_cooled[0]:
            best_cooled = (cooldown_until, idx)
    idx = best_cooled[1] if best_cooled else 0
    return idx, keys[idx]


def _mark_cooldown(
    provider: str,
    idx: int,
    secs: float = DEFAULT_KEY_COOLDOWN_S,
    error: Optional[str] = None,
) -> None:
    """Put one key slot on cooldown (after a rate-limit / quota failure)."""
    if idx < 0:
        return
    state = _slot(provider, idx)
    state["cooldown_until"] = time.monotonic() + max(1.0, secs)
    if error:
        state["last_error"] = str(error)[:160]
    ColorPrint.yellow(
        f"[ai_key_rotation] {provider} KEY{idx + 1} cooled {int(secs)}s "
        f"(rotating to next key)")


def _has_ready_key(provider: str, keys: List[str]) -> bool:
    """True if at least one key slot is NOT currently on cooldown — i.e. the
    provider is usable right now (used to SKIP dead/rate-limited providers)."""
    if not keys:
        return False
    now = time.monotonic()
    for idx in range(len(keys)):
        if _slot(provider, idx)["cooldown_until"] <= now:
            return True
    return False


def _reset_cooldown(provider: str, idx: Optional[int] = None) -> int:
    """Clear cooldown for one key slot (``idx``) or ALL slots of ``provider``.
    Returns how many slots were reset. Manual override for the UI."""
    reset_count = 0
    provider_state = _state.get(provider) or {}
    targets = [idx] if idx is not None else list(provider_state.keys())
    for slot_index in targets:
        state = provider_state.get(slot_index)
        if state and state.get("cooldown_until", 0.0) > 0.0:
            state["cooldown_until"] = 0.0
            reset_count += 1
    if reset_count:
        ColorPrint.green(f"[ai_key_rotation] reset cooldown for {provider} "
                         f"({'KEY' + str(idx + 1) if idx is not None else 'all slots'})")
    return reset_count


def _record(provider: str, idx: int, ok: bool, error: Optional[str] = None) -> None:
    """Count one attempt against a key slot: lifetime counters (UI stats) AND the
    per-key rate windows (minute sliding + per-day), then persist (throttled)."""
    if idx < 0:
        return
    state = _slot(provider, idx)
    now = time.time()
    state["used"] += 1
    state["last_used"] = now
    if ok:
        state["ok"] += 1
    else:
        state["failed"] += 1
        if error:
            state["last_error"] = str(error)[:160]
    state["minute"] = [
        timestamp
        for timestamp in state["minute"]
        if now - timestamp < 60.0
    ]
    state["minute"].append(now)
    day = state["day"]
    today = _today()
    day[today] = day.get(today, 0) + 1
    if len(day) > 5:
        for day_key in sorted(day)[:-3]:
            day.pop(day_key, None)
    _save_persisted()


def _rate_ok(
    provider: str,
    idx: int,
    rpm: Optional[int] = None,
    rpd: Optional[int] = None,
) -> bool:
    """True when the key slot is WITHIN its per-key budget (minute & day). ``rpm``
    / ``rpd`` None = no enforcement. Each key gets the FULL provider budget since
    distinct keys are distinct accounts/quotas."""
    if idx < 0:
        return True
    state = _slot(provider, idx)
    now = time.time()
    state["minute"] = [
        timestamp
        for timestamp in state["minute"]
        if now - timestamp < 60.0
    ]
    if rpm and len(state["minute"]) >= rpm:
        return False
    if rpd and state["day"].get(_today(), 0) >= rpd:
        return False
    return True


def _status(provider: str, keys: List[str]) -> List[Dict[str, Any]]:
    """Per-key status for ``provider`` (UI): index, masked, cooldown_s, counters.

    ``keys`` is the provider's current key list (so masked/labels stay aligned).
    """
    now = time.monotonic()
    wall = time.time()
    today = _today()
    out: List[Dict[str, Any]] = []
    for idx, key in enumerate(keys):
        state = _slot(provider, idx)
        state["masked"] = _mask(key)
        minute_used = len([
            timestamp
            for timestamp in state["minute"]
            if wall - timestamp < 60.0
        ])
        out.append({
            "index": idx,
            "label": f"KEY{idx + 1}",
            "masked": state["masked"],
            "cooldown_s": max(0, int(state["cooldown_until"] - now)),
            "used": state["used"],
            "ok": state["ok"],
            "failed": state["failed"],
            "minute_used": minute_used,
            "day_used": state["day"].get(today, 0),
            "last_used": state["last_used"],
            "last_error": state["last_error"],
        })
    return out


_WORKER = SerializedWorkerThread(_WORK_QUEUE, 'AIKeyRotationThread')
_WORKER.start()


def select_active(provider: str, keys: List[str]) -> Tuple[int, str]:
    return call_serialized(_WORK_QUEUE, _select_active, provider, keys)


def mark_cooldown(
    provider: str,
    idx: int,
    secs: float = DEFAULT_KEY_COOLDOWN_S,
    error: Optional[str] = None,
) -> None:
    call_serialized(
        _WORK_QUEUE,
        _mark_cooldown,
        provider,
        idx,
        secs,
        error,
    )


def has_ready_key(provider: str, keys: List[str]) -> bool:
    return bool(call_serialized(_WORK_QUEUE, _has_ready_key, provider, keys))


def reset_cooldown(provider: str, idx: Optional[int] = None) -> int:
    return int(call_serialized(_WORK_QUEUE, _reset_cooldown, provider, idx))


def record(
    provider: str,
    idx: int,
    ok: bool,
    error: Optional[str] = None,
) -> None:
    call_serialized(_WORK_QUEUE, _record, provider, idx, ok, error)


def rate_ok(
    provider: str,
    idx: int,
    rpm: Optional[int] = None,
    rpd: Optional[int] = None,
) -> bool:
    return bool(
        call_serialized(_WORK_QUEUE, _rate_ok, provider, idx, rpm, rpd)
    )


def status(provider: str, keys: List[str]) -> List[Dict[str, Any]]:
    return call_serialized(_WORK_QUEUE, _status, provider, keys)


__all__ = [
    "DEFAULT_KEY_COOLDOWN_S",
    "select_active", "mark_cooldown", "record", "rate_ok", "status",
    "has_ready_key", "reset_cooldown",
]
