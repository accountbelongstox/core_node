# -*- coding: utf-8 -*-
"""Restore page of a terminal backup: index.html beside the exported terminal-<n>.txt files, holding every terminal's whole history under an instruction block for AI agents; opened in the default browser."""

from __future__ import annotations

import html
import json
from datetime import datetime
from pathlib import Path
from string import Template
from typing import Any, Callable, Dict, Iterable, Optional

from pycore.pyctl.terminal.terminal_backup_store import TerminalBackupStore, terminal_backup_store
from pycore.pyfoundations.atomic_json_store import atomic_write_bytes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_launcher import open_file

LABEL = "TerminalBackupPage"
PAGE_TEMPLATE_PATH = Path(__file__).resolve().parent / "web" / "terminal_backup_page.html"
PAGE_FILE_NAME = "index.html"
PAGE_ENCODING = "utf-8"
DATE_DISPLAY_FORMAT = "%Y-%m-%d %H:%M:%S"
MILLISECONDS_PER_SECOND = 1000
# Keeps the embedded JSON from closing its <script> element.
SCRIPT_CLOSE_SEQUENCE = "</"
SCRIPT_CLOSE_ESCAPED = "<\\/"
ERROR_PAGE_WRITE_FAILED = "terminal_backup_page_write_failed"
ERROR_PAGE_OPEN_FAILED = "terminal_backup_open_failed"


class TerminalBackupPage:
    def __init__(
        self,
        store: TerminalBackupStore = terminal_backup_store,
        open_page: Callable[[Path], bool] = open_file,
    ) -> None:
        self._store = store
        self._open_page = open_page

    def build(self, folder_id: Any, numbers: Optional[Iterable[int]] = None) -> Dict[str, Any]:
        """Export the backup and write its page: {success, path, folder, terminals} or {success: False, error_code}."""
        exported = self._store.export_files(folder_id, numbers)
        if not exported["success"]:
            return exported
        folder: Path = exported["folder"]
        terminals = exported["terminals"]
        data = {
            "backup_id": folder.name,
            "terminals": [
                {
                    "number": terminal["number"],
                    "name": terminal["name"],
                    "file": terminal["path"].name,
                    "chars": len(terminal["text"]),
                    "text": terminal["text"],
                }
                for terminal in sorted(terminals, key=lambda item: item["number"])
            ],
        }
        path = folder / PAGE_FILE_NAME
        try:
            template = Template(PAGE_TEMPLATE_PATH.read_text(encoding=PAGE_ENCODING))
            page = template.safe_substitute(
                backup_id=html.escape(folder.name),
                created=html.escape(
                    datetime.fromtimestamp(exported["created_at"] / MILLISECONDS_PER_SECOND).strftime(DATE_DISPLAY_FORMAT)
                ),
                folder=html.escape(str(folder)),
                data_json=json.dumps(data, ensure_ascii=False).replace(SCRIPT_CLOSE_SEQUENCE, SCRIPT_CLOSE_ESCAPED),
            )
            atomic_write_bytes(path, page.encode(PAGE_ENCODING))
        except OSError as exc:
            ColorPrint.yellow(f"[{LABEL}] page write failed path={path}: {exc}")
            return {"success": False, "error_code": ERROR_PAGE_WRITE_FAILED}
        return {"success": True, "path": path, "folder": folder, "terminals": terminals}

    def open(self, folder_id: Any, numbers: Optional[Iterable[int]] = None) -> Dict[str, Any]:
        """Build the page and open it in the default browser: {success, opened (terminal count), path}."""
        built = self.build(folder_id, numbers)
        if not built["success"]:
            return built
        path = built["path"]
        if not self._open_page(path):
            ColorPrint.yellow(f"[{LABEL}] open failed path={path}")
            return {"success": False, "error_code": ERROR_PAGE_OPEN_FAILED, "opened": 0, "path": str(path)}
        return {"success": True, "opened": len(built["terminals"]), "path": str(path)}


terminal_backup_page = TerminalBackupPage()
