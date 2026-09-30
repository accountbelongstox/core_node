# -*- coding: utf-8 -*-
"""Register the model-live monitor routes (thin controller adapters)."""

from typing import Any, Dict

from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.ai_hub.live_service import model_live_service


def snapshot(_params: Dict[str, Any]) -> Dict[str, Any]:
    return {"success": True, "data": model_live_service.snapshot()}


def watch(params: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "success": True,
        "data": model_live_service.watch(
            bool(params.get("active", True)),
            params.get("ttl_s"),
        ),
    }


def register_model_live_routes(server) -> None:
    model_live_service.start()
    routes = (
        (route_names.UI_MODEL_LIVE_SNAPSHOT, snapshot),
        (route_names.UI_MODEL_LIVE_WATCH, watch),
    )
    server.register_routes(routes, group="model_live")
