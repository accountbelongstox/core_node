# -*- coding: utf-8 -*-
"""Short-path store for terminal message attachments: images (<APP_DATA_DIR>/timg), voice recordings and documents."""

from __future__ import annotations

import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO, Dict, Optional

from pycore.pyfoundations.atomic_json_store import atomic_write_bytes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyctl.terminal.terminal_file_retention import prune_files
from pycore.pyctl.terminal.terminal_image_archive import TerminalImageArchive
from pycore.pyctl.terminal.terminal_image_compress import compress_upload, is_tiff_family
from pycore.pyutils.common.relay_contract import relay_contract

TERMINAL_IMAGE_DIR_NAME = "timg"
TERMINAL_VOICE_DIR_NAME = "taud"
TERMINAL_DOCUMENT_DIR_NAME = "tdoc"
TERMINAL_IMAGE_SENT_INDEX_NAME = "timg_sent.json"
TERMINAL_IMAGE_MAX_BYTES = relay_contract.limit("terminal_image_upload_bytes")
TERMINAL_IMAGE_RETAIN_COUNT = relay_contract.limit("terminal_image_retain_count")
TERMINAL_IMAGE_RETAIN_SECONDS = relay_contract.limit("terminal_image_retain_seconds")
TERMINAL_VOICE_RETAIN_COUNT = relay_contract.limit("terminal_voice_retain_count")
TERMINAL_VOICE_RETAIN_SECONDS = relay_contract.limit("terminal_voice_retain_seconds")
TERMINAL_VOICE_PRUNE_INTERVAL_SECONDS = relay_contract.limit("terminal_voice_prune_interval_seconds")
VOICE_PRUNE_CALLBACK_NAME = "terminal_voice_prune"
TERMINAL_DOCUMENT_EXTENSIONS = frozenset(relay_contract.terminal_document_extensions())
READ_CHUNK_BYTES = 1024 * 1024
DOCUMENT_NAME_RE = re.compile(r"[^\w.-]+", re.UNICODE)
DOCUMENT_DEFAULT_STEM = "file"
DOCUMENT_MAX_STEM = 48
DOCUMENT_MIME = "application/octet-stream"
EXECUTABLE_SIGNATURES = (b"MZ", b"\x7fELF", b"\xcf\xfa\xed\xfe", b"\xfe\xed\xfa\xcf", b"\xca\xfe\xba\xbe", b"#!")
NAME_TIME_FORMAT = "%y%m%d%H%M%S"
NAME_RANDOM_BYTES = 2
HEAD_HEX_BYTES = 16

ERROR_IMAGE_MISSING = "terminal_image_missing"
ERROR_IMAGE_TOO_LARGE = "terminal_image_too_large"
ERROR_IMAGE_UNSUPPORTED = "terminal_image_unsupported_type"
ERROR_IMAGE_READ_FAILED = "terminal_image_read_failed"
ERROR_IMAGE_WRITE_FAILED = "terminal_image_write_failed"
ERROR_DOCUMENT_UNSUPPORTED = "terminal_document_unsupported_type"

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


def document_file_name(original: str) -> Optional[str]:
    """Sanitized ``stem.ext`` of an uploaded document name, or None when the extension is not allowed."""
    base = Path(str(original or "").replace("\\", "/")).name
    stem, extension = os.path.splitext(base)
    extension = DOCUMENT_NAME_RE.sub("", extension).lower().lstrip(".")
    if extension not in TERMINAL_DOCUMENT_EXTENSIONS:
        return None
    stem = DOCUMENT_NAME_RE.sub("_", stem).strip("._")[:DOCUMENT_MAX_STEM] or DOCUMENT_DEFAULT_STEM
    return f"{stem}.{extension}"


def is_disguised_executable(data: bytes, extension: str) -> bool:
    """Native executables and shell scripts never pass as documents (an apk is a zip and is not matched)."""
    return data.startswith(EXECUTABLE_SIGNATURES) and extension != "txt"


