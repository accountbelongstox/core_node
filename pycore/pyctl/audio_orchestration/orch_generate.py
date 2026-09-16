# -*- coding: utf-8 -*-
"""
Audio generation pipeline for orchestration tasks.

Per task, per segment:
  1. Build the item plan from the task pattern (sentence_en / sentence_zh /
     words steps). Word steps honor word_mode + the task's virtual-read set
     (orch_words) — a word shown once is consumed and never repeats later.
  2. Resolve every item to a local audio file REUSING the existing caches and
     engines — nothing is cached in a new location:
       words     -> word_audio_cache.find_cached
                    -> Laravel word media (word_audio_service.word_audio_media)
                    -> edge-tts (word_audio_service.edge_synth)
                    (results stored back via word_audio_cache.store_bytes)
       sentences -> tts_orchestrator.synthesize (sentence profile: the shared
                    sentence_audio_cache lookup/store and the qwen-first engine
                    priority are built into it)
  3. Concatenate with ffmpeg (re-encode to one uniform mp3) into
     <user data dir>/audio_orchestration/output/<task_slug>/segment_XXX.mp3.
     Output stays local on this machine; nothing is uploaded to Laravel.

Generation runs on a daemon thread per task; progress is persisted into the
task record so the UI polls it via the task routes.
"""

import base64
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.tts import word_audio_service
from pycore.pyutils.media_processing.ffmpeg_ops import resolve_ffmpeg
from pycore.pyutils.tts import word_audio_cache
from pycore.pyutils.tts.tts_orchestrator import synthesize

from pycore.pyctl.audio_orchestration import orch_books, orch_store, orch_words

_GEN_THREADS: Dict[str, threading.Thread] = {}
_GEN_LOCK = threading.Lock()
_GAP_SECONDS = 0.6
_WORD_PROVIDERS = ("laravel", "edge")


# --------------------------------------------------------------------------- #
# single-item audio resolution                                                 #
# --------------------------------------------------------------------------- #
def ensure_word_audio(word: str, language: str) -> Optional[Path]:
    """Resolve one word pronunciation file: local cache -> Laravel -> edge-tts.
    Freshly obtained clips are stored into the EXISTING word audio cache."""
    word = (word or "").strip().lower()
    if not word:
        return None
    cached = word_audio_cache.find_cached(word, language)
    if cached is not None:
        return cached
    try:
        media = word_audio_service.word_audio_media(word, language)
        if media.get("success") and media.get("content_base64"):
            raw = base64.b64decode(media["content_base64"])
            if raw:
                return word_audio_cache.store_bytes(word, language, "laravel", raw)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] laravel word media failed for '{word}': {exc}")
    try:
        synth = word_audio_service.edge_synth(word, language)
        if synth.get("success") and synth.get("audio_base64"):
            raw = base64.b64decode(synth["audio_base64"])
            if raw:
                return word_audio_cache.store_bytes(word, language, "edge", raw)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] edge synth failed for '{word}': {exc}")
    return None


