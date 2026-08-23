# -*- coding: utf-8 -*-
"""Shared safe file operations for CodeSync transfers."""

from __future__ import annotations

import hashlib
import os
import uuid
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any, Dict, Iterable, Mapping, Tuple


_EXECUTABLE_EXTENSIONS = (".sh", ".bash", ".zsh", ".ksh", ".command")
_HASH_CHUNK_SIZE = 1024 * 1024


def normalize_relative_path(value: object) -> str:
    return str(value or "").replace("\\", "/").strip().strip("/")


def is_source_authoritative_contract_path(value: object) -> bool:
    normalized = normalize_relative_path(value)
    parts = PurePosixPath(normalized).parts
    return (
        len(parts) == 2
        and parts[0] == "config"
        and parts[1].endswith("_contract.json")
    )


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


def _finalize_file_tree(
    children_map: Dict[str, Dict[str, Any]],
) -> Tuple[list[Dict[str, Any]], int, int]:
    children = []
    total_size = 0
    total_files = 0
    for node in children_map.values():
        if node.get("type") == "dir":
            descendants, size, count = _finalize_file_tree(
                node.pop("_children", {})
            )
            node["children"] = descendants
            node["size"] = size
            node["count"] = count
            total_size += size
            total_files += count
        else:
            total_size += int(node.get("size") or 0)
            total_files += 1
        children.append(node)
    children.sort(
        key=lambda item: (
            0 if item.get("type") == "dir" else 1,
            str(item.get("name") or "").lower(),
        )
    )
    return children, total_size, total_files


def build_file_tree(
    snapshot: Mapping[str, Any],
    roots: Iterable[str],
    role: str,
    scanning: bool,
    max_files: int,
) -> Dict[str, Any]:
    """Build the canonical nested CodeSync tree from a watcher snapshot."""
    root_children: Dict[str, Dict[str, Any]] = {}
    truncated = False
    count = 0
    for destination, metadata in snapshot.items():
        if count >= max_files:
            truncated = True
            break
        count += 1
        values = metadata if isinstance(metadata, (list, tuple)) else ()
        mtime = float(values[0]) if values and isinstance(values[0], (int, float)) else 0.0
        content_hash = str(values[1]) if len(values) > 1 else ""
        size = int(values[3]) if len(values) > 3 and isinstance(values[3], (int, float)) else 0
        parts = [
            part
            for part in normalize_relative_path(destination).split("/")
            if part
        ]
        if not parts:
            continue
        cursor = root_children
        current_path = ""
        for index, part in enumerate(parts):
            current_path = f"{current_path}/{part}" if current_path else part
            if index == len(parts) - 1:
                cursor[part] = {
                    "name": part,
                    "path": current_path,
                    "type": "file",
                    "size": size,
                    "mtime": mtime,
                    "hash": content_hash,
                }
                continue
            node = cursor.get(part)
            if not node or node.get("type") != "dir":
                node = {
                    "name": part,
                    "path": current_path,
                    "type": "dir",
                    "_children": {},
                }
                cursor[part] = node
            cursor = node["_children"]
    children, total_size, total_files = _finalize_file_tree(root_children)
    return {
        "success": True,
        "role": str(role),
        "roots": [str(root) for root in roots],
        "children": children,
        "count": total_files,
        "size": total_size,
        "truncated": truncated,
        "scanning": bool(scanning),
    }


def flatten_file_tree(children: Iterable[Mapping[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Flatten file nodes by canonical relative path for drift comparison."""
    result: Dict[str, Dict[str, Any]] = {}
    for node in children or ():
        if node.get("type") == "dir":
            result.update(flatten_file_tree(node.get("children") or ()))
            continue
        path = str(node.get("path") or "")
        if path:
            result[path] = {
                "hash": str(node.get("hash") or ""),
                "size": int(node.get("size") or 0),
            }
    return result


def file_tree_drift(
    dev_tree: Mapping[str, Any],
    client_tree: Mapping[str, Any],
) -> Dict[str, Any]:
    """Compare canonical content hashes without platform newline assumptions."""
    dev_files = flatten_file_tree(dev_tree.get("children") or ())
    client_files = flatten_file_tree(client_tree.get("children") or ())
    missing = []
    changed = []
    for path, dev_value in dev_files.items():
        client_value = client_files.get(path)
        if client_value is None:
            missing.append({"path": path, "size": dev_value["size"]})
        elif client_value["hash"] != dev_value["hash"]:
            changed.append(
                {
                    "path": path,
                    "size_dev": dev_value["size"],
                    "size_client": client_value["size"],
                }
            )
    extra = [
        {"path": path, "size": value["size"]}
        for path, value in client_files.items()
        if path not in dev_files
    ]
    missing.sort(key=lambda item: item["path"])
    extra.sort(key=lambda item: item["path"])
    changed.sort(key=lambda item: item["path"])
    return {
        "dev_count": len(dev_files),
        "client_count": len(client_files),
        "in_sync": max(0, len(dev_files) - len(missing) - len(changed)),
        "missing": missing,
        "extra": extra,
        "changed": changed,
    }


def scan_code_stats(root: Path, excluder: Any) -> Dict[str, Any]:
    """Scan code statistics with the same exclusion policy as synchronization."""
    files = 0
    total_bytes = 0
    latest_mtime = 0.0
    stack = [str(Path(root).resolve())]
    while stack:
        directory = stack.pop()
        try:
            entries = tuple(os.scandir(directory))
        except OSError:
            continue
        for entry in entries:
            try:
                if entry.is_dir(follow_symlinks=False):
                    if not excluder.dir_excluded(entry.name, entry.path):
                        stack.append(entry.path)
                    continue
                if excluder.file_excluded(entry.name, entry.path):
                    continue
                stat = entry.stat(follow_symlinks=False)
            except OSError:
                continue
            files += 1
            total_bytes += stat.st_size
            latest_mtime = max(latest_mtime, stat.st_mtime)
    return {
        "files": files,
        "bytes": total_bytes,
        "last_modified": latest_mtime,
    }


__all__ = [
    "atomic_write_bytes",
    "build_file_tree",
    "file_tree_drift",
    "flatten_file_tree",
    "is_source_authoritative_contract_path",
    "normalize_relative_path",
    "resolve_contained_path",
    "restore_executable_bit",
    "scan_code_stats",
    "sha256_bytes",
    "sha256_file",
]
