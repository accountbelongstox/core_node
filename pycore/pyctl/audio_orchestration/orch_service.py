# -*- coding: utf-8 -*-
"""
Route-facing service for the audio-orchestration domain.

Thin adapters over orch_store / orch_books / orch_words / orch_generate. Every
function returns a JSON-able dict with a ``success`` flag and never raises.
"""

import base64
import json
import re
import struct
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlsplit

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.core_node_dirs import portable_path
from pycore.pyfoundations.system_launcher import open_path
from pycore.pyutils.laravel.client import (
    LARAVEL_ERROR_ENDPOINT_UNKNOWN,
    laravel_client,
    laravel_failure,
)
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.common.ffmpeg.ffmpeg_runtime import ffmpeg_runtime
from pycore.pyutils.tts.audio_queue_center import AUDIO_QUEUE_LANES, audio_queue_center
from pycore.pyutils.tts import word_audio_cache
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.translator.dictionary import dictionary_service

from pycore.pyctl.audio_orchestration import (
    orch_books,
    orch_contract,
    orch_generate,
    orch_promote,
    orch_events,
    orch_resources,
    orch_sources,
    orch_store,
    orch_video,
    orch_video_presets,
)
from pycore.pyctl.audio_orchestration.orch_queue import orch_queue
from pycore.pyctl.audio_orchestration.orch_delivery import orch_delivery
from pycore.pyctl.tts.audio_resource_delivery import audio_resource_delivery

_LARAVEL_LOGIN = "/api/app_qy_v1/login"
_LARAVEL_USER = "/api/app_qy_v1/user"
_LOGIN_TIMEOUT = 60
_SYSTEM_STATUS_TTL_SECONDS = 300
_SYSTEM_STATUS_MISSING_TTL_SECONDS = 5
_SYSTEM_STATUS_SCHEMA = 1

