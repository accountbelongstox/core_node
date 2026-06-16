# -*- coding: utf-8 -*-
"""
Standalone HTTP server for Code Sync (stdlib `http.server` only).

Exposes the SAME `/code-sync/*` routes the in-process FastAPI router
(pycore/callmodule/routers/code_sync_router.py) serves, each a thin call into the
shared manager. Used ONLY in standalone mode (`pyservice.sh codesync run`); when
the full pycore runtime is up, its FastAPI app serves these routes instead and
this server is not started (so port 59000 is never double-bound).

No third-party deps; no pycore import.
"""

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional

from .runtime import log as ColorPrint
from .manager import get_manager


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

    def _send_json(self, obj: Any, status: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, data: bytes, status: int = 200,
                    content_type: str = "application/octet-stream") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):  # silence default stderr access log
        return

    # ---- routing ---------------------------------------------------------- #
    def do_GET(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        try:
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
            return self._send_json({"success": True, "role": m.set_role(body.get("role", "client"))})
        if path == "/code-sync/distribute":
            return self._send_json(m.set_distributing(bool(body.get("enabled", False))))
        if path == "/code-sync/skip-update":
            return self._send_json(m.set_skip_update(bool(body.get("enabled", False))))
        if path == "/code-sync/discover":
            return self._send_json(m.discover())

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
            file_path = server.root_dir / normalized
            if not file_path.exists():
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


class CodeSyncHTTPServer:
    """Thin lifecycle wrapper around a ThreadingHTTPServer bound to /code-sync/*."""

    def __init__(self, host: str = "0.0.0.0", port: int = 59000):
        self.host = host
        self.port = port
        self._httpd: Optional[ThreadingHTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._httpd = ThreadingHTTPServer((self.host, self.port), _Handler)
        self._httpd.daemon_threads = True
        self._thread = threading.Thread(target=self._httpd.serve_forever,
                                        daemon=True, name="CodeSync-HTTP")
        self._thread.start()
        ColorPrint.green(f"[CodeSync HTTP] Listening on http://{self.host}:{self.port}/code-sync/")

    def stop(self) -> None:
        if self._httpd is not None:
            try:
                self._httpd.shutdown()
                self._httpd.server_close()
            except Exception:
                pass
        ColorPrint.yellow("[CodeSync HTTP] Stopped")
