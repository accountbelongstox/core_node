# -*- coding: utf-8 -*-
"""
LaravelClient - the ONE consolidated pycore->Laravel HTTP gateway.

Every pycore->Laravel HTTP call (workers, routers, media-sync, the :9003 OCR
bridge) goes through here. Each request:

  * resolves the base URL via ``LaravelEndpointManager`` (or an explicit override),
  * times the round-trip,
  * prints ``[laravel] METHOD https://host/path -> STATUS (XXms) <body summary>`` — always the FULL URL, scheme and host included — via
    ColorPrint (JSON bodies surface success/total/items/error; text truncated;
    binary reported as content-type + bytes) - so it lands
    in the ``pyservice.ps1``/``pyservice.sh`` terminal (the worker runs foreground
    ``python -u``; ColorPrint writes to stderr) and the ``pycore_log`` HTTP event
    stream published by rpc,
  * notifies ``LaravelHttpRecorder`` with a structured record - rpc relays it as
    a ``laravel_http`` event to the dashboard HTTP debugger (PcHttpDebugger),
  * returns the raw requests-compatible response so callers keep
    ``.status_code`` / ``.json()`` / ``.text`` / ``.iter_lines()``.

Uses one keep-alive session per THREAD (pooled transport, see transport.py), so no
mutable HTTP state crosses threads while consecutive requests reuse pooled
TCP/TLS connections. Payload uploads use the shared progress transport;
bodyless requests use Requests.
Streaming responses release their pooled connection back to the thread pool
when the stream is consumed or closed; they never close the pooled session.

Layering: imports ``laravel_endpoint_manager`` (one-way, top-level). The recorder
lives in its own zero-dep module so the endpoint manager can import it too without
cycling back here. No function-level internal imports.
"""
import json as json_module
import time
from typing import Any, Dict, Optional
from urllib.parse import urlencode, urlsplit

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.service_config import LARAVEL_WORKER_API_URL
from pycore.pyutils.common.http_progress_upload import http_progress_client
from pycore.pyutils.laravel.http_recorder import (
    laravel_http_recorder,
)
from pycore.pyutils.laravel.endpoint_manager import (
    LARAVEL_ERROR_ENDPOINT_UNKNOWN,
    LARAVEL_ERROR_SERVER_NOT_SELECTED,
    LARAVEL_OFFLINE_STATUSES,
    laravel_endpoint_manager,
    laravel_reachability,
)
from pycore.pyutils.laravel.identity import LARAVEL_SERVER_ID_HEADER
from pycore.pyutils.common.client_key_auth import client_key_headers
from pycore.pyutils.common.laravel_http_transport import (
    TRANSPORT_HTTPX,
    create_laravel_http_session,
    response_http_version,
)

_FALLBACK_BASE = LARAVEL_WORKER_API_URL
_PARAM_SUMMARY_MAX = 240
_BODY_SUMMARY_MAX = 200
# requests' own default is "wait forever" — cap it so a hung Laravel worker can
# never stall a pycore heartbeat/worker thread indefinitely.
_DEFAULT_TIMEOUT = 30.0
_CONTENT_TYPE_HEADER = "Content-Type"
_JSON_CONTENT_TYPE = "application/json"
_FORM_CONTENT_TYPE = "application/x-www-form-urlencoded"
_MULTIPART_CONTENT_TYPE = "multipart/form-data"


LARAVEL_ERROR_TIMEOUT = "LARAVEL_TIMEOUT"
LARAVEL_ERROR_UNREACHABLE = "LARAVEL_UNREACHABLE"
LARAVEL_ERROR_HTTP = "LARAVEL_HTTP_ERROR"
LARAVEL_ERROR_BAD_RESPONSE = "LARAVEL_BAD_RESPONSE"
LARAVEL_ERROR_REQUEST_FAILED = "LARAVEL_REQUEST_FAILED"
_TIMEOUT_ERROR_NAMES = ("Timeout", "TimedOut", "ReadTimeout", "ConnectTimeout", "WriteTimeout", "PoolTimeout")
_UNREACHABLE_ERROR_NAMES = ("ConnectionError", "ConnectError", "NetworkError", "RemoteProtocolError", "ProxyError", "SSLError")
_BAD_RESPONSE_ERROR_NAMES = ("JSONDecodeError", "ValueError", "DecodingError")


