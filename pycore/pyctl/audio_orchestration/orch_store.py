# -*- coding: utf-8 -*-
"""
Audio-orchestration persistence layer.

Everything lives under ``get_app_data_dir()/audio_orchestration/`` (the pycore
user data directory - resolved via system_paths, never hardcoded):

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
    segments: [{index, start, end, status, output, error, started_at, finished_at}],
    status: draft|planned|generating|done|failed,
    progress: {segment_index, item_index, item_total, message, current_item,
               cache_hits, laravel_hits, generated, missing,
               phase_times: {phase: {started_at, finished_at}}},
    events: [{ts, message}]        capped generation log (viewable in the UI),
    generation_started_at, generation_finished_at   current/last run (unix s),
    created_at, updated_at

File operations use independent THREAD_BUS state owners and never raise; callers get
None / [] / False on missing data.
"""

import copy
import json
import os
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set

from pycore.pyfoundations.atomic_json_store import atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import get_app_data_dir
from pycore.pyutils.common.keyset_cursor import KeysetKey, keyset_page
from pycore.pyutils.common.serialized_files import serialized_file
from pycore.pyctl.audio_orchestration import orch_messages
from pycore.pyutils.tts.audio_resource_ledger import audio_resource_ledger

_AUTH_FILE = "auth.json"
_BOOKS_CACHE_FILE = "books_cache.json"
_SYNC_STATE_FILE = "sync_state.json"
_SYSTEM_STATUS_FILE = "system_status.json"
_TASKS_DIR = "tasks"
_BOOK_SENTENCES_DIR = "book_sentences"
_BOOK_SENTENCES_PARTIAL_DIR = "book_sentences_partial"
_OUTPUT_DIR = "output"
_VIDEO_PRESETS_FILE = "video_presets.json"
_VIDEO_BACKGROUNDS_DIR = "video_backgrounds"
_TASK_EVENT_CAP = 200
ORCH_REQUEST_TIMEOUT = 60
LEGACY_OUTPUT_MODE = "audio"


def base_dir() -> Path:
    directory = get_app_data_dir() / "audio_orchestration"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


@serialized_file
def _read_json(path: Path) -> Optional[Any]:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] read json failed {path}: {exc}")
        return None


@serialized_file
def _write_json(path: Path, payload: Any) -> bool:
    try:
        atomic_write_json(path, payload)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[AudioOrch] write json failed {path}: {exc}")
        return False
    return True


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
def _book_sentences_path(source_key: str) -> Optional[Path]:
    safe = re.sub(r"[^A-Za-z0-9_\-]+", "_", str(source_key or ""))
    return base_dir() / _BOOK_SENTENCES_DIR / f"{safe}.json" if safe else None


def save_book_sentences(source_key: str, payload: Dict[str, Any]) -> bool:
    path = _book_sentences_path(source_key)
    if path is None:
        return False
    return _write_json(path, payload)


def load_book_sentences(source_key: str) -> Optional[Dict[str, Any]]:
    path = _book_sentences_path(source_key)
    if path is None:
        return None
    record = _read_json(path)
    return record if isinstance(record, dict) else None


def book_sentences_version(source_key: str) -> str:
    """Cheap version of the cached book sentences ('' = not cached)."""
    path = _book_sentences_path(source_key)
    if path is None or not path.is_file():
        return ""
    info = path.stat()
    return f"{info.st_size}:{info.st_mtime_ns}"


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


# Field ownership of a task record. Every writer touches only its own group and
# never writes a stale copy of the whole record back:
#   run fields    - the generation run (commit_run); a run works on its own copy
#                   and commits these keys, so it can never overwrite an edit
#   config fields - the UI / service / queue (patch_task), applied atomically
#   events        - append-only log (append_task_event), shared by everyone
TASK_RUN_FIELDS = (
    "status",
    "progress",
    "segments",
    "generation_id",
    "generation_started_at",
    "generation_finished_at",
    "plan_signature",
    "virtual_read",
    "cancel_requested",
    "word_group_id",
    "auto_retries",
)
TASK_PROGRESS_FIELDS = ("progress", "cancel_requested")
TASK_CONFIG_FIELDS = (
    "name",
    "book",
    "segment_mode",
    "segment_value",
    "pattern",
    "word_mode",
    "new_only_max_read_count",
    "output_mode",
    "video_preset",
    "auto_generate",
    "source_ref",
    "source_text",
    "sentences",
)
_TASK_REFRESH_FIELDS = TASK_CONFIG_FIELDS + ("events", "updated_at")
_TASK_LIGHT_DROP = ("sentences", "events", "source_text", "virtual_read")