_STEP_TYPES = ("sentence_en", "sentence_zh", "words_new", "words_all", "words")
_WORD_MODES = ("new_only", "all")
_SEGMENT_MODES = ("count", "minutes")
# Defaults shared with the pycore-manager UI and the wordnew composer
# (config/audio_orchestration_contract.json): one article is one segment unless
# the task asks for more. A prompt is always ONE segment (created with count 1,
# never re-segmented).
_DEFAULT_BOOK_SEGMENT_MODE = orch_contract.DEFAULT_SEGMENT_MODE
_DEFAULT_BOOK_SEGMENT_VALUE = orch_contract.DEFAULT_SEGMENT_VALUE
# The value a switch to "minutes" starts from when the task gives none.
_DEFAULT_BOOK_SEGMENT_MINUTES = 10
_EDITABLE_FIELDS = (
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
)
# Changing one of these makes the previous output stale: the task goes back to
# a never-started draft and the queue regenerates it on its own.
_PLAN_FIELDS = ("book", "segment_mode", "segment_value", "pattern", "word_mode", "new_only_max_read_count")
_DEFAULT_PAGE_SIZE = 20
# Generated segment files are read by the UI in chunks (play / download): the
# JSON transport carries base64, so a chunk stays small and a file of any size
# streams. Only the segment files of the task's own output folder can be read.
_FILE_NAME_RE = re.compile(r"^segment_\d{3}\.(mp3|mp4)$")
_FILE_MEDIA_TYPES = {".mp3": "audio/mpeg", ".mp4": "video/mp4"}
_FILE_CHUNK_BYTES = 1024 * 1024
_RESOURCE_LOOKUP_MAX_ITEMS = 500


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
    if base_url and not laravel_endpoint_manager.is_catalog_endpoint(base_url):
        return {"success": False, "error": LARAVEL_ERROR_ENDPOINT_UNKNOWN, "error_code": LARAVEL_ERROR_ENDPOINT_UNKNOWN}
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
        failure = laravel_failure(exc)
        return {"success": False, "error": failure["error_code"], **failure}
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
            failure = laravel_failure(exc) if not isinstance(exc, RuntimeError) else {
                "error_code": str(exc) if str(exc).isupper() else "QY_WORD_GROUPS_FAILED",
                "detail": str(exc)[:200],
            }
            return {
                "success": False,
                "logged_in": True,
                "error": failure["error_code"],
                "detail": failure.get("detail") or "",
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
        steps.append({"type": step_type, "times": max(1, min(orch_contract.MAX_STEP_TIMES, int(entry.get("times") or 1)))})
    return steps


def _output_mode(value: Any) -> str:
    text = str(value or "").strip().lower()
    return text if text in orch_sources.ORCH_OUTPUT_MODES else orch_sources.ORCH_DEFAULT_OUTPUT_MODE


def _positive_int(value: Any, default: int, minimum: int = 1) -> int:
    text = str(value if value is not None else "").strip()
    return max(minimum, int(text)) if text.lstrip("-").isdigit() else default


def _preset_id(value: Any) -> str:
    """A known preset id, or '' (= follow the active preset)."""
    wanted = str(value or "").strip()
    known = {preset["id"] for preset in orch_video_presets.list_presets()["presets"]}
    return wanted if wanted in known else ""


def _task_summary(
    task: Dict[str, Any], pending_counts=None, output_counts=None, running_ids=None, queue_states=None,
) -> Dict[str, Any]:
    segments = task.get("segments") or []
    task_id = str(task.get("task_id") or "")
    running = task_id in running_ids if running_ids is not None else orch_generate.is_running(task_id)
    return {
        "task_id": task.get("task_id"),
        "name": task.get("name"),
        "slug": task.get("slug"),
        "book": task.get("book"),
        "source": orch_sources.task_source(task),
        "source_ref": task.get("source_ref") or {},
        "input": orch_sources.task_input(task),
        "segment_mode": task.get("segment_mode"),
        "segment_value": task.get("segment_value"),
        "word_mode": task.get("word_mode"),
        "output_mode": orch_sources.task_output_mode(task),
        "video_preset": str(task.get("video_preset") or ""),
        "auto_generate": task.get("auto_generate") is not False,
        "queue": queue_states[task_id] if queue_states is not None else orch_queue.state_of(task_id),
        "status": task.get("status"),
        "running": running,
        "resumable": orch_generate.has_resumable_state(task),
        "segments_done": sum(1 for s in segments if s.get("status") == "done"),
        "segments_total": len(segments),
        "videos_done": sum(1 for s in segments if s.get("video_status") == "done"),
        "videos_failed": sum(1 for s in segments if s.get("video_status") == "failed"),
        "progress": _task_progress(task, pending_counts, output_counts, running),
        "generation_started_at": task.get("generation_started_at"),
        "generation_finished_at": task.get("generation_finished_at"),
        "created_at": task.get("created_at"),
        "updated_at": task.get("updated_at"),
    }


def tasks_list(source: str = "", page: int = 1, page_size: int = _DEFAULT_PAGE_SIZE, query: str = "") -> Dict[str, Any]:
    """One page of task summaries of a source (books / prompts), newest first,
    plus the per-source totals the UI shows on its tabs."""
    listing = orch_store.page_tasks(str(source or "").strip(), page, page_size, query)
    pending_counts = audio_resource_delivery.pending_counts()
    output_counts = orch_delivery.output_counts(listing["records"])
    # One owner hop each for the whole page, not one per task.
    running_ids = set(orch_generate.running_task_ids())
    queue_states = orch_queue.states_of([str(task.get("task_id") or "") for task in listing["records"]])
    return {
        "success": True,
        "sources": list(orch_sources.ORCH_SOURCES),
        "counts": listing["counts"],
        "total": listing["total"],
        "page": listing["page"],
        "page_size": listing["page_size"],
        "tasks": [
            _task_summary(task, pending_counts, output_counts, running_ids, queue_states)
            for task in listing["records"]
        ],
    }


def task_get(task_id: str) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    result = dict(task)
    result["source"] = orch_sources.task_source(task)
    result["output_mode"] = orch_sources.task_output_mode(task)
    result["auto_generate"] = task.get("auto_generate") is not False
    result["queue"] = orch_queue.state_of(str(task.get("task_id") or ""))
    result["progress"] = _task_progress(task)
    result["running"] = orch_generate.is_running(str(task.get("task_id") or ""))
    result["success"] = True
    return result


_IDLE_LANE_COUNTS = {"queued": 0, "processing": 0, "done": 0, "failed": 0, "total": 0}
# ``owner_counts`` scans every tracked lane item on the lane owner thread (a big
# book tracks thousands), so a polled list must not call it per request: the
# counts of one running task are reused for this long.
_LANE_COUNTS_TTL_SECONDS = 2.0
_lane_counts_cache: Dict[Any, Any] = {}


def _lane_counts(lane: str, task_id: str) -> Dict[str, int]:
    now = time.monotonic()
    cached = _lane_counts_cache.get((lane, task_id))
    if cached is not None and now - cached[0] < _LANE_COUNTS_TTL_SECONDS:
        return dict(cached[1])
    counts = audio_queue_center.owner_counts(lane, task_id)
    _lane_counts_cache[(lane, task_id)] = (now, counts)
    if len(_lane_counts_cache) > 512:
        for key in [key for key, entry in _lane_counts_cache.items() if now - entry[0] >= _LANE_COUNTS_TTL_SECONDS]:
            _lane_counts_cache.pop(key, None)
    return dict(counts)


def _task_progress(task: Dict[str, Any], pending_counts=None, output_counts=None, running=None) -> Dict[str, Any]:
    progress = dict(task.get("progress") or {})
    # Live Part1 fill counters of this task in EACH lane queue (words ->
    # word_audio, sentences -> sentence_audio); tracker-only, O(tracked). Only a
    # task that is generating can hold lane items, so the others skip the two
    # lane-owner hops.
    task_id = str(task.get("task_id") or "")
    active = running if running is not None else str(task.get("status") or "") == "generating"
    progress["lanes"] = {
        lane: (_lane_counts(lane, task_id) if active else dict(_IDLE_LANE_COUNTS))
        for lane in AUDIO_QUEUE_LANES
    }
    generation_id = str(task.get("generation_id") or "")
    if generation_id:
        if pending_counts is None:
            pending_counts = audio_resource_delivery.pending_counts()
        pending = pending_counts.get(generation_id, 0)
        progress["synced"] = int(progress.get("synced") or 0) + max(0, int(progress.get("sync_queued") or 0) - pending)
        progress["sync_pending"] = pending
    if output_counts is None:
        output_counts = orch_delivery.output_counts([task])
    progress["output_delivery"] = output_counts.get(task_id) or {"pending": 0, "dead_letter": 0, "delivered": 0}
    return progress


def task_create(payload: Dict[str, Any]) -> Dict[str, Any]:
    book = payload.get("book") if isinstance(payload.get("book"), dict) else {}
    source_key = str(book.get("source_key") or "").strip()
    if not source_key:
        return {"success": False, "error": "book.source_key is required"}
    segment_mode = str(payload.get("segment_mode") or _DEFAULT_BOOK_SEGMENT_MODE)
    if segment_mode not in _SEGMENT_MODES:
        segment_mode = _DEFAULT_BOOK_SEGMENT_MODE
    word_mode = str(payload.get("word_mode") or orch_contract.DEFAULT_WORD_MODE)
    if word_mode not in _WORD_MODES:
        word_mode = "all"
    name = str(payload.get("name") or "").strip()
    task = orch_store.create_task({
        "name": name,
        "source": orch_sources.ORCH_SOURCE_VOCAB_BOOK,
        "book": {
            "source_key": source_key,
            "title": str(book.get("title") or source_key),
            "language": str(book.get("language") or "en"),
            "target_language": str(book.get("target_language") or "zh"),
        },
        "segment_mode": segment_mode,
        "segment_value": _positive_int(
            payload.get("segment_value"), _DEFAULT_BOOK_SEGMENT_MINUTES if segment_mode == "minutes" else _DEFAULT_BOOK_SEGMENT_VALUE,
        ),
        "pattern": _normalize_pattern(payload.get("pattern"), word_mode) or orch_contract.default_pattern(),
        "word_mode": word_mode,
        "new_only_max_read_count": _positive_int(payload.get("new_only_max_read_count"), 0, 0),
        "output_mode": _output_mode(payload.get("output_mode")),
        "video_preset": _preset_id(payload.get("video_preset")),
        "auto_generate": payload.get("auto_generate") is not False,
    })
    orch_books.sync_book_sentences(source_key)
    orch_events.publish_task_changed(task)
    orch_queue.enqueue(str(task["task_id"]))
    return {"success": True, "task": task}


def _edited_value(task: Dict[str, Any], patch: Dict[str, Any], field: str) -> Any:
    """The validated new value of one edited field; ``_SKIP`` drops the edit."""
    value = patch[field]
    if field == "pattern":
        return _normalize_pattern(value, str(patch.get("word_mode") or task.get("word_mode") or "all"))
    if field in ("segment_mode", "segment_value") and orch_sources.is_text_task(task):
        return _SKIP
    if field == "segment_mode":
        return value if value in _SEGMENT_MODES else _SKIP
    if field == "word_mode":
        return value if value in _WORD_MODES else _SKIP
    if field in ("segment_value", "new_only_max_read_count"):
        text = str(value if value is not None else "").strip()
        if not text.lstrip("-").isdigit():
            return _SKIP
        return max(0 if field == "new_only_max_read_count" else 1, int(text))
    if field == "name":
        return str(value or "").strip() or task.get("name")
    if field == "output_mode":
        return _output_mode(value)
    if field == "video_preset":
        return _preset_id(value)
    if field == "auto_generate":
        return bool(value)
    if field == "book":
        if orch_sources.is_text_task(task) or not isinstance(value, dict) or not str(value.get("source_key") or "").strip():
            return _SKIP
        return {
            "source_key": str(value.get("source_key")),
            "title": str(value.get("title") or value.get("source_key")),
            "language": str(value.get("language") or "en"),
            "target_language": str(value.get("target_language") or "zh"),
        }
    return value


_SKIP = object()


def task_update(task_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    if orch_generate.is_running(str(task_id or "")):
        return {"success": False, "error": "task is generating"}
    changes: Dict[str, Any] = {}
    for field in _EDITABLE_FIELDS:
        if field not in patch:
            continue
        value = _edited_value(task, patch, field)
        if value is not _SKIP:
            changes[field] = value
    updated = orch_store.patch_task(str(task_id), changes)
    if updated is None:
        return {"success": False, "error": "task not found"}
    changed = {field for field, value in changes.items() if value != task.get(field)}
    if changed & set(_PLAN_FIELDS):
        # The stored output no longer matches the plan: back to a never-started
        # draft, so the queue regenerates it without a button press.
        orch_store.patch_run_fields(str(task_id), {
            "status": "draft", "segments": [], "progress": {}, "cancel_requested": False,
            "generation_started_at": None, "generation_finished_at": None,
        })
    orch_queue.enqueue(str(task_id), rerender_videos="video_preset" in changed and not (changed & set(_PLAN_FIELDS)))
    return {"success": True, "task": orch_store.get_task(str(task_id))}


def task_delete(task_id: str) -> Dict[str, Any]:
    task_id = str(task_id or "")
    if orch_generate.is_running(task_id):
        return {"success": False, "error": "task is generating"}
    task = orch_store.get_task(task_id) or {"task_id": task_id}
    if not orch_store.delete_task(task_id):
        return {"success": False, "error": "task not found"}
    orch_resources.release_owner_queue(task_id)
    orch_store.delete_task_files(task)
    orch_events.publish_task_changed(task, orch_events.TASK_STATUS_DELETED)
    return {"success": True}


def _prune_text_tasks(source: str) -> None:
    """Keep the newest ORCH_TEXT_TASK_RETENTION task records per text source."""
    tasks = [
        task for task in orch_store.list_tasks()
        if orch_sources.task_source(task) == source
    ]
    tasks.sort(key=lambda task: int(task.get("created_at") or 0), reverse=True)
    for task in tasks[orch_sources.ORCH_TEXT_TASK_RETENTION:]:
        task_delete(str(task.get("task_id") or ""))


def submit_text_task(
    source: str,
    items: Any,
    name: str = "",
    source_ref: Optional[Dict[str, Any]] = None,
    generate: bool = True,
    source_text: str = "",
    output_mode: str = "",
) -> Dict[str, Any]:
    """Public submit API for non-book sources: text items -> one task (always ONE
    segment, sentence pattern) that the queue generates on its own through the
    normal sentence audio path (video by default). ``source_text`` keeps the
    original text the items were derived from (e.g. the raw prompt of a rewrite);
    ``generate=False`` leaves the task a draft the queue will not start."""
    source = str(source or "").strip()
    if source not in orch_sources.ORCH_TEXT_SOURCES:
        return {"success": False, "error": "ORCH_SOURCE_UNKNOWN"}
    sentences = orch_sources.build_text_sentences(items)
    if not sentences:
        return {"success": False, "error": "ORCH_TEXT_ITEMS_REQUIRED"}
    language = str(sentences[0].get("language") or "en")
    task = orch_store.create_task({
        "name": str(name or "").strip() or f"{source}_{time.strftime('%Y%m%d_%H%M%S')}",
        "source": source,
        "source_ref": dict(source_ref or {}),
        "source_text": str(source_text or ""),
        "sentences": sentences,
        "segment_mode": "count",
        "segment_value": 1,
        "pattern": [{"type": "sentence_en" if language == "en" else "sentence_zh", "times": 1}],
        "word_mode": "all",
        "new_only_max_read_count": 0,
        "output_mode": _output_mode(output_mode),
        "auto_generate": bool(generate),
    })
    orch_events.publish_task_changed(task)
    _prune_text_tasks(source)
    orch_queue.enqueue(str(task["task_id"]))
    return {"success": True, "task": task, "generation": {"queued": bool(generate)}}


def task_plan(task_id: str) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    sentences = orch_sources.cached_task_sentences(task)
    if not sentences:
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
    return {
        "success": True,
        "source": orch_sources.task_source(task),
        "source_ref": task.get("source_ref") or {},
        "output_mode": orch_sources.task_output_mode(task),
        "queue": orch_queue.state_of(str(task_id or "")),
        "status": task.get("status"),
        "running": orch_generate.is_running(str(task_id or "")),
        "resumable": orch_generate.has_resumable_state(task),
        "progress": _task_progress(task),
        "segments": task.get("segments") or [],
        "generation_started_at": task.get("generation_started_at"),
        "generation_finished_at": task.get("generation_finished_at"),
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
    owner = str(task.get("task_id") or "")
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
                "resolved_at": entry.get("resolved_at"),
            })
    page_size = max(1, min(_MANIFEST_PAGE_MAX, int(page_size or 50)))
    total = len(rows)
    page_count = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(page_count, int(page or 1)))
    start = (page - 1) * page_size
    page_rows = rows[start:start + page_size]
    # Lane-queue fill state of each row (queued in Part1 / processing / done /
    # failed) from the tracker of ITS lane — words and sentences separately.
    keys_by_lane: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for row in page_rows:
        lane = orch_promote.resource_lane(row)
        if lane:
            keys_by_lane.setdefault(lane, {})[orch_promote.resource_queue_key(row)] = row
    for lane, by_key in keys_by_lane.items():
        states = audio_queue_center.tracked_states(lane, list(by_key))
        for key, row in by_key.items():
            entry = states.get(key)
            if entry is not None and owner in entry["owners"] + [entry["settled_by"]]:
                row["queue_lane"] = lane
                row["queue_state"] = entry["state"]
                row["queue_settled_by"] = entry["settled_by"]
    return {**base, "items": page_rows, "total": total, "page": page, "page_count": page_count}


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


