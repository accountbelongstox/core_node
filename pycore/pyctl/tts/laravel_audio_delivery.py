# -*- coding: utf-8 -*-
"""Audio lane kinds of the shared Laravel delivery outbox.

Each Laravel audio lane (word, sentence) registers kind ``audio_lane.<lane>``
on ``laravel_delivery_outbox``. One row advances independently idempotent
steps: domain report (payload, deduped per ``identity``), global task result
(``result``), local task history (``history``).

A row belongs to the Laravel server that dispatched the task (namespace of
its ``base_url``, pinned): its task result can only land there. These kinds
have no inventory; the server's own task queue is its diff (an undelivered
task is released at lease timeout and dispatched again).
"""

import os
from functools import partial
from typing import Any, Dict

from pycore.pyutils.common.queue_center_contract import QUEUE_CENTER_DIFF_DELIVERY
from pycore.pyutils.laravel.delivery_outbox import (
    DELIVERY_PROCESS_ID,
    OUTCOME_DEAD_LETTER,
    OUTCOME_DONE,
    OUTCOME_RETRY,
    RECEIPTS_IDENTITY,
    DeliveryKind,
    laravel_delivery_outbox,
)

AUDIO_LANE_KIND_PREFIX = "audio_lane."
AUDIO_LANE_STEPS = ("result", "history")
AUDIO_LANE_BATCH_LIMIT = 32
AUDIO_LANE_PARALLEL_LIMIT = 4
AUDIO_LANE_RETRY_INITIAL_SECONDS = max(
    1.0,
    float(QUEUE_CENTER_DIFF_DELIVERY["consumer_upload_retry"]["initial_seconds"]),
)
AUDIO_LANE_RETRY_MAX_SECONDS = max(
    AUDIO_LANE_RETRY_INITIAL_SECONDS,
    float(QUEUE_CENTER_DIFF_DELIVERY["consumer_upload_retry"]["maximum_seconds"]),
)


def audio_lane_kind(lane: str) -> str:
    return f"{AUDIO_LANE_KIND_PREFIX}{lane}"


