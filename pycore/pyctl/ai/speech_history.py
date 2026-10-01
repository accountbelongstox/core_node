# -*- coding: utf-8 -*-
"""
Shared speech (TTS/STT) history, the audio sibling of ``ai_image_history``:
the clip a TTS/STT test produced, replayable from the Records timeline.

Layout (under the AI state dir):
  speech_history.json      - newest-last index ring
  speech_audio/<id>.<ext>  - the audio bytes

Index entry:
  { id, ts, iso, kind: 'tts'|'stt', engine, text, language, mime, bytes, file,
    latency_ms, source, origin: 'pycore', ok }
For STT, ``text`` is the transcript and the audio is the recognized sample.
"""

import hashlib
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.ai.ai_state import ai_state_dir
from pycore.pyutils.common.json_index_store import JsonIndexStore
from pycore.pyutils.common.keyset_cursor import KeysetKey

AUDIO_SUBDIR = "speech_audio"
MAX_ENTRIES = 100
TEXT_MAX_CHARS = 2000
DEFAULT_MIME = "audio/mpeg"
_MIME_EXT = {
    "audio/mpeg": "mp3", "audio/mp3": "mp3",
    "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
    "audio/ogg": "ogg", "audio/webm": "webm",
}
_EXT_MIME = {"mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg", "webm": "audio/webm"}

speech_history_store = JsonIndexStore(
    "speech_history.json", ai_state_dir, MAX_ENTRIES, "speech_history", blob_key="file",
)


def _ext_for(mime: str) -> str:
    return _MIME_EXT.get((mime or "").lower().split(";")[0].strip()) or "mp3"


def record_speech(
    *,
    kind: str,
    engine: str,
    text: str,
    audio_bytes: bytes,
    mime: str = DEFAULT_MIME,
    latency_ms: Optional[float] = None,
    language: str = "",
    source: str = "test",
    ok: bool = True,
) -> Optional[Dict[str, Any]]:
    """Persist one synthesized/recognized clip; returns the entry or None."""
    if not audio_bytes:
        return None
    ts = time.time()
    digest = hashlib.sha1(f"{ts}:{kind}:{engine}:{text[:64]}".encode("utf-8")).hexdigest()[:16]
    ext = _ext_for(mime)
    entry = speech_history_store.append({
        "id": digest,
        "ts": ts,
        "iso": datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds"),
        "kind": "stt" if kind == "stt" else "tts",
        "engine": engine or "",
        "text": (text or "")[:TEXT_MAX_CHARS],
        "language": language or "",
        "mime": _EXT_MIME.get(ext, mime or DEFAULT_MIME),
        "bytes": len(audio_bytes),
        "file": f"{AUDIO_SUBDIR}/{digest}.{ext}",
        "latency_ms": latency_ms,
        "source": source or "test",
        "origin": "pycore",
        "ok": bool(ok),
    }, audio_bytes)
    if entry is not None:
        ColorPrint.green(
            f"[speech_history] recorded {entry['kind']}/{engine} ({len(audio_bytes) // 1024}KB) id={digest}")
    return entry


def record_test_result(kind: str, result: Dict[str, Any], source: str = "test") -> Optional[Dict[str, Any]]:
    """Persist a ``tts_test()`` / ``stt_test()`` result by reading its ``path``.
    Logging a test never fails the test response."""
    if not isinstance(result, dict) or not result.get("path"):
        return None
    path = Path(str(result["path"]))
    try:
        data = path.read_bytes()
    except OSError as exc:
        ColorPrint.yellow(f"[speech_history] read test audio {path} failed: {exc}")
        return None
    ext = (os.path.splitext(str(path))[1] or "").lstrip(".").lower()
    return record_speech(
        kind=kind,
        engine=str(result.get("engine") or ""),
        text=str(result.get("text") or ""),
        audio_bytes=data,
        mime=_EXT_MIME.get(ext, DEFAULT_MIME),
        latency_ms=result.get("latency_ms"),
        language=str(result.get("language") or ""),
        source=source,
        ok=bool(result.get("success")),
    )


def _abs_path(relative: str) -> str:
    return str(speech_history_store.blob_path(relative).resolve())


def list_history(after: Optional[KeysetKey], limit: int) -> Dict[str, Any]:
    """One newest-first keyset page; items carry an absolute ``path`` for
    'show location'."""
    page = speech_history_store.page(after, limit)
    items = []
    for entry in page["items"]:
        item = dict(entry)
        if entry.get("file"):
            item["path"] = _abs_path(entry["file"])
        items.append(item)
    page["items"] = items
    return page


def read_audio(audio_id: str) -> Tuple[bytes, str]:
    """(bytes, mime) for a stored audio id, or (b'', '') when missing."""
    entry = speech_history_store.find((audio_id or "").strip())
    if not entry or not entry.get("file"):
        return b"", ""
    path = speech_history_store.blob_path(entry["file"])
    try:
        return path.read_bytes(), entry.get("mime") or DEFAULT_MIME
    except OSError as exc:
        ColorPrint.yellow(f"[speech_history] read {path} failed: {exc}")
        return b"", ""


def entry_path(audio_id: str) -> Optional[str]:
    entry = speech_history_store.find((audio_id or "").strip())
    if not entry or not entry.get("file"):
        return None
    return _abs_path(entry["file"])


def delete_entry(audio_id: str) -> bool:
    return speech_history_store.delete((audio_id or "").strip()) is not None


def clear_history() -> int:
    return speech_history_store.clear()


__all__ = [
    "clear_history",
    "delete_entry",
    "entry_path",
    "list_history",
    "read_audio",
    "record_speech",
    "record_test_result",
    "speech_history_store",
]
