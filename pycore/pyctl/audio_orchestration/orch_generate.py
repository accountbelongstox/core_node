# -*- coding: utf-8 -*-
"""
Audio generation pipeline for orchestration tasks (manifest-first).

Per task, three persisted phases:
  1. manifest  — expand the task pattern (sentence_en / sentence_zh /
                 words_new / words_all steps; per-step word policy, task-local
                 virtual read via orch_words) into ordered per-segment items
                 and the unique word/sentence resource list.
  2. resources — resolve every unique resource REUSING the existing caches
                 and engines (orch_resources.resolve_audio: pycore cache ->
                 Laravel -> local synthesis, stored back in the original cache
                 locations); newly generated clips sync to Laravel through the
                 durable delivery outbox (orch_resources.synchronize_audio).
  3. assemble  — concatenate each segment's resolved items with ffmpeg
                 (re-encode to one uniform mp3) into
                 <user data dir>/audio_orchestration/output/<task_slug>/segment_XXX.mp3.
                 Output stays local on this machine; nothing is uploaded to
                 Laravel.

Generation runs on a daemon thread per task; progress is persisted into the
task record so the UI polls it via the task routes.
"""

import hashlib
import json
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.ffmpeg.ffmpeg_runtime import ffmpeg_runtime
from pycore.pyutils.common.background_jobs import BackgroundJobs

from pycore.pyctl.audio_orchestration import orch_books, orch_resources, orch_store, orch_words

_generation_jobs = BackgroundJobs("AudioOrchGeneration")
_GAP_SECONDS = 0.6
_MANIFEST_SAVE_EVERY_RESOURCES = 1000


