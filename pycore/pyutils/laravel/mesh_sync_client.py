# -*- coding: utf-8 -*-
"""MeshSync client (config/mesh_sync_contract.json): signed record push to one Laravel server and
search of the replicated records. The pycore half of MeshSync; producers publish through
``mesh_sync_publisher`` (a fan-out kind of the Laravel delivery outbox), never through this client."""

from __future__ import annotations

import json
from typing import Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.pyutils.common.http_client import RESPONSE_CONTROL
from pycore.pyutils.laravel.client import laravel_client, laravel_envelope

LABEL = "MeshSync"
MESH_SYNC_CONTRACT_PATH = get_core_node_root() / "config" / "mesh_sync_contract.json"
HTTP_SERVER_ERROR = 500
HTTP_ERROR = 400


class MeshSyncClient:
    def __init__(self) -> None:
        document = json.loads(MESH_SYNC_CONTRACT_PATH.read_text(encoding="utf-8"))
        self._prefix = str(document["api_prefix"]).rstrip("/")
        self._routes: Dict[str, Dict[str, str]] = dict(document["routes"])
        self._limits: Dict[str, int] = {str(key): int(value) for key, value in document["limits"].items()}
        self.streams: Dict[str, str] = {str(key): str(value) for key, value in document["streams"].items()}

    def limit(self, name: str) -> int:
        return self._limits[name]

    def _path(self, route: str) -> str:
        return f"{self._prefix}/{self._routes[route]['path']}"

    def push(self, base_url: str, records: List[Dict[str, Any]], peers: List[Dict[str, str]]) -> Dict[str, Any]:
        """Ingest ``records`` on one server and announce ``peers`` to it. ``{success, status_code,
        server_error, accepted, unchanged, rejected: [{stream, key, error}], error}``."""
        try:
            response = laravel_client.post(
                self._path("records"), base_url=base_url, json={"records": records, "peers": peers},
                response=RESPONSE_CONTROL, log_line=False,
            )
        except OSError as exc:
            ColorPrint.yellow(f"[{LABEL}] push to {base_url} failed: {exc}")
            return {"success": False, "status_code": 0, "server_error": False, "error": str(exc)}
        body = laravel_envelope(response)
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        if response.status_code >= HTTP_ERROR or not body.get("success"):
            return {
                "success": False,
                "status_code": response.status_code,
                "server_error": response.status_code >= HTTP_SERVER_ERROR,
                "error": str(body.get("error_code") or body.get("message") or f"HTTP {response.status_code}"),
            }
        return {
            "success": True,
            "status_code": response.status_code,
            "server_error": False,
            "accepted": int(data.get("accepted") or 0),
            "unchanged": int(data.get("unchanged") or 0),
            "rejected": list(data.get("rejected") or []),
            "error": "",
        }

    def search(self, query: str, streams: List[str], limit: int, base_url: str = "") -> Dict[str, Any]:
        """Live records containing ``query`` on one server (default: the selected one), newest first:
        ``{success, records: [{stream, key, origin, version, payload, updated_at}], error}``."""
        try:
            response = laravel_client.get(
                self._path("search"), base_url=base_url or None,
                params={"q": query, "streams": ",".join(streams), "limit": limit}, log_line=False,
            )
        except OSError as exc:
            ColorPrint.yellow(f"[{LABEL}] search failed: {exc}")
            return {"success": False, "records": [], "error": str(exc)}
        body = laravel_envelope(response)
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        if response.status_code >= HTTP_ERROR or not body.get("success"):
            return {"success": False, "records": [], "error": str(body.get("error_code") or f"HTTP {response.status_code}")}
        return {"success": True, "records": list(data.get("records") or []), "error": ""}


mesh_sync_client = MeshSyncClient()

__all__ = ["MeshSyncClient", "mesh_sync_client"]
