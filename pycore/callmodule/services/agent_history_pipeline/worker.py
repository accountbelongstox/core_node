# -*- coding: utf-8 -*-
import base64
import time
import uuid
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.callmodule.services.operation_service import OperationService
from pycore.callmodule.services.operation_event_service import OperationEventService
from pycore.callmodule.services.agent_history_pipeline.config import (
    advance_tool_cursor,
    get_config,
    save_config,
)
from pycore.callmodule.services.agent_history_pipeline.planner import plan_batches
from pycore.callmodule.services.agent_history_pipeline.article_stages import generate_chinese_article, translate_to_english
from pycore.callmodule.services.agent_history_pipeline.audio_stage import synthesize_audio
from pycore.callmodule.services.agent_history_pipeline.laravel_stage import upload_to_laravel
import pycore.callmodule.services.agent_history_article_records as records

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

# A failed pipeline item is retried until this many attempts, then stays failed
# (transient TTS / network errors must not silently drop the whole article).
# One attempt per 10s tick, so 30 attempts ≈ 5 minutes of retry — long enough
# for a cold-loading local TTS engine, bounded enough to drop a poison batch.
MAX_ITEM_ATTEMPTS = 30

def _try_acquire_run() -> Optional[object]:
    return _run_gate.acquire()

def _release_run(token: object) -> None:
    _run_gate.release(token)

def start_backfill() -> Dict[str, Any]:
    """Start a new backfill operation."""
    token = _try_acquire_run()
    if token is None:
        return {"busy": True}
        
    try:
        save_config({
            "enabled": True,
            "extract_as_article": True,
            "phase": "backfill",
            "live_listen": True,
        })
        
        cfg = get_config()
        cfg["cursor"] = {
            "fragment_index": 0,
            "after_ts": 0,
            "after_fragment_id": "",
            "raw_index": 0,
            "attempts": 0,
        }
        cfg["cursors"] = {}
        cfg["last_tool"] = ""
        save_config(cfg)
        
        items, pending = plan_batches(live=False)
        
        op_service = OperationService()
        op = op_service.create_operation(
            kind="agent_history_backfill",
            scope="agent_history",
            items_data=items,
            initial_message=f"Pipeline restarted: backfill ({pending} fragments pending, {len(items)} batches planned)",
        )
        OperationEventService().log_event(
            op.id,
            "info",
            "operation.startup",
            f"Accepted backfill with {len(items)} planned items ({pending} fragments pending)",
            None,
        )
        
        return {
            "started": True,
            "phase": "backfill",
            "pending_fragments": pending,
            "operation_id": op.id,
        }
    finally:
        _release_run(token)

def recover_nonterminal_operations() -> Dict[str, Any]:
    """Mark interrupted agent-history operations for UI recovery after restart."""
    op_service = OperationService()
    event_service = OperationEventService()
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
        op_service = OperationService()
        event_service = OperationEventService()

        # Best-effort: one deferred Laravel upload per tick. A generated
        # article must eventually reach laravel even if the first upload
        # failed (network reset, endpoint down) — never regenerated.
        _retry_pending_upload()

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
            if pending_items:
                item = pending_items[0]
                try:
                    if _process_item(item, op_service, event_service):
                        # Item reached the succeeded stage — advance its tool
                        # cursor so completed batches are never re-planned.
                        _advance_cursor_for_input(item.input_json or {})
                except Exception as e:
                    _fail_item(item, e, op_service)
                return
            # All items terminal but the operation itself was never closed.
            # Close it so create_or_get stops reusing it (avoids repeated
            # UNIQUE constraint failures on (operation_id, item_key)).
            any_failed = any(item.status == "failed" for item in items)
            if any_failed:
                op_service.fail(op.id, {"message": "one or more items failed"}, "Operation failed")
            else:
                op_service.complete(op.id, "All items finished")
        
        items, pending = plan_batches(live=(phase == "live"))
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
            _process_item(item, op_service, event_service)

            # Advance the per-tool cursor (forward only) and rotate to the
            # next tool so every AI is processed evenly.
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
    """Advance the per-tool cursor (forward only) from a planned item's input
    and rotate to the next tool so every AI is processed evenly."""
    tool = str(input_data.get("tool") or "")
    if not tool:
        return
    cfg = get_config()
    advance_tool_cursor(
        cfg,
        tool,
        int(input_data.get("last_ts") or 0),
        str(input_data.get("last_fragment_id") or ""),
    )
    cfg["last_tool"] = tool
    save_config(cfg)

def _fail_item(item, error: Exception, op_service: OperationService) -> None:
    """Mark an item failed, KEEPING its checkpoint so a retry resumes the stage."""
    err = str(error)
    op_service.transition_item(
        item.id,
        status="failed",
        stage=item.stage,
        checkpoint_json=item.checkpoint_json,
        error_json={"message": err},
        message=f"Item failed: {err}",
    )

