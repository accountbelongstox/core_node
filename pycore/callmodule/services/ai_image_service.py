# -*- coding: utf-8 -*-
"""AI image generation application service."""

import base64
import os
from typing import Any, Dict, Optional

from pycore.pyctl.ai import generate_image
from pycore.pyctl.ai import ai_image_history
from pycore.pyutils.common import system_launcher

_PROMPT_MAX_CHARS = 2000


def image(params: Optional[Dict[str, Any]] = None):
  """Generate one image from a text prompt through the unified AI gateway."""
  p = params or {}
  prompt = str(p.get("prompt") or "").strip()
  if not prompt:
    return {"success": False, "error": "prompt is required"}
  if len(prompt) > _PROMPT_MAX_CHARS:
    return {"success": False, "error": f"prompt too long (max {_PROMPT_MAX_CHARS} chars)"}
  source = p.get("source") or "image"
  return generate_image(
    prompt=prompt,
    size=p.get("size"),
    model=p.get("model"),
    source=source,
  )


def image_test(params: Optional[Dict[str, Any]] = None):
  """Force-generate one image with a single provider."""
  p = params or {}
  provider = str(p.get("provider") or "").strip()
  if not provider:
    return {"success": False, "error": "provider is required"}
  prompt = str(p.get("prompt") or "A small test image: a friendly robot waving, flat style").strip()
  return generate_image(
    prompt=prompt,
    size=p.get("size") or "1:1",
    model=p.get("model"),
    source="provider-test",
    provider=provider,
  )


def image_history(limit: int = 50):
  return {"success": True, "entries": ai_image_history.list_history(limit)}


def image_history_file(image_id: str):
  data, mime = ai_image_history.read_image(image_id)
  if not data:
    return {"success": False, "error": "image not found"}
  return {
    "success": True,
    "mime": mime or "image/png",
    "content_base64": base64.b64encode(data).decode("ascii"),
    "bytes": len(data),
  }


def image_history_reveal(image_id: str):
  path = ai_image_history.entry_path(image_id)
  if not path or not os.path.exists(path):
    return {"success": False, "error": "file not found"}
  ok = system_launcher.open_dir(os.path.dirname(path))
  return {"success": bool(ok), "path": path}


def image_history_delete(image_id: str):
  return {"success": ai_image_history.delete_entry(image_id)}


def image_history_clear():
  return {"success": True, "removed": ai_image_history.clear_history()}
