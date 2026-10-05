# -*- coding: utf-8 -*-
"""
Article-record primitives for agent-history consumers.

Persists every generated article in one SQLite store and optionally caches
its audio under ``<local_data_dir>/cache/agent_history/`` (see
``system_paths.get_local_data_dir``):

  article_records.sqlite3   one row per generated article record (JSON body
                            plus indexed counter columns, newest first)
  audio/<id>.mp3            synthesized TTS audio
  videos/<job>/             rendered video jobs

The pre-SQLite ``index.json`` + ``<id>.json`` files are imported once
(``json_imported`` meta key) and never read again.

Record fields: id, created_at, title_cn, title_en, reference_cn (trimmed),
article_en, word_count, openrouter_model, translation_engine (openrouter),
tts_engine, tts_model (audio generation source reported by the TTS backend),
tts_chunked (multi-sentence synthesis marker; MISSING = legacy audio that
predates sentence chunking), rebuild_attempts, audio_rebuilt_at,
rebuild_uploaded / rebuild_uploaded_at (the multi-sentence audio was
uploaded to Laravel main and replaced the old published audio; MISSING =
the replacement is still pending - delivered by the Laravel delivery outbox),
audio_file, uploaded, uploaded_at.

Lane contract (two independent lanes, each step idempotent on its own):
  rebuild lane   - records lacking tts_chunked are regenerated LOCALLY as
                   multi-sentence audio (Laravel main NOT required); commits
                   audio file + provenance + tts_chunked in one atomic write.
  delivery       - pycore/pyctl/agent_history/pipeline/delivery.py kinds on
                   the shared Laravel delivery outbox (retry/backoff/status
                   and the per-server diff live there) deliver to every
                   Laravel server what its diff reports: full submits for
                   missing records and audio replacements for records whose
                   published audio differs from the local mp3. The uploaded
                   / rebuild_uploaded stamps record the last upload for
                   display; they never decide delivery.
"""

from __future__ import annotations

import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.database.repositories.article_record_repository import ArticleRecordRepository
from pycore.pyfoundations.atomic_json_store import atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import get_local_data_dir
from pycore.pyfoundations.time_utils import utc_now_iso
from pycore.pyutils.common.flat_text_store import SAFE_TEXT_KEY_PATTERN

_LIST_CAP = 500
_DATABASE_FILE_NAME = "article_records.sqlite3"
_LEGACY_INDEX_FILE_NAME = "index.json"
_META_JSON_IMPORTED = "json_imported"
_ID_RE = SAFE_TEXT_KEY_PATTERN

RECORD_BODY_FIELDS = ("article_en", "reference_cn")
_REBUILD_DELIVERY_CONTRACT = "audio-replace-v1"


def _records_root() -> Path:
    return get_local_data_dir() / "cache" / "agent_history"


def records_dir() -> Path:
    d = _records_root()
    d.mkdir(parents=True, exist_ok=True)
    return d


def audio_dir() -> Path:
    d = records_dir() / "audio"
    d.mkdir(parents=True, exist_ok=True)
    return d


def video_dir() -> Path:
    d = records_dir() / "videos"
    d.mkdir(parents=True, exist_ok=True)
    return d


def video_job_dir(job_id: str) -> Path:
    normalized = str(job_id or "")
    if not normalized or not _ID_RE.match(normalized):
        raise ValueError("invalid video job id")
    directory = video_dir() / normalized
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _atomic_write_json(path: Path, data: Any) -> bool:
    try:
        atomic_write_json(path, data, indent=1)
    except OSError as exc:
        ColorPrint.red(f"[ArticleRecords] write failed path={path}: {exc}")
        return False
    return True


def _read_record_path(path: Path) -> Optional[Dict[str, Any]]:
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        ColorPrint.yellow(f"[ArticleRecords] read failed path={path}: {exc}")
        return None
    return data if isinstance(data, dict) else None


def _iso_timestamp_value(value: Any) -> float:
    text = str(value or "").strip()
    parsed: Optional[datetime] = None
    if not text:
        return 0.0
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return 0.0
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def is_rebuild_upload_current(record: Dict[str, Any]) -> bool:
    """True only when Laravel acknowledged the current rebuilt audio version."""
    rebuilt_at = _iso_timestamp_value(record.get("audio_rebuilt_at"))
    uploaded_at = _iso_timestamp_value(record.get("rebuild_uploaded_at"))
    if not bool(record.get("rebuild_uploaded")):
        return False
    if rebuilt_at <= 0.0:
        return True
    return (
        str(record.get("rebuild_delivery_contract") or "")
        == _REBUILD_DELIVERY_CONTRACT
        and uploaded_at >= rebuilt_at
    )


