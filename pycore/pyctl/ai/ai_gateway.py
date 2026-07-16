#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified AI gateway - the SINGLE AI exit for pycore.

Integrates ALL providers (openrouter / gemini / deepseek / openai=ChatGPT /
anthropic=Claude - registry in ai_keys.PROVIDERS) behind three calls:

    generate_text(prompt|messages, source=...)   -> unified contract
    describe_image(image_path, prompt, source=...) -> unified contract
    generate_image(prompt, size=..., source=...)  -> unified IMAGE contract
                   (image-capable providers only - registry ``image`` flag)

Smart dispatch (per call):
  1. Tier order: free (openrouter :free models, gemini free tier) ->
     balance (deepseek prepaid) -> paid (openai, anthropic). ``provider`` pins
     the first candidate; prompts are passed through UNCHANGED.
  2. Skip providers on cooldown. A rate-limit/quota failure (429,
     RESOURCE_EXHAUSTED, insufficient quota/balance…) puts the provider on an
     exponential cooldown (60s -> 120s -> … capped at 30 min) instead of being
     retried immediately; any other failure falls through to the next provider.
  3. Models are probed, never hardcoded (catalogs are volatile).

Every call is recorded (ring buffer + per-provider counters) so the UI can show
WHICH AI handled each task, its latency, and current quota/cooldown state:
gateway_status() feeds GET /api/local/ai/gateway.

---
This module is now a THIN ORCHESTRATOR + FACADE. The heavy pieces were split out
into sibling modules (all under pycore/pyctl/ai/):
  - ai_gateway_state     : the SINGLETON mutable state (_lock/_stats/_records/
                           _probe_cache/_quota_cache/_vision_model_cache) +
                           persistence + error predicates + rate caps +
                           state-mutation primitives (_on_result/_in_cooldown/
                           clear_expired_cooldowns/_record). LEAF - imported by
                           every other sub-module, never re-declares nothing.
  - ai_gateway_quota     : TTL-cached probe + quota (available_providers /
                           get_quota / invalidate_probe_cache).
  - ai_gateway_vision    : image->text provider chain (_VISION_DISPATCH).
  - ai_image_signers     : pure crypto/auth signers (Spark HMAC / Bedrock SigV4
                           / Vertex OAuth).
  - ai_image_providers   : 16 text->image provider helpers (_IMAGE_DISPATCH /
                           _IMAGE_PREFERENCE) + size helpers.
