# -*- coding: utf-8 -*-
"""
LaravelClient - the only pycore->Laravel request path.

Every request:
  * resolves its base URL through ``laravel_endpoint_manager.resolve()`` (or an
    explicit ``base_url`` that a caller already resolved),
  * carries the K3 client-key signature over the exact transmitted bytes,
  * travels over the canonical ``http_client`` connection pools,
  * logs ``[laravel] METHOD URL -> STATUS (ms) <body summary>`` via ColorPrint,
  * notifies ``laravel_http_recorder`` for the dashboard HTTP debugger,
  * feeds ``laravel_reachability`` (the online edge of every endpoint),
  * returns the ``HttpResponse``; transport failures raise ``HttpError``.
"""
import json as json_module
import time
from typing import Any, Dict, Optional
from urllib.parse import urlencode, urlsplit

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.client_key_auth import client_key_headers
from pycore.pyutils.common.http_client import (
    HTTP_TRANSPORT_NAME,
    HttpConnectError,
    HttpConnectTimeout,
    HttpProtocolError,
    HttpTimeoutError,
    http_client,
    redacted_http_error,
)
from pycore.pyutils.common.queue_center_contract import http_transfer_contract
from pycore.pyutils.laravel.endpoint_manager import (
    LARAVEL_OFFLINE_STATUSES,
    laravel_endpoint_manager,
    laravel_reachability,
)
from pycore.pyutils.laravel.http_recorder import laravel_http_recorder
from pycore.pyutils.laravel.identity import LARAVEL_SERVER_ID_HEADER

_PARAM_SUMMARY_MAX = 240
_BODY_SUMMARY_MAX = 200
_CONTENT_TYPE_HEADER = "Content-Type"
_JSON_CONTENT_TYPE = "application/json"
_FORM_CONTENT_TYPE = "application/x-www-form-urlencoded"
_MULTIPART_CONTENT_TYPE = "multipart/form-data"

LARAVEL_ERROR_TIMEOUT = "LARAVEL_TIMEOUT"
LARAVEL_ERROR_UNREACHABLE = "LARAVEL_UNREACHABLE"
LARAVEL_ERROR_HTTP = "LARAVEL_HTTP_ERROR"
LARAVEL_ERROR_BAD_RESPONSE = "LARAVEL_BAD_RESPONSE"
LARAVEL_ERROR_REQUEST_FAILED = "LARAVEL_REQUEST_FAILED"


def laravel_failure(error: Any = None, status_code: int = 0) -> Dict[str, Any]:
    """Stable ``{error_code, detail, status}`` for a failed Laravel call; the
    UI translates ``error_code`` and ``detail`` stays a short redacted note."""
    if status_code:
        return {
            "error_code": LARAVEL_ERROR_HTTP,
            "detail": f"HTTP {int(status_code)}",
            "status": int(status_code),
        }
    if isinstance(error, HttpTimeoutError):
        code = LARAVEL_ERROR_TIMEOUT
    elif isinstance(error, (HttpConnectError, HttpProtocolError)):
        code = LARAVEL_ERROR_UNREACHABLE
    elif isinstance(error, ValueError):
        code = LARAVEL_ERROR_BAD_RESPONSE
    else:
        code = LARAVEL_ERROR_REQUEST_FAILED
    detail = redacted_http_error(error) if isinstance(error, BaseException) else ""
    return {"error_code": code, "detail": detail, "status": 0}


def laravel_server_unreachable(error: Any) -> bool:
    """True only for a failure to reach the server (connect refused, failed or
    timed out, or the connection dropped). A read or write stall means the
    server was reached, so it never marks the server offline."""
    if isinstance(error, HttpConnectTimeout):
        return True
    if isinstance(error, HttpTimeoutError):
        return False
    return isinstance(error, (HttpConnectError, HttpProtocolError))


def laravel_envelope(response: Any) -> Dict[str, Any]:
    """JSON envelope ``{success, data, error_code, ...}`` of one Laravel
    response; ``{}`` when the body is not a JSON object."""
    content_type = str(response.headers.get("Content-Type") or "").lower()
    body = response.json() if "json" in content_type else {}
    return body if isinstance(body, dict) else {}


def _encode_form(values: Any) -> str:
    """Form/query encoding (``None`` dropped, sequences repeated), done once so
    the signed and the sent query/body are the same string."""
    if isinstance(values, (str, bytes)):
        return values.decode("utf-8") if isinstance(values, bytes) else values
    items = values.items() if isinstance(values, dict) else values
    pairs = []
    for key, value in items:
        entries = value if isinstance(value, (list, tuple)) else [value]
        pairs.extend((key, entry) for entry in entries if entry is not None)
    return urlencode(pairs)


