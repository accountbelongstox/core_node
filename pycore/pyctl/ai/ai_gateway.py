#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified AI gateway — the SINGLE AI exit for pycore.

Integrates ALL providers (openrouter / gemini / deepseek / openai=ChatGPT /
anthropic=Claude — registry in ai_keys.PROVIDERS) behind three calls:

    generate_text(prompt|messages, source=...)   -> unified contract
    describe_image(image_path, prompt, source=...) -> unified contract
    generate_image(prompt, size=..., source=...)  -> unified IMAGE contract
                   (image-capable providers only — registry ``image`` flag)

Smart dispatch (per call):
  1. Tier order: free (openrouter :free models, gemini free tier) →
     balance (deepseek prepaid) → paid (openai, anthropic). ``provider`` pins
     the first candidate; prompts are passed through UNCHANGED.
  2. Skip providers on cooldown. A rate-limit/quota failure (429,
     RESOURCE_EXHAUSTED, insufficient quota/balance…) puts the provider on an
     exponential cooldown (60s → 120s → … capped at 30 min) instead of being
     retried immediately; any other failure falls through to the next provider.
  3. Models are probed, never hardcoded (catalogs are volatile).

Quota / tier facts (checked against provider docs, 2026-06):
  - openrouter: GET /api/v1/key -> {usage, limit, is_free_tier, rate_limit};
    :free models are 20 req/min and 50/day (<10 credits) or 1000/day.
  - deepseek:   GET /user/balance -> {is_available, balance_infos[]}.
  - gemini:     free tier has per-model RPM/RPD limits but NO quota API ->
    cooldown on 429 only.
  - openai / anthropic: no public quota endpoint for normal API keys ->
    cooldown on 429 / insufficient_quota.

