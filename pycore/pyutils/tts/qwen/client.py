# -*- coding: utf-8 -*-
"""Qwen3TTS domain adapter for the isolated service HTTP API."""

from __future__ import annotations

import json
import time
import urllib.parse
import uuid
from typing import Any, Dict, Optional, Tuple

from pycore.pyutils.common.http_client import HttpClient
from pycore.pyutils.tts.qwen.config import (
    request_timeout_seconds,
    service_base_url as base_url,
)

_DEFAULT_TIMEOUT_S = request_timeout_seconds()
_QUEUE_RECOVERY_INITIAL_BACKOFF_S = 0.25
_QUEUE_RECOVERY_MAX_BACKOFF_S = 2.0
_QUEUE_RECOVERY_STATUS_TIMEOUT_S = 3.0
_QUEUE_RESULT_REQUEST_TIMEOUT_S = 30.0
_RETRYABLE_QUEUE_ERROR_MARKERS = (
    "aborted",
    "broken pipe",
    "connection",
    "eof",
    "host unreachable",
    "remote end closed",
    "reset",
    "timed out",
    "timeout",
    "winerror 10053",
    "winerror 10054",
)
_HTTP_CLIENT = HttpClient(
    default_timeout=_DEFAULT_TIMEOUT_S,
    default_headers={"Accept": "*/*"},
)


def request(
    method: str,
    path: str,
    *,
    query: Optional[Dict[str, Any]] = None,
    json_body: Optional[Dict[str, Any]] = None,
    timeout: float = _DEFAULT_TIMEOUT_S,
    service_base_url: Optional[str] = None,
) -> Tuple[int, Dict[str, str], bytes, Optional[str]]:
    service_url = str(service_base_url or base_url()).rstrip("/")
    url = f"{service_url}/{str(path or '').lstrip('/')}"
    try:
        response = _HTTP_CLIENT.request(
            method,
            url,
            json=json_body,
            query=query,
            timeout=timeout,
        )
        return (
            response.status_code,
            response.headers,
            response.content,
            None,
        )
    except Exception as exc:  # noqa: BLE001
        return 0, {}, b"", str(exc)