# --------------------------------------------------------------------------- #
# durable generation state (resume after crash / pycore restart)               #
# --------------------------------------------------------------------------- #
def _plan_signature(task: Dict[str, Any], sentence_total: int) -> str:
    """Stable fingerprint of every input that shapes the manifest. A persisted
    manifest only resumes when the signature matches; any task edit (pattern,
    segmentation, word policy, book, sentence count) forces a fresh run."""
    payload = json.dumps({
        "source_key": str((task.get("book") or {}).get("source_key") or ""),
        "segment_mode": str(task.get("segment_mode") or "count"),
        "segment_value": int(task.get("segment_value") or 1),
        "pattern": task.get("pattern") or [],
        "word_mode": str(task.get("word_mode") or "all"),
        "new_only_max_read_count": int(task.get("new_only_max_read_count") or 0),
        "word_group_id": str(task.get("word_group_id") or ""),
        "sentence_total": int(sentence_total),
    }, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _save_manifest_state(
    task: Dict[str, Any],
    segment_items: List[List[Dict[str, Any]]],
    resolved: Dict[str, str],
    stats: Dict[str, Any],
    resource_meta: Optional[Dict[str, Any]] = None,
) -> None:
    orch_store.save_manifest(str(task["task_id"]), {
        "signature": str(task.get("plan_signature") or ""),
        "generation_id": str(task.get("generation_id") or ""),
        "segment_items": segment_items,
        "resolved": resolved,
        "stats": stats,
        "resource_meta": resource_meta or {},
        "updated_at": int(time.time()),
    })


def _load_resume_state(
    task: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Reload the persisted manifest when it matches the CURRENT plan. Returns
    {segment_items, resolved, stats, resource_meta, generation_id} or None
    (fresh run)."""
    manifest = orch_store.load_manifest(str(task["task_id"]))
    if not isinstance(manifest, dict) or not manifest:
        return None
    if str(manifest.get("signature") or "") != str(task.get("plan_signature") or ""):
        return None
    segments = task.get("segments") or []
    segment_items = manifest.get("segment_items")
    if not segments or not isinstance(segment_items, list) or len(segment_items) != len(segments):
        return None
    resolved_raw = manifest.get("resolved")
    resolved = {
        str(resource_id): str(audio_path)
        for resource_id, audio_path in (resolved_raw.items() if isinstance(resolved_raw, dict) else [])
        if audio_path and Path(str(audio_path)).is_file()
    }
    stats_raw = manifest.get("stats")
    meta_raw = manifest.get("resource_meta")
    return {
        "segment_items": segment_items,
        "resolved": resolved,
        "stats": stats_raw if isinstance(stats_raw, dict) else {},
        "resource_meta": meta_raw if isinstance(meta_raw, dict) else {},
        "generation_id": str(manifest.get("generation_id") or ""),
    }


# --------------------------------------------------------------------------- #
# item plan                                                                    #
# --------------------------------------------------------------------------- #
def _sentence_lang_text(sentence: Dict[str, Any], lang: str) -> str:
    languages = sentence.get("languages") or {}
    text = str(languages.get(lang) or "").strip()
    if not text and lang == str(sentence.get("language") or ""):
        text = str(sentence.get("text") or "").strip()
    return text


def build_sentence_items(
    task: Dict[str, Any],
    sentence: Dict[str, Any],
    consume: bool,
    use_backend: bool = True,
    auth_record: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Expand the task pattern for one sentence into audio items.
    Item: {kind: word|sentence, language, text}."""
    language = str((task.get("book") or {}).get("language") or sentence.get("language") or "en")
    target_language = str((task.get("book") or {}).get("target_language") or "zh")
    items: List[Dict[str, Any]] = []
    for step in task.get("pattern") or []:
        step_type = str(step.get("type") or "")
        times = max(1, int(step.get("times") or 1))
        # Per-step word policy: "words_new"/"words_all" carry their own mode;
        # legacy "words" defers to the task-level word_mode.
        step_word_mode = {"words_new": "new_only", "words_all": "all"}.get(step_type)
        if step_type in ("words", "words_new", "words_all"):
            selected = orch_words.select_words(
                task,
                str(sentence.get("text") or ""),
                language,
                target_language,
                consume,
                use_backend=use_backend,
                auth_record=auth_record,
                word_mode=step_word_mode,
            )
            for _ in range(times):
                items.extend(
                    {"kind": "word", "language": language, "text": word}
                    for word in selected["words"]
                )
            continue
        lang = {"sentence_en": "en", "sentence_zh": "zh"}.get(step_type)
        if lang is None:
            continue
        text = _sentence_lang_text(sentence, lang)
        if not text:
            continue
        for _ in range(times):
            items.append({"kind": "sentence", "language": lang, "text": text})
    return items


def plan_task(task: Dict[str, Any], sentences: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute the segment partition + per-segment item counts WITHOUT consuming
    the virtual-read set (simulated on a copy)."""
    mode = str(task.get("segment_mode") or "count")
    value = int(task.get("segment_value") or 1)
    segments = []
    # One shared simulation across ALL segments: the virtual-read set carries
    # over segment boundaries exactly like the real generation does.
    simulated = dict(task)
    simulated["virtual_read"] = []
    simulated_auth = {"virtual_read": set()}
    for segment in orch_books.partition_sentences(sentences, mode, value):
        item_count = 0
        word_count = 0
        for index in range(segment["start"], segment["end"] + 1):
            # Relay-safe preview: local tokenization only — the per-sentence
            # backend read-state queries run later, inside background
            # generation where no relay deadline applies.
            items = build_sentence_items(simulated, sentences[index], consume=True, use_backend=False, auth_record=simulated_auth)
            item_count += len(items)
            word_count += sum(1 for item in items if item["kind"] == "word")
        segments.append({**segment, "item_count": item_count, "word_count": word_count})
    return {"segments": segments, "sentence_total": len(sentences)}


# --------------------------------------------------------------------------- #
# ffmpeg assembly                                                              #
# --------------------------------------------------------------------------- #
def _ensure_gap_file(ffmpeg: str, staging: Path) -> Optional[Path]:
    gap = staging / "gap.mp3"
    if gap.is_file() and gap.stat().st_size > 0:
        return gap
    cmd = [
        ffmpeg, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-t", f"{_GAP_SECONDS}", "-b:a", "128k", str(gap),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=60)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] gap synth failed: {exc}")
        return None
    return gap if proc.returncode == 0 and gap.is_file() else None


def _concat_segment(ffmpeg: str, gap: Optional[Path], files: List[Path], output: Path) -> Optional[str]:
    """Concatenate item files into one mp3 (re-encoded, mono 44.1kHz). Returns
    an error string or None on success."""
    list_file = output.with_suffix(".concat.txt")
    lines: List[str] = []
    for index, path in enumerate(files):
        lines.append("file '" + path.as_posix().replace("'", "'\\''") + "'")
        if gap is not None and index < len(files) - 1:
            lines.append("file '" + gap.as_posix().replace("'", "'\\''") + "'")
    try:
        list_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except OSError as exc:
        return f"concat list write failed: {exc}"
    cmd = [
        ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
        "-ar", "44100", "-ac", "1", "-b:a", "128k", str(output),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=3600)
    except Exception as exc:  # noqa: BLE001
        return f"ffmpeg launch failed: {exc}"
    if proc.returncode != 0 or not output.is_file() or output.stat().st_size == 0:
        tail = (proc.stderr or b"").decode("utf-8", "replace")[-400:]
        return f"ffmpeg concat failed: {tail or proc.returncode}"
    return None


# --------------------------------------------------------------------------- #
# background generation                                                        #
# --------------------------------------------------------------------------- #
def is_running(task_id: str) -> bool:
    return _generation_jobs.running(task_id)


def request_cancel(task_id: str) -> bool:
    task = orch_store.get_task(task_id)
    if not task:
        return False
    return _generation_jobs.cancel(task_id)


def has_resumable_state(task: Dict[str, Any]) -> bool:
    """Cheap UI-facing probe: a persisted manifest whose signature still matches
    the task's last run means a failed/interrupted task can resume instead of
    rebuilding the whole manifest."""
    if str(task.get("status") or "") not in ("failed", "generating"):
        return False
    manifest = orch_store.load_manifest(str(task.get("task_id") or ""))
    if not isinstance(manifest, dict) or not manifest.get("segment_items"):
        return False
    signature = str(task.get("plan_signature") or "")
    return bool(signature) and str(manifest.get("signature") or "") == signature


def start_generation(
    task_id: str,
    expected_user_id: Optional[int] = None,
    expected_base_url: Optional[str] = None,
    use_qy_account: Optional[bool] = None,
    word_group_id: Optional[str] = None,
    resume: Optional[bool] = None,
    force_fresh: bool = False,
) -> Dict[str, Any]:
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
        task["word_group_id"] = str(word_group_id)
        orch_store.save_task(task)
    elif not task.get("word_group_id") and auth_record.get("word_group_id"):
        # Default to the pycore-side persisted baseline selection.
        task["word_group_id"] = str(auth_record["word_group_id"])
        orch_store.save_task(task)
    if force_fresh:
        resume = False
    elif resume is None:
        # Interrupted (stale "generating" after a process restart) and failed
        # tasks resume from the persisted manifest by default; anything else
        # (draft, done) is a fresh run.
        status = str(task.get("status") or "")
        resume = status == "generating" or (status == "failed" and has_resumable_state(task))
    orch_resources.recover_deliveries()
    if not _generation_jobs.start(task_id, _run_generation, task_id, auth_record, bool(resume)):
        return {"success": False, "error": "generation already running"}
    return {"success": True, "task_id": task_id, "resumed": bool(resume)}


def _progress(task: Dict[str, Any], persist: bool = True, **fields: Any) -> None:
    progress = dict(task.get("progress") or {})
    progress.update(fields)
    task["progress"] = progress
    task["cancel_requested"] = _generation_jobs.cancelled(str(task.get("task_id") or ""))
    if persist:
        orch_store.save_task(task)


def _run_generation(task_id: str, auth_record: Dict[str, Any], resume: bool = False) -> None:
    task = orch_store.get_task(task_id)
    if not task:
        return
    try:
        _generate(task, auth_record, resume=resume)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[AudioOrch] generation crashed for {task_id}: {exc}")
        task["status"] = "failed"
        _progress(task, message=f"generation crashed: {exc}")


def _cancel(task: Dict[str, Any], stats: Dict[str, Any]) -> bool:
    if not _generation_jobs.cancelled(str(task.get("task_id") or "")):
        return False
    orch_resources.release_owner_queue(str(task.get("task_id") or ""))
    task["status"] = "draft"
    _progress(task, message="cancelled", **stats)
    return True


def _generate(task: Dict[str, Any], auth_record: Dict[str, Any], resume: bool = False) -> None:
    task_id = str(task["task_id"])
    book = task.get("book") or {}
    source_key = str(book.get("source_key") or "")
    base_url = str(auth_record.get("base_url") or "") or None
    # Regenerate = replace: start with a clean log. Resume keeps the previous
    # log so the UI still shows what the interrupted run already did.
    if not resume:
        task["events"] = []
    orch_store.append_task_event(task, f"generation {'resumed' if resume else 'started'} for book {source_key}")
    task["status"] = "generating"
    if not resume:
        task["progress"] = {}
        task["generation_id"] = uuid.uuid4().hex
    elif not task.get("generation_id"):
        task["generation_id"] = uuid.uuid4().hex
    _progress(task, phase="sync", message="syncing book sentences", current_item="")
    synced = orch_books.ensure_book_sentences(
        source_key,
        cancel_requested=lambda: _generation_jobs.cancelled(task_id),
        progress_callback=lambda state: _progress(
            task, phase="sync", message="syncing book sentences",
            item_index=state.get("fetched") or 0, item_total=state.get("total") or 0,
        ),
    )
    if _cancel(task, {}):
        return
    sentences = synced.get("sentences") if isinstance(synced, dict) else None
    if not sentences:
        task["status"] = "failed"
        orch_store.append_task_event(task, "sentence sync failed")
        _progress(task, message=f"no sentences for book {source_key}: {synced.get('error') if isinstance(synced, dict) else 'unknown'}")
        return

    binary = ffmpeg_runtime.binaries().ffmpeg
    ffmpeg = str(binary) if binary is not None else None
    if not ffmpeg:
        task["status"] = "failed"
        orch_store.append_task_event(task, "ffmpeg not found")
        _progress(task, message="ffmpeg not found")
        return

    task["plan_signature"] = _plan_signature(task, len(sentences))
    resume_state = _load_resume_state(task) if resume else None
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
        for stale in output_dir.glob("segment_*.mp3"):
            try:
                stale.unlink()
            except OSError:
                pass

        orch_words.prepare_word_states(
            task, sentences, auth_record,
            cancel_requested=lambda: _generation_jobs.cancelled(task_id),
            progress_callback=lambda index, total: _progress(
                task, phase="manifest", message="loading word read states",
                item_index=index, item_total=total, **stats,
            ),
        )
        if _cancel(task, stats):
            return

        # Phase 1: manifest — expand every segment into ordered audio items
        # (consuming the virtual-read set exactly once) and collect the unique
        # word/sentence resources the whole task needs.
        _progress(
            task, phase="manifest", message="building manifest",
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
                items.extend(build_sentence_items(task, sentences[sentence_pos], consume=True, auth_record=auth_record))
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
                message=f"manifest: segment {segment['index']}/{len(task['segments'])}",
                segment_index=segment["index"], resource_total=len(resources), **stats,
                item_index=segment["end"] + 1, item_total=len(sentences),
            )
        # Persist the consumed virtual-read set before any slow resource work.
        orch_store.save_task(task)
        _save_manifest_state(task, segment_items, resolved, stats)
        orch_store.append_task_event(
            task,
            f"manifest ready: {len(resources)} unique resources across {len(task['segments'])} segments",
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
        orch_store.save_task(task)
        orch_store.append_task_event(
            task,
            f"resuming: {len(resolved)}/{len(resources)} resources already resolved, "
            f"{sum(1 for s in task['segments'] if s.get('status') == 'done')}/{len(task['segments'])} segments done",
        )

    # Phase 2: resources — local caches first in BATCH (orch_resources
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
    _progress(task, phase="resources", message="scanning local audio caches",
              resource_index=resource_done_base, resource_total=resource_total, item_index=0, item_total=0, **stats)

    def _resource_activity(resource: Dict[str, Any], event: Dict[str, Any]) -> None:
        nonlocal last_resource_write
        message = str(event.get("stage") or event.get("status") or "preparing audio resource")
        persist = not message.startswith("scanning") or time.monotonic() - last_resource_write >= 0.5
        if persist:
            last_resource_write = time.monotonic()
        _progress(task, phase="resources",
                  message=message, persist=persist,
                  current_item=f"{resource['kind']}: {resource['text'][:60]}", **stats)

    def _resource_done(index: int, resource: Dict[str, Any], result: Dict[str, Any]) -> None:
        nonlocal last_resource_write, manifest_dirty
        source = str(result.get("source") or "missing")
        meta: Dict[str, Any] = {
            "source": source,
            "provider": str(result.get("provider") or ""),
            "synced": False,
            "sync_queued": False,
        }
        resource_meta[resource["resource_id"]] = meta
        if result.get("status") == "ready" and result.get("audio_path"):
            resolved[resource["resource_id"]] = str(result["audio_path"])
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
                    sync = orch_resources.synchronize_audio(
                        {**resource, "audio_path": result["audio_path"], "provider": result.get("provider"),
                         "generation_id": task["generation_id"]},
                        base_url,
                    )
                    if sync.get("queued"):
                        stats["sync_queued"] += 1
                        meta["sync_queued"] = True
                    if sync.get("already_uploaded"):
                        stats["synced"] += 1
                        meta["synced"] = True
                    elif not sync.get("queued"):
                        orch_store.append_task_event(
                            task,
                            f"sync pending: {resource['text'][:60]} ({sync.get('error') or 'queued'})",
                        )
                except Exception as sync_error:  # noqa: BLE001
                    orch_store.append_task_event(
                        task,
                        f"sync deferred: {resource['text'][:60]} ({sync_error})",
                    )
        else:
            stats["missing"] += 1
            orch_store.append_task_event(task, f"missing {resource['kind']}: {resource['text'][:60]}")
            ColorPrint.yellow(f"[AudioOrch] resource failed ({resource['kind']}: {resource['text'][:40]})")
        manifest_dirty += 1
        if manifest_dirty >= _MANIFEST_SAVE_EVERY_RESOURCES:
            manifest_dirty = 0
            _save_manifest_state(task, segment_items, resolved, stats, resource_meta)
        absolute_index = resource_done_base + index
        persist = time.monotonic() - last_resource_write >= 0.5 or absolute_index == resource_total
        if persist:
            last_resource_write = time.monotonic()
        _progress(
            task, phase="resources",
            message=f"resources: {absolute_index}/{resource_total}",
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
    _save_manifest_state(task, segment_items, resolved, stats, resource_meta)
    if _cancel(task, stats):
        return
    orch_store.append_task_event(
        task,
        f"resources ready (cache={stats['cache_hits']} laravel={stats['laravel_hits']} "
        f"generated={stats['generated']} synced={stats['synced']} missing={stats['missing']})",
    )

    # Phase 3: assemble — concat each segment's resolved items in pattern
    # order; segments whose every item is missing fail without aborting the
    # rest of the task. Resumed runs skip segments already assembled.
    gap = _ensure_gap_file(ffmpeg, staging)
    for segment, items in zip(task["segments"], segment_items):
        if _cancel(task, stats):
            return
        if (
            segment.get("status") == "done"
            and segment.get("output")
            and Path(str(segment["output"])).is_file()
        ):
            continue
        files = [
            Path(resolved[item["resource_id"]])
            for item in items
            if item.get("resource_id") in resolved
        ]
        if not files:
            segment["status"] = "failed"
            segment["error"] = "no audio items resolved"
            orch_store.append_task_event(task, f"segment {segment['index']}: no audio items resolved")
            orch_store.save_task(task)
            continue
        if len(files) != len(items):
            segment["status"] = "failed"
            segment["error"] = f"missing {len(items) - len(files)} of {len(items)} audio items"
            orch_store.append_task_event(task, f"segment {segment['index']}: {segment['error']}")
            orch_store.save_task(task)
            continue
        segment["status"] = "assembling"
        _progress(
            task, phase="assemble",
            message=f"segment {segment['index']}: assembling {len(files)} items",
            segment_index=segment["index"], item_index=0, item_total=len(files), **stats,
        )
        output = output_dir / f"segment_{segment['index']:03d}.mp3"
        error = _concat_segment(ffmpeg, gap, files, output)
        if _cancel(task, stats):
            return
        if error:
            segment["status"] = "failed"
            segment["error"] = error
            orch_store.append_task_event(task, f"segment {segment['index']}: concat failed: {error[:120]}")
        else:
            segment["status"] = "done"
            segment["output"] = str(output)
            orch_store.append_task_event(task, f"segment {segment['index']}: done -> {output.name}")
        orch_store.save_task(task)

    failed = [s for s in task["segments"] if s.get("status") == "failed"]
    task["status"] = "failed" if failed else "done"
    orch_store.append_task_event(
        task,
        f"generation finished: {task['status']} "
        f"(cache={stats['cache_hits']} laravel={stats['laravel_hits']} "
        f"generated={stats['generated']} synced={stats['synced']} missing={stats['missing']})",
    )
    _progress(
        task,
        phase="done",
        message="done" if task["status"] == "done" else "all segments failed",
        output_dir=str(output_dir),
        **stats,
    )
    ColorPrint.green(f"[AudioOrch] task {task_id} finished: {task['status']}")


__all__ = [
    "build_sentence_items",
    "plan_task",
    "is_running",
    "has_resumable_state",
    "request_cancel",
    "start_generation",
]
