# -*- coding: utf-8 -*-
"""Client-hosted workspace exchange for remote CodeSync development."""

from __future__ import annotations

import base64
import binascii
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyutils.codesync.file_operations import (
    atomic_write_bytes,
    normalize_relative_path,
    resolve_contained_path,
    sha256_bytes,
    sha256_file,
)


DEFAULT_FILE_PAGE_SIZE = 1000
MAX_FILE_PAGE_SIZE = 5000
DOCS_FIX_DIRECTORY = "docs_fix"
DOCUMENT_EXTENSION = ".md"
DOCUMENT_MARKER = "codesync_document"


class WorkspaceExchangeError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = int(status_code)
        self.detail = str(detail)


def _quoted_etag(digest: str) -> str:
    return f'"{digest}"'


def _etag_values(header_value: str) -> List[str]:
    values = []
    for raw_value in str(header_value or "").split(","):
        value = raw_value.strip()
        if not value or value.startswith("W/"):
            continue
        if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
            value = value[1:-1]
        values.append(value)
    return values


def _safe_document_name(title: str) -> str:
    safe_title = "".join(
        character if character.isalnum() or character in "-_." else "_"
        for character in title
    ).strip(" ._")
    safe_title = safe_title[:96] or "document"
    title_digest = sha256_bytes(title.encode("utf-8"))[:12]
    return f"{safe_title}-{title_digest}{DOCUMENT_EXTENSION}"


def _document_bytes(title: str, content: str, document_id: str) -> bytes:
    updated_at = datetime.now(timezone.utc).isoformat()
    metadata = (
        "---\n"
        f"{DOCUMENT_MARKER}: true\n"
        f"document_id: {document_id}\n"
        f"title: {json.dumps(title, ensure_ascii=False)}\n"
        f"updated_at: {json.dumps(updated_at)}\n"
        "---\n"
    )
    return f"{metadata}{content}".encode("utf-8")


def _parse_document(path: Path, raw: bytes) -> Dict[str, Any]:
    text = raw.decode("utf-8")
    title = path.stem
    content = text
    document_id = ""
    updated_at = ""
    if text.startswith("---\n"):
        header, separator, body = text[4:].partition("\n---\n")
        if separator:
            fields = {}
            for line in header.splitlines():
                key, delimiter, value = line.partition(":")
                if delimiter:
                    fields[key.strip()] = value.strip()
            if fields.get(DOCUMENT_MARKER) == "true":
                content = body
                document_id = fields.get("document_id", "")
                updated_at = fields.get("updated_at", "").strip('"')
                encoded_title = fields.get("title", "")
                if encoded_title:
                    try:
                        title = str(json.loads(encoded_title))
                    except (TypeError, ValueError, json.JSONDecodeError):
                        title = encoded_title.strip('"')
    stat = path.stat()
    relative_path = f"{DOCS_FIX_DIRECTORY}/{path.name}"
    digest = sha256_bytes(raw)
    return {
        "success": True,
        "path": relative_path,
        "title": title,
        "content": content,
        "document_id": document_id,
        "updated_at": updated_at,
        "mtime_ns": int(stat.st_mtime_ns),
        "size": len(raw),
        "sha256": digest,
        "etag": _quoted_etag(digest),
    }