def _header_value(headers: Dict[str, Any], name: str) -> str:
    lowered = name.lower()
    return next((str(value) for key, value in headers.items() if str(key).lower() == lowered), "")


def _file_names(files: Any) -> list:
    iterable = files.items() if isinstance(files, dict) else enumerate(files)
    names = []
    for _key, value in iterable:
        first = value[0] if isinstance(value, (tuple, list)) and value else value
        names.append(first if isinstance(first, str) else str(first))
    return names


def _summarize_params(params: Any = None, data: Any = None, json: Any = None, files: Any = None) -> str:
    """Compact params summary for the debugger (file contents never echoed)."""
    parts = []
    if params:
        parts.append("params=" + repr(params))
    if data is not None:
        parts.append("data=" + repr(data))
    if json is not None:
        parts.append("json=" + repr(json))
    if files:
        parts.append("files=" + repr(_file_names(files)))
    return " ".join(parts)[:_PARAM_SUMMARY_MAX]


def _summarize_json(body: Any) -> str:
    if isinstance(body, list):
        return f"list[{len(body)}]"
    if not isinstance(body, dict):
        return repr(body)[:_BODY_SUMMARY_MAX]
    parts = []
    if "success" in body:
        parts.append(f"success={body['success']}")
    if body.get("error"):
        parts.append(f"error={str(body['error'])[:80]}")
    data = body.get("data")
    if isinstance(data, dict):
        if "total" in data:
            parts.append(f"total={data['total']}")
        if isinstance(data.get("items"), list):
            parts.append(f"items={len(data['items'])}")
        if isinstance(data.get("summary"), dict):
            parts.append("summary=" + repr(data["summary"])[:100])
    elif isinstance(data, list):
        parts.append(f"data[{len(data)}]")
    elif data is not None:
        parts.append(f"data={str(data)[:60]}")
    if not parts:
        parts.append("keys=" + ",".join(list(body.keys())[:8]))
    return " ".join(parts)[:_BODY_SUMMARY_MAX]


def _summarize_response(response: Any) -> str:
    """Decision-relevant body summary: JSON fields, truncated text, or the
    content type and size of a binary body."""
    content_type = (response.headers.get("Content-Type") or "").lower()
    if "json" in content_type:
        try:
            body = response.json()
        except ValueError as exc:
            return f"invalid json ({type(exc).__name__})"
        return _summarize_json(body)
    if content_type.startswith("text/") or "html" in content_type:
        return (response.text or "").strip().replace("\n", " ")[:_BODY_SUMMARY_MAX]
    return f"{content_type or 'binary'} {len(response.content)}B"


