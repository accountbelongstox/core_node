# -*- coding: utf-8 -*-
"""
Audio generation pipeline for orchestration tasks (manifest-first).

Per task, three persisted phases:
  1. manifest  - expand the task pattern (sentence_en / sentence_zh /
                 words_new / words_all steps; per-step word policy, task-local
                 virtual read via orch_words) into ordered per-segment items
                 and the unique word/sentence resource list.
  2. resources - resolve every unique resource REUSING the existing caches
                 and engines (orch_resources.resolve_batch: batch cache scan,
                 then words through the shared Kokoro batch
                 kokoro_batch.synthesize_words_to_cache and sentences through
                 Laravel -> local synthesis); every resolved clip is recorded
                 in the local clip ledger and newly generated clips are queued
                 for every Laravel server through the cache-level kind
                 (audio_resource_delivery.publish, kind audio_cache.resource).
  3. assemble  - concatenate each segment's resolved items with ffmpeg
                 (re-encode to one uniform mp3) into
                 <user data dir>/audio_orchestration/output/<task_slug>/segment_XXX.mp3.
                 A segment is assembled AS SOON AS every one of its resources
                 is resolved (while the other segments' resources are still
                 being prepared); a video task then renders the segment's 720p
                 bilingual scrolling video (segment_XXX.mp4, orch_video) from
                 the same audio and timeline. Phase 3 after the resource phase
                 only catches the segments that were not complete earlier.
                 The finished output (task metadata + segments) is queued
                 for idempotent Laravel upload (orch_delivery, kind
                 audio_orch.output); undelivered history is backfilled on
                 every Laravel online edge.

Generation runs on a daemon thread per task; progress is persisted into the
task record so the UI polls it via the task routes. Tasks are started
automatically by the orchestration queue (orch_queue) once their prerequisites
are met; the manual start route only forces a run.
"""

import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import (
    Any,
    Dict,
    List,
    Optional,
)

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.ffmpeg.ffmpeg_probe import ffprobe_client
from pycore.pyutils.common.ffmpeg.ffmpeg_runtime import ffmpeg_runtime
from pycore.pyutils.common.background_jobs import BackgroundJobs
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.tts.audio_resource_ledger import audio_resource_ledger

from pycore.pyctl.audio_orchestration import (
    orch_books,
    orch_events,
    orch_assembly,
    orch_messages as msg,
    orch_plan,
    orch_resources,
    orch_sources,
    orch_store,
    orch_translations,
    orch_video,
    orch_video_presets,
    orch_words,
)
from pycore.pyctl.audio_orchestration.orch_delivery import orch_delivery
from pycore.pyctl.tts.audio_resource_delivery import audio_resource_delivery

_generation_jobs = BackgroundJobs("AudioOrchGeneration")
_MANIFEST_SAVE_EVERY_RESOURCES = 1000
_THROTTLED_ACTIVITY_CODES = (msg.ORCH_MSG_RESOURCE_SCAN_PROGRESS, msg.ORCH_MSG_RESOURCE_SCANNING_WORD_CACHE)
MISSING_ERROR_CHARS = 300
_STAT_PARAM_KEYS = ("cache_hits", "laravel_hits", "generated", "synced", "missing")


# --------------------------------------------------------------------------- #
# background generation                                                        #
# --------------------------------------------------------------------------- #
def is_running(task_id: str) -> bool:
    return _generation_jobs.running(task_id)


def running_task_ids() -> List[str]:
    """Ids of the tasks a generation or video-render job is running for now."""
    return _generation_jobs.keys()


def running_count() -> int:
    """Generation and video-render jobs running now (the queue's capacity gauge)."""
    return _generation_jobs.count()


def request_cancel(task_id: str) -> bool:
    task = orch_store.get_task(task_id)
    if not task:
        return False
    cancelled = _generation_jobs.cancel(task_id)
    if cancelled:
        orch_resources.wake_owner(task_id)
        orch_sources.wake_sentence_waiters(task)
    return cancelled


def has_resumable_state(task: Dict[str, Any]) -> bool:
    """Cheap UI-facing probe: a persisted manifest whose signature still matches
    the task's last run means a failed/interrupted task can resume instead of
    rebuilding the whole manifest."""
    if str(task.get("status") or "") not in ("failed", "generating"):
        return False
    signature = str(task.get("plan_signature") or "")
    return bool(signature) and orch_store.manifest_signature(str(task.get("task_id") or "")) == signature


