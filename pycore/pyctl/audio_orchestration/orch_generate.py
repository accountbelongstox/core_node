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

import base64
import os
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyctl.tts import word_audio_service
from pycore.pyutils.common.ffmpeg.ffmpeg_runtime import ffmpeg_runtime
from pycore.pyutils.tts import word_audio_cache
from pycore.pyutils.tts.tts_orchestrator import synthesize

from pycore.pyctl.audio_orchestration import orch_books, orch_resources, orch_store, orch_words

_GEN_THREADS: Dict[str, threading.Thread] = {}
_GEN_LOCK = threading.Lock()
_CANCEL_REQUESTS: set[str] = set()
_GAP_SECONDS = 0.6


# --------------------------------------------------------------------------- #
# single-item audio resolution                                                 #
# --------------------------------------------------------------------------- #
def ensure_word_audio(word: str, language: str) -> Tuple[Optional[Path], str]:
    """Resolve one word pronunciation file: local cache -> Laravel -> local
    synthesis. Returns (path, source) where source is "cache" | "laravel" |
    the synthesis engine name; (None, "missing") on failure. Freshly obtained
    clips are stored into the EXISTING word audio cache."""
    word = (word or "").strip().lower()
    if not word:
        return None, "missing"
    cached = word_audio_cache.find_cached(word, language)
    if cached is not None:
        return cached, "cache"
    try:
        media = word_audio_service.word_audio_media(word, language)
        if media.get("success") and media.get("content_base64"):
            raw = base64.b64decode(media["content_base64"])
            if raw:
                return word_audio_cache.store_bytes(word, language, "laravel", raw), "laravel"
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] laravel word media failed for '{word}': {exc}")
    # Local synthesis goes through the SHARED orchestrator word profile so the
    # edge cooldown + local-engine fallback + recovery probe all apply (never
    # qwen — the word profile excludes it; qwen stays sentence-only).
    tmp_path: Optional[Path] = None
    try:
        fd, tmp_name = tempfile.mkstemp(suffix=".mp3", dir=str(TMP_DIR))
        os.close(fd)
        tmp_path = Path(tmp_name)
        result = synthesize(word, language, tmp_path, priority_profile="word")
        if result.get("success") and tmp_path.exists() and tmp_path.stat().st_size > 0:
            provider = str(result.get("engine") or "edge")
            return word_audio_cache.store_bytes(word, language, provider, tmp_path.read_bytes()), provider
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] local word synth failed for '{word}': {exc}")
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink()
            except OSError:
                pass
    return None, "missing"


def ensure_sentence_audio(text: str, language: str, output_path: Path) -> Tuple[bool, str]:
    """Synthesize one sentence into ``output_path`` via the shared orchestrator
    (sentence cache lookup/store + engine priority are internal to it).
    Returns (ok, source): "cache" | engine name | "missing"."""
    text = (text or "").strip()
    if not text:
        return False, "missing"
    try:
        result = synthesize(
            text,
            language,
            Path(output_path),
            priority_profile="sentence",
        )
        if result.get("success"):
            source = "cache" if result.get("cached") else str(result.get("engine") or "generated")
            return True, source
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] sentence synth failed: {exc}")
    return False, "missing"


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
    simulated["virtual_read"] = list(task.get("virtual_read") or [])
    for segment in orch_books.partition_sentences(sentences, mode, value):
        item_count = 0
        word_count = 0
        for index in range(segment["start"], segment["end"] + 1):
            # Relay-safe preview: local tokenization only — the per-sentence
            # backend read-state queries run later, inside background
            # generation where no relay deadline applies.
            items = build_sentence_items(simulated, sentences[index], consume=True, use_backend=False)
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
        lines.append(f"file '{path.as_posix()}'")
        if gap is not None and index < len(files) - 1:
            lines.append(f"file '{gap.as_posix()}'")
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
    with _GEN_LOCK:
        thread = _GEN_THREADS.get(task_id)
        return bool(thread and thread.is_alive())


def request_cancel(task_id: str) -> bool:
    task = orch_store.get_task(task_id)
    if not task:
        return False
    _CANCEL_REQUESTS.add(task_id)
    task["cancel_requested"] = True
    orch_store.save_task(task)
    return True


def start_generation(
    task_id: str,
    expected_user_id: Optional[int] = None,
    expected_base_url: Optional[str] = None,
    use_qy_account: Optional[bool] = None,
    word_group_id: Optional[str] = None,
) -> Dict[str, Any]:
    task = orch_store.get_task(task_id)
    auth_record = {} if use_qy_account is False else orch_store.load_auth() or {}
    if not task:
        return {"success": False, "error": "task not found"}
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
    orch_resources.recover_deliveries()
    thread = threading.Thread(
        target=_run_generation,
        args=(task_id, auth_record),
        name=f"audio-orch-{task_id}",
        daemon=True,
    )
    with _GEN_LOCK:
        current = _GEN_THREADS.get(task_id)
        if current and current.is_alive():
            return {"success": False, "error": "generation already running"}
        _CANCEL_REQUESTS.discard(task_id)
        _GEN_THREADS[task_id] = thread
        thread.start()
    return {"success": True, "task_id": task_id}


def _progress(task: Dict[str, Any], **fields: Any) -> None:
    progress = dict(task.get("progress") or {})
    progress.update(fields)
    task["progress"] = progress
    task["cancel_requested"] = str(task.get("task_id") or "") in _CANCEL_REQUESTS
    orch_store.save_task(task)


