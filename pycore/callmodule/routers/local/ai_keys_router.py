# -*- coding: utf-8 -*-
"""
AI provider KEY management (read presence + set/delete) — the "Set Special
Software Environment Variables (like AI)" backend.

Keys are the multi-key rotation pool (``<BASE>_1`` .. ``<BASE>_5``, plus a
dedicated image key ``<BASE>_IMAGE_n``). This router lets the UI SEE which keys
exist (masked, per-slot status) and SET/DELETE them. Values are written to the
raw secret store (``.secret_keys/.secret_ignore``); full key values are NEVER
returned — only masked forms.

Endpoints (prefix /api/local/ai):
  GET    /keys                 -> per-provider key presence + rotation status
  POST   /keys                 -> set { provider|base_name, index?, value, image? }
  DELETE /keys/{key_name}      -> remove one raw key file

Localhost-only surface (pycore binds 127.0.0.1:59000); still, values are sanitized
and never echoed.
"""

from typing import Optional

import fastapi
from pydantic import BaseModel

from pycore.pyfoundations.secret_manager import (
    set_secret_key_indexed, delete_secret_key, list_secret_key_names,
)
from pycore.pyctl.ai.ai_keys import (
    PROVIDERS, PROVIDER_ORDER, key_count, key_status, image_key_status,
    is_configured, is_image_only, has_image_key,
    reset_text_key_cooldown, reset_image_key_cooldown,
)
from pycore.pyctl.ai.ai_gateway import invalidate_probe_cache

router = fastapi.APIRouter(prefix="/api/local/ai", tags=["Local Processing - AI"])


class KeySetRequest(BaseModel):
    # Provider name (e.g. "gemini") OR an explicit base_name (e.g. "GOOGLE_API_KEY").
    provider: Optional[str] = None
    base_name: Optional[str] = None
    # Slot index 1..5 (the multi-key rotation position).
    index: int = 1
    # The secret value to store.
    value: str
    # When true, store the DEDICATED image key ({BASE}_IMAGE_{index}).
    image: bool = False


def _base_for(provider: Optional[str], base_name: Optional[str]) -> str:
    if base_name and base_name.strip():
        return base_name.strip()
    meta = PROVIDERS.get((provider or "").strip(), {})
    return str(meta.get("key_base") or "")


@router.get("/keys")
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


@router.post("/keys")
def set_key(req: KeySetRequest):
    """Set a provider key slot. Body: { provider|base_name, index?, value, image? }."""
    base = _base_for(req.provider, req.base_name)
    if not base:
        raise fastapi.HTTPException(status_code=400, detail="provider/base_name required")
    if not (req.value or "").strip():
        raise fastapi.HTTPException(status_code=400, detail="value is required")
    target_base = f"{base}_IMAGE" if req.image else base
    ok = set_secret_key_indexed(target_base, req.value, req.index)
    if not ok:
        raise fastapi.HTTPException(status_code=500, detail="failed to write key")
    invalidate_probe_cache()  # re-probe with the new key on next call
    return {"success": True, "key_name": f"{target_base}_{max(1, int(req.index))}"}


class CooldownResetRequest(BaseModel):
    # Provider whose key cooldown(s) to clear.
    provider: str
    # Specific slot index (0-based) or None for all slots of the provider.
    index: Optional[int] = None
    # Reset the IMAGE-key cooldown instead of the text-key cooldown.
    image: bool = False


@router.post("/keys/reset-cooldown")
def reset_cooldown(req: CooldownResetRequest):
    """Manually clear a key's cooldown so it's used again immediately (UI override
    after a provider recovers / a manual fix)."""
    provider = (req.provider or "").strip()
    if not provider:
        raise fastapi.HTTPException(status_code=400, detail="provider is required")
    fn = reset_image_key_cooldown if req.image else reset_text_key_cooldown
    n = fn(provider, req.index)
    return {"success": True, "reset": n}


@router.delete("/keys/{key_name}")
def delete_key(key_name: str):
    """Delete one raw key file by exact name (e.g. GOOGLE_API_KEY_2)."""
    removed = delete_secret_key(key_name)
    if removed:
        invalidate_probe_cache()
    return {"success": removed}
