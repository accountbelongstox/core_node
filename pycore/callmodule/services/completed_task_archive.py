# -*- coding: utf-8 -*-
"""Persistent Laravel terminal-task archive with local resource mirroring."""

import base64
import hashlib
import json
import mimetypes
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import unquote, urlsplit

from pycore.pyfoundations.system_paths import get_app_cache_dir
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)


_HISTORY_PATH = "/api/task-center/completed"
_PAGE_LIMIT = 500
_RESOURCE_MAX_BYTES = 256 * 1024 * 1024
_RESOURCE_KEY_HINTS = (
    "audio", "image", "video", "subtitle", "poster", "cover", "file",
    "download", "document", "archive", "media", "path", "url",
)
_RESOURCE_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac",
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg",
    ".mp4", ".webm", ".mkv", ".mov",
    ".srt", ".vtt", ".ass", ".ssa", ".sub",
    ".pdf", ".zip", ".json", ".txt", ".md", ".epub",
}
_ALLOWED_MIME_PREFIXES = ("audio/", "image/", "video/", "text/")
_ALLOWED_MIME_TYPES = {
    "application/pdf", "application/zip", "application/json",
    "application/octet-stream", "application/epub+zip",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _display_source(source: str) -> str:
    return "[inline data]" if source.startswith("data:") else source


def _atomic_json(path: Path, value: Any) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(temp, path)


def _safe_extension(source: str, mime: Optional[str] = None) -> str:
    suffix = Path(unquote(urlsplit(source).path)).suffix.lower()
    if suffix in _RESOURCE_EXTENSIONS:
        return suffix
    guessed = mimetypes.guess_extension((mime or "").split(";", 1)[0].strip())
    return guessed if guessed in _RESOURCE_EXTENSIONS else ".bin"


def _resource_string(key: str, value: str) -> bool:
    lowered_key = key.lower()
    lowered_value = value.lower().split("?", 1)[0]
    hinted = any(hint in lowered_key for hint in _RESOURCE_KEY_HINTS)
    extension = Path(lowered_value).suffix in _RESOURCE_EXTENSIONS
    return extension or hinted and (
        value.startswith(("http://", "https://", "/", "data:"))
        or _is_local_file(value)
    )


def _is_local_file(value: str) -> bool:
    if value.startswith(("http://", "https://", "data:")):
        return False
    try:
        return Path(value).is_file()
    except OSError:
        return False


def _walk_resources(value: Any, key: str = "") -> Iterable[Tuple[str, str]]:
    if isinstance(value, dict):
        for child_key, child in value.items():
            yield from _walk_resources(child, str(child_key))
    elif isinstance(value, list):
        for child in value:
            yield from _walk_resources(child, key)
    elif isinstance(value, str):
        lowered_key = key.lower()
        if "base64" in lowered_key and len(value) > 64 and not value.startswith("data:"):
            mime = "audio/mpeg" if "audio" in lowered_key else "image/png" if "image" in lowered_key else "application/octet-stream"
            yield key, f"data:{mime};base64,{value}"
        elif _resource_string(key, value):
            yield key, value


def _compact_inline_resources(value: Any, key: str = "") -> Any:
    """Keep record metadata small after inline resource bytes are cached."""
    if isinstance(value, dict):
        return {
            child_key: _compact_inline_resources(child, str(child_key))
            for child_key, child in value.items()
        }
    if isinstance(value, list):
        return [_compact_inline_resources(child, key) for child in value]
    if isinstance(value, str) and len(value) > 64:
        if "base64" in key.lower() or value.startswith("data:"):
            return "[cached resource]"
    return value


class CompletedTaskArchive:
    """File-backed task archive; Laravel remains the source of truth."""

    def __init__(self) -> None:
        self.root = get_app_cache_dir() / "completed_tasks"
        self.records_dir = self.root / "records"
        self.resources_dir = self.root / "resources"
        self.manifest_path = self.root / "index.json"
        self.records_dir.mkdir(parents=True, exist_ok=True)
        self.resources_dir.mkdir(parents=True, exist_ok=True)

    def _manifest(self) -> Dict[str, Any]:
        if not self.manifest_path.is_file():
            return {"records": [], "types": {}, "resource_count": 0, "last_sync_at": None}
        try:
            data = json.loads(self.manifest_path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {"records": []}
        except (OSError, ValueError):
            return {"records": [], "types": {}, "resource_count": 0, "last_sync_at": None}

    def _record_path(self, archive_id: str) -> Path:
        digest = hashlib.sha256(archive_id.encode("utf-8")).hexdigest()
        return self.records_dir / f"{digest}.json"

    def _cache_data_url(self, source: str) -> Dict[str, Any]:
        header, encoded = source.split(",", 1)
        mime = header[5:].split(";", 1)[0] or "application/octet-stream"
        payload = base64.b64decode(encoded) if ";base64" in header else unquote(encoded).encode("utf-8")
        digest = hashlib.sha256(payload).hexdigest()
        filename = digest + _safe_extension("", mime)
        destination = self.resources_dir / filename
        if not destination.is_file():
            destination.write_bytes(payload)
        return self._resource_row(source, filename, mime, len(payload))

    def _resource_row(self, source: str, filename: str, mime: str, size: int) -> Dict[str, Any]:
        return {
            "source": _display_source(source),
            "cache_key": filename,
            "local_url": f"/api/local/tasks/completed/resources/{filename}",
            "mime": mime,
            "size": size,
            "cached": True,
        }

    def _cache_local_file(self, source: str) -> Dict[str, Any]:
        path = Path(source).resolve()
        digest = hashlib.sha256(str(path).encode("utf-8")).hexdigest()
        filename = digest + _safe_extension(str(path))
        destination = self.resources_dir / filename
        if not destination.is_file() or destination.stat().st_size != path.stat().st_size:
            shutil.copy2(path, destination)
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        return self._resource_row(source, filename, mime, destination.stat().st_size)

    def _cache_remote_file(self, source: str, base_url: str) -> Dict[str, Any]:
        absolute = source if source.startswith(("http://", "https://")) else base_url.rstrip("/") + "/" + source.lstrip("/")
        digest = hashlib.sha256(absolute.encode("utf-8")).hexdigest()
        existing = list(self.resources_dir.glob(f"{digest}.*"))
        if existing:
            path = existing[0]
            mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            return self._resource_row(source, path.name, mime, path.stat().st_size)
        response = get_laravel_client().get(absolute, timeout=30, stream=True)
        mime = (response.headers.get("Content-Type") or "application/octet-stream").split(";", 1)[0]
        allowed = mime.startswith(_ALLOWED_MIME_PREFIXES) or mime in _ALLOWED_MIME_TYPES
        if response.status_code != 200 or not allowed:
            return {"source": _display_source(source), "cached": False, "error": f"HTTP {response.status_code} {mime}"}
        filename = digest + _safe_extension(absolute, mime)
        destination = self.resources_dir / filename
        temp = destination.with_suffix(destination.suffix + ".tmp")
        size = 0
        try:
            with temp.open("wb") as handle:
                for chunk in response.iter_content(chunk_size=1024 * 256):
                    if not chunk:
                        continue
                    size += len(chunk)
                    if size > _RESOURCE_MAX_BYTES:
                        raise ValueError("resource exceeds 256 MiB cache limit")
                    handle.write(chunk)
            os.replace(temp, destination)
            return self._resource_row(source, filename, mime, size)
        except Exception as exc:  # noqa: BLE001
            temp.unlink(missing_ok=True)
            return {"source": _display_source(source), "cached": False, "error": str(exc)}

    def _cache_resources(self, record: Dict[str, Any], base_url: str) -> List[Dict[str, Any]]:
        resources: List[Dict[str, Any]] = []
        seen = set()
        for _key, source in _walk_resources({"payload": record.get("payload"), "result": record.get("result")}):
            if source in seen:
                continue
            seen.add(source)
            try:
                if source.startswith("data:"):
                    resources.append(self._cache_data_url(source))
                elif _is_local_file(source):
                    resources.append(self._cache_local_file(source))
                else:
                    resources.append(self._cache_remote_file(source, base_url))
            except Exception as exc:  # noqa: BLE001
                resources.append({"source": _display_source(source), "cached": False, "error": str(exc)})
        return resources

    @staticmethod
    def _title(record: Dict[str, Any]) -> str:
        payload = record.get("payload") if isinstance(record.get("payload"), dict) else {}
        for key in ("word", "title", "text", "content", "source_key", "query"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return str(record.get("task_id") or "")

    def _normalize(self, raw: Dict[str, Any], base_url: str) -> Dict[str, Any]:
        status = str(raw.get("status") or "completed")
        payload = raw.get("payload") if isinstance(raw.get("payload"), dict) else {}
        result = raw.get("result") if isinstance(raw.get("result"), dict) else {}
        resources = self._cache_resources(raw, base_url)
        detail = _compact_inline_resources(dict(payload))
        detail.update(_compact_inline_resources(result))
        detail["resources"] = resources
        return {
            "archive_id": f"laravel:{raw.get('source_id')}",
            "ts": raw.get("completed_at") or raw.get("updated_at") or raw.get("created_at") or _now_iso(),
            "end": "laravel",
            "worker": raw.get("worker") or "laravel",
            "task_type": raw.get("task_type") or "unknown",
            "task_id": raw.get("task_id") or "",
            "source_api": base_url,
            "title": self._title(raw),
            "content": self._title(raw),
            "language": payload.get("language") or payload.get("target_language") or "",
            "status": status,
            "success": status in ("completed", "completed_demo"),
            "posted_back": status in ("completed", "completed_demo"),
            "latency_ms": None,
            "error": raw.get("error"),
            "detail": detail,
            "resources": resources,
            "execution_type": raw.get("execution_type"),
            "capability": raw.get("capability"),
        }

    def sync_all(self) -> Dict[str, Any]:
        base_url = get_laravel_endpoint_manager().get_active_base_url()
        if not base_url:
            return {"success": False, "error": "Laravel endpoint unavailable", "synced": 0}
        manifest = self._manifest()
        rows = {str(row.get("archive_id")): row for row in manifest.get("records", []) if row.get("archive_id")}
        cursor = 0
        synced = 0
        while True:
            response = get_laravel_client().get(
                _HISTORY_PATH,
                base_url=base_url,
                params={"limit": _PAGE_LIMIT, "cursor_id": cursor},
                timeout=30,
            )
            if response.status_code != 200:
                return {"success": False, "error": f"Laravel HTTP {response.status_code}", "synced": synced}
            envelope = response.json()
            data = envelope.get("data") if isinstance(envelope, dict) else None
            records = data.get("records") if isinstance(data, dict) else None
            if not isinstance(records, list):
                return {"success": False, "error": "Invalid Laravel completed-history response", "synced": synced}
            for raw in records:
                if not isinstance(raw, dict):
                    continue
                record = self._normalize(raw, base_url)
                _atomic_json(self._record_path(record["archive_id"]), record)
                resources = record.get("resources") or []
                rows[record["archive_id"]] = {
                    "archive_id": record["archive_id"],
                    "task_id": record["task_id"],
                    "task_type": record["task_type"],
                    "status": record["status"],
                    "ts": record["ts"],
                    "worker": record["worker"],
                    "resource_count": len(resources),
                }
                synced += 1
            next_cursor = data.get("next_cursor_id") if isinstance(data, dict) else None
            if not next_cursor or not records:
                break
            cursor = int(next_cursor)
        ordered = sorted(rows.values(), key=lambda row: str(row.get("ts") or ""), reverse=True)
        types: Dict[str, int] = {}
        for row in ordered:
            task_type = str(row.get("task_type") or "unknown")
            types[task_type] = types.get(task_type, 0) + 1
        manifest = {
            "records": ordered,
            "types": types,
            "resource_count": len(list(self.resources_dir.iterdir())),
            "last_sync_at": _now_iso(),
        }
        _atomic_json(self.manifest_path, manifest)
        return {"success": True, "synced": synced, **{key: manifest[key] for key in ("types", "resource_count", "last_sync_at")}}

    def query(self, task_type: Optional[str] = None, limit: int = 200, offset: int = 0) -> Dict[str, Any]:
        manifest = self._manifest()
        rows = list(manifest.get("records") or [])
        if task_type:
            rows = [row for row in rows if row.get("task_type") == task_type]
        total = len(rows)
        start = max(0, int(offset or 0))
        size = max(1, min(int(limit or 200), 1000))
        records: List[Dict[str, Any]] = []
        for sequence, row in enumerate(rows[start:start + size], start=start):
            path = self._record_path(str(row.get("archive_id")))
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(record, dict):
                    record["seq"] = sequence
                    records.append(record)
            except (OSError, ValueError):
                continue
        return {
            "success": True,
            "records": records,
            "count": len(records),
            "total": total,
            "types": manifest.get("types") or {},
            "resource_count": int(manifest.get("resource_count") or 0),
            "last_sync_at": manifest.get("last_sync_at"),
            "offset": start,
            "limit": size,
            "next_offset": start + len(records) if start + len(records) < total else None,
        }

    def resource_path(self, cache_key: str) -> Optional[Path]:
        safe = Path(cache_key).name
        path = (self.resources_dir / safe).resolve()
        if path.parent != self.resources_dir.resolve() or not path.is_file():
            return None
        return path


_archive: Optional[CompletedTaskArchive] = None


def get_completed_task_archive() -> CompletedTaskArchive:
    global _archive
    if _archive is None:
        _archive = CompletedTaskArchive()
    return _archive
