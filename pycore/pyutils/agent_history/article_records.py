# -*- coding: utf-8 -*-
"""
Article-record primitives for agent-history consumers.

Persists every generated article as an individual JSON record and optionally
caches its audio under ``<local_data_dir>/cache/agent_history/`` (see
``system_paths.get_local_data_dir``), with an ``index.json`` (newest first):

  index.json          {"records": [<record>, ...]}
  <id>.json           one generated article record
  audio/<id>.mp3      synthesized TTS audio

Record fields: id, created_at, title_cn, title_en, reference_cn (trimmed),
article_en, word_count, openrouter_model, translation_engine (openrouter),
tts_engine, tts_model (audio generation source reported by the TTS backend),
tts_chunked (multi-sentence synthesis marker; MISSING = legacy audio that
predates sentence chunking), rebuild_attempts, audio_rebuilt_at,
rebuild_uploaded / rebuild_uploaded_at (the multi-sentence audio was
uploaded to Laravel main and replaced the old published audio; MISSING =
the replacement is still pending - drained by the network-upload piggyback),
audio_file, uploaded, uploaded_at.

Lane contract (two independent piggybacks, each step idempotent on its own):
  rebuild lane   - records lacking tts_chunked are regenerated LOCALLY as
                   multi-sentence audio (Laravel main NOT required); commits
                   audio file + provenance + tts_chunked in one atomic write.
  upload lane    - drains everything not yet on Laravel main: full submits
                   for never-uploaded records (submit stamps uploaded and,
                   when the local audio is already multi-sentence,
                   rebuild_uploaded) and audio replacements for uploaded
                   records whose regenerated audio is pending (stamps
                   rebuild_uploaded). Each record is one independent step.
"""

from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.system_paths import get_local_data_dir

_LIST_CAP = 500
_INDEX_FILE_NAME = "index.json"
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
    return records_dir() / _INDEX_FILE_NAME


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


