# -*- coding: utf-8 -*-
"""
Assist-Laravel app-layer wiring — composes the pyctl AssistWorker.

pyctl/* packages must not import each other and pyctl never imports callmodule,
so this APP-layer module injects the two collaborators the worker needs
(mirroring how config.py wires pyctl.ai into pyctl.desktop.ai_hooks):

  * endpoint resolver — the LaravelEndpointManager (stored-first multi-endpoint
    resolution over user_data.json's ``laravel_api`` section). The assist
    worker therefore always talks to the SAME selected laravel endpoint as
    media sync / the desktop manager.
  * image generator — DISABLED; cover AI delegated to apps/mcp-chrome.

Both launcher paths call register_assist_worker_start() right where the
TranslationWorkerService is registered (callmodule_main.callmodule_main_entry
and event_handlers._register_heartbeat_workers), so the worker starts at
sys-init whenever the persisted ``assist_laravel.enabled`` toggle is on.
"""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyctl.assist import (
    AssistWorker,
    get_assist_worker,
    load_assist_settings,
)
from pycore.pyctl.desktop.task_manager import get_task_manager
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
from pycore.callmodule.services.task_history_store import append_record
from pycore.callmodule.services.assist_capability_sync import apply_assist_runtime


def _record_assist_task(capability: str, title: str, ok: bool,
                        detail: Optional[Dict[str, Any]] = None,
                        error: Optional[str] = None) -> None:
    """App-layer history recorder injected into the AssistWorker.

    Writes one finished unit to the pyctl TaskManager tagged ``_worker='assist'``
    and ``task_type=assist_<capability>`` so the Queue Center's Recent tab and the
    assist strip's per-capability history (getRecentTasks worker='assist') show
    cover/tts/poster work. pyctl.assist cannot import pyctl.desktop (sibling rule),
    so the worker calls this injected callable instead."""
    try:
        manager = get_task_manager()
        input_data: Dict[str, Any] = {
            "title": title,
            "_worker": "assist",
            "capability": capability,
        }
        if isinstance(detail, dict):
            input_data.update({k: v for k, v in detail.items() if k != "title"})
        if error:
            input_data["assist_error"] = error
        task_id = manager.create_task(task_type=f"assist_{capability}", input_data=input_data)
        result_payload: Dict[str, Any] = {"ok": bool(ok)}
        if isinstance(detail, dict):
            result_payload.update(detail)
        if ok:
            manager.complete_task(task_id, result_payload)
        else:
            manager.fail_task(task_id, error or "failed")
        append_record({
            "task_type": f"assist_{capability}",
            "worker": "assist",
            "title": title,
            "content": title,
            "success": bool(ok),
            "error": error,
            "detail": result_payload,
        })
    except Exception as e:  # noqa: BLE001 — history is best-effort
        ColorPrint.yellow(f"[AssistWiring] assist task record failed: {e}")


def _endpoint_label(base: str) -> str:
    section = get_user_data_store().get_section("laravel_api") or {}
    current = (section.get("current") or "").strip().rstrip("/")
    return "selected" if base == current else "resolved"


def resolve_selected_endpoint() -> Optional[Dict[str, Any]]:
    """
    The currently-SELECTED laravel endpoint as {"base_url", "label"} or None.

    Delegates to LaravelEndpointManager.resolve() (stored-first probe, then a
    parallel sweep that persists the winner). ``label`` distinguishes the
    user's stored selection from a sweep-resolved fallback for the status UI.
    Never raises.
    """
    try:
        manager = get_laravel_endpoint_manager()
        base = manager.resolve()
        if not base:
            return None
        return {"base_url": base, "label": _endpoint_label(base)}
    except Exception as e:  # noqa: BLE001 — resolver must never kill a cycle
        ColorPrint.yellow(f"[AssistWiring] Endpoint resolution failed: {e}")
        return None


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


def ensure_assist_worker_wired() -> AssistWorker:
    """Return the AssistWorker singleton with app-layer collaborators injected
    (idempotent — configure() just re-sets the same callables)."""
    worker = get_assist_worker()
    worker.configure(
        endpoint_resolver=resolve_selected_endpoint,
        image_generator=None,
        task_recorder=_record_assist_task,
    )
    return worker


def register_assist_worker_start() -> None:
    """
    Sys-init hook: wire the worker and start its polling loop when the
    persisted ``assist_laravel.enabled`` setting is on (default: off, so a
    fresh deployment changes nothing until the user opts in). Idempotent and
    exception-safe — called from both launcher paths.
    """
    try:
        worker = ensure_assist_worker_wired()
        settings = load_assist_settings()
        if settings["enabled"]:
            worker.start()
            ColorPrint.green(
                f"[AssistWiring] Assist worker started "
                f"(capabilities={settings['capabilities']}, "
                f"poll={settings['poll_interval_s']}s, "
                f"batch={settings['batch_limit']})")
        else:
            worker.stop()
            ColorPrint.blue(
                "[AssistWiring] Assist worker registered but disabled "
                "(enable via POST /api/local/assist/config)")
        apply_assist_runtime(settings)
    except Exception as e:  # noqa: BLE001 — startup must not be torn down by this
        ColorPrint.red(f"[AssistWiring] Failed to register assist worker: {e}")
