# -*- coding: utf-8 -*-
"""Shared safe file operations for CodeSync transfers."""

from __future__ import annotations

import hashlib
import os
import uuid
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Tuple


_EXECUTABLE_EXTENSIONS = (".sh", ".bash", ".zsh", ".ksh", ".command")
_HASH_CHUNK_SIZE = 1024 * 1024


def normalize_relative_path(value: object) -> str:
    return str(value or "").replace("\\", "/").strip().strip("/")


def resolve_contained_path(
    root: Path,
    relative_path: object,
    *,
    allow_root: bool = False,
) -> Tuple[str, Path]:
    normalized = normalize_relative_path(relative_path)
    posix_path = PurePosixPath(normalized)
    windows_path = PureWindowsPath(normalized)
    raw_parts = normalized.split("/") if normalized else []
    if not normalized and not allow_root:
        raise ValueError("A relative path is required")
    if (
        posix_path.is_absolute()
        or windows_path.is_absolute()
        or bool(windows_path.drive)
        or any(part in ("", ".", "..") for part in raw_parts)
    ):
        raise ValueError("The path must be a normalized relative path")

    resolved_root = Path(root).resolve()
    candidate = resolved_root.joinpath(*posix_path.parts).resolve()
    if candidate == resolved_root:
        if allow_root:
            return normalized, candidate
        raise ValueError("The workspace root is not a file")
    try:
        candidate.relative_to(resolved_root)
    except ValueError as exc:
        raise ValueError("The path is outside the workspace root") from exc
    return normalized, candidate


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        chunk = stream.read(_HASH_CHUNK_SIZE)
        while chunk:
            digest.update(chunk)
            chunk = stream.read(_HASH_CHUNK_SIZE)
    return digest.hexdigest()


def _remove_temporary_file(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        return


def atomic_write_bytes(
    path: Path,
    content: bytes,
    *,
    allow_fallback: bool = False,
    preserve_mode: bool = False,
) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target_mode = target.stat().st_mode if preserve_mode and target.exists() else None
    temporary = target.with_name(f".{target.name}.{uuid.uuid4().hex}.codesync-tmp")
    try:
        temporary.write_bytes(content)
        if target_mode is not None:
            os.chmod(temporary, target_mode)
        os.replace(str(temporary), str(target))
    except PermissionError:
        _remove_temporary_file(temporary)
        if not allow_fallback:
            raise
        target.write_bytes(content)
    except Exception:
        _remove_temporary_file(temporary)
        raise


def restore_executable_bit(target: Path, content: bytes) -> None:
    if os.name != "posix":
        return
    name = target.name.lower()
    if not (name.endswith(_EXECUTABLE_EXTENSIONS) or content[:2] == b"#!"):
        return
    try:
        mode = os.stat(target).st_mode
        new_mode = mode | ((mode & 0o444) >> 2)
        if new_mode != mode:
            os.chmod(target, new_mode)
    except OSError:
        return


__all__ = [
    "atomic_write_bytes",
    "normalize_relative_path",
    "resolve_contained_path",
    "restore_executable_bit",
    "sha256_bytes",
    "sha256_file",
]