def _read_record_path(path: Path) -> Optional[Dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _align_durable_index(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Recover committed record files missing from the durable index.

    Record JSON and index replacement are independent minimum steps. If the
    process stops between them, or an older capped index omitted archived
    records, the next read folds every committed record file back into the
    index without changing an existing record identity.
    """
    indexed = {
        str(row.get("id") or ""): row
        for row in rows
        if str(row.get("id") or "")
    }
    changed = False
    for path in records_dir().glob("*.json"):
        if path.name == _INDEX_FILE_NAME or path.stem in indexed:
            continue
        record = _read_record_path(path)
        record_id = str((record or {}).get("id") or "")
        if not record_id or not _ID_RE.match(record_id) or record_id in indexed:
            continue
        indexed[record_id] = record or {}
        changed = True
    if not changed:
        return rows
    aligned = sorted(
        indexed.values(),
        key=lambda row: (
            str(row.get("created_at") or ""),
            str(row.get("id") or ""),
        ),
        reverse=True,
    )
    _atomic_write_json(_index_path(), {"records": aligned})
    return aligned


def load_index() -> Dict[str, Any]:
    path = _index_path()
    if not path.is_file():
        return {"records": _align_durable_index([])}
    data = _read_record_path(path)
    rows = data.get("records") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        rows = []
    return {
        "records": _align_durable_index(
            [row for row in rows if isinstance(row, dict)]
        )
    }


RECORD_BODY_FIELDS = ("article_en", "reference_cn")


def _decorate_row(row: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(row)
    rid = str(out.get("id") or "")
    local_audio = bool(rid) and (audio_dir() / f"{rid}.mp3").is_file()
    out["audio_available"] = local_audio or bool(out.get("audio_url"))
    out["audio_status"] = "ready" if local_audio else str(out.get("audio_status") or "queued")
    out["uploaded"] = bool(out.get("uploaded"))
    out["rebuild_uploaded"] = bool(out.get("rebuild_uploaded"))
    return out


def records_revision() -> str:
    """Revision marker for the records index (changes on every index write)."""
    try:
        stat = _index_path().stat()
        return f"{stat.st_mtime_ns}:{stat.st_size}"
    except OSError:
        return "0:0"


def list_record_metadata(limit: int = 100) -> List[Dict[str, Any]]:
    """ID-page rows, newest first: full metadata minus the heavy text bodies."""
    rows = load_index()["records"]
    out: List[Dict[str, Any]] = []
    for r in rows[: max(1, min(int(limit or 100), _LIST_CAP))]:
        row = _decorate_row(r)
        for field in RECORD_BODY_FIELDS:
            row.pop(field, None)
        out.append(row)
    return out


def get_records(record_ids: List[str], cap: int = 50) -> List[Dict[str, Any]]:
    """Lazily materialize full records (bodies included) for the given IDs."""
    out: List[Dict[str, Any]] = []
    for record_id in record_ids[: max(1, min(int(cap or 50), 100))]:
        record = get_record(str(record_id or ""))
        if record is not None:
            out.append(_decorate_row(record))
    return out


def list_records(limit: int = 100) -> List[Dict[str, Any]]:
    """Index records, newest first, with audio availability attached."""
    rows = load_index()["records"]
    out: List[Dict[str, Any]] = []
    for r in rows[: max(1, min(int(limit or 100), _LIST_CAP))]:
        out.append(_decorate_row(r))
    return out


def list_all_records() -> List[Dict[str, Any]]:
    """Return the complete durable inventory, newest first."""
    return [dict(row) for row in load_index()["records"]]


def summarize_records() -> Dict[str, int]:
    rows = load_index()["records"]
    return {
        "total": len(rows),
        "uploaded": sum(1 for row in rows if bool(row.get("uploaded"))),
        "pending_upload": sum(1 for row in rows if not bool(row.get("uploaded"))),
        "audio_ready": sum(1 for row in rows if str(row.get("audio_status") or "") == "ready"),
        "audio_queued": sum(1 for row in rows if str(row.get("audio_status") or "") == "queued"),
        "multi_sentence": sum(1 for row in rows if bool(row.get("tts_chunked"))),
        "legacy_audio": sum(1 for row in rows if not bool(row.get("tts_chunked"))),
        # Uploaded records whose multi-sentence audio never replaced the
        # published legacy audio (rebuilt locally, Laravel replace pending).
        "rebuild_upload_pending": sum(
            1 for row in rows
            if bool(row.get("uploaded"))
            and bool(row.get("tts_chunked"))
            and not bool(row.get("rebuild_uploaded"))
        ),
    }


def save_record(record: Dict[str, Any], audio_bytes: bytes) -> Dict[str, Any]:
    """Write <id>.json, optional audio, and prepend the record to the index."""
    # Rule §4: no lock — writes land via atomic os.replace; the index is
    # rebuilt as a new list and swapped in with one atomic write.
    rid = str(record.get("id") or "")
    if not rid or not _ID_RE.match(rid):
        raise ValueError("invalid record id")
    record["reference_cn"] = str(record.get("reference_cn") or "").strip()[:2000]
    record["audio_file"] = f"audio/{rid}.mp3" if audio_bytes else None
    record["audio_status"] = "ready" if audio_bytes else "pending_upload"
    record["uploaded"] = bool(record.get("uploaded"))
    record["uploaded_at"] = record.get("uploaded_at") or None
    if audio_bytes:
        (audio_dir() / f"{rid}.mp3").write_bytes(audio_bytes)
    _atomic_write_json(records_dir() / f"{rid}.json", record)
    rows = [r for r in load_index()["records"] if r.get("id") != rid]
    rows.insert(0, record)
    _atomic_write_json(_index_path(), {"records": rows})
    return record


def get_record(record_id: str) -> Optional[Dict[str, Any]]:
    rid = str(record_id or "")
    if not rid or not _ID_RE.match(rid):
        return None
    path = records_dir() / f"{rid}.json"
    if path.is_file():
        data = _read_record_path(path)
        if data is not None:
            return data
    for r in load_index()["records"]:
        if r.get("id") == rid:
            return r
    return None


def _commit_record(rec: Dict[str, Any], index_fields: List[str]) -> Dict[str, Any]:
    """Shared record mutation commit: rewrite <id>.json atomically and mirror
    the named fields into the matching index row (single atomic swap)."""
    _atomic_write_json(records_dir() / f"{rec['id']}.json", rec)
    rows = load_index()["records"]
    for r in rows:
        if r.get("id") == rec["id"]:
            for field in index_fields:
                r[field] = rec.get(field)
    _atomic_write_json(_index_path(), {"records": rows})
    return rec


def mark_uploaded(record_id: str, laravel_data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    # Rule §4: no lock - build the updated record/index, then commit each
    # with a single atomic os.replace write.
    rec = get_record(record_id)
    if rec is None:
        return None
    rec["uploaded"] = True
    rec["uploaded_at"] = datetime.now(timezone.utc).isoformat()
    fields = ["uploaded", "uploaded_at"]
    if isinstance(laravel_data, dict):
        rec["laravel_article_id"] = laravel_data.get("article_id")
        rec["audio_url"] = laravel_data.get("audio_url")
        rec["audio_status"] = laravel_data.get("audio_status") or "queued"
        fields += ["laravel_article_id", "audio_url", "audio_status"]
    # A full submit publishes the record's CURRENT local audio: when that
    # audio is already multi-sentence, Laravel main now serves it, so the
    # rebuild-replacement marker is satisfied by this very upload.
    if bool(rec.get("tts_chunked")):
        rec["rebuild_uploaded"] = True
        rec["rebuild_uploaded_at"] = rec["uploaded_at"]
        fields += ["rebuild_uploaded", "rebuild_uploaded_at"]
    return _commit_record(rec, fields)


def mark_audio_rebuilt(
    record_id: str,
    audio_bytes: bytes,
    *,
    tts_engine: Optional[str],
    tts_model: Optional[str],
    tts_chunked: bool,
) -> Optional[Dict[str, Any]]:
    """Stamp one LOCAL rebuild step: the multi-sentence regeneration is
    persisted (audio file + provenance + tts_chunked marker) independently
    of Laravel main - an unreachable server never blocks generation. The
    rebuild_uploaded marker starts UNSET: the network-upload piggyback owns
    replacing the published audio and setting it."""
    rid = str(record_id or "")
    if not rid or not _ID_RE.match(rid) or not audio_bytes:
        return None
    rec = get_record(rid)
    if rec is None:
        return None
    (audio_dir() / f"{rid}.mp3").write_bytes(audio_bytes)
    rec["audio_file"] = f"audio/{rid}.mp3"
    rec["audio_status"] = "ready"
    rec["tts_engine"] = tts_engine
    rec["tts_model"] = tts_model
    rec["tts_chunked"] = bool(tts_chunked)
    rec["rebuild_attempts"] = 0
    rec["rebuild_audio_job"] = None
    rec["rebuild_not_before"] = 0.0
    rec["audio_rebuilt_at"] = datetime.now(timezone.utc).isoformat()
    rec["rebuild_uploaded"] = False
    rec["rebuild_uploaded_at"] = None
    return _commit_record(rec, [
        "audio_file", "audio_status", "tts_engine", "tts_model",
        "tts_chunked", "rebuild_attempts", "rebuild_audio_job", "rebuild_not_before", "audio_rebuilt_at",
        "rebuild_uploaded", "rebuild_uploaded_at",
    ])


def mark_rebuild_uploaded(
    record_id: str,
    laravel_data: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Stamp one UPLOAD step: the regenerated multi-sentence audio was
    uploaded to Laravel main and replaced the old published audio (or the
    record was submitted fresh). Independent of the generation step - it
    can run on any later tick once the network is available."""
    rec = get_record(record_id)
    if rec is None:
        return None
    stamped_at = datetime.now(timezone.utc).isoformat()
    rec["rebuild_uploaded"] = True
    rec["rebuild_uploaded_at"] = stamped_at
    fields = ["rebuild_uploaded", "rebuild_uploaded_at"]
    if isinstance(laravel_data, dict):
        rec["laravel_article_id"] = laravel_data.get("article_id") or rec.get("laravel_article_id")
        rec["audio_url"] = laravel_data.get("audio_url") or rec.get("audio_url")
        fields += ["laravel_article_id", "audio_url"]
    # A successful replace proves the article is on Laravel main.
    if not bool(rec.get("uploaded")):
        rec["uploaded"] = True
        rec["uploaded_at"] = stamped_at
        fields += ["uploaded", "uploaded_at"]
    return _commit_record(rec, fields)


def mark_rebuild_failed(record_id: str) -> Optional[Dict[str, Any]]:
    """Count one failed step and defer that record with bounded backoff."""
    rec = get_record(record_id)
    if rec is None:
        return None
    attempts = int(rec.get("rebuild_attempts") or 0) + 1
    rec["rebuild_attempts"] = attempts
    rec["rebuild_audio_job"] = None
    rec["rebuild_not_before"] = time.time() + min(300.0, float(2 ** min(attempts, 8)))
    return _commit_record(
        rec,
        ["rebuild_attempts", "rebuild_audio_job", "rebuild_not_before"],
    )


def mark_audio_rebuild_waiting(
    record_id: str,
    job: Dict[str, Any],
    poll_after_s: float,
) -> Optional[Dict[str, Any]]:
    """Persist one submitted/polled rebuild job as its own idempotent step."""
    rec = get_record(record_id)
    if rec is None:
        return None
    rec["rebuild_audio_job"] = dict(job or {})
    rec["rebuild_not_before"] = time.time() + max(0.0, float(poll_after_s or 0.0))
    return _commit_record(rec, ["rebuild_audio_job", "rebuild_not_before"])


def clear_rebuild_marker(record_id: str) -> Optional[Dict[str, Any]]:
    """Reset a record whose local multi-sentence audio went missing: the
    tts_chunked/rebuild_uploaded markers are cleared so the rebuild lane
    regenerates it and the upload lanes stop seeing a delivery that cannot
    be made from this machine."""
    rec = get_record(record_id)
    if rec is None:
        return None
    rec["tts_chunked"] = False
    rec["rebuild_uploaded"] = False
    rec["rebuild_uploaded_at"] = None
    rec["audio_status"] = "queued"
    return _commit_record(
        rec, ["tts_chunked", "rebuild_uploaded", "rebuild_uploaded_at", "audio_status"]
    )


def pending_uploads() -> List[Dict[str, Any]]:
    """Records whose full Laravel submission has not succeeded yet (oldest first)."""
    rows = [r for r in load_index()["records"] if not r.get("uploaded")]
    rows.reverse()
    return rows


def pending_rebuild_uploads() -> List[Dict[str, Any]]:
    """Uploaded records whose regenerated multi-sentence audio has not
    replaced the published legacy audio yet (oldest first) - the drain list
    of the rebuild half of the network-upload piggyback."""
    rows = [
        r for r in load_index()["records"]
        if bool(r.get("uploaded"))
        and bool(r.get("tts_chunked"))
        and not bool(r.get("rebuild_uploaded"))
    ]
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


def cache_audio(record_id: str, audio_bytes: bytes) -> bool:
    """Cache remotely generated article audio for subsequent UI reads."""
    rid = str(record_id or "")
    if not rid or not _ID_RE.match(rid) or get_record(rid) is None or not audio_bytes:
        return False
    try:
        (audio_dir() / f"{rid}.mp3").write_bytes(audio_bytes)
        rec = get_record(rid) or {}
        rec["id"] = rid
        rec["audio_file"] = f"audio/{rid}.mp3"
        rec["audio_status"] = "ready"
        _commit_record(rec, ["audio_file", "audio_status"])
        return True
    except OSError:
        return False
