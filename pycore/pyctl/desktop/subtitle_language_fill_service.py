# -*- coding: utf-8 -*-
"""Fill sibling subtitle-language tracks for Video Extract outputs."""

import json
import os
from typing import Any, Dict, List, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.text_parsing import guess_language, normalize_language_codes
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyctl.laravel.sync.media_sync_http import (
    _discover_mappings,
    _resolve_output_dir,
)
from pycore.pyctl.laravel.sync.subtitle_payload import discover_subtitle_tracks
from pycore.pyctl.runtime.user_data_service import user_data_service
from pycore.pyctl.translation.ai_batch_translate import translate_chunk
from pycore.pyutils.media_processing.srt_utils import (
    parse_srt_segments,
    write_srt_segments,
)


TRANSLATION_CHUNK_SIZE = 40


def _publish(
    stage: str,
    done: int,
    total: int,
    detail: str,
    summary: Dict[str, Any],
) -> None:
    THREAD_BUS.trigger_event(
        BusSignals.SUBTITLE_LANGUAGE_FILL,
        {
            "stage": stage,
            "done": done,
            "total": total,
            "detail": detail,
            "summary": dict(summary),
        },
    )


def _history_paths() -> List[str]:
    history = user_data_service.get_video_extract()
    return [str(entry.path) for entry in history.entries if str(entry.path).strip()]


def _mapping_jobs(paths: List[str]) -> List[str]:
    jobs = []
    seen = set()
    for source_path in paths:
        output_dir = _resolve_output_dir(source_path)
        if not output_dir or not os.path.isdir(output_dir):
            continue
        for mapping_path in _discover_mappings(output_dir):
            key = os.path.normcase(os.path.abspath(mapping_path))
            if key in seen:
                continue
            seen.add(key)
            jobs.append(mapping_path)
    return jobs


def _srt_path(mapping_path: str) -> Tuple[str, str]:
    with open(mapping_path, "r", encoding="utf-8", errors="replace") as handle:
        mapping = json.load(handle)
    segment_dir = os.path.dirname(mapping_path)
    source_dir = os.path.dirname(segment_dir)
    stem = str(
        mapping.get("stem")
        or os.path.basename(segment_dir).replace("_segments", "")
    )
    srt_name = str((mapping.get("files") or {}).get("srt") or f"{stem}.srt")
    return stem, os.path.join(source_dir, srt_name)


def _primary_language(cues: List[Dict[str, Any]]) -> str:
    sample = " ".join(
        str(cue.get("text") or "").strip()
        for cue in cues[:50]
        if str(cue.get("text") or "").strip()
    )
    detected = normalize_language_codes([guess_language(sample)])
    return detected[0] if detected else "en"


def _track_path(primary_srt_path: str, language: str) -> str:
    directory = os.path.dirname(primary_srt_path)
    filename = os.path.splitext(os.path.basename(primary_srt_path))[0]
    parts = filename.rsplit(".", 1)
    suffix = normalize_language_codes([parts[1]]) if len(parts) == 2 else []
    stem = parts[0] if suffix else filename
    return os.path.join(directory, f"{stem}.{language}.srt")


def _translate_cues(
    cues: List[Dict[str, Any]],
    source_language: str,
    target_language: str,
) -> List[Dict[str, Any]]:
    translated_cues = [dict(cue) for cue in cues]
    source_positions = [
        index
        for index, cue in enumerate(cues)
        if str(cue.get("text") or "").strip()
    ]
    source_lines = [
        str(cues[index].get("text") or "").strip()
        for index in source_positions
    ]
    translated_lines = []
    metadata: Dict[str, Any] = {}
    for start in range(0, len(source_lines), TRANSLATION_CHUNK_SIZE):
        chunk = source_lines[start:start + TRANSLATION_CHUNK_SIZE]
        values, metadata = translate_chunk(
            chunk,
            source_language,
            target_language,
            domain="subtitle",
            source="video_extract_subtitle_fill",
            meta_out=metadata,
        )
        translated_lines.extend(values)
    if len(translated_lines) != len(source_lines):
        return []
    if any(not str(value or "").strip() for value in translated_lines):
        return []
    for position, translated in zip(source_positions, translated_lines):
        translated_cues[position]["text"] = translated
    return translated_cues


def fill(
    paths: List[str] | None,
    languages: List[str] | None,
    strategy: str = "api_first",
) -> Dict[str, Any]:
    target_paths = [str(path).strip() for path in (paths or []) if str(path).strip()]
    if not target_paths:
        target_paths = _history_paths()
    requested_languages = normalize_language_codes(languages or [])
    normalized_strategy = strategy if strategy in ("api_first", "whisper") else "api_first"
    jobs = _mapping_jobs(target_paths)
    summary = {
        "sources": len(jobs),
        "filled": 0,
        "skipped": 0,
        "failed": 0,
    }
    results = []
    _publish("scan", 0, len(jobs), f"found {len(jobs)} source(s)", summary)

    for position, mapping_path in enumerate(jobs, 1):
        stem, primary_srt_path = _srt_path(mapping_path)
        cues = parse_srt_segments(primary_srt_path)
        result = {
            "source": primary_srt_path,
            "filled": {},
            "skipped": [],
            "failed": {},
        }
        if not cues:
            result["failed"]["source"] = "primary SRT is missing or empty"
            summary["failed"] += 1
            results.append(result)
            _publish(
                "source",
                position,
                len(jobs),
                f"{stem}: primary SRT unavailable",
                summary,
            )
            continue

        primary_language = _primary_language(cues)
        selected_languages = requested_languages or [primary_language]
        existing_tracks = {
            language: track_path
            for language, track_path in discover_subtitle_tracks(primary_srt_path)
        }
        for language in selected_languages:
            if language == primary_language or language in existing_tracks:
                result["skipped"].append(language)
                summary["skipped"] += 1
                continue
            _publish(
                "translate",
                position - 1,
                len(jobs),
                f"{stem}: {primary_language} -> {language}",
                summary,
            )
            translated_cues = _translate_cues(cues, primary_language, language)
            if not translated_cues:
                result["failed"][language] = "translation returned incomplete cues"
                summary["failed"] += 1
                continue
            output_path = _track_path(primary_srt_path, language)
            result["filled"][language] = write_srt_segments(output_path, translated_cues)
            summary["filled"] += 1
            ColorPrint.blue(f"[SubtitleFill] wrote {output_path}")
        results.append(result)
        _publish("source", position, len(jobs), stem, summary)

    success = summary["failed"] == 0
    stage = "done" if success else "error"
    _publish(stage, len(jobs), len(jobs), "subtitle language fill complete", summary)
    return {
        "success": success,
        "strategy": normalized_strategy,
        "provider": "ai_fallback",
        "count": len(results),
        **summary,
        "results": results,
        "errors": [],
    }


__all__ = ["fill"]