def task_file_chunk(task_id: str, name: str, offset: int = 0, length: int = _FILE_CHUNK_BYTES) -> Dict[str, Any]:
    """One chunk of a generated segment file (audio mp3 / video mp4) as base64,
    with the total size, so the UI can play or download it."""
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    if not _FILE_NAME_RE.fullmatch(str(name or "")):
        return {"success": False, "error": "ORCH_FILE_NAME_INVALID"}
    directory = (orch_store.base_dir() / "output" / str(task.get("slug") or "task")).resolve()
    path = (directory / str(name)).resolve()
    if path.parent != directory or not path.is_file():
        return {"success": False, "error": "ORCH_FILE_NOT_FOUND"}
    return _read_file_chunk(path, offset, length)


def _read_file_chunk(path: Path, offset: Any, length: Any) -> Dict[str, Any]:
    size = path.stat().st_size
    start = min(size, _positive_int(offset, 0, 0))
    count = min(_FILE_CHUNK_BYTES, _positive_int(length, _FILE_CHUNK_BYTES))
    with path.open("rb") as handle:
        handle.seek(start)
        chunk = handle.read(count)
    return {
        "success": True,
        "name": path.name,
        "media_type": _FILE_MEDIA_TYPES[path.suffix.lower()],
        "bytes": size,
        "offset": start,
        "length": len(chunk),
        "eof": start + len(chunk) >= size,
        "content_base64": base64.b64encode(chunk).decode("ascii"),
    }


