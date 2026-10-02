# -*- coding: utf-8 -*-
"""Backup history for the UI: list/search, read, open in the desktop editor and delete of terminal backup folders."""

from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from pycore.pyctl.terminal.terminal_backup_store import (
    ERROR_BACKUP_NOT_FOUND,
    FOLDER_NAME_PATTERN,
    TEXT_ENCODING,
    TEXT_ERRORS,
    TerminalBackupStore,
    normalized_text,
    positive_int,
    terminal_backup_store,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_launcher import open_file_with_notepad
from pycore.pyutils.launcher.text_editor_finder import text_editor_finder

LABEL = "TerminalBackupHistory"
DEFAULT_LIST_LIMIT = 50
MAX_LIST_LIMIT = 200
MAX_LIST_OFFSET = 1000000
MAX_QUERY_CHARS = 200
READ_MAX_BYTES = 2 * 1024 * 1024
SEARCH_MAX_FILES = 1000
SEARCH_MAX_FILE_BYTES = READ_MAX_BYTES
SEARCH_MAX_TOTAL_BYTES = 64 * 1024 * 1024
SEARCH_MAX_MATCHES_PER_ITEM = 5
SNIPPET_CHARS = 160
OPEN_FILES_DELAY_SECONDS = 0.6
DELETE_CONFIRMATION = "DEL"
DATE_DISPLAY_FORMAT = "%Y-%m-%d %H:%M:%S"
MILLISECONDS_PER_SECOND = 1000
ERROR_INVALID_ID = "terminal_backup_invalid_id"
ERROR_INVALID_TERMINAL = "terminal_backup_invalid_terminal"
ERROR_OPEN_FAILED = "terminal_backup_open_failed"
ERROR_DELETE_CONFIRMATION = "delete_confirmation_required"


def _bounded(raw: Any, default: int, maximum: int) -> int:
    value = positive_int(raw)
    return default if value is None else min(value, maximum)


class TerminalBackupHistoryService:
    def __init__(
        self,
        store: TerminalBackupStore = terminal_backup_store,
        open_file: Callable[[Path, Optional[str]], bool] = open_file_with_notepad,
        find_editor: Callable[[], Optional[str]] = text_editor_finder.find,
        sleep: Callable[[float], Any] = time.sleep,
    ) -> None:
        self._store = store
        self._open_file = open_file
        self._find_editor = find_editor
        self._sleep = sleep

    def _folders(self) -> List[Tuple[str, Path, Dict[str, Any]]]:
        return self._store.list_manifests()

    def _item(self, name: str, manifest: Dict[str, Any]) -> Dict[str, Any]:
        terminals = []
        for entry in self._store.manifest_entries(manifest):
            terminal = {
                "number": int(entry["number"]),
                "name": str(entry.get("name") or ""),
                "bytes": int(entry.get("bytes") or 0),
                "stored_bytes": int(entry.get("stored_bytes", entry.get("bytes")) or 0),
                "kind": str(entry.get("kind") or ""),
                "changed": bool(entry.get("changed")),
            }
            if entry.get("error_code"):
                terminal["error_code"] = str(entry["error_code"])
            terminals.append(terminal)
        return {
            "id": name,
            "created_at": self._store.created_at_ms(name, manifest),
            "terminal_count": int(manifest.get("terminal_count") or 0),
            "total_bytes": int(manifest.get("total_bytes") or 0),
            "stored_bytes": int(manifest.get("stored_bytes", manifest.get("total_bytes")) or 0),
            "terminals": terminals,
        }

    @staticmethod
    def _date_haystack(name: str, manifest: Dict[str, Any], created_ms: int) -> str:
        local = datetime.fromtimestamp(created_ms / MILLISECONDS_PER_SECOND).strftime(DATE_DISPLAY_FORMAT)
        return f"{name}\n{local}\n{manifest.get('created_at') or ''}".lower()

    @staticmethod
    def _snippet(line: str, needle: str) -> str:
        line = line.strip()
        if len(line) <= SNIPPET_CHARS:
            return line
        position = max(0, line.lower().find(needle))
        start = max(0, min(position - SNIPPET_CHARS // 4, len(line) - SNIPPET_CHARS))
        return line[start : start + SNIPPET_CHARS]

    def _line_matches(self, data: bytes, needle: str) -> List[Tuple[int, str]]:
        text = data.decode(TEXT_ENCODING, TEXT_ERRORS)
        found: List[Tuple[int, str]] = []
        for index, line in enumerate(text.splitlines(), start=1):
            if needle in line.lower():
                found.append((index, self._snippet(line, needle)))
                if len(found) >= SEARCH_MAX_MATCHES_PER_ITEM:
                    break
        return found

    def _search_item(
        self, folder: Path, manifest: Dict[str, Any], needle: str, budget: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        matches: List[Dict[str, Any]] = []
        for entry in self._store.manifest_entries(manifest):
            if len(matches) >= SEARCH_MAX_MATCHES_PER_ITEM:
                break
            if entry.get("error_code"):
                continue
            number = int(entry["number"])
            key = (number, str(entry.get("sha256") or ""))
            found = budget["seen"].get(key) if key[1] else None
            if found is None:
                if budget["files"] <= 0 or budget["bytes"] <= 0:
                    budget["exhausted"] = 1
                    break
                data = self._store.read_entry_bytes(folder, entry)
                if data is None:
                    continue
                budget["files"] -= 1
                data = data[: min(SEARCH_MAX_FILE_BYTES, budget["bytes"])]
                budget["bytes"] -= len(data)
                found = self._line_matches(data, needle)
                if key[1]:
                    budget["seen"][key] = found
            for line, snippet in found:
                matches.append({"number": number, "line": line, "snippet": snippet})
                if len(matches) >= SEARCH_MAX_MATCHES_PER_ITEM:
                    break
        return matches

    def list_backups(self, query: Any = None, limit: Any = None, offset: Any = None) -> Dict[str, Any]:
        needle = (query.strip().lower()[:MAX_QUERY_CHARS] if isinstance(query, str) else "")
        page_size = _bounded(limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
        start = _bounded(offset, 0, MAX_LIST_OFFSET)
        budget: Dict[str, Any] = {"files": SEARCH_MAX_FILES, "bytes": SEARCH_MAX_TOTAL_BYTES, "exhausted": 0, "seen": {}}
        items: List[Dict[str, Any]] = []
        for name, folder, manifest in self._folders():
            item = self._item(name, manifest)
            if needle:
                matches = self._search_item(folder, manifest, needle, budget)
                if not matches and needle not in self._date_haystack(name, manifest, item["created_at"]):
                    continue
                item["matches"] = matches
            items.append(item)
        result: Dict[str, Any] = {
            "success": True,
            "total": len(items),
            "items": items[start : start + page_size],
            "archive": self._store.archive_stats(),
        }
        if budget["exhausted"]:
            result["search_truncated"] = True
        return result

    def read(self, folder_id: Any, terminal_number: Any) -> Dict[str, Any]:
        located = self._locate(folder_id)
        number = positive_int(terminal_number)
        if "error_code" in located:
            return located
        if number is None:
            return {"success": False, "error_code": ERROR_INVALID_TERMINAL}
        result = self._store.read_terminal(located["id"], number)
        if not result["success"]:
            return result
        data = result["data"]
        entry = result["entry"]
        truncated = len(data) > READ_MAX_BYTES
        text = normalized_text(data[:READ_MAX_BYTES])
        return {
            "success": True,
            "text": text,
            "bytes": len(data),
            "stored_bytes": int(entry.get("stored_bytes", len(data)) or 0),
            "kind": str(entry.get("kind") or ""),
            "truncated": truncated,
        }

    def open(self, folder_id: Any, terminal_number: Any = None) -> Dict[str, Any]:
        located = self._locate(folder_id)
        if "error_code" in located:
            return located
        numbers: Optional[List[int]] = None
        if terminal_number not in (None, ""):
            number = positive_int(terminal_number)
            if number is None:
                return {"success": False, "error_code": ERROR_INVALID_TERMINAL}
            numbers = [number]
        exported = self._store.export_files(located["id"], numbers)
        if not exported["success"]:
            return exported
        opened = self.open_files(
            exported["files"], lambda path: ColorPrint.yellow(f"[{LABEL}] open failed path={path}")
        )
        if opened == 0:
            return {"success": False, "error_code": ERROR_OPEN_FAILED, "opened": 0}
        return {"success": True, "opened": opened}

    def open_files(self, paths: Sequence[Path], on_failed: Optional[Callable[[Path], Any]] = None) -> int:
        """One editor window per file; returns how many opened."""
        editor = self._find_editor()
        opened = 0
        for index, path in enumerate(paths):
            if index:
                self._sleep(OPEN_FILES_DELAY_SECONDS)
            if self._open_file(path, editor):
                opened += 1
            elif on_failed is not None:
                on_failed(path)
        return opened

    def delete(self, folder_id: Any, terminal_number: Any = None, confirm: Any = None) -> Dict[str, Any]:
        if not isinstance(confirm, str) or confirm != DELETE_CONFIRMATION:
            return {"success": False, "error_code": ERROR_DELETE_CONFIRMATION}
        located = self._locate(folder_id)
        if "error_code" in located:
            return located
        if terminal_number in (None, ""):
            return self._store.remove_folder(located["id"])
        number = positive_int(terminal_number)
        if number is None:
            return {"success": False, "error_code": ERROR_INVALID_TERMINAL}
        return self._store.remove_terminal(located["id"], number)

    def _locate(self, folder_id: Any) -> Dict[str, Any]:
        folder = self._store.folder_path(folder_id)
        if folder is None:
            valid = isinstance(folder_id, str) and FOLDER_NAME_PATTERN.fullmatch(folder_id) is not None
            return {"success": False, "error_code": ERROR_BACKUP_NOT_FOUND if valid else ERROR_INVALID_ID}
        return {"id": folder.name, "folder": folder}


terminal_backup_history_service = TerminalBackupHistoryService()
