# -*- coding: utf-8 -*-
import base64
import time
import traceback
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.operation_service import operation_service
from pycore.pyutils.common.operation_event_service import operation_event_service
from pycore.pyctl.agent_history.pipeline.config import (
    advance_tool_cursor,
    get_config,
    mark_tool_live_item_completed,
    save_config,
)
from pycore.pyctl.agent_history.pipeline.planner import plan_batches
from pycore.pyctl.agent_history.pipeline.article_stages import (
    ensure_openrouter_available,
    generate_chinese_article,
    translate_to_english,
)
from pycore.pyctl.agent_history.pipeline.audio_stage import advance_audio_synthesis
from pycore.pyctl.agent_history.pipeline import audio_rebuild
from pycore.pyctl.agent_history.pipeline.laravel_stage import (
    replace_audio_on_laravel,
    upload_to_laravel,
)
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.common.ai_request_failures import AiRequestError, classify_ai_failure
import pycore.pyutils.agent_history.article_records as records

class _RunGate:
    """Own the pipeline run token on one THREAD_BUS-backed state thread."""
    def __init__(self) -> None:
        self._token: Optional[object] = None
        init_serialized_owner(self, "agent_history.run_gate", "AgentHistoryRunGate")

    @serialized_method
    def acquire(self) -> Optional[object]:
        if self._token is not None:
            return None
        self._token = object()
        return self._token

    @serialized_method
    def release(self, token: object) -> None:
        if self._token is token:
            self._token = None

_run_gate = _RunGate()

# Every failed pipeline item is bounded. Queue waiting is represented as a
# running checkpoint and does not consume attempts.
MAX_ITEM_ATTEMPTS = 30

def _try_acquire_run() -> Optional[object]:
    return _run_gate.acquire()

def _release_run(token: object) -> None:
    _run_gate.release(token)

def _item_deferred(item) -> bool:
    """Head item is waiting out a provider cooldown (retry_not_before)."""
    checkpoint = item.checkpoint_json or {}
    return float(checkpoint.get("retry_not_before") or 0.0) > time.time()

def recover_nonterminal_operations() -> Dict[str, Any]:
    """Mark interrupted agent-history operations for UI recovery after restart."""
    op_service = operation_service
    event_service = operation_event_service
    recovered: List[str] = []
    for op in op_service.repo.list_nonterminal_operations(limit=50):
        if not str(op.kind).startswith("agent_history"):
            continue
        event_service.log_event(
            op.id,
            "info",
            "operation.recovery",
            f"Recovered non-terminal operation {op.kind} at stage {op.stage}",
            None,
        )
        recovered.append(op.id)
    return {"recovered": recovered, "count": len(recovered)}


def tick_pipeline() -> None:
    """Process one stage of one item per heartbeat."""
    cfg = get_config()
    if not cfg.get("enabled") or not cfg.get("extract_as_article"):
        return
        
    phase = str(cfg.get("phase") or "idle")
    if phase not in ("backfill", "live"):
        return
        
    token = _try_acquire_run()
    if token is None:
        return
        
    try:
        op_service = operation_service
        event_service = operation_event_service

        active_ops = [
            op for op in op_service.repo.list_nonterminal_operations(limit=10)
            if str(op.kind).startswith("agent_history")
        ]
        if active_ops:
            op = active_ops[0]
            items = op_service.get_operation_items(op.id)
            # Failed items below the retry cap stay pending — a transient TTS /
            # network error must not silently lose the whole article (the "no
            # audio" reports). Terminal = succeeded/skipped/cancelled, or failed
            # after MAX_ITEM_ATTEMPTS attempts.
            pending_items = [item for item in items if not _is_item_terminal(item)]
            if not pending_items:
                # Close stale terminal operations before legacy generation so
                # a previously exhausted item cannot remain at the queue head.
                any_failed = any(item.status == "failed" for item in items)
                if any_failed:
                    failed_item = next(item for item in items if item.status == "failed")
                    _advance_cursor_for_input(failed_item.input_json or {})
                    op_service.fail(op.id, {"message": "one or more items failed"}, "Operation failed")
                else:
                    op_service.complete(op.id, "All items finished")
                active_ops = []

        # Legacy audio is a strict prerequisite. A bounded set of independent
        # rebuild steps feeds the shared Qwen queue so it can batch and run in
        # parallel until every record is multi-sentence.
        if audio_rebuild.pending_rebuild_count() > 0:
            audio_rebuild.piggyback_rebuild_tick()
            return

        if active_ops:
            op = active_ops[0]
            items = op_service.get_operation_items(op.id)
            pending_items = [item for item in items if not _is_item_terminal(item)]
            if pending_items:
                item = pending_items[0]
                if _item_deferred(item):
                    return
                try:
                    if _process_item(item, op_service, event_service):
                        _advance_cursor_for_input(item.input_json or {})
                except Exception as e:
                    _fail_item(item, e, op_service)
                return

        items, pending = plan_batches()
        if not items:
            return

        # Create a mini-operation for this batch if we don't have one
        op = op_service.create_operation(
            kind=f"agent_history_{phase}",
            scope="agent_history",
            items_data=[items[0]],
            initial_message=f"Processing batch: {items[0]['word_count']} words",
        )
        event_service.log_event(
            op.id,
            "info",
            "operation.startup",
            f"Planned 1 item from {pending} pending fragments",
            None,
        )
        
        item = op_service.get_operation_items(op.id)[0]
        
        try:
            completed = _process_item(item, op_service, event_service)
            if completed:
                _advance_cursor_for_input(items[0])
                cfg = get_config()
                cfg["cursor"]["attempts"] = 0
                save_config(cfg)
            
        except Exception as e:
            err = str(e)
            _fail_item(item, e, op_service)
            
            cfg = get_config()
            attempts = int(cfg["cursor"].get("attempts") or 0) + 1
            cfg["cursor"]["attempts"] = attempts
            save_config(cfg)
            
            ColorPrint.yellow(f"[AgentHistoryPipeline] batch failed: {err}")
            
    finally:
        _release_run(token)

