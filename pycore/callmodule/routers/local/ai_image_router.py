# -*- coding: utf-8 -*-
"""
AI image-generation router — the HTTP face of the gateway's generate_image,
plus the shared cross-runtime image HISTORY (see pyctl/ai/ai_image_history.py;
the Laravel side mirrors the same .ai_state files).

Endpoints (prefix /api/local/ai):
  POST   /image                     -> generate_image() (smart dispatch over
                                       image-capable providers) + record history
  GET    /image/history?limit=50    -> newest-first history (metadata only)
  GET    /image/history/file/{id}   -> the stored image bytes
  DELETE /image/history/{id}        -> remove one history entry + its file
  POST   /image/history/clear       -> clear all history

The POST returns the gateway's unified IMAGE contract verbatim (UI depends on it):
    { success, provider, model, image_base64, mime, latency_ms, error }
"""

from typing import Optional

import fastapi
from pydantic import BaseModel

from pycore.pyctl.ai import generate_image
from pycore.pyctl.ai import ai_image_history

router = fastapi.APIRouter(prefix="/api/local/ai", tags=["Local Processing - AI"])

# Keep prompts bounded — this is a generation endpoint, not a document pipe.
_PROMPT_MAX_CHARS = 2000


class ImageRequest(BaseModel):
    # Text prompt describing the image to generate (required, non-empty).
    prompt: str
    # Optional aspect ratio like "1:1" / "16:9"; ignored by providers that
    # don't support one (Gemini sizes by aspect ratio, not pixels).
    size: Optional[str] = None
    # Optional model id; falls back to the provider's registry image_model.
    model: Optional[str] = None
    # Optional task label shown in the gateway records ("thumbnail", "cover"…).
    source: Optional[str] = None


@router.post("/image")
def image(req: ImageRequest):
    """
    Generate one image from a text prompt through the unified AI gateway, then
    record it to the shared cross-runtime history (best-effort).

    Body: { prompt, size?, model?, source? }
    400 when prompt is empty/whitespace or longer than 2000 chars; otherwise
    200 with the gateway's unified IMAGE contract.
    """
    prompt = (req.prompt or "").strip()
    if not prompt:
        raise fastapi.HTTPException(status_code=400, detail="prompt is required")
    if len(prompt) > _PROMPT_MAX_CHARS:
        raise fastapi.HTTPException(
            status_code=400,
            detail=f"prompt too long (max {_PROMPT_MAX_CHARS} chars)",
        )
    source = req.source or "image"
    # NOTE: history recording now happens inside generate_image() (the gateway
    # core) so EVERY image path — including assist-claimed covers that never go
    # through this route — is recorded exactly once. Do not re-record here.
    result = generate_image(prompt=prompt, size=req.size, model=req.model, source=source)
    return result


class ImageTestRequest(BaseModel):
    # The single provider to test (e.g. "zhipuai", "pollinations").
    provider: str
    # Optional override prompt/size/model; sensible defaults when omitted.
    prompt: Optional[str] = None
    size: Optional[str] = None
    model: Optional[str] = None


@router.post("/image/test")
def image_test(req: ImageTestRequest):
    """One-click "test this provider" — force-generate one image with a SINGLE
    provider (ignores cooldown/dispatch order), record it, and return the unified
    contract so the UI can show success + latency + the image (or the error)."""
    provider = (req.provider or "").strip()
    if not provider:
        raise fastapi.HTTPException(status_code=400, detail="provider is required")
    prompt = (req.prompt or "A small test image: a friendly robot waving, flat style").strip()
    # History recording happens inside generate_image() (gateway core) — see /image.
    result = generate_image(prompt=prompt, size=req.size or "1:1", model=req.model,
                            source="provider-test", provider=provider)
    return result


@router.get("/image/history")
def image_history(limit: int = 50):
    """Newest-first image history (metadata only; no base64). UI lists from this
    and fetches bytes on demand via /image/history/file/{id}."""
    return {"success": True, "entries": ai_image_history.list_history(limit)}


@router.get("/image/history/file/{image_id}")
def image_history_file(image_id: str):
    """Serve the stored image bytes for a history id (404 when missing)."""
    data, mime = ai_image_history.read_image(image_id)
    if not data:
        raise fastapi.HTTPException(status_code=404, detail="image not found")
    return fastapi.Response(content=data, media_type=mime or "image/png")


@router.delete("/image/history/{image_id}")
def image_history_delete(image_id: str):
    """Remove one history entry and its image file."""
    return {"success": ai_image_history.delete_entry(image_id)}


@router.post("/image/history/clear")
def image_history_clear():
    """Clear ALL image history (files + index). Returns how many were removed."""
    return {"success": True, "removed": ai_image_history.clear_history()}