def _columns(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "created_at": str(record.get("created_at") or ""),
        "uploaded": int(bool(record.get("uploaded"))),
        "audio_status": str(record.get("audio_status") or ""),
        "tts_chunked": int(bool(record.get("tts_chunked"))),
        "audio_rebuilt": int(bool(record.get("audio_rebuilt_at"))),
        "rebuild_upload_current": int(is_rebuild_upload_current(record)),
        "video_status": str(record.get("video_status") or ""),
        "has_article": int(bool(record.get("article_en"))),
    }


class ArticleRecordStore:
    """Owner of the article-record SQLite connection (one owner thread)."""

    def __init__(self) -> None:
        self._repository: Optional[ArticleRecordRepository] = None
        init_serialized_owner(self, "pyutils.agent_history.article_records", "ArticleRecordStore")

    def _repo(self) -> ArticleRecordRepository:
        if self._repository is None:
            repository = ArticleRecordRepository(records_dir() / _DATABASE_FILE_NAME)
            if not repository.meta(_META_JSON_IMPORTED):
                self._import_json(repository)
            self._repository = repository
        return self._repository

    @staticmethod
    def _import_json(repository: ArticleRecordRepository) -> None:
        """One-shot import of the pre-SQLite ``index.json`` and ``<id>.json`` files."""
        root = records_dir()
        index = _read_record_path(root / _LEGACY_INDEX_FILE_NAME) or {}
        merged: Dict[str, Dict[str, Any]] = {}
        for row in index.get("records") or []:
            record_id = str(row.get("id") or "") if isinstance(row, dict) else ""
            if record_id and _ID_RE.match(record_id):
                merged[record_id] = row
        for path in root.glob("*.json"):
            if path.name == _LEGACY_INDEX_FILE_NAME:
                continue
            record = _read_record_path(path)
            record_id = str((record or {}).get("id") or "")
            if record_id and _ID_RE.match(record_id):
                merged[record_id] = record or {}
        repository.upsert_many(
            (record_id, _columns(record), record) for record_id, record in merged.items()
        )
        repository.set_meta(_META_JSON_IMPORTED, utc_now_iso())
        ColorPrint.blue(f"[ArticleRecords] imported legacy JSON records count={len(merged)}")

    @serialized_method
    def revision(self) -> int:
        return self._repo().revision()

    @serialized_method
    def put(self, record: Dict[str, Any]) -> Dict[str, Any]:
        self._repo().upsert_many([(str(record["id"]), _columns(record), record)])
        return record

    @serialized_method
    def get(self, record_id: str) -> Optional[Dict[str, Any]]:
        return self._repo().get(record_id)

    @serialized_method
    def page(self, offset: int, limit: int) -> Dict[str, Any]:
        repository = self._repo()
        return {"total": repository.count(), "items": repository.page(offset, limit)}

    @serialized_method
    def all(self) -> List[Dict[str, Any]]:
        return self._repo().all()

    @serialized_method
    def rebuild_candidates(self) -> List[Dict[str, Any]]:
        return self._repo().rebuild_candidates()

    @serialized_method
    def rebuild_candidate_count(self) -> int:
        return self._repo().rebuild_candidate_count()

    @serialized_method
    def summary(self) -> Dict[str, int]:
        return self._repo().summary()


article_record_store = ArticleRecordStore()