def _advance_cursor_for_input(input_data: Dict[str, Any]) -> None:
    """Advance one tool's completed lane and rotate backfill fairly."""
    tool = str(input_data.get("tool") or "")
    if not tool:
        return
    cfg = get_config()
    lane = str(input_data.get("lane") or "backfill")
    after_ts = int(input_data.get("last_ts") or 0)
    after_fragment_id = str(input_data.get("last_fragment_id") or "")
    if lane == "live":
        mark_tool_live_item_completed(
            cfg,
            tool,
            str(input_data.get("item_key") or ""),
            after_ts,
            after_fragment_id,
        )
    else:
        advance_tool_cursor(cfg, tool, after_ts, after_fragment_id)
    cfg["last_tool"] = tool
    save_config(cfg)

def _fail_item(item, error: Exception, op_service: Any) -> None:
    """Mark an item failed, KEEPING its checkpoint so a retry resumes the stage.

    The complete failure context is preserved and published - nothing is
    flattened to a one-liner: ``error_json`` carries the message, code,
    retriability, and the FULL traceback, and the ``item.failed`` event
    payload carries ``error_json`` verbatim so the UI log can show every
    detail on click.
    """
    item = op_service.repo.get_operation_item(item.id) or item
    err = str(error)
    failure = classify_ai_failure(err)
    retriable = error.retriable if isinstance(error, AiRequestError) else bool(failure["retriable"])
    error_code = error.code if isinstance(error, AiRequestError) else str(failure["code"] or "pipeline_error")
    if error_code in ("none", "unknown"):
        error_code = "pipeline_error"
    retry_after_s = error.retry_after_s if isinstance(error, AiRequestError) else None
    tb = "".join(
        traceback.format_exception(type(error), error, error.__traceback__)
    ).rstrip()
    checkpoint = dict(item.checkpoint_json or {})
    if retriable and retry_after_s:
        checkpoint["retry_not_before"] = time.time() + float(retry_after_s)
        checkpoint["retry_reason_code"] = error_code
    error_json = {
        "message": err,
        "code": error_code,
        "retriable": retriable,
        "retry_after_s": retry_after_s,
        "traceback": tb,
    }
    op_service.transition_item(
        item.id,
        status="failed",
        stage=item.stage,
        checkpoint_json=checkpoint,
        error_json=error_json,
        message=f"Item failed [{error_code}]: {err}",
    )

def _piggyback_upload_tick() -> None:
    """Advance one minimum step in each Laravel delivery lane.

    Two ordered halves, each record one independent idempotent step (one
    record's failure never affects the next):
      1. full submits - generated articles whose upload never succeeded
         (network reset, endpoint down at stage 5). Retried from the saved
         record - no regeneration, no extra OpenRouter request. A submit
         stamps ``uploaded`` and, for already multi-sentence audio,
         ``rebuild_uploaded`` (Laravel now serves that audio).
      2. audio replacements - published records whose regenerated
         multi-sentence audio has not replaced the legacy bytes yet
         (``rebuild_uploaded`` unset). Stamps ``rebuild_uploaded``.

    Each failed record owns its retry counter and bounded backoff. A failure
    therefore defers only that record and cannot block later audio forever."""
    if not laravel_endpoint_manager.resolve():
        return
    _drain_initial_uploads()
    _drain_rebuild_uploads()


def tick_upload() -> None:
    """Advance deferred Laravel delivery independently from local generation."""
    cfg = get_config()
    if not cfg.get("enabled") or not cfg.get("extract_as_article"):
        return
    _piggyback_upload_tick()


