# -*- coding: utf-8 -*-
"""Plain-text store for full terminal buffer captures (<APP_DATA_DIR>/tcap)."""

from __future__ import annotations

import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.atomic_json_store import atomic_write_bytes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyctl.terminal.terminal_file_retention import prune_files
from pycore.pyutils.common.relay_contract import relay_contract

TERMINAL_CAPTURE_DIR_NAME = "tcap"
TERMINAL_CAPTURE_RETAIN_COUNT = relay_contract.limit("terminal_capture_retain_count")
TERMINAL_CAPTURE_RETAIN_SECONDS = relay_contract.limit("terminal_capture_retain_seconds")
NAME_TIME_FORMAT = "%Y%m%d-%H%M%S"
CAPTURE_NAME_PATTERN = re.compile(r"^terminal-(\d+)-\d{8}-\d{6}(?:-\d+)?\.txt$")
ERROR_CAPTURE_WRITE_FAILED = "terminal_capture_write_failed"


def encode_capture(text: str) -> bytes:
    """Native line endings, UTF-8: the one on-disk form of captured terminal text."""
    return text.replace("\n", os.linesep).encode("utf-8")


class TerminalCaptureStore:
    def __init__(self, directory: Path) -> None:
        self.directory = directory

    def save(self, terminal_number: int, text: str) -> Dict[str, Any]:
        """Write the capture with native line endings under a unique, terminal-scoped name."""
        stamp = datetime.now().strftime(NAME_TIME_FORMAT)
        base = f"terminal-{terminal_number}-{stamp}"
        name = f"{base}.txt"
        suffix = 1
        while (self.directory / name).exists():
            suffix += 1
            name = f"{base}-{suffix}.txt"
        path = self.directory / name
        data = encode_capture(text)
        try:
            atomic_write_bytes(path, data)
        except OSError as exc:
            ColorPrint.yellow(f"[TerminalCaptureStore] write failed path={path}: {exc}")
            return {"success": False, "error_code": ERROR_CAPTURE_WRITE_FAILED}
        prune_files(self.directory, TERMINAL_CAPTURE_RETAIN_COUNT, TERMINAL_CAPTURE_RETAIN_SECONDS, "TerminalCaptureStore")
        return {"success": True, "path": str(path), "name": name, "bytes": len(data)}

    def read(self, terminal_number: int, name: str) -> Optional[str]:
        match = CAPTURE_NAME_PATTERN.fullmatch(name)
        if match is None or int(match.group(1)) != terminal_number:
            return None
        path = self.directory / name
        if not path.is_file():
            return None
        try:
            data = path.read_bytes()
        except OSError as exc:
            ColorPrint.yellow(f"[TerminalCaptureStore] read failed path={path}: {exc}")
            return None
        return data.decode("utf-8", errors="replace").replace("\r\n", "\n")


terminal_capture_store = TerminalCaptureStore(APP_DATA_DIR / TERMINAL_CAPTURE_DIR_NAME)