def start_generation(
    task_id: str,
    expected_user_id: Optional[int] = None,
    expected_base_url: Optional[str] = None,
    use_qy_account: Optional[bool] = None,
    word_group_id: Optional[str] = None,
    resume: Optional[bool] = None,
    force_fresh: bool = False,
    automatic: bool = False,
) -> Dict[str, Any]:
    """Start a run. ``automatic`` marks a start by the queue: a start by the user
    gives the task its automatic retries back."""
    task = orch_store.get_task(task_id)
    auth_record = {} if use_qy_account is False else orch_store.load_auth() or {}
    if not task:
        return {"success": False, "error": "task not found"}
    if is_running(task_id):
        return {"success": False, "error": "generation already running"}
    if expected_user_id is not None and (
        (auth_record.get("user") or {}).get("id") != expected_user_id
        or str(auth_record.get("base_url") or "").rstrip("/") != str(expected_base_url or "").rstrip("/")
    ):
        return {"success": False, "error": "QY_ACCOUNT_MACHINE_SYNC_PENDING"}
    if word_group_id:
        # The UI-selected read-state baseline travels with the task so later
        # regenerations keep using the same Word Group.
        orch_store.patch_run_fields(task_id, {"word_group_id": str(word_group_id)})
    elif not task.get("word_group_id") and auth_record.get("word_group_id"):
        # Default to the pycore-side persisted baseline selection.
        orch_store.patch_run_fields(task_id, {"word_group_id": str(auth_record["word_group_id"])})
    if not automatic:
        orch_store.patch_run_fields(task_id, {"auto_retries": 0})
    if force_fresh:
        resume = False
    elif resume is None:
        # Interrupted (stale "generating" after a process restart) and failed
        # tasks resume from the persisted manifest by default; anything else
        # (draft, done) is a fresh run.
        status = str(task.get("status") or "")
        resume = status == "generating" or (status == "failed" and has_resumable_state(task))
    if not _generation_jobs.start(task_id, _run_generation, task_id, auth_record, bool(resume)):
        return {"success": False, "error": "generation already running"}
    return {"success": True, "task_id": task_id, "resumed": bool(resume)}


def start_video_render(task_id: str, force: bool = False) -> Dict[str, Any]:
    """Render the videos of a finished task's segments that have none (or all of
    them with ``force``, e.g. after a preset change) from their stored audio,
    timeline and manifest; no audio is regenerated."""
    task = orch_store.get_task(task_id)
    if not task:
        return {"success": False, "error": "task not found"}
    if is_running(task_id):
        return {"success": False, "error": "generation already running"}
    if not orch_sources.wants_video(task):
        return {"success": False, "error": "ORCH_TASK_NOT_VIDEO"}
    if not _generation_jobs.start(task_id, _run_video_render, task_id, bool(force)):
        return {"success": False, "error": "generation already running"}
    return {"success": True, "task_id": task_id}


def _run_video_render(task_id: str, force: bool) -> None:
    task = orch_store.get_task(task_id)
    binary = ffmpeg_runtime.binaries().ffmpeg
    manifest = orch_store.load_manifest(task_id)
    segment_items = manifest.get("segment_items") if isinstance(manifest.get("segment_items"), list) else []
    if not task or binary is None:
        return
    if len(segment_items) != len(task.get("segments") or []):
        # Without the manifest the cards cannot be rebuilt: mark what would have
        # been rendered as skipped, so the queue does not pick this task up again.
        for segment in task["segments"]:
            if segment.get("status") == "done" and (force or not segment.get("video_status")):
                segment["video_status"] = "skipped"
                segment["video_error"] = orch_video.ERROR_NO_MANIFEST
        orch_store.commit_run(task)
        return
    sentences = orch_sources.cached_task_sentences(task) or []
    output_dir = orch_store.output_dir_for(task)
    staging = output_dir / "staging"
    staging.mkdir(parents=True, exist_ok=True)
    run = _Run(
        task=task, stats={}, ffmpeg=str(binary), staging=staging, output_dir=output_dir, gap=None,
        sentences=sentences,
        video_settings=orch_video_presets.resolve_settings(str(task.get("video_preset") or "")),
    )
    for segment, items in zip(task["segments"], segment_items):
        if _generation_jobs.cancelled(task_id):
            break
        if segment.get("status") != "done" or not (force or not segment.get("video_status")):
            continue
        if not _audio_done(segment) or not segment.get("timeline"):
            # Nothing to render from: skipped, so the queue does not pick it again.
            segment["video_status"] = "skipped"
            segment["video_error"] = orch_video.ERROR_NO_TIMELINE if not segment.get("timeline") else orch_video.ERROR_NO_AUDIO
            orch_store.commit_run(task)
            continue
        segment["video_status"] = None
        _render_segment_video(run, segment, items, "video")
    task["cancel_requested"] = False
    _progress(task, phase="done", **msg.progress_fields(msg.ORCH_MSG_DONE), output_dir=str(output_dir))