def _drain_initial_uploads() -> None:
    try:
        pending = records.pending_uploads()
    except Exception:  # noqa: BLE001 - lane must never break the tick
        return
    record = pending[0] if pending else None
    if not isinstance(record, dict):
        return
    record_id = str(record.get("id") or "")
    if not record_id:
        return
    try:
        audio_bytes = records.read_audio(record_id)
        audio: Dict[str, Any] = {}
        if audio_bytes:
            audio["audio_base64"] = base64.b64encode(audio_bytes).decode("ascii")
            audio["engine"] = record.get("tts_engine") or "local"
            audio["model"] = record.get("tts_model")
            audio["chunked"] = bool(record.get("tts_chunked"))
        laravel_data = upload_to_laravel(
            {
                "title_en": record.get("title_en"),
                "title_cn": record.get("title_cn"),
                "reference_cn": record.get("reference_cn"),
                "article_en": record.get("article_en"),
            },
            audio,
            "",
            record_id,
        )
        records.mark_uploaded(record_id, laravel_data)
        ColorPrint.green(
            f"[AgentHistoryPipeline] deferred upload succeeded for record {record_id}: "
            f"{laravel_data.get('article_id')}"
        )
    except Exception as exc:  # noqa: BLE001 - defer only this record
        records.mark_upload_failed(record_id, str(exc))
        ColorPrint.gray(f"[AgentHistoryPipeline] upload retry deferred ({record_id}): {exc}")


def _drain_rebuild_uploads() -> None:
    try:
        pending = records.pending_rebuild_uploads()
    except Exception:  # noqa: BLE001 - lane must never break the tick
        return
    record = pending[0] if pending else None
    if not isinstance(record, dict):
        return
    record_id = str(record.get("id") or "")
    if not record_id:
        return
    try:
        audio_bytes = records.read_audio(record_id) or b""
        if not audio_bytes:
            # The local multi-sentence file is gone - clear the marker so
            # the rebuild lane regenerates the record instead of the
            # upload lane retrying an impossible delivery forever.
            records.clear_rebuild_marker(record_id)
            return
        laravel_data = replace_audio_on_laravel(
            record,
            {
                "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
                "engine": record.get("tts_engine") or "local",
                "model": record.get("tts_model"),
                "chunked": bool(record.get("tts_chunked")),
            },
        )
        records.mark_rebuild_uploaded(record_id, laravel_data)
        ColorPrint.green(
            f"[AgentHistoryPipeline] rebuilt audio replaced on Laravel for record {record_id}: "
            f"{laravel_data.get('article_id')}"
        )
    except Exception as exc:  # noqa: BLE001 - defer only this record
        records.mark_rebuild_upload_failed(record_id, str(exc))
        ColorPrint.gray(f"[AgentHistoryPipeline] rebuild upload deferred ({record_id}): {exc}")


def _is_item_terminal(item) -> bool:
    """Terminal = done/skipped/cancelled, or failed past the retry cap."""
    if item.status in ("succeeded", "skipped", "cancelled"):
        return True
    if item.status == "failed":
        return int(item.attempts or 0) >= MAX_ITEM_ATTEMPTS
    return False

