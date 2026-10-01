# -*- coding: utf-8 -*-
"""Short-path image store for terminal message attachments (<APP_DATA_DIR>/timg)."""

from __future__ import annotations

import os
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO, Dict, Optional

from pycore.pyfoundations.atomic_json_store import atomic_write_bytes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyutils.common.relay_contract import relay_contract

TERMINAL_IMAGE_DIR_NAME = "timg"
TERMINAL_IMAGE_MAX_BYTES = relay_contract.limit("terminal_image_upload_bytes")
TERMINAL_IMAGE_RETAIN_COUNT = relay_contract.limit("terminal_image_retain_count")
TERMINAL_IMAGE_RETAIN_SECONDS = relay_contract.limit("terminal_image_retain_seconds")
READ_CHUNK_BYTES = 1024 * 1024
NAME_TIME_FORMAT = "%y%m%d%H%M%S"
NAME_RANDOM_BYTES = 2

ERROR_IMAGE_MISSING = "terminal_image_missing"
ERROR_IMAGE_TOO_LARGE = "terminal_image_too_large"
ERROR_IMAGE_UNSUPPORTED = "terminal_image_unsupported_type"
ERROR_IMAGE_READ_FAILED = "terminal_image_read_failed"
ERROR_IMAGE_WRITE_FAILED = "terminal_image_write_failed"

# (magic prefix, offset, extension, mime); WebP also needs "WEBP" at offset 8.
IMAGE_SIGNATURES = (
    (b"\x89PNG\r\n\x1a\n", 0, "png", "image/png"),
    (b"\xff\xd8\xff", 0, "jpg", "image/jpeg"),
    (b"GIF87a", 0, "gif", "image/gif"),
    (b"GIF89a", 0, "gif", "image/gif"),
    (b"WEBP", 8, "webp", "image/webp"),
    (b"BM", 0, "bmp", "image/bmp"),
)
WEBP_RIFF_PREFIX = b"RIFF"


def detect_image_type(data: bytes) -> Optional[tuple]:
    """(extension, mime) from magic bytes, or None."""
    for magic, offset, extension, mime in IMAGE_SIGNATURES:
        if data[offset:offset + len(magic)] != magic:
            continue
        if extension == "webp" and not data.startswith(WEBP_RIFF_PREFIX):
            continue
        return extension, mime
    return None


class TerminalImageStore:
    def __init__(self, directory: Path) -> None:
        self.directory = directory

    def read_stream(self, stream: BinaryIO) -> Dict[str, Any]:
        """Read at most the cap (+1 byte to detect overflow); no total deadline."""
        chunks = []
        total = 0
        while total <= TERMINAL_IMAGE_MAX_BYTES:
            try:
                chunk = stream.read(READ_CHUNK_BYTES)
            except OSError as exc:
                ColorPrint.yellow(f"[TerminalImageStore] read upload failed after {total} bytes: {exc}")
                return {"success": False, "error_code": ERROR_IMAGE_READ_FAILED}
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
        if total > TERMINAL_IMAGE_MAX_BYTES:
            return {"success": False, "error_code": ERROR_IMAGE_TOO_LARGE, "max_bytes": TERMINAL_IMAGE_MAX_BYTES}
        if total == 0:
            return {"success": False, "error_code": ERROR_IMAGE_MISSING}
        return {"success": True, "data": b"".join(chunks)}

    def save(self, data: bytes) -> Dict[str, Any]:
        """Validate, write atomically under a short generated name, then prune."""
        if len(data) > TERMINAL_IMAGE_MAX_BYTES:
            return {"success": False, "error_code": ERROR_IMAGE_TOO_LARGE, "max_bytes": TERMINAL_IMAGE_MAX_BYTES}
        detected = detect_image_type(data)
        if detected is None:
            return {"success": False, "error_code": ERROR_IMAGE_UNSUPPORTED}
        extension, mime = detected
        stamp = datetime.now(timezone.utc).strftime(NAME_TIME_FORMAT)
        name = f"{stamp}{secrets.token_hex(NAME_RANDOM_BYTES)}.{extension}"
        path = self.directory / name
        try:
            atomic_write_bytes(path, data)
        except OSError as exc:
            ColorPrint.yellow(f"[TerminalImageStore] write failed path={path}: {exc}")
            return {"success": False, "error_code": ERROR_IMAGE_WRITE_FAILED}
        self.prune()
        return {"success": True, "path": str(path), "name": name, "bytes": len(data), "mime": mime}

    def prune(self) -> None:
        """Drop images older than the retention window, then the oldest beyond the count cap."""
        if not self.directory.is_dir():
            return
        try:
            entries = sorted(
                ((entry.stat().st_mtime, Path(entry.path)) for entry in os.scandir(self.directory) if entry.is_file()),
                reverse=True,
            )
        except OSError as exc:
            ColorPrint.yellow(f"[TerminalImageStore] scan failed dir={self.directory}: {exc}")
            return
        cutoff = time.time() - TERMINAL_IMAGE_RETAIN_SECONDS
        for index, (mtime, path) in enumerate(entries):
            if index < TERMINAL_IMAGE_RETAIN_COUNT and mtime >= cutoff:
                continue
            try:
                path.unlink()
            except OSError as exc:
                ColorPrint.yellow(f"[TerminalImageStore] prune failed path={path}: {exc}")


terminal_image_store = TerminalImageStore(APP_DATA_DIR / TERMINAL_IMAGE_DIR_NAME)
