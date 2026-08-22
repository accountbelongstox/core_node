# -*- coding: utf-8 -*-
"""Durable Qwen synthesis operations."""

import time
import uuid
from functools import partial
from typing import Any, Dict, Optional

from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.common.operation_service import operation_service as operations
from pycore.pyutils.tts.qwen.client import queue_cancel, queue_submit_and_wait
from pycore.pyutils.tts.qwen.config import ENGINE_NAME


def _publish_progress(item_id: str, value: Dict[str, Any]) -> None:
    completed = max(0, int(value.get("progress") or 0))
    total = max(0, int(value.get("progress_total") or 0))
    phase = str(value.get("progress_phase") or value.get("status") or "queued")
    ratio = min(0.99, completed / total) if total > 0 else 0.0
    operations.update_item_progress(
        item_id,
        ratio,
        phase,
        f"Qwen synthesis progress {completed}/{total}",
    )


def submit(scope: str, params: Dict[str, Any]) -> Dict[str, Any]:
    idempotency_key = str(params.get("idempotency_key") or "").strip() or None
    operation = operations.create_or_get(
        kind="qwen_synthesis",
        scope=scope,
        idempotency_key=idempotency_key,
        initial_message="Qwen synthesis accepted",
    )
    item_key = str(params.get("item_key") or f"syn_{uuid.uuid4().hex[:12]}")
    existing_items = operations.repo.get_operation_items(operation.id)
    if not existing_items:
        operations.start(
            operation.id,
            stage="queued",
            message="Synthesis queued",
        )
        operations.declare_items(
            operation.id,
            [{"item_key": item_key, "input_json": dict(params)}],
        )
    else:
        item_key = existing_items[0].item_key

    start_bus_task(
        _run,
        operation.id,
        item_key,
        dict(params),
        thread_name="QwenSynthesisWorker",
    )
    refreshed = operations.get_operation(operation.id)
    return {
        "operation_id": operation.id,
        "scope": scope,
        "item_key": item_key,
        "status": refreshed.status if refreshed else operation.status,
        "revision": refreshed.revision if refreshed else operation.revision,
    }


def _run(
    operation_id: str,
    item_key: str,
    params: Dict[str, Any],
) -> None:
    items = operations.repo.get_operation_items(operation_id)
    item = next((row for row in items if row.item_key == item_key), None)
    if item is None:
        return

    operations.start_item(
        item.id,
        stage="synthesizing",
        message="Synthesizing audio",
    )
    text = str(params.get("text") or "")
    language = str(params.get("language") or "en")
    speaker = params.get("speaker")
    instruct = params.get("instruct")
    audio_format = str(params.get("format") or "wav")
    payload: Dict[str, Any] = {
        "text": text,
        "language": language,
        "format": audio_format,
    }
    if speaker:
        payload["speaker"] = speaker
    if instruct:
        payload["instruct"] = instruct

    started = time.monotonic()
    try:
        with managed_services.lease(ENGINE_NAME):
            success, audio, error = queue_submit_and_wait(
                payload,
                client_job_id=f"{operation_id}:{item_key}",
                progress_callback=partial(_publish_progress, item.id),
            )
    except Exception as exc:  # noqa: BLE001
        success = False
        audio = b""
        error = str(exc) or "qwen3tts service failed to start"
    metadata = {
        "elapsed_ms": round((time.monotonic() - started) * 1000),
        "format": audio_format,
    }
    if error:
        metadata["error"] = error
    if success:
        result = {
            "meta": metadata,
            "bytes": len(audio),
            "format": audio_format,
            "speaker": speaker,
            "language": language,
        }
        operations.complete_item(
            item.id,
            result_json=result,
            message="Synthesis completed",
        )
        operations.complete(
            operation_id,
            message="Qwen synthesis operation completed",
        )
        return

    error_value = {
        "code": "synthesis_failed",
        "message": metadata.get("error", "synthesis failed"),
    }
    operations.fail_item(
        item.id,
        error_json=error_value,
        message=str(error_value["message"]),
    )
    operations.fail(
        operation_id,
        error_value,
        message=str(error_value["message"]),
    )


def status(
    operation_id: Optional[str] = None,
    scope: Optional[str] = None,
) -> Dict[str, Any]:
    snapshot = operations.get_snapshot(
        op_id=operation_id,
        scope=scope,
        include_results=True,
    )
    return snapshot or {}


def cancel(operation_id: str) -> Dict[str, Any]:
    operation = operations.request_cancel(operation_id)
    for item in operations.repo.get_operation_items(operation_id):
        queue_cancel(f"{operation_id}:{item.item_key}")
    return {
        "operation_id": operation_id,
        "status": operation.status,
        "revision": operation.revision,
    }


__all__ = ["submit", "status", "cancel"]
