# -*- coding: utf-8 -*-
"""Audio queue model: lanes, signals, tracker states, local task sources and
the server binding of queued tasks (shared by the queue center parts)."""

from typing import Any, Callable, Dict, Optional

from pycore.pyutils.common.queue_center_contract import (
    MEDIA_CONTENT_ID_AUDIO_LANES,
    word_identity_content,
    word_identity_md5,
)
from pycore.pyutils.common.strtools.normalization import media_content_id, word_text
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager

# Lanes owned by the library (contract queue keys), built eagerly so the
# shared instance is fully initialized at pycore boot.
AUDIO_QUEUE_LANES = ("word_audio", "sentence_audio", "phrase_audio")
# Stable error codes for lane requests; the UI localizes them by code.
AUDIO_LANE_ERROR_UNKNOWN = "AUDIO_LANE_UNKNOWN"
AUDIO_LANE_ERROR_DISABLED = "AUDIO_LANE_DISABLED"
AUDIO_QUEUE_KIND_BY_LANE = {"word_audio": "word", "sentence_audio": "sentence", "phrase_audio": "phrase"}
AUDIO_QUEUE_LANE_BY_KIND = {kind: lane for lane, kind in AUDIO_QUEUE_KIND_BY_LANE.items()}

# THREAD_BUS signal published on every lane mutation ({lane, revision, reason}).
AUDIO_QUEUE_CHANGED_SIGNAL = "audio_queue_center.changed"
# Per-owner wake signal: set when an item an owner watches settles, when the
# owner is released, or on wake_owner (cancel); owners wait on it, never poll.
AUDIO_QUEUE_OWNER_SIGNAL_PREFIX = "audio_queue_center.owner"
PERSIST_SIGNAL = "audio_queue_center.persist_requested"
PERSIST_PAUSE_SIGNAL = "audio_queue_center.persist_pause"
PERSIST_MIN_INTERVAL_SECONDS = 5.0
# Per-lane restore-complete signal: set once restore_from_cache(lane) has
# finished (whole-Queue populated from the local snapshot), so a lane's own
# first remote pull can wait on it (R6 section 5.4: cache before any remote
# access).
RESTORE_COMPLETE_SIGNAL_PREFIX = "audio_queue_center.restore_complete"
# Safety bound on ``wait_for_restore`` below (R6 section 5.4): loading even a
# large local snapshot takes seconds, not minutes; this only guards against
# the boot chain never running for the lane at all. ONE definition - a lane
# starter imports this instead of declaring its own copy.
AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS = 180.0

# Tracker states of Part1 items (observability only).
TRACK_QUEUED = "queued"
TRACK_PROCESSING = "processing"
TRACK_DONE = "done"
TRACK_FAILED = "failed"
TRACK_TERMINAL = (TRACK_DONE, TRACK_FAILED)
# settled_by value for items a lane worker popped (owners use their own id).
SETTLED_BY_LANE = "lane"
TRACKED_TERMINAL_CAP = 5000
LANE_VIEW_ITEM_LIMIT = 200

# Local task sources (``_local_source``): tasks without a Laravel
# global_tasks row (claim + global result are skipped by the lane workers;
# delivery is the content-keyed domain report). ``lease`` items are rows of
# this node's Laravel work leases.
LOCAL_SOURCE_ORCHESTRATION = "orchestration"
LOCAL_SOURCE_MANUAL = "manual"
LOCAL_SOURCE_LEASE = "lease"
# Never persisted: leases are released at lane start and re-claimed.
EPHEMERAL_LOCAL_SOURCES = (LOCAL_SOURCE_LEASE,)

# Server binding: every queued task carries the URL of the Laravel server it
# belongs to (its claim URL, else the active route at intake). Only tasks of
# the selected server are admitted, restored and popped; a selection switch
# drops the others (their Laravel leases expire and re-dispatch them there).
TASK_SERVER_URL_FIELD = "_laravel_server_url"
SERVER_NOT_SELECTED_ERROR = "laravel_server_not_selected"


def bind_task_server(task: Dict[str, Any]) -> Dict[str, Any]:
    """Stamp the task's server URL once (idempotent) and return the task."""
    if not str(task.get(TASK_SERVER_URL_FIELD) or "").strip():
        task[TASK_SERVER_URL_FIELD] = str(
            task.get("_laravel_base_url") or laravel_endpoint_manager.get_active_base_url() or ""
        ).rstrip("/")
    return task


