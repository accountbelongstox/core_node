# -*- coding: utf-8 -*-
"""Legacy-audio rebuild lane for the agent-history pipeline (extension library).

Article audio is PINNED to the local Qwen3-TTS multi-sentence pipeline
(engine_policy ``agent_history`` profile). Audio generated before that
contract - by the legacy single-shot Qwen server or by the pre-pin fallback
era (ChattTS long single-shot, which degrades the same way - 2noise/ChatTTS#113:
one generation <=30s) - carries NO ``tts_chunked`` marker on its record:
missing data is exactly what identifies legacy audio (single pipeline, no
version negotiation - the marker says "multi-sentence synthesized").

Before new article generation, this lane scans every candidate: each record
(uploaded or not) without the marker is re-synthesized through the
SAME pinned audio stage as new articles (qwen3tts, multi-sentence). The lane
is LOCAL-ONLY: generation and its ``tts_chunked`` commit never require
Laravel main - an unreachable server defers nothing here. Delivering the
regenerated audio to Laravel (full submit for never-uploaded records, audio
replacement for published ones) is owned by the OTHER piggyback, the
network-upload lane in worker.py, which stamps ``rebuild_uploaded``.

Every step is idempotent at its own granularity (one step being done must
never short-circuit or poison the others):
  candidate scan  - records lacking tts_chunked, old-first
  generation      - skipped per record when tts_chunked is set AND the local
                    audio file exists; otherwise synthesized and committed
                    atomically (audio bytes + provenance + marker)
  delivery        - owned by the upload lane (pending_rebuild_uploads)

Ordering contract: no new article stage runs until the legacy backlog is
empty. Rebuilds run old-first, while failed records use bounded backoff and
do not prevent another ready legacy record from progressing. Only one Qwen
job is active for this lane at a time. Each heartbeat advances one small,
persisted step.
"""

import base64
import time
from typing import Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.operation_event_service import operation_event_service
from pycore.pyutils.common.operation_service import operation_service
from pycore.pyutils.agent_history import article_records as records
from pycore.pyctl.agent_history.pipeline.audio_stage import advance_audio_synthesis

# Deliberately NOT prefixed "agent_history": the worker's active-operation
# scan adopts startswith("agent_history") operations as batch items, and this
# lane's log operation must never be adopted. The scope keeps its events
# visible in the agent_history UI snapshot.
_REBUILD_OP_KIND = "audio_rebuild"


def is_rebuild_candidate(record: Dict[str, Any]) -> bool:
    """Any record whose data lacks the multi-sentence marker.

    Engine-agnostic by design: the marker is the ONLY criterion (missing data
    = legacy), and regeneration always runs through the pinned qwen3tts
    stage, so any pre-contract engine's audio (legacy qwen single-shot, the
    ChattTS fallback era) converges on the same multi-sentence pipeline.
    Upload state is irrelevant - a never-uploaded legacy record is rebuilt
    too, and its FIRST full submit then publishes multi-sentence audio."""
    if not bool(record.get("article_en")):
        return False
    return not bool(record.get("tts_chunked"))


def pending_rebuild_records() -> List[Dict[str, Any]]:
    """Legacy records to regenerate, oldest first.

    Pure local scan of the record index (no server probe, no version
    negotiation): a record is legacy exactly when its data lacks the
    ``tts_chunked`` marker. Once the backlog is drained this costs
    milliseconds per tick."""
    rows = [
        row
        for row in records.list_records(500)
        if row.get("article_en") and is_rebuild_candidate(row)
    ]
    rows.reverse()
    return rows


def pending_rebuild_count() -> int:
    return len(pending_rebuild_records())