def _process_item(item, op_service: Any, event_service: Any) -> bool:
    """Drive an item through one stage. Returns True only when the item
    reached the terminal succeeded stage in this call."""
    checkpoint = item.checkpoint_json or {}
    input_data = item.input_json or {}
    raw_text = input_data.get("raw_text", "")
    retry_not_before = float(checkpoint.get("retry_not_before") or 0.0)
    if retry_not_before > time.time():
        return False
    checkpoint.pop("retry_not_before", None)
    checkpoint.pop("retry_reason_code", None)
    request_context = {
        "operation_id": item.operation_id,
        "item_id": item.id,
        "attempt": int(item.attempts or 0) + 1,
        "stage": item.stage,
        "tool": str(input_data.get("tool") or ""),
        "lane": str(input_data.get("lane") or ""),
    }
    
    # Stage 1: generating_reference_cn
    if item.stage in ("queued", "generating_reference_cn"):
        ensure_openrouter_available()
        op_service.transition_item(item.id, "running", "generating_reference_cn", 0.1, message="Generating Chinese article")
        article_cn = generate_chinese_article(raw_text, request_context)
        checkpoint["article_cn"] = article_cn
        op_service.transition_item(item.id, "running", "translating_target_en", 0.3, checkpoint_json=checkpoint)
        
    # Stage 2: translating_target_en
    if item.stage == "translating_target_en":
        ensure_openrouter_available()
        op_service.transition_item(item.id, "running", "translating_target_en", 0.3, message="Translating to English")
        article_en, engine = translate_to_english(checkpoint["article_cn"], request_context)
        checkpoint["article_en"] = article_en
        checkpoint["translation_engine"] = engine
        op_service.transition_item(item.id, "running", "synthesizing_audio", 0.5, checkpoint_json=checkpoint)
        
    # Stage 3: synthesize the full article locally before Laravel submission.
    # Laravel also queues every parsed sentence independently for missing-audio
    # completion through the central sentence_audio lane.
    if item.stage == "synthesizing_audio":
        audio_step = advance_audio_synthesis(
            checkpoint["article_en"]["article_en"],
            checkpoint.get("audio_job") if isinstance(checkpoint.get("audio_job"), dict) else None,
            f"agent-history-item:{item.id}:{int(checkpoint.get('audio_attempt') or 1)}",
        )
        checkpoint["audio_job"] = audio_step.get("job") or {}
        if audio_step.get("status") == "waiting":
            poll_after_s = float(audio_step.get("poll_after_s") or 1.0)
            checkpoint["retry_not_before"] = time.time() + poll_after_s
            job = checkpoint["audio_job"]
            op_service.transition_item(
                item.id,
                "running",
                "synthesizing_audio",
                0.5,
                checkpoint_json=checkpoint,
                message=(
                    "Qwen synthesis "
                    f"{str(job.get('status') or 'pending')}; "
                    f"running_ms={int(job.get('running_elapsed_ms') or 0)}; "
                    f"next_poll_s={poll_after_s:g}"
                ),
            )
            return False
        if audio_step.get("status") == "failed":
            checkpoint["audio_attempt"] = int(checkpoint.get("audio_attempt") or 1) + 1
            checkpoint.pop("audio_job", None)
            op_service.transition_item(
                item.id,
                "running",
                "synthesizing_audio",
                0.5,
                checkpoint_json=checkpoint,
                message="Qwen synthesis job failed",
            )
            raise RuntimeError(str(audio_step.get("error") or "Qwen synthesis failed"))
        checkpoint["audio"] = audio_step["audio"]
        checkpoint.pop("audio_job", None)
        checkpoint.pop("audio_attempt", None)
        audio_source = checkpoint["audio"]
        event_service.log_event(
            item.operation_id,
            "info",
            "item.audio_synthesized",
            "Audio source: engine="
            + str(audio_source.get("engine") or "unknown")
            + " model=" + str(audio_source.get("model") or "-")
            + " multi_sentence=" + str(bool(audio_source.get("chunked")))
            + " bytes=" + str(int(audio_source.get("bytes") or 0)),
            item.id,
        )
        op_service.transition_item(item.id, "running", "saving_local_result", 0.7, checkpoint_json=checkpoint)
        
    # Stage 4: saving_local_result
    if item.stage == "saving_local_result":
        op_service.transition_item(item.id, "running", "saving_local_result", 0.7, message="Saving local record")
        article_en_data = checkpoint["article_en"]
        article_cn_data = checkpoint["article_cn"]
        audio_data = checkpoint.get("audio") or {}
        audio_base64 = str(audio_data.get("audio_base64") or "")
        audio_bytes = base64.b64decode(audio_base64) if audio_base64 else b""
        
        record_id = str(checkpoint.get("record_id") or f"article-{item.id}")
        existing_record = records.get_record(record_id) or {}
        record = records.save_record({
            **existing_record,
            "id": record_id,
            "created_at": existing_record.get("created_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "title_cn": article_cn_data.get("title_cn"),
            "title_en": article_en_data.get("title_en"),
            "reference_cn": article_cn_data.get("reference_cn"),
            "article_en": article_en_data.get("article_en"),
            "word_count": count_words(article_en_data.get("article_en", "")),
            "openrouter_model": article_cn_data.get("used_model"),
            "translation_engine": checkpoint.get("translation_engine"),
            "tts_engine": audio_data.get("engine"),
            "tts_model": audio_data.get("model"),
            "tts_chunked": bool(audio_data.get("chunked")),
        }, audio_bytes)
        
        checkpoint["record_id"] = record["id"]
        op_service.transition_item(item.id, "running", "uploading_laravel", 0.8, checkpoint_json=checkpoint)
        
    # Stage 5: local completion. Laravel delivery is an independent heartbeat
    # lane, so an offline backend never gates article or audio generation.
    if item.stage == "uploading_laravel":
        op_service.transition_item(
            item.id,
            "succeeded",
            "completed",
            1.0,
            checkpoint_json=checkpoint,
            result_json=checkpoint,
            message="Item completed successfully"
        )
        return True
    return False


def count_words(text: str) -> int:
    return len([w for w in text.split() if w.strip()])


__all__ = ["recover_nonterminal_operations", "tick_pipeline", "tick_upload"]
