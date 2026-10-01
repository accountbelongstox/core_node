# -*- coding: utf-8 -*-
"""Audio orchestration system probe, generated segment files and central-cache
resource delivery (lookup, whole clip, framed bundle, chunk)."""

import base64
import json
import re
import struct
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.core_node_dirs import portable_path
from pycore.pyfoundations.system_launcher import open_path
from pycore.pyutils.common.ffmpeg.ffmpeg_runtime import ffmpeg_runtime
from pycore.pyutils.tts import word_audio_cache
from pycore.pyutils.tts.audio_validation import validate_mp3
from pycore.pyutils.translator.dictionary import dictionary_service

from pycore.pyctl.audio_orchestration import (
    orch_contract,
    orch_resources,
    orch_store,
    orch_video,
)

_SYSTEM_STATUS_TTL_SECONDS = 300
_SYSTEM_STATUS_MISSING_TTL_SECONDS = 5
_SYSTEM_STATUS_SCHEMA = 1
# Only the segment files of the task's own output folder can be read.
_FILE_NAME_RE = re.compile(r"^segment_\d{3}\.(mp3|mp4)$")
_FILE_MEDIA_TYPES = {".mp3": "audio/mpeg", ".mp4": "video/mp4"}
FILE_CHUNK_BYTES = 1024 * 1024
_RESOURCE_LOOKUP_MAX_ITEMS = 500


def positive_int(value: Any, default: int, minimum: int = 1) -> int:
    text = str(value if value is not None else "").strip()
    return max(minimum, int(text)) if text.lstrip("-").isdigit() else default


def _probe_ffmpeg() -> Dict[str, Any]:
    resolved = ffmpeg_runtime.binaries().ffmpeg
    binary = str(resolved) if resolved is not None else None
    info: Dict[str, Any] = {"available": bool(binary), "path": binary or "", "version": ""}
    if binary:
        try:
            proc = subprocess.run(
                [binary, "-version"], capture_output=True, timeout=15,
                encoding="utf-8", errors="replace",
            )
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[AudioOrch] ffmpeg probe failed ({binary}): {exc}")
            info["available"] = False
            info["probe_error"] = str(exc)
            return info
        first_line = (proc.stdout or "").splitlines()[0] if proc.stdout else ""
        info["version"] = first_line.strip()
        if proc.returncode != 0:
            info["available"] = False
            info["probe_error"] = (proc.stderr or "").strip() or f"process exit {proc.returncode}"
    return info


def system_status(refresh: bool = False) -> Dict[str, Any]:
    """Cached pycore-side system probe (ffmpeg + storage paths). The ffmpeg
    check is TTL-cached on disk so UI polls never pay the probe cost."""
    cached = orch_store.load_system_status()
    now = int(time.time())
    cached_ffmpeg = (cached or {}).get("ffmpeg") or {}
    ttl = _SYSTEM_STATUS_TTL_SECONDS if cached_ffmpeg.get("available") else _SYSTEM_STATUS_MISSING_TTL_SECONDS
    reusable = (
        not refresh and cached and cached.get("schema") == _SYSTEM_STATUS_SCHEMA
        and now - int(cached.get("probed_at") or 0) < ttl
        and (not cached_ffmpeg.get("available") or Path(str(cached_ffmpeg.get("path") or "")).is_file())
    )
    ffmpeg = cached_ffmpeg if reusable else _probe_ffmpeg()
    status = {
        "schema": _SYSTEM_STATUS_SCHEMA,
        "probed_at": cached["probed_at"] if reusable else now,
        "ffmpeg": ffmpeg,
        "data_dir": str(orch_store.base_dir()),
        "output_root": str(orch_store.base_dir() / "output"),
        "tasks_total": len(orch_store.list_tasks()),
        "books_cached": len(orch_store.load_books_cache().get("items") or []),
        "sentence_books_cached": len(orch_store.cached_book_keys()),
        "logged_in": bool(orch_store.auth_token()),
    }
    if not reusable:
        orch_store.save_system_status(status)
    return {"success": True, **status}


