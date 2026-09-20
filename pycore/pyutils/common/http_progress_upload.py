# -*- coding: utf-8 -*-

import time
import threading
import uuid
from contextlib import contextmanager
from datetime import timedelta
from typing import Any, Callable, Dict, Iterator, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_httpx, get_third_package_requests
from pycore.pyutils.common.laravel_http_transport import create_progress_http_session
from pycore.pyutils.common.queue_center_contract import http_transfer_contract


ProgressCallback = Callable[[Dict[str, Any]], None]
HTTP_PROGRESS_SIGNAL_PREFIX = "http.transfer"
HTTP_PROGRESS_SCOPE_PREFIX = "http.transfer.scope"


def _close_progress(signal: str, method: str, path: str) -> None:
    progress = THREAD_BUS.get_signal(signal)
    try:
        if progress is not None:
            ColorPrint.gray(
                f"[http upload] {method} {path} "
                f"bytes={progress['transferred_bytes']}/{progress['total_bytes']} "
                f"phase={progress['phase']}"
            )
    finally:
        THREAD_BUS.clear_signal(signal)


def _request_error(error: Any) -> Exception:
    httpx = get_third_package_httpx()
    requests = get_third_package_requests()
    error_type = (
        requests.exceptions.ConnectTimeout if isinstance(error, httpx.ConnectTimeout)
        else requests.exceptions.ReadTimeout if isinstance(error, httpx.ReadTimeout)
        else requests.exceptions.Timeout if isinstance(error, httpx.TimeoutException)
        else requests.exceptions.ConnectionError
    )
    return error_type(str(error))


class HttpTransferProgress:
    def __init__(self, signal: str, idle_seconds: float) -> None:
        self._signal = signal
        self._idle_seconds = idle_seconds
        self.advance(0)

    def advance(self, offset: int) -> None:
        current = THREAD_BUS.get_signal(self._signal)
        if current is None or offset > current["offset"]:
            THREAD_BUS.signal(self._signal, {"offset": offset, "observed_at": time.monotonic()})

    def stalled(self) -> bool:
        current = THREAD_BUS.get_signal(self._signal)
        return current is not None and time.monotonic() - current["observed_at"] >= self._idle_seconds

    def close(self) -> None:
        THREAD_BUS.clear_signal(self._signal)


class HttpProgressContent:
    def __init__(self, source: Any, total: int, transfer_id: str, path: str,
                 callback: Optional[ProgressCallback], chunk_bytes: int) -> None:
        self._source = source
        self._total = total
        self._transfer_id = transfer_id
        self._path = path
        self._callback = callback
        self._chunk_bytes = chunk_bytes

    def __iter__(self):
        transferred = 0
        self._publish(transferred, "uploading")
        for content in self._source:
            for offset in range(0, len(content), self._chunk_bytes):
                chunk = content[offset:offset + self._chunk_bytes]
                yield chunk
                transferred += len(chunk)
                self._publish(transferred, "awaiting_receipt" if transferred == self._total else "uploading")
        self._publish(transferred, "awaiting_receipt")

    def _publish(self, transferred: int, phase: str) -> None:
        signal = f"{HTTP_PROGRESS_SIGNAL_PREFIX}.{self._transfer_id}"
        previous = THREAD_BUS.get_signal(signal, {})
        record = {
            **previous,
            "transfer_id": self._transfer_id,
            "path": self._path,
            "transferred_bytes": transferred,
            "total_bytes": self._total,
            "progress": round(transferred * 100.0 / self._total, 2) if self._total else 0.0,
            "phase": phase,
            "observed_at": time.monotonic(),
        }
        THREAD_BUS.signal(signal, record)
        if self._callback is not None:
            self._callback(dict(record))


class HttpProgressResponseStream:
    def __init__(self, response: Any, content: HttpProgressContent,
                 signal: str, callbacks: Any) -> None:
        self._response = response
        self._content = content
        self._signal = signal
        self._callbacks = callbacks
        self._closed = False

    def stream(self, amt: Optional[int] = None, decode_content: bool = True):
        httpx = get_third_package_httpx()
        try:
            yield from HttpProgressClient._response_content(
                self._response, self._signal, self._callbacks, amt, decode_content,
            )
            progress = THREAD_BUS.get_signal(self._signal)
            if progress is not None:
                self._content._publish(
                    progress["transferred_bytes"],
                    "received" if self._response.status_code < 400 else "rejected",
                )
        except httpx.HTTPError as error:
            raise _request_error(error) from error
        finally:
            self.close()

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            self._response.close()
        finally:
            _close_progress(self._signal, self._response.request.method, self._content._path)

    def release_conn(self) -> None:
        self.close()


