# -*- coding: utf-8 -*-
"""The pycore RPC route contract (config/pycore_rpc_contract.json): the single
source of API prefix, protocol paths, route paths and methods. Stdlib only, so
standalone subprocesses that load network_constants by path can read it too."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Tuple

RPC_ROUTE_CONTRACT_PATH = Path(__file__).resolve().parents[2] / "config" / "pycore_rpc_contract.json"


def _route_table(section: Dict[str, Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    return {
        str(key): {"path": str(route["path"]), "method": str(route["method"]).upper()}
        for key, route in section.items()
    }


class RpcRouteContract:
    """Route key -> {path, method}; an unknown key is a bug and raises KeyError."""

    def __init__(self) -> None:
        document = json.loads(RPC_ROUTE_CONTRACT_PATH.read_text(encoding="utf-8"))
        self.api_prefix = "/" + str(document["api_prefix"]).strip("/")
        self._routes = _route_table(document["routes"])
        # Protocol routes the HTTP server itself serves (status/info/routes/client-id).
        self._protocol_routes = _route_table(document["protocol_routes"])
        # The one keyset-cursor list shape (request/response keys, limits).
        self.keyset_page = dict(document["keyset_page"])

    def path(self, key: str) -> str:
        return self._routes[key]["path"]

    def method(self, key: str) -> str:
        return self._routes[key]["method"]

    def methods_by_path(self) -> Dict[str, Tuple[str, ...]]:
        return {route["path"]: (route["method"],) for route in self._routes.values()}

    def protocol_paths(self) -> frozenset:
        return frozenset(route["path"] for route in self._protocol_routes.values())

    def protocol_url_path(self, key: str) -> str:
        """Absolute URL path of one protocol route (``/api/status``)."""
        return f"{self.api_prefix}/{self._protocol_routes[key]['path']}"


rpc_route_contract = RpcRouteContract()


__all__ = ["RPC_ROUTE_CONTRACT_PATH", "RpcRouteContract", "rpc_route_contract"]
