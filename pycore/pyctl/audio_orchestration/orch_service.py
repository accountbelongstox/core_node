# -*- coding: utf-8 -*-
"""
Route-facing service for the audio-orchestration domain.

Thin adapters over orch_store / orch_books / orch_words / orch_generate. Every
function returns a JSON-able dict with a ``success`` flag and never raises.
"""

import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlsplit

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_launcher import open_path
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.common.ffmpeg.ffmpeg_runtime import ffmpeg_runtime

from pycore.pyctl.audio_orchestration import (
    orch_books,
    orch_generate,
    orch_resources,
    orch_store,
)

_LARAVEL_LOGIN = "/api/app_qy_v1/login"
_LARAVEL_USER = "/api/app_qy_v1/user"
_LOGIN_TIMEOUT = 60
_SYSTEM_STATUS_TTL_SECONDS = 300
_SYSTEM_STATUS_MISSING_TTL_SECONDS = 5
_SYSTEM_STATUS_SCHEMA = 1

_STEP_TYPES = ("sentence_en", "sentence_zh", "words_new", "words_all", "words")
_WORD_MODES = ("new_only", "all")
_SEGMENT_MODES = ("count", "minutes")
_EDITABLE_FIELDS = (
    "name",
    "book",
    "segment_mode",
    "segment_value",
    "pattern",
    "word_mode",
    "new_only_max_read_count",
)
_DEFAULT_PATTERN = [
    {"type": "sentence_en", "times": 1},
    {"type": "sentence_zh", "times": 1},
]


# --------------------------------------------------------------------------- #
# qy-app auth                                                                  #
# --------------------------------------------------------------------------- #
def auth_login(username: str, password: str, access_token: str = "", base_url: str = "") -> Dict[str, Any]:
    username = (username or "").strip()
    endpoint = urlsplit(base_url) if base_url else None
    token = access_token.strip()
    user: Dict[str, Any] = {}
    data: Dict[str, Any] = {}
    token_data: Any = None
    if endpoint and (endpoint.scheme not in ("http", "https") or not endpoint.netloc or endpoint.username):
        return {"success": False, "error": "invalid Laravel endpoint"}
    if not token and (not username or not password):
        return {"success": False, "error": "username and password are required"}
    try:
        if token:
            resp = laravel_client.get(
                _LARAVEL_USER, headers={"Authorization": f"Bearer {token}"},
                base_url=base_url or None, timeout=_LOGIN_TIMEOUT,
                sensitive_request=True,
            )
        else:
            resp = laravel_client.post(
                _LARAVEL_LOGIN, json={"username": username, "password": password},
                base_url=base_url or None, timeout=_LOGIN_TIMEOUT,
                sensitive_request=True,
            )
        body = resp.json() if resp.content else {}
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] login failed: {exc}")
        return {"success": False, "error": str(exc)}
    if resp.status_code != 200 or not isinstance(body, dict):
        message = body.get("error") or body.get("message") if isinstance(body, dict) else None
        return {
            "success": False, "error": str(message or f"HTTP {resp.status_code}"),
            "error_code": "QY_ACCOUNT_AUTH_REQUIRED" if resp.status_code == 401 else "QY_ACCOUNT_REQUEST_FAILED",
        }
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    if not token:
        token_data = body.get("login_token") or body.get("token") or data.get("login_token") or data.get("token") or data.get("access_token")
        if isinstance(token_data, dict):
            token_data = token_data.get("accessToken") or token_data.get("access_token")
        token = token_data if isinstance(token_data, str) else ""
    if body.get("success") is False or not token:
        return {"success": False, "error": str(body.get("message") or "login rejected")}
    user = data.get("user") if isinstance(data.get("user"), dict) else data
    if not user.get("id") and body.get("id"):
        user = body
    if not user.get("id") and isinstance(body.get("user"), dict):
        user = body["user"]
    if access_token and not user.get("id"):
        return {"success": False, "error": "Qy account verification failed"}
    username = str(user.get("username") or username)
    if not orch_store.save_auth(username, token, user, base_url):
        return {"success": False, "error": "Qy account session could not be persisted"}
    return {
        "success": True,
        "logged_in": True,
        "username": username,
        "user": {
            "id": user.get("id"),
            "username": user.get("username") or username,
            "native_language": user.get("native_language"),
        },
    }


