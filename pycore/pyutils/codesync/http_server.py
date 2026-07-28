# -*- coding: utf-8 -*-
"""
Standalone HTTP server for Code Sync (stdlib `http.server` only).

Exposes the SAME `/code-sync/*` routes the in-process FastAPI router
(pycore/callmodule/routers/code_sync_router.py) serves, each a thin call into the
shared manager. Used ONLY in standalone mode (`pyservice.sh codesync run`); when
the full pycore runtime is up, its FastAPI app serves these routes instead and
this server is not started (so port 59000 is never double-bound).

The control panel HTML lives in `.panel` (PANEL_HTML); the systemd self-management
ops live in `.service_ops`. Both are stdlib-only; no pycore import.

No third-party deps; no pycore import.
"""

import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional

from .runtime import log as ColorPrint, start_bus_task
from .manager import get_manager
from . import ws_proto
from .panel import PANEL_HTML
from .service_ops import (
    SERVICE_NAME,
    _service_status,
    _run_service_op_detached,
    _service_log_commands,
)

from urllib.parse import urlparse, parse_qs


# A client that disconnects mid-response raises one of these on write; they mean
# "the caller went away", not a server bug, so we drop them quietly. (BrokenPipe /
# ConnectionReset / ConnectionAborted are all subclasses of ConnectionError; OSError
# covers the rest, e.g. EPIPE surfacing as a bare OSError.)
_CONN_ERRORS = (ConnectionError, OSError)


def _manager():
    return get_manager()