def _decorate_row(row: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(row)
    root = _records_root()
    rid = str(out.get("id") or "")
    local_audio = bool(rid) and (root / "audio" / f"{rid}.mp3").is_file()
    out["audio_available"] = local_audio or bool(out.get("audio_url"))
    out["audio_status"] = "ready" if local_audio else str(out.get("audio_status") or "queued")
    out["uploaded"] = bool(out.get("uploaded"))
    out["rebuild_uploaded"] = is_rebuild_upload_current(out)
    video_job_id = str(out.get("video_job_id") or "")
    video_file = root / "videos" / video_job_id / "video.mp4" if video_job_id else None
    out["video_available"] = bool(video_file is not None and video_file.is_file())
    return out


def records_revision() -> str:
    """Revision marker for the record store (changes on every record write)."""
    try:
        return f"db:{article_record_store.revision()}"
    except sqlite3.Error as exc:
        ColorPrint.yellow(f"[ArticleRecords] revision read failed: {exc}")
        return "db:0"


def video_records_revision() -> str:
    files = [path for path in video_dir().glob("*/job.json") if path.is_file()]
    if not files:
        return "0:0:0"
    latest = max(path.stat().st_mtime_ns for path in files)
    total_size = sum(path.stat().st_size for path in files)
    return f"{latest}:{len(files)}:{total_size}"


def list_video_jobs(limit: int = 100) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []
    record = None
    normalized_limit = max(1, min(int(limit or 100), _LIST_CAP))
    for path in video_dir().glob("*/job.json"):
        job = _read_record_path(path)
        if job is None:
            continue
        record = get_record(str(job.get("record_id") or ""))
        job["title_en"] = str((record or {}).get("title_en") or "")
        job["title_cn"] = str((record or {}).get("title_cn") or "")
        job["video_available"] = (path.parent / "video.mp4").is_file()
        jobs.append(job)
    jobs.sort(
        key=lambda item: (
            str(item.get("updated_at") or item.get("created_at") or ""),
            str(item.get("id") or ""),
        ),
        reverse=True,
    )
    return jobs[:normalized_limit]


def list_record_metadata(limit: int = 100) -> List[Dict[str, Any]]:
    """ID-page rows, newest first: full metadata minus the heavy text bodies."""
    page = record_metadata_page(1, max(1, min(int(limit or 100), _LIST_CAP)))
    return page["items"]


def record_metadata_page(page: int = 1, page_size: int = 50) -> Dict[str, Any]:
    """Return one bounded metadata page while counting the full inventory."""
    normalized_page_size = max(1, min(int(page_size or 50), _LIST_CAP))
    total = int(article_record_store.page(0, 0)["total"])
    page_count = max(1, -(-total // normalized_page_size))
    normalized_page = max(1, min(int(page or 1), page_count))
    start = (normalized_page - 1) * normalized_page_size
    out: List[Dict[str, Any]] = []
    for r in article_record_store.page(start, normalized_page_size)["items"]:
        row = _decorate_row(r)
        for field in RECORD_BODY_FIELDS:
            row.pop(field, None)
        out.append(row)
    return {
        "items": out,
        "total": total,
        "page": normalized_page,
        "page_count": page_count,
    }


def get_records(record_ids: List[str], cap: int = 50) -> List[Dict[str, Any]]:
    """Lazily materialize full records (bodies included) for the given IDs."""
    out: List[Dict[str, Any]] = []
    for record_id in record_ids[: max(1, min(int(cap or 50), 100))]:
        record = get_record(str(record_id or ""))
        if record is not None:
            out.append(_decorate_row(record))
    return out


def list_records(limit: int = 100) -> List[Dict[str, Any]]:
    """Records, newest first, with audio availability attached."""
    rows = article_record_store.page(0, max(1, min(int(limit or 100), _LIST_CAP)))["items"]
    return [_decorate_row(r) for r in rows]


def list_all_records() -> List[Dict[str, Any]]:
    """Return every complete record, newest first."""
    return article_record_store.all()


def rebuild_candidates() -> List[Dict[str, Any]]:
    """Records with an article body but no multi-sentence audio, newest first."""
    return article_record_store.rebuild_candidates()


def rebuild_candidate_count() -> int:
    return article_record_store.rebuild_candidate_count()


def summarize_records() -> Dict[str, int]:
    return article_record_store.summary()


def save_record(record: Dict[str, Any], audio_bytes: bytes) -> Dict[str, Any]:
    """Write the record row and its optional audio."""
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
    return article_record_store.put(record)


def get_record(record_id: str) -> Optional[Dict[str, Any]]:
    rid = str(record_id or "")
    if not rid or not _ID_RE.match(rid):
        return None
    return article_record_store.get(rid)


def _commit_record(rec: Dict[str, Any]) -> Dict[str, Any]:
    """Shared record mutation commit: one row replacement on the store owner."""
    return article_record_store.put(rec)


def load_video_job(job_id: str) -> Optional[Dict[str, Any]]:
    normalized = str(job_id or "")
    if not normalized or not _ID_RE.match(normalized):
        return None
    return _read_record_path(video_dir() / normalized / "job.json")


def mark_video_job(record_id: str, job: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    record = get_record(record_id)
    job_id = str(job.get("id") or "")
    if record is None or not job_id or not _ID_RE.match(job_id):
        return None
    _atomic_write_json(video_job_dir(job_id) / "job.json", job)
    record["video_job_id"] = job_id
    record["video_status"] = str(job.get("status") or "pending")
    record["video_error"] = job.get("error")
    record["video_duration"] = float(job.get("duration") or 0.0)
    record["video_generated_at"] = job.get("completed_at")
    record["video_batch_name"] = job.get("batch_name")
    record["video_username"] = job.get("username")
    return _commit_record(record)


def video_path(record_id: str) -> Optional[Path]:
    record = get_record(record_id)
    job_id = str((record or {}).get("video_job_id") or "")
    path = video_dir() / job_id / "video.mp4" if job_id else None
    return path if path is not None and path.is_file() else None


def read_video(record_id: str) -> Optional[bytes]:
    path = video_path(record_id)
    return path.read_bytes() if path is not None else None


def mark_uploaded(record_id: str, laravel_data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    rec = get_record(record_id)
    if rec is None:
        return None
    rec["uploaded"] = True
    rec["uploaded_at"] = utc_now_iso()
    if isinstance(laravel_data, dict):
        rec["laravel_article_id"] = laravel_data.get("article_id")
        rec["audio_url"] = laravel_data.get("audio_url")
        rec["audio_status"] = laravel_data.get("audio_status") or "queued"
    # A full submit publishes the record's CURRENT local audio: when that
    # audio is already multi-sentence, Laravel main now serves it, so the
    # rebuild-replacement marker is satisfied by this very upload.
    if bool(rec.get("tts_chunked")):
        rec["rebuild_uploaded"] = True
        rec["rebuild_uploaded_at"] = rec["uploaded_at"]
        rec["rebuild_delivery_contract"] = _REBUILD_DELIVERY_CONTRACT
    return _commit_record(rec)


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
    rebuild_uploaded marker starts UNSET: the Laravel delivery outbox owns
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
    rec["audio_rebuilt_at"] = utc_now_iso()
    rec["rebuild_uploaded"] = False
    rec["rebuild_uploaded_at"] = None
    rec["rebuild_delivery_contract"] = None
    return _commit_record(rec)


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
    stamped_at = utc_now_iso()
    rec["rebuild_uploaded"] = True
    rec["rebuild_uploaded_at"] = stamped_at
    rec["rebuild_delivery_contract"] = _REBUILD_DELIVERY_CONTRACT
    rec["rebuild_writeback_pending"] = False
    if isinstance(laravel_data, dict):
        rec["laravel_article_id"] = laravel_data.get("article_id") or rec.get("laravel_article_id")
        rec["audio_url"] = laravel_data.get("audio_url") or rec.get("audio_url")
    # A successful replace proves the article is on Laravel main.
    if not bool(rec.get("uploaded")):
        rec["uploaded"] = True
        rec["uploaded_at"] = stamped_at
    return _commit_record(rec)


def mark_rebuild_failed(record_id: str) -> Optional[Dict[str, Any]]:
    """Count one failed step and defer that record with bounded backoff."""
    rec = get_record(record_id)
    if rec is None:
        return None
    attempts = int(rec.get("rebuild_attempts") or 0) + 1
    rec["rebuild_attempts"] = attempts
    rec["rebuild_audio_job"] = None
    rec["rebuild_not_before"] = time.time() + min(300.0, float(2 ** min(attempts, 8)))
    return _commit_record(rec)


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
    return _commit_record(rec)


def clear_rebuild_marker(record_id: str) -> Optional[Dict[str, Any]]:
    """Reset a record whose local multi-sentence audio went missing: the
    tts_chunked/rebuild_uploaded markers are cleared so the rebuild lane
    regenerates it and the delivery outbox stops seeing a delivery that cannot
    be made from this machine."""
    rec = get_record(record_id)
    if rec is None:
        return None
    rec["tts_chunked"] = False
    rec["rebuild_uploaded"] = False
    rec["rebuild_uploaded_at"] = None
    rec["rebuild_delivery_contract"] = None
    rec["audio_status"] = "queued"
    return _commit_record(rec)


def audio_path(record_id: str) -> Optional[Path]:
    """Path to the cached mp3, or None. record_id is validated against the
    store and restricted to safe characters (path-traversal safe)."""
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
    except OSError as exc:
        ColorPrint.yellow(f"[ArticleRecords] audio read failed path={path}: {exc}")
        return None


def cache_audio(record_id: str, audio_bytes: bytes) -> bool:
    """Cache remotely generated article audio for subsequent UI reads."""
    rid = str(record_id or "")
    if not rid or not _ID_RE.match(rid) or get_record(rid) is None or not audio_bytes:
        return False
    path = audio_dir() / f"{rid}.mp3"
    try:
        path.write_bytes(audio_bytes)
    except OSError as exc:
        ColorPrint.red(f"[ArticleRecords] audio cache write failed path={path}: {exc}")
        return False
    rec = get_record(rid) or {}
    rec["id"] = rid
    rec["audio_file"] = f"audio/{rid}.mp3"
    rec["audio_status"] = "ready"
    _commit_record(rec)
    return True
