# -*- coding: utf-8 -*-
"""
Route-facing service for the audio-orchestration domain.

Thin adapters over orch_store / orch_books / orch_words / orch_generate. Every
function returns a JSON-able dict with a ``success`` flag and never raises.
"""

import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.laravel.client import laravel_client

from pycore.pyctl.audio_orchestration import (
    orch_books,
    orch_generate,
    orch_store,
)

_LARAVEL_LOGIN = "/api/app_qy_v1/login"
_LOGIN_TIMEOUT = 60

_STEP_TYPES = ("sentence_en", "sentence_zh", "words")
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
def auth_login(username: str, password: str) -> Dict[str, Any]:
    username = (username or "").strip()
    if not username or not password:
        return {"success": False, "error": "username and password are required"}
    try:
        resp = laravel_client.post(
            _LARAVEL_LOGIN,
            json={"username": username, "password": password},
            timeout=_LOGIN_TIMEOUT,
            sensitive_request=True,
        )
        body = resp.json() if resp.content else {}
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] login failed: {exc}")
        return {"success": False, "error": str(exc)}
    if resp.status_code != 200 or not isinstance(body, dict):
        message = body.get("error") or body.get("message") if isinstance(body, dict) else None
        return {"success": False, "error": str(message or f"HTTP {resp.status_code}")}
    token = body.get("token")
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    if not token:
        token = data.get("token") or data.get("access_token")
    if not token:
        return {"success": False, "error": str(body.get("message") or "login rejected")}
    user = data.get("user") if isinstance(data.get("user"), dict) else {}
    orch_store.save_auth(username, str(token), user)
    return {
        "success": True,
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


def auth_logout() -> Dict[str, Any]:
    orch_store.clear_auth()
    return {"success": True, "logged_in": False}


# --------------------------------------------------------------------------- #
# books                                                                        #
# --------------------------------------------------------------------------- #
def books_list(refresh: bool = False) -> Dict[str, Any]:
    result = orch_books.fetch_books(refresh=bool(refresh))
    result["cached_sentence_books"] = orch_store.cached_book_keys()
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
def _normalize_pattern(value: Any) -> List[Dict[str, Any]]:
    steps: List[Dict[str, Any]] = []
    if not isinstance(value, list):
        return steps
    for entry in value[:20]:
        if not isinstance(entry, dict):
            continue
        step_type = str(entry.get("type") or "")
        if step_type not in _STEP_TYPES:
            continue
        steps.append({"type": step_type, "times": max(1, min(5, int(entry.get("times") or 1)))})
    return steps


def _task_summary(task: Dict[str, Any]) -> Dict[str, Any]:
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
        "segments_done": sum(1 for s in segments if s.get("status") == "done"),
        "segments_total": len(segments),
        "progress": task.get("progress") or {},
        "created_at": task.get("created_at"),
        "updated_at": task.get("updated_at"),
    }


def tasks_list() -> Dict[str, Any]:
    return {
        "success": True,
        "tasks": [_task_summary(task) for task in orch_store.list_tasks()],
    }


def task_get(task_id: str) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    result = dict(task)
    result["running"] = orch_generate.is_running(str(task.get("task_id") or ""))
    result["success"] = True
    return result


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
    name = str(payload.get("name") or "").strip() or f"task_{int(time.time())}"
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
        "pattern": _normalize_pattern(payload.get("pattern")) or list(_DEFAULT_PATTERN),
        "word_mode": word_mode,
        "new_only_max_read_count": max(0, int(payload.get("new_only_max_read_count") or 0)),
    })
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
            value = _normalize_pattern(value)
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
            task["slug"] = orch_store.slugify(str(value))
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
    sentences = cached.get("sentences") if isinstance(cached, dict) else None
    if not sentences:
        return {"success": False, "error": "book sentences not synced yet"}
    plan = orch_generate.plan_task(task, sentences)
    return {"success": True, **plan}


def task_generate(task_id: str) -> Dict[str, Any]:
    return orch_generate.start_generation(str(task_id or ""))


def task_cancel(task_id: str) -> Dict[str, Any]:
    if not orch_generate.request_cancel(str(task_id or "")):
        return {"success": False, "error": "task not found"}
    return {"success": True}


def task_progress(task_id: str) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    return {
        "success": True,
        "status": task.get("status"),
        "running": orch_generate.is_running(str(task_id or "")),
        "progress": task.get("progress") or {},
        "segments": task.get("segments") or [],
    }


__all__ = [
    "auth_login",
    "auth_status",
    "auth_logout",
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
]
