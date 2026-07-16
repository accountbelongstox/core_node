#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared AI image-generation history (cross-runtime: pycore on Windows + Laravel
in WSL share ONE file, exactly like the rate-usage store).

Both runtimes read/write the SAME files under ``<core_node>/.ai_state`` — the
only filesystem location both see as a single file (D:\\..\\core_node on Windows
== /mnt/d/..\\core_node in WSL via DrvFs), the same channel ``.secret_keys`` and
``ai_rate_usage.json`` already use. The Laravel side mirrors this contract in
``App\\Services\\AiGateway\\AiImageHistory``.

Layout:
  <core_node>/.ai_state/ai_image_history.json   — newest-last index (ring buffer)
  <core_node>/.ai_state/ai_images/<id>.<ext>    — the generated image bytes

Index entry (the only shape the UI / Laravel depend on; NO base64 in the index):
  { id, ts, iso, provider, model, prompt, size, mime, bytes, file,
    latency_ms, source, origin: 'pycore'|'laravel', ok }

Safety mirrors ai_rate_limits: tmp file + atomic os.replace + an in-process lock.
Cross-runtime DrvFs locking is unreliable, but image generations are seconds+
apart so the lost-update window is negligible and atomic replace prevents
corruption. All imports at file top (PYTHON_PYCORE.md §1.4); ColorPrint logging.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR, get_core_node_root, get_local_data_dir

# Cross-runtime shared store (see module docstring + ai_rate_limits rationale).
# Lives under <cache>/pycore/.ai_state; the prior <core_node>/.ai_state location
# is migrated once on first access.
_SHARED_STATE_DIR = get_local_data_dir() / ".ai_state"
_OLD_SHARED_DIR = get_core_node_root() / ".ai_state"
_LEGACY_DIR = APP_DATA_DIR / "ai_state"

# Newest-last ring buffer cap; older entries (and their image files) are trimmed.
_MAX_ENTRIES = 200

_MIME_EXT = {
    "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/webp": "webp", "image/gif": "gif",
}

_lock = threading.Lock()


def _migrate_old_state():
    """Move files from the prior shared dir (<core_node>/.ai_state) into the new
    <cache>/pycore/.ai_state once. Idempotent — a name already present in the
    new dir is left alone. All three AI-state modules share this dir, so whichever
    runs first relocates everything (rate usage, usage records, image history +
    the ai_images/ folder)."""
    try:
        if not _OLD_SHARED_DIR.exists() or _OLD_SHARED_DIR.resolve() == _SHARED_STATE_DIR.resolve():
            return
        for item in _OLD_SHARED_DIR.iterdir():
            dest = _SHARED_STATE_DIR / item.name
            if not dest.exists():
                os.replace(str(item), str(dest))
    except Exception:
        pass


def _state_dir():
    """Shared ``<cache>/pycore/.ai_state`` dir (legacy fallback if
    the cache root is not writable, e.g. a read-only deploy)."""
    try:
        _SHARED_STATE_DIR.mkdir(parents=True, exist_ok=True)
        _migrate_old_state()
        return _SHARED_STATE_DIR
    except Exception:
        _LEGACY_DIR.mkdir(parents=True, exist_ok=True)
        return _LEGACY_DIR


def _index_file():
    return _state_dir() / "ai_image_history.json"


def _images_dir():
    d = _state_dir() / "ai_images"
    try:
        d.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    return d


def _load_index() -> Dict[str, Any]:
    path = _index_file()
    try:
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("entries"), list):
                return data
    except Exception as e:  # noqa: BLE001 — a corrupt index must never crash callers
        ColorPrint.yellow(f"[ai_image_history] index unreadable ({e}); starting fresh")
    return {"version": 1, "saved_at": 0.0, "entries": []}


def _save_index(doc: Dict[str, Any]) -> None:
    doc["saved_at"] = time.time()
    path = _index_file()
    tmp = path.with_suffix(".json.tmp")
    try:
        tmp.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[ai_image_history] index write failed: {e}")
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass


def _ext_for(mime: str) -> str:
    return _MIME_EXT.get((mime or "").lower().split(";")[0].strip(), "png")


def _trim(doc: Dict[str, Any]) -> None:
    """Keep only the newest _MAX_ENTRIES; delete dropped entries' image files."""
    entries = doc.get("entries") or []
    if len(entries) <= _MAX_ENTRIES:
        return
    drop = entries[: len(entries) - _MAX_ENTRIES]
    doc["entries"] = entries[len(entries) - _MAX_ENTRIES:]
    base = _state_dir()
    for e in drop:
        rel = e.get("file")
        if rel:
            try:
                (base / rel).unlink()
            except OSError:
                pass