def _stat_params(stats: Dict[str, Any]) -> Dict[str, Any]:
    return {key: stats.get(key, 0) for key in _STAT_PARAM_KEYS}


def _close_phase(progress: Dict[str, Any], now: float) -> None:
    """Copy-on-write phase_times with the current phase's timing closed."""
    progress["phase_times"] = {key: dict(value) for key, value in (progress.get("phase_times") or {}).items()}
    timing = progress["phase_times"].get(str(progress.get("phase") or ""))
    if timing is not None and not timing.get("finished_at"):
        timing["finished_at"] = now


def _progress(task: Dict[str, Any], persist: bool = True, **fields: Any) -> None:
    progress = dict(task.get("progress") or {})
    phase = fields.get("phase")
    if phase and phase != progress.get("phase"):
        # Per-phase wall-clock timing ({phase: {started_at, finished_at}});
        # "done" is the terminal marker, not a timed phase.
        now = time.time()
        _close_phase(progress, now)
        if phase != "done":
            progress["phase_times"][phase] = {"started_at": now, "finished_at": None}
    progress.update(fields)
    task["progress"] = progress
    task["cancel_requested"] = _generation_jobs.cancelled(str(task.get("task_id") or ""))
    # The store owns the record: a persisted tick commits every run field, a
    # throttled tick only refreshes the progress in memory (readers see it now,
    # the disk write waits for the next persisted one).
    orch_store.commit_run(task, persist=persist, progress_only=not persist)
    if persist:
        orch_events.publish_task_changed(task)
    orch_events.publish_task_progress(task)


def _finish(task: Dict[str, Any], status: str) -> None:
    """Terminal transition of one run: status + finish time + open phase
    closed (persisted by the caller's following _progress)."""
    now = time.time()
    task["status"] = status
    task["generation_finished_at"] = now
    progress = dict(task.get("progress") or {})
    _close_phase(progress, now)
    task["progress"] = progress


def _run_generation(task_id: str, auth_record: Dict[str, Any], resume: bool = False) -> None:
    task = orch_store.get_task(task_id)
    if not task:
        return
    try:
        _generate(task, auth_record, resume=resume)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[AudioOrch] generation crashed for {task_id}: {exc}")
        # Part1 items this task still holds in the lane queues are released,
        # so no tracker entry or dedup key stays owned by a dead run.
        orch_resources.release_owner_queue(task_id)
        _finish(task, "failed")
        orch_store.append_task_event(task, msg.ORCH_MSG_GENERATION_CRASHED, error_type=type(exc).__name__)
        _progress(task, **msg.progress_fields(msg.ORCH_MSG_GENERATION_CRASHED, error_type=type(exc).__name__))


def _cancel(task: Dict[str, Any], stats: Dict[str, Any]) -> bool:
    if not _generation_jobs.cancelled(str(task.get("task_id") or "")):
        return False
    orch_resources.release_owner_queue(str(task.get("task_id") or ""))
    _finish(task, "draft")
    _progress(task, **msg.progress_fields(msg.ORCH_MSG_CANCELLED), **stats)
    return True


@dataclass
class _Run:
    """Everything one generation run shares between the resource phase and the
    per-segment assembly (so a segment can be assembled from either)."""

    task: Dict[str, Any]
    stats: Dict[str, Any]
    ffmpeg: str
    staging: Path
    output_dir: Path
    gap: Optional[Path]
    sentences: List[Dict[str, Any]]
    video_settings: Optional[Dict[str, Any]]
    clip_durations: Dict[Path, float] = field(default_factory=dict)
    translation_off: bool = False


def _audio_done(segment: Dict[str, Any]) -> bool:
    return segment.get("status") == "done" and bool(segment.get("output")) and Path(str(segment["output"])).is_file()


def _video_done(segment: Dict[str, Any]) -> bool:
    return (
        segment.get("video_status") == "done"
        and bool(segment.get("video_output"))
        and Path(str(segment["video_output"])).is_file()
    )