def get_json(
    path: str,
    *,
    query: Optional[Dict[str, Any]] = None,
    timeout: float = _DEFAULT_TIMEOUT_S,
    service_base_url: Optional[str] = None,
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    status, _headers, body, transport_error = request(
        "GET",
        path,
        query=query,
        timeout=timeout,
        service_base_url=service_base_url,
    )
    return _decode_json_response(status, body, transport_error)


def post_json(
    path: str,
    payload: Dict[str, Any],
    *,
    timeout: float = _DEFAULT_TIMEOUT_S,
    service_base_url: Optional[str] = None,
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    status, _headers, body, transport_error = request(
        "POST",
        path,
        json_body=payload,
        timeout=timeout,
        service_base_url=service_base_url,
    )
    return _decode_json_response(status, body, transport_error)


def synthesize_bytes(
    payload: Dict[str, Any],
    *,
    timeout: float = _DEFAULT_TIMEOUT_S,
    service_base_url: Optional[str] = None,
) -> Tuple[bool, bytes, Optional[str]]:
    status, _headers, body, transport_error = request(
        "POST",
        "/synthesize",
        json_body=payload,
        timeout=timeout,
        service_base_url=service_base_url,
    )
    if transport_error:
        return False, b"", transport_error
    if 200 <= status < 300 and body:
        return True, body, None
    return False, b"", _error_message(status, body)


def synthesize_batch(
    payload: Dict[str, Any],
    *,
    timeout: float = _DEFAULT_TIMEOUT_S,
    service_base_url: Optional[str] = None,
) -> Tuple[bool, Any, Optional[str]]:
    ok, response, error = post_json(
        "/synthesize_batch",
        payload,
        timeout=timeout,
        service_base_url=service_base_url,
    )
    return ok, response, error


def queue_submit(
    payload: Dict[str, Any],
    *,
    timeout: float = 30.0,
    service_base_url: Optional[str] = None,
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    ok, response, error = post_json(
        "/queue/submit",
        payload,
        timeout=max(0.1, float(timeout)),
        service_base_url=service_base_url,
    )
    if not ok or not isinstance(response, dict):
        return False, None, error or "qwen3tts queue submit failed"
    job_id = str(response.get("job_id") or "")
    if not job_id:
        return False, None, "missing job_id in queue response"
    return True, response, None


def queue_status(
    *,
    timeout: float = 10.0,
    service_base_url: Optional[str] = None,
) -> Dict[str, Any]:
    ok, response, error = get_json(
        "/queue/status",
        timeout=timeout,
        service_base_url=service_base_url,
    )
    if ok and isinstance(response, dict):
        return response
    return {"ok": False, "error": error or "queue status failed"}


def queue_events(
    client_id: str,
    since_seq: int,
    timeout_seconds: float = 20.0,
    *,
    request_timeout: Optional[float] = None,
    service_base_url: Optional[str] = None,
) -> Dict[str, Any]:
    poll_timeout = max(0.0, float(timeout_seconds))
    http_timeout = (
        max(0.1, float(request_timeout))
        if request_timeout is not None
        else max(5.0, poll_timeout + 5.0)
    )
    ok, response, error = get_json(
        "/queue/events/poll",
        query={
            "client_id": client_id,
            "since_seq": max(0, int(since_seq or 0)),
            "timeout_s": poll_timeout,
        },
        timeout=http_timeout,
        service_base_url=service_base_url,
    )
    if ok and isinstance(response, dict):
        return response
    return {"success": False, "error": error or "queue event poll failed"}


def acknowledge_events(
    client_id: str,
    seq: int,
    *,
    timeout: float = 10.0,
    service_base_url: Optional[str] = None,
) -> bool:
    ok, response, _error = post_json(
        "/queue/events/ack",
        {"client_id": client_id, "seq": max(0, int(seq or 0))},
        timeout=max(0.1, float(timeout)),
        service_base_url=service_base_url,
    )
    return bool(ok and isinstance(response, dict) and response.get("success"))


def queue_cancel(
    job_id: str,
    *,
    service_base_url: Optional[str] = None,
) -> bool:
    ok, response, _error = post_json(
        "/queue/cancel",
        {"job_id": str(job_id or "")},
        timeout=10.0,
        service_base_url=service_base_url,
    )
    return bool(ok and isinstance(response, dict) and response.get("cancelled"))


def queue_submit_and_wait(
    payload: Dict[str, Any],
    client_job_id: str,
    timeout: float = _DEFAULT_TIMEOUT_S,
    *,
    service_base_url: Optional[str] = None,
) -> Tuple[bool, bytes, Optional[str]]:
    stable_id = str(client_job_id or "").strip() or uuid.uuid4().hex
    request_payload = dict(payload or {})
    request_payload["client_job_id"] = stable_id
    deadline = time.monotonic() + max(0.1, float(timeout))
    ok, job, error = _submit_with_recovery(
        request_payload,
        stable_id,
        deadline,
        service_base_url=service_base_url,
    )
    if not ok or not isinstance(job, dict):
        return False, b"", error or "qwen3tts queue submit failed"
    job_id = str(job.get("job_id") or "")
    if job.get("status") == "done":
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False, b"", f"qwen3tts queue wait timed out after {timeout:g}s"
        return fetch_queue_result(
            job_id,
            remaining,
            service_base_url=service_base_url,
        )
    if job.get("status") in {"failed", "cancelled"}:
        return False, b"", str(job.get("error") or job.get("status"))

    poll_client_id = f"pycore-qwen-wait-{stable_id}"
    cursor = 0
    instance_id = str(job.get("event_instance_id") or "")
    recovery_backoff = _QUEUE_RECOVERY_INITIAL_BACKOFF_S
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False, b"", f"qwen3tts queue wait timed out after {timeout:g}s"
        response = queue_events(
            poll_client_id,
            cursor,
            min(20.0, max(0.0, remaining - 0.5)),
            request_timeout=remaining,
            service_base_url=service_base_url,
        )
        if not response.get("success"):
            poll_error = str(response.get("error") or "queue event poll failed")
            reconciled = _find_job(
                job_id,
                stable_id,
                timeout=min(_QUEUE_RECOVERY_STATUS_TIMEOUT_S, max(0.1, remaining)),
                service_base_url=service_base_url,
            )
            if reconciled is not None:
                job_id = str(reconciled.get("job_id") or job_id)
                terminal = _terminal_result(
                    reconciled,
                    job_id,
                    deadline - time.monotonic(),
                    service_base_url=service_base_url,
                )
                if terminal is not None:
                    return terminal
            if not _is_retryable_queue_error(poll_error):
                return False, b"", poll_error
            time.sleep(
                min(recovery_backoff, max(0.0, deadline - time.monotonic()))
            )
            recovery_backoff = min(
                _QUEUE_RECOVERY_MAX_BACKOFF_S,
                recovery_backoff * 2.0,
            )
            continue
        recovery_backoff = _QUEUE_RECOVERY_INITIAL_BACKOFF_S
        next_instance = str(response.get("instance_id") or "")
        if (instance_id and next_instance != instance_id) or response.get("replay_lost"):
            reconciled = _find_job(
                job_id,
                stable_id,
                timeout=min(_QUEUE_RECOVERY_STATUS_TIMEOUT_S, max(0.1, remaining)),
                service_base_url=service_base_url,
            )
            if reconciled is not None:
                job_id = str(reconciled.get("job_id") or job_id)
                terminal = _terminal_result(
                    reconciled,
                    job_id,
                    deadline - time.monotonic(),
                    service_base_url=service_base_url,
                )
                if terminal is not None:
                    return terminal
            else:
                resubmit_ok, resubmitted, resubmit_error = _submit_with_recovery(
                    request_payload,
                    stable_id,
                    deadline,
                    service_base_url=service_base_url,
                )
                if not resubmit_ok or not isinstance(resubmitted, dict):
                    return False, b"", resubmit_error or "qwen3tts queue recovery failed"
                job_id = str(resubmitted.get("job_id") or job_id)
                terminal = _terminal_result(
                    resubmitted,
                    job_id,
                    deadline - time.monotonic(),
                    service_base_url=service_base_url,
                )
                if terminal is not None:
                    return terminal
                next_instance = str(
                    resubmitted.get("event_instance_id") or next_instance
                )
            cursor = max(0, int(response.get("seq") or 0))
            if cursor:
                acknowledge_events(
                    poll_client_id,
                    cursor,
                    timeout=min(
                        10.0,
                        max(0.1, deadline - time.monotonic()),
                    ),
                    service_base_url=service_base_url,
                )
            instance_id = next_instance
            continue
        instance_id = next_instance or instance_id
        events = response.get("events") if isinstance(response.get("events"), list) else []
        for record in events:
            if not isinstance(record, dict):
                continue
            cursor = max(cursor, int(record.get("seq") or 0))
            event = record.get("payload") if isinstance(record.get("payload"), dict) else {}
            event_job_id = str(event.get("job_id") or "")
            event_client_job_id = str(event.get("client_job_id") or "")
            if event_job_id != job_id and event_client_job_id != stable_id:
                continue
            job_id = event_job_id or job_id
            terminal = _terminal_result(
                event,
                job_id,
                deadline - time.monotonic(),
                service_base_url=service_base_url,
            )
            if terminal is not None:
                return terminal
        if cursor:
            acknowledge_events(
                poll_client_id,
                cursor,
                timeout=min(
                    10.0,
                    max(0.1, deadline - time.monotonic()),
                ),
                service_base_url=service_base_url,
            )


def fetch_queue_result(
    job_id: str,
    timeout: float,
    *,
    service_base_url: Optional[str] = None,
) -> Tuple[bool, bytes, Optional[str]]:
    deadline = time.monotonic() + max(0.1, float(timeout))
    delay = _QUEUE_RECOVERY_INITIAL_BACKOFF_S
    result_path = f"/queue/result/{urllib.parse.quote(str(job_id or ''), safe='')}"
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False, b"", f"qwen3tts result fetch timed out after {timeout:g}s"
        status, _headers, body, transport_error = request(
            "GET",
            result_path,
            timeout=min(_QUEUE_RESULT_REQUEST_TIMEOUT_S, remaining),
            service_base_url=service_base_url,
        )
        if 200 <= status < 300 and body:
            return True, body, None
        error = transport_error or _error_message(status, body)
        retryable = bool(transport_error and _is_retryable_queue_error(error)) or status == 409
        if not retryable:
            return False, b"", error
        time.sleep(min(delay, max(0.0, deadline - time.monotonic())))
        delay = min(_QUEUE_RECOVERY_MAX_BACKOFF_S, delay * 2.0)


def _find_job(
    job_id: str,
    client_job_id: str,
    *,
    timeout: float = 10.0,
    service_base_url: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    snapshot = queue_status(timeout=timeout, service_base_url=service_base_url)
    jobs = snapshot.get("jobs") if isinstance(snapshot.get("jobs"), list) else []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        if str(job.get("job_id") or "") == job_id:
            return job
        if str(job.get("client_job_id") or "") == client_job_id:
            return job
    return None


def _submit_with_recovery(
    payload: Dict[str, Any],
    client_job_id: str,
    deadline: float,
    *,
    service_base_url: Optional[str] = None,
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    delay = _QUEUE_RECOVERY_INITIAL_BACKOFF_S
    last_error = "qwen3tts queue submit failed"
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False, None, last_error
        ok, job, error = queue_submit(
            payload,
            timeout=min(30.0, remaining),
            service_base_url=service_base_url,
        )
        if ok and isinstance(job, dict):
            return True, job, None
        last_error = str(error or last_error)
        remaining = deadline - time.monotonic()
        if remaining <= 0 or not _is_retryable_queue_error(last_error):
            return False, None, last_error
        reconciled = _find_job(
            "",
            client_job_id,
            timeout=min(_QUEUE_RECOVERY_STATUS_TIMEOUT_S, max(0.1, remaining)),
            service_base_url=service_base_url,
        )
        if reconciled is not None:
            return True, reconciled, None
        time.sleep(min(delay, max(0.0, deadline - time.monotonic())))
        delay = min(_QUEUE_RECOVERY_MAX_BACKOFF_S, delay * 2.0)


def _is_retryable_queue_error(error: Optional[str]) -> bool:
    normalized = str(error or "").strip().lower()
    if not normalized:
        return True
    if normalized.startswith("http 5"):
        return True
    if normalized.startswith(("http 408", "http 409", "http 425", "http 429")):
        return True
    if normalized.startswith("http 4"):
        return False
    return any(marker in normalized for marker in _RETRYABLE_QUEUE_ERROR_MARKERS)


def _terminal_result(
    value: Dict[str, Any],
    job_id: str,
    timeout: float,
    *,
    service_base_url: Optional[str] = None,
) -> Optional[Tuple[bool, bytes, Optional[str]]]:
    status = str(value.get("status") or "")
    if status == "done":
        if timeout <= 0:
            return False, b"", "qwen3tts result fetch deadline expired"
        return fetch_queue_result(
            job_id,
            timeout,
            service_base_url=service_base_url,
        )
    if status in {"failed", "cancelled"}:
        return False, b"", str(value.get("error") or status)
    return None


def _decode_json_response(
    status: int,
    body: bytes,
    transport_error: Optional[str],
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    if transport_error:
        return False, None, transport_error
    try:
        parsed = json.loads(body.decode("utf-8")) if body else {}
    except Exception as exc:  # noqa: BLE001
        return False, None, f"HTTP {status}: invalid JSON response: {exc}"
    if not isinstance(parsed, dict):
        return False, None, f"HTTP {status}: JSON response must be an object"
    if 200 <= status < 300:
        return True, parsed, None
    return False, parsed, _error_message(status, body)


def _error_message(status: int, body: bytes) -> str:
    detail = body.decode("utf-8", "replace") if body else "request failed"
    try:
        parsed = json.loads(detail)
        if isinstance(parsed, dict):
            detail = str(parsed.get("error") or parsed.get("message") or detail)
    except Exception:  # noqa: BLE001
        pass
    return f"HTTP {status}: {detail}" if status else detail


__all__ = [
    "acknowledge_events",
    "base_url",
    "fetch_queue_result",
    "get_json",
    "post_json",
    "queue_cancel",
    "queue_events",
    "queue_status",
    "queue_submit",
    "queue_submit_and_wait",
    "request",
    "synthesize_batch",
    "synthesize_bytes",
]
