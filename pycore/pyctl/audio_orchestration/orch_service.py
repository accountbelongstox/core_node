# -*- coding: utf-8 -*-
"""Route-facing task service of the audio-orchestration domain: books, task
records, plans, progress and the manifest drill-down. Every function returns a
JSON-able dict with a ``success`` flag."""

import time
from typing import Any, Dict, List, Optional

from pycore.pyutils.common.keyset_cursor import keyset_request
from pycore.pyutils.tts.audio_queue_model import AUDIO_QUEUE_LANES
from pycore.pyutils.tts.audio_queue_center import audio_queue_center

from pycore.pyctl.audio_orchestration import (
    orch_books,
    orch_contract,
    orch_generate,
    orch_plan,
    orch_promote,
    orch_events,
    orch_resources,
    orch_sources,
    orch_store,
    orch_video,
    orch_video_presets,
)
from pycore.pyctl.audio_orchestration.orch_files import positive_int
from pycore.pyctl.audio_orchestration.orch_queue import orch_queue
from pycore.pyctl.audio_orchestration.orch_delivery import orch_delivery
from pycore.pyctl.tts.audio_resource_delivery import audio_resource_delivery

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


def tasks_list(params: Dict[str, Any]) -> Dict[str, Any]:
    """One newest-first keyset page of task summaries of a source (books /
    prompts) plus the per-source totals the UI shows on its tabs:
    ``{success, sources, counts, total, items, next_cursor, has_more}``."""
    request = params or {}
    after, limit = keyset_request(request)
    listing = orch_store.page_tasks(
        str(request.get("source") or "").strip(), after, limit, str(request.get("query") or ""),
    )
    pending_counts = audio_resource_delivery.pending_counts()
    output_counts = orch_delivery.output_counts(listing["items"])
    # One owner hop each for the whole page, not one per task.
    running_ids = set(orch_generate.running_task_ids())
    queue_states = orch_queue.states_of([str(task.get("task_id") or "") for task in listing["items"]])
    return {
        "success": True,
        "sources": list(orch_sources.ORCH_SOURCES),
        "counts": listing["counts"],
        "total": listing["total"],
        "items": [
            _task_summary(task, pending_counts, output_counts, running_ids, queue_states)
            for task in listing["items"]
        ],
        "next_cursor": listing["next_cursor"],
        "has_more": listing["has_more"],
    }


ACTIVE_TASKS_LIMIT = 50


def tasks_active(params: Dict[str, Any]) -> Dict[str, Any]:
    """The bounded "recently active" view (running or generating tasks, most
    recently updated first) beside the immutable-keyset task list:
    ``{success, items, total}``."""
    running_ids = set(orch_generate.running_task_ids())
    tasks = orch_store.active_tasks(running_ids, ACTIVE_TASKS_LIMIT)
    pending_counts = audio_resource_delivery.pending_counts()
    output_counts = orch_delivery.output_counts(tasks)
    queue_states = orch_queue.states_of([str(task.get("task_id") or "") for task in tasks])
    return {
        "success": True,
        "items": [_task_summary(task, pending_counts, output_counts, running_ids, queue_states) for task in tasks],
        "total": len(tasks),
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
        "segment_value": positive_int(
            payload.get("segment_value"), _DEFAULT_BOOK_SEGMENT_MINUTES if segment_mode == "minutes" else _DEFAULT_BOOK_SEGMENT_VALUE,
        ),
        "pattern": _normalize_pattern(payload.get("pattern"), word_mode) or orch_contract.default_pattern(),
        "word_mode": word_mode,
        "new_only_max_read_count": positive_int(payload.get("new_only_max_read_count"), 0, 0),
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
    normal sentence audio path (output mode: contract default ``audio``). ``source_text`` keeps the
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
    plan = orch_plan.plan_task(task, sentences)
    return {"success": True, **plan}


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
    Pure read of orch_store data - the same counters the task progress shows,
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
    # failed) from the tracker of ITS lane - words and sentences separately.
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
# video presets / rendering                                                    #
# --------------------------------------------------------------------------- #
def video_preview(settings: Any = None, preset_id: str = "") -> Dict[str, Any]:
    """One rendered frame of a settings document (or of a stored preset)."""
    return orch_video.preview(settings if isinstance(settings, dict) else orch_video_presets.resolve_settings(preset_id))


def task_render_video(task_id: str, force: bool = True) -> Dict[str, Any]:
    """Render (or re-render with ``force``) the videos of a finished task."""
    return orch_generate.start_video_render(str(task_id or ""), bool(force))


__all__ = [
    "books_list",
    "book_sentences",
    "tasks_list",
    "task_get",
    "task_create",
    "task_update",
    "task_delete",
    "submit_text_task",
    "task_plan",
    "task_cancel",
    "task_progress",
    "task_manifest_page",
    "video_preview",
    "task_render_video",
]