def task_for_selected_server(task: Dict[str, Any], matcher: Optional[Callable[[str], bool]] = None) -> bool:
    """True when the task belongs to the selected Laravel server; bulk
    callers pass one ``selected_server_matcher()`` for the whole batch."""
    return (matcher or laravel_endpoint_manager.serves_selected)(
        str(task.get(TASK_SERVER_URL_FIELD) or task.get("_laravel_base_url") or "")
    )


def build_local_task(
    lane: str,
    language: str,
    text: str,
    source: str,
    base_url: str = "",
    extra_payload: Optional[Dict[str, Any]] = None,
    md5: str = "",
) -> Optional[Dict[str, Any]]:
    """ONE builder for pycore-local lane tasks (orchestration, manual promote,
    work lease). Payload shapes match the Laravel producers so the lane
    workers process them unchanged; ``_local_source`` skips claim/result.
    ``md5`` is the Laravel word identity when the caller has it (X4); a
    word without one carries ``cleaned_word`` instead and no ``md5`` key -
    pycore never recomputes a stand-in md5 from the text."""
    lane = str(lane or "").strip()
    language = str(language or "").strip().lower()
    text = str(text or "").strip()
    if lane == "word_audio":
        text = word_text(text)
    if lane not in AUDIO_QUEUE_LANES or not language or not text:
        return None
    if lane in MEDIA_CONTENT_ID_AUDIO_LANES:
        identity = media_content_id(text)
        payload: Dict[str, Any] = {
            "text": text,
            "content": text,
            "language": language,
            "content_id": identity,
        }
    else:
        real_md5 = word_identity_md5(md5)
        cleaned_word = text.lower()
        identity = word_identity_content(real_md5, text)
        payload = {
            "word": text,
            "content": text,
            "language": language,
            "cleaned_word": cleaned_word,
        }
        if real_md5:
            payload["md5"] = real_md5
    payload.update(extra_payload or {})
    task: Dict[str, Any] = {
        "task_id": f"{source}-{AUDIO_QUEUE_KIND_BY_LANE[lane]}-{language}-{identity}",
        "task_type": lane,
        "payload": payload,
        "_local_source": str(source or LOCAL_SOURCE_MANUAL),
    }
    if base_url:
        task["_laravel_base_url"] = str(base_url)
    return task


LANE_SOURCE_LARAVEL = "laravel"


def lane_task_source(task: Dict[str, Any]) -> str:
    """Assist source of one lane task: its local source (lease,
    orchestration, manual) or ``laravel`` for a Laravel global task."""
    return str(task.get("_local_source") or "") or LANE_SOURCE_LARAVEL


def task_text(task: Dict[str, Any]) -> str:
    payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
    return str(payload.get("word") or payload.get("text") or payload.get("content") or "")


def task_language(task: Dict[str, Any]) -> str:
    payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
    return str(payload.get("language") or "")


def restore_signal_name(lane: str) -> str:
    return f"{RESTORE_COMPLETE_SIGNAL_PREFIX}.{lane}"


def owner_signal(lane: str, owner: str) -> str:
    """THREAD_BUS wake signal of one owner on one lane."""
    return f"{AUDIO_QUEUE_OWNER_SIGNAL_PREFIX}.{lane}.{owner}"


__all__ = [
    "AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS",
    "AUDIO_QUEUE_CHANGED_SIGNAL",
    "AUDIO_QUEUE_KIND_BY_LANE",
    "AUDIO_QUEUE_LANES",
    "AUDIO_QUEUE_LANE_BY_KIND",
    "AUDIO_QUEUE_OWNER_SIGNAL_PREFIX",
    "LANE_VIEW_ITEM_LIMIT",
    "LANE_SOURCE_LARAVEL",
    "LOCAL_SOURCE_LEASE",
    "lane_task_source",
    "EPHEMERAL_LOCAL_SOURCES",
    "LOCAL_SOURCE_MANUAL",
    "LOCAL_SOURCE_ORCHESTRATION",
    "PERSIST_MIN_INTERVAL_SECONDS",
    "PERSIST_PAUSE_SIGNAL",
    "PERSIST_SIGNAL",
    "RESTORE_COMPLETE_SIGNAL_PREFIX",
    "SERVER_NOT_SELECTED_ERROR",
    "SETTLED_BY_LANE",
    "TASK_SERVER_URL_FIELD",
    "TRACKED_TERMINAL_CAP",
    "TRACK_DONE",
    "TRACK_FAILED",
    "TRACK_PROCESSING",
    "TRACK_QUEUED",
    "TRACK_TERMINAL",
    "bind_task_server",
    "build_local_task",
    "owner_signal",
    "restore_signal_name",
    "task_for_selected_server",
    "task_language",
    "task_text",
]
