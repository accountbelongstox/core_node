# -*- coding: utf-8 -*-
"""Pending "restore the last conversation" request: the launcher queues a backup and its terminal numbers; the pycore backup scheduler delivers it (terminal_conversation_restore)."""

from __future__ import annotations

import time
from typing import Any, Dict, Iterable, Optional

from pycore.pyctl.terminal.terminal_backup_store import TERMINAL_BACKUP_DIR_NAME
from pycore.pyfoundations.atomic_json_store import AtomicJsonStore
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR

LABEL = "TerminalRestoreRequest"
RESTORE_REQUEST_PATH = APP_DATA_DIR / TERMINAL_BACKUP_DIR_NAME / "restore_request.json"


class TerminalRestoreRequestStore:
    def __init__(self, store_path=RESTORE_REQUEST_PATH) -> None:
        self._store = AtomicJsonStore(store_path, dict)

    def request(self, backup_id: str, numbers: Iterable[int]) -> bool:
        try:
            self._store.write({"backup_id": backup_id, "numbers": sorted({int(n) for n in numbers}), "requested_at": time.time()})
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[{LABEL}] request write failed: {type(exc).__name__}: {exc}")
            return False
        return True

    def read(self) -> Optional[Dict[str, Any]]:
        """{backup_id, numbers, requested_at (wall seconds)} or None."""
        if not self._store.exists():
            return None
        try:
            saved = self._store.read()
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[{LABEL}] request read failed: {type(exc).__name__}: {exc}")
            return None
        backup_id = saved.get("backup_id")
        requested_at = saved.get("requested_at")
        numbers = saved.get("numbers")
        if (
            not isinstance(backup_id, str) or not backup_id
            or not isinstance(requested_at, (int, float)) or isinstance(requested_at, bool)
            or not isinstance(numbers, list)
        ):
            return None
        return {
            "backup_id": backup_id,
            "numbers": [int(n) for n in numbers if isinstance(n, int) and not isinstance(n, bool) and n > 0],
            "requested_at": float(requested_at),
        }

    def clear(self) -> None:
        try:
            self._store.write({})
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[{LABEL}] request clear failed: {type(exc).__name__}: {exc}")


terminal_restore_requests = TerminalRestoreRequestStore()
