# -*- coding: utf-8 -*-
"""
Audio-orchestration persistence layer.

Everything lives under ``get_app_data_dir()/audio_orchestration/`` (the pycore
user data directory — resolved via system_paths, never hardcoded):

    auth.json                    qy-app login session (username, token, user id)
    books_cache.json             Laravel media/books list snapshot
    book_sentences/<key>.json    per-book ordered sentence cache
    sync_state.json              background fetch progress (books + sentences)
    system_status.json           cached ffmpeg/system probe (TTL-refreshed)
    tasks/<task_id>.json         one orchestration task record per file
    output/<task_slug>/          generated segment audio (segment_001.mp3, ...)

Task record shape (all JSON-able):

    task_id, name, slug,
    book: {source_key, title, language, target_language},
    segment_mode: "count"|"minutes", segment_value: int,
    pattern: [{type: "sentence_en"|"sentence_zh"|"words", times: int}],
    word_mode: "new_only"|"all", new_only_max_read_count: int,
    virtual_read: [word, ...]        task-scoped virtual read set (never written
                                     back to the backend Word Groups),
    segments: [{index, start, end, status, output, error}],
    status: draft|planned|generating|done|failed,
    progress: {segment_index, item_index, item_total, message, current_item,
               cache_hits, laravel_hits, generated, missing},
    events: [{ts, message}]        capped generation log (viewable in the UI),
    created_at, updated_at

File operations use independent THREAD_BUS state owners and never raise; callers get
None / [] / False on missing data.
"""

import json
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_app_data_dir
from pycore.pyutils.common.serialized_files import serialized_file

_AUTH_FILE = "auth.json"
_BOOKS_CACHE_FILE = "books_cache.json"
_SYNC_STATE_FILE = "sync_state.json"
_SYSTEM_STATUS_FILE = "system_status.json"
_TASKS_DIR = "tasks"
_BOOK_SENTENCES_DIR = "book_sentences"
_BOOK_SENTENCES_PARTIAL_DIR = "book_sentences_partial"
_OUTPUT_DIR = "output"
_TASK_EVENT_CAP = 200
ORCH_REQUEST_TIMEOUT = 60


def base_dir() -> Path:
    directory = get_app_data_dir() / "audio_orchestration"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


@serialized_file
def _read_json(path: Path) -> Optional[Any]:
    try:
        if not path.is_file():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] read json failed {path.name}: {exc}")
        return None


@serialized_file
def _write_json(path: Path, payload: Any) -> bool:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(f"{path.name}.partial.{uuid.uuid4().hex}")
        tmp.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        tmp.replace(path)
        return True
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[AudioOrch] write json failed {path.name}: {exc}")
        return False


def slugify(name: str) -> str:
    """ASCII-only folder-safe slug for a task name (output paths stay English)."""
    slug = re.sub(r"[^A-Za-z0-9]+", "_", str(name or "")).strip("_").lower()
    return slug or "task"


# --------------------------------------------------------------------------- #
# qy-app auth session                                                          #
# --------------------------------------------------------------------------- #
def save_auth(username: str, token: str, user: Dict[str, Any], base_url: str = "") -> bool:
    record = {
        "username": username,
        "token": token,
        "user": user or {},
        "base_url": base_url,
        "logged_at": int(time.time()),
    }
    return _write_json(base_dir() / _AUTH_FILE, record)


def load_auth() -> Optional[Dict[str, Any]]:
    record = _read_json(base_dir() / _AUTH_FILE)
    if not isinstance(record, dict) or not record.get("token"):
        return None
    return record


@serialized_file
def _delete_json(path: Path) -> bool:
    if path.is_file():
        path.unlink()
        return True
    return False


def clear_auth() -> bool:
    path = base_dir() / _AUTH_FILE
    if not path.is_file():
        return True
    return _delete_json(path)


def auth_token() -> str:
    record = load_auth()
    return str(record.get("token") or "") if record else ""


