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

All functions are thread-safe (one module lock) and never raise; callers get
None / [] / False on missing data.
"""

import json
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_app_data_dir

_LOCK = threading.RLock()
_AUTH_FILE = "auth.json"
_BOOKS_CACHE_FILE = "books_cache.json"
_SYNC_STATE_FILE = "sync_state.json"
_SYSTEM_STATUS_FILE = "system_status.json"
_TASKS_DIR = "tasks"
_BOOK_SENTENCES_DIR = "book_sentences"
_OUTPUT_DIR = "output"
_TASK_EVENT_CAP = 200


def base_dir() -> Path:
    directory = get_app_data_dir() / "audio_orchestration"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _read_json(path: Path) -> Optional[Any]:
    try:
        if not path.is_file():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] read json failed {path.name}: {exc}")
        return None


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
def save_auth(username: str, token: str, user: Dict[str, Any]) -> bool:
    record = {
        "username": username,
        "token": token,
        "user": user or {},
        "logged_at": int(time.time()),
    }
    with _LOCK:
        return _write_json(base_dir() / _AUTH_FILE, record)


def load_auth() -> Optional[Dict[str, Any]]:
    with _LOCK:
        record = _read_json(base_dir() / _AUTH_FILE)
    if not isinstance(record, dict) or not record.get("token"):
        return None
    return record


def clear_auth() -> bool:
    with _LOCK:
        path = base_dir() / _AUTH_FILE
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            return False
    return True


def auth_token() -> str:
    record = load_auth()
    return str(record.get("token") or "") if record else ""


# --------------------------------------------------------------------------- #
# books list cache                                                             #
# --------------------------------------------------------------------------- #
def save_books_cache(items: List[Dict[str, Any]]) -> bool:
    with _LOCK:
        return _write_json(
            base_dir() / _BOOKS_CACHE_FILE,
            {"fetched_at": int(time.time()), "items": items or []},
        )


def load_books_cache() -> Dict[str, Any]:
    with _LOCK:
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
    with _LOCK:
        return _write_json(base_dir() / _BOOK_SENTENCES_DIR / f"{safe}.json", payload)


def load_book_sentences(source_key: str) -> Optional[Dict[str, Any]]:
    safe = re.sub(r"[^A-Za-z0-9_\-]+", "_", str(source_key or ""))
    if not safe:
        return None
    with _LOCK:
        record = _read_json(base_dir() / _BOOK_SENTENCES_DIR / f"{safe}.json")
    return record if isinstance(record, dict) else None


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
    task.setdefault("task_id", new_task_id())
    task["slug"] = slugify(str(task.get("name") or task["task_id"]))
    task.setdefault("status", "draft")
    task.setdefault("virtual_read", [])
    task.setdefault("segments", [])
    task.setdefault("pattern", [])
    task.setdefault("word_mode", "all")
    task.setdefault("new_only_max_read_count", 0)
    task["created_at"] = now
    task["updated_at"] = now
    with _LOCK:
        _write_json(_task_path(task["task_id"]), task)
    return task


def save_task(task: Dict[str, Any]) -> bool:
    task["updated_at"] = int(time.time())
    with _LOCK:
        return _write_json(_task_path(str(task.get("task_id") or "")), task)


def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        record = _read_json(_task_path(task_id))
    return record if isinstance(record, dict) else None


def list_tasks() -> List[Dict[str, Any]]:
    directory = base_dir() / _TASKS_DIR
    tasks: List[Dict[str, Any]] = []
    if directory.is_dir():
        with _LOCK:
            for path in sorted(directory.glob("*.json")):
                record = _read_json(path)
                if isinstance(record, dict):
                    tasks.append(record)
    tasks.sort(key=lambda item: int(item.get("updated_at") or 0), reverse=True)
    return tasks


def delete_task(task_id: str) -> bool:
    with _LOCK:
        path = _task_path(task_id)
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            return False
    return True


def output_dir_for(task: Dict[str, Any]) -> Path:
    directory = base_dir() / _OUTPUT_DIR / str(task.get("slug") or "task")
    directory.mkdir(parents=True, exist_ok=True)
    return directory


# --------------------------------------------------------------------------- #
# background sync state (books list / per-book sentence fetches)               #
# --------------------------------------------------------------------------- #
def save_sync_state(key: str, state: Dict[str, Any]) -> bool:
    """Persist one fetch job's state ("books" or a book source_key)."""
    with _LOCK:
        record = _read_json(base_dir() / _SYNC_STATE_FILE)
        if not isinstance(record, dict):
            record = {}
        record[str(key)] = {**state, "updated_at": int(time.time())}
        return _write_json(base_dir() / _SYNC_STATE_FILE, record)


def load_sync_state() -> Dict[str, Any]:
    with _LOCK:
        record = _read_json(base_dir() / _SYNC_STATE_FILE)
    return record if isinstance(record, dict) else {}


# --------------------------------------------------------------------------- #
# cached system status (ffmpeg probe etc.)                                     #
# --------------------------------------------------------------------------- #
def save_system_status(status: Dict[str, Any]) -> bool:
    with _LOCK:
        return _write_json(base_dir() / _SYSTEM_STATUS_FILE, status)


def load_system_status() -> Optional[Dict[str, Any]]:
    with _LOCK:
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
    "save_books_cache",
    "load_books_cache",
    "save_book_sentences",
    "load_book_sentences",
    "cached_book_keys",
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