class TerminalImageStore:
    """Images live in ``directory``; voice recordings in ``voice_directory`` with their own short retention;
    documents in ``document_directory`` keep their sanitized name behind a unique prefix."""

    def __init__(self, directory: Path, voice_directory: Path, sent_index: Path, document_directory: Path) -> None:
        self.directory = directory
        self.voice_directory = voice_directory
        self.document_directory = document_directory
        self.archive = TerminalImageArchive(directory, sent_index)

    def resolve_image(self, reference: str) -> Optional[Path]:
        """Stored image for a sent name or path; an archived image is found under its original name."""
        return self.archive.resolve(reference)

    def read_stream(self, stream: BinaryIO) -> Dict[str, Any]:
        """Read at most the cap (+1 byte to detect overflow); no total deadline."""
        chunks = []
        total = 0
        while total <= TERMINAL_IMAGE_MAX_BYTES:
            try:
                chunk = stream.read(READ_CHUNK_BYTES)
            except OSError as exc:
                ColorPrint.yellow(f"[TerminalImageStore] read upload failed after {total} bytes: {exc}")
                return {"success": False, "error_code": ERROR_IMAGE_READ_FAILED, "received_bytes": total, "error": str(exc)}
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
        if total > TERMINAL_IMAGE_MAX_BYTES:
            ColorPrint.yellow(f"[TerminalImageStore] upload rejected: over {TERMINAL_IMAGE_MAX_BYTES} bytes")
            return {
                "success": False,
                "error_code": ERROR_IMAGE_TOO_LARGE,
                "max_bytes": TERMINAL_IMAGE_MAX_BYTES,
                "received_bytes": total,
            }
        if total == 0:
            ColorPrint.yellow("[TerminalImageStore] upload rejected: empty body")
            return {"success": False, "error_code": ERROR_IMAGE_MISSING, "received_bytes": 0}
        return {"success": True, "data": b"".join(chunks)}

    def save(self, data: bytes, file_name: str = "") -> Dict[str, Any]:
        """Validate, compress an image on receipt (the original is dropped), write atomically under a short
        generated name, then prune. Data that is neither image nor voice is stored as a document when
        ``file_name`` has an allowed extension."""
        if len(data) > TERMINAL_IMAGE_MAX_BYTES:
            return {"success": False, "error_code": ERROR_IMAGE_TOO_LARGE, "max_bytes": TERMINAL_IMAGE_MAX_BYTES}
        image = detect_image_type(data)
        is_image = image is not None or is_tiff_family(data)
        detected = image or (None if is_image else detect_audio_type(data))
        compressed: Dict[str, Any] = {}
        if is_image:
            compressed = compress_upload(data, image) or {}
            detected = (compressed["extension"], compressed["mime"]) if compressed else None
        if detected is None and not is_image:
            return self._save_document(data, file_name)
        if detected is None:
            head = data[:HEAD_HEX_BYTES].hex()
            ColorPrint.yellow(f"[TerminalImageStore] upload rejected: unsupported type bytes={len(data)} head={head}")
            return {"success": False, "error_code": ERROR_IMAGE_UNSUPPORTED, "received_bytes": len(data), "head_hex": head}
        if compressed:
            data = compressed.pop("data")
            del compressed["extension"], compressed["mime"]
        extension, mime = detected
        stamp = datetime.now(timezone.utc).strftime(NAME_TIME_FORMAT)
        name = f"{stamp}{secrets.token_hex(NAME_RANDOM_BYTES)}.{extension}"
        path = (self.directory if is_image else self.voice_directory) / name
        try:
            atomic_write_bytes(path, data)
        except OSError as exc:
            ColorPrint.yellow(f"[TerminalImageStore] write failed path={path}: {exc}")
            return {"success": False, "error_code": ERROR_IMAGE_WRITE_FAILED, "received_bytes": len(data), "error": str(exc)}
        self.prune()
        return {**compressed, "success": True, "path": str(path), "name": name, "bytes": len(data), "mime": mime}

    def _save_document(self, data: bytes, file_name: str) -> Dict[str, Any]:
        document_name = document_file_name(file_name)
        if document_name is None or is_disguised_executable(data, document_name.rsplit(".", 1)[1]):
            head = data[:HEAD_HEX_BYTES].hex()
            ColorPrint.yellow(f"[TerminalImageStore] upload rejected: unsupported document name={file_name!r} bytes={len(data)} head={head}")
            return {"success": False, "error_code": ERROR_DOCUMENT_UNSUPPORTED, "received_bytes": len(data), "head_hex": head}
        stamp = datetime.now(timezone.utc).strftime(NAME_TIME_FORMAT)
        name = f"{stamp}{secrets.token_hex(NAME_RANDOM_BYTES)}_{document_name}"
        path = self.document_directory / name
        try:
            atomic_write_bytes(path, data)
        except OSError as exc:
            ColorPrint.yellow(f"[TerminalImageStore] write failed path={path}: {exc}")
            return {"success": False, "error_code": ERROR_IMAGE_WRITE_FAILED, "received_bytes": len(data), "error": str(exc)}
        self.prune()
        return {"success": True, "path": str(path), "name": name, "bytes": len(data), "mime": DOCUMENT_MIME, "kind": "document"}

    def prune(self) -> None:
        prune_files(self.directory, TERMINAL_IMAGE_RETAIN_COUNT, TERMINAL_IMAGE_RETAIN_SECONDS, "TerminalImageStore")
        prune_files(self.document_directory, TERMINAL_IMAGE_RETAIN_COUNT, TERMINAL_IMAGE_RETAIN_SECONDS, "TerminalImageStore")
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
    APP_DATA_DIR / TERMINAL_IMAGE_SENT_INDEX_NAME,
    APP_DATA_DIR / TERMINAL_DOCUMENT_DIR_NAME,
)