def update_auth(patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Merge fields into the stored auth record (word group cache/selection).
    Returns the updated record, or None when logged out / the write failed."""
    record = load_auth()
    if record is None:
        return None
    record.update(patch or {})
    return record if _write_json(base_dir() / _AUTH_FILE, record) else None


# --------------------------------------------------------------------------- #
# books list cache                                                             #
# --------------------------------------------------------------------------- #
def save_books_cache(items: List[Dict[str, Any]]) -> bool:
    return _write_json(
        base_dir() / _BOOKS_CACHE_FILE,
        {"fetched_at": int(time.time()), "items": items or []},
    )


def load_books_cache() -> Dict[str, Any]:
    record = _read_json(base_dir() / _BOOKS_CACHE_FILE)
    if not isinstance(record, dict) or not isinstance(record.get("items"), list):
        return {"fetched_at": 0, "items": []}
    return record


# --------------------------------------------------------------------------- #
# per-book sentence cache                                                      #
# --------------------------------------------------------------------------- #
def save_book_sentences(source_key: str, payload: Dict[str, Any]) -> bool:
    safe = re.sub(r"[^A-Za-z0-9_\-]+", "_", str(source_key or ""))
    if not safe:
        return False
    return _write_json(base_dir() / _BOOK_SENTENCES_DIR / f"{safe}.json", payload)


def load_book_sentences(source_key: str) -> Optional[Dict[str, Any]]:
    safe = re.sub(r"[^A-Za-z0-9_\-]+", "_", str(source_key or ""))
    if not safe:
        return None
    record = _read_json(base_dir() / _BOOK_SENTENCES_DIR / f"{safe}.json")
    return record if isinstance(record, dict) else None


def _partial_path(source_key: str) -> Optional[Path]:
    safe = re.sub(r"[^A-Za-z0-9_\-]+", "_", str(source_key or ""))
    return base_dir() / _BOOK_SENTENCES_PARTIAL_DIR / f"{safe}.json" if safe else None


def save_book_sentences_partial(source_key: str, payload: Dict[str, Any]) -> bool:
    """Persist an in-progress sentence sync (resume point after a failure)."""
    path = _partial_path(source_key)
    return _write_json(path, payload) if path is not None else False


def load_book_sentences_partial(source_key: str) -> Optional[Dict[str, Any]]:
    path = _partial_path(source_key)
    record = _read_json(path) if path is not None else None
    return record if isinstance(record, dict) else None


def delete_book_sentences_partial(source_key: str) -> bool:
    path = _partial_path(source_key)
    if path is None or not path.is_file():
        return True
    return _delete_json(path)


def cached_book_keys() -> List[str]:
    directory = base_dir() / _BOOK_SENTENCES_DIR
    if not directory.is_dir():
        return []
    return sorted(path.stem for path in directory.glob("*.json"))


# --------------------------------------------------------------------------- #
# task records                                                                 #
# --------------------------------------------------------------------------- #
def _task_path(task_id: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9_\-]+", "_", str(task_id or ""))
    return base_dir() / _TASKS_DIR / f"{safe}.json"


def new_task_id() -> str:
    return f"orch_{uuid.uuid4().hex[:12]}"


def create_task(record: Dict[str, Any]) -> Dict[str, Any]:
    now = int(time.time())
    task = dict(record)
    book = task.get("book") or {}
    timestamp = time.strftime("%Y%m%d_%H%M%S", time.gmtime(now))
    task.setdefault("task_id", new_task_id())
    task["name"] = str(task.get("name") or "").strip() or f"{book.get('title') or book.get('source_key')}_{timestamp}_{task['task_id']}"
    task["slug"] = f"{slugify(task['name'])}_{task['task_id']}"
    task.setdefault("status", "draft")
    task.setdefault("virtual_read", [])
    task.setdefault("segments", [])
    task.setdefault("pattern", [])
    task.setdefault("word_mode", "all")
    task.setdefault("new_only_max_read_count", 0)
    task["created_at"] = now
    task["updated_at"] = now
    _write_json(_task_path(task["task_id"]), task)
    return task


def save_task(task: Dict[str, Any]) -> bool:
    task["updated_at"] = int(time.time())
    return _write_json(_task_path(str(task.get("task_id") or "")), task)


def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    record = _read_json(_task_path(task_id))
    return record if isinstance(record, dict) else None


def list_tasks() -> List[Dict[str, Any]]:
    directory = base_dir() / _TASKS_DIR
    tasks: List[Dict[str, Any]] = []
    if directory.is_dir():
        for path in sorted(directory.glob("*.json")):
            record = _read_json(path)
            if isinstance(record, dict):
                tasks.append(record)
    tasks.sort(key=lambda item: int(item.get("updated_at") or 0), reverse=True)
    return tasks


def delete_task(task_id: str) -> bool:
    return _delete_json(_task_path(task_id))


def output_dir_for(task: Dict[str, Any]) -> Path:
    directory = base_dir() / _OUTPUT_DIR / str(task.get("slug") or "task")
    directory.mkdir(parents=True, exist_ok=True)
    return directory


# --------------------------------------------------------------------------- #
# background sync state (books list / per-book sentence fetches)               #
# --------------------------------------------------------------------------- #
@serialized_file
def _save_sync_state(path: Path, key: str, state: Dict[str, Any]) -> bool:
    record = _read_json(path)
    if not isinstance(record, dict):
        record = {}
    record[str(key)] = {**state, "updated_at": int(time.time())}
    return _write_json(path, record)


def save_sync_state(key: str, state: Dict[str, Any]) -> bool:
    return _save_sync_state(base_dir() / _SYNC_STATE_FILE, key, state)


def load_sync_state() -> Dict[str, Any]:
    record = _read_json(base_dir() / _SYNC_STATE_FILE)
    return record if isinstance(record, dict) else {}


# --------------------------------------------------------------------------- #
# cached system status (ffmpeg probe etc.)                                     #
# --------------------------------------------------------------------------- #
def save_system_status(status: Dict[str, Any]) -> bool:
    return _write_json(base_dir() / _SYSTEM_STATUS_FILE, status)


def load_system_status() -> Optional[Dict[str, Any]]:
    record = _read_json(base_dir() / _SYSTEM_STATUS_FILE)
    return record if isinstance(record, dict) else None


# --------------------------------------------------------------------------- #
# per-task event log + generated file listing                                  #
# --------------------------------------------------------------------------- #
def append_task_event(task: Dict[str, Any], message: str) -> None:
    """Append one line to the task's viewable generation log (capped)."""
    events = list(task.get("events") or [])
    events.append({"ts": int(time.time()), "message": str(message)[:300]})
    task["events"] = events[-_TASK_EVENT_CAP:]


def task_files(task: Dict[str, Any]) -> List[Dict[str, Any]]:
    """List the generated segment files of one task (name, size, mtime)."""
    directory = base_dir() / _OUTPUT_DIR / str(task.get("slug") or "task")
    files: List[Dict[str, Any]] = []
    if directory.is_dir():
        for path in sorted(directory.glob("segment_*.mp3")):
            try:
                stat = path.stat()
            except OSError:
                continue
            files.append({
                "name": path.name,
                "bytes": stat.st_size,
                "modified_at": int(stat.st_mtime),
            })
    return files


__all__ = [
    "base_dir",
    "slugify",
    "save_auth",
    "load_auth",
    "clear_auth",
    "auth_token",
    "update_auth",
    "save_books_cache",
    "load_books_cache",
    "save_book_sentences",
    "load_book_sentences",
    "cached_book_keys",
    "save_book_sentences_partial",
    "load_book_sentences_partial",
    "delete_book_sentences_partial",
    "save_sync_state",
    "load_sync_state",
    "save_system_status",
    "load_system_status",
    "append_task_event",
    "task_files",
    "new_task_id",
    "create_task",
    "save_task",
    "get_task",
    "list_tasks",
    "delete_task",
    "output_dir_for",
]

def manifest_path(task_id: str) -> Path:
    return base_dir() / "manifests" / _task_path(task_id).name


def save_manifest(task_id: str, manifest: Dict[str, Any]) -> bool:
    return _write_json(manifest_path(task_id), manifest)


def load_manifest(task_id: str) -> Dict[str, Any]:
    return _read_json(manifest_path(task_id)) or {}


def delete_manifest(task_id: str) -> bool:
    path = manifest_path(task_id)
    if not path.is_file():
        return True
    return _delete_json(path)
