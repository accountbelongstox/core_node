# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
import stat
import time
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Optional, Tuple, Union

from pycore.pyfoundations.data_owner import adopt_path, ensure_owned_dir


_CREATE_FLAGS = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0)
_DEFAULT_CREATE_MODE = 0o666


def _write_replace(
    target: Path,
    data: Union[bytes, Iterable[bytes]],
    file_mode: Optional[int],
    owner: Optional[Tuple[int, int]],
) -> Path:
    """Exclusive no-follow temp (created with file_mode) + fsync + os.replace.

    owner=None hands the temp to the shared data owner (data_owner policy);
    an explicit (uid, gid) is applied by fchown when root writes, keeping a
    private file private from creation to publish."""
    if owner is None:
        ensure_owned_dir(target.parent)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
    temp_path = target.parent / f".{target.name}.tmp.{os.getpid()}.{time.time_ns()}"
    descriptor = os.open(str(temp_path), _CREATE_FLAGS, file_mode if file_mode is not None else _DEFAULT_CREATE_MODE)
    try:
        if os.name != "nt":
            if file_mode is not None:
                os.fchmod(descriptor, file_mode)
            if owner is not None and os.geteuid() == 0:
                os.fchown(descriptor, owner[0], owner[1])
        with os.fdopen(descriptor, "wb") as handle:
            for chunk in ((data,) if isinstance(data, (bytes, bytearray)) else data):
                handle.write(chunk)
            handle.flush()
            os.fsync(handle.fileno())
        if owner is None:
            adopt_path(temp_path)
        os.replace(str(temp_path), str(target))
    except OSError:
        # Never leave a stray temp next to the target.
        temp_path.unlink(missing_ok=True)
        raise
    return target


def atomic_write_text(
    path: Path,
    text: str,
    file_mode: Optional[int] = None,
    newline: Optional[str] = None,
    owner: Optional[Tuple[int, int]] = None,
) -> Path:
    """Atomic text write. ``newline=None`` translates "\n" to os.linesep like
    text-mode open(); ``newline=""`` writes line endings verbatim."""
    if newline is None and os.linesep != "\n":
        text = text.replace("\n", os.linesep)
    return _write_replace(Path(path), text.encode("utf-8"), file_mode, owner)


def atomic_write_bytes(
    path: Path,
    data: bytes,
    file_mode: Optional[int] = None,
    owner: Optional[Tuple[int, int]] = None,
    preserve_mode: bool = False,
    allow_fallback: bool = False,
) -> Path:
    """Binary counterpart of atomic_write_text.

    ``preserve_mode`` keeps an existing target's permission bits.
    ``allow_fallback`` writes in place when the replace is refused
    (PermissionError, e.g. a target held open on Windows)."""
    target = Path(path)
    if preserve_mode and file_mode is None and target.exists():
        file_mode = stat.S_IMODE(target.stat().st_mode)
    try:
        return _write_replace(target, data, file_mode, owner)
    except PermissionError:
        if not allow_fallback:
            raise
        target.write_bytes(data)
        return target


def atomic_write_json(
    path: Path,
    data: Any,
    indent: Optional[int] = 2,
    file_mode: Optional[int] = None,
    newline: Optional[str] = None,
) -> Path:
    return atomic_write_text(path, json.dumps(data, ensure_ascii=False, indent=indent), file_mode, newline)


def atomic_write_chunks(path: Path, chunks: Iterable[bytes], file_mode: Optional[int] = None) -> Path:
    """Stream chunks into an exclusive temp file, fsync, then replace path (large binary payloads)."""
    return _write_replace(Path(path), chunks, file_mode, None)


class AtomicJsonStore:
    """Small JSON document store with atomic whole-file replacement."""

    def __init__(
        self,
        path: Path,
        default_factory: Callable[[], Dict[str, Any]],
        file_mode: Optional[int] = None,
    ) -> None:
        self.path = path.resolve()
        self.default_factory = default_factory
        self.file_mode = file_mode

    def exists(self) -> bool:
        return self.path.is_file()

    def read(self) -> Dict[str, Any]:
        if not self.path.is_file():
            return self.default_factory()
        data = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError(f"JSON state root must be an object: {self.path}")
        return data

    def write(self, data: Dict[str, Any]) -> None:
        atomic_write_json(self.path, data, file_mode=self.file_mode)


__all__ = ["AtomicJsonStore", "atomic_write_bytes", "atomic_write_chunks", "atomic_write_json", "atomic_write_text"]
