# -*- coding: utf-8 -*-
"""
Unified result cache — one keyed, on-disk store so an identical task hits the
cache instead of recomputing (the user-facing "same task -> use cache" goal).

It is capability-agnostic: callers pass a ``namespace`` (e.g. 'cover',
'ai_translate', 'tts', 'poster') and the natural key PARTS for that task; the
module hashes them (with a ``version`` salt so a model/engine change invalidates
old entries) and stores either a small JSON value or raw bytes (image / audio).

Layout (under APP_CACHE_DIR/result_cache/<namespace>/):
  <hash>.json                  JSON value entries  {value, ts, ttl, version, key}
  <hash>.bin + <hash>.meta.json   binary entries   (bytes + {mime, ext, ts, ttl, ...})

Safety mirrors ai_usage_log / ai_image_history: atomic tmp + os.replace writes,
an in-process lock, best-effort (a cache failure NEVER breaks the real task).
Per-namespace entry cap with oldest-first pruning keeps it bounded. Lives in
pyutils/common so pyctl.ai, pyctl.assist and the pyutils orchestrators can all
share it (pyutils/common imports only pyfoundations + stdlib).
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_CACHE_DIR
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

# Root of every namespaced result cache.
_ROOT = Path(APP_CACHE_DIR) / "result_cache"
# Default max entries kept per namespace (oldest pruned on write). Binary caches
# (cover/tts) hold large blobs, so keep this modest; callers may override.
_DEFAULT_MAX_ENTRIES = 2000

_CACHE_QUEUE = 'pyutils.common.result_cache'
_CACHE_WORKER = SerializedWorkerThread(_CACHE_QUEUE, 'ResultCacheThread')
_CACHE_WORKER.start()


def _ns_dir(namespace: str) -> Path:
    """The directory for one namespace (created on demand)."""
    safe = "".join(c if (c.isalnum() or c in "-_") else "_" for c in (namespace or "default"))
    d = _ROOT / (safe or "default")
    d.mkdir(parents=True, exist_ok=True)
    return d


def _key_hash(parts: Tuple[Any, ...], version: str) -> str:
    """md5 of the joined key parts + version salt (version change => new key)."""
    raw = "\x1f".join("" if p is None else str(p) for p in parts) + f"\x1f|v={version}"
    return hashlib.md5(raw.encode("utf-8", "replace")).hexdigest()


def _expired(meta: Dict[str, Any]) -> bool:
    """True when the entry carries a ttl that has elapsed."""
    ttl = meta.get("ttl")
    if ttl is None:
        return False
    try:
        return (time.time() - float(meta.get("ts", 0))) > float(ttl)
    except (TypeError, ValueError):
        return False


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def _prune(ns_dir: Path, max_entries: int) -> None:
    """Keep at most ``max_entries`` logical entries; drop oldest by mtime.

    Counts the primary file per entry (.json or .bin) and removes the .meta.json
    sidecar alongside a pruned .bin."""
    try:
        primaries = [p for p in ns_dir.iterdir()
                     if p.suffix in (".json", ".bin") and not p.name.endswith(".meta.json")]
        if len(primaries) <= max_entries:
            return
        primaries.sort(key=lambda p: p.stat().st_mtime)
        for p in primaries[:len(primaries) - max_entries]:
            try:
                p.unlink()
                if p.suffix == ".bin":
                    sidecar = p.with_suffix(".meta.json")
                    if sidecar.exists():
                        sidecar.unlink()
            except OSError:
                pass
    except OSError:
        pass


# --------------------------------------------------------------------------- #
# JSON value cache (small results: ai_translate text, generic values)         #
# --------------------------------------------------------------------------- #
def _get_json(namespace: str, *parts: Any, version: str = "1") -> Optional[Any]:
    """Return the cached JSON value for these key parts, or None (miss/expired)."""
    try:
        path = _ns_dir(namespace) / f"{_key_hash(parts, version)}.json"
        if not path.is_file():
            return None
        doc = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(doc, dict) or _expired(doc):
            return None
        return doc.get("value")
    except Exception as e:  # noqa: BLE001 — a cache read must never break the caller
        ColorPrint.yellow(f"[result_cache] get_json {namespace} failed: {e}")
        return None


def _set_json(namespace: str, value: Any, *parts: Any,
              ttl: Optional[float] = None, version: str = "1",
              max_entries: int = _DEFAULT_MAX_ENTRIES) -> None:
    """Store a JSON-serializable value under these key parts (best-effort)."""
    try:
        ns_dir = _ns_dir(namespace)
        path = ns_dir / f"{_key_hash(parts, version)}.json"
        doc = {"value": value, "ts": time.time(), "ttl": ttl, "version": version,
               "key": "\x1f".join("" if p is None else str(p) for p in parts)[:512]}
        _atomic_write_bytes(path, json.dumps(doc, ensure_ascii=False).encode("utf-8"))
        _prune(ns_dir, max_entries)
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[result_cache] set_json {namespace} failed: {e}")


# --------------------------------------------------------------------------- #
# Binary cache (large results: cover/poster images, TTS audio)                 #
# --------------------------------------------------------------------------- #
def _get_bytes_path(namespace: str, *parts: Any, version: str = "1") -> Optional[str]:
    """Return the on-disk path for a cached binary entry, or None (miss/expired)."""
    try:
        h = _key_hash(parts, version)
        ns_dir = _ns_dir(namespace)
        bin_path = ns_dir / f"{h}.bin"
        meta_path = ns_dir / f"{h}.meta.json"
        if not bin_path.is_file() or not meta_path.is_file():
            return None
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if not isinstance(meta, dict) or _expired(meta):
            return None
        return str(bin_path)
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[result_cache] get_bytes_path {namespace} failed: {e}")
        return None


def _get_bytes(namespace: str, *parts: Any, version: str = "1") -> Optional[Tuple[bytes, Dict[str, Any]]]:
    """Return (data, meta) for these key parts, or None (miss/expired). ``meta``
    carries whatever was stored at set time (mime, provider, ...)."""
    try:
        bin_path = _get_bytes_path(namespace, *parts, version=version)
        if not bin_path:
            return None
        h = _key_hash(parts, version)
        meta_path = _ns_dir(namespace) / f"{h}.meta.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        return Path(bin_path).read_bytes(), meta
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[result_cache] get_bytes {namespace} failed: {e}")
        return None


def _set_bytes(namespace: str, data: bytes, *parts: Any,
               ttl: Optional[float] = None, version: str = "1",
               meta: Optional[Dict[str, Any]] = None,
               max_entries: int = _DEFAULT_MAX_ENTRIES) -> None:
    """Store raw bytes + a small metadata sidecar under these key parts."""
    if not data:
        return
    try:
        ns_dir = _ns_dir(namespace)
        h = _key_hash(parts, version)
        _atomic_write_bytes(ns_dir / f"{h}.bin", data)
        doc = dict(meta or {})
        doc.update({"ts": time.time(), "ttl": ttl, "version": version,
                    "bytes": len(data)})
        _atomic_write_bytes(ns_dir / f"{h}.meta.json",
                            json.dumps(doc, ensure_ascii=False).encode("utf-8"))
        _prune(ns_dir, max_entries)
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[result_cache] set_bytes {namespace} failed: {e}")


# --------------------------------------------------------------------------- #
# Introspection / maintenance                                                 #
# --------------------------------------------------------------------------- #
def _stats() -> Dict[str, Any]:
    """Per-namespace {entries, bytes} rollup for a UI / diagnostics."""
    out: Dict[str, Any] = {"root": str(_ROOT), "namespaces": {}}
    try:
        if not _ROOT.exists():
            return out
        for ns in _ROOT.iterdir():
            if not ns.is_dir():
                continue
            entries = 0
            total = 0
            for p in ns.iterdir():
                if p.suffix in (".json", ".bin") and not p.name.endswith(".meta.json"):
                    entries += 1
                try:
                    total += p.stat().st_size
                except OSError:
                    pass
            out["namespaces"][ns.name] = {"entries": entries, "bytes": total}
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[result_cache] stats failed: {e}")
    return out


def _clear(namespace: Optional[str] = None) -> int:
    """Delete every entry in one namespace (or all). Returns files removed."""
    removed = 0
    try:
        targets: List[Path] = []
        if namespace:
            namespace_dir = _ROOT / namespace
            if namespace_dir.is_dir():
                targets = list(namespace_dir.iterdir())
        elif _ROOT.exists():
            for namespace_dir in _ROOT.iterdir():
                if namespace_dir.is_dir():
                    targets.extend(namespace_dir.iterdir())
        for path in targets:
            try:
                path.unlink()
                removed += 1
            except OSError:
                pass
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[result_cache] clear failed: {e}")
    return removed


def get_json(namespace: str, *parts: Any, version: str = "1") -> Optional[Any]:
    """Read a JSON entry through the cache-owner thread."""
    return call_serialized(_CACHE_QUEUE, _get_json, namespace, *parts, version=version)


def set_json(namespace: str, value: Any, *parts: Any,
             ttl: Optional[float] = None, version: str = "1",
             max_entries: int = _DEFAULT_MAX_ENTRIES) -> None:
    """Write a JSON entry through the cache-owner thread."""
    call_serialized(
        _CACHE_QUEUE,
        _set_json,
        namespace,
        value,
        *parts,
        ttl=ttl,
        version=version,
        max_entries=max_entries,
    )


def get_bytes_path(namespace: str, *parts: Any, version: str = "1") -> Optional[str]:
    """Read a binary entry path through the cache-owner thread."""
    return call_serialized(
        _CACHE_QUEUE,
        _get_bytes_path,
        namespace,
        *parts,
        version=version,
    )


def get_bytes(namespace: str, *parts: Any,
              version: str = "1") -> Optional[Tuple[bytes, Dict[str, Any]]]:
    """Read a binary entry through the cache-owner thread."""
    return call_serialized(
        _CACHE_QUEUE,
        _get_bytes,
        namespace,
        *parts,
        version=version,
    )


def set_bytes(namespace: str, data: bytes, *parts: Any,
              ttl: Optional[float] = None, version: str = "1",
              meta: Optional[Dict[str, Any]] = None,
              max_entries: int = _DEFAULT_MAX_ENTRIES) -> None:
    """Write a binary entry through the cache-owner thread."""
    call_serialized(
        _CACHE_QUEUE,
        _set_bytes,
        namespace,
        data,
        *parts,
        ttl=ttl,
        version=version,
        meta=meta,
        max_entries=max_entries,
    )


def stats() -> Dict[str, Any]:
    """Read cache statistics through the cache-owner thread."""
    return call_serialized(_CACHE_QUEUE, _stats)


def clear(namespace: Optional[str] = None) -> int:
    """Clear cache entries through the cache-owner thread."""
    return call_serialized(_CACHE_QUEUE, _clear, namespace)


__all__ = [
    "get_json", "set_json", "get_bytes", "get_bytes_path", "set_bytes", "stats", "clear",
]
