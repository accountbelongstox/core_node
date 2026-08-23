# -*- coding: utf-8 -*-
"""Agent History resource-driven video orchestration."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import textwrap
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from pycore.pyfoundations.serialized_worker import map_bus_tasks
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.agent_history import article_records
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.media_processing.media_processor import media_processor
from pycore.pyutils.common.ffmpeg.ffmpeg_constants import DEFAULT_MOBILE_VIDEO_RESOLUTION
from pycore.pyutils.common.ffmpeg.ffmpeg_models import TimedTextCue, TimedTextMotion, TimedTextStyle
from pycore.pyutils.tts import word_audio_cache
from pycore.pyctl.agent_history.pipeline.config import get_config
from pycore.pyctl.tts.word_audio_service import word_audio_media

VIDEO_CONTRACT = "agent-history-video-v1"
VIDEO_DEFAULT_CONCURRENCY = 2
VIDEO_RESOURCE_ROUTE = "/api/app_qy_v1/user/agent-history/{article_id}/video-resources.json"
VIDEO_RESOLUTION = DEFAULT_MOBILE_VIDEO_RESOLUTION
VIDEO_SAMPLE_RATE = 48000
VIDEO_CHANNELS = 2
VIDEO_PROGRESS = {
    "pending": 0.0,
    "requesting_resources": 0.1,
    "waiting_resources": 0.2,
    "resource_ready": 0.25,
    "media_ready": 0.4,
    "plan_ready": 0.6,
    "audio_ready": 0.75,
    "rendering": 0.85,
    "completed": 1.0,
    "failed": 0.0,
}


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_text(path: Path, content: str) -> Path:
    temporary = path.with_name(f"{path.name}.partial")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temporary, path)
    return path


def _atomic_json(path: Path, payload: Any) -> Path:
    return _atomic_text(path, json.dumps(payload, ensure_ascii=False, indent=2))


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None
    return payload if isinstance(payload, dict) else None


def _job_id(record_id: str, username: str, batch_name: str) -> str:
    identity = f"{VIDEO_CONTRACT}\0{record_id}\0{username}\0{batch_name}"
    return "video-" + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:40]


def _update_job(job: Dict[str, Any], status: str, **patch: Any) -> Dict[str, Any]:
    updated = dict(job)
    events = [item for item in (updated.get("events") or []) if isinstance(item, dict)]
    steps = dict(updated.get("steps") or {})
    event_payload = {
        key: value
        for key, value in patch.items()
        if key not in ("traceback",) and value is not None
    }
    event_identity = json.dumps(
        {"status": status, "payload": event_payload},
        ensure_ascii=False,
        sort_keys=True,
    )
    last_identity = str(events[-1].get("identity") or "") if events else ""
    timestamp = _timestamp()
    updated.update(patch)
    updated["status"] = status
    updated["progress"] = float(VIDEO_PROGRESS.get(status, 0.0))
    updated["updated_at"] = timestamp
    steps[status] = {
        "status": status,
        "progress": updated["progress"],
        "updated_at": timestamp,
        **event_payload,
    }
    if event_identity != last_identity:
        events.append({
            "sequence": len(events) + 1,
            "identity": event_identity,
            "status": status,
            "progress": updated["progress"],
            "created_at": timestamp,
            "payload": event_payload,
            "error": patch.get("error"),
            "traceback": patch.get("traceback"),
        })
    updated["steps"] = steps
    updated["events"] = events[-200:]
    article_records.mark_video_job(str(updated["record_id"]), updated)
    THREAD_BUS.trigger_event(BusSignals.AGENT_HISTORY_VIDEO_CHANGED, {
        "job_id": str(updated.get("id") or ""),
        "record_id": str(updated.get("record_id") or ""),
        "status": status,
        "progress": updated["progress"],
        "updated_at": timestamp,
    })
    return updated


def _resource_for_job(record: Dict[str, Any], job: Dict[str, Any], directory: Path) -> Dict[str, Any]:
    path = directory / "resource.json"
    cached = _read_json(path)
    response = None
    payload = None
    endpoint = ""
    base = ""
    if cached is not None:
        return cached
    endpoint = VIDEO_RESOURCE_ROUTE.format(
        article_id=quote(str(record.get("laravel_article_id") or ""), safe=""),
    )
    base = laravel_endpoint_manager.resolve() or ""
    if not base:
        raise RuntimeError("Laravel endpoint is not configured")
    response = laravel_client.get(
        endpoint,
        base_url=base,
        params={
            "username": job["username"],
            "batch_name": job["batch_name"],
            "request_key": job["id"],
        },
        timeout=60,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Video resource request failed with HTTP {response.status_code}")
    payload = response.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("resources"), dict):
        raise RuntimeError("Video resource response is invalid")
    _atomic_json(path, payload)
    return payload


def _translation_text(row: Dict[str, Any]) -> str:
    values: List[str] = []
    translations = row.get("translations")
    direct = row.get("translation")
    if isinstance(direct, str) and direct.strip():
        values.append(direct.strip())
    if isinstance(translations, list):
        for item in translations:
            if isinstance(item, str) and item.strip():
                values.append(item.strip())
            elif isinstance(item, dict):
                for key in ("translation", "text", "meaning", "value"):
                    value = item.get(key)
                    if isinstance(value, str) and value.strip():
                        values.append(value.strip())
                        break
    return " · ".join(dict.fromkeys(values))


def _word_sources(resource: Dict[str, Any], job: Dict[str, Any]) -> Optional[Dict[str, Path]]:
    resources = resource.get("resources") or {}
    playback = resources.get("playback_items") or []
    sources: Dict[str, Path] = {}
    response = None
    content = b""
    word = ""
    for item in playback:
        if not isinstance(item, dict) or item.get("type") != "word":
            continue
        word = str(item.get("text") or "").strip()
        if not word or word in sources:
            continue
        cached = word_audio_cache.find_cached(word, "en")
        if cached is not None:
            sources[word] = cached
            continue
        response = word_audio_media(word, "en")
        if not isinstance(response, dict) or not response.get("success") or not response.get("content_base64"):
            _update_job(job, "waiting_resources", error=None, waiting_word=word)
            return None
        content = base64.b64decode(str(response["content_base64"]))
        sources[word] = word_audio_cache.store_bytes(word, "en", "laravel", content)
    return sources


def _normalized_clip(source: Path, rate: float, output: Path) -> Optional[Path]:
    result = media_processor.normalize_audio(
        source,
        output,
        rate=rate,
        sample_rate=VIDEO_SAMPLE_RATE,
        channels=VIDEO_CHANNELS,
    )
    return result.output_path if result.success else None


def _build_plan(
    record: Dict[str, Any],
    resource: Dict[str, Any],
    word_sources: Dict[str, Path],
    directory: Path,
) -> Optional[List[Dict[str, Any]]]:
    resources = resource.get("resources") or {}
    settings = resource.get("settings") or {}
    playback = [item for item in (resources.get("playback_items") or []) if isinstance(item, dict)]
    selected = [item for item in (resources.get("selected_words") or []) if isinstance(item, dict)]
    translations = {str(item.get("word") or "").lower(): _translation_text(item) for item in selected}
    word_items = [item for item in playback if item.get("type") == "word"]
    article_items = [
        item for item in playback
        if item.get("type") == "sentence" and str(item.get("language") or "en") == "en"
    ]
    article_source = article_records.audio_path(str(record.get("id") or ""))
    source = None
    rate = 1.0
    word = ""
    normalized = None
    probe = None
    cursor = 0.0
    plan: List[Dict[str, Any]] = []
    cache: Dict[str, Path] = {}
    items = word_items + (article_items or [{
        "type": "sentence",
        "language": "en",
        "rate": settings.get("sentenceRate") or 1.0,
        "text": record.get("article_en") or "",
    }])
    if article_source is None:
        return None
    clips_directory = directory / "clips"
    clips_directory.mkdir(parents=True, exist_ok=True)
    for index, item in enumerate(items):
        word = str(item.get("text") or "").strip()
        source = word_sources.get(word) if item.get("type") == "word" else article_source
        rate = max(0.25, min(4.0, float(item.get("rate") or 1.0)))
        if source is None:
            return None
        cache_key = f"{source.resolve()}\0{rate:.6f}"
        normalized = cache.get(cache_key)
        if normalized is None:
            normalized = _normalized_clip(source, rate, clips_directory / f"clip-{index:04d}.m4a")
            if normalized is None:
                return None
            cache[cache_key] = normalized
        probe = media_processor.probe(normalized)
        if not probe.success or probe.duration <= 0:
            return None
        plan.append({
            "type": str(item.get("type") or "sentence"),
            "text": word if item.get("type") == "word" else str(record.get("article_en") or word),
            "translation": translations.get(word.lower(), "") if item.get("type") == "word" else str(record.get("reference_cn") or ""),
            "clip": str(normalized),
            "rate": rate,
            "start": cursor,
            "end": cursor + probe.duration,
        })
        cursor += probe.duration
    _atomic_json(directory / "plan.json", {"contract": VIDEO_CONTRACT, "items": plan})
    return plan


def _concat_plan(plan: List[Dict[str, Any]], directory: Path) -> Optional[Path]:
    manifest = directory / "timeline.ffconcat"
    audio = directory / "timeline.m4a"
    lines = ["ffconcat version 1.0"]
    for item in plan:
        lines.append(f"file '{Path(str(item['clip'])).resolve().as_posix()}'")
    _atomic_text(manifest, "\n".join(lines) + "\n")
    result = media_processor.concat_audio(
        manifest,
        audio,
        sample_rate=VIDEO_SAMPLE_RATE,
        channels=VIDEO_CHANNELS,
    )
    return result.output_path if result.success else None


def _wrapped_text(english: str, chinese: str) -> str:
    english_lines = textwrap.wrap(" ".join(english.split()), width=34) or [""]
    chinese_text = "".join(chinese.split())
    chinese_lines = [chinese_text[index:index + 18] for index in range(0, len(chinese_text), 18)]
    return "\n".join([*english_lines, "", *chinese_lines]).strip()


def _timed_text(plan: List[Dict[str, Any]]) -> List[TimedTextCue]:
    width, height = VIDEO_RESOLUTION
    cues: List[TimedTextCue] = []
    text = ""
    line_count = 0
    duration_ms = 0
    for item in plan:
        if item["type"] == "word":
            text = str(item.get("text") or "")
            translation = str(item.get("translation") or "")
            cues.append(TimedTextCue(
                start=float(item["start"]),
                end=float(item["end"]),
                text=text + (("\n\n" + translation) if translation else ""),
                style=TimedTextStyle(
                    font_name="Noto Sans CJK SC",
                    font_size=74,
                    bold=True,
                    alignment=5,
                    position=(width // 2, height // 2),
                    margin_left=90,
                    margin_right=90,
                ),
            ))
            continue
        text = _wrapped_text(str(item.get("text") or ""), str(item.get("translation") or ""))
        line_count = max(1, len(text.splitlines()))
        duration_ms = max(1, int((float(item["end"]) - float(item["start"])) * 1000))
        cues.append(TimedTextCue(
            start=float(item["start"]),
            end=float(item["end"]),
            text=text,
            style=TimedTextStyle(
                font_name="Noto Sans CJK SC",
                font_size=48,
                alignment=7,
                margin_left=72,
                margin_right=72,
                margin_vertical=0,
            ),
            motion=TimedTextMotion(
                start=(72, height),
                end=(72, -(line_count * 64)),
                start_ms=0,
                end_ms=duration_ms,
            ),
        ))
    return cues


def _generate_video_steps(record: Dict[str, Any]) -> Dict[str, Any]:
    config = get_config()
    record_id = str(record.get("id") or "")
    username = str(config.get("video_username") or "").strip()
    batch_name = str(config.get("video_batch_name") or "default").strip() or "default"
    job_id = _job_id(record_id, username, batch_name)
    directory = article_records.video_job_dir(job_id)
    job = article_records.load_video_job(job_id) or {
        "id": job_id,
        "contract": VIDEO_CONTRACT,
        "record_id": record_id,
        "article_id": str(record.get("laravel_article_id") or ""),
        "username": username,
        "batch_name": batch_name,
        "created_at": _timestamp(),
    }
    resource = None
    word_sources = None
    plan = None
    audio = None
    video = directory / "video.mp4"
    result = None
    job = _update_job(job, "requesting_resources", error=None)
    resource = _resource_for_job(record, job, directory)
    job = _update_job(job, "resource_ready", resource_file="resource.json")
    word_sources = _word_sources(resource, job)
    if word_sources is None:
        return article_records.load_video_job(job_id) or job
    job = _update_job(job, "media_ready", waiting_word=None)
    plan = _build_plan(record, resource, word_sources, directory)
    if not plan:
        return _update_job(job, "failed", error="Playback plan could not be materialized")
    job = _update_job(job, "plan_ready", plan_file="plan.json")
    audio = _concat_plan(plan, directory)
    if audio is None:
        return _update_job(job, "failed", error="Playback audio could not be composed")
    job = _update_job(job, "audio_ready", audio_file="timeline.m4a")
    job = _update_job(job, "rendering", error=None)
    result = media_processor.compose_progress_text_video(
        audio,
        video,
        timed_text=_timed_text(plan),
        resolution=VIDEO_RESOLUTION,
        background_color="#10131A",
        quality=23,
    )
    if not result.success:
        return _update_job(job, "failed", error=str(result.error_code or "Video rendering failed"))
    duration = media_processor.duration(video)
    job = _update_job(
        job,
        "completed",
        error=None,
        video_file="video.mp4",
        duration=duration,
        completed_at=_timestamp(),
    )
    THREAD_BUS.trigger_event(BusSignals.ARTICLE_PUBLISHED, {"record_id": record_id, "video": True})
    return job


def generate_video(record: Dict[str, Any]) -> Dict[str, Any]:
    config = get_config()
    record_id = str(record.get("id") or "")
    username = str(config.get("video_username") or "").strip()
    batch_name = str(config.get("video_batch_name") or "default").strip() or "default"
    job_id = _job_id(record_id, username, batch_name)
    job = article_records.load_video_job(job_id) or {
        "id": job_id,
        "contract": VIDEO_CONTRACT,
        "record_id": record_id,
        "article_id": str(record.get("laravel_article_id") or ""),
        "username": username,
        "batch_name": batch_name,
        "created_at": _timestamp(),
    }
    try:
        return _generate_video_steps(record)
    except Exception as exc:
        current = article_records.load_video_job(job_id) or job
        return _update_job(
            current,
            "failed",
            error=str(exc),
            traceback=traceback.format_exc(),
        )


def tick_video() -> Dict[str, Any]:
    config = get_config()
    username = str(config.get("video_username") or "").strip()
    batch_name = str(config.get("video_batch_name") or "default").strip() or "default"
    concurrency = max(1, min(4, int(config.get("video_concurrency") or VIDEO_DEFAULT_CONCURRENCY)))
    candidates = []
    current_job_id = ""
    for record in article_records.list_all_records():
        if not bool(record.get("uploaded")) or not bool(record.get("tts_chunked")):
            continue
        if not record.get("laravel_article_id") or article_records.audio_path(str(record.get("id") or "")) is None:
            continue
        current_job_id = _job_id(str(record.get("id") or ""), username, batch_name)
        if str(record.get("video_job_id") or "") == current_job_id and str(record.get("video_status") or "") == "completed":
            continue
        candidates.append(record)
    selected = candidates[:concurrency]
    results = map_bus_tasks(
        generate_video,
        selected,
        max_workers=concurrency,
        thread_prefix="AgentHistoryVideo",
    ) if username and selected else []
    return {"eligible": len(candidates), "started": len(selected), "completed": len(results)}


__all__ = ["tick_video", "generate_video"]
