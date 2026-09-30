# -*- coding: utf-8 -*-
"""Register the AI hub controllers (catalog, test, history, boot) on HTTP API."""

from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_HUB_BOOT_RETRY,
    UI_AI_HUB_BOOT_STATUS,
    UI_AI_HUB_CATALOG,
    UI_AI_HUB_HISTORY,
    UI_AI_HUB_HISTORY_CLEAR,
    UI_AI_HUB_HISTORY_DELETE,
    UI_AI_HUB_TEST,
)
import pycore.pyctl.ai_hub.hub_service as hub_service


def register_ai_hub_routes(server) -> None:
    """Register thin AI hub controller adapters."""
    routes = (
        (UI_AI_HUB_CATALOG, hub_service.catalog, "AI hub catalog"),
        (UI_AI_HUB_TEST, hub_service.test, "AI hub model test"),
        (UI_AI_HUB_HISTORY, hub_service.history, "AI hub test history"),
        (UI_AI_HUB_HISTORY_DELETE, hub_service.history_delete, "Delete one hub test record"),
        (UI_AI_HUB_HISTORY_CLEAR, hub_service.history_clear, "Clear hub test records"),
        (UI_AI_HUB_BOOT_STATUS, hub_service.boot_status, "Model boot verdicts"),
        (UI_AI_HUB_BOOT_RETRY, hub_service.boot_retry, "Re-verify masked models"),
    )
    server.register_routes(routes, group="ai_hub")
