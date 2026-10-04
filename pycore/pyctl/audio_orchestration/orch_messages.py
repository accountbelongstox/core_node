# -*- coding: utf-8 -*-
"""
Stable message codes of the audio-orchestration task log and progress.

Progress carries ``message_code`` + ``message_params`` and every event carries
``code`` + ``params``; the UI localizes by code. ``message`` is the English log
rendering of the same code (terminal log and UI fallback). No raw exception
text is ever a param: failures report the exception type only.
"""

from typing import Any, Dict

from pycore.pyutils.common.coded_message import render_template

ORCH_MSG_GENERATION_STARTED = "orch_generation_started"
ORCH_MSG_GENERATION_RESUMED = "orch_generation_resumed"
ORCH_MSG_GENERATION_INTERRUPTED = "orch_generation_interrupted"
ORCH_MSG_GENERATION_CRASHED = "orch_generation_crashed"
ORCH_MSG_GENERATION_FINISHED = "orch_generation_finished"
ORCH_MSG_CANCELLED = "orch_cancelled"
ORCH_MSG_SENTENCE_SYNC = "orch_sentence_sync"
ORCH_MSG_SENTENCE_SYNC_FAILED = "orch_sentence_sync_failed"
ORCH_MSG_FFMPEG_MISSING = "orch_ffmpeg_missing"
ORCH_MSG_WORD_STATES_LOADING = "orch_word_states_loading"
ORCH_MSG_MANIFEST_BUILDING = "orch_manifest_building"
ORCH_MSG_MANIFEST_SEGMENT = "orch_manifest_segment"
ORCH_MSG_MANIFEST_READY = "orch_manifest_ready"
ORCH_MSG_RESUMING = "orch_resuming"
ORCH_MSG_RESOURCE_SCAN = "orch_resource_scan"
ORCH_MSG_RESOURCE_SCAN_PROGRESS = "orch_resource_scan_progress"
ORCH_MSG_RESOURCE_CHECKING_CACHE = "orch_resource_checking_cache"
ORCH_MSG_RESOURCE_FETCHING_LARAVEL = "orch_resource_fetching_laravel"
ORCH_MSG_RESOURCE_GENERATING = "orch_resource_generating"
ORCH_MSG_RESOURCE_SCANNING_WORD_CACHE = "orch_resource_scanning_word_cache"
ORCH_MSG_RESOURCE_WAITING_LANE = "orch_resource_waiting_lane"
ORCH_MSG_RESOURCE_PREPARING = "orch_resource_preparing"
ORCH_MSG_WORD_BATCH = "orch_word_batch"
ORCH_MSG_PHRASE_BATCH = "orch_phrase_batch"
ORCH_MSG_PHRASES_LOADING = "orch_phrases_loading"
ORCH_MSG_PHRASES_FETCH_FAILED = "orch_phrases_fetch_failed"
ORCH_MSG_PHRASES_PENDING = "orch_phrases_pending"
ORCH_MSG_SENTENCE_RESOLVING = "orch_sentence_resolving"
ORCH_MSG_RESOURCES_PROGRESS = "orch_resources_progress"
ORCH_MSG_RESOURCES_READY = "orch_resources_ready"
ORCH_MSG_RESOURCE_MISSING = "orch_resource_missing"
ORCH_MSG_SYNC_PENDING = "orch_sync_pending"
ORCH_MSG_SYNC_DEFERRED = "orch_sync_deferred"
ORCH_MSG_SEGMENT_NO_AUDIO = "orch_segment_no_audio"
ORCH_MSG_SEGMENT_MISSING_ITEMS = "orch_segment_missing_items"
ORCH_MSG_SEGMENT_ASSEMBLING = "orch_segment_assembling"
ORCH_MSG_SEGMENT_CONCAT_FAILED = "orch_segment_concat_failed"
ORCH_MSG_SEGMENT_DONE = "orch_segment_done"
ORCH_MSG_SEGMENT_VIDEO_RENDERING = "orch_segment_video_rendering"
ORCH_MSG_SEGMENT_VIDEO_DONE = "orch_segment_video_done"
ORCH_MSG_SEGMENT_VIDEO_FAILED = "orch_segment_video_failed"
ORCH_MSG_SEGMENT_VIDEO_SKIPPED = "orch_segment_video_skipped"
ORCH_MSG_TRANSLATION_DONE = "orch_translation_done"
ORCH_MSG_TRANSLATION_FAILED = "orch_translation_failed"
ORCH_MSG_QUEUE_QUEUED = "orch_queue_queued"
ORCH_MSG_QUEUE_STARTED = "orch_queue_started"
ORCH_MSG_QUEUE_WAITING = "orch_queue_waiting"
ORCH_MSG_DONE = "orch_done"
ORCH_MSG_SEGMENTS_FAILED = "orch_segments_failed"
ORCH_CONCAT_LIST_WRITE_FAILED = "orch_concat_list_write_failed"
ORCH_FFMPEG_LAUNCH_FAILED = "orch_ffmpeg_launch_failed"
ORCH_FFMPEG_CONCAT_FAILED = "orch_ffmpeg_concat_failed"