def _run_generation(task_id: str, auth_record: Dict[str, Any]) -> None:
    task = orch_store.get_task(task_id)
    if not task:
        return
    try:
        _generate(task, auth_record)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[AudioOrch] generation crashed for {task_id}: {exc}")
        task["status"] = "failed"
        _progress(task, message=f"generation crashed: {exc}")
    finally:
        _CANCEL_REQUESTS.discard(task_id)


def _cancel(task: Dict[str, Any], stats: Dict[str, Any]) -> bool:
    if str(task.get("task_id") or "") not in _CANCEL_REQUESTS:
        return False
    task["status"] = "draft"
    _progress(task, message="cancelled", **stats)
    return True


def _generate(task: Dict[str, Any], auth_record: Dict[str, Any]) -> None:
    task_id = str(task["task_id"])
    book = task.get("book") or {}
    source_key = str(book.get("source_key") or "")
    base_url = str(auth_record.get("base_url") or "") or None
    # Regenerate = replace: start with a clean log (stale segment files are
    # removed below, before the new partition is assembled).
    task["events"] = []
    orch_store.append_task_event(task, f"generation started for book {source_key}")
    synced = orch_books.ensure_book_sentences(source_key)
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

    segments = orch_books.partition_sentences(
        sentences,
        str(task.get("segment_mode") or "count"),
        int(task.get("segment_value") or 1),
    )
    task["segments"] = [
        {**segment, "status": "pending", "output": None, "error": None}
        for segment in segments
    ]
    task["virtual_read"] = []
    task["cancel_requested"] = False
    task["status"] = "generating"

    output_dir = orch_store.output_dir_for(task)
    # Regenerate = replace: drop stale segment files from the previous run so
    # the directory only ever holds the CURRENT plan's output.
    for stale in output_dir.glob("segment_*.mp3"):
        try:
            stale.unlink()
        except OSError:
            pass
    staging = output_dir / "staging"
    staging.mkdir(parents=True, exist_ok=True)

    stats = {"cache_hits": 0, "laravel_hits": 0, "generated": 0, "missing": 0, "synced": 0}

    # Phase 1: manifest — expand every segment into ordered audio items
    # (consuming the virtual-read set exactly once) and collect the unique
    # word/sentence resources the whole task needs.
    _progress(
        task, phase="manifest", message="building manifest",
        segment_index=0, resource_index=0, resource_total=0, **stats,
    )
    segment_items: List[List[Dict[str, Any]]] = []
    resources: Dict[str, Dict[str, Any]] = {}
    for segment in task["segments"]:
        if _cancel(task, stats):
            return
        items: List[Dict[str, Any]] = []
        for sentence_pos in range(segment["start"], segment["end"] + 1):
            if _cancel(task, stats):
                return
            items.extend(build_sentence_items(task, sentences[sentence_pos], consume=True, auth_record=auth_record))
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
        )
    # Persist the consumed virtual-read set before any slow resource work.
    orch_store.save_task(task)
    orch_store.append_task_event(
        task,
        f"manifest ready: {len(resources)} unique resources across {len(task['segments'])} segments",
    )

    # Phase 2: resources — local caches first in BATCH (orch_resources
    # .resolve_batch), then Laravel / local generation for the misses only;
    # newly generated clips sync back to Laravel through the durable delivery
    # outbox.
    resolved: Dict[str, str] = {}
    resource_list = list(resources.values())
    resource_total = len(resource_list)

    def _resource_done(index: int, resource: Dict[str, Any], result: Dict[str, Any]) -> None:
        source = str(result.get("source") or "missing")
        if result.get("status") == "ready" and result.get("audio_path"):
            resolved[resource["resource_id"]] = str(result["audio_path"])
            if source == "cache":
                stats["cache_hits"] += 1
            elif source == "laravel":
                stats["laravel_hits"] += 1
            else:
                stats["generated"] += 1
                sync = orch_resources.synchronize_audio(
                    {**resource, "audio_path": result["audio_path"], "provider": result.get("provider")},
                    base_url,
                )
                if sync.get("success") or sync.get("already_uploaded"):
                    stats["synced"] += 1
                else:
                    orch_store.append_task_event(
                        task,
                        f"sync pending: {resource['text'][:60]} ({sync.get('error') or 'queued'})",
                    )
        else:
            stats["missing"] += 1
            orch_store.append_task_event(task, f"missing {resource['kind']}: {resource['text'][:60]}")
            ColorPrint.yellow(f"[AudioOrch] resource failed ({resource['kind']}: {resource['text'][:40]})")
        _progress(
            task, phase="resources",
            message=f"resources: {index}/{resource_total}",
            resource_index=index, resource_total=resource_total,
            current_item=f"{resource['kind']}: {resource['text'][:60]} [{source}]",
            **stats,
        )

    orch_resources.resolve_batch(
        resource_list,
        staging,
        base_url=base_url,
        cancel_requested=lambda: task_id in _CANCEL_REQUESTS,
        progress_callback=_resource_done,
    )
    if _cancel(task, stats):
        return
    orch_store.append_task_event(
        task,
        f"resources ready (cache={stats['cache_hits']} laravel={stats['laravel_hits']} "
        f"generated={stats['generated']} synced={stats['synced']} missing={stats['missing']})",
    )

    # Phase 3: assemble — concat each segment's resolved items in pattern
    # order; segments whose every item is missing fail without aborting the
    # rest of the task.
    gap = _ensure_gap_file(ffmpeg, staging)
    for segment, items in zip(task["segments"], segment_items):
        if _cancel(task, stats):
            return
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
    task["status"] = "failed" if len(failed) == len(task["segments"]) else "done"
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
    "ensure_word_audio",
    "ensure_sentence_audio",
    "build_sentence_items",
    "plan_task",
    "is_running",
    "request_cancel",
    "start_generation",
]