Every call is recorded (ring buffer + per-provider counters) so the UI can show
WHICH AI handled each task, its latency, and current quota/cooldown state:
gateway_status() feeds GET /api/local/ai/gateway.
"""

import base64
import hashlib
import hmac
import json
import re
import threading
import time
from collections import deque
from datetime import datetime, timezone
from email.utils import formatdate
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.ai_cluster.gemini.gemini_client import GeminiClient
from pycore.pyctl.ai.ai_keys import (
    PROVIDERS, PROVIDER_ORDER, first_secret, image_first_secret,
    image_model, limits_note, base_url,
    active_secret, active_image_secret, all_image_secrets, key_count,
    mark_text_key_cooldown, mark_image_key_cooldown, record_image_key,
    record_text_key, text_key_rate_ok, image_key_rate_ok, image_ready_now,
    key_status, image_key_status, extra_secret, has_image_key, is_image_only,
)
from pycore.pyctl.ai.ai_rate_limits import resolve_limit
from pycore.pyctl.ai.ai_probe import probe_all, _sort_key
from pycore.pyctl.ai.ai_chat import chat_once

# Optional: google-auth for Vertex AI service-account OAuth (RS256 JWT -> token).
try:
    from google.oauth2 import service_account as _gcp_service_account
    from google.auth.transport.requests import Request as _GcpAuthRequest
    _GCP_AUTH_AVAILABLE = True
except Exception:  # noqa: BLE001 — optional dep; Vertex helper guards on this flag
    _gcp_service_account = None
    _GcpAuthRequest = None
    _GCP_AUTH_AVAILABLE = False
from pycore.pyctl.ai.ai_usage_log import record_usage
from pycore.pyctl.ai.ai_image_history import record_image as _record_image_history

_GEMINI_VISION_MODEL = "gemini-2.5-flash"

# Dispatch tier order: free first, then prepaid balance, then post-paid.
_TIER_ORDER = ("free", "balance", "paid")

# Probe/quota caches — monitors may call the gateway every few seconds; never
# hit provider /models, /key or /balance endpoints that often.
_PROBE_TTL_S = 600.0
_QUOTA_TTL_S = 600.0

_COOLDOWN_BASE_S = 60.0
_COOLDOWN_MAX_S = 1800.0
_RECORDS_MAX = 100
_USAGE_FILE = APP_CONFIG_DIR / "ai_gateway_usage.json"

_lock = threading.Lock()
_probe_cache: Dict[str, Any] = {"ts": 0.0, "providers": []}
_quota_cache: Dict[str, Dict[str, Any]] = {}  # provider -> {ts, quota}
_vision_model_cache: Dict[str, Any] = {"ts": 0.0, "model": None}

# Per-provider runtime stats: which AI worked, how often, and its cooldown.
_stats: Dict[str, Dict[str, Any]] = {
    name: {"calls": 0, "ok": 0, "failed": 0, "last_used": None,
           "last_error": None, "cooldown_until": 0.0, "strikes": 0}
    for name in PROVIDER_ORDER
}
# Recent task records (newest first when exported).
_records: deque = deque(maxlen=_RECORDS_MAX)


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
        with _lock:
            payload = {
                "stats": {n: dict(_stats[n]) for n in PROVIDER_ORDER},
                "records": list(_records),
            }
        _USAGE_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except Exception as e:
        ColorPrint.yellow(f"[ai_gateway] could not save usage file: {e}")


_load_stats()

# Error fragments that mean "rate limit / quota" -> cooldown, not plain failure.
_QUOTA_ERROR_MARKS = (
    "429", "rate limit", "rate_limit", "ratelimit", "resource_exhausted",
    "quota", "insufficient", "overloaded", "402",
)


# --------------------------------------------------------------------------- #
# Probe + quota                                                                #
# --------------------------------------------------------------------------- #
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


# --------------------------------------------------------------------------- #
# Cooldown + stats + records                                                   #
# --------------------------------------------------------------------------- #
def _is_quota_error(error: Optional[str]) -> bool:
    e = (error or "").lower()
    return any(mark in e for mark in _QUOTA_ERROR_MARKS)


def _rate_caps(provider: str, model: Optional[str] = None) -> Tuple[Optional[int], Optional[int]]:
    """(rpm, rpd) PER-KEY budget from the provider's free-tier limit spec (each
    key = its own account/quota). (None, None) when unenforced (paid/unlisted)."""
    try:
        spec = resolve_limit(provider, model)
    except Exception:  # noqa: BLE001 — never let rate lookup break a call
        return None, None
    if not spec:
        return None, None
    return getattr(spec, "rpm", None), getattr(spec, "rpd", None)


# Image network/time bounds. (connect, read) so a BLOCKED host fails in ~8s
# instead of hanging; a hard per-provider thread bound covers SDK calls (e.g. the
# google-genai client) that don't honour a requests timeout — so no single
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
# cooldown — the host is likely down or geo-blocked, not just rate-limited).
_IMG_UNREACHABLE_COOLDOWN_S = 300.0

_NET_ERROR_MARKS = (
    "timed out", "timeout", "connection", "max retries", "unreachable",
    "failed to establish", "getaddrinfo", "connecterror", "read timed",
    "newconnectionerror", "name or service not known", "ssl",
)


def _is_net_timeout_error(error: Optional[str]) -> bool:
    e = (error or "").lower()
    return any(mark in e for mark in _NET_ERROR_MARKS)


def _run_image_helper(name: str, prompt: str, size: Optional[str],
                      use_model: Optional[str], out: Dict[str, Any],
                      secs: float = _IMG_BOUND_S) -> None:
    """Run one image dispatch helper with a HARD time bound (daemon thread) so a
    hanging provider (SDK with no timeout, blocked host) can't stall the pipeline.
    On overrun ``out['error']`` is set to a timeout and we move on; the orphaned
    thread dies with the process."""
    done = threading.Event()

    def _target() -> None:
        try:
            _IMAGE_DISPATCH[name](prompt, size, use_model, out)
        except Exception as e:  # noqa: BLE001 — surface SDK failures, try next provider
            out["error"] = str(e)
        finally:
            done.set()

    threading.Thread(target=_target, daemon=True, name=f"img-{name}").start()
    if not done.wait(secs):
        out["error"] = f"timed out (> {int(secs)}s, provider unreachable)"


def _on_result(provider: str, ok: bool, error: Optional[str]) -> None:
    with _lock:
        st = _stats[provider]
        st["calls"] += 1
        st["last_used"] = time.time()
        if ok:
            st["ok"] += 1
            st["strikes"] = 0
            st["last_error"] = None
        else:
            st["failed"] += 1
            st["last_error"] = error
            if _is_quota_error(error):
                st["strikes"] += 1
                cooldown = min(_COOLDOWN_BASE_S * (2 ** (st["strikes"] - 1)), _COOLDOWN_MAX_S)
                st["cooldown_until"] = time.time() + cooldown
                ColorPrint.yellow(
                    f"[ai_gateway] {provider} rate/quota limited — cooling down {cooldown:.0f}s")
    # _save_stats() re-acquires _lock, so it MUST run OUTSIDE the block above —
    # threading.Lock is non-reentrant; calling it inside would self-deadlock.
    _save_stats()


def _in_cooldown(provider: str) -> bool:
    with _lock:
        return time.time() < _stats[provider]["cooldown_until"]


def clear_expired_cooldowns() -> Dict[str, Any]:
    """
    Reset the 429/quota cooldown for providers whose cooldown window has elapsed,
    so dispatch and the UI reflect the recovered provider WITHOUT waiting for the
    next call. Tick-driven (injected into pyheartbeat); complements
    ai_rate_limits.prune_expired() — together they auto-reset the AI budget by the
    AI's own rate windows. Mutates under _lock, persists OUTSIDE it (_save_stats
    re-acquires _lock). Returns { cleared: [provider, ...] }.
    """
    now = time.time()
    cleared = []
    with _lock:
        for name, st in _stats.items():
            if st.get("cooldown_until", 0.0) and now >= st["cooldown_until"]:
                st["cooldown_until"] = 0.0
                st["strikes"] = 0
                cleared.append(name)
    if cleared:
        _save_stats()
        ColorPrint.blue(f"[ai_gateway] cooldown cleared (recovered): {', '.join(cleared)}")
    return {"cleared": cleared}


def _record(kind: str, source: str, result: Dict[str, Any]) -> None:
    with _lock:
        _records.append({
            "ts": time.time(),
            "kind": kind,
            "source": source or "",
            "provider": result.get("provider", ""),
            "model": result.get("model", ""),
            "success": bool(result.get("success")),
            "latency_ms": result.get("latency_ms"),
            "error": result.get("error"),
        })
    # OUTSIDE the lock: _save_stats() re-acquires _lock (non-reentrant) — calling
    # it inside the block above self-deadlocks (hung every generate_* call).
    _save_stats()
    # Mirror vision calls into the shared cross-runtime usage log (text is logged
    # in chat_once; image generations live in ai_image_history). Outside _lock so
    # the file write never holds the gateway lock.
    if kind == "vision":
        record_usage("vision", result.get("provider", ""), result.get("model", ""),
                     bool(result.get("success")), result.get("latency_ms"), source,
                     result.get("error"))


def gateway_status() -> Dict[str, Any]:
    """
    Full gateway snapshot for the UI: per-provider tier/quota/usage/cooldown and
    the recent task records (which AI handled what, newest first).
    """
    avail = {p["name"]: p for p in _all_probed_providers()}
    now = time.time()
    providers = []
    for name in PROVIDER_ORDER:
        meta = PROVIDERS[name]
        probed = avail.get(name) or {}
        with _lock:
            st = dict(_stats[name])
        cooldown_s = max(0.0, st["cooldown_until"] - now)
        providers.append({
            "name": name,
            "tier": meta["tier"],
            "limits": meta.get("limits", ""),
            "vision": meta["vision"],
            "image": meta.get("image", False),
            "image_model": meta.get("image_model", "") if meta.get("image") else "",
            "configured": bool(probed.get("configured")) or bool(first_secret(name)),
            "available": bool(probed.get("available")),
            "key_masked": probed.get("key_masked"),
            "models": probed.get("models") or [],
            "quota": get_quota(name),
            "calls": st["calls"],
            "ok": st["ok"],
            "failed": st["failed"],
            "last_error": st["last_error"],
            "cooldown_s": round(cooldown_s, 1),
            # Multi-key rotation: per-key slots (masked / cooldown / counters) so
            # the UI can show KEY1/KEY2… status and which key is active.
            "key_count": key_count(name),
            "keys": key_status(name),
            "image_keys": image_key_status(name) if meta.get("image") else [],
        })
    providers.sort(key=_sort_key)
    with _lock:
        records = list(reversed(_records))
    return {"success": True, "providers": providers, "records": records}


# --------------------------------------------------------------------------- #
# Dispatch                                                                     #
# --------------------------------------------------------------------------- #
def _candidates(prefer: Optional[str], capability: Optional[str] = None) -> List[Tuple[str, Optional[str]]]:
    """
    Ordered (provider, probed_model) fallback chain for one call.

    Tier order (free → balance → paid) within PROVIDER_ORDER; cooled-down
    providers are skipped; ``prefer`` is pinned to the front when usable.
    ``capability`` restricts to providers whose registry entry has that flag
    set ("vision" / "image"); None = any provider.
    """
    avail = {p["name"]: p for p in available_providers()}

    def usable(name: str) -> bool:
        if name not in avail or _in_cooldown(name):
            return False
        if capability:
            return bool(PROVIDERS[name].get(capability, False))
        # No capability filter = the TEXT/chat chain — exclude image-only providers.
        return not is_image_only(name)

    ordered: List[str] = []
    if prefer and usable(prefer):
        ordered.append(prefer)
    for tier in _TIER_ORDER:
        for name in PROVIDER_ORDER:
            if name in ordered or PROVIDERS[name]["tier"] != tier:
                continue
            if usable(name):
                ordered.append(name)
    return [(n, (avail[n].get("models") or [None])[0]) for n in ordered]


def _no_provider(provider: str = "") -> Dict[str, Any]:
    return {
        "success": False,
        "provider": provider,
        "model": "",
        "text": "",
        "latency_ms": None,
        "error": "No AI provider available (configure a key / wait out cooldowns)",
    }


def generate_text(
    prompt: Optional[str] = None,
    messages: Optional[List[Dict[str, Any]]] = None,
    model: Optional[str] = None,
    provider: Optional[str] = None,
    source: str = "",
) -> Dict[str, Any]:
    """
    Text generation through the unified exit (prompts pass through unchanged).

    Smart dispatch + cross-provider fallback; ``source`` labels the task in the
    gateway records so the UI can show which AI handled it.
    """
    msgs = messages or ([{"role": "user", "content": prompt}] if prompt else [])
    if not msgs:
        out = _no_provider(provider or "")
        out["error"] = "No prompt/messages provided"
        return out

    chain = _candidates(provider)
    if not chain:
        out = _no_provider(provider or "")
        _record("text", source, out)
        return out

    last: Dict[str, Any] = {}
    for i, (name, probed_model) in enumerate(chain):
        use_model = model if (i == 0 and model) else probed_model
        # Multi-key rotation: try this provider's keys in turn — on a quota/429
        # (or local per-key rate budget) cool the current key and retry with the
        # NEXT key before falling through to the next provider (chat_once reads the
        # active key via first_secret). Each key has its OWN per-key rate counter.
        rpm, rpd = _rate_caps(name)
        n_keys = max(1, key_count(name))
        for attempt in range(n_keys):
            idx, _key = active_secret(name)
            if not text_key_rate_ok(name, idx, rpm, rpd):
                if attempt < n_keys - 1:
                    mark_text_key_cooldown(name, secs=30, error="per-key rate budget")
                    continue
                last = {"success": False, "provider": name, "model": "", "text": "",
                        "latency_ms": None, "error": "per-key rate budget reached (all keys)"}
                break
            last = chat_once(name, msgs, use_model, source=source)
            record_text_key(name, idx, bool(last.get("success")), last.get("error"))
            if last.get("success"):
                _on_result(name, True, None)
                _record("text", source, last)
                return last
            if _is_quota_error(last.get("error")) and attempt < n_keys - 1:
                mark_text_key_cooldown(name, error=last.get("error"))
                ColorPrint.yellow(f"[ai_gateway] {name} KEY{idx + 1} quota-limited — rotating key")
                continue
            break
        _on_result(name, bool(last.get("success")), last.get("error"))
        ColorPrint.yellow(
            f"[ai_gateway] {name} failed ({last.get('error')}), "
            f"{'falling back' if i + 1 < len(chain) else 'no providers left'}")
    _record("text", source, last)
    return last or _no_provider(provider or "")


# --------------------------------------------------------------------------- #
# Vision                                                                       #
# --------------------------------------------------------------------------- #
_DEFAULT_IMAGE_PROMPT = (
    "Provide a comprehensive summary of this image, describing the main "
    "elements, scene, and any notable details."
)


def _describe_with_gemini(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    key = first_secret("gemini")
    if not key:
        out["error"] = "No API key configured"
        return out
    client = GeminiClient(api_key=key, default_model=_GEMINI_VISION_MODEL)
    out["model"] = _GEMINI_VISION_MODEL
    if prompt:
        res = client.generate_with_images(prompt=prompt, image_paths=[image_path])
        text = res.get("text", "")
    else:
        # No-prompt path keeps the ORIGINAL screenshot prompt (summarize_image
        # detail_level="medium") byte-for-byte.
        res = client.summarize_image(image_path=image_path, detail_level="medium")
        text = res.get("summary", "")
    if res.get("success") and text:
        out["success"] = True
        out["text"] = text
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _openrouter_vision_model(key: str) -> Optional[str]:
    """Pick a live OpenRouter model that accepts image input (prefer free)."""
    with _lock:
        fresh = (time.time() - _vision_model_cache["ts"]) < _PROBE_TTL_S
        if fresh and _vision_model_cache["model"]:
            return _vision_model_cache["model"]
    try:
        requests = get_third_package_requests()
        resp = requests.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        vision = [
            m.get("id", "") for m in data
            if "image" in ((m.get("architecture") or {}).get("input_modalities") or [])
        ]
        model = next((m for m in vision if m.endswith(":free")), vision[0] if vision else None)
        with _lock:
            _vision_model_cache.update({"ts": time.time(), "model": model})
        return model
    except Exception as e:
        ColorPrint.yellow(f"[ai_gateway] OpenRouter vision-model scan failed: {e}")
        return None


def _image_data_url(image_path: str) -> str:
    suffix = Path(image_path).suffix.lstrip(".").lower() or "png"
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:image/{suffix};base64,{b64}"


def _describe_with_openrouter(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    from pycore.pyutils.ai_cluster.openrouter.openrouter_client import OpenRouterClient
    key = first_secret("openrouter")
    if not key:
        out["error"] = "No API key configured"
        return out
    model = _openrouter_vision_model(key)
    if not model:
        out["error"] = "No vision-capable OpenRouter model found"
        return out
    out["model"] = model
    content = [
        {"type": "text", "text": prompt or _DEFAULT_IMAGE_PROMPT},
        {"type": "image_url", "image_url": {"url": _image_data_url(image_path)}},
    ]
    client = OpenRouterClient(api_key=key)
    resp = client.chat_completion(messages=[{"role": "user", "content": content}], model=model)
    if isinstance(resp, dict) and resp.get("error"):
        out["error"] = str(resp["error"])
        return out
    message = (resp.get("choices") or [{}])[0].get("message", {}) if isinstance(resp, dict) else {}
    out["text"] = client._extract_message_content(message)
    out["success"] = bool(out["text"])
    if not out["success"]:
        out["error"] = "Empty response from provider"
    return out


def _describe_with_openai(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    requests = get_third_package_requests()
    key = first_secret("openai")
    if not key:
        out["error"] = "No API key configured"
        return out
    model = PROVIDERS["openai"]["default_model"]
    out["model"] = model
    content = [
        {"type": "text", "text": prompt or _DEFAULT_IMAGE_PROMPT},
        {"type": "image_url", "image_url": {"url": _image_data_url(image_path)}},
    ]
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": model, "messages": [{"role": "user", "content": content}]},
        timeout=90,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:300]}"
        return out
    data = resp.json()
    out["text"] = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    out["success"] = bool(out["text"])
    if not out["success"]:
        out["error"] = "Empty response from provider"
    return out


def _describe_with_anthropic(image_path: str, prompt: Optional[str], out: Dict[str, Any]) -> Dict[str, Any]:
    requests = get_third_package_requests()
    key = first_secret("anthropic")
    if not key:
        out["error"] = "No API key configured"
        return out
    model = PROVIDERS["anthropic"]["default_model"]
    out["model"] = model
    suffix = Path(image_path).suffix.lstrip(".").lower() or "png"
    media_type = f"image/{'jpeg' if suffix in ('jpg', 'jpeg') else suffix}"
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    body = {
        "model": model,
        "max_tokens": 1024,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": prompt or _DEFAULT_IMAGE_PROMPT},
            ],
        }],
    }
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                 "Content-Type": "application/json"},
        json=body,
        timeout=90,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:300]}"
        return out
    data = resp.json()
    out["text"] = "".join(
        b.get("text", "") for b in (data.get("content") or []) if b.get("type") == "text")
    out["success"] = bool(out["text"])
    if not out["success"]:
        out["error"] = "Empty response from provider"
    return out


_VISION_DISPATCH = {
    "gemini": _describe_with_gemini,
    "openrouter": _describe_with_openrouter,
    "openai": _describe_with_openai,
    "anthropic": _describe_with_anthropic,
}


def describe_image(
    image_path: str,
    prompt: Optional[str] = None,
    provider: Optional[str] = None,
    source: str = "",
) -> Dict[str, Any]:
    """
    Image -> text through the unified exit (the auto-subtitle screenshot path).

    Same smart dispatch as generate_text, restricted to vision-capable
    providers. ``source`` labels the task in the gateway records.
    """
    if not image_path or not Path(image_path).exists():
        out = _no_provider(provider or "")
        out["error"] = f"Image file not found: {image_path}"
        return out

    chain = [(n, m) for n, m in _candidates(provider, capability="vision") if n in _VISION_DISPATCH]
    if not chain:
        out = _no_provider(provider or "")
        _record("vision", source, out)
        return out

    last: Dict[str, Any] = {}
    for i, (name, _probed_model) in enumerate(chain):
        out = {"success": False, "provider": name, "model": "", "text": "",
               "latency_ms": None, "error": None}
        start = time.time()
        try:
            _VISION_DISPATCH[name](image_path, prompt, out)
        except Exception as e:  # noqa: BLE001 — surface SDK failures, try next provider
            out["error"] = str(e)
        out["latency_ms"] = round((time.time() - start) * 1000, 1)
        _on_result(name, bool(out["success"]), out.get("error"))
        if out["success"]:
            _record("vision", source, out)
            return out
        ColorPrint.yellow(
            f"[ai_gateway] vision {name} failed ({out.get('error')}), "
            f"{'falling back' if i + 1 < len(chain) else 'no providers left'}")
        last = out
    _record("vision", source, last)
    return last or _no_provider(provider or "")


# --------------------------------------------------------------------------- #
# Image generation                                                             #
# --------------------------------------------------------------------------- #
# Gemini image models size by aspect ratio ("1:1", "16:9"…), not pixels; any
# other ``size`` value is ignored and the model default applies.
_ASPECT_RATIO_RE = re.compile(r"^\d{1,2}:\d{1,2}$")


def _no_image_provider(provider: str = "") -> Dict[str, Any]:
    return {
        "success": False,
        "provider": provider,
        "model": "",
        "image_base64": "",
        "mime": "",
        "latency_ms": None,
        "error": "No image-capable AI provider available (configure a key / wait out cooldowns)",
    }


def _generate_image_with_gemini(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    key = image_first_secret("gemini")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("gemini")
    out["model"] = use_model
    aspect = size if (size and _ASPECT_RATIO_RE.match(size)) else None
    client = GeminiClient(api_key=key, default_model=use_model)
    res = client.generate_image(prompt=prompt, model=use_model, aspect_ratio=aspect)
    if res.get("success") and res.get("image_base64"):
        out["success"] = True
        out["image_base64"] = res["image_base64"]
        out["mime"] = res.get("mime_type") or "image/png"
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _orientation(aspect: Optional[str]) -> str:
    """Square / landscape / portrait from the gateway aspect shape ('W:H')."""
    if not aspect or not _ASPECT_RATIO_RE.match(aspect):
        return "square"
    w, h = aspect.split(":")
    try:
        wi, hi = int(w), int(h)
    except ValueError:
        return "square"
    if wi == hi:
        return "square"
    return "landscape" if wi > hi else "portrait"


# Per-provider pixel-size menus. Each image API accepts only a fixed set of
# sizes (and DashScope uses 'W*H', not 'W x H'); map the requested aspect to the
# provider's nearest supported size.
_IMAGE_SIZES = {
    "openai":    {"square": "1024x1024", "landscape": "1792x1024", "portrait": "1024x1792"},
    "zhipuai":   {"square": "1024x1024", "landscape": "1344x768",  "portrait": "768x1344"},
    "dashscope": {"square": "1024*1024", "landscape": "1280*720",  "portrait": "720*1280"},
    "stepfun":   {"square": "1024x1024", "landscape": "1280x800",  "portrait": "800x1280"},
    "qianfan":   {"square": "1024x1024", "landscape": "1024x768",  "portrait": "768x1024"},
    "siliconflow": {"square": "1024x1024", "landscape": "1280x960", "portrait": "960x1280"},
}

# Spark's tti body takes width/height as separate ints (allowed menu), not a
# size string — keep its own orientation map.
_SPARK_SIZES = {"square": (1024, 1024), "landscape": (1280, 720), "portrait": (720, 1280)}


def _provider_image_size(provider: str, aspect: Optional[str]) -> str:
    """Nearest provider-supported pixel size for the requested aspect."""
    return _IMAGE_SIZES[provider][_orientation(aspect)]


def _fetch_image_b64(url: str) -> Tuple[str, str]:
    """Download an image URL (providers that return a URL, not inline base64)
    and return (base64, mime). Returns ('', '') on any failure."""
    if not url:
        return "", ""
    requests = get_third_package_requests()
    resp = requests.get(url, timeout=_IMG_HTTP_TIMEOUT)
    if resp.status_code != 200 or not resp.content:
        return "", ""
    mime = (resp.headers.get("Content-Type") or "image/png").split(";")[0].strip() or "image/png"
    return base64.b64encode(resp.content).decode("ascii"), mime


def _generate_image_with_openai(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """OpenAI Images API backup (POST /v1/images/generations -> b64_json)."""
    key = image_first_secret("openai")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("openai") or "dall-e-3"
    out["model"] = use_model
    requests = get_third_package_requests()
    body: Dict[str, Any] = {"model": use_model, "prompt": prompt, "n": 1,
                            "size": _provider_image_size("openai", size)}
    # gpt-image-1 always returns b64_json and REJECTS response_format; only the
    # dall-e-* models accept (and need) it to return base64 instead of a URL.
    if use_model.startswith("dall-e"):
        body["response_format"] = "b64_json"
    # Honor a custom OpenAI-compatible base (OPENAI_BASE_URL) — many deployments
    # route "openai" through a proxy whose key is NOT valid on api.openai.com;
    # default to the real API otherwise.
    api = (get_secret_key_indexed("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    resp = requests.post(
        f"{api}/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json=body, timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    b64 = data[0].get("b64_json") if data else None
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


def _generate_image_with_openrouter(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """OpenRouter image backup — chat completions with modalities:['image','text'];
    the chosen image model returns an inline data-URI we decode to base64."""
    key = image_first_secret("openrouter")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("openrouter") or "google/gemini-2.5-flash-image"
    out["model"] = use_model
    requests = get_third_package_requests()
    api = base_url("openrouter") or "https://openrouter.ai/api/v1"
    resp = requests.post(
        f"{api}/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model,
              "messages": [{"role": "user", "content": prompt}],
              "modalities": ["image", "text"]},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    msg = (((resp.json() or {}).get("choices") or [{}])[0]).get("message") or {}
    images = msg.get("images") or []
    url = (images[0].get("image_url") or {}).get("url", "") if images else ""
    if url.startswith("data:"):
        head, _, b64 = url.partition(",")
        if b64:
            out["success"] = True
            out["image_base64"] = b64
            out["mime"] = head[5:].split(";")[0] or "image/png"
            return out
    out["error"] = "Empty image response from provider"
    return out


def _generate_image_with_zhipuai(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Zhipu BigModel image backup — cogview-3-flash is FREE. Sync POST to
    /api/paas/v4/images/generations; the response carries an image URL."""
    key = image_first_secret("zhipuai")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("zhipuai") or "cogview-3-flash"
    out["model"] = use_model
    requests = get_third_package_requests()
    resp = requests.post(
        "https://open.bigmodel.cn/api/paas/v4/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model, "prompt": prompt,
              "size": _provider_image_size("zhipuai", size)},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    url = data[0].get("url") if data else ""
    b64, mime = _fetch_image_b64(url)
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = mime
    else:
        out["error"] = "Empty / unfetchable image response from provider"
    return out


