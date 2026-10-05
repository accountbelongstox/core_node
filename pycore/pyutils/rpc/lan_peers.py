# -*- coding: utf-8 -*-
"""The other pycore machines on this machine's LAN and K3-signed JSON calls to their routes."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.event_journal import event_journal
from pycore.pyfoundations.network_constants import HTTP_API_PREFIX
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.rpc_route_contract import rpc_route_contract
from pycore.pyutils.common.client_key_auth import client_key_headers
from pycore.pyutils.common.http_client import RESPONSE_CONTROL, HttpClient
from pycore.pyutils.rpc.lan_machines import lan_machines

LABEL = "LanPeers"
JSON_CONTENT_TYPE = "application/json"
HTTP_NOT_FOUND = 404


class LanPeers:
    def peers(self) -> List[Dict[str, Any]]:
        """Reachable LAN pycores from the cached scan, without this process (a stale scan refreshes in the background)."""
        own_instance = event_journal.instance_id
        return [
            machine for machine in lan_machines.snapshot()["machines"]
            if not machine["self"] and machine["instance_id"] != own_instance
        ]

    def post(self, base_url: str, route_key: str, payload: Dict[str, Any], timeout: float) -> Optional[Dict[str, Any]]:
        """POST one contract route on a peer; None when the peer is unreachable, lacks the route or refused."""
        path = f"{HTTP_API_PREFIX}/{rpc_route_contract.path(route_key)}"
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers = {
            "Content-Type": JSON_CONTENT_TYPE,
            **client_key_headers("POST", base_url.rstrip("/") + path, body, JSON_CONTENT_TYPE),
        }
        client = HttpClient(base_url=base_url, default_timeout=timeout, trust_env=False)
        try:
            response = client.post(path, body=body, headers=headers, response=RESPONSE_CONTROL)
            result = response.json() if response.status_code == 200 else None
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[{LABEL}] {route_key} on {base_url} failed: {exc}")
            return None
        if result is None and response.status_code != HTTP_NOT_FOUND:
            ColorPrint.yellow(f"[{LABEL}] {route_key} on {base_url} -> HTTP {response.status_code}")
        return result if isinstance(result, dict) else None


lan_peers = LanPeers()


__all__ = ["LanPeers", "lan_peers"]
