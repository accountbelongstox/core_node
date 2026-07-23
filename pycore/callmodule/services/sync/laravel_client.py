# -*- coding: utf-8 -*-
"""
LaravelClient - the ONE consolidated pycore->Laravel HTTP gateway.

Every pycore->Laravel HTTP call (workers, routers, media-sync, the :9003 OCR
bridge) goes through here. Each request:

  * resolves the base URL via ``LaravelEndpointManager`` (or an explicit override),
  * times the round-trip,
  * prints ``[laravel] METHOD /path -> STATUS (XXms) <body summary>`` via
    ColorPrint (JSON bodies surface success/total/items/error; text truncated;
    binary reported as content-type + bytes) - so it lands
    in the ``pyservice.ps1``/``pyservice.sh`` terminal (the worker runs foreground
    ``python -u``; ColorPrint writes to stderr) AND the existing ``pycore_log`` WS
    stream (rpc_v2 already relays every ColorPrint line),
  * notifies ``LaravelHttpRecorder`` with a structured record - rpc_v2 relays it as
    a ``laravel_http`` WS event to the dashboard HTTP debugger (PcHttpDebugger),
  * returns the raw ``requests.Response`` so callers keep
    ``.status_code`` / ``.json()`` / ``.text`` / ``.iter_lines()``.

Uses a single ``requests.Session`` for connection pooling. Synchronous (matches
every existing call site). The SSE reader (translation_ws_client_service) uses
``get_stream()`` which returns the open response for ``iter_lines()``.

Layering: imports ``laravel_endpoint_manager`` (one-way, top-level). The recorder
lives in its own zero-dep module so the endpoint manager can import it too without
cycling back here. No function-level internal imports.
"""
import time
from typing import Any, Dict, Optional
from urllib.parse import urlsplit

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests

from pycore.callmodule.services.sync.laravel_http_recorder import (
    get_laravel_http_recorder,
)
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    resolve_laravel_base_url,
)

_FALLBACK_BASE = "http://127.0.0.1:9000"
_PARAM_SUMMARY_MAX = 240
_BODY_SUMMARY_MAX = 200
# requests' own default is "wait forever" — cap it so a hung Laravel worker can
# never stall a pycore heartbeat/worker thread indefinitely.
_DEFAULT_TIMEOUT = 30.0


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

    def __init__(self):
        self._session = None

    def _session_get(self):
        # Rule §4: no lock — session creation is idempotent; worst case one
        # duplicate Session is built and discarded. Assignment is GIL-atomic.
        if self._session is None:
            self._session = get_third_package_requests().Session()
        return self._session

    def _resolve_base(self, base_url: Optional[str]) -> str:
        if base_url:
            return base_url.rstrip("/")
        try:
            resolved = resolve_laravel_base_url()
            if resolved:
                return resolved.rstrip("/")
        except Exception as e:
            ColorPrint.yellow(f"[laravel] endpoint resolve failed, using fallback: {_short_err(e)}")
        return _FALLBACK_BASE

    @staticmethod
    def _is_full_url(path: str) -> bool:
        return isinstance(path, str) and (path.startswith("http://") or path.startswith("https://"))

    def _build_url(self, path: str, base_url: Optional[str]) -> str:
        if self._is_full_url(path):
            return path
        base = self._resolve_base(base_url)
        if not path.startswith("/"):
            path = "/" + path
        return base + path

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
                stream: bool = False, allow_redirects: bool = True, **kwargs):
        """Issue a Laravel HTTP request, log + record it, return the raw Response.

        ``path`` may be a full URL (used as-is) or a path joined onto the resolved
        base. ``base_url`` overrides resolution (used by the :9003 OCR bridge and
        by callers that already resolved a specific endpoint).
        """
        method = (method or "GET").upper()
        url = self._build_url(path, base_url)
        display_path = self._display_path(path)
        summary = _summarize_params(params, data, json, files)
        if timeout is None:
            timeout = _DEFAULT_TIMEOUT
        started = time.perf_counter()
        status = 0
        try:
            resp = self._session_get().request(
                method, url,
                params=params, data=data, json=json, files=files,
                headers=headers, timeout=timeout, stream=stream,
                allow_redirects=allow_redirects, **kwargs,
            )
            ms = (time.perf_counter() - started) * 1000.0
            status = resp.status_code
            body_summary = "" if stream else _summarize_response(resp)
            line = f"[laravel] {method} {display_path} -> {status} ({ms:.0f}ms)"
            if body_summary:
                line += f" {body_summary}"
            if status >= 400:
                ColorPrint.yellow(line)
            else:
                ColorPrint.cyan(line)
            get_laravel_http_recorder().notify({
                "ts": time.time(), "method": method, "url": url, "path": display_path,
                "params_summary": summary, "status": status, "ms": round(ms, 1),
                "error": None, "base_url": base_url,
                "response_summary": body_summary,
            })
            return resp
        except Exception as e:
            ms = (time.perf_counter() - started) * 1000.0
            err = _short_err(e)
            ColorPrint.red(f"[laravel] {method} {display_path} -> ERR ({ms:.0f}ms) {err}")
            get_laravel_http_recorder().notify({
                "ts": time.time(), "method": method, "url": url, "path": display_path,
                "params_summary": summary, "status": status, "ms": round(ms, 1),
                "error": err, "base_url": base_url,
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


_client: Optional[LaravelClient] = None


def get_laravel_client() -> LaravelClient:
    """Singleton accessor (created on first use)."""
    global _client
    # Rule §4: no lock — creation is idempotent; worst case one duplicate
    # client is built and discarded. Module-attr assignment is GIL-atomic.
    if _client is None:
        _client = LaravelClient()
    return _client
