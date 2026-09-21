# -*- coding: utf-8 -*-
"""Durable offset-based uploads shared by Pycore-to-Laravel producers."""

import copy
import hashlib
import sys
import time
import uuid
from typing import Any, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.queue_center_contract import http_transfer_contract
from pycore.pyutils.common.http_progress_upload import HttpTransferProgress
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.http_recorder import laravel_http_recorder

ProgressCallback = Callable[[Dict[str, Any]], None]


class LaravelProgressUploader:
    """Upload bytes as independently acknowledged, resumable minimum steps."""

    def __init__(self) -> None:
        self._contract = http_transfer_contract()
        init_serialized_owner(self, "laravel.upload.flights", "LaravelUploadFlightsThread")
        self._in_flight: Dict[Tuple[Any, ...], str] = {}
        self._completed: Dict[Tuple[Any, ...], Tuple[float, Dict[str, Any]]] = {}
        self._waiters: Dict[str, int] = {}

    @serialized_method
    def _begin(self, key: Tuple[Any, ...]) -> Dict[str, Any]:
        now = time.monotonic()
        for expired_key in [key for key, entry in self._completed.items() if entry[0] <= now]:
            self._completed.pop(expired_key)
        cached = self._completed.get(key)
        if cached is not None:
            return {"receipt": copy.deepcopy(cached[1])}
        signal = self._in_flight.get(key)
        if signal is not None:
            self._waiters[signal] += 1
            return {"leader": False, "signal": signal}
        signal = f"{self._serialized_queue_name}.flight.{time.monotonic_ns()}"
        self._in_flight[key] = signal
        self._waiters[signal] = 0
        return {"leader": True, "signal": signal}

    @serialized_method
    def _finish(self, key: Tuple[Any, ...], signal: str, result: Dict[str, Any], succeeded: bool, error: str) -> None:
        self._in_flight.pop(key, None)
        if succeeded:
            self._completed[key] = (
                time.monotonic() + float(self._contract["dedup_window_seconds"]), copy.deepcopy(result),
            )
        if self._waiters[signal]:
            THREAD_BUS.signal(signal, {"success": succeeded, "result": copy.deepcopy(result), "error": error})
        else:
            self._waiters.pop(signal)

    @serialized_method
    def _consume(self, signal: str) -> None:
        self._waiters[signal] -= 1
        if not self._waiters[signal] and THREAD_BUS.has_signal(signal):
            self._waiters.pop(signal)
            THREAD_BUS.clear_signal(signal)

    @staticmethod
    def _dedup_key(
        path: str,
        base_url: Optional[str],
        params: Dict[str, Any],
        content_sha256: str,
    ) -> Tuple[Any, ...]:
        normalized_params = tuple(
            sorted((str(key), str(value)) for key, value in params.items())
        )
        return (str(base_url or ""), str(path), content_sha256, normalized_params)

    @staticmethod
    def _identity_from_params(params: Dict[str, Any]) -> str:
        """Short producer identity for log lines (task/content/article/record)."""
        for field in ("task_id", "content_id", "article_id", "record_id"):
            value = str(params.get(field) or "").strip()
            if value:
                return f"{field}={value}"
        return ""

    def upload(
        self,
        path: str,
        content: bytes,
        *,
        params: Dict[str, Any],
        base_url: Optional[str] = None,
        progress_callback: Optional[ProgressCallback] = None,
        reason: str = "unspecified",
    ) -> Dict[str, Any]:
        total_bytes = len(content)
        content_sha256 = hashlib.sha256(content).hexdigest()
        if total_bytes <= 0:
            raise RuntimeError("Laravel upload content is empty")

        target_url = laravel_client._build_url(path, base_url)
        dedup_key = self._dedup_key(target_url, None, params, content_sha256)
        identity = self._identity_from_params(params)
        identity_part = f"{identity} " if identity else ""
        flight = self._begin(dedup_key)
        if "receipt" in flight:
            return flight["receipt"]
        if not flight["leader"]:
            try:
                outcome = THREAD_BUS.wait_signal(flight["signal"])
            finally:
                self._consume(flight["signal"])
            if not outcome["success"]:
                raise RuntimeError(outcome["error"] or "The shared Laravel upload failed")
            return copy.deepcopy(outcome["result"])
        succeeded = False
        result: Dict[str, Any] = {}
        try:
            result = self._upload_chunks(
                target_url,
                content,
                content_sha256,
                params=params,
                base_url=base_url,
                progress_callback=progress_callback,
                reason=reason,
                identity=identity_part,
            )
            succeeded = True
            return result
        finally:
            self._finish(dedup_key, flight["signal"], result, succeeded, str(sys.exc_info()[1] or ""))

    def _upload_chunks(
        self,
        path: str,
        content: bytes,
        content_sha256: str,
        *,
        params: Dict[str, Any],
        base_url: Optional[str],
        progress_callback: Optional[ProgressCallback],
        reason: str,
        identity: str = "",
    ) -> Dict[str, Any]:
        chunk_bytes = max(1, min(int(self._contract["chunk_bytes"]), int(self._contract["maximum_chunk_bytes"])))
        started_at = time.perf_counter()
        progress_state = HttpTransferProgress(
            f"{self._serialized_queue_name}.progress.{uuid.uuid4().hex}",
            float(self._contract["idle_timeout_seconds"]),
        )

        try:
            return self._advance_chunks(
                path, content, content_sha256, params, base_url, progress_callback,
                reason, identity, chunk_bytes, started_at, progress_state,
            )
        finally:
            progress_state.close()

    def _advance_chunks(
        self, path: str, content: bytes, content_sha256: str, params: Dict[str, Any],
        base_url: Optional[str], progress_callback: Optional[ProgressCallback],
        reason: str, identity: str, chunk_bytes: int, started_at: float,
        progress_state: HttpTransferProgress,
    ) -> Dict[str, Any]:
        total_bytes = len(content)
        offset = 0
        result: Dict[str, Any] = {}
        busy = False

        def transport_progress(record: Dict[str, Any]) -> None:
            self._publish_progress(
                path, content_sha256,
                min(total_bytes, offset + int(record["transferred_bytes"])),
                total_bytes, started_at, progress_callback, reason, identity,
                durable_offset=offset, phase="awaiting_receipt" if record["phase"] == "received" else record["phase"],
            )

        while offset < total_bytes:
            chunk = content[offset:offset + chunk_bytes]
            chunk_sha256 = hashlib.sha256(chunk).hexdigest()
            request_params = dict(params)
            request_params.update({
                "upload_protocol": self._contract["protocol"],
                "upload_offset": offset,
                "upload_length": total_bytes,
                "audio_sha256": content_sha256,
                "chunk_sha256": chunk_sha256,
            })
            response = laravel_client.post(
                path,
                base_url=base_url,
                params=request_params,
                data=chunk,
                headers={"Content-Type": "application/octet-stream"},
                activity_timeout=self._contract,
                progress_callback=transport_progress,
                log_line=False,
            )
            result = self._response_data(response)
            response_protocol = str(result.get("upload_protocol") or self._contract["protocol"])
            if response_protocol != self._contract["protocol"]:
                raise RuntimeError(
                    f"Laravel upload protocol mismatch: {response_protocol}"
                )
            next_offset = int(result.get("offset") or 0)
            if next_offset < offset or next_offset > total_bytes:
                raise RuntimeError(
                    f"Laravel upload returned invalid offset {next_offset} for {total_bytes} bytes"
                )
            if next_offset == offset:
                if result.get("busy"):
                    if not busy:
                        progress_state.close()
                        progress_state.advance(offset)
                        busy = True
                    if progress_state.stalled():
                        raise RuntimeError(f"Laravel upload durable progress stalled at offset {offset}")
                    retry_after_ms = max(
                        1,
                        int(result.get("retry_after_ms") or self._contract["retry_interval_ms"]),
                    )
                    time.sleep(retry_after_ms / 1000.0)
                    continue
                raise RuntimeError(
                    f"Laravel upload made no durable progress at offset {offset}"
                )
            offset = next_offset
            busy = False
            progress_state.advance(offset)
            if offset == total_bytes and not result.get("upload_complete"):
                raise RuntimeError("Laravel upload reached the final offset without completion receipt")
            self._publish_progress(
                path,
                content_sha256,
                offset,
                total_bytes,
                started_at,
                progress_callback,
                reason,
                identity,
            )

        return result

    @staticmethod
    def _response_data(response: Any) -> Dict[str, Any]:
        try:
            body = response.json()
        except ValueError as exc:
            raise RuntimeError(
                f"HTTP {response.status_code}: Laravel upload returned invalid JSON"
            ) from exc
        if response.status_code >= 400 or not isinstance(body, dict) or not body.get("success"):
            error = (
                body.get("error") or body.get("message")
                if isinstance(body, dict)
                else None
            )
            detail = f"Laravel upload failed: {error or response.status_code}"
            raise RuntimeError(f"HTTP {response.status_code}: {detail}" if response.status_code >= 400 else detail)
        data = body.get("data")
        if not isinstance(data, dict):
            raise RuntimeError("Laravel upload response has no data receipt")
        return data

    @staticmethod
    def _publish_progress(
        path: str,
        transfer_id: str,
        offset: int,
        total_bytes: int,
        started_at: float,
        progress_callback: Optional[ProgressCallback],
        reason: str,
        identity: str = "",
        durable_offset: Optional[int] = None,
        phase: Optional[str] = None,
    ) -> None:
        progress = round((offset / total_bytes) * 100.0, 2)
        elapsed_ms = round((time.perf_counter() - started_at) * 1000.0, 1)
        record = {
            "ts": time.time(),
            "method": "UPLOAD",
            "url": path,
            "path": path,
            "params_summary": f"progress={progress:.2f}% offset={offset}/{total_bytes}",
            "status": 102 if (offset if durable_offset is None else durable_offset) < total_bytes else 200,
            "ms": elapsed_ms,
            "error": None,
            "progress": progress,
            "transferred_bytes": offset,
            "durable_bytes": offset if durable_offset is None else durable_offset,
            "total_bytes": total_bytes,
            "transfer_id": transfer_id,
            "reason": str(reason or "unspecified"),
            "phase": phase or ("uploading" if offset < total_bytes else "received"),
        }
        laravel_http_recorder.notify(record)
        ColorPrint.cyan(
            f"[laravel upload] reason={reason or 'unspecified'} {identity}{path} -> {progress:.2f}% "
            f"({offset}/{total_bytes} bytes) phase={record['phase']}"
        )
        if progress_callback is not None:
            progress_callback(dict(record))


laravel_progress_uploader = LaravelProgressUploader()


__all__ = ["LaravelProgressUploader", "laravel_progress_uploader"]