_ACTIVE_STATUS = "generating"


def _light_task(record: Dict[str, Any]) -> Dict[str, Any]:
    """A list-sized view of a record: no sentences / events / timelines."""
    light = {key: value for key, value in record.items() if key not in _TASK_LIGHT_DROP}
    light["segments"] = [
        {key: value for key, value in segment.items() if key != "timeline"}
        for segment in record.get("segments") or []
    ]
    return copy.deepcopy(light)


class _TaskStore:
    """The single owner of every task record.

    The authoritative copy lives in memory (loaded once from ``tasks/*.json``)
    and is written through on each mutation; readers only ever get snapshots.
    All mutations run on the owner thread, so two writers can never interleave a
    read-modify-write of the same record (the lost-update bug of a file that any
    thread could load, edit and save back whole).
    """

    def __init__(self) -> None:
        self._records: Dict[str, Dict[str, Any]] = {}
        self._loaded = False
        self._dirty: Set[str] = set()
        self._manifest_stamps: Dict[str, Any] = {}
        init_serialized_owner(self, "audio_orchestration.task_store", "AudioOrchTaskStoreThread")

    def _load_all(self) -> None:
        if self._loaded:
            return
        directory = base_dir() / _TASKS_DIR
        if directory.is_dir():
            for path in sorted(directory.glob("*.json")):
                record = _read_json(path)
                if isinstance(record, dict) and record.get("task_id"):
                    if "output_mode" not in record and (record.get("generation_started_at") or record.get("segments")):
                        # Produced before video output existed: it stays an audio
                        # task (switch it to video to have its videos rendered).
                        record["output_mode"] = LEGACY_OUTPUT_MODE
                    self._records[str(record["task_id"])] = record
        self._loaded = True

    def _persist(self, task_id: str) -> None:
        record = self._records.get(task_id)
        if record is not None:
            _write_json(_task_path(task_id), record)
        self._dirty.discard(task_id)

    def _touch(self, task_id: str, persist: bool) -> None:
        self._records[task_id]["updated_at"] = int(time.time())
        if persist:
            self._persist(task_id)
        else:
            self._dirty.add(task_id)

    @serialized_method
    def create(self, record: Dict[str, Any]) -> Dict[str, Any]:
        self._load_all()
        task = copy.deepcopy(record)
        now = int(time.time())
        task["created_at"] = now
        task["updated_at"] = now
        self._records[str(task["task_id"])] = task
        self._persist(str(task["task_id"]))
        return copy.deepcopy(task)

    @serialized_method
    def get(self, task_id: str) -> Optional[Dict[str, Any]]:
        self._load_all()
        record = self._records.get(task_id)
        return copy.deepcopy(record) if record is not None else None

    @serialized_method
    def all(self) -> List[Dict[str, Any]]:
        self._load_all()
        records = sorted(self._records.values(), key=lambda item: int(item.get("updated_at") or 0), reverse=True)
        return copy.deepcopy(records)

    @serialized_method
    def page(self, source: str, after: Optional[KeysetKey], limit: int, query: str) -> Dict[str, Any]:
        """One newest-first keyset page of list-sized records of a source, keyed
        by the immutable ``(created_at, task_id)`` (a task that changes between
        pages is neither skipped nor repeated; live changes reach the UI as push
        events), plus the per-source totals; ``source`` '' matches every source."""
        self._load_all()
        needle = query.strip().lower()
        counts: Dict[str, int] = {}
        matched: List[Dict[str, Any]] = []
        for record in sorted(self._records.values(), key=_task_key, reverse=True):
            record_source = str(record.get("source") or "vocab_book")
            counts[record_source] = counts.get(record_source, 0) + 1
            if source and record_source != source:
                continue
            if needle and needle not in str(record.get("name") or "").lower():
                continue
            matched.append(record)
        page = keyset_page(matched, after, limit, _task_key)
        return {
            **page,
            "items": [_light_task(record) for record in page["items"]],
            "total": len(matched),
            "counts": counts,
        }

    @serialized_method
    def active(self, task_ids: set, limit: int) -> List[Dict[str, Any]]:
        self._load_all()
        records = [
            record for task_id, record in self._records.items()
            if task_id in task_ids or str(record.get("status") or "") == _ACTIVE_STATUS
        ]
        records.sort(key=lambda item: int(item.get("updated_at") or 0), reverse=True)
        return [_light_task(record) for record in records[:limit]]

    @serialized_method
    def patch(self, task_id: str, changes: Dict[str, Any], fields: Iterable[str], persist: bool = True) -> Optional[Dict[str, Any]]:
        self._load_all()
        record = self._records.get(task_id)
        if record is None:
            return None
        allowed = set(fields)
        for key, value in changes.items():
            if key in allowed:
                record[key] = copy.deepcopy(value)
        self._touch(task_id, persist)
        return copy.deepcopy(record)

    @serialized_method
    def append_event(self, task_id: str, event: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
        self._load_all()
        record = self._records.get(task_id)
        if record is None:
            return None
        record["events"] = [*(record.get("events") or []), event][-_TASK_EVENT_CAP:]
        self._touch(task_id, True)
        return copy.deepcopy(record["events"])

    @serialized_method
    def clear_events(self, task_id: str) -> None:
        self._load_all()
        if task_id in self._records:
            self._records[task_id]["events"] = []
            self._touch(task_id, True)

    @serialized_method
    def delete(self, task_id: str) -> bool:
        self._load_all()
        existed = self._records.pop(task_id, None) is not None
        self._dirty.discard(task_id)
        deleted = _delete_json(_task_path(task_id))
        return existed or deleted

    @serialized_method
    def manifest_signature(self, task_id: str) -> str:
        """Plan signature of a task's persisted manifest ('' = none / no items).
        A manifest of a big book is megabytes: it is parsed once per file stamp
        (mtime + size), not on every list poll."""
        path = manifest_path(task_id)
        if not path.is_file():
            self._manifest_stamps.pop(task_id, None)
            return ""
        stat = path.stat()
        stamp = (stat.st_mtime_ns, stat.st_size)
        cached = self._manifest_stamps.get(task_id)
        if cached is not None and cached[0] == stamp:
            return cached[1]
        manifest = _read_json(path)
        signature = str(manifest.get("signature") or "") if isinstance(manifest, dict) and manifest.get("segment_items") else ""
        self._manifest_stamps[task_id] = (stamp, signature)
        return signature

    @serialized_method
    def flush(self) -> int:
        pending = list(self._dirty)
        for task_id in pending:
            self._persist(task_id)
        return len(pending)


_task_store = _TaskStore()


def create_task(record: Dict[str, Any]) -> Dict[str, Any]:
    task = dict(record)
    book = task.get("book") or {}
    timestamp = time.strftime("%Y%m%d_%H%M%S", time.gmtime(int(time.time())))
    task.setdefault("task_id", new_task_id())
    task["name"] = str(task.get("name") or "").strip() or f"{book.get('title') or book.get('source_key')}_{timestamp}_{task['task_id']}"
    task["slug"] = f"{slugify(task['name'])}_{task['task_id']}"
    task.setdefault("status", "draft")
    task.setdefault("virtual_read", [])
    task.setdefault("segments", [])
    task.setdefault("pattern", [])
    task.setdefault("word_mode", "all")
    task.setdefault("new_only_max_read_count", 0)
    return _task_store.create(task)


def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    return _task_store.get(str(task_id or ""))


def list_tasks() -> List[Dict[str, Any]]:
    """Full snapshots of every task, newest first (heavy: prefer ``page_tasks``
    for a list view)."""
    return _task_store.all()


def page_tasks(source: str, after: Optional[KeysetKey], limit: int, query: str = "") -> Dict[str, Any]:
    return _task_store.page(str(source or ""), after, limit, str(query or ""))


def _task_key(record: Dict[str, Any]) -> KeysetKey:
    return int(record.get("created_at") or 0), str(record.get("task_id") or "")


def active_tasks(task_ids: Iterable[str], limit: int) -> List[Dict[str, Any]]:
    """List-sized records of the given running tasks plus every task whose
    status is generating, most recently updated first, at most ``limit``."""
    return _task_store.active(set(task_ids), limit)


def patch_task(task_id: str, changes: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Atomically set config fields (``TASK_CONFIG_FIELDS``) of a task; other
    keys are ignored. Returns the new snapshot, None for an unknown task."""
    return _task_store.patch(str(task_id or ""), changes, TASK_CONFIG_FIELDS)


def commit_run(task: Dict[str, Any], persist: bool = True, progress_only: bool = False) -> bool:
    """Publish the run-owned fields of the run's working copy; nothing else of
    the working copy is written. The copy is refreshed with the config fields
    and events other writers changed meanwhile."""
    task_id = str(task.get("task_id") or "")
    keys = TASK_PROGRESS_FIELDS if progress_only else TASK_RUN_FIELDS
    stored = _task_store.patch(task_id, {key: task[key] for key in keys if key in task}, keys, persist)
    if stored is None:
        return False
    for key in _TASK_REFRESH_FIELDS:
        if key in stored:
            task[key] = stored[key]
    return True


def patch_run_fields(task_id: str, changes: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Set run-owned fields from outside a run (before one starts, or the
    startup recovery of an interrupted one)."""
    return _task_store.patch(str(task_id or ""), changes, TASK_RUN_FIELDS)


def delete_task(task_id: str) -> bool:
    return _task_store.delete(str(task_id or ""))


def flush_tasks() -> int:
    return _task_store.flush()


def manifest_signature(task_id: str) -> str:
    return _task_store.manifest_signature(str(task_id or ""))


def output_dir_for(task: Dict[str, Any]) -> Path:
    directory = base_dir() / _OUTPUT_DIR / str(task.get("slug") or "task")
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def load_video_presets() -> Dict[str, Any]:
    payload = _read_json(base_dir() / _VIDEO_PRESETS_FILE)
    return payload if isinstance(payload, dict) else {}


def save_video_presets(payload: Dict[str, Any]) -> bool:
    return _write_json(base_dir() / _VIDEO_PRESETS_FILE, payload)


def video_backgrounds_dir() -> Path:
    directory = base_dir() / _VIDEO_BACKGROUNDS_DIR
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
def append_task_event(task: Dict[str, Any], code: str, **params: Any) -> None:
    """Append one coded line to the task's viewable generation log (capped).
    The append is atomic in the store; the caller's copy gets the new log."""
    events = _task_store.append_event(str(task.get("task_id") or ""), {
        "ts": int(time.time()),
        "code": code,
        "params": params,
        "message": orch_messages.render(code, params)[:300],
    })
    if events is not None:
        task["events"] = events


def clear_task_events(task: Dict[str, Any]) -> None:
    _task_store.clear_events(str(task.get("task_id") or ""))
    task["events"] = []


def task_files(task: Dict[str, Any]) -> List[Dict[str, Any]]:
    """List the generated segment files of one task (name, kind, size, mtime):
    the delivered segment audio and, when the task renders video, its mp4."""
    directory = base_dir() / _OUTPUT_DIR / str(task.get("slug") or "task")
    files: List[Dict[str, Any]] = []
    if directory.is_dir():
        for kind, pattern in (("audio", "segment_*.mp3"), ("video", "segment_*.mp4")):
            for path in sorted(directory.glob(pattern)):
                try:
                    stat = path.stat()
                except OSError:
                    continue
                files.append({
                    "name": path.name,
                    "kind": kind,
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
    "TASK_CONFIG_FIELDS",
    "TASK_RUN_FIELDS",
    "create_task",
    "get_task",
    "list_tasks",
    "page_tasks",
    "patch_task",
    "commit_run",
    "patch_run_fields",
    "clear_task_events",
    "flush_tasks",
    "manifest_signature",
    "delete_task",
    "output_dir_for",
    "load_video_presets",
    "save_video_presets",
    "video_backgrounds_dir",
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


def _remove_unreferenced(directory: Path, held: Set[Path]) -> None:
    """Remove ``directory`` except the files the clip ledger still names (a
    cached clip is never deleted with the task that produced it)."""
    if not held:
        shutil.rmtree(directory)
        return
    for current, _, names in os.walk(directory, topdown=False):
        for name in names:
            path = Path(current) / name
            if path not in held:
                path.unlink(missing_ok=True)
        try:
            os.rmdir(current)
        except OSError:
            pass


def delete_task_files(task: Dict[str, Any]) -> None:
    """Remove a deleted task's manifest and output directory (segments and
    staging). Pending output deliveries of a deleted task complete as
    superseded, and resource deliveries own retained payload copies."""
    # The task record is already gone: a removal failure is logged, never
    # raised, so the delete still completes and publishes.
    try:
        delete_manifest(str(task.get("task_id") or ""))
        root = (base_dir() / _OUTPUT_DIR).resolve()
        directory = (root / str(task.get("slug") or "")).resolve()
        if task.get("slug") and directory.parent == root and directory.is_dir():
            _remove_unreferenced(directory, audio_resource_ledger.paths_under(directory))
    except OSError as exc:
        ColorPrint.yellow(f"[AudioOrch] delete task files failed {task.get('task_id')}: {exc}")
