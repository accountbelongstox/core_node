# -*- coding: utf-8 -*-
"""History archive of sent terminal images: each one is shrunk to at most the archive size.

The file name is the key-value: ``<stem>.<ext>`` is the original, ``<stem>.z.<ext>`` its archived
version. The stem never changes, so a reference to the original name resolves to the archive by
name alone, and a scan knows what is archived without opening any file.
"""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.atomic_json_store import atomic_write_bytes, atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image, get_third_package_PIL_ImageOps
from pycore.pyctl.terminal.terminal_image_compress import encode_jpeg_within, flatten_rgb
from pycore.pyutils.common.relay_contract import relay_contract

ARCHIVE_MAX_BYTES = relay_contract.limit("terminal_image_archive_bytes")
ARCHIVE_MIN_AGE_SECONDS = relay_contract.limit("terminal_image_archive_min_age_seconds")
ARCHIVE_MARKER = ".z"
ARCHIVE_EXTENSION = ".jpg"
ARCHIVE_START_SIDE = 1280
ARCHIVE_QUALITIES = (70, 55, 40, 30)
LABEL = "TerminalImageArchive"


def is_archived(path: Path) -> bool:
    return Path(path.stem).suffix == ARCHIVE_MARKER


def image_key(path: Path) -> str:
    """The stem shared by an original and its archive."""
    return Path(path.stem).stem if is_archived(path) else path.stem


def encode_within(source: Path, max_bytes: int) -> Optional[bytes]:
    """JPEG of the image at most ``max_bytes``: lower quality first, then smaller sides."""
    image_module = get_third_package_PIL_Image()
    image_ops = get_third_package_PIL_ImageOps()
    with image_module.open(source) as opened:
        image = flatten_rgb(image_ops.exif_transpose(opened))
    encoded = encode_jpeg_within(image, max_bytes, ARCHIVE_QUALITIES, ARCHIVE_START_SIDE)
    return encoded[0] if encoded else None


class TerminalImageArchive:
    """Archives the history images of ``directory``: images already sent, never the ones of the message
    being sent nor uploads still waiting in a draft. Sent names persist in ``sent_index``."""

    def __init__(self, directory: Path, sent_index: Path) -> None:
        self.directory = directory
        self.sent_index = sent_index
        self._lock = threading.Lock()
        self._sent_lock = threading.Lock()
        self._sent: Optional[set] = None

    def _load_sent(self) -> set:
        if self._sent is None:
            try:
                self._sent = set(json.loads(self.sent_index.read_text(encoding="utf-8")))
            except (OSError, ValueError, TypeError):
                self._sent = set()
        return self._sent

    def _save_sent(self) -> None:
        try:
            atomic_write_json(self.sent_index, sorted(self._load_sent()), indent=None)
        except OSError as exc:
            ColorPrint.yellow(f"[{LABEL}] sent index write failed path={self.sent_index}: {exc}")

    def _originals(self) -> list:
        try:
            return [
                Path(entry.path) for entry in os.scandir(self.directory)
                if entry.is_file() and not entry.name.startswith(".") and not is_archived(Path(entry.name))
            ]
        except OSError as exc:
            ColorPrint.yellow(f"[{LABEL}] scan failed dir={self.directory}: {exc}")
            return []

    def resolve(self, reference: str) -> Optional[Path]:
        """The stored file for an original or archived name/path: the original, else its archive."""
        key = image_key(Path(reference.strip().strip('"')))
        if not key:
            return None
        archived = self.directory / f"{key}{ARCHIVE_MARKER}{ARCHIVE_EXTENSION}"
        if archived.is_file():
            return archived
        for candidate in self.directory.glob(f"{key}.*"):
            if candidate.is_file():
                return candidate
        return None

    def archive_history_async(self, sent_text: str) -> None:
        """Record this message's images as sent, then one archive pass in the background
        (a pass already running is enough: it re-reads the sent set)."""
        if not self.directory.is_dir():
            return
        current = {path.name for path in self._originals() if path.name in sent_text}
        with self._sent_lock:
            if current - self._load_sent():
                self._load_sent().update(current)
                self._save_sent()
        if not self._lock.acquire(blocking=False):
            return
        threading.Thread(
            target=self._run, args=(current,), name="TerminalImageArchiveThread", daemon=True,
        ).start()

    def _run(self, current: set) -> None:
        try:
            self.archive_history(current)
        finally:
            self._lock.release()

    def archive_history(self, current: set) -> int:
        """Archive sent images older than the grace window, except ``current`` (this message's own)."""
        cutoff = time.time() - ARCHIVE_MIN_AGE_SECONDS
        originals = {path.name: path for path in self._originals()}
        with self._sent_lock:
            sent = set(self._load_sent())
        archived = 0
        done = {name for name in sent if name not in originals}
        for name in sent - done - current:
            path = originals[name]
            try:
                stat = path.stat()
            except OSError:
                continue
            if stat.st_mtime > cutoff:
                continue
            if self._archive_one(path, stat.st_size, stat.st_mtime):
                archived += 1
                done.add(name)
        if done:
            with self._sent_lock:
                self._load_sent().difference_update(done)
                self._save_sent()
        if archived:
            ColorPrint.cyan(f"[{LABEL}] archived {archived} history image(s) to <= {ARCHIVE_MAX_BYTES} bytes")
        return archived

    def _archive_one(self, path: Path, size: int, mtime: float) -> bool:
        key = path.stem
        try:
            if size <= ARCHIVE_MAX_BYTES:
                target = self.directory / f"{key}{ARCHIVE_MARKER}{path.suffix}"
                os.replace(path, target)
                return True
            data = encode_within(path, ARCHIVE_MAX_BYTES)
            if data is None:
                ColorPrint.yellow(f"[{LABEL}] cannot reach {ARCHIVE_MAX_BYTES} bytes path={path}")
                return False
            target = self.directory / f"{key}{ARCHIVE_MARKER}{ARCHIVE_EXTENSION}"
            atomic_write_bytes(target, data)
            os.utime(target, (mtime, mtime))
            path.unlink()
            return True
        except Exception as exc:
            ColorPrint.yellow(f"[{LABEL}] archive failed path={path}: {type(exc).__name__}: {exc}")
            return False
