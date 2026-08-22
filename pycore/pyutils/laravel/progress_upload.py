# -*- coding: utf-8 -*-
"""Durable offset-based uploads shared by Pycore-to-Laravel producers."""

import hashlib
import time
from typing import Any, Callable, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.queue_center_contract import http_transfer_contract
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.http_recorder import laravel_http_recorder

ProgressCallback = Callable[[Dict[str, Any]], None]


class LaravelProgressUploader:
    """Upload bytes as independently acknowledged, resumable minimum steps."""

    def __init__(self) -> None:
        self._contract = http_transfer_contract()

    def upload(
        self,
        path: str,
        content: bytes,
        *,
        params: Dict[str, Any],
        base_url: Optional[str] = None,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> Dict[str, Any]:
        total_bytes = len(content)
        content_sha256 = hashlib.sha256(content).hexdigest()
        chunk_bytes = max(1, int(self._contract["chunk_bytes"]))
        offset = 0
        started_at = time.perf_counter()
        result: Dict[str, Any] = {}

        if total_bytes <= 0:
            raise RuntimeError("Laravel upload content is empty")

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
            "phase": "uploading" if offset < total_bytes else "received",
        }
        laravel_http_recorder.notify(record)
        ColorPrint.cyan(
            f"[laravel upload] {path} -> {progress:.2f}% "
            f"({offset}/{total_bytes} bytes)"
        )
        if progress_callback is not None:
            progress_callback(dict(record))


laravel_progress_uploader = LaravelProgressUploader()


__all__ = ["LaravelProgressUploader", "laravel_progress_uploader"]
