# -*- coding: utf-8 -*-
"""Legacy-audio rebuild lane for the agent-history pipeline (extension library).

Article audio is PINNED to the local Qwen3-TTS multi-sentence pipeline
(engine_policy ``agent_history`` profile). Audio generated before that
contract - by the legacy single-shot Qwen server or by the pre-pin fallback
era (ChattTS long single-shot, which degrades the same way - 2noise/ChatTTS#113:
one generation <=30s) - carries NO ``tts_chunked`` marker on its record:
missing data is exactly what identifies legacy audio (single pipeline, no
version negotiation - the marker says "multi-sentence synthesized").

While the generation tick runs, this lane piggybacks a candidate scan: every
uploaded record without the marker is re-synthesized through the SAME pinned
audio stage as new articles (qwen3tts, multi-sentence) and its audio is
replaced on Laravel through the worker replace-audio endpoint (public
audio_url stays stable).

Ordering contract: rebuilds always run old-first - a tick that rebuilds never
starts new work in the same tick, so the legacy backlog drains completely
before new articles proceed. A piggyback query returning 0 candidates skips
the lane entirely and costs one local index scan (milliseconds); after the
backlog is drained every subsequent tick just generates new work. One record
is rebuilt per tick so the heartbeat cadence matches the existing
one-stage-per-tick pipeline rhythm.
"""

import base64
from typing import Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.operation_event_service import operation_event_service
from pycore.pyutils.common.operation_service import operation_service
from pycore.pyutils.agent_history import article_records as records
from pycore.pyctl.agent_history.pipeline.audio_stage import synthesize_audio
from pycore.pyctl.agent_history.pipeline.laravel_stage import replace_audio_on_laravel

# A record that keeps failing (poison text, unreachable Laravel) is retried on
# subsequent ticks and then parked so it can never block the lane forever.
MAX_REBUILD_ATTEMPTS = 3

# Deliberately NOT prefixed "agent_history": the worker's active-operation
# scan adopts startswith("agent_history") operations as batch items, and this
# lane's log operation must never be adopted. The scope keeps its events
# visible in the agent_history UI snapshot.
_REBUILD_OP_KIND = "audio_rebuild"


def is_rebuild_candidate(record: Dict[str, Any]) -> bool:
    """Uploaded audio whose record lacks the multi-sentence marker.

    Engine-agnostic by design: the marker is the ONLY criterion (missing data
    = legacy), and regeneration always runs through the pinned qwen3tts
    stage, so any pre-contract engine's audio (legacy qwen single-shot, the
    ChattTS fallback era) converges on the same multi-sentence pipeline."""
    if not bool(record.get("uploaded")):
        return False
    if int(record.get("rebuild_attempts") or 0) >= MAX_REBUILD_ATTEMPTS:
        return False
    return not bool(record.get("tts_chunked"))


def pending_rebuild_records() -> List[Dict[str, Any]]:
    """The piggyback query: legacy records to regenerate, oldest first.

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
    """Piggyback scan on the generation tick.

    Returns the pending query count: 0 skips the lane (caller proceeds with
    new work); otherwise exactly ONE record (the oldest) is rebuilt and the
    caller must return immediately so new work waits for the backlog.
    """
    pending = pending_rebuild_records()
    if not pending:
        return 0

    record = pending[0]
    record_id = str(record.get("id") or "")
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
        result = rebuild_record(record)
    except Exception as exc:  # noqa: BLE001 — counted, parked after the cap
        records.mark_rebuild_failed(record_id)
        operation_event_service.log_event(
            op.id,
            "warn",
            "audio_rebuild.failed",
            f"Audio rebuild failed for {record_id} "
            f"(attempt {int(record.get('rebuild_attempts') or 0) + 1}/{MAX_REBUILD_ATTEMPTS}): {exc}",
            None,
        )
        ColorPrint.yellow(f"[AgentHistoryRebuild] {record_id}: {exc}")
        return len(pending)

    operation_event_service.log_event(
        op.id,
        "info",
        "audio_rebuild.replaced",
        f"Rebuilt {record_id}: engine={result.get('engine') or 'unknown'} "
        f"model={result.get('model') or '-'} multi_sentence=yes "
        f"bytes={result.get('bytes')} laravel=replaced",
        None,
    )
    return len(pending)


def rebuild_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Regenerate one record's audio end-to-end: same synthesis stage as new
    articles -> Laravel audio replacement -> local all-or-nothing re-stamp."""
    record_id = str(record.get("id") or "")
    article_en = str(record.get("article_en") or "").strip()
    if not record_id or not article_en:
        raise ValueError("record is missing its id or article body")

    audio = synthesize_audio(article_en)
    audio_bytes = base64.b64decode(str(audio.get("audio_base64") or ""))
    if not audio_bytes:
        raise RuntimeError("rebuild synthesis produced no audio")

    # Laravel first: a failed replace leaves the record unstamped so the next
    # tick retries the whole record; local state never diverges from Laravel.
    laravel_data = replace_audio_on_laravel(record, audio)
    records.mark_audio_rebuilt(
        record_id,
        audio_bytes,
        tts_engine=audio.get("engine"),
        tts_model=audio.get("model"),
        tts_chunked=bool(audio.get("chunked")),
        laravel_data=laravel_data,
    )
    return {
        "engine": audio.get("engine"),
        "model": audio.get("model"),
        "bytes": len(audio_bytes),
    }


__all__ = [
    "MAX_REBUILD_ATTEMPTS",
    "is_rebuild_candidate",
    "pending_rebuild_records",
    "pending_rebuild_count",
    "piggyback_rebuild_tick",
    "rebuild_record",
]