def laravel_failure(error: Any = None, status_code: int = 0) -> Dict[str, Any]:
    """Stable ``{error_code, detail, status}`` for a failed Laravel call.

    ONE classification for every UI-facing pycore->Laravel failure: callers
    persist/return ``error_code`` (translated by the UI) and keep the raw text
    only as a short ``detail`` — raw requests/httpx exception text is never a
    user-facing message.
    """
    if status_code:
        return {
            "error_code": LARAVEL_ERROR_HTTP,
            "detail": f"HTTP {int(status_code)}",
            "status": int(status_code),
        }
    names = [cls.__name__ for cls in type(error).__mro__] if isinstance(error, BaseException) else []
    if any(name.endswith(_TIMEOUT_ERROR_NAMES) for name in names):
        code = LARAVEL_ERROR_TIMEOUT
    elif any(name in _UNREACHABLE_ERROR_NAMES for name in names):
        code = LARAVEL_ERROR_UNREACHABLE
    elif any(name in _BAD_RESPONSE_ERROR_NAMES for name in names):
        code = LARAVEL_ERROR_BAD_RESPONSE
    else:
        code = LARAVEL_ERROR_REQUEST_FAILED
    return {"error_code": code, "detail": _short_err(error) if error is not None else "", "status": 0}


def laravel_server_unreachable(error: Any) -> bool:
    """True only for a failure to reach the server: connect refused / failed /
    timed out, or the connection dropped. A read or write stall means the
    connection was made (the server is busy, or the transfer stalled), so it
    never marks the server offline."""
    names = [cls.__name__ for cls in type(error).__mro__] if isinstance(error, BaseException) else []
    if "ConnectTimeout" in names:
        return True
    if any(name.endswith(_TIMEOUT_ERROR_NAMES) for name in names):
        return False
    return any(name in _UNREACHABLE_ERROR_NAMES for name in names)


def laravel_envelope(response: Any) -> Dict[str, Any]:
    """JSON envelope ``{success, data, error_code, ...}`` of one Laravel
    response; ``{}`` when the body is not a JSON object."""
    content_type = str(response.headers.get("Content-Type") or "").lower()
    body = response.json() if "json" in content_type else {}
    return body if isinstance(body, dict) else {}


def _short_err(err: Any) -> str:
    """One-line condenser for requests exceptions (consolidates 4 prior copies)."""
    msg = str(err)
    # requests connection errors embed the URL (": ..."); drop the URL prefix.
    if "': " in msg:
        msg = msg.split("': ", 1)[-1]
    if not msg:
        msg = type(err).__name__ if isinstance(err, BaseException) else "error"
    line = msg.splitlines()[0]
    return line[:200]


def _encode_form(values: Any) -> str:
    """Requests-compatible form/query encoding (``None`` dropped, scalars
    ``str()``-ed, sequences repeated), done once so the signed and the sent
    query/body are the same string."""
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


def _summarize_params(params: Any = None, data: Any = None, json: Any = None,
                      files: Any = None) -> str:
    """Compact, trunc-safe params summary for the debugger (file contents never echoed)."""
    parts = []
    try:
        if params:
            parts.append("params=" + repr(params))
        if data is not None:
            parts.append("data=" + repr(data))
        if json is not None:
            parts.append("json=" + repr(json))
        if files:
            names = []
            iterable = files.items() if isinstance(files, dict) else enumerate(files)
            for _k, v in iterable:
                if isinstance(v, (tuple, list)) and v:
                    names.append(v[0] if isinstance(v[0], str) else str(v[0]))
                else:
                    names.append(str(v))
            parts.append("files=" + repr(names))
    except Exception:
        pass
    s = " ".join(parts)
    return s[:_PARAM_SUMMARY_MAX]


