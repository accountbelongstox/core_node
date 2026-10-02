# -*- coding: utf-8 -*-
"""Timestamped folders of exported terminal text (<APP_DATA_DIR>/terminal_backup/<stamp>/terminal-<n>.txt + manifest.json)."""

from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from pycore.pyfoundations.atomic_json_store import atomic_write_bytes, atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyctl.terminal.terminal_capture_store import NAME_TIME_FORMAT, encode_capture
from pycore.pyctl.terminal.terminal_file_retention import prune_files
from pycore.pyutils.common.relay_contract import relay_contract

TERMINAL_BACKUP_DIR_NAME = "terminal_backup"
TERMINAL_BACKUP_RETAIN_COUNT = relay_contract.limit("terminal_backup_retain_count")
TERMINAL_BACKUP_RETAIN_SECONDS = relay_contract.limit("terminal_backup_retain_seconds")
MANIFEST_NAME = "manifest.json"
FILE_NAME_TEMPLATE = "terminal-{number}.txt"
FOLDER_NAME_PATTERN = re.compile(r"^\d{8}-\d{6}(?:-\d+)?$", re.ASCII)
TERMINAL_FILE_PATTERN = re.compile(r"^terminal-\d+\.txt$", re.ASCII)
LAST_PASS_FILE_NAME = "schedule.json"
LAST_PASS_KEY = "last_pass_at"
MILLISECONDS_PER_SECOND = 1000
FOLDER_STAMP_LENGTH = 15
BYTES_PER_KILOBYTE = 1024
LABEL = "TerminalBackupStore"
ERROR_BACKUP_WRITE_FAILED = "terminal_backup_write_failed"
ERROR_BACKUP_NOT_FOUND = "terminal_backup_not_found"
ERROR_BACKUP_TERMINAL_NOT_FOUND = "terminal_backup_terminal_not_found"
ERROR_BACKUP_DELETE_FAILED = "terminal_backup_delete_failed"