def record_image(
    *,
    provider: str,
    model: str,
    prompt: str,
    image_base64: str,
    size: Optional[str] = None,
    mime: str = "image/png",
    latency_ms: Optional[float] = None,
    source: str = "image",
    origin: str = "pycore",
    ok: bool = True,
) -> Optional[Dict[str, Any]]:
    """Persist a generated image (file + index entry) to the shared store.

    Returns the index entry (NO base64) or None when there is nothing to store.
    Best-effort: a storage failure is logged and swallowed, never raised — image
    delivery to the caller must not depend on history succeeding.
    """
    if not image_base64:
        return None
    try:
        raw = base64.b64decode(image_base64)
    except Exception:  # noqa: BLE001
        return None
    if not raw:
        return None

    ts = time.time()
    digest = hashlib.sha1(f"{ts}:{provider}:{prompt}".encode("utf-8")).hexdigest()[:16]
    ext = _ext_for(mime)
    rel = f"ai_images/{digest}.{ext}"
    entry = {
        "id": digest,
        "ts": ts,
        "iso": datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds"),
        "provider": provider or "",
        "model": model or "",
        "prompt": (prompt or "")[:2000],
        "size": size or "",
        "mime": mime or "image/png",
        "bytes": len(raw),
        "file": rel,
        "latency_ms": latency_ms,
        "source": source or "image",
        "origin": origin or "pycore",
        "ok": bool(ok),
    }
    with _lock:
        try:
            (_images_dir().parent / rel).write_bytes(raw)
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[ai_image_history] image write failed: {e}")
            return None
        doc = _load_index()
        doc["entries"].append(entry)
        _trim(doc)
        _save_index(doc)
    ColorPrint.green(
        f"[ai_image_history] recorded {provider}/{model} ({len(raw)//1024}KB) id={digest}")
    return entry


def list_history(limit: int = 50) -> List[Dict[str, Any]]:
    """Newest-first index entries (metadata only), capped at ``limit`` (1..200)."""
    limit = max(1, min(_MAX_ENTRIES, int(limit) if str(limit).isdigit() else 50))
    with _lock:
        entries = list((_load_index().get("entries") or []))
    return list(reversed(entries))[:limit]


def read_image(image_id: str) -> Tuple[bytes, str]:
    """(bytes, mime) for a stored image id, or (b'', '') when missing."""
    image_id = (image_id or "").strip()
    if not image_id:
        return b"", ""
    with _lock:
        for e in (_load_index().get("entries") or []):
            if e.get("id") == image_id:
                rel = e.get("file")
                mime = e.get("mime") or "image/png"
                break
        else:
            return b"", ""
    try:
        return (_state_dir() / rel).read_bytes(), mime
    except Exception:  # noqa: BLE001
        return b"", ""


def entry_path(image_id: str) -> Optional[str]:
    """Absolute path of a stored image file (for reveal / show-location), or None."""
    image_id = (image_id or "").strip()
    if not image_id:
        return None
    with _lock:
        for e in (_load_index().get("entries") or []):
            if e.get("id") == image_id and e.get("file"):
                try:
                    return str((_state_dir() / e["file"]).resolve())
                except Exception:
                    return str(_state_dir() / e["file"])
    return None


def delete_entry(image_id: str) -> bool:
    """Remove one history entry and its image file. True when an entry was removed."""
    image_id = (image_id or "").strip()
    if not image_id:
        return False
    with _lock:
        doc = _load_index()
        entries = doc.get("entries") or []
        keep, removed = [], None
        for e in entries:
            if e.get("id") == image_id and removed is None:
                removed = e
            else:
                keep.append(e)
        if removed is None:
            return False
        doc["entries"] = keep
        _save_index(doc)
    rel = removed.get("file")
    if rel:
        try:
            (_state_dir() / rel).unlink()
        except OSError:
            pass
    return True


def clear_history() -> int:
    """Delete ALL history entries + image files. Returns the count removed."""
    with _lock:
        doc = _load_index()
        entries = doc.get("entries") or []
        base = _state_dir()
        for e in entries:
            rel = e.get("file")
            if rel:
                try:
                    (base / rel).unlink()
                except OSError:
                    pass
        n = len(entries)
        doc["entries"] = []
        _save_index(doc)
    return n


__all__ = [
    "record_image", "list_history", "read_image", "entry_path", "delete_entry", "clear_history",
]