def auth_status() -> Dict[str, Any]:
    record = orch_store.load_auth()
    if not record:
        return {"success": True, "logged_in": False}
    user = record.get("user") if isinstance(record.get("user"), dict) else {}
    return {
        "success": True,
        "logged_in": True,
        "username": record.get("username"),
        "user": {
            "id": user.get("id"),
            "username": user.get("username") or record.get("username"),
            "native_language": user.get("native_language"),
        },
        "logged_at": record.get("logged_at"),
    }


def auth_logout(expected_user_id: Optional[int] = None) -> Dict[str, Any]:
    record = orch_store.load_auth() or {}
    user = record.get("user") or {}
    if expected_user_id is not None and user.get("id") != expected_user_id:
        return {"success": True, "logged_in": False}
    if not orch_store.clear_auth():
        return {"success": False, "error": "Qy account session could not be cleared"}
    return {"success": True, "logged_in": False}


# --------------------------------------------------------------------------- #
# qy word groups (pycore-authoritative: the session lives in auth.json)        #
# --------------------------------------------------------------------------- #
_LARAVEL_QUERY_ALL_GROUPS = "/api/app_qy_v1/query_all_groups"
_GROUPS_PAGE_SIZE = 1000


def _fetch_word_groups(record: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Paginated /query_all_groups walk with the stored bearer token."""
    token = str(record.get("token") or "")
    if not token:
        raise RuntimeError("QY_ACCOUNT_AUTH_REQUIRED")
    groups: List[Dict[str, Any]] = []
    start = 0
    while True:
        resp = laravel_client.get(
            _LARAVEL_QUERY_ALL_GROUPS,
            params={"start": start, "limit": _GROUPS_PAGE_SIZE, "with_words": 0},
            headers={"Authorization": f"Bearer {token}"},
            base_url=record.get("base_url") or None,
            timeout=_LOGIN_TIMEOUT,
        )
        if resp.status_code != 200:
            if resp.status_code == 401 and orch_store.auth_token() == token:
                orch_store.clear_auth()
            raise RuntimeError(f"word groups HTTP {resp.status_code}")
        body = resp.json()
        data = body.get("data") if isinstance(body, dict) else None
        page = data.get("groups") if isinstance(data, dict) else None
        if not isinstance(page, list):
            raise RuntimeError("word groups payload invalid")
        groups.extend(g for g in page if isinstance(g, dict) and g.get("gid"))
        if len(page) < _GROUPS_PAGE_SIZE:
            return groups
        start += _GROUPS_PAGE_SIZE


def _default_group_id(groups: List[Dict[str, Any]]) -> Optional[str]:
    for group in groups:
        if group.get("is_default"):
            return str(group["gid"])
    for group in groups:
        if group.get("is_language_default") and str(group.get("language") or "") == "en":
            return str(group["gid"])
    for group in groups:
        if group.get("is_language_default"):
            return str(group["gid"])
    return str(groups[0]["gid"]) if groups else None


def auth_groups(refresh: bool = False) -> Dict[str, Any]:
    """Word groups + the selected read-baseline group. Served from the pycore
    auth record cache; ``refresh=True`` re-pulls from Laravel. The pycore side
    is authoritative because the session (auth.json) lives here — the browser
    may hold no account at all."""
    record = orch_store.load_auth()
    if not record:
        return {"success": True, "logged_in": False, "word_groups": [], "word_group_id": None}
    groups = record.get("word_groups")
    if refresh or not isinstance(groups, list):
        try:
            groups = _fetch_word_groups(record)
        except Exception as exc:  # noqa: BLE001
            return {
                "success": False,
                "logged_in": True,
                "error": str(exc),
                "word_groups": record.get("word_groups") if isinstance(record.get("word_groups"), list) else [],
                "word_group_id": record.get("word_group_id"),
            }
        selected = str(record.get("word_group_id") or "")
        if not any(str(group.get("gid")) == selected for group in groups):
            selected = _default_group_id(groups) or ""
        updated = orch_store.update_auth({"word_groups": groups, "word_group_id": selected or None})
        if updated is None:
            return {"success": False, "logged_in": False, "error": "Qy account session expired", "word_groups": [], "word_group_id": None}
        record = updated
    return {
        "success": True,
        "logged_in": True,
        "word_groups": record.get("word_groups") or [],
        "word_group_id": record.get("word_group_id"),
    }


def auth_select_group(group_id: str) -> Dict[str, Any]:
    group_id = str(group_id or "").strip()
    record = orch_store.load_auth()
    if not record:
        return {"success": False, "logged_in": False, "error": "not logged in"}
    groups = record.get("word_groups") if isinstance(record.get("word_groups"), list) else []
    if not any(str(group.get("gid")) == group_id for group in groups):
        return {"success": False, "error": "QY_WORD_GROUP_NOT_FOUND"}
    if orch_store.update_auth({"word_group_id": group_id}) is None:
        return {"success": False, "error": "word group selection could not be persisted"}
    return {"success": True, "logged_in": True, "word_groups": groups, "word_group_id": group_id}


# --------------------------------------------------------------------------- #
# books                                                                        #
# --------------------------------------------------------------------------- #
def books_list(refresh: bool = False) -> Dict[str, Any]:
    result = orch_books.fetch_books(refresh=bool(refresh))
    result["cached_sentence_books"] = orch_store.cached_book_keys()
    # Per-book sentence sync states so the UI can stop polling on failure too.
    result["sync_states"] = orch_books.sync_states()
    return result


def book_sentences(source_key: str, refresh: bool = False) -> Dict[str, Any]:
    result = orch_books.sync_book_sentences(str(source_key or ""), refresh=bool(refresh))
    sentences = result.get("sentences")
    if isinstance(sentences, list) and len(sentences) > 50:
        # Keep the HTTP payload small: the UI needs counts + a preview, the full
        # list stays in the local cache for generation.
        result = dict(result)
        result["sentences"] = sentences[:50]
        result["sentence_total"] = len(sentences)
        result["truncated"] = True
    return result


# --------------------------------------------------------------------------- #
# tasks                                                                        #
# --------------------------------------------------------------------------- #
def _normalize_pattern(value: Any, word_mode: str = "all") -> List[Dict[str, Any]]:
    steps: List[Dict[str, Any]] = []
    if not isinstance(value, list):
        return steps
    for entry in value[:20]:
        if not isinstance(entry, dict):
            continue
        step_type = str(entry.get("type") or "")
        if step_type == "words":
            step_type = "words_new" if word_mode == "new_only" else "words_all"
        if step_type not in _STEP_TYPES:
            continue
        steps.append({"type": step_type, "times": max(1, min(5, int(entry.get("times") or 1)))})
    return steps


def _task_summary(task: Dict[str, Any], pending_counts=None) -> Dict[str, Any]:
    _recover_task_status(task)
    segments = task.get("segments") or []
    return {
        "task_id": task.get("task_id"),
        "name": task.get("name"),
        "slug": task.get("slug"),
        "book": task.get("book"),
        "segment_mode": task.get("segment_mode"),
        "segment_value": task.get("segment_value"),
        "word_mode": task.get("word_mode"),
        "status": task.get("status"),
        "running": orch_generate.is_running(str(task.get("task_id") or "")),
        "resumable": orch_generate.has_resumable_state(task),
        "segments_done": sum(1 for s in segments if s.get("status") == "done"),
        "segments_total": len(segments),
        "progress": _task_progress(task, pending_counts),
        "created_at": task.get("created_at"),
        "updated_at": task.get("updated_at"),
    }


def resume_interrupted_generations() -> Dict[str, Any]:
    """Auto-resume every task left in 'generating' by a previous pycore process.
    Called once when the orchestration routes register (service startup) so a
    restarted pycore picks the manifest back up before the UI even polls."""
    resumed: List[str] = []
    for task in orch_store.list_tasks():
        task_id = str(task.get("task_id") or "")
        if str(task.get("status") or "") != "generating":
            continue
        if orch_generate.is_running(task_id):
            continue
        result = orch_generate.start_generation(task_id, resume=True)
        if result.get("success"):
            resumed.append(task_id)
            ColorPrint.green(f"[AudioOrch] auto-resumed interrupted generation: {task_id}")
        else:
            ColorPrint.yellow(f"[AudioOrch] auto-resume skipped for {task_id}: {result.get('error')}")
    return {"success": True, "resumed": resumed}


def tasks_list() -> Dict[str, Any]:
    orch_resources.recover_deliveries()
    pending_counts = orch_resources.pending_delivery_counts()
    return {
        "success": True,
        "tasks": [_task_summary(task, pending_counts) for task in orch_store.list_tasks()],
    }


def task_get(task_id: str) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    _recover_task_status(task)
    result = dict(task)
    result["progress"] = _task_progress(task)
    result["running"] = orch_generate.is_running(str(task.get("task_id") or ""))
    result["success"] = True
    return result


def _recover_task_status(task: Dict[str, Any]) -> None:
    if task.get("status") == "generating" and not orch_generate.is_running(str(task.get("task_id") or "")):
        task["status"] = "failed"
        task["progress"] = {**(task.get("progress") or {}), "message": "generation interrupted; regenerate resumes from the persisted manifest"}
        orch_store.append_task_event(task, "generation interrupted; persisted manifest, local audio caches and pending deliveries retained")
        orch_store.save_task(task)


def _task_progress(task: Dict[str, Any], pending_counts=None) -> Dict[str, Any]:
    progress = dict(task.get("progress") or {})
    generation_id = str(task.get("generation_id") or "")
    if generation_id:
        if pending_counts is None:
            pending_counts = orch_resources.pending_delivery_counts()
        pending = pending_counts.get(generation_id, 0)
        progress["synced"] = int(progress.get("synced") or 0) + max(0, int(progress.get("sync_queued") or 0) - pending)
        progress["sync_pending"] = pending
    return progress


def task_create(payload: Dict[str, Any]) -> Dict[str, Any]:
    book = payload.get("book") if isinstance(payload.get("book"), dict) else {}
    source_key = str(book.get("source_key") or "").strip()
    if not source_key:
        return {"success": False, "error": "book.source_key is required"}
    segment_mode = str(payload.get("segment_mode") or "count")
    if segment_mode not in _SEGMENT_MODES:
        segment_mode = "count"
    word_mode = str(payload.get("word_mode") or "all")
    if word_mode not in _WORD_MODES:
        word_mode = "all"
    name = str(payload.get("name") or "").strip()
    task = orch_store.create_task({
        "name": name,
        "book": {
            "source_key": source_key,
            "title": str(book.get("title") or source_key),
            "language": str(book.get("language") or "en"),
            "target_language": str(book.get("target_language") or "zh"),
        },
        "segment_mode": segment_mode,
        "segment_value": max(1, int(payload.get("segment_value") or 1)),
        "pattern": _normalize_pattern(payload.get("pattern"), word_mode) or list(_DEFAULT_PATTERN),
        "word_mode": word_mode,
        "new_only_max_read_count": max(0, int(payload.get("new_only_max_read_count") or 0)),
    })
    orch_books.sync_book_sentences(source_key)
    return {"success": True, "task": task}


def task_update(task_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    if orch_generate.is_running(str(task_id or "")):
        return {"success": False, "error": "task is generating"}
    for field in _EDITABLE_FIELDS:
        if field not in patch:
            continue
        value = patch[field]
        if field == "pattern":
            value = _normalize_pattern(value, str(patch.get("word_mode") or task.get("word_mode") or "all"))
        elif field == "segment_mode" and value not in _SEGMENT_MODES:
            continue
        elif field == "word_mode" and value not in _WORD_MODES:
            continue
        elif field in ("segment_value", "new_only_max_read_count"):
            try:
                value = int(value or 0)
            except (TypeError, ValueError):
                continue
            value = max(0 if field == "new_only_max_read_count" else 1, value)
        elif field == "name":
            value = str(value or "").strip() or task.get("name")
        elif field == "book":
            if not isinstance(value, dict) or not str(value.get("source_key") or "").strip():
                continue
            value = {
                "source_key": str(value.get("source_key")),
                "title": str(value.get("title") or value.get("source_key")),
                "language": str(value.get("language") or "en"),
                "target_language": str(value.get("target_language") or "zh"),
            }
        task[field] = value
    orch_store.save_task(task)
    return {"success": True, "task": task}


def task_delete(task_id: str) -> Dict[str, Any]:
    task_id = str(task_id or "")
    if orch_generate.is_running(task_id):
        return {"success": False, "error": "task is generating"}
    if not orch_store.delete_task(task_id):
        return {"success": False, "error": "task not found"}
    return {"success": True}


def task_plan(task_id: str) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    source_key = str((task.get("book") or {}).get("source_key") or "")
    cached = orch_store.load_book_sentences(source_key)
    sync = orch_books.sync_states().get(source_key) or {}
    if sync.get("status") == "running":
        return {"success": False, "error": "BOOK_SENTENCES_SYNC_PENDING"}
    sentences = cached.get("sentences") if isinstance(cached, dict) else None
    if not sentences:
        orch_books.sync_book_sentences(source_key)
        return {"success": False, "error": "BOOK_SENTENCES_SYNC_PENDING"}
    plan = orch_generate.plan_task(task, sentences)
    return {"success": True, **plan}


def task_generate(
    task_id: str,
    expected_user_id: Optional[int] = None,
    expected_base_url: Optional[str] = None,
    use_qy_account: Optional[bool] = None,
    word_group_id: Optional[str] = None,
    resume: Optional[bool] = None,
    force_fresh: bool = False,
) -> Dict[str, Any]:
    return orch_generate.start_generation(
        str(task_id or ""), expected_user_id, expected_base_url, use_qy_account,
        word_group_id, resume=resume, force_fresh=force_fresh,
    )


def task_cancel(task_id: str) -> Dict[str, Any]:
    if not orch_generate.request_cancel(str(task_id or "")):
        return {"success": False, "error": "task not found"}
    return {"success": True}


def task_progress(task_id: str) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    _recover_task_status(task)
    return {
        "success": True,
        "status": task.get("status"),
        "running": orch_generate.is_running(str(task_id or "")),
        "resumable": orch_generate.has_resumable_state(task),
        "progress": _task_progress(task),
        "segments": task.get("segments") or [],
        "events": task.get("events") or [],
    }


# --------------------------------------------------------------------------- #
# manifest drill-down (paged per-resource detail for the stats counters)       #
# --------------------------------------------------------------------------- #
_MANIFEST_PAGE_MAX = 200
_MANIFEST_CATEGORIES = ("all", "cache", "laravel", "generated", "synced", "missing", "pending")


def task_manifest_page(task_id: str, category: str = "all", page: int = 1, page_size: int = 50) -> Dict[str, Any]:
    """Page the persisted manifest's unique resources joined with their
    resolution outcome (source cache/Laravel/generated, provider, sync state).
    Pure read of orch_store data — the same counters the task progress shows,
    expanded to per-item rows."""
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    category = str(category or "all")
    if category not in _MANIFEST_CATEGORIES:
        category = "all"
    manifest = orch_store.load_manifest(str(task.get("task_id") or ""))
    progress = _task_progress(task)
    base: Dict[str, Any] = {
        "success": True,
        "category": category,
        "progress": progress,
        "running": orch_generate.is_running(str(task.get("task_id") or "")),
    }
    segment_items = manifest.get("segment_items") if isinstance(manifest, dict) else None
    if not isinstance(segment_items, list):
        return {**base, "items": [], "total": 0, "page": 1, "page_count": 1}
    resolved = manifest.get("resolved") if isinstance(manifest.get("resolved"), dict) else {}
    meta = manifest.get("resource_meta") if isinstance(manifest.get("resource_meta"), dict) else {}
    # Unique resources in manifest order (first occurrence wins).
    rows: List[Dict[str, Any]] = []
    seen: set = set()
    for items in segment_items:
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            resource_id = str(item.get("resource_id") or "")
            if not resource_id or resource_id in seen:
                continue
            seen.add(resource_id)
            entry = meta.get(resource_id) if isinstance(meta.get(resource_id), dict) else {}
            audio_path = str(resolved.get(resource_id) or "")
            source = str(entry.get("source") or "")
            if audio_path:
                status = "ready"
            elif source == "missing":
                status = "missing"
            else:
                status = "pending"
            synced = bool(entry.get("synced")) or bool(entry.get("sync_queued"))
            if category == "pending" and status != "pending":
                continue
            if category == "missing" and status != "missing":
                continue
            if category in ("cache", "laravel", "generated") and source != category:
                continue
            if category == "synced" and not synced:
                continue
            rows.append({
                "resource_id": resource_id,
                "kind": str(item.get("kind") or ""),
                "language": str(item.get("language") or ""),
                "text": str(item.get("text") or ""),
                "status": status,
                "source": source,
                "provider": str(entry.get("provider") or ""),
                "synced": bool(entry.get("synced")),
                "sync_queued": bool(entry.get("sync_queued")),
                "has_audio": bool(audio_path),
            })
    page_size = max(1, min(_MANIFEST_PAGE_MAX, int(page_size or 50)))
    total = len(rows)
    page_count = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(page_count, int(page or 1)))
    start = (page - 1) * page_size
    return {**base, "items": rows[start:start + page_size], "total": total, "page": page, "page_count": page_count}


# --------------------------------------------------------------------------- #
# system status + generated files                                              #
# --------------------------------------------------------------------------- #
def _probe_ffmpeg() -> Dict[str, Any]:
    resolved = ffmpeg_runtime.binaries().ffmpeg
    binary = str(resolved) if resolved is not None else None
    info: Dict[str, Any] = {"available": bool(binary), "path": binary or "", "version": ""}
    if binary:
        try:
            proc = subprocess.run(
                [binary, "-version"], capture_output=True, timeout=15,
                encoding="utf-8", errors="replace",
            )
            first_line = (proc.stdout or "").splitlines()[0] if proc.stdout else ""
            info["version"] = first_line.strip()
            if proc.returncode != 0:
                info["available"] = False
                info["probe_error"] = (proc.stderr or "").strip() or f"process exit {proc.returncode}"
        except Exception as exc:  # noqa: BLE001
            info["version"] = ""
            info["available"] = False
            info["probe_error"] = str(exc)
    return info


def system_status(refresh: bool = False) -> Dict[str, Any]:
    """Cached pycore-side system probe (ffmpeg + storage paths). The ffmpeg
    check is TTL-cached on disk so UI polls never pay the probe cost."""
    cached = orch_store.load_system_status()
    now = int(time.time())
    cached_ffmpeg = (cached or {}).get("ffmpeg") or {}
    ttl = _SYSTEM_STATUS_TTL_SECONDS if cached_ffmpeg.get("available") else _SYSTEM_STATUS_MISSING_TTL_SECONDS
    reusable = (
        not refresh and cached and cached.get("schema") == _SYSTEM_STATUS_SCHEMA
        and now - int(cached.get("probed_at") or 0) < ttl
        and (not cached_ffmpeg.get("available") or Path(str(cached_ffmpeg.get("path") or "")).is_file())
    )
    ffmpeg = cached_ffmpeg if reusable else _probe_ffmpeg()
    status = {
        "schema": _SYSTEM_STATUS_SCHEMA,
        "probed_at": cached["probed_at"] if reusable else now,
        "ffmpeg": ffmpeg,
        "data_dir": str(orch_store.base_dir()),
        "output_root": str(orch_store.base_dir() / "output"),
        "tasks_total": len(orch_store.list_tasks()),
        "books_cached": len(orch_store.load_books_cache().get("items") or []),
        "sentence_books_cached": len(orch_store.cached_book_keys()),
        "logged_in": bool(orch_store.auth_token()),
    }
    if not reusable:
        orch_store.save_system_status(status)
    return {"success": True, **status}


def task_files(task_id: str) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    return {
        "success": True,
        "output_dir": str(orch_store.base_dir() / "output" / str(task.get("slug") or "task")),
        "files": orch_store.task_files(task),
    }


def open_output(task_id: Optional[str] = None) -> Dict[str, Any]:
    """Open the output directory (one task's, or the shared root) in the OS
    file manager. Path is resolved server-side; never raises."""
    directory = orch_store.base_dir() / "output"
    if task_id:
        task = orch_store.get_task(str(task_id))
        if not task:
            return {"success": False, "error": "task not found"}
        directory = directory / str(task.get("slug") or "task")
    directory.mkdir(parents=True, exist_ok=True)
    ok = open_path(directory)
    return {"success": bool(ok), "path": str(directory)}


__all__ = [
    "auth_login",
    "auth_status",
    "auth_logout",
    "auth_groups",
    "auth_select_group",
    "books_list",
    "book_sentences",
    "tasks_list",
    "task_get",
    "task_create",
    "task_update",
    "task_delete",
    "task_plan",
    "task_generate",
    "task_cancel",
    "task_progress",
    "task_manifest_page",
    "resume_interrupted_generations",
    "system_status",
    "task_files",
    "open_output",
]
