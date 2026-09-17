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
        record = {
            "transfer_id": self._transfer_id,
            "path": self._path,
            "transferred_bytes": transferred,
            "total_bytes": self._total,
            "progress": round(transferred * 100.0 / self._total, 2) if self._total else 0.0,
            "phase": phase,
            "observed_at": time.monotonic(),
        }
        THREAD_BUS.signal(f"{HTTP_PROGRESS_SIGNAL_PREFIX}.{self._transfer_id}", record)
        if self._callback is not None:
            self._callback(dict(record))


class HttpProgressResponseStream:
    def __init__(self, response: Any) -> None:
        self._response = response

    def stream(self, amt: int, decode_content: bool = True):
        httpx = get_third_package_httpx()
        try:
            yield from self._response.iter_bytes(chunk_size=amt)
        except httpx.HTTPError as error:
            raise _request_error(error) from error
        finally:
            self.close()

    def close(self) -> None:
        self._response.close()

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
                None, connect=float(contract["connect_timeout_seconds"]),
                read=idle if response_idle is None else float(response_idle),
                write=idle, pool=idle,
            ),
        })
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
        try:
            response = session.send(request, stream=True, follow_redirects=allow_redirects, auth=auth)
            result = requests.Response()
            result.status_code = response.status_code
            result.headers = requests.structures.CaseInsensitiveDict(response.headers)
            result.url = str(response.url)
            result.reason = response.reason_phrase
            result.encoding = response.encoding
            result.cookies.update(response.cookies.jar)
            result.elapsed = timedelta(seconds=time.monotonic() - started)
            result.http_version = response.http_version
            result.request = requests.Request(method, result.url, headers=dict(request.headers)).prepare()
            result.raw = HttpProgressResponseStream(response)
            if not stream or response.status_code >= 400:
                try:
                    result._content = b"".join(self._response_content(response, signal, callbacks))
                    result._content_consumed = True
                finally:
                    response.close()
            progress = THREAD_BUS.get_signal(signal)
            if progress is not None:
                content._publish(progress["transferred_bytes"], "received" if response.status_code < 400 else "rejected")
            return result
        except httpx.HTTPError as error:
            raise _request_error(error) from error
        finally:
            progress = THREAD_BUS.get_signal(signal)
            if progress is not None:
                ColorPrint.gray(
                    f"[http upload] {method} {content._path} "
                    f"bytes={progress['transferred_bytes']}/{progress['total_bytes']} "
                    f"phase={progress['phase']}"
                )
            THREAD_BUS.clear_signal(signal)

    @staticmethod
    def _response_content(response: Any, signal: str, callbacks: Any):
        received = 0
        for chunk in response.iter_bytes():
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