This file keeps ONLY the dispatch orchestration (_candidates / _run_image_helper
/ generate_text / describe_image / generate_image / gateway_status) and re-
exports the public API. The shared singleton state stays in EXACTLY ONE module
(ai_gateway_state) so cooldowns/records/caches never silently split.
"""

import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.ai.ai_keys import (
    PROVIDERS, PROVIDER_ORDER, active_image_secret, active_secret, all_image_secrets,
    first_secret, has_image_key, image_key_rate_ok, image_key_status, image_ready_now,
    is_image_only, key_count, key_status, mark_image_key_cooldown,
    mark_text_key_cooldown, record_image_key, record_text_key, text_key_rate_ok,
)
from pycore.pyctl.ai.ai_probe import _sort_key
from pycore.pyctl.ai.ai_chat import chat_once
from pycore.pyctl.ai.ai_image_history import record_image as _record_image_history
from pycore.pyctl.ai.ai_rate_limits import check_rate_limit
# Singleton state + state-mutation primitives (LEAF) - imported, NEVER re-declared.
from pycore.pyctl.ai.ai_gateway_state import (
    _TIER_ORDER, _lock, _records, _stats,
    _IMG_BOUND_S, _IMG_DISABLED_COOLDOWN_S, _IMG_TOTAL_BUDGET_S, _IMG_UNREACHABLE_COOLDOWN_S,
    _in_cooldown, _is_hard_disable_error, _is_net_timeout_error, _is_quota_error,
    _on_result, _rate_caps, _record, clear_expired_cooldowns,
)
from pycore.pyctl.ai.ai_gateway_quota import (
    _all_probed_providers, available_providers, get_quota, invalidate_probe_cache,
)
from pycore.pyctl.ai.ai_gateway_vision import _VISION_DISPATCH
from pycore.pyctl.ai.ai_image_providers import _IMAGE_DISPATCH, _IMAGE_PREFERENCE


# --------------------------------------------------------------------------- #
# Dispatch                                                                     #
# --------------------------------------------------------------------------- #
def _candidates(prefer: Optional[str], capability: Optional[str] = None) -> List[Tuple[str, Optional[str]]]:
    """
    Ordered (provider, probed_model) fallback chain for one call.

    Tier order (free -> balance -> paid) within PROVIDER_ORDER; cooled-down
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
        # No capability filter = the TEXT/chat chain - exclude image-only providers.
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
        except Exception as e:  # noqa: BLE001 - surface SDK failures, try next provider
            out["error"] = str(e)
        finally:
            done.set()

    threading.Thread(target=_target, daemon=True, name=f"img-{name}").start()
    if not done.wait(secs):
        out["error"] = f"timed out (> {int(secs)}s, provider unreachable)"


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
        # Multi-key rotation: try this provider's keys in turn - on a quota/429
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
                ColorPrint.yellow(f"[ai_gateway] {name} KEY{idx + 1} quota-limited - rotating key")
                continue
            break
        _on_result(name, bool(last.get("success")), last.get("error"))
        ColorPrint.yellow(
            f"[ai_gateway] {name} failed ({last.get('error')}), "
            f"{'falling back' if i + 1 < len(chain) else 'no providers left'}")
    _record("text", source, last)
    return last or _no_provider(provider or "")


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
        except Exception as e:  # noqa: BLE001 - surface SDK failures, try next provider
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
        # (or keyless) that is NOT on cooldown - NOT on a successful /models probe.
        # This lets image-only / keyless providers work, makes image gen resilient
        # when the chat probe is cold, and SKIPS dead/blocked providers so they
        # don't stall every request. Free backends first via _IMAGE_PREFERENCE.
        chain = [(n, None) for n in PROVIDER_ORDER
                 if PROVIDERS.get(n, {}).get("image") and n in _IMAGE_DISPATCH
                 and has_image_key(n) and image_ready_now(n)]
        chain.sort(key=lambda nm: _IMAGE_PREFERENCE.get(nm[0], 99))
        # NOTE: deliberately NO "mercy retry" of cooled providers here. Re-adding a
        # provider whose keys are all on cooldown just yields another 429 that
        # re-cools it - the exact feedback loop that floods the log. When nothing is
        # ready we fall through to _no_image_provider() and let the cooldown elapse;
        # keyless free backends (e.g. pollinations) are ready-checked above, so a
        # genuinely-usable backend would already be in `chain`.
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
                f"exceeded - stopping (dead providers cooled; next call will be fast)")
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
                # cooldown can't block image and vice-versa - isolation is per key.
                _on_result(name, True, None)
                _record("image", source, out)
                # Record to the shared cross-runtime image history HERE (the core),
                # not at the HTTP router, so EVERY image - on-demand, gateway-
                # internal, and assist-claimed COVERS - lands in history exactly
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
            cur_model = out.get("model") or use_model or "?"
            # A NON-retryable provider error (paid-plan-only model, disabled/banned
            # account, auth failure) must NOT be retried on every task: cool the key
            # LONG and skip the provider. This is what stops the imagen(400 paid) and
            # openai(401 disabled) spam that previously failed on every image task.
            if _is_hard_disable_error(err):
                mark_image_key_cooldown(name, idx, secs=_IMG_DISABLED_COOLDOWN_S, error=err)
                ColorPrint.yellow(
                    f"[ai_gateway] image provider={name} model={cur_model} KEY{idx + 1} "
                    f"DISABLED ({(err or '')[:80]}) - cooled {int(_IMG_DISABLED_COOLDOWN_S)}s"
                    + (", rotating key" if attempt < n_keys - 1 else ", skipping provider"))
                # Other keys may be different accounts (one revoked != all dead),
                # so rotate to the next key; only give up the provider once all are cooled.
                if attempt < n_keys - 1:
                    continue
                break
            # Cool the key on a quota OR unreachable/timeout error so the dead
            # provider is SKIPPED next time (longer cooldown when unreachable).
            unreachable = _is_net_timeout_error(err)
            if _is_quota_error(err) or unreachable:
                mark_image_key_cooldown(
                    name, idx, secs=_IMG_UNREACHABLE_COOLDOWN_S if unreachable else None,
                    error=err)
                if attempt < n_keys - 1:
                    ColorPrint.yellow(
                        f"[ai_gateway] image provider={name} model={cur_model} KEY{idx + 1} "
                        f"{'unreachable' if unreachable else 'quota-limited'} - rotating key")
                    continue
            break
        _on_result(name, False, None)  # record failure WITHOUT provider cooldown
        ColorPrint.yellow(
            f"[ai_gateway] image provider={name} model={out.get('model') or '?'} "
            f"failed ({out.get('error')}), "
            f"{'falling back' if i + 1 < len(chain) else 'no providers left'}")
        last = out
    _record("image", source, last)
    return last or _no_image_provider()


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
        rate = check_rate_limit(name)
        paused = cooldown_s > 0 or not rate.allowed
        providers.append({
            "name": name,
            "tier": meta["tier"],
            "limits": meta.get("limits", ""),
            "vision": meta["vision"],
            "image": meta.get("image", False),
            "image_model": meta.get("image_model", "") if meta.get("image") else "",
            "configured": bool(probed.get("configured")) or bool(first_secret(name)),
            "available": bool(probed.get("available")),
            "paused": paused,
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


__all__ = [
    "generate_text",
    "describe_image",
    "generate_image",
    "available_providers",
    "get_quota",
    "gateway_status",
    "invalidate_probe_cache",
    "clear_expired_cooldowns",
]