def _origin(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else ""


def _is_full_url(path: str) -> bool:
    return isinstance(path, str) and path.startswith(("http://", "https://"))


def _display_path(path: str) -> str:
    if _is_full_url(path):
        parts = urlsplit(path)
        return (parts.path or "/") + (("?" + parts.query) if parts.query else "")
    return path if path.startswith("/") else "/" + path


class LaravelClient:
    """Signed, recorded pycore->Laravel requests."""

    @staticmethod
    def build_url(path: str, base_url: Optional[str] = None) -> str:
        """Absolute URL of ``path`` on ``base_url`` (default: the resolved endpoint)."""
        if " " in path or '"' in path or "'" in path:
            raise ValueError(f"Invalid URL path (contains spaces or quotes): {path}")
        if _is_full_url(path):
            return path
        base = (base_url or laravel_endpoint_manager.resolve()).rstrip("/")
        return base + (path if path.startswith("/") else "/" + path)

    def request(self, method: str, path: str, *, base_url: Optional[str] = None,
                params: Any = None, data: Any = None, json: Any = None,
                files: Any = None, headers: Any = None, timeout: Any = None,
                progress_callback: Any = None,
                stream: bool = False, allow_redirects: bool = True,
                log_line: bool = True,
                sensitive_request: bool = False):
        """Issue one Laravel request, log and record it, return the ``HttpResponse``.

        ``path`` is a full URL or a path joined onto ``base_url`` / the resolved
        endpoint. ``params`` and form ``data`` are encoded before signing so the
        signature covers the transmitted bytes; multipart uploads sign
        ``UNSIGNED-PAYLOAD``. ``log_line=False`` silences the console line (the
        recorder still sees the request). Uploads (bodies of at least one
        contract chunk) are progress-driven (``http_client``); ``timeout``
        bounds every other request and only the connect phase of an upload.
        """
        method = (method or "GET").upper()
        url = self.build_url(path, base_url)
        display_path = _display_path(path)
        summary = _summarize_params(
            params,
            "<redacted>" if sensitive_request and data is not None else data,
            "<redacted>" if sensitive_request and json is not None else json,
            files,
        )
        if timeout is None:
            # Default for bodiless and small control requests: the shared
            # transfer contract (connect bound, per-read idle bound), so a hung
            # server never stalls a thread; uploads use only the connect bound.
            contract = http_transfer_contract()
            timeout = (contract["connect_timeout_seconds"], contract["idle_timeout_seconds"])
        request_headers = dict(headers or {})
        request_body = data
        if json is not None and data is None and files is None:
            request_body = json_module.dumps(json, allow_nan=False).encode("utf-8")
            if not _header_value(request_headers, _CONTENT_TYPE_HEADER):
                request_headers[_CONTENT_TYPE_HEADER] = _JSON_CONTENT_TYPE
        if params:
            url = f"{url}{'&' if urlsplit(url).query else '?'}{_encode_form(params)}"
        form = None
        if files is not None:
            form, request_body = request_body, None
        elif isinstance(request_body, (dict, list, tuple)):
            request_body = _encode_form(request_body).encode("utf-8")
            if not _header_value(request_headers, _CONTENT_TYPE_HEADER):
                request_headers[_CONTENT_TYPE_HEADER] = _FORM_CONTENT_TYPE
        elif isinstance(request_body, (str, bytearray)):
            request_body = request_body.encode("utf-8") if isinstance(request_body, str) else bytes(request_body)
        if request_body is not None and not isinstance(request_body, bytes):
            raise ValueError(f"Laravel request body must be bytes, str, json or form fields: {type(request_body).__name__}")
        request_headers.update(client_key_headers(
            method,
            url,
            request_body or b"",
            _MULTIPART_CONTENT_TYPE if files is not None else _header_value(request_headers, _CONTENT_TYPE_HEADER),
        ))
        started = time.perf_counter()
        try:
            response = http_client.request(
                method, url,
                headers=request_headers, body=request_body, form=form, files=files,
                timeout=timeout,
                progress_callback=progress_callback,
                stream=stream, follow_redirects=allow_redirects,
            )
        except OSError as exc:
            ms = (time.perf_counter() - started) * 1000.0
            error = redacted_http_error(exc)
            if laravel_server_unreachable(exc):
                laravel_reachability.note(_origin(url), False)
            if log_line:
                ColorPrint.red(f"[laravel] {method} {url} -> ERR ({ms:.0f}ms) {error}")
            laravel_http_recorder.notify({
                "ts": time.time(), "method": method, "url": url, "path": display_path,
                "params_summary": summary, "status": 0, "ms": round(ms, 1),
                "error": error, "base_url": base_url,
                "transport": HTTP_TRANSPORT_NAME, "http_version": "",
            })
            raise
        ms = (time.perf_counter() - started) * 1000.0
        status = response.status_code
        server_id = str(response.headers.get(LARAVEL_SERVER_ID_HEADER) or "").strip()
        laravel_reachability.note(
            _origin(url),
            status not in LARAVEL_OFFLINE_STATUSES,
            {"server_id": server_id} if server_id else None,
        )
        body_summary = "" if stream else _summarize_response(response)
        if log_line:
            line = f"[laravel] {method} {url} -> {status} ({ms:.0f}ms)"
            if body_summary:
                line += f" {body_summary}"
            if status >= 400:
                ColorPrint.yellow(line)
            else:
                ColorPrint.cyan(line)
        laravel_http_recorder.notify({
            "ts": time.time(), "method": method, "url": url, "path": display_path,
            "params_summary": summary, "status": status, "ms": round(ms, 1),
            "error": None, "base_url": base_url,
            "response_summary": body_summary,
            "transport": HTTP_TRANSPORT_NAME, "http_version": response.http_version,
        })
        return response

    def get(self, path: str, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs):
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs):
        return self.request("PUT", path, **kwargs)

    def delete(self, path: str, **kwargs):
        return self.request("DELETE", path, **kwargs)

    def head(self, path: str, **kwargs):
        return self.request("HEAD", path, **kwargs)


laravel_client = LaravelClient()
