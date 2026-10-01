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
from typing import Any, BinaryIO, Dict, Iterator, Optional

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
DEFAULT_MIME = "application/octet-stream"
SEND_FILE_MAX_BYTES = relay_contract.limit("machine_send_file_bytes")
SEND_TEXT_MAX_BYTES = relay_contract.limit("machine_send_text_bytes")
SEND_FILES_PER_REQUEST = relay_contract.limit("machine_send_files_per_request")
CLIPBOARD_HISTORY_FILE = "clipboard_history.json"
CLIPBOARD_HISTORY_MAX_ENTRIES = 100
CLIPBOARD_ENTRY_TEXT_MAX_CHARS = 65536

CLIPBOARD_SEND_TEXT = "text"
CLIPBOARD_SEND_IMAGE = "image"
CLIPBOARD_SEND_FILE = "file"
ENTRY_KIND_OTHER = "other"
ENTRY_KINDS = frozenset({CLIPBOARD_KIND_TEXT, CLIPBOARD_KIND_IMAGE, CLIPBOARD_KIND_FILES, CLIPBOARD_KIND_EMPTY})

ERROR_MISSING = "machine_send_missing"
ERROR_TOO_LARGE = "machine_send_too_large"
ERROR_TOO_MANY_FILES = "machine_send_too_many_files"
ERROR_TEXT_EMPTY = "machine_send_text_empty"
ERROR_TEXT_TOO_LARGE = "machine_send_text_too_large"
ERROR_READ_FAILED = "machine_send_read_failed"
ERROR_WRITE_FAILED = "machine_send_write_failed"
ERROR_BAD_KIND = "machine_send_bad_kind"
ERROR_NOT_FOUND = "machine_send_entry_not_found"
ERROR_CLIPBOARD_WRITE_FAILED = "clipboard_write_failed"
ERROR_CLIPBOARD_IMAGE_UNSUPPORTED = "clipboard_image_unsupported"


def _failure(error_code: str, **extra: Any) -> Dict[str, Any]:
    return {"success": False, "error_code": error_code, **extra}


def safe_file_name(original: str, default_extension: str = "") -> str:
    """Basename with unsafe characters replaced, the stem shortened, the extension kept."""
    base = Path(str(original or "").replace("\\", "/")).name
    stem, extension = os.path.splitext(base)
    stem = SAFE_NAME_RE.sub("_", stem).strip("._")[:SAFE_NAME_MAX_STEM] or DEFAULT_FILE_STEM
    extension = SAFE_NAME_RE.sub("", extension).lower() or default_extension
    return f"{stem}{extension}"


def _upload_size(stream: BinaryIO) -> Optional[int]:
    try:
        stream.seek(0, os.SEEK_END)
        size = stream.tell()
        stream.seek(0)
    except OSError as exc:
        ColorPrint.yellow(f"[MachineSend] measure upload failed: {exc}")
        return None
    return size


def _read_chunks(stream: BinaryIO) -> Iterator[bytes]:
    chunk = stream.read(READ_CHUNK_BYTES)
    while chunk:
        yield chunk
        chunk = stream.read(READ_CHUNK_BYTES)


def _first_upload(upload: Any) -> Any:
    if isinstance(upload, (list, tuple)):
        return upload[0] if upload else None
    return upload


def _upload_list(upload: Any) -> list:
    uploads = list(upload) if isinstance(upload, (list, tuple)) else [upload]
    return [item for item in uploads if item is not None]