def text_digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def inputs_digest(inputs: Sequence[Dict[str, Any]]) -> str:
    if not inputs:
        return ""
    return hashlib.sha256(
        json.dumps(list(inputs), ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()


def kilobytes(byte_count: int) -> int:
    return max(1, round(byte_count / BYTES_PER_KILOBYTE)) if byte_count > 0 else 0


class TerminalBackupStore:
    def __init__(self, directory: Path) -> None:
        self.directory = directory
        self.lock = threading.RLock()

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

    @staticmethod
    def read_manifest(folder: Path) -> Optional[Dict[str, Any]]:
        try:
            manifest = json.loads((folder / MANIFEST_NAME).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        return manifest if isinstance(manifest, dict) else None

    def latest(self) -> Optional[Dict[str, Any]]:
        """Newest folder that holds a readable manifest: {path, manifest, files}."""
        for name in self.folder_names():
            folder = self.directory / name
            manifest = self.read_manifest(folder)
            if manifest is None:
                continue
            return {"path": folder, "manifest": manifest, "files": self.manifest_files(folder, manifest)}
        return None

    @staticmethod
    def manifest_files(folder: Path, manifest: Dict[str, Any]) -> List[Path]:
        files = [
            folder / FILE_NAME_TEMPLATE.format(number=entry["number"])
            for entry in manifest.get("terminals") or []
            if isinstance(entry, dict) and not entry.get("error_code")
        ]
        return [path for path in files if path.is_file() and not path.is_symlink()]

    def folder_path(self, folder_id: Any) -> Optional[Path]:
        if not isinstance(folder_id, str) or FOLDER_NAME_PATTERN.fullmatch(folder_id) is None:
            return None
        folder = self.directory / folder_id
        return folder if folder.is_dir() and not folder.is_symlink() else None

    @staticmethod
    def terminal_path(folder: Path, number: int) -> Optional[Path]:
        path = folder / FILE_NAME_TEMPLATE.format(number=int(number))
        return path if path.is_file() and not path.is_symlink() else None

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
        latest = self.latest()
        if latest is None:
            return {}
        return {
            int(entry["number"]): str(entry.get("sha256") or entry.get("inputs_sha256") or "")
            for entry in latest["manifest"].get("terminals") or []
            if isinstance(entry, dict) and "number" in entry
        }

    def _new_folder(self) -> Path:
        base = datetime.now().strftime(NAME_TIME_FORMAT)
        name = base
        suffix = 1
        while (self.directory / name).exists():
            suffix += 1
            name = f"{base}-{suffix}"
        return self.directory / name

    def save(self, terminals: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
        """terminals: {number, name, text?, error_code?, inputs?, changed?}; the manifest lands last."""
        with self.lock:
            folder = self._new_folder()
            entries: List[Dict[str, Any]] = []
            try:
                for terminal in terminals:
                    entry: Dict[str, Any] = {
                        "number": int(terminal["number"]),
                        "name": str(terminal.get("name") or ""),
                        "bytes": 0,
                        "changed": bool(terminal.get("changed")),
                    }
                    text = terminal.get("text")
                    if text is not None:
                        data = encode_capture(text)
                        atomic_write_bytes(folder / FILE_NAME_TEMPLATE.format(number=entry["number"]), data)
                        entry["bytes"] = len(data)
                        entry["sha256"] = text_digest(text)
                    if terminal.get("error_code"):
                        entry["error_code"] = str(terminal["error_code"])
                    inputs = list(terminal.get("inputs") or [])
                    if inputs:
                        entry["inputs"] = inputs
                        entry["inputs_sha256"] = inputs_digest(inputs)
                    entries.append(entry)
                manifest = {"created_at": datetime.now().astimezone().isoformat(timespec="seconds")}
                manifest.update(self._summary(entries))
                atomic_write_json(folder / MANIFEST_NAME, manifest)
            except OSError as exc:
                ColorPrint.yellow(f"[{LABEL}] write failed folder={folder}: {exc}")
                return {"success": False, "error_code": ERROR_BACKUP_WRITE_FAILED}
            self.prune()
            return {
                "success": True,
                "path": str(folder),
                "terminal_count": manifest["terminal_count"],
                "total_bytes": manifest["total_bytes"],
            }

    @staticmethod
    def _summary(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "terminal_count": sum(1 for entry in entries if "sha256" in entry),
            "total_bytes": sum(int(entry.get("bytes") or 0) for entry in entries),
            "terminals": entries,
        }

    def remove_folder(self, folder_id: Any) -> Dict[str, Any]:
        """Delete one backup folder (manifest first, so a partial delete leaves no listed folder); symlinks are unlinked, never followed."""
        with self.lock:
            folder = self.folder_path(folder_id)
            if folder is None:
                return {"success": False, "error_code": ERROR_BACKUP_NOT_FOUND}
            deleted = 0
            try:
                manifest_path = folder / MANIFEST_NAME
                if manifest_path.is_symlink() or manifest_path.exists():
                    manifest_path.unlink()
                for entry in os.scandir(folder):
                    if entry.is_dir(follow_symlinks=False):
                        raise OSError(f"unexpected directory {entry.path}")
                    os.unlink(entry.path)
                    if TERMINAL_FILE_PATTERN.fullmatch(entry.name):
                        deleted += 1
                folder.rmdir()
            except OSError as exc:
                ColorPrint.yellow(f"[{LABEL}] delete failed folder={folder}: {exc}")
                return {"success": False, "error_code": ERROR_BACKUP_DELETE_FAILED, "deleted": deleted}
            return {"success": True, "deleted": deleted, "folder_removed": True}

    def remove_terminal(self, folder_id: Any, number: int) -> Dict[str, Any]:
        """Delete one terminal file and its manifest entry; the folder goes with its last entry."""
        with self.lock:
            folder = self.folder_path(folder_id)
            manifest = self.read_manifest(folder) if folder is not None else None
            if folder is None or manifest is None:
                return {"success": False, "error_code": ERROR_BACKUP_NOT_FOUND}
            entries = [entry for entry in manifest.get("terminals") or [] if isinstance(entry, dict)]
            remaining = [entry for entry in entries if entry.get("number") != number]
            path = folder / FILE_NAME_TEMPLATE.format(number=number)
            has_file = path.is_symlink() or path.exists()
            if len(remaining) == len(entries) and not has_file:
                return {"success": False, "error_code": ERROR_BACKUP_TERMINAL_NOT_FOUND}
            if not remaining:
                return self.remove_folder(folder_id)
            try:
                if has_file:
                    path.unlink()
                manifest.update(self._summary(remaining))
                atomic_write_json(folder / MANIFEST_NAME, manifest)
            except OSError as exc:
                ColorPrint.yellow(f"[{LABEL}] delete failed path={path}: {exc}")
                return {"success": False, "error_code": ERROR_BACKUP_DELETE_FAILED, "deleted": 0}
            return {"success": True, "deleted": 1 if has_file else 0, "folder_removed": False}

    def prune(self) -> None:
        cutoff = time.time() - TERMINAL_BACKUP_RETAIN_SECONDS
        for index, name in enumerate(self.folder_names()):
            folder = self.directory / name
            try:
                expired = folder.stat().st_mtime < cutoff
            except OSError:
                continue
            if index < TERMINAL_BACKUP_RETAIN_COUNT and not expired:
                continue
            prune_files(folder, 0, 0, LABEL)
            try:
                folder.rmdir()
            except OSError as exc:
                ColorPrint.yellow(f"[{LABEL}] prune failed folder={folder}: {exc}")


terminal_backup_store = TerminalBackupStore(APP_DATA_DIR / TERMINAL_BACKUP_DIR_NAME)