class AudioLaneDelivery:
    """Deliver one staged lane audio row through its Laravel steps."""

    @staticmethod
    def _terminal_report_error(detail: str) -> bool:
        normalized = str(detail or "").lower()
        return (
            normalized.startswith("server validation rejected")
            or normalized.startswith("unknown task on server")
            or (
                normalized.startswith("http 4")
                and not normalized.startswith(("http 408", "http 409", "http 425", "http 429"))
            )
        )

    def register(self, handler: Any) -> str:
        kind = audio_lane_kind(handler.LANE)
        laravel_delivery_outbox.register(DeliveryKind(
            name=kind,
            deliver=partial(self.deliver, handler),
            on_delivered=partial(self.on_delivered, handler),
            steps=AUDIO_LANE_STEPS,
            parallel=AUDIO_LANE_PARALLEL_LIMIT,
            batch_limit=AUDIO_LANE_BATCH_LIMIT,
            retry_initial_seconds=AUDIO_LANE_RETRY_INITIAL_SECONDS,
            retry_max_seconds=AUDIO_LANE_RETRY_MAX_SECONDS,
            receipts=RECEIPTS_IDENTITY,
        ))
        return kind

    @staticmethod
    def stage(handler: Any, info: Dict[str, Any], provider: str, audio_path: str, local_task_id: str) -> Dict[str, Any]:
        kind = audio_lane_kind(handler.LANE)
        attempt = max(0, int(info.get("attempt") or 0))
        return laravel_delivery_outbox.enqueue(kind, {
            "delivery_id": laravel_delivery_outbox.delivery_id(kind, info.get("task_id"), attempt),
            "identity": handler._delivery_identity(info),
            "task_id": info.get("task_id"),
            "task_type": info.get("task_type") or handler.QUEUE_KEY,
            "attempt": attempt,
            "base_url": handler._task_base_url(info.get("task_id")),
            "pin_base_url": True,
            "provider": provider,
            "info": dict(info),
            "local_task_id": local_task_id or "",
            "local_process_id": DELIVERY_PROCESS_ID,
        }, payload_file=audio_path)

    def deliver(self, handler: Any, claimed: Dict[str, Any], owner: str) -> Dict[str, Any]:
        delivery_id = str(claimed.get("delivery_id") or "")
        info = dict(claimed.get("info") or {})
        task_id = claimed.get("task_id")
        provider = str(claimed.get("provider") or "")
        audio_path = str(claimed.get("payload_path") or "")
        attempts = int(claimed.get("delivery_attempts") or 1)
        mirror = handler.LANE != "word"
        handler._remember_task_types(
            [{"task_id": task_id, "task_type": str(claimed.get("task_type") or handler.QUEUE_KEY)}],
            str(claimed.get("base_url") or handler.api_url),
        )

        if not audio_path or not os.path.isfile(audio_path):
            error = "cached audio is missing"
            handler._append_delivery_failure_history(info, provider, audio_path, error, delivery_id)
            return {"status": OUTCOME_DEAD_LETTER, "error": error}

        receipt = dict(claimed.get("identity_receipt") or {})
        domain_uploaded = bool(receipt.get("uploaded"))
        domain_error = str(receipt.get("error") or "")
        if not claimed.get("identity_delivered"):
            uploaded = handler._upload_report(info, provider, audio_path)
            if uploaded is not None and not uploaded[0]:
                error = uploaded[1]
                if not self._terminal_report_error(error):
                    retry_delay = laravel_delivery_outbox.retry_delay(
                        attempts, AUDIO_LANE_RETRY_INITIAL_SECONDS, AUDIO_LANE_RETRY_MAX_SECONDS,
                    )
                    handler._log_event("upload_retry", f"attempt={attempts} retry_in={retry_delay:.0f}s error={error}", info)
                    return {"status": OUTCOME_RETRY, "error": error}
                domain_uploaded = False
                domain_error = error
                laravel_delivery_outbox.mark_identity_delivered(delivery_id, owner, {"uploaded": False, "error": error})
                handler._log_event(
                    "upload_terminal", f"domain upload unavailable; global result fallback: {error}", info, mirror=mirror,
                )
            else:
                domain_uploaded = uploaded is not None
                domain_error = ""
                laravel_delivery_outbox.mark_identity_delivered(delivery_id, owner, {"uploaded": domain_uploaded, "error": ""})
                handler._log_event(
                    "upload_done" if domain_uploaded else "upload_skipped",
                    (
                        f"backend accepted audio (attempt={attempts})"
                        if domain_uploaded
                        else "domain upload is not required; using global result"
                    ),
                    info,
                    mirror=mirror,
                )

        info["backend_uploaded"] = domain_uploaded
        if domain_error:
            info["backend_upload_error"] = domain_error

        steps = dict(claimed.get("steps") or {})
        result_accepted = bool(steps.get("result"))
        if not result_accepted and str(info.get("_local_source") or ""):
            # Locally sourced tasks (word-audio full pull) have no global_tasks
            # row to close: the domain report above IS the whole delivery.
            result_accepted = True
            laravel_delivery_outbox.mark_step(delivery_id, owner, "result")
        if not result_accepted:
            result = handler._build_success_result(
                info,
                provider,
                audio_path,
                include_audio=not (domain_uploaded and str(info.get("kind") or "") in ("word", "sentence")),
            )
            result_meta: Dict[str, Any] = {}
            posted = handler._post_result(
                task_id,
                "completed",
                result=result,
                progress=100,
                attempts=1,
                attempt=info.get("attempt"),
                meta=result_meta,
            )
            if not posted:
                ownership_lost = str(task_id) not in handler._task_type_by_id
                if int(result_meta.get("http_status") or 0) == 404 or (ownership_lost and domain_uploaded):
                    # Terminal ownership rejection (409 after a landed domain
                    # upload, or 404 row gone): retrying can never succeed,
                    # so settle; the audio stays in the local cache.
                    if not domain_uploaded:
                        handler._append_delivery_failure_history(
                            info,
                            provider,
                            audio_path,
                            "completed result undeliverable: task row gone on the server (HTTP 404)",
                            delivery_id,
                        )
                    laravel_delivery_outbox.mark_step(delivery_id, owner, "result")
                    handler._log_event(
                        "result_settled",
                        "global row already closed; durable domain upload stands"
                        if domain_uploaded
                        else "global row gone (404); audio retained in the local cache",
                        info,
                        mirror=mirror,
                    )
                elif ownership_lost:
                    info["backend_result_accepted"] = False
                    handler._mark_backend_result(task_id, False, info.get("attempt"))
                    error = "completed result rejected because task ownership changed"
                    handler._append_delivery_failure_history(info, provider, audio_path, error, delivery_id)
                    return {"status": OUTCOME_DEAD_LETTER, "error": error}
                else:
                    info["backend_result_accepted"] = False
                    handler._mark_backend_result(task_id, False, info.get("attempt"))
                    return {"status": OUTCOME_RETRY, "error": "Laravel result endpoint unavailable"}
            else:
                laravel_delivery_outbox.mark_step(delivery_id, owner, "result")

        info["backend_uploaded"] = domain_uploaded
        info["backend_result_accepted"] = True
        handler._mark_backend_result(task_id, True, info.get("attempt"))
        handler._set_task_progress(info, "completed", provider)
        if not steps.get("history"):
            if not handler._append_history(info, provider, audio_path, delivery_id):
                return {"status": OUTCOME_RETRY, "error": "local task history is unavailable"}
            laravel_delivery_outbox.mark_step(delivery_id, owner, "history")
        return {"status": OUTCOME_DONE, "domain_uploaded": domain_uploaded}

    @staticmethod
    def on_delivered(handler: Any, claimed: Dict[str, Any], outcome: Dict[str, Any]) -> None:
        info = dict(claimed.get("info") or {})
        provider = str(claimed.get("provider") or "")
        if str(claimed.get("local_process_id") or "") == DELIVERY_PROCESS_ID:
            handler._finish_local_task(
                str(claimed.get("local_task_id") or "") or None,
                True,
                provider=provider,
                audio_path=str(claimed.get("payload_path") or ""),
                text=(info.get("text") or "")[:120],
                language=info.get("language") or "",
            )
        handler._record_backend_delivery_success()
        handler._log_event(
            "delivery_done",
            f"via {provider}; backend_upload={'ok' if outcome.get('domain_uploaded') else 'fallback'}; result=ok",
            info,
            mirror=handler.LANE != "word",
        )


audio_lane_delivery = AudioLaneDelivery()


__all__ = ["audio_lane_delivery", "audio_lane_kind"]
