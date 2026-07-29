# -*- coding: utf-8 -*-
"""Apply the persisted Assist control plane to the canonical queue workers."""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.assist.assist_settings import load_assist_settings
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
from pycore.callmodule.services.assist_capability_sync import apply_assist_runtime

def resolve_selected_endpoint_for_ui(*, monitor_reachable: bool = False) -> Optional[Dict[str, Any]]:
    """Fast resolver for hot HTTP status paths — reuses monitor's active URL when up."""
    try:
        manager = get_laravel_endpoint_manager()
        stored = manager.peek_stored_base_url()
        if monitor_reachable:
            base = manager.get_active_base_url()
            label = "active" if base != stored else "selected"
        else:
            base = manager.resolve_for_ui(skip_probe=True)
            label = "stored" if base == stored else "active"
        if not base:
            return None
        return {"base_url": base, "label": label, "stored_url": stored}
    except Exception as e:  # noqa: BLE001 — resolver must never kill a cycle
        ColorPrint.yellow(f"[AssistWiring] UI endpoint resolution failed: {e}")
        return None


def register_assist_runtime() -> None:
    """Apply persisted capability intent after heartbeat registration."""
    try:
        settings = load_assist_settings()
        apply_assist_runtime(settings)
        ColorPrint.blue(
            f"[AssistWiring] Queue runtime applied "
            f"(enabled={settings['enabled']}, capabilities={settings['capabilities']})"
        )
    except Exception as e:  # noqa: BLE001 — startup must not be torn down by this
        ColorPrint.red(f"[AssistWiring] Failed to apply queue runtime: {e}")