def piggyback_rebuild_tick() -> int:
    """Advance one strict-priority legacy rebuild step.

    Returns the pending query count: 0 skips the lane entirely; otherwise
    exactly one ready record is advanced. An existing queue job owns the lane
    until it finishes; failed records back off without being dropped.
    """
    pending = pending_rebuild_records()
    if not pending:
        return 0

    current_time = time.time()
    active = [
        row for row in pending
        if isinstance(row.get("rebuild_audio_job"), dict)
        and row.get("rebuild_audio_job")
    ]
    ready_active = [
        row for row in active
        if float(row.get("rebuild_not_before") or 0.0) <= current_time
    ]
    if active and not ready_active:
        return len(pending)
    ready = [
        row for row in pending
        if float(row.get("rebuild_not_before") or 0.0) <= current_time
    ]
    if not ready:
        return len(pending)
    record = ready_active[0] if ready_active else ready[0]
    record_id = str(record.get("id") or "")
    current = records.get_record(record_id) or record
    op = operation_service.create_or_get(
        kind=_REBUILD_OP_KIND,
        scope="agent_history",
        initial_message="Rebuilding legacy article audio (sentence-concat upgrade)",
    )
    operation_event_service.log_event(
        op.id,
        "info",
        "audio_rebuild.start",
        f"Piggyback audio rebuild {record_id} "
        f"({len(pending)} pending, old-first): {str(record.get('title_en') or '')[:80]}",
        None,
    )
    try:
        result = rebuild_record(current)
    except Exception as exc:  # noqa: BLE001 - counted, parked after the cap
        records.mark_rebuild_failed(record_id)
        operation_event_service.log_event(
            op.id,
            "warn",
            "audio_rebuild.failed",
            f"Audio rebuild failed for {record_id} "
            f"(attempt {int(record.get('rebuild_attempts') or 0) + 1}): {exc}",
            None,
        )
        ColorPrint.yellow(f"[AgentHistoryRebuild] {record_id}: {exc}")
        return len(pending)

    if result.get("status") == "waiting":
        records.mark_audio_rebuild_waiting(
            record_id,
            result.get("job") or {},
            float(result.get("poll_after_s") or 0.0),
        )
        operation_event_service.log_event(
            op.id,
            "info",
            "audio_rebuild.waiting",
            f"Rebuild job {record_id}: status={str((result.get('job') or {}).get('status') or 'pending')} "
            f"running_ms={int((result.get('job') or {}).get('running_elapsed_ms') or 0)} "
            f"queue_pending={int((result.get('job') or {}).get('queue_pending') or 0)} "
            f"next_poll_s={float(result.get('poll_after_s') or 0.0):g}",
            None,
        )
        return len(pending)
    if result.get("status") == "failed":
        records.mark_rebuild_failed(record_id)
        operation_event_service.log_event(
            op.id,
            "warn",
            "audio_rebuild.failed",
            f"Audio rebuild failed for {record_id}: {result.get('error') or 'unknown error'}",
            None,
        )
        return len(pending)

    delivery = "pending-upload-lane" if result.get("delivery_pending") else "delivered"
    operation_event_service.log_event(
        op.id,
        "info",
        "audio_rebuild.generated",
        f"Rebuilt {record_id}: engine={result.get('engine') or 'unknown'} "
        f"model={result.get('model') or '-'} multi_sentence=yes "
        f"bytes={result.get('bytes')} laravel={delivery}",
        None,
    )
    if pending_rebuild_count() == 0:
        operation_service.complete(op.id, "All legacy audio is multi-sentence")
    return len(pending)


def rebuild_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Regenerate one record's audio as multi-sentence and commit it LOCALLY.

    Idempotent generation step: a record that already carries the marker AND
    has its local audio file is left untouched (its delivery, if still
    pending, is the upload lane's business). No Laravel call happens here -
    connectivity never gates generation."""
    record_id = str(record.get("id") or "")
    article_en = str(record.get("article_en") or "").strip()
    if not record_id or not article_en:
        raise ValueError("record is missing its id or article body")

    current = records.get_record(record_id) or record
    if bool(current.get("tts_chunked")) and records.audio_path(record_id) is not None:
        return {
            "engine": current.get("tts_engine"),
            "model": current.get("tts_model"),
            "bytes": 0,
            "generated": False,
            "delivery_pending": _delivery_pending(current),
        }

    attempt = int(current.get("rebuild_attempts") or 0) + 1
    result = advance_audio_synthesis(
        article_en,
        current.get("rebuild_audio_job") if isinstance(current.get("rebuild_audio_job"), dict) else None,
        f"agent-history-rebuild:{record_id}:{attempt}",
    )
    if result.get("status") != "done":
        return result
    audio = result.get("audio") or {}
    audio_bytes = base64.b64decode(str(audio.get("audio_base64") or ""))
    if not audio_bytes:
        raise RuntimeError("rebuild synthesis produced no audio")
    if not bool(audio.get("chunked")):
        # The pinned stage must always report multi-sentence synthesis; a
        # non-chunked result would perpetuate exactly the legacy defect this
        # lane exists to remove - never stamp it.
        raise RuntimeError("rebuild synthesis was not multi-sentence (chunked=false)")

    records.mark_audio_rebuilt(
        record_id,
        audio_bytes,
        tts_engine=audio.get("engine"),
        tts_model=audio.get("model"),
        tts_chunked=True,
    )
    return {
        "status": "done",
        "engine": audio.get("engine"),
        "model": audio.get("model"),
        "bytes": len(audio_bytes),
        "generated": True,
        "delivery_pending": _delivery_pending(record),
    }


def _delivery_pending(record: Dict[str, Any]) -> bool:
    """Whether the regenerated audio still owes Laravel main a delivery.

    Never-uploaded records deliver through their first full submit; uploaded
    records owe an audio replacement (``rebuild_uploaded`` unset)."""
    if not bool(record.get("uploaded")):
        return True
    return not bool(record.get("rebuild_uploaded"))


__all__ = [
    "is_rebuild_candidate",
    "pending_rebuild_records",
    "pending_rebuild_count",
    "piggyback_rebuild_tick",
    "rebuild_record",
]