def _render_segment_video(run: _Run, segment: Dict[str, Any], items: List[Dict[str, Any]], phase: str) -> None:
    """Render the segment's video from its finished audio and timeline. A video
    problem never fails the segment: the audio is what Laravel receives."""
    task = run.task
    task_id = str(task["task_id"])
    audio = Path(str(segment["output"]))
    output = audio.with_suffix(orch_video.VIDEO_EXTENSION)
    width, height = orch_video.VIDEO_RESOLUTION
    if not run.translation_off and run.video_settings and run.video_settings.get("languages") == orch_video_presets.LANGUAGES_BOTH:
        # Every card is bilingual: translate the side a sentence lacks (once;
        # after a failure the rest of this run renders one-language cards).
        run.sentences, translated, failed = orch_translations.complete(
            task, run.sentences, {item.get("seq") for item in items if item.get("seq") is not None},
        )
        if translated:
            orch_store.append_task_event(task, msg.ORCH_MSG_TRANSLATION_DONE, count=translated)
        if failed:
            run.translation_off = True
            orch_store.append_task_event(task, msg.ORCH_MSG_TRANSLATION_FAILED, count=failed)
    segment["video_status"] = "rendering"
    segment["video_error"] = None
    segment["video_output"] = None
    _progress(
        task, phase=phase,
        **msg.progress_fields(msg.ORCH_MSG_SEGMENT_VIDEO_RENDERING, segment=segment["index"], width=width, height=height),
        segment_index=segment["index"], **run.stats,
    )
    result = orch_video.render_segment(
        audio, output, run.staging / f"{audio.stem}.ass", items, list(segment.get("timeline") or []),
        run.sentences, run.video_settings or {}, segment.get("duration_ms"),
        should_stop=lambda: _generation_jobs.cancelled(task_id),
    )
    if result.get("success"):
        segment["video_status"] = "done"
        segment["video_output"] = str(output)
        orch_store.append_task_event(task, msg.ORCH_MSG_SEGMENT_VIDEO_DONE, segment=segment["index"], output=output.name)
    elif result.get("error") == orch_video.ERROR_NO_TIMELINE:
        segment["video_status"] = "skipped"
        segment["video_error"] = orch_video.ERROR_NO_TIMELINE
        orch_store.append_task_event(
            task, msg.ORCH_MSG_SEGMENT_VIDEO_SKIPPED, segment=segment["index"], error=orch_video.ERROR_NO_TIMELINE,
        )
    elif result.get("stopped"):
        segment["video_status"] = None
    else:
        segment["video_status"] = "failed"
        segment["video_error"] = str(result.get("error") or orch_video.ERROR_RENDER_FAILED)
        orch_store.append_task_event(
            task, msg.ORCH_MSG_SEGMENT_VIDEO_FAILED, segment=segment["index"], error=segment["video_error"],
        )
    orch_store.commit_run(task)


def _assemble_segment(
    run: _Run,
    segment: Dict[str, Any],
    items: List[Dict[str, Any]],
    resolved: Dict[str, str],
    phase: str,
) -> bool:
    """Assemble one segment: concat its audio, then (video tasks) render its
    video. A segment whose audio is already done only renders a missing video.
    Returns False when the run was cancelled meanwhile."""
    task = run.task
    stats = run.stats
    if _audio_done(segment):
        if run.video_settings is not None and not _video_done(segment) and segment.get("timeline"):
            _render_segment_video(run, segment, items, phase)
        return not _cancel(task, stats)
    files = [
        Path(resolved[item["resource_id"]])
        for item in items
        if item.get("resource_id") in resolved
    ]
    if not files:
        segment["status"] = "failed"
        segment["error"] = msg.ORCH_MSG_SEGMENT_NO_AUDIO
        orch_store.append_task_event(task, msg.ORCH_MSG_SEGMENT_NO_AUDIO, segment=segment["index"])
        orch_store.commit_run(task)
        return True
    if len(files) != len(items):
        segment["status"] = "failed"
        segment["error"] = msg.ORCH_MSG_SEGMENT_MISSING_ITEMS
        orch_store.append_task_event(
            task, msg.ORCH_MSG_SEGMENT_MISSING_ITEMS,
            segment=segment["index"], missing=len(items) - len(files), total=len(items),
        )
        orch_store.commit_run(task)
        return True
    segment["status"] = "assembling"
    segment["started_at"] = time.time()
    segment["finished_at"] = None
    _progress(
        task, phase=phase,
        **msg.progress_fields(msg.ORCH_MSG_SEGMENT_ASSEMBLING, segment=segment["index"], items=len(files)),
        segment_index=segment["index"], item_index=0, item_total=len(files), **stats,
    )
    output = run.output_dir / f"segment_{segment['index']:03d}.mp3"
    error = orch_assembly.concat_segment(run.ffmpeg, run.gap, files, output)
    segment["finished_at"] = time.time()
    if _cancel(task, stats):
        return False
    if error:
        segment["status"] = "failed"
        segment["error"] = error
        orch_store.append_task_event(
            task, msg.ORCH_MSG_SEGMENT_CONCAT_FAILED, segment=segment["index"], error=error,
        )
        orch_store.commit_run(task)
        return True
    segment["status"] = "done"
    segment["output"] = str(output)
    # Per-clip offsets for precise player highlight (W5 `timeline`) and for the
    # video's card timing.
    segment["timeline"] = orch_assembly.segment_timeline(items, files, run.gap, run.clip_durations)
    segment["duration_ms"] = int(round(float(ffprobe_client.probe(output).duration or 0.0) * 1000)) or None
    orch_store.append_task_event(
        task, msg.ORCH_MSG_SEGMENT_DONE, segment=segment["index"], output=output.name,
    )
    orch_store.commit_run(task)
    if run.video_settings is not None:
        _render_segment_video(run, segment, items, phase)
    return not _cancel(task, stats)