def task_files(task_id: str) -> Dict[str, Any]:
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    return {
        "success": True,
        "output_dir": str(orch_store.base_dir() / "output" / str(task.get("slug") or "task")),
        "files": orch_store.task_files(task),
    }


def task_file_chunk(task_id: str, name: str, offset: int = 0, length: int = FILE_CHUNK_BYTES) -> Dict[str, Any]:
    """One chunk of a generated segment file (audio mp3 / video mp4) as base64,
    with the total size, so the UI can play or download it."""
    task = orch_store.get_task(str(task_id or ""))
    if not task:
        return {"success": False, "error": "task not found"}
    if not _FILE_NAME_RE.fullmatch(str(name or "")):
        return {"success": False, "error": "ORCH_FILE_NAME_INVALID"}
    directory = (orch_store.base_dir() / "output" / str(task.get("slug") or "task")).resolve()
    path = (directory / str(name)).resolve()
    if path.parent != directory or not path.is_file():
        return {"success": False, "error": "ORCH_FILE_NOT_FOUND"}
    return _read_file_chunk(path, offset, length)


def _read_file_chunk(path: Path, offset: Any, length: Any) -> Dict[str, Any]:
    size = path.stat().st_size
    start = min(size, positive_int(offset, 0, 0))
    count = min(FILE_CHUNK_BYTES, positive_int(length, FILE_CHUNK_BYTES))
    with path.open("rb") as handle:
        handle.seek(start)
        chunk = handle.read(count)
    return {
        "success": True,
        "name": path.name,
        "media_type": _FILE_MEDIA_TYPES[path.suffix.lower()],
        "bytes": size,
        "offset": start,
        "length": len(chunk),
        "eof": start + len(chunk) >= size,
        "content_base64": base64.b64encode(chunk).decode("ascii"),
    }


def _resource_hit_path(kind: str, language: str, text: str) -> Optional[Path]:
    if kind == "word":
        path = word_audio_cache.find_cached_many([text], language).get(text.strip().lower())
    elif kind == "sentence":
        path = orch_resources.sentence_cache_hit(text, language)
    else:
        return None
    return path if path is not None and validate_mp3(str(path))[0] else None


def _resource_entries(requested: List[Any]) -> List[Dict[str, Any]]:
    """Central-cache state of request items, in order: key, hit path, size and
    the gloss of an English word (word hits are looked up once per language)."""
    entries = [
        (str(item.get("kind") or ""), str(item.get("language") or ""), str(item.get("text") or ""))
        for item in requested if isinstance(item, dict)
    ]
    word_hits: Dict[str, Dict[str, Any]] = {}
    for language in {language for kind, language, _ in entries if kind == "word"}:
        word_hits[language] = word_audio_cache.find_cached_many(
            [text for kind, lang, text in entries if kind == "word" and lang == language], language,
        )
    # One identity / directory resolution per language, not per sentence.
    sentence_hits: Dict[str, Dict[str, Path]] = {}
    for language in {language for kind, language, _ in entries if kind == "sentence"}:
        sentence_hits[language] = orch_resources.sentence_cache_hits(
            [text for kind, lang, text in entries if kind == "sentence" and lang == language], language,
        )
    answers = []
    for kind, language, text in entries:
        if kind == "word":
            path = word_hits[language].get(text.strip().lower())
        elif kind == "sentence":
            path = sentence_hits[language].get(text)
        else:
            path = None
        path = path if path is not None and validate_mp3(str(path))[0] else None
        english_word = kind == "word" and language == orch_video.LANGUAGE_EN
        answers.append({
            "key": orch_resources.resource_id(kind, language, text),
            "file": path,
            "bytes": path.stat().st_size if path is not None else 0,
            "meaning": orch_video.short_meaning(
                dictionary_service.translate(text.strip().lower(), orch_video.LANGUAGE_ZH),
            ) if english_word else "",
        })
    return answers


