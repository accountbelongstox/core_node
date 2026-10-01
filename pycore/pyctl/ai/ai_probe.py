# -*- coding: utf-8 -*-
"""
Unified AI provider probe: one cheap live availability check per provider,
dispatched on the registry ``client`` kind (ai_keys.PROVIDERS).

Contract (UI depends on this EXACT shape), per provider:
    {name, configured, available, tier, limits, vision, image, image_ready,
     image_model, key_masked, models, error, latency_ms}
``image_ready`` is image-capable AND key present (no live call). Every live probe
is written to the hub test history (one record stream for every model test).
"""

import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyctl.ai.ai_keys import (
    PROVIDERS,
    PROVIDER_ORDER,
    catalog_models,
    client_kind,
    compat_client,
    first_secret,
    has_image_key,
    is_configured,
    is_image_only,
)
from pycore.pyctl.ai.ai_manifest import provider_block_reason, provider_category
from pycore.pyctl.ai.ai_rate_limits import check_rate_limit, rate_status
from pycore.pyctl.ai.ai_text_log import log_ai_call
from pycore.pyctl.ai.ai_gateway_state import _in_cooldown, _on_probe_result
from pycore.pyctl.ai_hub.probe_record import record_result
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_google_genai
from pycore.pyutils.ai_cluster.anthropic.anthropic_client import AnthropicClient
from pycore.pyutils.ai_cluster.gemini.gemini_client import GeminiClient
from pycore.pyutils.ai_cluster.openai_compat.openai_compat_client import ERROR_NO_MODELS
from pycore.pyutils.common.model_boot import model_boot

MAX_MODELS = 5
PROBE_SOURCE = "probe"
KEY_MASK_ELLIPSIS = "…"
ERROR_NO_KEY = "No API key configured"
ERROR_COOLDOWN = "Provider paused (cooldown)"
ERROR_RATE_LIMIT = "Rate limit reached"
ERROR_UNKNOWN_PROVIDER = "Unknown provider '{name}'"


def mask_key(key: Optional[str]) -> Optional[str]:
    """first 4 + ellipsis + last 4 chars; very short keys are fully ellipsized."""
    if not key:
        return None
    key = key.strip()
    if len(key) <= 8:
        return KEY_MASK_ELLIPSIS
    return f"{key[:4]}{KEY_MASK_ELLIPSIS}{key[-4:]}"


def _probe_compat(name: str, key: str) -> Tuple[List[str], Optional[str]]:
    client = compat_client(name, key)
    if client.profile.probe_url:
        valid, error = client.validate_token()
        return (catalog_models(name, MAX_MODELS) if valid else []), error
    models, error = client.list_models()
    if error == ERROR_NO_MODELS:
        return catalog_models(name, MAX_MODELS), None
    return models, error


def _probe_gemini(name: str, key: str) -> Tuple[List[str], Optional[str]]:
    genai = get_third_package_google_genai()
    try:
        listed = GeminiClient(api_key=key).list_models()
    except (genai.errors.APIError, OSError, ValueError) as exc:
        ColorPrint.yellow(f"[ai_probe] gemini list models failed: {exc}")
        return [], str(exc)
    return list(listed.get("models") or []), listed.get("error") or None


def _probe_anthropic(name: str, key: str) -> Tuple[List[str], Optional[str]]:
    return AnthropicClient(key).list_models()


_PROBES: Dict[str, Callable[[str, str], Tuple[List[str], Optional[str]]]] = {
    "openai_compat": _probe_compat,
    "gemini": _probe_gemini,
    "anthropic": _probe_anthropic,
}


def probe_supported(name: str) -> bool:
    return name in PROVIDERS and (client_kind(name) in _PROBES or is_image_only(name))


def _blank(name: str) -> Dict[str, Any]:
    """Default per-provider record (configured iff the required secrets exist)."""
    meta = PROVIDERS.get(name, {})
    configured = is_configured(name)
    key = first_secret(name) if configured else ""
    return {
        "name": name,
        "configured": configured,
        "available": False,
        "tier": meta.get("tier", "paid"),
        "limits": meta.get("limits", ""),
        "vision": meta.get("vision", False),
        "image": meta.get("image", False),
        "image_ready": bool(meta.get("image", False)) and has_image_key(name),
        "image_model": meta.get("image_model", "") if meta.get("image") else "",
        "key_masked": mask_key(key),
        "models": [],
        "error": None if configured else ERROR_NO_KEY,
        "latency_ms": None,
    }


def _probe_image_only(name: str) -> Dict[str, Any]:
    """Image-only providers are ready on key presence (their endpoints are billed)."""
    rec = _blank(name)
    if rec["configured"]:
        model = PROVIDERS.get(name, {}).get("image_model", "")
        rec.update(available=True, models=[model] if model else [], error=None)
    return rec