def _generate_image_with_dashscope(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Alibaba DashScope Tongyi-Wanxiang image backup (free-trial quota). ASYNC:
    submit a synthesis task, then poll /tasks/{id} until SUCCEEDED for the URL."""
    key = image_first_secret("dashscope")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("dashscope") or "wanx2.1-t2i-turbo"
    out["model"] = use_model
    requests = get_third_package_requests()
    submit = requests.post(
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "X-DashScope-Async": "enable"},
        json={"model": use_model, "input": {"prompt": prompt},
              "parameters": {"size": _provider_image_size("dashscope", size), "n": 1}},
        timeout=30,
    )
    if submit.status_code != 200:
        out["error"] = f"HTTP {submit.status_code}: {submit.text[:200]}"
        return out
    task_id = ((submit.json() or {}).get("output") or {}).get("task_id")
    if not task_id:
        out["error"] = "no task_id returned"
        return out
    # Poll (capped) — DashScope text-to-image is async; this is a low-preference
    # backup so the bounded wait rarely runs.
    deadline = time.time() + 45
    while time.time() < deadline:
        time.sleep(3)
        poll = requests.get(
            f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}",
            headers={"Authorization": f"Bearer {key}"}, timeout=20)
        if poll.status_code != 200:
            continue
        output = (poll.json() or {}).get("output") or {}
        status = output.get("task_status")
        if status == "SUCCEEDED":
            results = output.get("results") or []
            b64, mime = _fetch_image_b64(results[0].get("url") if results else "")
            if b64:
                out["success"] = True
                out["image_base64"] = b64
                out["mime"] = mime
            else:
                out["error"] = "task succeeded but image url missing/unfetchable"
            return out
        if status == "FAILED":
            out["error"] = output.get("message") or "synthesis task failed"
            return out
    out["error"] = "image synthesis task timed out"
    return out


def _generate_image_with_stepfun(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """StepFun image backup (paid, OpenAI-compatible /images/generations)."""
    key = image_first_secret("stepfun")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("stepfun") or "step-1x-medium"
    out["model"] = use_model
    requests = get_third_package_requests()
    api = base_url("stepfun") or "https://api.stepfun.com/v1"
    resp = requests.post(
        f"{api}/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model, "prompt": prompt, "response_format": "b64_json",
              "size": _provider_image_size("stepfun", size)},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    entry = data[0] if data else {}
    b64 = entry.get("b64_json")
    if not b64 and entry.get("url"):
        b64, mime = _fetch_image_b64(entry["url"])
        if b64:
            out["success"] = True
            out["image_base64"] = b64
            out["mime"] = mime
            return out
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


def _generate_image_with_qianfan(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Baidu Qianfan ERNIE iRAG image backup (bearer, OpenAI-style
    /v2/images/generations; the response carries an image URL)."""
    key = image_first_secret("qianfan")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("qianfan") or "irag-1.0"
    out["model"] = use_model
    requests = get_third_package_requests()
    api = base_url("qianfan") or "https://qianfan.baidubce.com/v2"
    resp = requests.post(
        f"{api}/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model, "prompt": prompt,
              "size": _provider_image_size("qianfan", size)},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    b64, mime = _fetch_image_b64(data[0].get("url") if data else "")
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = mime
    else:
        out["error"] = "Empty / unfetchable image response from provider"
    return out


# iFlytek Spark text-to-image (tti) endpoint + HMAC host/date/request-line signer.
_SPARK_TTI_HOST = "spark-api.cn-huabei-1.xf-yun.com"
_SPARK_TTI_PATH = "/v2.1/tti"


def _spark_tti_signed_url(api_key: str, api_secret: str) -> str:
    """Build the query-param-signed Spark tti URL (iFlytek's standard
    host/date/request-line HMAC-SHA256 scheme)."""
    date = formatdate(timeval=None, localtime=False, usegmt=True)
    origin = f"host: {_SPARK_TTI_HOST}\ndate: {date}\nPOST {_SPARK_TTI_PATH} HTTP/1.1"
    signature = base64.b64encode(
        hmac.new(api_secret.encode(), origin.encode(), hashlib.sha256).digest()).decode()
    auth_origin = (f'api_key="{api_key}", algorithm="hmac-sha256", '
                   f'headers="host date request-line", signature="{signature}"')
    authorization = base64.b64encode(auth_origin.encode()).decode()
    qs = f"authorization={quote(authorization)}&date={quote(date)}&host={_SPARK_TTI_HOST}"
    return f"https://{_SPARK_TTI_HOST}{_SPARK_TTI_PATH}?{qs}"


def _generate_image_with_spark(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """iFlytek Spark image backup (free 5000-point quota). Uses the
    APP_ID/API_KEY/API_SECRET triple (NOT the chat api_password); base64 image is
    returned inline in payload.choices.text."""
    app_id = get_secret_key_indexed("SPARK_APP_ID")
    api_key = get_secret_key_indexed("SPARK_API_KEY")
    api_secret = get_secret_key_indexed("SPARK_API_SECRET")
    if not (app_id and api_key and api_secret):
        out["error"] = "Spark image needs SPARK_APP_ID / SPARK_API_KEY / SPARK_API_SECRET"
        return out
    out["model"] = model or image_model("spark") or "spark-tti-v2.1"
    width, height = _SPARK_SIZES[_orientation(size)]
    requests = get_third_package_requests()
    resp = requests.post(
        _spark_tti_signed_url(api_key, api_secret),
        json={"header": {"app_id": app_id},
              "parameter": {"chat": {"domain": "general", "width": width, "height": height}},
              "payload": {"message": {"text": [{"role": "user", "content": prompt}]}}},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    body = resp.json() or {}
    header = body.get("header") or {}
    if header.get("code", 0) != 0:
        out["error"] = f"spark code {header.get('code')}: {header.get('message')}"
        return out
    texts = ((body.get("payload") or {}).get("choices") or {}).get("text") or []
    b64 = texts[0].get("content") if texts else ""
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


def _generate_image_with_cloudflare(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Cloudflare Workers AI image backup (free neuron budget). SDXL returns raw
    PNG bytes from POST .../accounts/{id}/ai/run/{model}."""
    token = image_first_secret("cloudflare")
    account = extra_secret("cloudflare")  # CLOUDFLARE_ACCOUNT_ID
    if not token or not account:
        out["error"] = "Cloudflare needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID"
        return out
    use_model = model or image_model("cloudflare") or "@cf/stabilityai/stable-diffusion-xl-base-1.0"
    out["model"] = use_model
    requests = get_third_package_requests()
    resp = requests.post(
        f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{use_model}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"prompt": prompt}, timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    ctype = (resp.headers.get("Content-Type") or "").lower()
    if ctype.startswith("image/"):
        out["success"] = True
        out["image_base64"] = base64.b64encode(resp.content).decode("ascii")
        out["mime"] = ctype.split(";")[0]
        return out
    # Some Workers AI image models return JSON {result:{image:<b64>}} instead.
    try:
        b64 = ((resp.json() or {}).get("result") or {}).get("image")
    except Exception:  # noqa: BLE001
        b64 = None
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = "image/png"
    else:
        out["error"] = "Empty / unknown response from provider"
    return out


def _generate_image_with_siliconflow(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """SiliconFlow image backup (aggregates Kolors/FLUX/SDXL; very low cost).
    OpenAI-style /images/generations returning an image URL."""
    key = image_first_secret("siliconflow")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("siliconflow") or "Kwai-Kolors/Kolors"
    out["model"] = use_model
    requests = get_third_package_requests()
    api = base_url("siliconflow") or "https://api.siliconflow.cn/v1"
    resp = requests.post(
        f"{api}/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model, "prompt": prompt,
              "image_size": _provider_image_size("siliconflow", size)},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = resp.json() or {}
    imgs = data.get("images") or data.get("data") or []
    url = imgs[0].get("url", "") if imgs and isinstance(imgs[0], dict) else ""
    b64, mime = _fetch_image_b64(url)
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = mime
    else:
        out["error"] = "Empty / unfetchable image response from provider"
    return out


def _generate_image_with_pollinations(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Pollinations.ai — FREE, NO API KEY. GET the prompt URL -> image bytes."""
    use_model = model or image_model("pollinations") or "flux"
    out["model"] = use_model
    requests = get_third_package_requests()
    width, height = _SPARK_SIZES[_orientation(size)]
    url = (f"https://image.pollinations.ai/prompt/{quote(prompt[:1500])}"
           f"?width={width}&height={height}&model={use_model}&nologo=true")
    resp = requests.get(url, timeout=_IMG_HTTP_TIMEOUT)
    if resp.status_code != 200 or not resp.content:
        out["error"] = f"HTTP {resp.status_code}"
        return out
    ctype = (resp.headers.get("Content-Type") or "image/jpeg").split(";")[0].strip()
    if not ctype.startswith("image/"):
        out["error"] = f"non-image response ({ctype})"
        return out
    out["success"] = True
    out["image_base64"] = base64.b64encode(resp.content).decode("ascii")
    out["mime"] = ctype
    return out


def _generate_image_with_imagen(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Google Imagen 4 via the Gemini API key (generativelanguage :predict).

    Imagen 3 (imagen-3.0-generate-002) was SHUT DOWN on the Gemini API (returns
    HTTP 404 "not found for API version v1beta / not supported for predict"), so
    the default is the current GA model imagen-4.0-generate-001. Other valid IDs:
    imagen-4.0-fast-generate-001, imagen-4.0-ultra-generate-001.
    """
    key = image_first_secret("imagen")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("imagen") or "imagen-4.0-generate-001"
    out["model"] = use_model
    requests = get_third_package_requests()
    aspect = size if (size and _ASPECT_RATIO_RE.match(size)) else "1:1"
    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{use_model}:predict?key={key}",
        headers={"Content-Type": "application/json"},
        json={"instances": [{"prompt": prompt}],
              "parameters": {"sampleCount": 1, "aspectRatio": aspect}},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    preds = (resp.json() or {}).get("predictions") or []
    b64 = preds[0].get("bytesBase64Encoded") if preds else None
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = preds[0].get("mimeType") or "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


def _generate_image_with_azure(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Azure OpenAI DALL-E 3 (api-key header; endpoint + deployment from secrets)."""
    key = image_first_secret("azure")
    endpoint = (extra_secret("azure", "AZURE_OPENAI_ENDPOINT") or "").rstrip("/")
    if not key or not endpoint:
        out["error"] = "Azure needs AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT"
        return out
    deployment = (extra_secret("azure", "AZURE_OPENAI_IMAGE_DEPLOYMENT")
                  or model or image_model("azure") or "dall-e-3")
    out["model"] = deployment
    requests = get_third_package_requests()
    resp = requests.post(
        f"{endpoint}/openai/deployments/{deployment}/images/generations?api-version=2024-02-01",
        headers={"api-key": key, "Content-Type": "application/json"},
        json={"prompt": prompt, "n": 1, "size": _provider_image_size("openai", size)},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    entry = data[0] if data else {}
    b64 = entry.get("b64_json")
    if not b64 and entry.get("url"):
        b64, mime = _fetch_image_b64(entry["url"])
        if b64:
            out["success"] = True
            out["image_base64"] = b64
            out["mime"] = mime
            return out
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


def _generate_image_with_volcano(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """ByteDance Doubao Seedream via Volcano Ark (OpenAI-style /images/generations)."""
    key = image_first_secret("volcano")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("volcano") or "doubao-seedream-3-0-t2i-250415"
    out["model"] = use_model
    requests = get_third_package_requests()
    api = base_url("volcano") or "https://ark.cn-beijing.volces.com/api/v3"
    resp = requests.post(
        f"{api}/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model, "prompt": prompt,
              "size": _provider_image_size("openai", size), "response_format": "url"},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    entry = data[0] if data else {}
    if entry.get("b64_json"):
        out["success"] = True
        out["image_base64"] = entry["b64_json"]
        out["mime"] = "image/png"
        return out
    b64, mime = _fetch_image_b64(entry.get("url", ""))
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = mime
    else:
        out["error"] = "Empty / unfetchable image response from provider"
    return out


def _aws_sigv4_headers(access_key: str, secret_key: str, region: str, service: str,
                       host: str, path: str, body: bytes,
                       amz_date: str, date_stamp: str) -> Dict[str, str]:
    """Minimal AWS SigV4 signer (stdlib only) for Bedrock — no boto3 dependency."""
    payload_hash = hashlib.sha256(body).hexdigest()
    canonical_headers = (f"content-type:application/json\nhost:{host}\n"
                         f"x-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n")
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"
    canonical_request = f"POST\n{path}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    algorithm = "AWS4-HMAC-SHA256"
    scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string_to_sign = (f"{algorithm}\n{amz_date}\n{scope}\n"
                      f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}")

    def _sign(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    k_date = _sign(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, service)
    k_signing = _sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    authorization = (f"{algorithm} Credential={access_key}/{scope}, "
                     f"SignedHeaders={signed_headers}, Signature={signature}")
    return {"Content-Type": "application/json", "X-Amz-Date": amz_date,
            "X-Amz-Content-Sha256": payload_hash, "Authorization": authorization}


def _generate_image_with_bedrock(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """AWS Bedrock Titan Image Generator (SigV4-signed invoke)."""
    access_key = image_first_secret("bedrock")  # AWS_ACCESS_KEY_ID
    secret_key = extra_secret("bedrock", "AWS_SECRET_ACCESS_KEY")
    if not access_key or not secret_key:
        out["error"] = "Bedrock needs AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY"
        return out
    region = extra_secret("bedrock", "AWS_REGION") or "us-east-1"
    use_model = model or image_model("bedrock") or "amazon.titan-image-generator-v1"
    out["model"] = use_model
    width, height = _SPARK_SIZES[_orientation(size)]
    body = json.dumps({
        "taskType": "TEXT_IMAGE",
        "textToImageParams": {"text": prompt[:512]},
        "imageGenerationConfig": {"numberOfImages": 1, "width": width, "height": height},
    }).encode("utf-8")
    host = f"bedrock-runtime.{region}.amazonaws.com"
    path = f"/model/{quote(use_model, safe='')}/invoke"
    now = datetime.now(timezone.utc)
    headers = _aws_sigv4_headers(
        access_key, secret_key, region, "bedrock", host, path, body,
        now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d"))
    requests = get_third_package_requests()
    resp = requests.post(f"https://{host}{path}", headers=headers, data=body, timeout=_IMG_HTTP_TIMEOUT)
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    payload = resp.json() or {}
    images = payload.get("images") or []
    if images:
        out["success"] = True
        out["image_base64"] = images[0]
        out["mime"] = "image/png"
    else:
        out["error"] = payload.get("error") or "Empty response from provider"
    return out


# Vertex OAuth access-token cache (keyed by SA client_email; tokens last ~1h).
_vertex_token_cache: Dict[str, Dict[str, Any]] = {}


def _vertex_access_token(sa_json_str: str) -> Tuple[Optional[str], Optional[str]]:
    """Service-account JSON -> short-lived OAuth access token (cached). Returns
    (token, None) or (None, error)."""
    if not _GCP_AUTH_AVAILABLE:
        return None, "google-auth not installed (pip install google-auth)"
    try:
        info = json.loads(sa_json_str)
    except Exception:  # noqa: BLE001
        return None, "invalid service-account JSON"
    cache_key = f"{info.get('client_email', '')}:{info.get('private_key_id', '')}"
    now = time.time()
    cached = _vertex_token_cache.get(cache_key)
    if cached and cached["exp"] - 60 > now:
        return cached["token"], None
    try:
        creds = _gcp_service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(_GcpAuthRequest())
    except Exception as e:  # noqa: BLE001
        return None, f"OAuth refresh failed: {e}"
    _vertex_token_cache[cache_key] = {"token": creds.token, "exp": now + 3000}
    return creds.token, None


def _generate_image_with_vertex(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Google Vertex AI Imagen via SERVICE-ACCOUNT OAuth (true Vertex endpoint)."""
    sa_json = image_first_secret("vertex")
    project = extra_secret("vertex", "VERTEX_PROJECT_ID")
    if not sa_json or not project:
        out["error"] = "Vertex needs GOOGLE_VERTEX_SA_JSON + VERTEX_PROJECT_ID"
        return out
    region = extra_secret("vertex", "VERTEX_REGION") or "us-central1"
    use_model = model or image_model("vertex") or "imagen-3.0-generate-002"
    out["model"] = use_model
    token, err = _vertex_access_token(sa_json)
    if not token:
        out["error"] = err or "could not obtain access token"
        return out
    requests = get_third_package_requests()
    aspect = size if (size and _ASPECT_RATIO_RE.match(size)) else "1:1"
    url = (f"https://{region}-aiplatform.googleapis.com/v1/projects/{project}"
           f"/locations/{region}/publishers/google/models/{use_model}:predict")
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"instances": [{"prompt": prompt}],
              "parameters": {"sampleCount": 1, "aspectRatio": aspect}},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    preds = (resp.json() or {}).get("predictions") or []
    b64 = preds[0].get("bytesBase64Encoded") if preds else None
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = preds[0].get("mimeType") or "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


# Image-capable provider dispatch (each helper self-checks its key, so a keyless
# provider falls through cheaply with no network call).
_IMAGE_DISPATCH = {
    "gemini": _generate_image_with_gemini,
    "zhipuai": _generate_image_with_zhipuai,
    "dashscope": _generate_image_with_dashscope,
    "qianfan": _generate_image_with_qianfan,
    "cloudflare": _generate_image_with_cloudflare,
    "siliconflow": _generate_image_with_siliconflow,
    "volcano": _generate_image_with_volcano,
    "spark": _generate_image_with_spark,
    "pollinations": _generate_image_with_pollinations,
    "openrouter": _generate_image_with_openrouter,
    "openai": _generate_image_with_openai,
    "imagen": _generate_image_with_imagen,
    "azure": _generate_image_with_azure,
    "stepfun": _generate_image_with_stepfun,
    "bedrock": _generate_image_with_bedrock,
    "vertex": _generate_image_with_vertex,
}

# generate_image() preference: genuinely-FREE image backends first (gemini flash
# image, zhipu cogview-3-flash, dashscope wanx free-trial, baidu iRAG, iFlytek
# Spark), then metered/paid ones. Lower rank = tried first; unknown sort last.
# Genuinely-FREE image backends FIRST. Google has NO free image model as of 2026:
# gemini-2.5-flash-image / Imagen 4 are PAID-only and the old free
# gemini-2.0-flash image preview was shut down 2026-06-01 (verified via
# ai.google.dev/gemini-api/docs/pricing). So the paid Google routes (gemini image,
# imagen, vertex) — plus openai/azure/stepfun/bedrock — sink BELOW the free ones;
# keyless Pollinations is the guaranteed free fallback. This makes "free-first"
# actually hold instead of burning the first slot on a gemini 429 every cycle.
_IMAGE_PREFERENCE = {
    "zhipuai": 0, "dashscope": 1, "qianfan": 2, "cloudflare": 3,
    "siliconflow": 4,
    "pollinations": 5,  # free + NO key -> reliable guaranteed fallback
    "gemini": 6, "openrouter": 7, "volcano": 8, "spark": 9,
    "imagen": 10, "azure": 11, "openai": 12, "stepfun": 13,
    "bedrock": 14, "vertex": 15,
}


def generate_image(
    prompt: str,
    size: Optional[str] = None,
    model: Optional[str] = None,
    source: str = "image",
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Text -> image through the unified exit.

    Free-first smart dispatch across image-capable providers (registry ``image``
    flag + a usable/keyless key), with per-key rotation and a hard per-provider
    time bound. ``model`` overrides the registry ``image_model`` for the first
    candidate; ``size`` is forwarded as an aspect ratio where supported.
    ``provider`` pins a SINGLE provider (the one-click "test this provider" path),
    ignoring cooldown so a manual test always runs. ``source`` labels the record.

    Returns { success, provider, model, image_base64, mime, latency_ms, error }.
    """
    if not (prompt or "").strip():
        out = _no_image_provider()
        out["error"] = "No prompt provided"
        return out

    # Forced single provider (manual test): bypass the chain + cooldown skip.
    if provider:
        if provider not in _IMAGE_DISPATCH or not PROVIDERS.get(provider, {}).get("image"):
            out = _no_image_provider(provider)
            out["error"] = f"'{provider}' is not an image-capable provider"
            return out
        chain = [(provider, None)]
    else:
        # Image dispatch is decoupled from the live CHAT probe: a provider is an
        # image candidate purely on registry image-capability + a usable image key
        # (or keyless) that is NOT on cooldown — NOT on a successful /models probe.
        # This lets image-only / keyless providers work, makes image gen resilient
        # when the chat probe is cold, and SKIPS dead/blocked providers so they
        # don't stall every request. Free backends first via _IMAGE_PREFERENCE.
        chain = [(n, None) for n in PROVIDER_ORDER
                 if PROVIDERS.get(n, {}).get("image") and n in _IMAGE_DISPATCH
                 and has_image_key(n) and image_ready_now(n)]
        chain.sort(key=lambda nm: _IMAGE_PREFERENCE.get(nm[0], 99))
        if not chain:
            # Everything is cooling down (all providers recently failed/limited).
            # Retry the full set rather than reporting "no provider" — cooldowns
            # may be near expiry and one attempt beats a blank result.
            chain = [(n, None) for n in PROVIDER_ORDER
                     if PROVIDERS.get(n, {}).get("image") and n in _IMAGE_DISPATCH and has_image_key(n)]
            chain.sort(key=lambda nm: _IMAGE_PREFERENCE.get(nm[0], 99))
    if not chain:
        out = _no_image_provider()
        _record("image", source, out)
        return out

    last: Dict[str, Any] = {}
    deadline = time.time() + _IMG_TOTAL_BUDGET_S
    for i, (name, _probed_model) in enumerate(chain):
        if not provider and time.time() > deadline:
            ColorPrint.yellow(
                f"[ai_gateway] image: overall budget {int(_IMG_TOTAL_BUDGET_S)}s "
                f"exceeded — stopping (dead providers cooled; next call will be fast)")
            break
        use_model = model if (i == 0 and model) else None
        # Multi-key rotation per provider (separate ``{provider}#image`` budget):
        # the image helper reads the active image key via image_first_secret, so
        # cooling the current key rotates to the next one on a quota/429.
        rpm, rpd = _rate_caps(name)
        n_keys = max(1, len(all_image_secrets(name)))
        out: Dict[str, Any] = {}
        for attempt in range(n_keys):
            idx, _key = active_image_secret(name)
            # Per-key image rate budget (own minute/day window); rotate when over.
            if not image_key_rate_ok(name, idx, rpm, rpd):
                if attempt < n_keys - 1:
                    mark_image_key_cooldown(name, idx, secs=30, error="per-key rate budget")
                    continue
                out = {"success": False, "provider": name, "model": "", "image_base64": "",
                       "mime": "", "latency_ms": None,
                       "error": "per-key rate budget reached (all keys)"}
                break
            out = {"success": False, "provider": name, "model": "", "image_base64": "",
                   "mime": "", "latency_ms": None, "error": None}
            start = time.time()
            # HARD time bound: a hanging/blocked provider can't stall the request.
            _run_image_helper(name, prompt, size, use_model, out)
            out["latency_ms"] = round((time.time() - start) * 1000, 1)
            record_image_key(name, idx, bool(out["success"]), out.get("error"))
            if out["success"]:
                # Image never provider-cools (error=None) so a text-quota provider
                # cooldown can't block image and vice-versa — isolation is per key.
                _on_result(name, True, None)
                _record("image", source, out)
                # Record to the shared cross-runtime image history HERE (the core),
                # not at the HTTP router, so EVERY image — on-demand, gateway-
                # internal, and assist-claimed COVERS — lands in history exactly
                # once with its `source` label (e.g. "assist-cover"). Best-effort.
                if out.get("image_base64"):
                    _record_image_history(
                        provider=out.get("provider", name),
                        model=out.get("model", ""),
                        prompt=prompt,
                        image_base64=out["image_base64"],
                        size=size or "",
                        mime=out.get("mime") or "image/png",
                        latency_ms=out.get("latency_ms"),
                        source=source,
                        origin="pycore",
                        ok=True,
                    )
                return out
            err = out.get("error")
            # Cool the key on a quota OR unreachable/timeout error so the dead
            # provider is SKIPPED next time (longer cooldown when unreachable).
            unreachable = _is_net_timeout_error(err)
            if _is_quota_error(err) or unreachable:
                mark_image_key_cooldown(
                    name, idx, secs=_IMG_UNREACHABLE_COOLDOWN_S if unreachable else None,
                    error=err)
                if attempt < n_keys - 1:
                    ColorPrint.yellow(
                        f"[ai_gateway] image {name} KEY{idx + 1} "
                        f"{'unreachable' if unreachable else 'quota-limited'} — rotating key")
                    continue
            break
        _on_result(name, False, None)  # record failure WITHOUT provider cooldown
        ColorPrint.yellow(
            f"[ai_gateway] image {name} failed ({out.get('error')}), "
            f"{'falling back' if i + 1 < len(chain) else 'no providers left'}")
        last = out
    _record("image", source, last)
    return last or _no_image_provider()


__all__ = [
    "generate_text",
    "describe_image",
    "generate_image",
    "available_providers",
    "get_quota",
    "gateway_status",
    "invalidate_probe_cache",
]
