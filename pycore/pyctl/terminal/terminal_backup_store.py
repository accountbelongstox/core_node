# -*- coding: utf-8 -*-
"""Unified terminal text archive: pass folders (<stamp>/manifest.json) point into per-terminal blobs (blobs/terminal-<n>/) that are deduplicated by content and stored as bounded delta chains."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import threading
import time
from collections import OrderedDict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from pycore.pyfoundations.atomic_json_store import atomic_write_bytes, atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyctl.terminal.terminal_capture_store import NAME_TIME_FORMAT, encode_capture
from pycore.pyutils.common.relay_contract import relay_contract

TERMINAL_BACKUP_DIR_NAME = "terminal_backup"
TERMINAL_BACKUP_RETAIN_COUNT = relay_contract.limit("terminal_backup_retain_count")
TERMINAL_BACKUP_RETAIN_SECONDS = relay_contract.limit("terminal_backup_retain_seconds")
MANIFEST_NAME = "manifest.json"
MANIFEST_FOLLOW_UP_KEY = "follow_up"
FILE_NAME_TEMPLATE = "terminal-{number}.txt"
FOLDER_NAME_PATTERN = re.compile(r"^\d{8}-\d{6}(?:-\d+)?$", re.ASCII)
TERMINAL_FILE_PATTERN = re.compile(r"^terminal-\d+\.txt$", re.ASCII)
LAST_PASS_FILE_NAME = "schedule.json"
LAST_PASS_KEY = "last_pass_at"
BLOB_ROOT_NAME = "blobs"
BLOB_DIR_TEMPLATE = "terminal-{number}"
BLOB_DIR_PATTERN = re.compile(r"^terminal-(\d+)$", re.ASCII)
BLOB_FILE_TEMPLATE = "{digest}.{kind}"
BLOB_FILE_PATTERN = re.compile(r"^[0-9a-f]{64}\.(?:full|delta)$", re.ASCII)
BLOB_INDEX_NAME = "index.json"
BLOB_INDEX_VERSION = 1
RESTORE_DIR_NAME = "restore"
KIND_FULL = "full"
KIND_DELTA = "delta"
KIND_SAME = "same"
DELTA_CHAIN_MAX = 8
READ_CACHE_MAX_BYTES = 32 * 1024 * 1024
MANIFEST_CACHE_SLACK = 32
MILLISECONDS_PER_SECOND = 1000
FOLDER_STAMP_LENGTH = 15
BYTES_PER_KILOBYTE = 1024
TEXT_ENCODING = "utf-8"
TEXT_ERRORS = "replace"
LABEL = "TerminalBackupStore"
ERROR_BACKUP_WRITE_FAILED = "terminal_backup_write_failed"
ERROR_BACKUP_NOT_FOUND = "terminal_backup_not_found"
ERROR_BACKUP_TERMINAL_NOT_FOUND = "terminal_backup_terminal_not_found"
ERROR_BACKUP_DELETE_FAILED = "terminal_backup_delete_failed"
ERROR_BACKUP_READ_FAILED = "terminal_backup_read_failed"
ERROR_BACKUP_NO_FILES = "terminal_backup_no_files"


def encode_text(text: str) -> bytes:
    return text.encode(TEXT_ENCODING, TEXT_ERRORS)


def bytes_digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def text_digest(text: str) -> str:
    return bytes_digest(encode_text(text))


def inputs_digest(inputs: Sequence[Dict[str, Any]]) -> str:
    if not inputs:
        return ""
    return hashlib.sha256(
        json.dumps(list(inputs), ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()


def kilobytes(byte_count: int) -> int:
    return max(1, round(byte_count / BYTES_PER_KILOBYTE)) if byte_count > 0 else 0


def positive_int(raw: Any) -> Optional[int]:
    """Positive integer from a JSON number or digit string; bool and everything else is invalid."""
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw if raw > 0 else None
    text = str(raw).strip() if isinstance(raw, str) else ""
    return int(text) if text.isascii() and text.isdigit() and int(text) > 0 else None


def normalized_text(data: bytes) -> str:
    return data.decode(TEXT_ENCODING, TEXT_ERRORS).replace("\r\n", "\n")


class TerminalBackupStore:
    def __init__(self, directory: Path) -> None:
        self.directory = directory
        self.lock = threading.RLock()
        self._read_cache: "OrderedDict[Tuple[int, str], bytes]" = OrderedDict()
        self._read_cache_bytes = 0
        self._manifest_cache: Dict[str, Tuple[int, int, Dict[str, Any]]] = {}
        self._gc_pending = True

    # ---- folders and manifests -------------------------------------------------

    def folder_names(self) -> List[str]:
        try:
            return sorted(
                (
                    entry.name
                    for entry in self.directory.iterdir()
                    if entry.is_dir(follow_symlinks=False) and FOLDER_NAME_PATTERN.fullmatch(entry.name)
                ),
                reverse=True,
            )
        except OSError:
            return []

    def read_manifest(self, folder: Path) -> Optional[Dict[str, Any]]:
        """Parsed manifest, cached by file stamp; the returned dict is shared and must not be mutated."""
        path = folder / MANIFEST_NAME
        try:
            stat = path.stat()
        except OSError:
            self._manifest_cache.pop(folder.name, None)
            return None
        stamp = (stat.st_mtime_ns, stat.st_size)
        cached = self._manifest_cache.get(folder.name)
        if cached is not None and cached[:2] == stamp:
            return cached[2]
        try:
            manifest = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        if not isinstance(manifest, dict):
            return None
        self._manifest_cache[folder.name] = (stamp[0], stamp[1], manifest)
        return manifest

    def list_manifests(self) -> List[Tuple[str, Path, Dict[str, Any]]]:
        """Newest first: (folder id, folder, manifest) of every folder that holds a readable manifest."""
        names = self.folder_names()
        listed = []
        for name in names:
            folder = self.directory / name
            manifest = self.read_manifest(folder)
            if manifest is not None:
                listed.append((name, folder, manifest))
        if len(self._manifest_cache) > len(names) + MANIFEST_CACHE_SLACK:
            alive = set(names)
            self._manifest_cache = {key: value for key, value in self._manifest_cache.items() if key in alive}
        return listed

    @staticmethod
    def manifest_entries(manifest: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            entry
            for entry in manifest.get("terminals") or []
            if isinstance(entry, dict) and positive_int(entry.get("number")) is not None
        ]

    def folder_path(self, folder_id: Any) -> Optional[Path]:
        if not isinstance(folder_id, str) or FOLDER_NAME_PATTERN.fullmatch(folder_id) is None:
            return None
        folder = self.directory / folder_id
        return folder if folder.is_dir() and not folder.is_symlink() else None

    @staticmethod
    def created_at_ms(folder_id: str, manifest: Dict[str, Any]) -> int:
        try:
            created = datetime.fromisoformat(str(manifest.get("created_at")))
        except ValueError:
            created = datetime.strptime(folder_id[:FOLDER_STAMP_LENGTH], NAME_TIME_FORMAT)
        return int(created.timestamp() * MILLISECONDS_PER_SECOND)

    def last_pass_at(self) -> Optional[float]:
        try:
            state = json.loads((self.directory / LAST_PASS_FILE_NAME).read_text(encoding="utf-8"))
            return float(state[LAST_PASS_KEY])
        except (OSError, ValueError, TypeError, KeyError):
            return None

    def record_pass(self, timestamp: float) -> None:
        try:
            atomic_write_json(self.directory / LAST_PASS_FILE_NAME, {LAST_PASS_KEY: timestamp})
        except OSError as exc:
            ColorPrint.yellow(f"[{LABEL}] last pass record failed: {exc}")

    def previous_signatures(self) -> Dict[int, str]:
        for _name, _folder, manifest in self.list_manifests():
            return {
                int(entry["number"]): str(entry.get("sha256") or entry.get("inputs_sha256") or "")
                for entry in self.manifest_entries(manifest)
            }
        return {}

    def latest(self) -> Optional[Dict[str, Any]]:
        """Newest folder that holds a readable manifest: {id, path, manifest, terminals (entries with readable text)}."""
        for name, folder, manifest in self.list_manifests():
            return {
                "id": name,
                "path": folder,
                "manifest": manifest,
                "terminals": self.readable_entries(folder, manifest),
            }
        return None

    def readable_entries(self, folder: Path, manifest: Dict[str, Any]) -> List[Dict[str, Any]]:
        with self.lock:
            return [
                entry
                for entry in self.manifest_entries(manifest)
                if not entry.get("error_code") and self._has_text(folder, entry)
            ]

    def _has_text(self, folder: Path, entry: Dict[str, Any]) -> bool:
        number = int(entry["number"])
        digest = str(entry.get("sha256") or "")
        if digest:
            meta = self._load_index(number)["blobs"].get(digest)
            if meta is not None and self._blob_path(number, digest, meta).is_file():
                return True
        return self._legacy_path(folder, number) is not None

    # ---- blob index -----------------------------------------------------------

    def _blob_dir(self, number: int) -> Path:
        return self.directory / BLOB_ROOT_NAME / BLOB_DIR_TEMPLATE.format(number=int(number))

    def _blob_path(self, number: int, digest: str, meta: Dict[str, Any]) -> Path:
        return self._blob_dir(number) / BLOB_FILE_TEMPLATE.format(digest=digest, kind=meta["kind"])

    @staticmethod
    def _empty_index() -> Dict[str, Any]:
        return {"version": BLOB_INDEX_VERSION, "head": None, "blobs": {}}

    def _load_index(self, number: int) -> Dict[str, Any]:
        path = self._blob_dir(number) / BLOB_INDEX_NAME
        try:
            index = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return self._empty_index()
        if not isinstance(index, dict) or not isinstance(index.get("blobs"), dict):
            return self._empty_index()
        index.setdefault("head", None)
        return index

    def _store_index(self, number: int, index: Dict[str, Any]) -> None:
        atomic_write_json(self._blob_dir(number) / BLOB_INDEX_NAME, index, indent=None)

    @staticmethod
    def _legacy_path(folder: Path, number: int) -> Optional[Path]:
        path = folder / FILE_NAME_TEMPLATE.format(number=int(number))
        return path if path.is_file() and not path.is_symlink() else None

    # ---- write ------------------------------------------------------------------

    def _put(self, number: int, data: bytes) -> Dict[str, Any]:
        """Store one text; returns {digest, kind, size, stored}. Identical text reuses its blob, a pure extension of the head stores only the increment."""
        digest = bytes_digest(data)
        index = self._load_index(number)
        blobs = index["blobs"]
        existing = blobs.get(digest)
        if existing is not None and self._blob_path(number, digest, existing).is_file():
            if index.get("head") != digest:
                index["head"] = digest
                self._store_index(number, index)
            return {"digest": digest, "kind": KIND_SAME, "size": len(data), "stored": 0}
        head = index.get("head")
        head_meta = blobs.get(head) if head else None
        meta: Dict[str, Any] = {"kind": KIND_FULL, "base": None, "depth": 0, "size": len(data)}
        payload = data
        if (
            head_meta is not None
            and 0 < int(head_meta["size"]) < len(data)
            and int(head_meta["depth"]) < DELTA_CHAIN_MAX
            and bytes_digest(data[: int(head_meta["size"])]) == head
            and self._blob_path(number, head, head_meta).is_file()
        ):
            meta.update(kind=KIND_DELTA, base=head, depth=int(head_meta["depth"]) + 1)
            payload = data[int(head_meta["size"]) :]
        meta["stored"] = len(payload)
        atomic_write_bytes(self._blob_path(number, digest, meta), payload)
        blobs[digest] = meta
        index["head"] = digest
        self._store_index(number, index)
        self._cache_put(number, digest, data)
        return {"digest": digest, "kind": meta["kind"], "size": len(data), "stored": len(payload)}

    def _new_folder(self) -> Path:
        base = datetime.now().strftime(NAME_TIME_FORMAT)
        name = base
        suffix = 1
        while (self.directory / name).exists():
            suffix += 1
            name = f"{base}-{suffix}"
        return self.directory / name

    def save(
        self,
        terminals: Sequence[Dict[str, Any]],
        merge_previous: bool = False,
        carry_numbers: Optional[Sequence[int]] = None,
    ) -> Dict[str, Any]:
        """terminals: {number, name, text?, error_code?, inputs?, changed?}; blobs land first, the manifest last.
        merge_previous (follow-up passes): carry the newest pass forward; consecutive follow-up passes rewrite one folder so they use a single retention slot.
        carry_numbers (interval passes that skip terminals): a new folder that keeps these terminals' newest entries (pointers only)."""
        with self.lock:
            folder: Optional[Path] = None
            entries_by_number: Dict[int, Dict[str, Any]] = {}
            if merge_previous or carry_numbers:
                previous = self.list_manifests()
                if previous:
                    _name, previous_folder, previous_manifest = previous[0]
                    entries_by_number = {
                        int(entry["number"]): {**entry, "changed": False}
                        for entry in self.manifest_entries(previous_manifest)
                        if merge_previous or int(entry["number"]) in set(carry_numbers or ())
                    }
                    if merge_previous and previous_manifest.get(MANIFEST_FOLLOW_UP_KEY):
                        folder = previous_folder
                        self._gc_pending = True
            if folder is None:
                folder = self._new_folder()
            try:
                for terminal in terminals:
                    entry: Dict[str, Any] = {
                        "number": int(terminal["number"]),
                        "name": str(terminal.get("name") or ""),
                        "bytes": 0,
                        "stored_bytes": 0,
                        "changed": bool(terminal.get("changed")),
                    }
                    text = terminal.get("text")
                    if text is not None:
                        put = self._put(entry["number"], encode_text(text))
                        entry.update(bytes=put["size"], stored_bytes=put["stored"], kind=put["kind"], sha256=put["digest"])
                    if terminal.get("error_code"):
                        entry["error_code"] = str(terminal["error_code"])
                    inputs = list(terminal.get("inputs") or [])
                    if inputs:
                        entry["inputs"] = inputs
                        entry["inputs_sha256"] = inputs_digest(inputs)
                    entries_by_number[entry["number"]] = entry
                entries = list(entries_by_number.values())
                manifest = {"created_at": datetime.now().astimezone().isoformat(timespec="seconds")}
                if merge_previous:
                    manifest[MANIFEST_FOLLOW_UP_KEY] = True
                manifest.update(self._summary(entries))
                atomic_write_json(folder / MANIFEST_NAME, manifest)
            except OSError as exc:
                self._gc_pending = True
                ColorPrint.yellow(f"[{LABEL}] write failed folder={folder}: {exc}")
                return {"success": False, "error_code": ERROR_BACKUP_WRITE_FAILED}
            self.prune()
            return {
                "success": True,
                "path": str(folder),
                "terminal_count": manifest["terminal_count"],
                "total_bytes": manifest["total_bytes"],
                "stored_bytes": manifest["stored_bytes"],
            }

    @staticmethod
    def _summary(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "terminal_count": sum(1 for entry in entries if "sha256" in entry),
            "total_bytes": sum(int(entry.get("bytes") or 0) for entry in entries),
            "stored_bytes": sum(int(entry.get("stored_bytes") or 0) for entry in entries),
            "terminals": entries,
        }

    # ---- read -------------------------------------------------------------------

    def _cache_put(self, number: int, digest: str, data: bytes) -> None:
        if len(data) > READ_CACHE_MAX_BYTES:
            return
        key = (number, digest)
        previous = self._read_cache.pop(key, None)
        if previous is not None:
            self._read_cache_bytes -= len(previous)
        self._read_cache[key] = data
        self._read_cache_bytes += len(data)
        while self._read_cache_bytes > READ_CACHE_MAX_BYTES and self._read_cache:
            _key, evicted = self._read_cache.popitem(last=False)
            self._read_cache_bytes -= len(evicted)

    def _cache_get(self, number: int, digest: str) -> Optional[bytes]:
        data = self._read_cache.get((number, digest))
        if data is not None:
            self._read_cache.move_to_end((number, digest))
        return data

    def _cache_drop(self, number: int, digests: Iterable[str]) -> None:
        for digest in digests:
            dropped = self._read_cache.pop((number, digest), None)
            if dropped is not None:
                self._read_cache_bytes -= len(dropped)

    def _reconstruct(self, number: int, digest: str) -> Optional[bytes]:
        """Full text bytes of one blob: the nearest cached or full ancestor plus the deltas on top of it."""
        cached = self._cache_get(number, digest)
        if cached is not None:
            return cached
        blobs = self._load_index(number)["blobs"]
        chain: List[Tuple[str, Dict[str, Any]]] = []
        seed = b""
        seen: Set[str] = set()
        current: Optional[str] = digest
        while current is not None:
            meta = blobs.get(current)
            if meta is None or current in seen or len(chain) > DELTA_CHAIN_MAX + 1:
                return None
            seen.add(current)
            chain.append((current, meta))
            if meta["kind"] == KIND_FULL:
                break
            current = meta.get("base")
            hit = self._cache_get(number, current) if current else None
            if hit is not None:
                seed = hit
                break
        parts = [seed]
        try:
            for blob_digest, meta in reversed(chain):
                parts.append(self._blob_path(number, blob_digest, meta).read_bytes())
        except OSError as exc:
            ColorPrint.yellow(f"[{LABEL}] blob read failed terminal={number} digest={digest[:12]}: {exc}")
            return None
        data = b"".join(parts)
        if bytes_digest(data) != digest:
            ColorPrint.yellow(f"[{LABEL}] blob digest mismatch terminal={number} digest={digest[:12]}")
            return None
        self._cache_put(number, digest, data)
        return data

    def read_entry_bytes(self, folder: Path, entry: Dict[str, Any]) -> Optional[bytes]:
        """Full text bytes of one manifest entry: blob chain first, the old terminal-<n>.txt file as fallback."""
        number = positive_int(entry.get("number"))
        if number is None:
            return None
        with self.lock:
            digest = str(entry.get("sha256") or "")
            data = self._reconstruct(number, digest) if digest else None
            if data is not None:
                return data
            path = self._legacy_path(folder, number)
            if path is None:
                return None
            try:
                return path.read_bytes()
            except OSError as exc:
                ColorPrint.yellow(f"[{LABEL}] read failed path={path}: {exc}")
                return None

    def find_entry(self, manifest: Dict[str, Any], number: int) -> Optional[Dict[str, Any]]:
        for entry in self.manifest_entries(manifest):
            if int(entry["number"]) == number:
                return entry
        return None

    def read_terminal(self, folder_id: Any, number: int) -> Dict[str, Any]:
        """{success, data (full text bytes), entry} or {success: False, error_code}."""
        folder = self.folder_path(folder_id)
        manifest = self.read_manifest(folder) if folder is not None else None
        if folder is None or manifest is None:
            return {"success": False, "error_code": ERROR_BACKUP_NOT_FOUND}
        entry = self.find_entry(manifest, number)
        if entry is None or entry.get("error_code"):
            return {"success": False, "error_code": ERROR_BACKUP_TERMINAL_NOT_FOUND}
        data = self.read_entry_bytes(folder, entry)
        if data is None:
            return {"success": False, "error_code": ERROR_BACKUP_READ_FAILED}
        return {"success": True, "data": data, "entry": entry}

    def export_files(self, folder_id: Any, numbers: Optional[Iterable[int]] = None) -> Dict[str, Any]:
        """Write full text files of a backup into the restore area (native line endings) for a text editor: {success, files} or {success: False, error_code}."""
        with self.lock:
            folder = self.folder_path(folder_id)
            manifest = self.read_manifest(folder) if folder is not None else None
            if folder is None or manifest is None:
                return {"success": False, "error_code": ERROR_BACKUP_NOT_FOUND}
            wanted = None if numbers is None else {int(number) for number in numbers}
            entries = [
                entry
                for entry in self.readable_entries(folder, manifest)
                if wanted is None or int(entry["number"]) in wanted
            ]
            if not entries:
                return {"success": False, "error_code": ERROR_BACKUP_NO_FILES if wanted is None else ERROR_BACKUP_TERMINAL_NOT_FOUND}
            root = self.directory / RESTORE_DIR_NAME
            self._clear_restore_area(root, keep=folder.name)
            target = root / folder.name
            files: List[Path] = []
            for entry in entries:
                data = self.read_entry_bytes(folder, entry)
                if data is None:
                    continue
                path = target / FILE_NAME_TEMPLATE.format(number=int(entry["number"]))
                try:
                    atomic_write_bytes(path, encode_capture(normalized_text(data)))
                except OSError as exc:
                    ColorPrint.yellow(f"[{LABEL}] restore write failed path={path}: {exc}")
                    continue
                files.append(path)
            if not files:
                return {"success": False, "error_code": ERROR_BACKUP_READ_FAILED}
            return {"success": True, "files": files}

    @staticmethod
    def _clear_restore_area(root: Path, keep: str) -> None:
        try:
            for entry in os.scandir(root):
                if entry.name != keep:
                    shutil.rmtree(entry.path, ignore_errors=True)
        except OSError:
            return

    def archive_stats(self) -> Dict[str, int]:
        """Physical blob usage of the archive: {blob_count, blob_bytes}."""
        count = 0
        total = 0
        try:
            with os.scandir(self.directory / BLOB_ROOT_NAME) as listing:
                numbers = [
                    int(match.group(1))
                    for entry in listing
                    if entry.is_dir(follow_symlinks=False) and (match := BLOB_DIR_PATTERN.fullmatch(entry.name))
                ]
        except OSError:
            return {"blob_count": 0, "blob_bytes": 0}
        for number in numbers:
            for meta in self._load_index(number)["blobs"].values():
                count += 1
                total += int(meta.get("stored") or 0)
        return {"blob_count": count, "blob_bytes": total}

    # ---- delete and retention ---------------------------------------------------

    def _unlink_folder(self, folder: Path) -> int:
        """Delete one pass folder (manifest first, so a partial delete leaves no listed folder); symlinks are unlinked, never followed. Returns the removed terminal entries."""
        removed = 0
        manifest = self.read_manifest(folder)
        if manifest is not None:
            removed = sum(1 for entry in self.manifest_entries(manifest) if "sha256" in entry)
        manifest_path = folder / MANIFEST_NAME
        if manifest_path.is_symlink() or manifest_path.exists():
            manifest_path.unlink()
        self._manifest_cache.pop(folder.name, None)
        for entry in os.scandir(folder):
            if entry.is_dir(follow_symlinks=False):
                raise OSError(f"unexpected directory {entry.path}")
            os.unlink(entry.path)
            if TERMINAL_FILE_PATTERN.fullmatch(entry.name) and manifest is None:
                removed += 1
        folder.rmdir()
        return removed

    def remove_folder(self, folder_id: Any) -> Dict[str, Any]:
        with self.lock:
            folder = self.folder_path(folder_id)
            if folder is None:
                return {"success": False, "error_code": ERROR_BACKUP_NOT_FOUND}
            deleted = 0
            try:
                deleted = self._unlink_folder(folder)
            except OSError as exc:
                ColorPrint.yellow(f"[{LABEL}] delete failed folder={folder}: {exc}")
                self._gc_pending = True
                return {"success": False, "error_code": ERROR_BACKUP_DELETE_FAILED, "deleted": deleted}
            self.collect_garbage()
            return {"success": True, "deleted": deleted, "folder_removed": True}

    def remove_terminal(self, folder_id: Any, number: int) -> Dict[str, Any]:
        """Drop one terminal entry from a pass (its shared blobs stay while referenced); the folder goes with its last entry."""
        with self.lock:
            folder = self.folder_path(folder_id)
            manifest = self.read_manifest(folder) if folder is not None else None
            if folder is None or manifest is None:
                return {"success": False, "error_code": ERROR_BACKUP_NOT_FOUND}
            entries = [entry for entry in manifest.get("terminals") or [] if isinstance(entry, dict)]
            remaining = [entry for entry in entries if entry.get("number") != number]
            legacy = self._legacy_path(folder, number)
            if len(remaining) == len(entries) and legacy is None:
                return {"success": False, "error_code": ERROR_BACKUP_TERMINAL_NOT_FOUND}
            if not remaining:
                return self.remove_folder(folder_id)
            try:
                if legacy is not None:
                    legacy.unlink()
                updated = dict(manifest)
                updated.update(self._summary(remaining))
                atomic_write_json(folder / MANIFEST_NAME, updated)
            except OSError as exc:
                ColorPrint.yellow(f"[{LABEL}] delete failed folder={folder} terminal={number}: {exc}")
                return {"success": False, "error_code": ERROR_BACKUP_DELETE_FAILED, "deleted": 0}
            self.collect_garbage()
            return {"success": True, "deleted": 1, "folder_removed": False}

    def prune(self) -> None:
        cutoff = time.time() - TERMINAL_BACKUP_RETAIN_SECONDS
        with self.lock:
            removed = False
            for index, name in enumerate(self.folder_names()):
                folder = self.directory / name
                try:
                    expired = folder.stat().st_mtime < cutoff
                except OSError:
                    continue
                if index < TERMINAL_BACKUP_RETAIN_COUNT and not expired:
                    continue
                try:
                    self._unlink_folder(folder)
                    removed = True
                except OSError as exc:
                    ColorPrint.yellow(f"[{LABEL}] prune failed folder={folder}: {exc}")
            if removed or self._gc_pending:
                self.collect_garbage()

    def collect_garbage(self) -> None:
        """Drop blobs that no remaining manifest points to, keeping every base of a referenced delta chain."""
        with self.lock:
            referenced: Dict[int, Set[str]] = {}
            for _name, _folder, manifest in self.list_manifests():
                for entry in self.manifest_entries(manifest):
                    if entry.get("sha256"):
                        referenced.setdefault(int(entry["number"]), set()).add(str(entry["sha256"]))
            root = self.directory / BLOB_ROOT_NAME
            try:
                directories = [
                    (int(match.group(1)), Path(entry.path))
                    for entry in os.scandir(root)
                    if entry.is_dir(follow_symlinks=False) and (match := BLOB_DIR_PATTERN.fullmatch(entry.name))
                ]
            except OSError:
                self._gc_pending = False
                return
            failed = False
            for number, directory in directories:
                failed = self._collect_terminal(number, directory, referenced.get(number, set())) or failed
            self._gc_pending = failed

    def _collect_terminal(self, number: int, directory: Path, referenced: Set[str]) -> bool:
        index = self._load_index(number)
        blobs = index["blobs"]
        keep: Set[str] = set()
        for digest in referenced:
            current: Optional[str] = digest
            while current is not None and current in blobs and current not in keep:
                keep.add(current)
                current = blobs[current].get("base")
        dropped = [digest for digest in blobs if digest not in keep]
        failed = False
        try:
            names = [entry.name for entry in os.scandir(directory) if BLOB_FILE_PATTERN.fullmatch(entry.name)]
        except OSError:
            return True
        live_files = {BLOB_FILE_TEMPLATE.format(digest=digest, kind=blobs[digest]["kind"]) for digest in keep}
        for name in names:
            if name in live_files:
                continue
            try:
                (directory / name).unlink()
            except OSError as exc:
                failed = True
                ColorPrint.yellow(f"[{LABEL}] blob prune failed path={directory / name}: {exc}")
        self._cache_drop(number, dropped)
        head = index.get("head")
        if dropped or not keep or (head is not None and head not in keep):
            index["blobs"] = {digest: blobs[digest] for digest in blobs if digest in keep}
            index["head"] = head if head in keep else None
            try:
                if keep:
                    self._store_index(number, index)
                else:
                    (directory / BLOB_INDEX_NAME).unlink(missing_ok=True)
                    directory.rmdir()
            except OSError as exc:
                failed = True
                ColorPrint.yellow(f"[{LABEL}] blob index update failed dir={directory}: {exc}")
        return failed


terminal_backup_store = TerminalBackupStore(APP_DATA_DIR / TERMINAL_BACKUP_DIR_NAME)
