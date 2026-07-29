"""Shared TTS synthesis and global-task audio lane handler."""

import base64
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.system_paths import get_edge_tts_voice_cache_dir
import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator


def synthesize_word_audio(
    text: str,
    language: str,
    accent: Optional[str] = None,
    gender: Optional[str] = None,
    priority_profile: str = "word",
) -> Tuple[str, str, str, Dict[str, Any]]:
    """Synthesize text and return base64 MP3, engine, accent and metadata."""
    voice_dir = get_edge_tts_voice_cache_dir(language)
    descriptor, temporary_path = tempfile.mkstemp(
        prefix="worker_tts_",
        suffix=".mp3",
        dir=str(voice_dir),
    )
    os.close(descriptor)
    temporary_file = Path(temporary_path)
    try:
        result = tts_orchestrator.synthesize(
            text,
            language,
            temporary_file,
            accent=accent,
            gender=gender,
            priority_profile=priority_profile,
        )
        if not result.get("success"):
            raise RuntimeError(result.get("error") or "TTS synthesis failed")
        audio = temporary_file.read_bytes() if temporary_file.exists() else b""
        if len(audio) < 100:
            raise RuntimeError(
                f"engine '{result.get('engine')}' produced {len(audio)} bytes"
            )
        metadata = {
            "synth_command": result.get("synth_command"),
            "tried": result.get("tried") or [],
        }
        return (
            base64.b64encode(audio).decode("ascii"),
            result.get("engine") or "unknown",
            result.get("accent") or "unknown",
            metadata,
        )
    finally:
        try:
            temporary_file.unlink()
        except OSError:
            pass


def process_audio_task(worker, task: Dict[str, Any]) -> None:
    """Process every centrally routed Pycore audio task through one TTS base."""
    task_id = task.get("task_id")
    task_type = str(task.get("task_type") or "")
    payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
    language = str(payload.get("language") or "en")

    worker._post_result(task_id, "processing", progress=5, attempts=1)
    if task_type == worker.WORD_AUDIO_TASK_TYPE:
        _process_word_audio(worker, task_id, payload, language)
        return
    if task_type in (worker.ARTICLE_AUDIO_TASK_TYPE, worker.SENTENCE_AUDIO_TASK_TYPE):
        _process_content_audio(worker, task_id, task_type, payload, language)
        return
    worker._post_result(task_id, "failed", error=f"unsupported audio task_type: {task_type}")


def _process_word_audio(
    worker,
    task_id: object,
    payload: Dict[str, Any],
    language: str,
) -> None:
    items = _normalize_word_items(payload)
    if not items:
        worker._post_result(task_id, "failed", error="word_audio payload carried no words or content")
        return

    translations: List[Dict[str, Any]] = []
    failures: List[str] = []
    for index, item in enumerate(items):
        word = item["word"]
        try:
            audio_base64, provider, accent, metadata = synthesize_word_audio(
                word,
                language,
                accent=_optional_text(payload.get("accent")),
                gender=_optional_text(payload.get("gender")),
                priority_profile="word",
            )
            translations.append({
                "word": word,
                **({"md5": item["md5"]} if item.get("md5") else {}),
                "audio_base64": audio_base64,
                "audio_mime": "audio/mpeg",
                "provider": provider,
                "accent": accent,
                **metadata,
            })
        except Exception as exc:  # noqa: BLE001 - one word must not drop the batch
            failures.append(f"{word}: {exc}")

        if index + 1 < len(items):
            worker._post_result(
                task_id,
                "processing",
                progress=max(5, int(((index + 1) / len(items)) * 100)),
            )

    if not translations:
        worker._post_result(task_id, "failed", error="; ".join(failures) or "TTS produced no audio")
        return

    worker._post_result(
        task_id,
        "completed",
        result={
            "translations": translations,
            "target_language": str(payload.get("target_language") or "zh"),
            "provider": translations[0].get("provider") or "pycore-tts",
            "failed_words": failures,
        },
        progress=100,
    )


def _process_content_audio(
    worker,
    task_id: object,
    task_type: str,
    payload: Dict[str, Any],
    language: str,
) -> None:
    content = str(payload.get("content") or payload.get("text") or "").strip()
    if not content:
        worker._post_result(task_id, "failed", error=f"{task_type} payload carried no content")
        return

    try:
        audio_base64, provider, accent, metadata = synthesize_word_audio(
            content,
            language,
            accent=_optional_text(payload.get("accent")),
            gender=_optional_text(payload.get("gender")),
            priority_profile="sentence",
        )
    except Exception as exc:  # noqa: BLE001 - report through the worker contract
        worker._post_result(task_id, "failed", error=str(exc))
        return

    result = {
        "audio_base64": audio_base64,
        "mime": "audio/mpeg",
        "provider": provider,
        "accent": accent,
        **metadata,
    }
    for field in ("variant_key", "gender", "source", "voice_type"):
        value = _optional_text(payload.get(field))
        if value is not None:
            result[field] = value
    worker._post_result(task_id, "completed", result=result, progress=100)


def _normalize_word_items(payload: Dict[str, Any]) -> List[Dict[str, str]]:
    items: List[Dict[str, str]] = []
    raw_words = payload.get("words") if isinstance(payload.get("words"), list) else []
    for raw in raw_words:
        if isinstance(raw, str):
            word = raw.strip()
            md5 = ""
        elif isinstance(raw, dict):
            word = str(raw.get("word") or raw.get("text") or "").strip()
            md5 = str(raw.get("md5") or "").strip()
        else:
            continue
        if word:
            items.append({"word": word, "md5": md5})
    if not items:
        word = str(payload.get("word") or payload.get("content") or "").strip()
        if word:
            items.append({"word": word, "md5": str(payload.get("md5") or "").strip()})
    return items


def _optional_text(value: object) -> Optional[str]:
    text = str(value or "").strip()
    return text or None