def ensure_sentence_audio(text: str, language: str, output_path: Path) -> bool:
    """Synthesize one sentence into ``output_path`` via the shared orchestrator
    (sentence cache lookup/store + engine priority are internal to it)."""
    text = (text or "").strip()
    if not text:
        return False
    try:
        result = synthesize(
            text,
            language,
            Path(output_path),
            priority_profile="sentence",
        )
        return bool(result.get("success"))
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] sentence synth failed: {exc}")
        return False


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
) -> List[Dict[str, Any]]:
    """Expand the task pattern for one sentence into audio items.
    Item: {kind: word|sentence, language, text}."""
    language = str((task.get("book") or {}).get("language") or sentence.get("language") or "en")
    target_language = str((task.get("book") or {}).get("target_language") or "zh")
    items: List[Dict[str, Any]] = []
    for step in task.get("pattern") or []:
        step_type = str(step.get("type") or "")
        times = max(1, int(step.get("times") or 1))
        if step_type == "words":
            selected = orch_words.select_words(
                task,
                str(sentence.get("text") or ""),
                language,
                target_language,
                consume,
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
            items = build_sentence_items(simulated, sentences[index], consume=True)
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
    task["cancel_requested"] = True
    orch_store.save_task(task)
    return True


def start_generation(task_id: str) -> Dict[str, Any]:
    task = orch_store.get_task(task_id)
    if not task:
        return {"success": False, "error": "task not found"}
    if is_running(task_id):
        return {"success": False, "error": "generation already running"}
    thread = threading.Thread(
        target=_run_generation,
        args=(task_id,),
        name=f"audio-orch-{task_id}",
        daemon=True,
    )
    with _GEN_LOCK:
        _GEN_THREADS[task_id] = thread
    thread.start()
    return {"success": True, "task_id": task_id}


def _progress(task: Dict[str, Any], **fields: Any) -> None:
    progress = dict(task.get("progress") or {})
    progress.update(fields)
    task["progress"] = progress
    orch_store.save_task(task)


def _run_generation(task_id: str) -> None:
    task = orch_store.get_task(task_id)
    if not task:
        return
    try:
        _generate(task)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[AudioOrch] generation crashed for {task_id}: {exc}")
        task["status"] = "failed"
        _progress(task, message=f"generation crashed: {exc}")


def _generate(task: Dict[str, Any]) -> None:
    task_id = str(task["task_id"])
    book = task.get("book") or {}
    source_key = str(book.get("source_key") or "")
    synced = orch_books.sync_book_sentences(source_key)
    sentences = synced.get("sentences") if isinstance(synced, dict) else None
    if not sentences:
        task["status"] = "failed"
        _progress(task, message=f"no sentences for book {source_key}: {synced.get('error') if isinstance(synced, dict) else 'unknown'}")
        return

    ffmpeg = resolve_ffmpeg()
    if not ffmpeg:
        task["status"] = "failed"
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
    _progress(task, message="starting", segment_index=0, item_index=0, item_total=0)

    output_dir = orch_store.output_dir_for(task)
    staging = output_dir / "staging"
    staging.mkdir(parents=True, exist_ok=True)
    gap = _ensure_gap_file(ffmpeg, staging)

    for segment in task["segments"]:
        if task.get("cancel_requested"):
            task["status"] = "draft"
            _progress(task, message="cancelled")
            return
        segment["status"] = "preparing"
        _progress(task, message=f"segment {segment['index']}: preparing", segment_index=segment["index"])
        files: List[Path] = []
        item_index = 0
        segment_items: List[Dict[str, Any]] = []
        for sentence_pos in range(segment["start"], segment["end"] + 1):
            segment_items.extend(build_sentence_items(task, sentences[sentence_pos], consume=True))
        orch_store.save_task(task)
        item_total = len(segment_items)
        for item in segment_items:
            if task.get("cancel_requested"):
                task["status"] = "draft"
                _progress(task, message="cancelled")
                return
            item_index += 1
            target = staging / f"s{segment['index']:03d}_{item_index:05d}.mp3"
            ok = False
            if item["kind"] == "word":
                word_path = ensure_word_audio(item["text"], item["language"])
                if word_path is not None:
                    files.append(word_path)
                    ok = True
            else:
                ok = ensure_sentence_audio(item["text"], item["language"], target)
                if ok:
                    files.append(target)
            if not ok:
                ColorPrint.yellow(
                    f"[AudioOrch] item failed ({item['kind']}: {item['text'][:40]})"
                )
            if item_index % 5 == 0 or item_index == item_total:
                _progress(
                    task,
                    message=f"segment {segment['index']}: item {item_index}/{item_total}",
                    segment_index=segment["index"],
                    item_index=item_index,
                    item_total=item_total,
                )
        if not files:
            segment["status"] = "failed"
            segment["error"] = "no audio items resolved"
            orch_store.save_task(task)
            continue
        segment["status"] = "assembling"
        _progress(task, message=f"segment {segment['index']}: assembling", segment_index=segment["index"])
        output = output_dir / f"segment_{segment['index']:03d}.mp3"
        error = _concat_segment(ffmpeg, gap, files, output)
        if error:
            segment["status"] = "failed"
            segment["error"] = error
        else:
            segment["status"] = "done"
            segment["output"] = str(output)
        orch_store.save_task(task)

    failed = [s for s in task["segments"] if s.get("status") == "failed"]
    task["status"] = "failed" if len(failed) == len(task["segments"]) else "done"
    _progress(
        task,
        message="done" if task["status"] == "done" else "all segments failed",
        output_dir=str(output_dir),
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