def _generate(task: Dict[str, Any], auth_record: Dict[str, Any], resume: bool = False) -> None:
    task_id = str(task["task_id"])
    base_url = str(auth_record.get("base_url") or "") or None
    # Regenerate = replace: start with a clean log. Resume keeps the previous
    # log so the UI still shows what the interrupted run already did.
    if not resume:
        orch_store.clear_task_events(task)
    orch_store.append_task_event(
        task,
        msg.ORCH_MSG_GENERATION_RESUMED if resume else msg.ORCH_MSG_GENERATION_STARTED,
        **orch_sources.task_label_params(task),
    )
    task["status"] = "generating"
    # Run timing: a resume keeps the original start; every run clears the
    # previous finish until it reaches a terminal state again.
    task["generation_finished_at"] = None
    if not resume or not task.get("generation_started_at"):
        task["generation_started_at"] = time.time()
    if not resume:
        task["progress"] = {}
        task["generation_id"] = uuid.uuid4().hex
    elif not task.get("generation_id"):
        task["generation_id"] = uuid.uuid4().hex
    _progress(task, phase="sync", current_item="", **msg.progress_fields(msg.ORCH_MSG_SENTENCE_SYNC))
    synced = orch_sources.ensure_task_sentences(
        task,
        cancel_requested=lambda: _generation_jobs.cancelled(task_id),
        progress_callback=lambda state: _progress(
            task, phase="sync", **msg.progress_fields(msg.ORCH_MSG_SENTENCE_SYNC),
            item_index=state.get("fetched") or 0, item_total=state.get("total") or 0,
        ),
    )
    if _cancel(task, {}):
        return
    sentences = synced.get("sentences") if isinstance(synced, dict) else None
    if not sentences:
        _finish(task, "failed")
        sync_params = {
            **orch_sources.task_label_params(task),
            "error": str((synced.get("error") if isinstance(synced, dict) else "") or "unknown"),
        }
        orch_store.append_task_event(task, msg.ORCH_MSG_SENTENCE_SYNC_FAILED, **sync_params)
        _progress(task, **msg.progress_fields(msg.ORCH_MSG_SENTENCE_SYNC_FAILED, **sync_params))
        return

    binary = ffmpeg_runtime.binaries().ffmpeg
    ffmpeg = str(binary) if binary is not None else None
    if not ffmpeg:
        _finish(task, "failed")
        orch_store.append_task_event(task, msg.ORCH_MSG_FFMPEG_MISSING)
        _progress(task, **msg.progress_fields(msg.ORCH_MSG_FFMPEG_MISSING))
        return

    task["plan_signature"] = orch_plan.plan_signature(task, len(sentences))
    resume_state = orch_plan.load_resume_state(task) if resume else None
    partitioned = orch_books.partition_sentences(
        sentences,
        str(task.get("segment_mode") or "count"),
        int(task.get("segment_value") or 1),
    )
    if resume_state is not None and len(task.get("segments") or []) != len(partitioned):
        resume_state = None

    output_dir = orch_store.output_dir_for(task)
    staging = output_dir / "staging"
    staging.mkdir(parents=True, exist_ok=True)

    default_stats = {"cache_hits": 0, "laravel_hits": 0, "generated": 0, "missing": 0, "synced": 0, "sync_queued": 0}
    resolved: Dict[str, str] = {}
    segment_items: List[List[Dict[str, Any]]] = []
    stats = dict(default_stats)
    # Per-resource drill-down detail (source/provider/sync) persisted with the
    # manifest so the UI manifest panel can page every resource by category.
    resource_meta: Dict[str, Any] = {}

    if resume_state is None:
        # Fresh run: any stale durable state from a previous plan is dropped.
        orch_store.delete_manifest(task_id)
        task["segments"] = [
            {**segment, "status": "pending", "output": None, "error": None}
            for segment in partitioned
        ]
        task["virtual_read"] = []
        task["cancel_requested"] = False
        task["status"] = "generating"
        # Regenerate = replace: drop stale segment files from the previous run so
        # the directory only ever holds the CURRENT plan's output.
        for pattern in ("segment_*.mp3", "segment_*.mp4"):
            for stale in output_dir.glob(pattern):
                try:
                    stale.unlink()
                except OSError:
                    pass

        orch_words.prepare_word_states(
            task, sentences, auth_record,
            cancel_requested=lambda: _generation_jobs.cancelled(task_id),
            progress_callback=lambda index, total: _progress(
                task, phase="manifest", **msg.progress_fields(msg.ORCH_MSG_WORD_STATES_LOADING),
                item_index=index, item_total=total, **stats,
            ),
        )
        if _cancel(task, stats):
            return

        # Phase 1: manifest - expand every segment into ordered audio items
        # (consuming the virtual-read set exactly once) and collect the unique
        # word/sentence resources the whole task needs.
        _progress(
            task, phase="manifest", **msg.progress_fields(msg.ORCH_MSG_MANIFEST_BUILDING),
            segment_index=0, resource_index=0, resource_total=0, **stats,
            item_index=0, item_total=len(sentences),
        )
        resources: Dict[str, Dict[str, Any]] = {}
        for segment in task["segments"]:
            if _cancel(task, stats):
                return
            items: List[Dict[str, Any]] = []
            for sentence_pos in range(segment["start"], segment["end"] + 1):
                if _cancel(task, stats):
                    return
                items.extend(
                    {**item, "seq": sentences[sentence_pos].get("seq")}
                    for item in orch_plan.build_sentence_items(task, sentences[sentence_pos], consume=True, auth_record=auth_record)
                )
                if sentence_pos % 100 == 0:
                    _progress(task, phase="manifest", item_index=sentence_pos + 1,
                              item_total=len(sentences), segment_index=segment["index"], **stats)
            for item in items:
                resource_id = orch_resources.resource_id(item["kind"], item["language"], item["text"])
                item["resource_id"] = resource_id
                if resource_id not in resources:
                    resources[resource_id] = {
                        "kind": item["kind"],
                        "language": item["language"],
                        "text": item["text"],
                        "resource_id": resource_id,
                    }
            segment_items.append(items)
            _progress(
                task, phase="manifest",
                **msg.progress_fields(
                    msg.ORCH_MSG_MANIFEST_SEGMENT, segment=segment["index"], segments=len(task["segments"]),
                ),
                segment_index=segment["index"], resource_total=len(resources), **stats,
                item_index=segment["end"] + 1, item_total=len(sentences),
            )
        # Persist the consumed virtual-read set before any slow resource work.
        orch_store.commit_run(task)
        orch_plan.save_manifest_state(task, segment_items, resolved, stats)
        orch_store.append_task_event(
            task, msg.ORCH_MSG_MANIFEST_READY,
            resources=len(resources), segments=len(task["segments"]),
        )
    else:
        # Resume: the manifest (item expansion + consumed virtual-read set) and
        # every already-resolved resource come back from disk; only segment
        # statuses merge into the fresh partition.
        previous_segments = {
            int(segment.get("index") or 0): segment for segment in (task.get("segments") or [])
        }
        task["segments"] = [
            {
                **segment,
                "status": str((previous_segments.get(int(segment["index"])) or {}).get("status") or "pending"),
                "output": (previous_segments.get(int(segment["index"])) or {}).get("output"),
                "error": (previous_segments.get(int(segment["index"])) or {}).get("error"),
                "started_at": (previous_segments.get(int(segment["index"])) or {}).get("started_at"),
                "finished_at": (previous_segments.get(int(segment["index"])) or {}).get("finished_at"),
                "timeline": (previous_segments.get(int(segment["index"])) or {}).get("timeline") or [],
                "duration_ms": (previous_segments.get(int(segment["index"])) or {}).get("duration_ms"),
                "video_status": (previous_segments.get(int(segment["index"])) or {}).get("video_status"),
                "video_output": (previous_segments.get(int(segment["index"])) or {}).get("video_output"),
                "video_error": (previous_segments.get(int(segment["index"])) or {}).get("video_error"),
            }
            for segment in partitioned
        ]
        task["cancel_requested"] = False
        task["status"] = "generating"
        if resume_state["generation_id"]:
            task["generation_id"] = resume_state["generation_id"]
        segment_items = resume_state["segment_items"]
        resolved = resume_state["resolved"]
        stats = {**default_stats, **resume_state["stats"]}
        resource_meta = dict(resume_state["resource_meta"])
        resources = {}
        for items in segment_items:
            for item in items:
                resource_id = str(item.get("resource_id") or "")
                if resource_id and resource_id not in resources:
                    resources[resource_id] = {
                        "kind": item["kind"],
                        "language": item["language"],
                        "text": item["text"],
                        "resource_id": resource_id,
                    }
        orch_store.commit_run(task)
        orch_store.append_task_event(
            task, msg.ORCH_MSG_RESUMING,
            resolved=len(resolved), resources=len(resources),
            segments_done=sum(1 for s in task["segments"] if s.get("status") == "done"),
            segments=len(task["segments"]),
        )

    run = _Run(
        task=task,
        stats=stats,
        ffmpeg=ffmpeg,
        staging=staging,
        output_dir=output_dir,
        gap=orch_assembly.ensure_gap_file(ffmpeg, staging),
        sentences=sentences,
        video_settings=(
            orch_video_presets.resolve_settings(str(task.get("video_preset") or ""))
            if orch_sources.wants_video(task) else None
        ),
    )
    # A segment is assembled the moment its LAST resource resolves: the waiting
    # set of each segment shrinks per resolved resource and an empty set
    # triggers the assembly, while the other segments' resources still prepare.
    segments_of_resource: Dict[str, List[int]] = {}
    waiting_resources: List[set] = []
    for position, items in enumerate(segment_items):
        ids = {str(item["resource_id"]) for item in items if item.get("resource_id")}
        waiting_resources.append({resource_id for resource_id in ids if resource_id not in resolved})
        for resource_id in ids:
            segments_of_resource.setdefault(resource_id, []).append(position)

    def _assemble_when_complete(position: int) -> None:
        segment = task["segments"][position]
        if waiting_resources[position] or segment.get("status") in ("failed", "assembling"):
            return
        if _audio_done(segment) and (run.video_settings is None or _video_done(segment) or not segment.get("timeline")):
            return
        _assemble_segment(run, segment, segment_items[position], resolved, "resources")
        orch_events.publish_task_progress(run.task)

    for position in range(len(segment_items)):
        if not waiting_resources[position]:
            _assemble_when_complete(position)
    if _cancel(task, stats):
        return

    # Phase 2: resources - local caches first in BATCH (orch_resources
    # .resolve_batch), then Laravel / local generation for the misses only;
    # newly generated clips sync back to Laravel through the durable delivery
    # outbox. On resume only the unresolved resources are touched.
    resource_list = [
        resource for resource in resources.values()
        if resource["resource_id"] not in resolved
    ]
    resource_total = len(resources)
    resource_done_base = resource_total - len(resource_list)
    last_resource_write = 0.0
    manifest_dirty = 0
    _progress(task, phase="resources", **msg.progress_fields(msg.ORCH_MSG_RESOURCE_SCAN),
              resource_index=resource_done_base, resource_total=resource_total, item_index=0, item_total=0, **stats)

    def _resource_activity(resource: Dict[str, Any], event: Dict[str, Any]) -> None:
        nonlocal last_resource_write
        code = str(event.get("stage") or "")
        params = dict(event.get("params") or {})
        if not msg.is_message_code(code):
            # An engine progress stage is not an orchestration message code.
            code, params = msg.ORCH_MSG_RESOURCE_PREPARING, {}
        persist = code not in _THROTTLED_ACTIVITY_CODES or time.monotonic() - last_resource_write >= 0.5
        if persist:
            last_resource_write = time.monotonic()
        _progress(task, phase="resources",
                  persist=persist, **msg.progress_fields(code, **params),
                  current_item=f"{resource['kind']}: {resource['text'][:60]}", **stats)

    def _resource_done(index: int, resource: Dict[str, Any], result: Dict[str, Any]) -> None:
        nonlocal last_resource_write, manifest_dirty
        source = str(result.get("source") or "missing")
        meta: Dict[str, Any] = {
            "source": source,
            "provider": str(result.get("provider") or ""),
            "synced": False,
            "sync_queued": False,
            "resolved_at": time.time(),
        }
        if result.get("status") != "ready":
            meta["error"] = str(result.get("error") or "")[:MISSING_ERROR_CHARS]
        resource_meta[resource["resource_id"]] = meta
        if result.get("status") == "ready" and result.get("audio_path"):
            resolved[resource["resource_id"]] = str(result["audio_path"])
            for position in segments_of_resource.get(resource["resource_id"], ()):
                waiting_resources[position].discard(resource["resource_id"])
            if source in ("cache", "laravel"):
                # Local clip of this Laravel server's or the cache's audio:
                # other servers get it through the cache kind's diff.
                audio_resource_ledger.record(
                    resource["kind"], resource["language"], resource["text"],
                    str(result["audio_path"]), str(result.get("provider") or source),
                )
            if source == "cache":
                stats["cache_hits"] += 1
            elif source == "laravel":
                stats["laravel_hits"] += 1
            elif result.get("delivered_by_lane"):
                # A sentence lane worker generated it from this task's Part1
                # fill and already reported it to Laravel (domain report).
                stats["generated"] += 1
                stats["synced"] += 1
                meta["synced"] = True
            else:
                stats["generated"] += 1
                # Delivery sync is durable and self-retrying; a transient
                # outbox/queue failure must never abort the whole generation.
                try:
                    sync = audio_resource_delivery.publish(
                        resource["kind"], resource["language"], resource["text"], str(result["audio_path"]),
                        str(result.get("provider") or ""),
                        group_key=str(task["generation_id"]),
                        first_namespace=laravel_endpoint_manager.delivery_namespace(base_url or ""),
                    )
                    if sync.get("queued"):
                        stats["sync_queued"] += 1
                        meta["sync_queued"] = True
                    if sync.get("already_uploaded"):
                        stats["synced"] += 1
                        meta["synced"] = True
                    elif not sync.get("queued"):
                        orch_store.append_task_event(
                            task, msg.ORCH_MSG_SYNC_PENDING,
                            text=resource["text"][:60], error=str(sync.get("error") or "queued"),
                        )
                except Exception as sync_error:  # noqa: BLE001
                    ColorPrint.yellow(f"[AudioOrch] sync deferred ({resource['text'][:40]}): {sync_error}")
                    orch_store.append_task_event(
                        task, msg.ORCH_MSG_SYNC_DEFERRED,
                        text=resource["text"][:60], error_type=type(sync_error).__name__,
                    )
        else:
            stats["missing"] += 1
            orch_store.append_task_event(
                task, msg.ORCH_MSG_RESOURCE_MISSING, kind=resource["kind"], text=resource["text"][:60],
            )
            ColorPrint.yellow(f"[AudioOrch] resource failed ({resource['kind']}: {resource['text'][:40]})")
        manifest_dirty += 1
        if manifest_dirty >= _MANIFEST_SAVE_EVERY_RESOURCES:
            manifest_dirty = 0
            orch_plan.save_manifest_state(task, segment_items, resolved, stats, resource_meta)
        if result.get("status") == "ready" and result.get("audio_path"):
            for position in segments_of_resource.get(resource["resource_id"], ()):
                _assemble_when_complete(position)
        absolute_index = resource_done_base + index
        persist = time.monotonic() - last_resource_write >= 0.5 or absolute_index == resource_total
        if persist:
            last_resource_write = time.monotonic()
        _progress(
            task, phase="resources",
            **msg.progress_fields(msg.ORCH_MSG_RESOURCES_PROGRESS, index=absolute_index, total=resource_total),
            resource_index=absolute_index, resource_total=resource_total,
            current_item=f"{resource['kind']}: {resource['text'][:60]} [{source}]",
            persist=persist,
            **stats,
        )

    orch_resources.resolve_batch(
        resource_list,
        staging,
        base_url=base_url,
        cancel_requested=lambda: _generation_jobs.cancelled(task_id),
        progress_callback=_resource_done,
        activity_callback=_resource_activity,
        owner=task_id,
    )
    orch_plan.save_manifest_state(task, segment_items, resolved, stats, resource_meta)
    if _cancel(task, stats):
        return
    orch_store.append_task_event(task, msg.ORCH_MSG_RESOURCES_READY, **_stat_params(stats))

    # Phase 3: catch-all - every segment whose resources were not all resolved
    # during phase 2 (missing items fail the segment without aborting the rest
    # of the task); segments assembled earlier, audio and video, are skipped.
    for segment, items in zip(task["segments"], segment_items):
        if _cancel(task, stats):
            return
        assembled = _assemble_segment(run, segment, items, resolved, "assemble")
        orch_events.publish_task_progress(task)
        if not assembled:
            return

    failed = [s for s in task["segments"] if s.get("status") == "failed"]
    _finish(task, "failed" if failed else "done")
    orch_store.append_task_event(
        task, msg.ORCH_MSG_GENERATION_FINISHED, status=task["status"], **_stat_params(stats),
    )
    _progress(
        task,
        phase="done",
        **(
            msg.progress_fields(msg.ORCH_MSG_SEGMENTS_FAILED, failed=len(failed), segments=len(task["segments"]))
            if failed else msg.progress_fields(msg.ORCH_MSG_DONE)
        ),
        output_dir=str(output_dir),
        **stats,
    )
    orch_delivery.enqueue_task_output(task)
    ColorPrint.green(f"[AudioOrch] task {task_id} finished: {task['status']}")


__all__ = [
    "is_running",
    "running_count",
    "running_task_ids",
    "has_resumable_state",
    "request_cancel",
    "start_generation",
    "start_video_render",
]
