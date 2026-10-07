# -*- coding: utf-8 -*-
"""Signed pycore calls to the Laravel agent bus (config/agent_bus_contract.json); the
agent machine segment is the K3 signature's pycore machine id."""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.pyutils.common.http_client import RESPONSE_CONTROL
from pycore.pyutils.laravel.client import laravel_client

LABEL = "AgentBus"
AGENT_BUS_CONTRACT_PATH = get_core_node_root() / "config" / "agent_bus_contract.json"


class AgentBusClient:
    def __init__(self) -> None:
        document = json.loads(AGENT_BUS_CONTRACT_PATH.read_text(encoding="utf-8"))
        self._prefix = str(document["api_prefix"]).rstrip("/")
        self._agent_header = str(document["identity"]["agent_header"])
        self._operations = {str(operation["name"]): operation for operation in document["operations"]}

    def call(self, operation: str, agent: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """One bus operation as ``agent``; the decoded reply, or None when Laravel refused or was unreachable."""
        definition = self._operations[operation]
        method = str(definition["method"]).upper()
        path = f"{self._prefix}/{definition['path']}"
        headers = {self._agent_header: agent}
        try:
            if method == "GET":
                response = laravel_client.request(method, path, params=params, headers=headers, log_line=False)
            else:
                response = laravel_client.request(
                    method, path, json=params, headers=headers, log_line=False, response=RESPONSE_CONTROL,
                )
        except OSError as exc:
            ColorPrint.yellow(f"[{LABEL}] {operation} failed: {exc}")
            return None
        if response.status_code >= 400:
            ColorPrint.yellow(f"[{LABEL}] {operation} -> HTTP {response.status_code}")
            return None
        try:
            payload = response.json()
        except ValueError as exc:
            ColorPrint.yellow(f"[{LABEL}] {operation} returned no JSON: {exc}")
            return None
        return payload if isinstance(payload, dict) else None


agent_bus_client = AgentBusClient()


__all__ = ["AgentBusClient", "agent_bus_client"]
