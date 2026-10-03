# -*- coding: utf-8 -*-
"""Read-only terminal window listing and text (live screenshot OCR or the latest stored backup)."""

import time
from typing import Any, Dict, List

from pycore.pyctl.devmcp.dev_mcp_constants import (
    TERMINAL_LIST_THREAD,
    TERMINAL_READ_THREAD,
    TERMINAL_SOURCE_AUTO,
    TERMINAL_SOURCE_BACKUP,
    TERMINAL_SOURCE_OCR,
)
from pycore.pyctl.terminal.terminal_backup_store import TEXT_ENCODING, TEXT_ERRORS, terminal_backup_store
from pycore.pyctl.terminal.terminal_service import TerminalService, terminal_service
from pycore.pyctl.terminal.terminal_text_ocr import recognize_region_text
from pycore.pyfoundations.serialized_worker import await_bus_task


class TerminalReader:
    async def list_windows(self) -> List[Dict[str, Any]]:
        snapshot = await await_bus_task(terminal_service.snapshot, thread_name=TERMINAL_LIST_THREAD)
        return [
            {
                "window_id": str(window.get("id") or ""),
                "terminal_number": window.get("terminal_number"),
                "title": str(window.get("title") or ""),
                "custom_title": str(window.get("custom_title") or ""),
                "app": str(window.get("app") or ""),
                "online": bool(window.get("online")),
                "active": bool(window.get("active")),
                "rect": window.get("rect"),
            }
            for window in snapshot.get("windows") or []
        ]

    async def read(self, window_id: str, title_contains: str, lines: int, source: str) -> Dict[str, Any]:
        windows = await self.list_windows()
        if not window_id and not title_contains:
            raise ValueError("terminal_selector_required")
        needle = title_contains.lower()
        matches = [
            window
            for window in windows
            if (window_id and window_id in (window["window_id"], str(window["terminal_number"])))
            or (needle and needle in f"{window['title']} {window['custom_title']}".lower())
        ]
        if not matches:
            raise LookupError("terminal_not_found")
        if len(matches) > 1:
            raise LookupError(
                "terminal_ambiguous: " + ", ".join(window["window_id"] for window in matches)
            )
        window = matches[0]
        result = await await_bus_task(self._extract, window, source, thread_name=TERMINAL_READ_THREAD)
        text = str(result["text"])
        tail = text.split("\n")[-lines:] if lines > 0 else text.split("\n")
        return {**result, "window_id": window["window_id"], "terminal_number": window["terminal_number"], "text": "\n".join(tail)}

    def _extract(self, window: Dict[str, Any], source: str) -> Dict[str, Any]:
        if source in (TERMINAL_SOURCE_AUTO, TERMINAL_SOURCE_OCR) and window["online"]:
            ocr = self._read_ocr(window)
            if ocr.get("text") or source == TERMINAL_SOURCE_OCR:
                return ocr
        if source == TERMINAL_SOURCE_OCR:
            raise LookupError("terminal_offline")
        return self._read_backup(window)

    def _read_ocr(self, window: Dict[str, Any]) -> Dict[str, Any]:
        region = TerminalService.window_capture_region(
            {"id": window["window_id"], "rect": window.get("rect") or {}}
        )
        return {"source": TERMINAL_SOURCE_OCR, **recognize_region_text(region)}

    def _read_backup(self, window: Dict[str, Any]) -> Dict[str, Any]:
        number = window.get("terminal_number")
        latest = terminal_backup_store.latest()
        if latest is None or number is None:
            raise LookupError("terminal_backup_unavailable")
        read = terminal_backup_store.read_terminal(latest["id"], int(number))
        if not read.get("success"):
            raise LookupError(str(read.get("error_code")))
        created_ms = terminal_backup_store.created_at_ms(latest["id"], latest["manifest"])
        return {
            "source": TERMINAL_SOURCE_BACKUP,
            "backup_id": latest["id"],
            "backup_age_seconds": int(time.time() - created_ms / 1000),
            "text": read["data"].decode(TEXT_ENCODING, TEXT_ERRORS),
        }


terminal_reader = TerminalReader()

__all__ = ["TerminalReader", "terminal_reader"]