class _Handler(BaseHTTPRequestHandler):
    server_version = "CodeSync/1.0"

    # ---- low-level helpers ------------------------------------------------ #
    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0:
            return {}
        try:
            raw = self.rfile.read(length)
            return json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            return {}

    def _write_response(self, body: bytes, status: int, content_type: str) -> None:
        """Write a full response, tolerating a client that disconnected mid-flight.
        A broken pipe / reset just means the caller went away — drop it quietly
        instead of letting the exception escape and spam a traceback (and, in the
        error paths, double-fault when the fallback 500 also can't be written)."""
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
        except _CONN_ERRORS:
            pass

    def _send_json(self, obj: Any, status: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
        self._write_response(body, status, "application/json; charset=utf-8")

    def _send_bytes(self, data: bytes, status: int = 200,
                    content_type: str = "application/octet-stream") -> None:
        self._write_response(data, status, content_type)

    def _send_html(self, html: str, status: int = 200) -> None:
        self._write_response(html.encode("utf-8"), status, "text/html; charset=utf-8")

    def log_message(self, fmt, *args):  # silence default stderr access log
        return

    # ---- WebSocket push receiver (this node accepts; the dev pushes) ------ #
    def _serve_ws(self) -> None:
        key = self.headers.get("Sec-WebSocket-Key", "")
        if not key:
            return self._send_json({"detail": "missing Sec-WebSocket-Key"}, status=400)
        try:
            self.wfile.write(ws_proto.server_handshake_response(key))
            self.wfile.flush()
        except _CONN_ERRORS:
            return  # client dropped before the upgrade completed

        def send(text: str) -> None:
            self.wfile.write(ws_proto.encode_frame(text.encode("utf-8"),
                                                   ws_proto.OP_TEXT, mask=False))
            self.wfile.flush()

        receiver = _manager().push_receiver
        try:
            while True:
                op, payload = ws_proto.read_message(self.rfile.read)
                if op == ws_proto.OP_CLOSE:
                    break
                if op == ws_proto.OP_PING:
                    self.wfile.write(ws_proto.encode_frame(payload, ws_proto.OP_PONG, mask=False))
                    self.wfile.flush()
                    continue
                if not receiver.handle_text(payload.decode("utf-8"), send):
                    break
        except (ConnectionError, OSError):
            pass
        except Exception as exc:
            ColorPrint.yellow(f"[CodeSync WS] receiver error: {exc}")

    # ---- routing ---------------------------------------------------------- #
    def do_GET(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        try:
            # WS push channel: the dev dials in here and pushes files (this node is
            # the WS server / receiver). Upgrade then loop applying pushed frames.
            # NOTE: full pycore does NOT run this standalone server — it serves the
            # SAME /code-sync/ws receiver on its rpc_v2 app (:59000) via
            # callmodule/config.py::_register_code_sync_ws. Keep both in sync.
            if path == "/code-sync/ws" and "websocket" in self.headers.get("Upgrade", "").lower():
                return self._serve_ws()
            if path == "/":
                # Light mode: there is nothing to administer locally, so serve a
                # tiny JSON identity blob instead of the full control panel.
                if getattr(self.server, "serve_panel", True) is False:
                    m = _manager()
                    return self._send_json({"service": "code-sync", "light": True,
                                            "role": m.get_role(), "reachable": True})
                # Standalone mode only: a self-contained, build-free control panel.
                # (Full pycore serves its React UI instead and never starts this server.)
                return self._send_html(PANEL_HTML)
            if path == "/favicon.ico":
                return self._send_bytes(b"", status=204, content_type="image/x-icon")
            if path == "/code-sync/ping":
                return self._send_json({"status": "ok", "service": "code-sync"})
            if path == "/code-sync/status":
                return self._send_json(_manager().get_status())
            if path == "/code-sync/peer/status":
                try:
                    return self._send_json(_manager().get_local_peer_status())
                except Exception as exc:
                    return self._send_json({"role": "client", "distributing": False, "error": str(exc)})
            if path == "/code-sync/peers":
                return self._send_json(_manager().get_peers())
            if path == "/code-sync/settings":
                return self._send_json(_manager().get_sync_settings())
            if path == "/code-sync/logs":
                limit = 100
                try:
                    q = parse_qs(urlparse(self.path).query)
                    limit = int((q.get("limit") or ["100"])[0])
                except Exception:
                    pass
                return self._send_json(_manager().get_sync_logs(limit))
            if path == "/code-sync/file-tree":
                return self._send_json(_manager().get_file_tree())
            if path == "/code-sync/peer-file-tree":
                pid = ""
                try:
                    q = parse_qs(urlparse(self.path).query)
                    pid = (q.get("peer_id") or [""])[0]
                except Exception:
                    pass
                if not pid:
                    return self._send_json({"success": False, "error": "peer_id required"}, status=400)
                return self._send_json(_manager().get_peer_file_tree(pid))
            if path == "/code-sync/service/status":
                return self._send_json(_service_status())
            return self._send_json({"detail": "Not found"}, status=404)
        except Exception as exc:
            return self._send_json({"detail": str(exc)}, status=500)

    def do_POST(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        body = self._read_json()
        try:
            return self._dispatch_post(path, body)
        except Exception as exc:
            return self._send_json({"detail": str(exc)}, status=500)

    def _dispatch_post(self, path: str, body: Dict[str, Any]):
        m = _manager()

        # ---- mesh / control ---------------------------------------------- #
        if path == "/code-sync/peer/config":
            return self._send_json(m.apply_remote_config(
                body.get("peers", []), body.get("version", 0), body.get("updated_at", 0.0)))
        if path == "/code-sync/peer/heartbeat":
            src = self.client_address[0] if self.client_address else None
            return self._send_json(m.receive_heartbeat(body, src))
        if path == "/code-sync/settings":
            return self._send_json(m.set_sync_settings(body))
        if path == "/code-sync/settings/reset":
            return self._send_json(m.reset_sync_settings())
        if path == "/code-sync/peers/add":
            return self._send_json(m.add_peer(
                body.get("name", ""), body.get("host", ""),
                int(body.get("port", 59000) or 59000), body.get("role", "client")))
        if path == "/code-sync/peers/remove":
            return self._send_json(m.remove_peer(body.get("id", "")))
        if path == "/code-sync/peers/update":
            fields = {k: v for k, v in body.items() if k != "id" and v is not None}
            return self._send_json(m.update_peer(body.get("id", ""), fields))
        if path == "/code-sync/role":
            return self._send_json(m.set_role(body.get("role", "client")))
        if path == "/code-sync/distribute":
            return self._send_json(m.set_distributing(bool(body.get("enabled", False))))
        if path == "/code-sync/skip-update":
            return self._send_json(m.set_skip_update(bool(body.get("enabled", False))))
        if path == "/code-sync/discover":
            return self._send_json(m.discover())

        # ---- service self-management (Linux/systemd; reuses pyservice.sh) - #
        # restart   -> `pyservice.sh codesync restart` (systemctl restart)
        # reinstall -> `pyservice.sh codesync install` (idempotent: rewrite unit
        #              + daemon-reload + enable + restart, same path as the
        #              `pyservice.sh codesync` prompt-YES flow).
        # Detached + 1s-delayed, so this reply reaches the panel before systemd
        # stops this very process; the panel then shows the log-view commands.
        if path in ("/code-sync/service/restart", "/code-sync/service/reinstall"):
            op = "restart" if path.endswith("restart") else "install"
            ok, command, err = _run_service_op_detached(op)
            resp = {
                "success": ok,
                "op": op,
                "command": command,
                "log_commands": _service_log_commands(),
                "note": ("The Code Sync service is restarting; this panel will "
                         "disconnect briefly. If it does not come back, run the "
                         "log commands on the machine to inspect the (re)start."),
            }
            if err:
                resp["error"] = err
            return self._send_json(resp, status=200 if ok else 503)

        # ---- file transfer (dev AND distributing) ------------------------ #
        if path == "/code-sync/register":
            if not m.is_server_mode():
                return self._send_json({"detail": "Not in server mode"}, status=503)
            server = m.get_server()
            if not server:
                return self._send_json({"detail": "Server not available"}, status=503)
            client_ip = self.client_address[0] if self.client_address else "unknown"
            needs = server.register_client(body.get("client_id", ""), client_ip)
            return self._send_json({"success": True, "needs_initial_sync": needs,
                                    "message": f"Client registered: {body.get('client_id', '')}"})
        if path == "/code-sync/initial-sync":
            if not m.is_server_mode():
                return self._send_json({"detail": "Not in server mode"}, status=503)
            server = m.get_server()
            if not server:
                return self._send_json({"detail": "Server not available"}, status=503)
            return self._send_json({"success": True,
                                    "files": server.get_initial_sync_files(body.get("client_id", ""))})
        if path == "/code-sync/changes":
            if not m.is_server_mode():
                return self._send_json({"detail": "Not in server mode"}, status=503)
            server = m.get_server()
            if not server:
                return self._send_json({"detail": "Server not available"}, status=503)
            cid = body.get("client_id", "")
            rc = int(body.get("received_count", 0) or 0)
            sc = int(body.get("skipped_count", 0) or 0)
            if rc > 0 or sc > 0:
                server.update_client_stats(cid, received_count=rc, skipped_count=sc)
            return self._send_json({"success": True, "files": server.get_changed_files(cid)})
        if path == "/code-sync/download":
            if not m.is_server_mode():
                return self._send_json({"detail": "Not in server mode"}, status=503)
            server = m.get_server()
            if not server:
                return self._send_json({"detail": "Server not available"}, status=503)
            normalized = str(body.get("file_path", "")).replace("\\", "/")
            # Contain the read strictly under root_dir: reject "../" traversal and
            # absolute paths (pathlib drops the left side when the right is absolute,
            # which would otherwise serve any file on disk to an unauthenticated peer).
            base = Path(server.root_dir).resolve()
            try:
                file_path = (base / normalized).resolve()
            except Exception:
                return self._send_json({"detail": "Invalid path"}, status=400)
            if file_path != base and base not in file_path.parents:
                return self._send_json({"detail": "Invalid path"}, status=400)
            if not file_path.is_file():
                return self._send_json({"detail": f"File not found: {normalized}"}, status=404)
            with open(file_path, "rb") as fh:
                return self._send_bytes(fh.read())
        if path == "/code-sync/toggle-backup":
            if not m.is_client_mode():
                return self._send_json({"detail": "Not in client mode"}, status=503)
            client = m.get_client()
            if not client:
                return self._send_json({"detail": "Client not available"}, status=503)
            enabled = bool(body.get("enabled", True))
            client.enable_backup = enabled
            return self._send_json({"success": True, "enabled": enabled})

        # ---- deprecated back-compat shims -------------------------------- #
        if path == "/code-sync/set-server":
            m.set_server_mode()
            return self._send_json({"success": True, "message": "Switched to server mode"})
        if path == "/code-sync/set-client":
            m.set_client_mode()
            return self._send_json({"success": True, "message": "Switched to client mode"})
        if path == "/code-sync/stop":
            m.stop()
            return self._send_json({"success": True, "message": "Code sync stopped"})

        return self._send_json({"detail": "Not found"}, status=404)


class _QuietHTTPServer(ThreadingHTTPServer):
    """HTTPServer that swallows client-disconnect errors instead of
    dumping a traceback per dropped request (frequent with health probes / the WS
    push link). Real server errors are still surfaced."""

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(exc, _CONN_ERRORS):
            return  # client went away — not a server fault, stay quiet
        super().handle_error(request, client_address)


class CodeSyncHTTPServer:
    """Thin lifecycle wrapper around an HTTPServer bound to /code-sync/*."""

    def __init__(self, host: str = "0.0.0.0", port: int = 59000,
                 serve_panel: bool = True):
        self.host = host
        self.port = port
        # When False (light mode), GET / returns a tiny JSON blob instead of the
        # full control panel. Stashed on the httpd so _Handler can read it.
        self.serve_panel = serve_panel
        self._httpd: Optional[ThreadingHTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._httpd = _QuietHTTPServer((self.host, self.port), _Handler)
        self._httpd.serve_panel = self.serve_panel
        self._thread = start_bus_task(
            self._httpd.serve_forever,
            thread_name="CodeSyncHTTPThread",
        )
        ColorPrint.green(f"[CodeSync HTTP] Listening on http://{self.host}:{self.port}/code-sync/")

    def stop(self) -> None:
        if self._httpd is not None:
            try:
                self._httpd.shutdown()
                self._httpd.server_close()
            except Exception:
                pass
        ColorPrint.yellow("[CodeSync HTTP] Stopped")