class WorkspaceExchange:
    def __init__(self, root: Path) -> None:
        self.root = Path(root).resolve()
        self._write_lock = threading.RLock()

    def capabilities(self) -> Dict[str, Any]:
        return {
            "success": True,
            "direction": "dev-to-client",
            "workspace": "core_node",
            "documents_directory": DOCS_FIX_DIRECTORY,
            "transport_security": "tls-or-private-tunnel-required",
            "file_content_encoding": "base64",
            "file_pagination": {
                "default_limit": DEFAULT_FILE_PAGE_SIZE,
                "maximum_limit": MAX_FILE_PAGE_SIZE,
                "cursor": "next_cursor",
            },
            "conditional_write": {
                "update": "If-Match",
                "create": "If-None-Match: *",
            },
        }

    def list_files(
        self,
        cursor: str = "",
        limit: int = DEFAULT_FILE_PAGE_SIZE,
        include_hash: bool = False,
    ) -> Dict[str, Any]:
        normalized_cursor = normalize_relative_path(cursor)
        try:
            page_size = int(limit or DEFAULT_FILE_PAGE_SIZE)
        except (TypeError, ValueError) as exc:
            raise WorkspaceExchangeError(400, "limit must be an integer") from exc
        if page_size < 1 or page_size > MAX_FILE_PAGE_SIZE:
            raise WorkspaceExchangeError(
                400,
                f"limit must be between 1 and {MAX_FILE_PAGE_SIZE}",
            )

        relative_paths = []
        for directory, directory_names, file_names in os.walk(
            self.root,
            topdown=True,
            followlinks=False,
        ):
            directory_path = Path(directory)
            directory_names[:] = sorted(
                name
                for name in directory_names
                if not (directory_path / name).is_symlink()
            )
            for file_name in sorted(file_names):
                file_path = directory_path / file_name
                if (
                    file_name.endswith(".codesync-tmp")
                    or file_path.is_symlink()
                    or not file_path.is_file()
                ):
                    continue
                relative_path = file_path.relative_to(self.root).as_posix()
                if relative_path > normalized_cursor:
                    relative_paths.append(relative_path)
        relative_paths.sort()

        selected_paths = relative_paths[: page_size + 1]
        has_more = len(selected_paths) > page_size
        selected_paths = selected_paths[:page_size]
        files = []
        for relative_path in selected_paths:
            _, file_path = resolve_contained_path(self.root, relative_path)
            try:
                stat = file_path.stat()
            except OSError:
                continue
            item = {
                "path": relative_path,
                "size": int(stat.st_size),
                "mtime_ns": int(stat.st_mtime_ns),
            }
            if include_hash:
                try:
                    item["sha256"] = sha256_file(file_path)
                except OSError:
                    continue
            files.append(item)

        next_cursor = selected_paths[-1] if has_more and selected_paths else ""
        return {
            "success": True,
            "files": files,
            "count": len(files),
            "next_cursor": next_cursor,
            "has_more": has_more,
        }

    def read_file(self, relative_path: str) -> Dict[str, Any]:
        normalized, file_path = self._resolve_file(relative_path)
        raw = file_path.read_bytes()
        stat = file_path.stat()
        digest = sha256_bytes(raw)
        return {
            "success": True,
            "path": normalized,
            "content_base64": base64.b64encode(raw).decode("ascii"),
            "size": len(raw),
            "mtime_ns": int(stat.st_mtime_ns),
            "sha256": digest,
            "etag": _quoted_etag(digest),
        }

    def write_file(
        self,
        relative_path: str,
        content_base64: str,
        *,
        content_sha256: str = "",
        if_match: str = "",
        if_none_match: str = "",
    ) -> Dict[str, Any]:
        normalized, file_path = self._resolve_target(relative_path)
        content = self._decode_content(content_base64)
        incoming_digest = sha256_bytes(content)
        claimed_digest = str(content_sha256 or "").strip().lower()
        if claimed_digest and claimed_digest != incoming_digest:
            raise WorkspaceExchangeError(422, "content_sha256 does not match the payload")

        with self._write_lock:
            exists = file_path.exists()
            if exists and not file_path.is_file():
                raise WorkspaceExchangeError(409, "The target path is not a file")
            current_digest = sha256_file(file_path) if exists else ""
            if exists and current_digest == incoming_digest:
                return self._write_result(
                    normalized,
                    file_path,
                    incoming_digest,
                    created=False,
                    changed=False,
                )

            self._require_write_precondition(
                exists,
                current_digest,
                if_match,
                if_none_match,
            )
            atomic_write_bytes(
                file_path,
                content,
                preserve_mode=exists,
            )
            return self._write_result(
                normalized,
                file_path,
                incoming_digest,
                created=not exists,
                changed=True,
            )

    def write_document(self, title: str, content: str) -> Dict[str, Any]:
        if not isinstance(title, str):
            raise WorkspaceExchangeError(400, "title must be a string")
        if not isinstance(content, str):
            raise WorkspaceExchangeError(400, "content must be a string")
        normalized_title = title.strip()
        normalized_content = content
        if not normalized_title:
            raise WorkspaceExchangeError(400, "title is required")
        document_id = sha256_bytes(
            f"{normalized_title}\x00{normalized_content}".encode("utf-8")
        )
        relative_path = f"{DOCS_FIX_DIRECTORY}/{_safe_document_name(normalized_title)}"
        normalized, document_path = self._resolve_target(relative_path)

        with self._write_lock:
            if document_path.exists():
                existing = document_path.read_bytes()
                parsed = _parse_document(document_path, existing)
                if parsed.get("document_id") == document_id:
                    parsed.update({"created": False, "changed": False, "status_code": 200})
                    return parsed
            raw = _document_bytes(normalized_title, normalized_content, document_id)
            created = not document_path.exists()
            atomic_write_bytes(document_path, raw, preserve_mode=not created)
            result = _parse_document(document_path, raw)
            result.update(
                {
                    "path": normalized,
                    "created": created,
                    "changed": True,
                    "status_code": 201 if created else 200,
                }
            )
            return result

    def latest_document(self) -> Dict[str, Any]:
        _, documents_path = resolve_contained_path(
            self.root,
            DOCS_FIX_DIRECTORY,
        )
        if not documents_path.is_dir():
            raise WorkspaceExchangeError(404, "No docs_fix documents are available")
        documents = [
            path
            for path in documents_path.iterdir()
            if path.is_file() and not path.is_symlink() and path.suffix.lower() == DOCUMENT_EXTENSION
        ]
        if not documents:
            raise WorkspaceExchangeError(404, "No docs_fix documents are available")
        latest = max(documents, key=lambda path: (path.stat().st_mtime_ns, path.name))
        return _parse_document(latest, latest.read_bytes())

    def _resolve_file(self, relative_path: str) -> tuple[str, Path]:
        normalized, file_path = self._resolve_target(relative_path)
        if not file_path.is_file():
            raise WorkspaceExchangeError(404, f"File not found: {normalized}")
        return normalized, file_path

    def _resolve_target(self, relative_path: str) -> tuple[str, Path]:
        try:
            return resolve_contained_path(self.root, relative_path)
        except (OSError, ValueError) as exc:
            raise WorkspaceExchangeError(400, str(exc)) from exc

    @staticmethod
    def _decode_content(content_base64: str) -> bytes:
        if not isinstance(content_base64, str):
            raise WorkspaceExchangeError(400, "content_base64 must be a string")
        try:
            return base64.b64decode(content_base64.encode("ascii"), validate=True)
        except (UnicodeEncodeError, binascii.Error) as exc:
            raise WorkspaceExchangeError(400, "content_base64 is invalid") from exc

    @staticmethod
    def _require_write_precondition(
        exists: bool,
        current_digest: str,
        if_match: str,
        if_none_match: str,
    ) -> None:
        raw_if_match = str(if_match or "").strip()
        raw_if_none_match = str(if_none_match or "").strip()
        match_values = _etag_values(if_match)
        none_match_values = _etag_values(if_none_match)
        if raw_if_match:
            if not match_values or ("*" in match_values and match_values != ["*"]):
                raise WorkspaceExchangeError(412, "If-Match precondition failed")
            if not exists or ("*" not in match_values and current_digest not in match_values):
                raise WorkspaceExchangeError(412, "If-Match precondition failed")
        if raw_if_none_match and none_match_values == ["*"]:
            if exists:
                raise WorkspaceExchangeError(412, "If-None-Match precondition failed")
            return
        if raw_if_match and not raw_if_none_match:
            return
        raise WorkspaceExchangeError(
            428,
            "Use If-Match to update a file or If-None-Match: * to create one",
        )

    @staticmethod
    def _write_result(
        relative_path: str,
        file_path: Path,
        digest: str,
        *,
        created: bool,
        changed: bool,
    ) -> Dict[str, Any]:
        stat = file_path.stat()
        return {
            "success": True,
            "path": relative_path,
            "created": created,
            "changed": changed,
            "size": int(stat.st_size),
            "mtime_ns": int(stat.st_mtime_ns),
            "sha256": digest,
            "etag": _quoted_etag(digest),
            "status_code": 201 if created else 200,
        }


class _WorkspaceExchangeProvider:
    def __init__(self) -> None:
        self._instance: Optional[WorkspaceExchange] = None
        self._root: Optional[Path] = None
        self._lock = threading.Lock()

    def get(self, root: Path) -> WorkspaceExchange:
        resolved_root = Path(root).resolve()
        with self._lock:
            if self._instance is None or self._root != resolved_root:
                self._instance = WorkspaceExchange(resolved_root)
                self._root = resolved_root
            return self._instance


_workspace_exchange_provider = _WorkspaceExchangeProvider()


def get_workspace_exchange(root: Path) -> WorkspaceExchange:
    return _workspace_exchange_provider.get(root)


__all__ = [
    "DEFAULT_FILE_PAGE_SIZE",
    "MAX_FILE_PAGE_SIZE",
    "WorkspaceExchange",
    "WorkspaceExchangeError",
    "get_workspace_exchange",
]