def _summarize_response(resp: Any) -> str:
    """Compact response-body summary for the log line + debugger. Never raises.

    JSON bodies surface the decision-relevant fields (success/total/items count/
    error) so a `-> 200` line shows WHAT came back; text bodies are truncated;
    binary bodies report content-type + byte count (contents never echoed).
    """
    try:
        ctype = (resp.headers.get("Content-Type") or "").lower()
        if "json" in ctype:
            body = resp.json()
            if isinstance(body, dict):
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
                elif data is not None and not isinstance(data, (dict, list)):
                    parts.append(f"data={str(data)[:60]}")
                if not parts:
                    parts.append("keys=" + ",".join(list(body.keys())[:8]))
                return " ".join(parts)[:_BODY_SUMMARY_MAX]
            if isinstance(body, list):
                return f"list[{len(body)}]"
            return repr(body)[:_BODY_SUMMARY_MAX]
        if ctype.startswith("text/") or "html" in ctype:
            return (resp.text or "").strip().replace("\n", " ")[:_BODY_SUMMARY_MAX]
        return f"{ctype or 'binary'} {len(resp.content)}B"
    except Exception:
        return ""


class LaravelClient:
    """Singleton unified pycore->Laravel HTTP client."""

    def _resolve_base(self, base_url: Optional[str]) -> str:
        if base_url:
            return base_url.rstrip("/")
        try:
            resolved = laravel_endpoint_manager.resolve()
            if resolved:
                return resolved.rstrip("/")
        except Exception as e:
            ColorPrint.yellow(f"[laravel] endpoint resolve failed, using fallback: {_short_err(e)}")
        return _FALLBACK_BASE

    @staticmethod
    def _is_full_url(path: str) -> bool:
        return isinstance(path, str) and (path.startswith("http://") or path.startswith("https://"))

    def _build_url(self, path: str, base_url: Optional[str]) -> str:
        if " " in path or '"' in path or "'" in path:
            raise ValueError(f"Invalid URL path (contains spaces or quotes): {path}")
        if self._is_full_url(path):
            return path
        base = self._resolve_base(base_url)
        if not path.startswith("/"):
            path = "/" + path
        return base + path

    @staticmethod
    def _origin(url: str) -> str:
        parts = urlsplit(url)
        return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else ""

    @staticmethod
    def _display_path(path: str) -> str:
        if LaravelClient._is_full_url(path):
            try:
                sp = urlsplit(path)
                return (sp.path or "/") + (("?" + sp.query) if sp.query else "")
            except Exception:
                return path
        return path if path.startswith("/") else "/" + path

    def request(self, method: str, path: str, *, base_url: Optional[str] = None,
                params: Any = None, data: Any = None, json: Any = None,
                files: Any = None, headers: Any = None, timeout: Any = None,
                activity_timeout: Optional[Dict[str, Any]] = None,
                progress_callback: Any = None,
                stream: bool = False, allow_redirects: bool = True,
                log_line: bool = True,
                sensitive_request: bool = False,
                **kwargs):
        """Issue a Laravel HTTP request, log + record it, return the raw Response.

        ``path`` may be a full URL (used as-is) or a path joined onto the resolved
        base. ``base_url`` overrides resolution (used by the :9003 OCR bridge and
        by callers that already resolved a specific endpoint).
        Every request carries the K3 client-key signature
        (``client_key_auth``): ``params`` are encoded into the URL and form
        fields into the body before signing, so the signed path, query and
        body digest are the exact transmitted bytes; multipart uploads sign
        ``UNSIGNED-PAYLOAD``.
        ``log_line=False`` silences the console line for high-frequency polls
        (the caller prints its own compact line); the HTTP recorder still sees
        the request so UI diagnostics keep working.
        ``activity_timeout`` (the shared ``http_transfer_contract()`` dict) is the
        ONE progress-driven timeout mode: connect must finish within
        ``connect_timeout_seconds`` and any socket stall longer than
        ``idle_timeout_seconds`` fails, but a transfer that keeps making
        progress never times out - multi-hour uploads are safe while a dead
        peer still fails fast. Uploads and worker traffic use this mode
        instead of a fixed total deadline.
        """
        method = (method or "GET").upper()
        url = self._build_url(path, base_url)
        display_path = self._display_path(path)
        summary = _summarize_params(
            params,
            "<redacted>" if sensitive_request and data is not None else data,
            "<redacted>" if sensitive_request and json is not None else json,
            files,
        )
        if timeout is None and not activity_timeout:
            timeout = _DEFAULT_TIMEOUT
        request_headers = dict(headers or {})
        started = time.perf_counter()
        status = 0
        session, transport_options, transport = create_laravel_http_session()
        request_options = dict(transport_options)
        request_options.update(kwargs)
        request_data = data
        request_json = json
        request_files = files
        http_version = ""
        if json is not None and data is None and files is None:
            request_data = json_module.dumps(json, allow_nan=False).encode("utf-8")
            request_json = None
            if not _header_value(request_headers, _CONTENT_TYPE_HEADER):
                request_headers[_CONTENT_TYPE_HEADER] = _JSON_CONTENT_TYPE
        if params:
            url = f"{url}{'&' if urlsplit(url).query else '?'}{_encode_form(params)}"
            params = None
        if files is None and isinstance(request_data, (dict, list, tuple)):
            request_data = _encode_form(request_data).encode("utf-8")
            if not _header_value(request_headers, _CONTENT_TYPE_HEADER):
                request_headers[_CONTENT_TYPE_HEADER] = _FORM_CONTENT_TYPE
        elif isinstance(request_data, (str, bytearray)):
            request_data = request_data.encode("utf-8") if isinstance(request_data, str) else bytes(request_data)
        if request_json is not None or (
            files is None and request_data is not None and not isinstance(request_data, bytes)
        ):
            raise ValueError(f"Laravel request body must be bytes, str, json or form fields: {type(request_data).__name__}")
        request_headers.update(client_key_headers(
            method,
            url,
            request_data if isinstance(request_data, bytes) else b"",
            _MULTIPART_CONTENT_TYPE if files is not None else _header_value(request_headers, _CONTENT_TYPE_HEADER),
        ))
        try:
            uploading = request_data is not None or request_json is not None or request_files is not None
            sender = http_progress_client if uploading else session
            if uploading:
                transport = TRANSPORT_HTTPX
                request_options["activity_timeout"] = activity_timeout
                request_options["progress_callback"] = progress_callback
            elif activity_timeout:
                timeout = (activity_timeout["connect_timeout_seconds"], activity_timeout["idle_timeout_seconds"])
            resp = sender.request(
                method, url,
                params=params, data=request_data, json=request_json, files=request_files,
                headers=request_headers, timeout=timeout, stream=stream,
                allow_redirects=allow_redirects, **request_options,
            )
            http_version = response_http_version(resp)
            resp.pycore_transport = transport
            resp.pycore_http_version = http_version
            # Keep-alive pooling (transport.py): the session is the calling
            # thread's pooled session and must never be closed here. Non-
            # streaming bodies are fully read by callers, which returns the
            # connection to the pool; streaming responses release theirs on
            # close()/exhaustion.
            ms = (time.perf_counter() - started) * 1000.0
            status = resp.status_code
            server_id = str(resp.headers.get(LARAVEL_SERVER_ID_HEADER) or "").strip()
            laravel_reachability.note(
                self._origin(url),
                status not in LARAVEL_OFFLINE_STATUSES,
                {"server_id": server_id} if server_id else None,
            )
            body_summary = "" if stream else _summarize_response(resp)
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
                "transport": transport, "http_version": http_version,
            })
            return resp
        except Exception as e:
            ms = (time.perf_counter() - started) * 1000.0
            err = _short_err(e)
            if laravel_server_unreachable(e):
                laravel_reachability.note(self._origin(url), False)
            if log_line:
                ColorPrint.red(f"[laravel] {method} {url} -> ERR ({ms:.0f}ms) {err}")
            laravel_http_recorder.notify({
                "ts": time.time(), "method": method, "url": url, "path": display_path,
                "params_summary": summary, "status": status, "ms": round(ms, 1),
                "error": err, "base_url": base_url,
                "transport": transport, "http_version": http_version,
            })
            raise

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

    def get_stream(self, path: str, **kwargs):
        """Open a streaming GET (SSE). Returns the raw Response for iter_lines()."""
        kwargs.setdefault("stream", True)
        return self.request("GET", path, **kwargs)


laravel_client = LaravelClient()
