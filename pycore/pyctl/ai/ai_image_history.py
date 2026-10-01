# -*- coding: utf-8 -*-
"""
Shared AI image-generation history (cross-runtime: the Laravel side mirrors this
contract in ``App\\Services\\AiGateway\\AiImageHistory`` and shares the files).

Layout (under the AI state dir):
  ai_image_history.json   - newest-last index ring
  ai_images/<id>.<ext>    - the generated image bytes

Index entry (NO base64 in the index):
  { id, ts, iso, provider, model, prompt, size, mime, bytes, file,
    latency_ms, source, origin: 'pycore'|'laravel', ok }
"""

import base64
import binascii
import hashlib
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.ai.ai_gateway_state import AI_HISTORY_MAX_ENTRIES
from pycore.pyctl.ai.ai_state import ai_state_dir
from pycore.pyutils.common.json_index_store import JsonIndexStore

IMAGES_SUBDIR = "ai_images"
DEFAULT_MIME = "image/png"
LIST_DEFAULT = 50
PROMPT_MAX_CHARS = 2000
_MIME_EXT = {
    "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/webp": "webp", "image/gif": "gif",
}

ai_image_history_store = JsonIndexStore(
    "ai_image_history.json", ai_state_dir, AI_HISTORY_MAX_ENTRIES, "ai_image_history", blob_key="file",
)


def _ext_for(mime: str) -> str:
    return _MIME_EXT.get((mime or "").lower().split(";")[0].strip(), "png")


def record_image(
    *,
    provider: str,
    model: str,
    prompt: str,
    image_base64: str,
    size: Optional[str] = None,
    mime: str = DEFAULT_MIME,
    latency_ms: Optional[float] = None,
    source: str = "image",
    origin: str = "pycore",
    ok: bool = True,
) -> Optional[Dict[str, Any]]:
    """Persist a generated image (file + index entry); returns the entry or None.
    Image delivery never depends on history: failures are reported, not raised."""
    if not image_base64:
        return None
    try:
        raw = base64.b64decode(image_base64)
    except (binascii.Error, ValueError) as exc:
        ColorPrint.yellow(f"[ai_image_history] {provider}/{model} image is not base64: {exc}")
        return None
    if not raw:
        return None
    ts = time.time()
    digest = hashlib.sha1(f"{ts}:{provider}:{prompt}".encode("utf-8")).hexdigest()[:16]
    entry = ai_image_history_store.append({
        "id": digest,
        "ts": ts,
        "iso": datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds"),
        "provider": provider or "",
        "model": model or "",
        "prompt": (prompt or "")[:PROMPT_MAX_CHARS],
        "size": size or "",
        "mime": mime or DEFAULT_MIME,
        "bytes": len(raw),
        "file": f"{IMAGES_SUBDIR}/{digest}.{_ext_for(mime)}",
        "latency_ms": latency_ms,
        "source": source or "image",
        "origin": origin or "pycore",
        "ok": bool(ok),
    }, raw)
    if entry is not None:
        ColorPrint.green(f"[ai_image_history] recorded {provider}/{model} ({len(raw) // 1024}KB) id={digest}")
    return entry


def list_history(limit: int = LIST_DEFAULT) -> List[Dict[str, Any]]:
    """Newest-first index entries (metadata only)."""
    bounded = int(limit) if str(limit).isdigit() else LIST_DEFAULT
    return ai_image_history_store.entries(max(1, min(AI_HISTORY_MAX_ENTRIES, bounded)))


def read_image(image_id: str) -> Tuple[bytes, str]:
    """(bytes, mime) for a stored image id, or (b'', '') when missing."""
    entry = ai_image_history_store.find((image_id or "").strip())
    if not entry or not entry.get("file"):
        return b"", ""
    path = ai_image_history_store.blob_path(entry["file"])
    try:
        return path.read_bytes(), entry.get("mime") or DEFAULT_MIME
    except OSError as exc:
        ColorPrint.yellow(f"[ai_image_history] read {path} failed: {exc}")
        return b"", ""


def entry_path(image_id: str) -> Optional[str]:
    """Absolute path of a stored image file (reveal / show location), or None."""
    entry = ai_image_history_store.find((image_id or "").strip())
    if not entry or not entry.get("file"):
        return None
    return str(ai_image_history_store.blob_path(entry["file"]).resolve())


def delete_entry(image_id: str) -> bool:
    return ai_image_history_store.delete((image_id or "").strip()) is not None


def clear_history() -> int:
    return ai_image_history_store.clear()


__all__ = [
    "ai_image_history_store",
    "clear_history",
    "delete_entry",
    "entry_path",
    "list_history",
    "read_image",
    "record_image",
]
