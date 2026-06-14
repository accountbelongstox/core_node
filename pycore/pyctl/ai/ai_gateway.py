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
)
from pycore.pyctl.ai.ai_probe import probe_all, _sort_key
from pycore.pyctl.ai.ai_chat import chat_once
from pycore.pyctl.ai.ai_usage_log import record_usage

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
        return bool(PROVIDERS[name].get(capability, False)) if capability else True

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
        last = chat_once(name, msgs, use_model, source=source)
        _on_result(name, bool(last.get("success")), last.get("error"))
        if last.get("success"):
            _record("text", source, last)
            return last
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
    resp = requests.get(url, timeout=60)
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
        json=body, timeout=120,
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
        timeout=120,
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
        timeout=120,
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
    key = first_secret("dashscope")
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
    key = first_secret("stepfun")
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
        timeout=120,
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
    key = first_secret("qianfan")
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
        timeout=120,
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
        timeout=120,
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


# Image-capable provider dispatch (each helper self-checks its key, so a keyless
# provider falls through cheaply with no network call).
_IMAGE_DISPATCH = {
    "gemini": _generate_image_with_gemini,
    "zhipuai": _generate_image_with_zhipuai,
    "dashscope": _generate_image_with_dashscope,
    "qianfan": _generate_image_with_qianfan,
    "spark": _generate_image_with_spark,
    "openrouter": _generate_image_with_openrouter,
    "openai": _generate_image_with_openai,
    "stepfun": _generate_image_with_stepfun,
}

# generate_image() preference: genuinely-FREE image backends first (gemini flash
# image, zhipu cogview-3-flash, dashscope wanx free-trial, baidu iRAG, iFlytek
# Spark), then metered/paid ones. Lower rank = tried first; unknown sort last.
_IMAGE_PREFERENCE = {
    "gemini": 0, "zhipuai": 1, "dashscope": 2, "qianfan": 3, "spark": 4,
    "openrouter": 5, "openai": 6, "stepfun": 7,
}


def generate_image(
    prompt: str,
    size: Optional[str] = None,
    model: Optional[str] = None,
    source: str = "image",
) -> Dict[str, Any]:
    """
    Text -> image through the unified exit.

    Same smart dispatch as generate_text, restricted to image-capable providers
    (registry ``image`` flag — currently gemini only). ``model`` overrides the
    registry ``image_model`` for the first candidate; ``size`` is forwarded as
    an aspect ratio (e.g. "16:9") where the provider supports one, otherwise
    ignored. ``source`` labels the task in the gateway records.

    Returns { success, provider, model, image_base64, mime, latency_ms, error }.
    """
    if not (prompt or "").strip():
        out = _no_image_provider()
        out["error"] = "No prompt provided"
        return out

    chain = [(n, m) for n, m in _candidates(None, capability="image") if n in _IMAGE_DISPATCH]
    # Free image backends first (see _IMAGE_PREFERENCE) so a working free key is
    # never skipped in favour of a chargeable provider.
    chain.sort(key=lambda nm: _IMAGE_PREFERENCE.get(nm[0], 99))
    if not chain:
        out = _no_image_provider()
        _record("image", source, out)
        return out

    last: Dict[str, Any] = {}
    for i, (name, _probed_model) in enumerate(chain):
        out = {"success": False, "provider": name, "model": "", "image_base64": "",
               "mime": "", "latency_ms": None, "error": None}
        use_model = model if (i == 0 and model) else None
        start = time.time()
        try:
            _IMAGE_DISPATCH[name](prompt, size, use_model, out)
        except Exception as e:  # noqa: BLE001 — surface SDK failures, try next provider
            out["error"] = str(e)
        out["latency_ms"] = round((time.time() - start) * 1000, 1)
        _on_result(name, bool(out["success"]), out.get("error"))
        if out["success"]:
            _record("image", source, out)
            return out
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
    "invalidate_probe_cach