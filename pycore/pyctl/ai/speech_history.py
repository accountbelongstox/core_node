#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared speech (TTS/STT) generation history — the audio sibling of
``ai_image_history`` (same shared ``<cache>/pycore/.ai_state`` channel, same
atomic-write + ring-buffer safety). Captures the audio a TTS/STT *test* (or any
synthesis we choose to log) produced so the unified Records timeline can replay
it, show its path, and open its folder.

Layout:
  <cache>/pycore/.ai_state/speech_history.json    — newest-last index (ring)
  <cache>/pycore/.ai_state/speech_audio/<id>.<ext> — the audio bytes

Index entry (the only shape the UI depends on):
  { id, ts, iso, kind: 'tts'|'stt', engine, text, language, mime, bytes, file,
    latency_ms, source, origin: 'pycore', ok }

For STT, ``text`` is the recognized transcript and the stored audio is the sample
clip that was recognized. Best-effort: a storage failure is logged, never raised.
All imports at file top (PYTHON_PYCORE.md §1.4); ColorPrint logging.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)
from pycore.pyfoundations.system_paths import APP_DATA_DIR, get_local_data_dir

# Same shared root as ai_image_history (cross-runtime DrvFs-visible).
_SHARED_STATE_DIR = get_local_data_dir() / ".ai_state"
_LEGACY_DIR = APP_DATA_DIR / "ai_state"

# Newest-last ring buffer cap; older entries (and their audio files) are trimmed.
_MAX_ENTRIES = 100

_MIME_EXT = {
    "audio/mpeg": "mp3", "audio/mp3": "mp3",
    "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
    "audio/ogg": "ogg", "audio/webm": "webm",
}
_EXT_MIME = {"mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg", "webm": "audio/webm"}

_WORK_QUEUE = 'pyctl.ai.speech_history.operations'


def _state_dir():
    try:
        _SHARED_STATE_DIR.mkdir(parents=True, exist_ok=True)
        return _SHARED_STATE_DIR
    except Exception:
        _LEGACY_DIR.mkdir(parents=True, exist_ok=True)
        return _LEGACY_DIR


def _index_file():
    return _state_dir() / "speech_history.json"


def _audio_dir():
    d = _state_dir() / "speech_audio"
    try:
        d.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    return d


def _load_index() -> Dict[str, Any]:
    path = _index_file()
    try:
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("entries"), list):
                return data
    except Exception as e:  # noqa: BLE001 — a corrupt index must never crash callers
        ColorPrint.yellow(f"[speech_history] index unreadable ({e}); starting fresh")
    return {"version": 1, "saved_at": 0.0, "entries": []}


def _save_index(doc: Dict[str, Any]) -> None:
    doc["saved_at"] = time.time()
    path = _index_file()
    tmp = path.with_suffix(".json.tmp")
    try:
        tmp.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[speech_history] index write failed: {e}")
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass


def _ext_for(mime: str, file_hint: str = "") -> str:
    ext = _MIME_EXT.get((mime or "").lower().split(";")[0].strip())
    if ext:
        return ext
    suffix = (os.path.splitext(file_hint)[1] or "").lstrip(".").lower()
    return suffix or "mp3"


def _trim(doc: Dict[str, Any]) -> None:
    """Keep only the newest _MAX_ENTRIES; delete dropped entries' audio files."""
    entries = doc.get("entries") or []
    if len(entries) <= _MAX_ENTRIES:
        return
    drop = entries[: len(entries) - _MAX_ENTRIES]
    doc["entries"] = entries[len(entries) - _MAX_ENTRIES:]
    base = _state_dir()
    for e in drop:
        rel = e.get("file")
        if rel:
            try:
                (base / rel).unlink()
            except OSError:
                pass


def _record_speech(
    *,
    kind: str,
    engine: str,
    text: str,
    audio_bytes: bytes,
    mime: str = "audio/mpeg",
    latency_ms: Optional[float] = None,
    language: str = "",
    source: str = "test",
    ok: bool = True,
) -> Optional[Dict[str, Any]]:
    """Persist a synthesized/recognized clip (audio file + index entry).

    ``kind`` is 'tts' or 'stt'. Returns the index entry or None when there is
    nothing to store. Best-effort: storage failures are logged and swallowed.
    """
    if not audio_bytes:
        return None
    ts = time.time()
    digest = hashlib.sha1(f"{ts}:{kind}:{engine}:{text[:64]}".encode("utf-8")).hexdigest()[:16]
    ext = _ext_for(mime)
    rel = f"speech_audio/{digest}.{ext}"
    entry = {
        "id": digest,
        "ts": ts,
        "iso": datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds"),
        "kind": "stt" if kind == "stt" else "tts",
        "engine": engine or "",
        "text": (text or "")[:2000],
        "language": language or "",
        "mime": _EXT_MIME.get(ext, mime or "audio/mpeg"),
        "bytes": len(audio_bytes),
        "file": rel,
        "latency_ms": latency_ms,
        "source": source or "test",
        "origin": "pycore",
        "ok": bool(ok),
    }
    try:
        _audio_dir()
        (_state_dir() / rel).write_bytes(audio_bytes)
    except Exception as e:  # noqa: BLE001
        ColorPrint.yellow(f"[speech_history] audio write failed: {e}")
        return None
    doc = _load_index()
    doc["entries"].append(entry)
    _trim(doc)
    _save_index(doc)
    ColorPrint.green(
        f"[speech_history] recorded {entry['kind']}/{engine} ({len(audio_bytes)//1024}KB) id={digest}")
    return entry


