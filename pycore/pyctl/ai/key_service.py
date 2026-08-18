# -*- coding: utf-8 -*-
"""AI provider key-management service."""

from typing import Any, Dict, Optional

from pycore.pyfoundations.secret_manager import (
    set_secret_key_indexed,
    delete_secret_key,
    list_secret_key_names,
)
from pycore.pyctl.ai.ai_keys import (
    PROVIDERS,
    PROVIDER_ORDER,
    key_count,
    key_status,
    image_key_status,
    is_configured,
    is_image_only,
    has_image_key,
    reset_text_key_cooldown,
    reset_image_key_cooldown,
)
from pycore.pyctl.ai.ai_gateway import invalidate_probe_cache


def _base_for(provider: Optional[str], base_name: Optional[str]) -> str:
    if base_name and str(base_name).strip():
        return str(base_name).strip()
    meta = PROVIDERS.get(str(provider or "").strip(), {})
    return str(meta.get("key_base") or "")


def list_keys():
    """Per-provider key presence + rotation status (masked only; no values)."""
    raw_names = set(list_secret_key_names())
    providers = []
    for name in PROVIDER_ORDER:
        meta = PROVIDERS.get(name, {})
        providers.append({
            "name": name,
            "key_base": meta.get("key_base", ""),
            "keyless": bool(meta.get("keyless")),
            "image_only": is_image_only(name),
            "configured": is_configured(name),
            "image_ready": has_image_key(name),
            "key_count": key_count(name),
            "keys": key_status(name),
            "image_keys": image_key_status(name) if meta.get("image") else [],
        })
    return {"success": True, "providers": providers, "raw_key_files": sorted(raw_names)}


def set_key(params: Optional[Dict[str, Any]] = None):
    """Set a provider key slot."""
    req = params or {}
    base = _base_for(req.get("provider"), req.get("base_name"))
    if not base:
        return {"success": False, "error": "provider/base_name required"}
    value = str(req.get("value") or "").strip()
    if not value:
        return {"success": False, "error": "value is required"}
    index = int(req.get("index") or 1)
    target_base = f"{base}_IMAGE" if bool(req.get("image")) else base
    ok = set_secret_key_indexed(target_base, value, index)
    if not ok:
        return {"success": False, "error": "failed to write key"}
    invalidate_probe_cache()
    return {"success": True, "key_name": f"{target_base}_{max(1, index)}"}


def reset_cooldown(params: Optional[Dict[str, Any]] = None):
    """Manually clear a key cooldown."""
    req = params or {}
    provider = str(req.get("provider") or "").strip()
    if not provider:
        return {"success": False, "error": "provider is required"}
    index = req.get("index")
    fn = reset_image_key_cooldown if bool(req.get("image")) else reset_text_key_cooldown
    n = fn(provider, index)
    invalidate_probe_cache()
    return {"success": True, "reset": n}


def delete_key(key_name: str):
    """Delete one raw key file by exact name."""
    removed = delete_secret_key(key_name)
    if removed:
        invalidate_probe_cache()
    return {"success": removed}
