# -*- coding: utf-8 -*-
"""
Article record cache for the agent-history pipeline.

Persists every generated article as an individual JSON record plus its audio
mp3 under ``<local_data_dir>/cache/agent_history/`` (see
``system_paths.get_local_data_dir``), with an ``index.json`` (newest first):

  index.json          {"records": [<record>, ...]}
  <id>.json           one generated article record
  audio/<id>.mp3      synthesized TTS audio

Record fields: id, created_at, title_cn, title_en, reference_cn (trimmed),
article_en, word_count, openrouter_model, translation_engine
(local|openrouter-fallback), audio_file, uploaded, uploaded_at.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.system_paths import get_local_data_dir

_INDEX_CAP = 500
_ID_RE = re.compile(r"^[A-Za-z0-9._-]+$")

# Rule §4: no module-level locks. On-disk state is mutated via single atomic
# file replacements (_atomic_write_json -> os.replace); index updates are
# build-then-write of a new rows list.


def records_dir() -> Path:
    d = get_local_data_dir() / "cache" / "agent_history"
    d.mkdir(parents=True, exist_ok=True)
    return d


def audio_dir() -> Path:
    d = records_dir() / "audio"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _index_path() -> Path:
    return records_dir() / "index.json"


def _atomic_write_json(path: Path, data: Any) -> None:
    tmp = path.with_suffix(path.suffix + f".tmp{os.getpid()}")
    try:
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(str(tmp), str(path))
    except OSError:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


def load_index() -> Dict[str, Any]:
    path = _index_path()
    if not path.is_file():
        return {"records": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"records": []}
    rows = data.get("records") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return {"records": []}
    return {"records": [r for r in rows if isinstance(r, dict)]}


def list_records(limit: int = 100) -> List[Dict[str, Any]]:
    """Index records, newest first, with audio availability attached."""
    rows = load_index()["records"]
    out: List[Dict[str, Any]] = []
    for r in rows[: max(1, min(int(limit or 100), _INDEX_CAP))]:
        row = dict(r)
        rid = str(row.get("id") or "")
        row["audio_available"] = bool(rid) and (audio_dir() / f"{rid}.mp3").is_file()
        row["uploaded"] = bool(row.get("uploaded"))
        out.append(row)
    return out


def save_record(record: Dict[str, Any], audio_bytes: bytes) -> Dict[str, Any]:
    """Write <id>.json + audio/<id>.mp3 and prepend the record to the index."""
    # Rule §4: no lock — writes land via atomic os.replace; the index is
    # rebuilt as a new list and swapped in with one atomic write.
    rid = str(record.get("id") or "")
    if not rid or not _ID_RE.match(rid):
        raise ValueError("invalid record id")
    record["reference_cn"] = str(record.get("reference_cn") or "").strip()[:2000]
    record["audio_file"] = f"audio/{rid}.mp3"
    record["uploaded"] = bool(record.get("uploaded"))
    record["uploaded_at"] = record.get("uploaded_at") or None
    (audio_dir() / f"{rid}.mp3").write_bytes(audio_bytes)
    _atomic_write_json(records_dir() / f"{rid}.json", record)
    rows = [r for r in load_index()["records"] if r.get("id") != rid]
    rows.insert(0, record)
    _atomic_write_json(_index_path(), {"records": rows[:_INDEX_CAP]})
    return record


def get_record(record_id: str) -> Optional[Dict[str, Any]]:
    rid = str(record_id or "")
    if not rid or not _ID_RE.match(rid):
        return None
    path = records_dir() / f"{rid}.json"
    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except (OSError, json.JSONDecodeError):
            pass
    for r in load_index()["records"]:
        if r.get("id") == rid:
            return r
    return None


def mark_uploaded(record_id: str) -> Optional[Dict[str, Any]]:
    # Rule §4: no lock — build the updated record/index, then commit each
    # with a single atomic os.replace write.
    rec = get_record(record_id)
    if rec is None:
        return None
    rec["uploaded"] = True
    rec["uploaded_at"] = datetime.now(timezone.utc).isoformat()
    _atomic_write_json(records_dir() / f"{rec['id']}.json", rec)
    rows = load_index()["records"]
    for r in rows:
        if r.get("id") == rec["id"]:
            r["uploaded"] = True
            r["uploaded_at"] = rec["uploaded_at"]
    _atomic_write_json(_index_path(), {"records": rows})
    return rec


def pending_uploads() -> List[Dict[str, Any]]:
    """Records whose Laravel upload has not succeeded yet (oldest first)."""
    rows = [r for r in load_index()["records"] if not r.get("uploaded")]
    rows.reverse()
    return rows


def audio_path(record_id: str) -> Optional[Path]:
    """Path to the cached mp3, or None. record_id is validated against the
    index and restricted to safe characters (path-traversal safe)."""
    rid = str(record_id or "")
    if not rid or not _ID_RE.match(rid):
        return None
    if get_record(rid) is None:
        return None
    path = audio_dir() / f"{rid}.mp3"
    return path if path.is_file() else None


def read_audio(record_id: str) -> Optional[bytes]:
    path = audio_path(record_id)
    if path is None:
        return None
    try:
        return path.read_bytes()
    except OSError:
        return None