def resource_lookup(items: Any) -> Dict[str, Any]:
    """Batch central-cache lookup for device-side orchestration: one entry per
    request item, in order, with the resource key, hit flag, size and gloss."""
    requested = items if isinstance(items, list) else []
    if len(requested) > _RESOURCE_LOOKUP_MAX_ITEMS:
        return {"success": False, "error": "ORCH_RESOURCE_LOOKUP_TOO_MANY"}
    return {"success": True, "items": [
        {
            "key": entry["key"],
            "hit": entry["file"] is not None,
            "bytes": entry["bytes"],
            "path": portable_path(str(entry["file"])) if entry["file"] is not None else "",
            "meaning": entry["meaning"],
        }
        for entry in _resource_entries(requested)
    ]}


def resource_file(kind: str, language: str, text: str) -> Optional[Dict[str, Any]]:
    """One cached clip whole (static delivery): key, media type and bytes, or
    None when the central cache does not hold it; the path is always resolved
    server-side."""
    path = _resource_hit_path(str(kind or ""), str(language or ""), str(text or ""))
    if path is None:
        return None
    return {
        "key": orch_resources.resource_id(str(kind), str(language), str(text)),
        "media_type": _FILE_MEDIA_TYPES[path.suffix.lower()],
        "body": path.read_bytes(),
    }


def resource_bundle(items: Any) -> Optional[bytes]:
    """Many cached clips in one framed body (contract transfer.pycore_bundle_frame):
    per item, in order, a length-prefixed JSON header and the clip bytes while
    the byte budget lasts (the first hit is always sent); None for an invalid
    request (not a list, or more items than the contract allows)."""
    if not isinstance(items, list) or len(items) > orch_contract.BUNDLE_MAX_ITEMS:
        return None
    frames: List[bytes] = []
    budget = orch_contract.BUNDLE_MAX_BYTES
    sent_any = False
    for index, entry in enumerate(_resource_entries(items)):
        path = entry["file"]
        send = path is not None and (not sent_any or entry["bytes"] <= budget)
        payload = path.read_bytes() if send else b""
        header = json.dumps({
            "index": index,
            "key": entry["key"],
            "hit": path is not None,
            "bytes": len(payload) if send else entry["bytes"],
            "sent": send,
            "meaning": entry["meaning"],
        }, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        frames.append(struct.pack(">I", len(header)) + header + payload)
        if send:
            budget -= len(payload)
            sent_any = True
    return b"".join(frames)


def resource_chunk(kind: str, language: str, text: str, offset: Any = 0, length: Any = FILE_CHUNK_BYTES) -> Dict[str, Any]:
    """One chunk of a cached word / sentence clip; the path is always
    re-resolved from the central cache, never taken from the client."""
    path = _resource_hit_path(str(kind or ""), str(language or ""), str(text or ""))
    if path is None:
        return {"success": False, "error": "ORCH_RESOURCE_NOT_CACHED"}
    return _read_file_chunk(path, offset, length)


def open_output(task_id: Optional[str] = None) -> Dict[str, Any]:
    """Open the output directory (one task's, or the shared root) in the OS
    file manager. Path is resolved server-side; never raises."""
    directory = orch_store.base_dir() / "output"
    if task_id:
        task = orch_store.get_task(str(task_id))
        if not task:
            return {"success": False, "error": "task not found"}
        directory = directory / str(task.get("slug") or "task")
    directory.mkdir(parents=True, exist_ok=True)
    ok = open_path(directory)
    return {"success": bool(ok), "path": str(directory)}


__all__ = [
    "FILE_CHUNK_BYTES",
    "open_output",
    "positive_int",
    "resource_bundle",
    "resource_chunk",
    "resource_file",
    "resource_lookup",
    "system_status",
    "task_file_chunk",
    "task_files",
]
