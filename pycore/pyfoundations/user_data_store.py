#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
User Data Store Module

Single canonical place for pycore user data: one JSON file under
``get_app_config_dir()`` (from :mod:`system_paths`), organized into named
sections, with optional per-feature ``<name>.json`` / ``<name>.ini`` overrides.

This was originally a standalone module, later merged into ``system_paths``
(see the former "merged from the former user_data_store module" comment), and is
now split back out as part of the ``system_paths`` modularization.

CIRCULAR-IMPORT NOTE: ``UserDataStore`` depends on ``get_app_config_dir`` from
``system_paths``, and ``system_paths`` re-exports ``UserDataStore`` /
``get_user_data_store`` from here. To break the cycle, ``get_app_config_dir`` is
imported LAZILY (function-local) -- there is NO top-level ``system_paths``
import in this module, so importing ``user_data_store`` first (or having
``system_paths`` import it at the bottom of its body) never deadlocks.
"""

import os
import sys
import json
import time
import threading
import configparser
from pathlib import Path
from typing import Optional, Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


# Canonical store file name inside the config directory.
STORE_FILE_NAME = "user_data.json"


def _get_app_config_dir() -> Path:
    """Resolve the app config dir lazily (avoids circular import with system_paths)."""
    from pycore.pyfoundations.system_paths import get_app_config_dir
    return get_app_config_dir()


class UserDataStore:
    r"""
    Thread-safe, file-backed user data store.

    Sections are top-level keys of the JSON document, each holding a dict. Use
    :meth:`get` / :meth:`set` for single values and :meth:`get_section` /
    :meth:`update_section` for whole sections.
    """

    def __init__(self, base_dir: Optional[Path] = None, file_name: str = STORE_FILE_NAME):
        self._base_dir = Path(base_dir) if base_dir else _get_app_config_dir()
        self._path = self._base_dir / file_name
        self._lock = threading.RLock()
        self._data: Optional[Dict[str, Any]] = None  # loaded lazily

    # --- paths ------------------------------------------------------------- #
    @property
    def path(self) -> Path:
        """Absolute path of the canonical store file."""
        return self._path

    @property
    def base_dir(self) -> Path:
        """Directory that holds the store and any per-feature config files."""
        return self._base_dir

    # --- low-level load / save -------------------------------------------- #
    def _ensure_loaded(self) -> Dict[str, Any]:
        """Load the store from disk once; return the in-memory document."""
        if self._data is not None:
            return self._data
        with self._lock:
            if self._data is not None:
                return self._data
            data: Dict[str, Any] = {}
            try:
                if self._path.exists():
                    with self._path.open("r", encoding="utf-8") as fh:
                        loaded = json.load(fh)
                    if isinstance(loaded, dict):
                        data = loaded
                    else:
                        ColorPrint.yellow(
                            f"[UserDataStore] {self._path} is not an object; ignoring."
                        )
            except Exception as exc:  # corrupt file: keep a backup, start fresh
                ColorPrint.yellow(f"[UserDataStore] Failed to read {self._path}: {exc}")
                self._backup_corrupt_file()
                data = {}
            self._data = data
            return self._data

    def _backup_corrupt_file(self) -> None:
        """Rename an unreadable store file aside so the user can inspect it."""
        try:
            if self._path.exists():
                bad = self._path.with_suffix(self._path.suffix + ".corrupt")
                os.replace(str(self._path), str(bad))
                ColorPrint.yellow(f"[UserDataStore] Backed up corrupt store to {bad}")
        except Exception:
            pass

    def save(self) -> None:
        """Atomically persist the in-memory document to disk."""
        with self._lock:
            data = self._data if self._data is not None else {}
            try:
                self._base_dir.mkdir(parents=True, exist_ok=True)
                tmp = self._path.with_suffix(self._path.suffix + ".tmp")
                with tmp.open("w", encoding="utf-8") as fh:
                    json.dump(data, fh, ensure_ascii=False, indent=2, sort_keys=True)
                    fh.flush()
                    os.fsync(fh.fileno())
                os.replace(str(tmp), str(self._path))
                # World-writable on Linux so ANY user can overwrite this shared
                # state file (the dir is 1777, but a 0644 file written by another
                # user would otherwise block updates).
                if sys.platform != 'win32':
                    try:
                        os.chmod(str(self._path), 0o666)
                    except OSError:
                        pass
            except Exception as exc:
                ColorPrint.red(f"[UserDataStore] Failed to save {self._path}: {exc}")

    def reload(self) -> None:
        """Drop the in-memory cache so the next access re-reads from disk."""
        with self._lock:
            self._data = None

    # --- section / value access ------------------------------------------- #
    def get_section(self, namespace: str) -> Dict[str, Any]:
        """Return a *copy* of a section dict (empty dict if absent)."""
        with self._lock:
            data = self._ensure_loaded()
            section = data.get(namespace)
            return dict(section) if isinstance(section, dict) else {}

    def set_section(self, namespace: str, value: Dict[str, Any]) -> None:
        """Replace a whole section and persist."""
        with self._lock:
            data = self._ensure_loaded()
            data[namespace] = dict(value or {})
            self.save()

    def update_section(self, namespace: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        """Shallow-merge ``patch`` into a section and persist; return the section."""
        with self._lock:
            data = self._ensure_loaded()
            section = data.get(namespace)
            if not isinstance(section, dict):
                section = {}
            section.update(patch or {})
            data[namespace] = section
            self.save()
            return dict(section)

    def get(self, namespace: str, key: Optional[str] = None, default: Any = None) -> Any:
        """
        Read a value. With ``key`` omitted, returns a copy of the whole section
        (or ``default`` if the section is absent).
        """
        with self._lock:
            data = self._ensure_loaded()
            section = data.get(namespace)
            if key is None:
                if isinstance(section, dict):
                    return dict(section)
                return default
            if isinstance(section, dict) and key in section:
                return section[key]
            return default

    def set(self, namespace: str, key: str, value: Any) -> None:
        """Set a single value inside a section and persist."""
        with self._lock:
            data = self._ensure_loaded()
            section = data.get(namespace)
            if not isinstance(section, dict):
                section = {}
            section[key] = value
            data[namespace] = section
            self.save()

    def delete(self, namespace: str, key: Optional[str] = None) -> None:
        """Remove a key (or an entire section when ``key`` is omitted)."""
        with self._lock:
            data = self._ensure_loaded()
            if key is None:
                data.pop(namespace, None)
            else:
                section = data.get(namespace)
                if isinstance(section, dict):
                    section.pop(key, None)
            self.save()

    def as_dict(self) -> Dict[str, Any]:
        """Return a shallow copy of the whole document."""
        with self._lock:
            return dict(self._ensure_loaded())

    # --- content-ingest history (capped ring) ----------------------------- #
    def record_content_history(self, entry: Dict[str, Any], cap: int = 200) -> None:
        """Append ONE content-ingest history entry to the capped ring and persist.

        Cross-feature history of book / subtitle / document ingests, stored under
        the ``content_history`` section as ``{"entries": [...]}`` (newest LAST).
        Each entry is expected to carry ``{type, source_key, path, title,
        languages, counts, status, ts}`` but is stored as-given (a missing ``ts``
        is stamped with the current time). The ring keeps only the last ``cap``
        entries; same-``source_key``+``type`` is de-duplicated (the newer record
        replaces the older) so re-syncs update in place rather than growing the
        ring. Never raises - a bad entry is ignored.
        """
        if not isinstance(entry, dict):
            return
        with self._lock:
            data = self._ensure_loaded()
            section = data.get("content_history")
            if not isinstance(section, dict):
                section = {}
            entries = section.get("entries")
            if not isinstance(entries, list):
                entries = []
            rec = dict(entry)
            if not rec.get("ts"):
                rec["ts"] = time.time()
            key = (rec.get("source_key"), rec.get("type"))
            if key != (None, None):
                entries = [e for e in entries
                           if (e.get("source_key"), e.get("type")) != key]
            entries.append(rec)
            if cap and len(entries) > cap:
                entries = entries[-cap:]
            section["entries"] = entries
            data["content_history"] = section
            self.save()

    def get_content_history(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Return content-ingest history entries (newest FIRST).

        ``limit`` caps the number returned (most-recent first). Returns [] when no
        history exists.
        """
        with self._lock:
            data = self._ensure_loaded()
            section = data.get("content_history")
            entries = section.get("entries") if isinstance(section, dict) else None
            if not isinstance(entries, list):
                return []
            ordered = list(reversed(entries))
            if limit and limit > 0:
                return ordered[:limit]
            return ordered

    # --- per-feature differentiated config (json / ini) ------------------- #
    def feature_config_path(self, name: str, ext: str = "json") -> Path:
        """Path of a sibling per-feature config file (e.g. ``video_extract.json``)."""
        return self._base_dir / f"{name}.{ext.lstrip('.')}"

    def load_feature_config(self, name: str) -> Dict[str, Any]:
        r"""
        Load a feature's effective config: the matching store section with an
        optional ``<name>.json`` or ``<name>.ini`` file merged on top.

        Precedence (low -> high): store section < ``<name>.ini`` < ``<name>.json``.
        Missing files are simply skipped, so this always returns a dict.
        """
        result = self.get_section(name)

        ini_path = self.feature_config_path(name, "ini")
        if ini_path.exists():
            try:
                parser = configparser.ConfigParser()
                parser.read(ini_path, encoding="utf-8")
                # Flatten: DEFAULT section keys at top level, others as nested dicts.
                for key, val in parser.defaults().items():
                    result[key] = val
                for sect in parser.sections():
                    result[sect] = dict(parser.items(sect))
            except Exception as exc:
                ColorPrint.yellow(f"[UserDataStore] Failed to read {ini_path}: {exc}")

        json_path = self.feature_config_path(name, "json")
        if json_path.exists():
            try:
                with json_path.open("r", encoding="utf-8") as fh:
                    loaded = json.load(fh)
                if isinstance(loaded, dict):
                    result.update(loaded)
            except Exception as exc:
                ColorPrint.yellow(f"[UserDataStore] Failed to read {json_path}: {exc}")

        return result

    def save_feature_config(self, name: str, data: Dict[str, Any]) -> None:
        """Write a feature's differentiated config to ``<name>.json`` (atomic)."""
        with self._lock:
            try:
                self._base_dir.mkdir(parents=True, exist_ok=True)
                path = self.feature_config_path(name, "json")
                tmp = path.with_suffix(path.suffix + ".tmp")
                with tmp.open("w", encoding="utf-8") as fh:
                    json.dump(dict(data or {}), fh, ensure_ascii=False, indent=2, sort_keys=True)
                    fh.flush()
                    os.fsync(fh.fileno())
                os.replace(str(tmp), str(path))
                if sys.platform != 'win32':
                    try:
                        os.chmod(str(path), 0o666)
                    except OSError:
                        pass
            except Exception as exc:
                ColorPrint.red(f"[UserDataStore] Failed to save feature config {name}: {exc}")


# --- module-level singleton ----------------------------------------------- #
_store_lock = threading.Lock()
_store_singleton: Optional[UserDataStore] = None


def get_user_data_store() -> UserDataStore:
    """Return the process-wide :class:`UserDataStore` singleton."""
    global _store_singleton
    if _store_singleton is None:
        with _store_lock:
            if _store_singleton is None:
                _store_singleton = UserDataStore()
    return _store_singleton


__all__ = [
    'UserDataStore',
    'get_user_data_store',
    'STORE_FILE_NAME',
]
