# -*- coding: utf-8 -*-
"""The pycore RPC route contract (config/pycore_rpc_contract.json): the single
source of route paths and methods shared by callmodule and the UI."""

from __future__ import annotations

import json
from typing import Dict, Tuple

from pycore.pyfoundations.system_paths import get_core_node_root

RPC_ROUTE_CONTRACT_PATH = (get_core_node_root() / "config" / "pycore_rpc_contract.json").resolve()


class RpcRouteContract:
    """Route key -> {path, method}; an unknown key is a bug and raises KeyError."""

    def __init__(self) -> None:
        document = json.loads(RPC_ROUTE_CONTRACT_PATH.read_text(encoding="utf-8"))
        self.api_prefix = str(document["api_prefix"])
        self._routes: Dict[str, Dict[str, str]] = {
            str(key): {"path": str(route["path"]), "method": str(route["method"]).upper()}
            for key, route in document["routes"].items()
        }
        # Protocol routes the HTTP server itself serves (status/info/routes/client-id).
        self._protocol_routes: Dict[str, Dict[str, str]] = {
            str(key): {"path": str(route["path"]), "method": str(route["method"]).upper()}
            for key, route in document.get("protocol_routes", {}).items()
        }

    def path(self, key: str) -> str:
        return self._routes[key]["path"]

    def method(self, key: str) -> str:
        return self._routes[key]["method"]

    def methods_by_path(self) -> Dict[str, Tuple[str, ...]]:
        return {route["path"]: (route["method"],) for route in self._routes.values()}

    def protocol_paths(self) -> frozenset:
        return frozenset(route["path"] for route in self._protocol_routes.values())


rpc_route_contract = RpcRouteContract()


__all__ = ["RPC_ROUTE_CONTRACT_PATH", "RpcRouteContract", "rpc_route_contract"]