def _probe_live(name: str) -> Dict[str, Any]:
    if is_image_only(name):
        return _probe_image_only(name)
    rec = _blank(name)
    if not rec["configured"]:
        return rec
    started = time.time()
    models, error = _PROBES[client_kind(name)](name, first_secret(name))
    rec["latency_ms"] = round((time.time() - started) * 1000, 1)
    rec["available"] = bool(models)
    rec["models"] = models[:MAX_MODELS]
    rec["error"] = None if models else (error or ERROR_NO_MODELS)
    return rec


def _sort_key(rec: Dict[str, Any]) -> tuple:
    """Available first, then configured-but-down, then unconfigured; registry order within."""
    name = rec.get("name", "")
    order = PROVIDER_ORDER.index(name) if name in PROVIDER_ORDER else 999
    if rec.get("available"):
        return (0, order)
    if rec.get("configured"):
        return (1, order)
    return (2, order)


def probe_skip_reason(name: str, *, force: bool = False) -> Optional[str]:
    """Why a live probe should be skipped (None = probe is allowed)."""
    block_reason = provider_block_reason(name)
    if block_reason:
        return block_reason
    if force:
        return None
    if not is_configured(name):
        return ERROR_NO_KEY
    if _in_cooldown(name):
        return ERROR_COOLDOWN
    rate = check_rate_limit(name)
    if not rate.allowed:
        return rate.message or ERROR_RATE_LIMIT
    return None


def ensure_catalog_models(rec: Dict[str, Any]) -> None:
    """Fill model ids from the registry when a live list is empty."""
    if rec.get("models"):
        return
    name = rec.get("name", "")
    models = catalog_models(name, MAX_MODELS)
    default = PROVIDERS.get(name, {}).get("default_model", "")
    if not models and default:
        models = [default]
    if models:
        rec["models"] = models


def catalog_record(name: str) -> Dict[str, Any]:
    """One provider record from the registry without any network I/O."""
    rec = _blank(name)
    if rec["configured"]:
        rec["models"] = catalog_models(name, MAX_MODELS)
    rec["tested"] = False
    rec["boot"] = model_boot.record(name, provider_category(name))
    return rec


def _attach_rate(rec: Dict[str, Any]) -> Dict[str, Any]:
    rec["rate"] = rate_status(rec.get("name", "")).get("status")
    return rec


def _record_probe(rec: Dict[str, Any], started_at: float) -> None:
    name = rec["name"]
    models = rec.get("models") or []
    log_ai_call(
        PROBE_SOURCE, name, model=models[0] if models else "", source=PROBE_SOURCE,
        success=bool(rec.get("available")), latency_ms=rec.get("latency_ms"), error=rec.get("error"),
    )
    record_result(
        provider_category(name),
        name,
        {"mode": PROBE_SOURCE},
        {"success": bool(rec.get("available")), "model": models[0] if models else "", "error": rec.get("error")},
        round((time.time() - started_at) * 1000),
        started_at,
    )


def catalog() -> Dict[str, Any]:
    """Every provider from the registry WITHOUT any network probe (no quota spend)."""
    providers = [_attach_rate(catalog_record(name)) for name in PROVIDER_ORDER]
    providers.sort(key=_sort_key)
    return {"providers": providers}


def probe_one(name: str, *, force: bool = True) -> Dict[str, Any]:
    """One provider's live availability test.

    Unconfigured / cooling-down / over-budget providers are skipped unless
    ``force`` (the UI "Test" button). Failed probes pause the provider via the
    gateway cooldown registry."""
    name = (name or "").strip().lower()
    skip = probe_skip_reason(name, force=force)
    if skip:
        rec = catalog_record(name)
        rec.update(available=False, error=skip, paused=True)
        ensure_catalog_models(rec)
        return _attach_rate(rec)
    if not probe_supported(name):
        rec = catalog_record(name)
        rec["tested"] = True
        rec["error"] = rec.get("error") or ERROR_UNKNOWN_PROVIDER.format(name=name)
        return _attach_rate(rec)
    started_at = time.time()
    rec = _probe_live(name)
    rec["tested"] = True
    rec["boot"] = model_boot.record(name, provider_category(name))
    if rec["configured"]:
        ensure_catalog_models(rec)
    if not rec.get("available"):
        _on_probe_result(name, False, rec.get("error"))
    _record_probe(rec, started_at)
    return _attach_rate(rec)


def probe_all(*, force: bool = True) -> Dict[str, Any]:
    """Live-test configured providers; unconfigured ones come from the registry."""
    providers: List[Dict[str, Any]] = []
    for name in PROVIDER_ORDER:
        if not probe_supported(name):
            continue
        if not is_configured(name) and not force:
            rec = catalog_record(name)
            ensure_catalog_models(rec)
            providers.append(_attach_rate(rec))
            continue
        providers.append(probe_one(name, force=force))
    providers.sort(key=_sort_key)
    return {"providers": providers}


__all__ = [
    "catalog",
    "catalog_record",
    "ensure_catalog_models",
    "mask_key",
    "probe_all",
    "probe_one",
    "probe_skip_reason",
    "probe_supported",
]