def _resource_hit_path(kind: str, language: str, text: str) -> Optional[Path]:
    if kind == "word":
        path = word_audio_cache.find_cached_many([text], language).get(text.strip().lower())
    elif kind == "sentence":
        path = orch_resources.sentence_cache_hit(text, language)
    else:
        return None
    return path if path is not None and validate_mp3(str(path))[0] else None


def _resource_entries(requested: List[Any]) -> List[Dict[str, Any]]:
    """Central-cache state of request items, in order: key, hit path, size and
    the gloss of an English word (word hits are looked up once per language)."""
    entries = [
        (str(item.get("kind") or ""), str(item.get("language") or ""), str(item.get("text") or ""))
        for item in requested if isinstance(item, dict)
    ]
    word_hits: Dict[str, Dict[str, Any]] = {}
    for language in {language for kind, language, _ in entries if kind == "word"}:
        word_hits[language] = word_audio_cache.find_cached_many(
            [text for kind, lang, text in entries if kind == "word" and lang == language], language,
        )
    answers = []
    for kind, language, text in entries:
        if kind == "word":
            path = word_hits[language].get(text.strip().lower())
            path = path if path is not None and validate_mp3(str(path))[0] else None
        else:
            path = _resource_hit_path(kind, language, text)
        english_word = kind == "word" and language == orch_video.LANGUAGE_EN
        answers.append({
            "key": orch_resources.resource_id(kind, language, text),
            "file": path,
            "bytes": path.stat().st_size if path is not None else 0,
            "meaning": orch_video.short_meaning(
                dictionary_service.translate(text.strip().lower(), orch_video.LANGUAGE_ZH),
            ) if english_word else "",
        })
    return answers


