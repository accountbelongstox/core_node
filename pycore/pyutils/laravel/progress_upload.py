# -*- coding: utf-8 -*-
"""Durable offset-based uploads shared by Pycore-to-Laravel producers."""

import hashlib
import threading
import time
from typing import Any, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.queue_center_contract import http_transfer_contract
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.http_recorder import laravel_http_recorder

ProgressCallback = Callable[[Dict[str, Any]], None]


class LaravelProgressUploader:
    """Upload bytes as independently acknowledged, resumable minimum steps."""

    def __init__(self) -> None:
        self._contract = http_transfer_contract()
        self._flight_lock = threading.Lock()
        self._in_flight: Dict[Tuple[Any, ...], threading.Event] = {}
        self._completed: Dict[Tuple[Any, ...], Tuple[float, Dict[str, Any]]] = {}

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

        # Identical transfers (same endpoint, params, and bytes) are the same
        # logical delivery: an in-flight leader is awaited and a receipt inside
        # the dedup window is reused instead of re-POSTing the same bytes.
        dedup_key = self._dedup_key(path, base_url, params, content_sha256)
        while True:
            with self._flight_lock:
                now = time.monotonic()
                for expired_key in [
                    key
                    for key, entry in self._completed.items()
                    if entry[0] <= now
                ]:
                    self._completed.pop(expired_key, None)
                cached = self._completed.get(dedup_key)
                if cached and cached[0] > time.monotonic():
                    ColorPrint.gray(
                        f"[laravel upload] reason={reason or 'unspecified'} {path} "
                        "-> deduplicated (identical transfer already received)"
                    )
                    return dict(cached[1])
                flight = self._in_flight.get(dedup_key)
                if flight is None:
                    flight = threading.Event()
                    self._in_flight[dedup_key] = flight
                    break
            flight.wait()

        succeeded = False
        try:
            result = self._upload_chunks(
                path,
                content,
                content_sha256,
                params=params,
                base_url=base_url,
                progress_callback=progress_callback,
                reason=reason,
            )
            succeeded = True
            return result
        finally:
            with self._flight_lock:
                self._in_flight.pop(dedup_key, None)
                if succeeded:
                    self._completed[dedup_key] = (
                        time.monotonic() + float(self._contract["dedup_window_seconds"]),
                        result,
                    )
                flight.set()

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
    ) -> Dict[str, Any]:
        total_bytes = len(content)
        chunk_bytes = max(1, int(self._contract["chunk_bytes"]))
        offset = 0
        started_at = time.perf_counter()
        result: Dict[str, Any] = {}

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
                no_timeout=True,
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
            self._publish_progress(
                path,
                content_sha256,
                offset,
                total_bytes,
                started_at,
                progress_callback,
                reason,
            )

        if not result.get("upload_complete"):
            raise RuntimeError("Laravel upload reached the final offset without completion receipt")
        return result

    @staticmethod
    def _response_data(response: Any) -> Dict[str, Any]:
        try:
            body = response.json()
        except ValueError as exc:
            raise RuntimeError(
                f"Laravel upload returned HTTP {response.status_code} with invalid JSON"
            ) from exc
        if response.status_code >= 400 or not isinstance(body, dict) or not body.get("success"):
            error = (
                body.get("error") or body.get("message")
                if isinstance(body, dict)
                else None
            )
            raise RuntimeError(f"Laravel upload failed: {error or response.status_code}")
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
    ) -> None:
        progress = round((offset / total_bytes) * 100.0, 2)
        elapsed_ms = round((time.perf_counter() - started_at) * 1000.0, 1)
        record = {
            "ts": time.time(),
            "method": "UPLOAD",
            "url": path,
            "path": path,
            "params_summary": f"progress={progress:.2f}% offset={offset}/{total_bytes}",
            "status": 102 if offset < total_bytes else 200,
            "ms": elapsed_ms,
            "error": None,
            "progress": progress,
            "transferred_bytes": offset,
            "total_bytes": total_bytes,
            "transfer_id": transfer_id,
            "reason": str(reason or "unspecified"),
            "phase": "uploading" if offset < total_bytes else "received",
        }
        laravel_http_recorder.notify(record)
        ColorPrint.cyan(
            f"[laravel upload] reason={reason or 'unspecified'} {path} -> {progress:.2f}% "
            f"({offset}/{total_bytes} bytes)"
        )
        if progress_callback is not None:
            progress_callback(dict(record))


laravel_progress_uploader = LaravelProgressUploader()


__all__ = ["LaravelProgressUploader", "laravel_progress_uploader"]