def _retry_pending_upload() -> None:
    """Re-upload one locally saved article that never reached Laravel.

    Upload failure at stage 5 is best-effort (the item still succeeds), so
    without this retry a generated bilingual article + audio could stay local
    forever. Retried from the saved record — no regeneration, no extra
    OpenRouter request.
    """
    try:
        pending = records.pending_uploads()
    except Exception:
        return
    if not pending:
        return
    record = pending[0]
    record_id = str(record.get("id") or "")
    if not record_id:
        return
    try:
        audio_bytes = records.read_audio(record_id)
        audio: Dict[str, Any] = {}
        if audio_bytes:
            audio["audio_base64"] = base64.b64encode(audio_bytes).decode("ascii")
            audio["engine"] = record.get("tts_engine") or "local"
        laravel_data = upload_to_laravel(
            {
                "title_en": record.get("title_en"),
                "title_cn": record.get("title_cn"),
                "reference_cn": record.get("reference_cn"),
                "article_en": record.get("article_en"),
            },
            audio,
            "",
        )
        records.mark_uploaded(record_id)
        ColorPrint.green(
            f"[AgentHistoryPipeline] deferred upload succeeded for record {record_id}: "
            f"{laravel_data.get('article_id')}"
        )
    except Exception as exc:  # noqa: BLE001 — retry again on the next tick
        ColorPrint.gray(f"[AgentHistoryPipeline] upload retry deferred: {exc}")

def _is_item_terminal(item) -> bool:
    """Terminal = done/skipped/cancelled, or failed past the retry cap."""
    if item.status in ("succeeded", "skipped", "cancelled"):
        return True
    if item.status == "failed":
        return int(item.attempts or 0) >= MAX_ITEM_ATTEMPTS
    return False

def _process_item(item, op_service: OperationService, event_service: OperationEventService) -> bool:
    """Drive an item through one stage. Returns True only when the item
    reached the terminal succeeded stage in this call."""
    checkpoint = item.checkpoint_json or {}
    input_data = item.input_json or {}
    raw_text = input_data.get("raw_text", "")
    
    # Stage 1: generating_reference_cn
    if item.stage in ("queued", "generating_reference_cn"):
        op_service.transition_item(item.id, "running", "generating_reference_cn", 0.1, message="Generating Chinese article")
        article_cn = generate_chinese_article(raw_text)
        checkpoint["article_cn"] = article_cn
        op_service.transition_item(item.id, "running", "translating_target_en", 0.3, checkpoint_json=checkpoint)
        
    # Stage 2: translating_target_en
    if item.stage == "translating_target_en":
        op_service.transition_item(item.id, "running", "translating_target_en", 0.3, message="Translating to English")
        article_en, engine = translate_to_english(checkpoint["article_cn"])
        checkpoint["article_en"] = article_en
        checkpoint["translation_engine"] = engine
        op_service.transition_item(item.id, "running", "synthesizing_audio", 0.5, checkpoint_json=checkpoint)
        
    # Stage 3: synthesizing_audio
    if item.stage == "synthesizing_audio":
        op_service.transition_item(item.id, "running", "synthesizing_audio", 0.5, message="Synthesizing audio")
        audio = synthesize_audio(checkpoint["article_en"]["article_en"])
        checkpoint["audio"] = audio
        op_service.transition_item(item.id, "running", "saving_local_result", 0.7, checkpoint_json=checkpoint)
        
    # Stage 4: saving_local_result
    if item.stage == "saving_local_result":
        op_service.transition_item(item.id, "running", "saving_local_result", 0.7, message="Saving local record")
        article_en_data = checkpoint["article_en"]
        article_cn_data = checkpoint["article_cn"]
        audio_data = checkpoint["audio"]
        
        record = records.save_record({
            "id": str(uuid.uuid4()),
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "title_cn": article_cn_data.get("title_cn"),
            "title_en": article_en_data.get("title_en"),
            "reference_cn": article_cn_data.get("reference_cn"),
            "article_en": article_en_data.get("article_en"),
            "word_count": count_words(article_en_data.get("article_en", "")),
            "openrouter_model": article_cn_data.get("used_model"),
            "translation_engine": checkpoint.get("translation_engine"),
        }, base64.b64decode(audio_data["audio_base64"]))
        
        checkpoint["record_id"] = record["id"]
        op_service.transition_item(item.id, "running", "uploading_laravel", 0.8, checkpoint_json=checkpoint)
        
    # Stage 5: uploading_laravel
    if item.stage == "uploading_laravel":
        op_service.transition_item(item.id, "running", "uploading_laravel", 0.8, message="Uploading to Laravel")
        try:
            laravel_data = upload_to_laravel(
                {
                    "title_cn": checkpoint["article_cn"].get("title_cn"),
                    "reference_cn": checkpoint["article_cn"].get("reference_cn"),
                    "title_en": checkpoint["article_en"].get("title_en"),
                    "article_en": checkpoint["article_en"].get("article_en"),
                    "word_count": count_words(checkpoint["article_en"].get("article_en", "")),
                },
                checkpoint["audio"],
                raw_text,
            )
            records.mark_uploaded(checkpoint["record_id"])
            checkpoint["laravel_data"] = laravel_data
        except Exception as e:
            # Upload is best-effort, we don't fail the item
            event_service.log_event(
                item.operation_id, "warn", "item.upload_deferred", 
                f"Laravel upload deferred: {e}", item.id
            )
            
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