def resource_lookup(items: Any) -> Dict[str, Any]:
    """Batch central-cache lookup for device-side orchestration: one entry per
    request item, in order, with the resource key, hit flag, size and gloss."""
    requested = items if isinstance(items, list) else []
    if len(requested) > _RESOURCE_LOOKUP_MAX_ITEMS:
        return {"success": False, "error": "ORCH_RESOURCE_LOOKUP_TOO_MANY"}
    return {"success": True, "items": [
        {
            "key": entry["key"],
            "hit": entry["file"] is not None,
            "bytes": entry["bytes"],
            "path": portable_path(str(entry["file"])) if entry["file"] is not None else "",
            "meaning": entry["meaning"],
        }
        for entry in _resource_entries(requested)
    ]}


def resource_file(kind: str, language: str, text: str) -> Optional[Dict[str, Any]]:
    """One cached clip whole (static delivery): key, media type and bytes, or
    None when the central cache does not hold it; the path is always resolved
    server-side."""
    path = _resource_hit_path(str(kind or ""), str(language or ""), str(text or ""))
    if path is None:
        return None
    return {
        "key": orch_resources.resource_id(str(kind), str(language), str(text)),
        "media_type": _FILE_MEDIA_TYPES[path.suffix.lower()],
        "body": path.read_bytes(),
    }