class HttpProgressClient:
    @contextmanager
    def transfer_scope(self, callback: ProgressCallback) -> Iterator[None]:
        signal = f"{HTTP_PROGRESS_SCOPE_PREFIX}.{threading.get_ident()}"
        previous = THREAD_BUS.get_signal(signal, ())
        THREAD_BUS.signal(signal, (*previous, callback))
        try:
            yield
        finally:
            if previous:
                THREAD_BUS.signal(signal, previous)
            else:
                THREAD_BUS.clear_signal(signal)

    def request(self, method: str, url: str, *, params: Any = None,
                data: Any = None, json: Any = None, files: Any = None,
                headers: Any = None, timeout: Any = None, stream: bool = False,
                allow_redirects: bool = True,
                activity_timeout: Optional[Dict[str, Any]] = None,
                progress_callback: Optional[ProgressCallback] = None,
                **kwargs: Any) -> Any:
        contract = activity_timeout or http_transfer_contract()
        httpx = get_third_package_httpx()
        requests = get_third_package_requests()
        session = create_progress_http_session()
        transfer_id = uuid.uuid4().hex
        signal = f"{HTTP_PROGRESS_SIGNAL_PREFIX}.{transfer_id}"
        request_options = dict(kwargs)
        auth = request_options.pop("auth", httpx.USE_CLIENT_DEFAULT)
        response_idle = timeout[1] if isinstance(timeout, (tuple, list)) else timeout
        connect_idle = timeout[0] if isinstance(timeout, (tuple, list)) else None
        idle = float(contract["idle_timeout_seconds"])
        callbacks = THREAD_BUS.get_signal(f"{HTTP_PROGRESS_SCOPE_PREFIX}.{threading.get_ident()}", ())
        if progress_callback is not None:
            callbacks = (*callbacks, progress_callback)

        def report_progress(record: Dict[str, Any]) -> None:
            for callback in callbacks:
                callback(dict(record))

        request_options.update({
            "params": params,
            "headers": headers,
            "timeout": httpx.Timeout(
                None, connect=float(contract["connect_timeout_seconds"] if connect_idle is None else connect_idle),
                read=idle if response_idle is None else float(response_idle),
                write=idle, pool=idle,
            ),
        })
        if isinstance(data, bytearray):
            data = bytes(data)
        if isinstance(data, (bytes, bytearray, str)) or (data is not None and not isinstance(data, (dict, list, tuple))):
            request_options["content"] = data
        else:
            request_options["data"] = data
        request_options["json"] = json
        request_options["files"] = files
        request = session.build_request(method, url, **request_options)
        content = HttpProgressContent(
            request.stream, int(request.headers.get("Content-Length") or 0),
            transfer_id, request.url.path, report_progress if callbacks else None,
            max(1, min(int(contract["chunk_bytes"]), int(contract["maximum_chunk_bytes"]))),
        )
        request.stream = httpx.Request(method, url, content=content).stream
        started = time.monotonic()
        response = None
        response_stream = None
        stream_returned = False
        try:
            response = session.send(request, stream=True, follow_redirects=allow_redirects, auth=auth)
            result = requests.Response()
            result.status_code = response.status_code
            result.headers = requests.structures.CaseInsensitiveDict(response.headers)
            result.url = str(response.url)
            result.reason = response.reason_phrase
            result.encoding = requests.utils.get_encoding_from_headers(result.headers)
            result.cookies.update(response.cookies.jar)
            result.elapsed = timedelta(seconds=time.monotonic() - started)
            result.http_version = response.http_version
            result.request = requests.Request(
                response.request.method, result.url, headers=dict(response.request.headers),
            ).prepare()
            response_stream = HttpProgressResponseStream(response, content, signal, callbacks)
            result.raw = response_stream
            if not stream:
                result._content = b"".join(response_stream.stream())
                result._content_consumed = True
            stream_returned = stream
            return result
        except httpx.HTTPError as error:
            raise _request_error(error) from error
        finally:
            if not stream_returned:
                if response_stream is not None:
                    response_stream.close()
                else:
                    try:
                        if response is not None:
                            response.close()
                    finally:
                        _close_progress(signal, method, content._path)

    @staticmethod
    def _response_content(response: Any, signal: str, callbacks: Any,
                          chunk_size: Optional[int] = None, decode_content: bool = True):
        received = 0
        chunks = response.iter_bytes(chunk_size=chunk_size) if decode_content else response.iter_raw(chunk_size=chunk_size)
        for chunk in chunks:
            received += len(chunk)
            record = THREAD_BUS.get_signal(signal)
            if record is not None:
                record = {**record, "received_bytes": received, "observed_at": time.monotonic()}
                THREAD_BUS.signal(signal, record)
                for callback in callbacks:
                    callback(dict(record))
            yield chunk

    def post(self, url: str, **kwargs: Any) -> Any:
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs: Any) -> Any:
        return self.request("PUT", url, **kwargs)


http_progress_client = HttpProgressClient()
