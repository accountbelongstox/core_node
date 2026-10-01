# -*- coding: utf-8 -*-
"""Machine send service: files, text and clipboard content sent to this whole machine.

Files and text land under <APP_DATA_DIR>/rcv/<yyMMdd>/ and are opened with the
OS file manager / text editor. Clipboard content replaces the system clipboard
as text only, after the previous clipboard is backed up into a bounded history.
Every receive raises an OS notification.
"""

from __future__ import annotations

import mimetypes
import os
import re
import secrets
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, BinaryIO, Dict, Iterator, List, Optional

from pycore.pyfoundations.atomic_json_store import atomic_write_chunks, atomic_write_text
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_launcher import open_dir, open_file_with_notepad
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyutils.common.clipboard_text import (
    CLIPBOARD_KIND_EMPTY,
    CLIPBOARD_KIND_FILES,
    CLIPBOARD_KIND_IMAGE,
    CLIPBOARD_KIND_TEXT,
    get_clipboard_kind,
    get_clipboard_text,
    set_clipboard_text,
)
from pycore.pyutils.common.json_index_store import JsonIndexStore
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.launcher.text_editor_finder import text_editor_finder
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
from pycore.pyutils.native_ui.step11_desktop.system_notification import show_system_notification

RECEIVE_DIR_NAME = "rcv"
DAY_DIR_FORMAT = "%y%m%d"
TEXT_NAME_FORMAT = "%H%M%S"
TEXT_EXTENSION = ".txt"
DEFAULT_FILE_STEM = "file"
SAFE_NAME_MAX_STEM = 48
SAFE_NAME_RE = re.compile(r"[^\w.-]+", re.UNICODE)
UNIQUE_SUFFIX_BYTES = 2
READ_CHUNK_BYTES = 1024 * 1024
RECEIVE_FILE_MAX_BYTES = relay_contract.limit("machine_send_file_bytes")
RECEIVE_FILES_PER_REQUEST = relay_contract.limit("machine_send_files_per_request")
RECEIVE_TEXT_MAX_BYTES = relay_contract.limit("machine_send_text_bytes")
IMAGE_MIME_PREFIX = "image/"

ERROR_NO_FILES = "machine_receive_no_files"
ERROR_TOO_MANY_FILES = "machine_receive_too_many_files"
ERROR_FILE_TOO_LARGE = "machine_receive_file_too_large"
ERROR_TEXT_EMPTY = "machine_receive_text_empty"
ERROR_TEXT_TOO_LARGE = "machine_receive_text_too_large"
ERROR_READ_FAILED = "machine_receive_read_failed"
ERROR_WRITE_FAILED = "machine_receive_write_failed"
ERROR_CLIPBOARD_WRITE_FAILED = "clipboard_write_failed"
ERROR_CLIPBOARD_IMAGE_UNSUPPORTED = "clipboard_image_unsupported"


def _failure(error_code: str, **extra: Any) -> Dict[str, Any]:
    return {"success": False, "error_code": error_code, **extra}


def safe_file_name(original: str) -> str:
    """Basename with unsafe characters replaced, the stem shortened, the extension kept."""
    base = Path(str(original or "").replace("\\", "/")).name
    stem, extension = os.path.splitext(base)
    stem = SAFE_NAME_RE.sub("_", stem).strip("._")[:SAFE_NAME_MAX_STEM] or DEFAULT_FILE_STEM
    extension = SAFE_NAME_RE.sub("", extension).lower()
    return f"{stem}{extension}"


def _upload_size(stream: BinaryIO) -> Optional[int]:
    try:
        stream.seek(0, os.SEEK_END)
        size = stream.tell()
        stream.seek(0)
    except OSError as exc:
        ColorPrint.yellow(f"[MachineReceive] measure upload failed: {exc}")
        return None
    return size


def _read_chunks(stream: BinaryIO) -> Iterator[bytes]:
    chunk = stream.read(READ_CHUNK_BYTES)
    while chunk:
        yield chunk
        chunk = stream.read(READ_CHUNK_BYTES)