def resource_bundle(items: Any) -> Optional[bytes]:
    """Many cached clips in one framed body (contract transfer.pycore_bundle_frame):
    per item, in order, a length-prefixed JSON header and the clip bytes while
    the byte budget lasts (the first hit is always sent); None for an invalid
    request (not a list, or more items than the contract allows)."""
    if not isinstance(items, list) or len(items) > orch_contract.BUNDLE_MAX_ITEMS:
        return None
    frames: List[bytes] = []
    budget = orch_contract.BUNDLE_MAX_BYTES
    sent_any = False
    for index, entry in enumerate(_resource_entries(items)):
        path = entry["file"]
        send = path is not None and (not sent_any or entry["bytes"] <= budget)
        payload = path.read_bytes() if send else b""
        header = json.dumps({
            "index": index,
            "key": entry["key"],
            "hit": path is not None,
            "bytes": len(payload) if send else entry["bytes"],
            "sent": send,
            "meaning": entry["meaning"],
        }, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        frames.append(struct.pack(">I", len(header)) + header + payload)
        if send:
            budget -= len(payload)
            sent_any = True
    return b"".join(frames)


def resource_chunk(kind: str, language: str, text: str, offset: Any = 0, length: Any = _FILE_CHUNK_BYTES) -> Dict[str, Any]:
    """One chunk of a cached word / sentence clip; the path is always
    re-resolved from the central cache, never taken from the client."""
    path = _resource_hit_path(str(kind or ""), str(language or ""), str(text or ""))
    if path is None:
        return {"success": False, "error": "ORCH_RESOURCE_NOT_CACHED"}
    return _read_file_chunk(path, offset, length)


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


# --------------------------------------------------------------------------- #
# video presets / rendering                                                    #
# --------------------------------------------------------------------------- #
def video_presets() -> Dict[str, Any]:
    return orch_video_presets.list_presets()


def video_preset_save(preset_id: str, name: str, settings: Any, activate: bool = False) -> Dict[str, Any]:
    return orch_video_presets.save_preset(preset_id, name, settings, activate)


def video_preset_delete(preset_id: str) -> Dict[str, Any]:
    return orch_video_presets.delete_preset(preset_id)


def video_preset_activate(preset_id: str) -> Dict[str, Any]:
    return orch_video_presets.activate_preset(preset_id)


def video_preview(settings: Any = None, preset_id: str = "") -> Dict[str, Any]:
    """One rendered frame of a settings document (or of a stored preset)."""
    return orch_video.preview(settings if isinstance(settings, dict) else orch_video_presets.resolve_settings(preset_id))


def video_background_import(path: str) -> Dict[str, Any]:
    return orch_video_presets.import_background(path)


def task_render_video(task_id: str, force: bool = True) -> Dict[str, Any]:
    """Render (or re-render with ``force``) the videos of a finished task."""
    return orch_generate.start_video_render(str(task_id or ""), bool(force))


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
    "submit_text_task",
    "task_plan",
    "task_generate",
    "task_cancel",
    "task_progress",
    "task_manifest_page",
    "video_presets",
    "video_preset_save",
    "video_preset_delete",
    "video_preset_activate",
    "video_preview",
    "video_background_import",
    "task_render_video",
    "system_status",
    "task_files",
    "task_file_chunk",
    "open_output",
]