_LOG_TEMPLATES: Dict[str, str] = {
    ORCH_MSG_GENERATION_STARTED: "generation started for {source} {source_key} ({sentences} sentences)",
    ORCH_MSG_GENERATION_RESUMED: "generation resumed for {source} {source_key} ({sentences} sentences)",
    ORCH_MSG_GENERATION_INTERRUPTED: (
        "generation interrupted; regenerate resumes from the persisted manifest "
        "(local audio caches and pending deliveries retained)"
    ),
    ORCH_MSG_GENERATION_CRASHED: "generation crashed ({error_type})",
    ORCH_MSG_GENERATION_FINISHED: (
        "generation finished: {status} (cache={cache_hits} laravel={laravel_hits} "
        "generated={generated} synced={synced} missing={missing})"
    ),
    ORCH_MSG_CANCELLED: "cancelled",
    ORCH_MSG_SENTENCE_SYNC: "syncing sentences",
    ORCH_MSG_SENTENCE_SYNC_FAILED: "no sentences for {source} {source_key}: {error}",
    ORCH_MSG_FFMPEG_MISSING: "ffmpeg not found",
    ORCH_MSG_WORD_STATES_LOADING: "loading word read states",
    ORCH_MSG_MANIFEST_BUILDING: "building manifest",
    ORCH_MSG_MANIFEST_SEGMENT: "manifest: segment {segment}/{segments}",
    ORCH_MSG_MANIFEST_READY: "manifest ready: {resources} unique resources across {segments} segments",
    ORCH_MSG_RESUMING: "resuming: {resolved}/{resources} resources already resolved, {segments_done}/{segments} segments done",
    ORCH_MSG_RESOURCE_SCAN: "scanning local audio caches",
    ORCH_MSG_RESOURCE_SCAN_PROGRESS: "scanning local audio caches: {index}/{total}",
    ORCH_MSG_RESOURCE_CHECKING_CACHE: "checking local audio cache",
    ORCH_MSG_RESOURCE_FETCHING_LARAVEL: "fetching audio from Laravel",
    ORCH_MSG_RESOURCE_GENERATING: "generating audio locally",
    ORCH_MSG_RESOURCE_SCANNING_WORD_CACHE: "scanning local word audio cache ({language}): {count} files",
    ORCH_MSG_RESOURCE_WAITING_LANE: "waiting for {pending} item(s) in progress on the {lane} lane",
    ORCH_MSG_RESOURCE_PREPARING: "preparing audio resource",
    ORCH_MSG_WORD_BATCH: "batch generating missing word audio with {engine} ({language}): {count} words",
    ORCH_MSG_PHRASE_BATCH: "batch generating missing phrase audio with {engine} ({language}): {count} phrases",
    ORCH_MSG_PHRASES_LOADING: "loading sentence phrases",
    ORCH_MSG_PHRASES_FETCH_FAILED: "sentence phrases unavailable ({language}): {error}",
    ORCH_MSG_PHRASES_PENDING: (
        "{pending} of {total} sentences have no phrases yet; regenerate later to include them"
    ),
    ORCH_MSG_SENTENCE_RESOLVING: "resolving sentence audio: {first}-{last}/{total}",
    ORCH_MSG_RESOURCES_PROGRESS: "resources: {index}/{total}",
    ORCH_MSG_RESOURCES_READY: (
        "resources ready (cache={cache_hits} laravel={laravel_hits} "
        "generated={generated} synced={synced} missing={missing})"
    ),
    ORCH_MSG_RESOURCE_MISSING: "missing {kind}: {text}",
    ORCH_MSG_SYNC_PENDING: "sync pending: {text} ({error})",
    ORCH_MSG_SYNC_DEFERRED: "sync deferred: {text} ({error_type})",
    ORCH_MSG_SEGMENT_NO_AUDIO: "segment {segment}: no audio items resolved",
    ORCH_MSG_SEGMENT_MISSING_ITEMS: "segment {segment}: missing {missing} of {total} audio items",
    ORCH_MSG_SEGMENT_ASSEMBLING: "segment {segment}: assembling {items} items",
    ORCH_MSG_SEGMENT_CONCAT_FAILED: "segment {segment}: concat failed ({error})",
    ORCH_MSG_SEGMENT_DONE: "segment {segment}: done -> {output}",
    ORCH_MSG_SEGMENT_VIDEO_RENDERING: "segment {segment}: rendering {width}x{height} video",
    ORCH_MSG_SEGMENT_VIDEO_DONE: "segment {segment}: video done -> {output}",
    ORCH_MSG_SEGMENT_VIDEO_FAILED: "segment {segment}: video failed ({error})",
    ORCH_MSG_SEGMENT_VIDEO_SKIPPED: "segment {segment}: video skipped ({error})",
    ORCH_MSG_TRANSLATION_DONE: "translated {count} sentences for the bilingual video",
    ORCH_MSG_TRANSLATION_FAILED: "{count} sentences could not be translated; shown in one language",
    ORCH_MSG_QUEUE_QUEUED: "queued for automatic generation",
    ORCH_MSG_QUEUE_STARTED: "automatic generation started ({reason})",
    ORCH_MSG_QUEUE_WAITING: "waiting for prerequisites: {waiting}",
    ORCH_MSG_DONE: "done",
    ORCH_MSG_SEGMENTS_FAILED: "{failed} of {segments} segments failed",
}


def render(code: str, params: Dict[str, Any]) -> str:
    """English log line of one message code (unknown codes render as the code)."""
    return render_template(code, _LOG_TEMPLATES.get(code), params)


def is_message_code(code: str) -> bool:
    return code in _LOG_TEMPLATES


def progress_fields(code: str, **params: Any) -> Dict[str, Any]:
    """``_progress`` fields of one coded status line."""
    return {"message_code": code, "message_params": params, "message": render(code, params)}


__all__ = [name for name in globals() if name.startswith("ORCH_")] + [
    "render",
    "is_message_code",
    "progress_fields",
]
