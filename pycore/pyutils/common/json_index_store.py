# -*- coding: utf-8 -*-
"""Bounded JSON index/history store: one newest-last ``entries`` ring in one
JSON file, optional per-entry blob files, atomic whole-file replacement, and a
dedicated THREAD_BUS state owner serializing every read-modify-write.

File shape (shared with other runtimes, keep stable):
    {"version": 1, "saved_at": <epoch s>, "entries": [...], <extra keys>}
"""

import json
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.atomic_json_store import atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.keyset_cursor import KeysetKey, keyset_page

INDEX_VERSION = 1


class JsonIndexStore:
    """``directory`` resolves the state dir lazily; ``blob_key`` names the entry
    field holding a blob path relative to that dir (dropped entries lose their
    blob); ``seed`` returns the newest-last entries of a previous storage
    location once, when the index file does not exist yet (one-shot migration)."""

    def __init__(
        self,
        file_name: str,
        directory: Callable[[], Path],
        max_entries: int,
        tag: str,
        blob_key: Optional[str] = None,
        extra_defaults: Optional[Callable[[], Dict[str, Any]]] = None,
        id_key: str = "id",
        seed: Optional[Callable[[], List[Dict[str, Any]]]] = None,
        seed_done: Optional[Callable[[], None]] = None,
    ) -> None:
        self.file_name = file_name
        self.directory = directory
        self.max_entries = int(max_entries)
        self.tag = tag
        self.blob_key = blob_key
        self.extra_defaults = extra_defaults
        self.id_key = id_key
        self.seed = seed
        self.seed_done = seed_done
        init_serialized_owner(self, f"pyutils.json_index_store.{tag}", f"JsonIndexStore-{tag}")

    def path(self) -> Path:
        return self.directory() / self.file_name

    def blob_path(self, relative: str) -> Path:
        return self.directory() / relative

    def _fresh(self) -> Dict[str, Any]:
        doc: Dict[str, Any] = {"version": INDEX_VERSION, "saved_at": 0.0, "entries": []}
        if self.extra_defaults is not None:
            doc.update(self.extra_defaults())
        return doc

    def _read(self) -> Dict[str, Any]:
        path = self.path()
        if not path.is_file():
            return self._seeded()
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[{self.tag}] index {path} unreadable ({exc}); starting fresh")
            return self._fresh()
        if not isinstance(data, dict) or not isinstance(data.get("entries"), list):
            ColorPrint.yellow(f"[{self.tag}] index {path} has no entries list; starting fresh")
            return self._fresh()
        for name, value in self._fresh().items():
            data.setdefault(name, value)
        return data

    def _seeded(self) -> Dict[str, Any]:
        doc = self._fresh()
        legacy = self.seed() if self.seed is not None else []
        if legacy:
            doc["entries"] = list(legacy)
            self._trim(doc)
            if self._write(doc) and self.seed_done is not None:
                self.seed_done()
        return doc

    def _write(self, doc: Dict[str, Any]) -> bool:
        doc["saved_at"] = time.time()
        path = self.path()
        try:
            atomic_write_json(path, doc, indent=None)
        except OSError as exc:
            ColorPrint.yellow(f"[{self.tag}] index write {path} failed: {exc}")
            return False
        return True

    def _remove_blob(self, entry: Dict[str, Any]) -> None:
        relative = entry.get(self.blob_key) if self.blob_key else None
        if not relative:
            return
        path = self.blob_path(str(relative))
        try:
            path.unlink(missing_ok=True)
        except OSError as exc:
            ColorPrint.yellow(f"[{self.tag}] blob delete {path} failed: {exc}")

    def _trim(self, doc: Dict[str, Any]) -> None:
        entries = doc["entries"]
        overflow = len(entries) - self.max_entries
        if overflow <= 0:
            return
        for entry in entries[:overflow]:
            self._remove_blob(entry)
        doc["entries"] = entries[overflow:]

    @serialized_method
    def document(self) -> Dict[str, Any]:
        return self._read()

    @serialized_method
    def append(self, entry: Dict[str, Any], blob: Optional[bytes] = None) -> Optional[Dict[str, Any]]:
        """Persist ``entry`` (and its blob first); None when the blob write fails."""
        if blob is not None and self.blob_key:
            path = self.blob_path(str(entry[self.blob_key]))
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(blob)
            except OSError as exc:
                ColorPrint.yellow(f"[{self.tag}] blob write {path} failed: {exc}")
                return None
        doc = self._read()
        doc["entries"].append(entry)
        self._trim(doc)
        self._write(doc)
        return entry

    @serialized_method
    def mutate(self, change: Callable[[Dict[str, Any]], Any]) -> Any:
        """Run ``change(doc)`` as one read-modify-write; returns its result."""
        doc = self._read()
        result = change(doc)
        self._trim(doc)
        self._write(doc)
        return result

    @serialized_method
    def entries(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Newest-first entries, at most ``limit``."""
        rows = list(reversed(self._read()["entries"]))
        return rows if limit is None else rows[:max(0, int(limit))]

    def page(
        self,
        after: Optional[KeysetKey],
        limit: int,
        sort_field: str = "ts",
        keep: Optional[Callable[[Dict[str, Any]], bool]] = None,
    ) -> Dict[str, Any]:
        """One newest-first keyset page ``{items, next_cursor, has_more, total}``
        keyed by ``(sort_field, id_key)``; ``keep`` filters the rows first."""
        rows = [row for row in self.entries() if keep is None or keep(row)]
        page = keyset_page(
            rows, after, limit,
            lambda row: (row.get(sort_field) or 0, str(row.get(self.id_key) or "")),
        )
        page["total"] = len(rows)
        return page

    @serialized_method
    def find(self, entry_id: str) -> Optional[Dict[str, Any]]:
        return next(
            (entry for entry in self._read()["entries"] if str(entry.get(self.id_key)) == str(entry_id)),
            None,
        )

    @serialized_method
    def delete(self, entry_id: str) -> Optional[Dict[str, Any]]:
        """Remove one entry (and its blob); returns it, or None when absent."""
        if not entry_id:
            return None
        doc = self._read()
        removed = next(
            (entry for entry in doc["entries"] if str(entry.get(self.id_key)) == str(entry_id)),
            None,
        )
        if removed is None:
            return None
        doc["entries"] = [entry for entry in doc["entries"] if entry is not removed]
        self._write(doc)
        self._remove_blob(removed)
        return removed

    @serialized_method
    def clear(self, reset: Optional[Callable[[Dict[str, Any]], None]] = None) -> int:
        """Remove every entry (and blob); ``reset`` may clear extra keys too."""
        doc = self._read()
        removed = doc["entries"]
        for entry in removed:
            self._remove_blob(entry)
        doc["entries"] = []
        if reset is not None:
            reset(doc)
        self._write(doc)
        return len(removed)

    @serialized_method
    def count(self) -> int:
        return len(self._read()["entries"])

    @serialized_method
    def revision(self) -> str:
        path = self.path()
        if not path.is_file():
            return "0:0"
        stat = path.stat()
        return f"{stat.st_mtime_ns}:{stat.st_size}"


__all__ = ["JsonIndexStore"]
