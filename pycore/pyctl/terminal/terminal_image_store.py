# -*- coding: utf-8 -*-
"""Short-path store for terminal message attachments, images and voice recordings (<APP_DATA_DIR>/timg)."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO, Dict, Optional

from pycore.pyfoundations.atomic_json_store import atomic_write_bytes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyctl.terminal.terminal_file_retention import prune_files
from pycore.pyutils.common.relay_contract import relay_contract

TERMINAL_IMAGE_DIR_NAME = "timg"
TERMINAL_VOICE_DIR_NAME = "taud"
TERMINAL_IMAGE_MAX_BYTES = relay_contract.limit("terminal_image_upload_bytes")
TERMINAL_IMAGE_RETAIN_COUNT = relay_contract.limit("terminal_image_retain_count")
TERMINAL_IMAGE_RETAIN_SECONDS = relay_contract.limit("terminal_image_retain_seconds")
TERMINAL_VOICE_RETAIN_COUNT = relay_contract.limit("terminal_voice_retain_count")
TERMINAL_VOICE_RETAIN_SECONDS = relay_contract.limit("terminal_voice_retain_seconds")
TERMINAL_VOICE_PRUNE_INTERVAL_SECONDS = relay_contract.limit("terminal_voice_prune_interval_seconds")
VOICE_PRUNE_CALLBACK_NAME = "terminal_voice_prune"
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
# Voice recordings: system recorders (m4a/3gp/amr), browser MediaRecorder (webm/ogg/mp4) and common files.
AUDIO_SIGNATURES = (
    (b"#!AMR", 0, "amr", "audio/amr"),
    (b"OggS", 0, "ogg", "audio/ogg"),
    (b"\x1a\x45\xdf\xa3", 0, "webm", "audio/webm"),
    (b"WAVE", 8, "wav", "audio/wav"),
    (b"fLaC", 0, "flac", "audio/flac"),
    (b"ID3", 0, "mp3", "audio/mpeg"),
    (b"\xff\xfb", 0, "mp3", "audio/mpeg"),
    (b"\xff\xf3", 0, "mp3", "audio/mpeg"),
    (b"\xff\xf1", 0, "aac", "audio/aac"),
    (b"\xff\xf9", 0, "aac", "audio/aac"),
)
MP4_BOX_TYPE = b"ftyp"
MP4_3GP_BRAND_PREFIX = b"3g"


def detect_image_type(data: bytes) -> Optional[tuple]:
    """(extension, mime) from magic bytes, or None."""
    for magic, offset, extension, mime in IMAGE_SIGNATURES:
        if data[offset:offset + len(magic)] != magic:
            continue
        if extension == "webp" and not data.startswith(WEBP_RIFF_PREFIX):
            continue
        return extension, mime
    return None


def detect_audio_type(data: bytes) -> Optional[tuple]:
    """(extension, mime) of a voice recording from magic bytes, or None."""
    if data[4:8] == MP4_BOX_TYPE:
        return ("3gp", "audio/3gpp") if data[8:10] == MP4_3GP_BRAND_PREFIX else ("m4a", "audio/mp4")
    for magic, offset, extension, mime in AUDIO_SIGNATURES:
        if data[offset:offset + len(magic)] != magic:
            continue
        if extension == "wav" and not data.startswith(WEBP_RIFF_PREFIX):
            continue
        return extension, mime
    return None


class TerminalImageStore:
    """Images live in ``directory``; voice recordings in ``voice_directory`` with their own short retention."""

    def __init__(self, directory: Path, voice_directory: Path) -> None:
        self.directory = directory
        self.voice_directory = voice_directory

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
            ColorPrint.yellow(f"[TerminalImageStore] upload rejected: over {TERMINAL_IMAGE_MAX_BYTES} bytes")
            return {"success": False, "error_code": ERROR_IMAGE_TOO_LARGE, "max_bytes": TERMINAL_IMAGE_MAX_BYTES}
        if total == 0:
            return {"success": False, "error_code": ERROR_IMAGE_MISSING}
        return {"success": True, "data": b"".join(chunks)}

    def save(self, data: bytes) -> Dict[str, Any]:
        """Validate, write atomically under a short generated name, then prune."""
        if len(data) > TERMINAL_IMAGE_MAX_BYTES:
            return {"success": False, "error_code": ERROR_IMAGE_TOO_LARGE, "max_bytes": TERMINAL_IMAGE_MAX_BYTES}
        image = detect_image_type(data)
        detected = image or detect_audio_type(data)
        if detected is None:
            ColorPrint.yellow(f"[TerminalImageStore] upload rejected: unsupported type bytes={len(data)} head={data[:16].hex()}")
            return {"success": False, "error_code": ERROR_IMAGE_UNSUPPORTED}
        extension, mime = detected
        stamp = datetime.now(timezone.utc).strftime(NAME_TIME_FORMAT)
        name = f"{stamp}{secrets.token_hex(NAME_RANDOM_BYTES)}.{extension}"
        path = (self.directory if image else self.voice_directory) / name
        try:
            atomic_write_bytes(path, data)
        except OSError as exc:
            ColorPrint.yellow(f"[TerminalImageStore] write failed path={path}: {exc}")
            return {"success": False, "error_code": ERROR_IMAGE_WRITE_FAILED}
        self.prune()
        return {"success": True, "path": str(path), "name": name, "bytes": len(data), "mime": mime}

    def prune(self) -> None:
        prune_files(self.directory, TERMINAL_IMAGE_RETAIN_COUNT, TERMINAL_IMAGE_RETAIN_SECONDS, "TerminalImageStore")
        self.prune_voice()

    def start_voice_pruning(self) -> None:
        """Expire recordings on a heartbeat too, so they go even when no new attachment arrives."""
        from pycore.pyheartbeat import heartbeat_system

        heartbeat_system.register_callback(
            name=VOICE_PRUNE_CALLBACK_NAME,
            callback=self.prune_voice,
            interval=TERMINAL_VOICE_PRUNE_INTERVAL_SECONDS,
            enabled=True,
        )

    def prune_voice(self) -> None:
        """Voice recordings only serve the message they were sent with: they expire after the short window."""
        prune_files(self.voice_directory, TERMINAL_VOICE_RETAIN_COUNT, TERMINAL_VOICE_RETAIN_SECONDS, "TerminalImageStore")


terminal_image_store = TerminalImageStore(
    APP_DATA_DIR / TERMINAL_IMAGE_DIR_NAME,
    APP_DATA_DIR / TERMINAL_VOICE_DIR_NAME,
)