class MachineReceiveService:
    def __init__(self, root: Path) -> None:
        self.root = root

    def day_dir(self) -> Path:
        return self.root / datetime.now().strftime(DAY_DIR_FORMAT)

    @staticmethod
    def _unique_path(directory: Path, name: str) -> Path:
        path = directory / name
        while path.exists():
            stem, extension = os.path.splitext(name)
            path = directory / f"{stem}-{secrets.token_hex(UNIQUE_SUFFIX_BYTES)}{extension}"
        return path

    def _save_upload(self, upload: Any, directory: Path) -> Dict[str, Any]:
        stream = getattr(upload, "file", None)
        if stream is None:
            return _failure(ERROR_NO_FILES)
        size = _upload_size(stream)
        if size is None:
            return _failure(ERROR_READ_FAILED)
        if size > RECEIVE_FILE_MAX_BYTES:
            return _failure(ERROR_FILE_TOO_LARGE, max_bytes=RECEIVE_FILE_MAX_BYTES)
        path = self._unique_path(directory, safe_file_name(getattr(upload, "filename", "")))
        try:
            atomic_write_chunks(path, _read_chunks(stream))
        except OSError as exc:
            ColorPrint.yellow(f"[MachineReceive] write failed path={path}: {exc}")
            return _failure(ERROR_WRITE_FAILED)
        return {"success": True, "name": path.name, "path": str(path), "bytes": size}

    def receive_files(self, uploads: List[Any]) -> Dict[str, Any]:
        """Save uploaded files, open the receive dir, notify."""
        uploads = [upload for upload in (uploads or []) if upload is not None]
        if not uploads:
            return _failure(ERROR_NO_FILES)
        if len(uploads) > RECEIVE_FILES_PER_REQUEST:
            return _failure(ERROR_TOO_MANY_FILES, max_files=RECEIVE_FILES_PER_REQUEST)
        directory = self.day_dir()
        saved = []
        for upload in uploads:
            result = self._save_upload(upload, directory)
            if not result["success"]:
                return {**result, "saved": saved, "dir": str(directory)}
            saved.append({"name": result["name"], "path": result["path"], "bytes": result["bytes"]})
        open_dir(directory)
        show_system_notification(
            i18n.get(I18nKeys.RECEIVE_FILES_TITLE),
            i18n.get(I18nKeys.RECEIVE_FILES_MESSAGE).format(count=len(saved), dir=directory),
        )
        return {"success": True, "saved": saved, "dir": str(directory)}

    def receive_text(self, text: str) -> Dict[str, Any]:
        """Write text to a .txt in the receive dir, open it in the text editor, notify."""
        text = str(text or "")
        if not text.strip():
            return _failure(ERROR_TEXT_EMPTY)
        if len(text.encode("utf-8")) > RECEIVE_TEXT_MAX_BYTES:
            return _failure(ERROR_TEXT_TOO_LARGE, max_bytes=RECEIVE_TEXT_MAX_BYTES)
        directory = self.day_dir()
        path = self._unique_path(directory, f"{datetime.now().strftime(TEXT_NAME_FORMAT)}{TEXT_EXTENSION}")
        try:
            atomic_write_text(path, text)
        except OSError as exc:
            ColorPrint.yellow(f"[MachineReceive] write text failed path={path}: {exc}")
            return _failure(ERROR_WRITE_FAILED)
        open_file_with_notepad(path, text_editor_finder.find())
        show_system_notification(
            i18n.get(I18nKeys.RECEIVE_TEXT_TITLE),
            i18n.get(I18nKeys.RECEIVE_TEXT_MESSAGE).format(path=path),
            copy_text=text,
        )
        return {"success": True, "path": str(path), "bytes": path.stat().st_size}

    def set_clipboard(self, content: str = "", upload: Any = None) -> Dict[str, Any]:
        """Replace the system clipboard with text; report what it held before.

        previous = {type: text|image|files|empty|unknown, formats, text?}. Non-text
        content is reported, never backed up as binary. An image upload is saved as
        a file (clipboard images are not supported) and clipboard_image_unsupported
        is returned with the saved path.
        """
        kind = get_clipboard_kind()
        previous: Dict[str, Any] = {"type": kind["type"], "formats": kind["formats"]}
        if kind["type"] == CLIPBOARD_KIND_TEXT:
            previous["text"] = get_clipboard_text()

        content_type = str(getattr(upload, "content_type", "") or "")
        if upload is not None and content_type.startswith(IMAGE_MIME_PREFIX):
            saved = self._save_upload(upload, self.day_dir())
            if not saved["success"]:
                return {**saved, "previous": previous}
            show_system_notification(
                i18n.get(I18nKeys.RECEIVE_CLIPBOARD_TITLE),
                i18n.get(I18nKeys.RECEIVE_CLIPBOARD_IMAGE_MESSAGE).format(path=saved["path"]),
            )
            return _failure(
                ERROR_CLIPBOARD_IMAGE_UNSUPPORTED,
                previous=previous,
                saved={"name": saved["name"], "path": saved["path"], "bytes": saved["bytes"]},
            )

        text = str(content or "")
        if not text:
            return _failure(ERROR_TEXT_EMPTY, previous=previous)
        if len(text.encode("utf-8")) > RECEIVE_TEXT_MAX_BYTES:
            return _failure(ERROR_TEXT_TOO_LARGE, max_bytes=RECEIVE_TEXT_MAX_BYTES, previous=previous)
        if not set_clipboard_text(text):
            return _failure(ERROR_CLIPBOARD_WRITE_FAILED, previous=previous)
        show_system_notification(
            i18n.get(I18nKeys.RECEIVE_CLIPBOARD_TITLE),
            i18n.get(I18nKeys.RECEIVE_CLIPBOARD_MESSAGE).format(chars=len(text)),
        )
        return {"success": True, "previous": previous}


machine_receive_service = MachineReceiveService(APP_DATA_DIR / RECEIVE_DIR_NAME)