def _record_test_result(
    kind: str,
    result: Dict[str, Any],
    source: str = "test",
) -> Optional[Dict[str, Any]]:
    """Persist a ``tts_test()`` / ``stt_test()`` result dict by reading its produced
    ``path``. Returns the stored entry (so the caller can echo its id) or None.
    Best-effort: never raises — logging a test must not fail the test response."""
    if not isinstance(result, dict):
        return None
    path = result.get("path")
    if not path:
        return None
    try:
        data = Path(path).read_bytes()
    except Exception:  # noqa: BLE001
        return None
    if not data:
        return None
    ext = (os.path.splitext(str(path))[1] or "").lstrip(".").lower()
    mime = _EXT_MIME.get(ext, "audio/mpeg")
    return _record_speech(
        kind=kind,
        engine=str(result.get("engine") or ""),
        text=str(result.get("text") or ""),
        audio_bytes=data,
        mime=mime,
        latency_ms=result.get("latency_ms"),
        language=str(result.get("language") or ""),
        source=source,
        ok=bool(result.get("success")),
    )


def _abs_path(rel: str) -> str:
    try:
        return str((_state_dir() / rel).resolve())
    except Exception:
        return str(_state_dir() / rel)


def _list_history(limit: int = 50) -> List[Dict[str, Any]]:
    """Newest-first entries (metadata only) with an absolute ``path`` added for the
    UI's 'show actual location'. Capped at ``limit`` (1.._MAX_ENTRIES)."""
    limit = max(1, min(_MAX_ENTRIES, int(limit) if str(limit).isdigit() else 50))
    entries = list((_load_index().get("entries") or []))
    out = []
    for e in reversed(entries):
        item = dict(e)
        if e.get("file"):
            item["path"] = _abs_path(e["file"])
        out.append(item)
    return out[:limit]


def _read_audio(audio_id: str) -> Tuple[bytes, str]:
    """(bytes, mime) for a stored audio id, or (b'', '') when missing."""
    audio_id = (audio_id or "").strip()
    if not audio_id:
        return b"", ""
    rel = mime = None
    for entry in (_load_index().get("entries") or []):
        if entry.get("id") == audio_id:
            rel = entry.get("file")
            mime = entry.get("mime") or "audio/mpeg"
            break
    if not rel:
        return b"", ""
    try:
        return (_state_dir() / rel).read_bytes(), mime
    except Exception:  # noqa: BLE001
        return b"", ""


def _entry_path(audio_id: str) -> Optional[str]:
    """Absolute path of a stored audio file (for reveal / show-location), or None."""
    audio_id = (audio_id or "").strip()
    if not audio_id:
        return None
    for entry in (_load_index().get("entries") or []):
        if entry.get("id") == audio_id and entry.get("file"):
            return _abs_path(entry["file"])
    return None


def _delete_entry(audio_id: str) -> bool:
    """Remove one entry and its audio file. True when an entry was removed."""
    audio_id = (audio_id or "").strip()
    if not audio_id:
        return False
    doc = _load_index()
    entries = doc.get("entries") or []
    keep, removed = [], None
    for entry in entries:
        if entry.get("id") == audio_id and removed is None:
            removed = entry
        else:
            keep.append(entry)
    if removed is None:
        return False
    doc["entries"] = keep
    _save_index(doc)
    rel = removed.get("file")
    if rel:
        try:
            (_state_dir() / rel).unlink()
        except OSError:
            pass
    return True


def _clear_history() -> int:
    """Delete ALL entries + audio files. Returns the count removed."""
    doc = _load_index()
    entries = doc.get("entries") or []
    base = _state_dir()
    for entry in entries:
        rel = entry.get("file")
        if rel:
            try:
                (base / rel).unlink()
            except OSError:
                pass
    removed_count = len(entries)
    doc["entries"] = []
    _save_index(doc)
    return removed_count


_WORKER = SerializedWorkerThread(_WORK_QUEUE, 'SpeechHistoryThread')
_WORKER.start()


def record_speech(**kwargs: Any) -> Optional[Dict[str, Any]]:
    return call_serialized(_WORK_QUEUE, _record_speech, **kwargs)


def record_test_result(
    kind: str,
    result: Dict[str, Any],
    source: str = "test",
) -> Optional[Dict[str, Any]]:
    return call_serialized(
        _WORK_QUEUE,
        _record_test_result,
        kind,
        result,
        source,
    )


def list_history(limit: int = 50) -> List[Dict[str, Any]]:
    return call_serialized(_WORK_QUEUE, _list_history, limit)


def read_audio(audio_id: str) -> Tuple[bytes, str]:
    return call_serialized(_WORK_QUEUE, _read_audio, audio_id)


def entry_path(audio_id: str) -> Optional[str]:
    return call_serialized(_WORK_QUEUE, _entry_path, audio_id)


def delete_entry(audio_id: str) -> bool:
    return bool(call_serialized(_WORK_QUEUE, _delete_entry, audio_id))


def clear_history() -> int:
    return int(call_serialized(_WORK_QUEUE, _clear_history))


__all__ = [
    "record_speech", "record_test_result", "list_history", "read_audio",
    "entry_path", "delete_entry", "clear_history",
]