class MachineSendService:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.history = JsonIndexStore(
            CLIPBOARD_HISTORY_FILE,
            lambda: self.root,
            CLIPBOARD_HISTORY_MAX_ENTRIES,
            "machine_clipboard_history",
        )

    def day_dir(self) -> Path:
        return self.root / datetime.now().strftime(DAY_DIR_FORMAT)

    @staticmethod
    def _unique_path(directory: Path, name: str) -> Path:
        path = directory / name
        while path.exists():
            stem, extension = os.path.splitext(name)
            path = directory / f"{stem}-{secrets.token_hex(UNIQUE_SUFFIX_BYTES)}{extension}"
        return path

    def _save_upload(self, upload: Any) -> Dict[str, Any]:
        stream = getattr(upload, "file", None)
        if stream is None:
            return _failure(ERROR_MISSING)
        size = _upload_size(stream)
        if size is None:
            return _failure(ERROR_READ_FAILED)
        if size > SEND_FILE_MAX_BYTES:
            return _failure(ERROR_TOO_LARGE, max_bytes=SEND_FILE_MAX_BYTES)
        directory = self.day_dir()
        path = self._unique_path(directory, safe_file_name(getattr(upload, "filename", "")))
        try:
            atomic_write_chunks(path, _read_chunks(stream))
        except OSError as exc:
            ColorPrint.yellow(f"[MachineSend] write failed path={path}: {exc}")
            return _failure(ERROR_WRITE_FAILED)
        mime = str(getattr(upload, "content_type", "") or "") or mimetypes.guess_type(path.name)[0] or DEFAULT_MIME
        return {"success": True, "path": str(path), "name": path.name, "bytes": size, "mime": mime,
                "directory": str(directory)}

    def send_file(self, upload: Any, open_dir_after: bool = True) -> Dict[str, Any]:
        """Save the uploaded file(s); open the receive dir unless disabled; notify once.

        The top-level fields describe the first file; ``saved`` lists every file
        (a request may repeat ``file`` up to the per-request cap).
        """
        uploads = _upload_list(upload)
        if not uploads:
            return _failure(ERROR_MISSING)
        if len(uploads) > SEND_FILES_PER_REQUEST:
            return _failure(ERROR_TOO_MANY_FILES, max_files=SEND_FILES_PER_REQUEST)
        saved_files = []
        for item in uploads:
            saved = self._save_upload(item)
            if not saved["success"]:
                return {**saved, "saved": saved_files}
            saved_files.append(saved)
        first = saved_files[0]
        opened = open_dir(first["directory"]) if open_dir_after else False
        show_system_notification(
            i18n.get(I18nKeys.RECEIVE_FILES_TITLE),
            i18n.get(I18nKeys.RECEIVE_FILES_MESSAGE).format(count=len(saved_files), dir=first["directory"]),
        )
        listing = [{key: saved[key] for key in ("name", "path", "bytes", "mime")} for saved in saved_files]
        return {**first, "opened": opened, "saved": listing}

    def send_text(self, text: str, name: str = "") -> Dict[str, Any]:
        """Write text to a .txt in the receive dir, open it in the text editor, notify."""
        text = str(text or "")
        if not text.strip():
            return _failure(ERROR_TEXT_EMPTY)
        if len(text.encode("utf-8")) > SEND_TEXT_MAX_BYTES:
            return _failure(ERROR_TEXT_TOO_LARGE, max_bytes=SEND_TEXT_MAX_BYTES)
        file_name = safe_file_name(name, TEXT_EXTENSION) if name else f"{datetime.now().strftime(TEXT_NAME_FORMAT)}{TEXT_EXTENSION}"
        path = self._unique_path(self.day_dir(), file_name)
        try:
            atomic_write_text(path, text)
        except OSError as exc:
            ColorPrint.yellow(f"[MachineSend] write text failed path={path}: {exc}")
            return _failure(ERROR_WRITE_FAILED)
        opened = open_file_with_notepad(path, text_editor_finder.find())
        show_system_notification(
            i18n.get(I18nKeys.RECEIVE_TEXT_TITLE),
            i18n.get(I18nKeys.RECEIVE_TEXT_MESSAGE).format(path=path),
            copy_text=text,
        )
        return {"success": True, "path": str(path), "bytes": path.stat().st_size, "opened": opened}

    def _backup_clipboard(self) -> Optional[Dict[str, Any]]:
        """Record the current clipboard as a ClipboardEntry (text only; non-text described)."""
        kind = get_clipboard_kind()
        if kind["type"] == CLIPBOARD_KIND_EMPTY:
            return None
        entry: Dict[str, Any] = {
            "id": uuid.uuid4().hex,
            "kind": kind["type"] if kind["type"] in ENTRY_KINDS else ENTRY_KIND_OTHER,
            "at": int(time.time() * 1000),
            "formats": kind["formats"],
        }
        if kind["type"] == CLIPBOARD_KIND_TEXT:
            text = get_clipboard_text() or ""
            entry["text"] = text[:CLIPBOARD_ENTRY_TEXT_MAX_CHARS]
            entry["bytes"] = len(text.encode("utf-8"))
        else:
            mime = next((name for name in kind["formats"] if "/" in name), "")
            entry["mime"] = mime or ", ".join(kind["formats"])
        return self.history.append(entry)

    def send_clipboard(self, kind: str = CLIPBOARD_SEND_TEXT, text: str = "", upload: Any = None) -> Dict[str, Any]:
        """Back up the current clipboard, then replace it.

        kind=text: the clipboard becomes ``text``. kind=file: the file is saved and the
        clipboard becomes its path (text). kind=image: the image is saved, the clipboard
        is left unchanged and clipboard_image_unsupported is returned with the path.
        """
        if kind not in (CLIPBOARD_SEND_TEXT, CLIPBOARD_SEND_IMAGE, CLIPBOARD_SEND_FILE):
            return _failure(ERROR_BAD_KIND, backup=None, notified=False)
        if kind == CLIPBOARD_SEND_TEXT:
            content = str(text or "")
            if not content:
                return _failure(ERROR_TEXT_EMPTY, backup=None, notified=False)
            if len(content.encode("utf-8")) > SEND_TEXT_MAX_BYTES:
                return _failure(ERROR_TEXT_TOO_LARGE, max_bytes=SEND_TEXT_MAX_BYTES, backup=None, notified=False)
            saved = None
        else:
            saved = self._save_upload(_first_upload(upload))
            if not saved["success"]:
                return {**saved, "backup": None, "notified": False}
            if kind == CLIPBOARD_SEND_IMAGE:
                notified = show_system_notification(
                    i18n.get(I18nKeys.RECEIVE_CLIPBOARD_TITLE),
                    i18n.get(I18nKeys.RECEIVE_CLIPBOARD_IMAGE_MESSAGE).format(path=saved["path"]),
                )
                return _failure(ERROR_CLIPBOARD_IMAGE_UNSUPPORTED, backup=None, notified=notified,
                                path=saved["path"], name=saved["name"], bytes=saved["bytes"], mime=saved["mime"])
            content = saved["path"]
        backup = self._backup_clipboard()
        if not set_clipboard_text(content):
            return _failure(ERROR_CLIPBOARD_WRITE_FAILED, backup=backup, notified=False)
        notified = show_system_notification(
            i18n.get(I18nKeys.RECEIVE_CLIPBOARD_TITLE),
            i18n.get(I18nKeys.RECEIVE_CLIPBOARD_MESSAGE).format(chars=len(content)),
        )
        result = {"success": True, "backup": backup, "notified": notified}
        if saved is not None:
            result.update(path=saved["path"], name=saved["name"], bytes=saved["bytes"], mime=saved["mime"])
        return result

    def clipboard_history(self, limit: Optional[int] = None) -> Dict[str, Any]:
        return {"success": True, "entries": self.history.entries(int(limit) if limit else None)}

    def clipboard_history_delete(self, entry_id: str) -> Dict[str, Any]:
        if self.history.delete(str(entry_id or "")) is None:
            return _failure(ERROR_NOT_FOUND)
        return {"success": True}

    def clipboard_history_clear(self) -> Dict[str, Any]:
        return {"success": True, "removed": self.history.clear()}


machine_send_service = MachineSendService(APP_DATA_DIR / RECEIVE_DIR_NAME)
