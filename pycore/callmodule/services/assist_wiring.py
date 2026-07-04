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
  * image generator — pyctl.ai.generate_image (the unified AI gateway).

Both launcher paths call register_assist_worker_start() right where the
TranslationWorkerService is registered (callmodule_main.callmodule_main_entry
and event_handlers._register_heartbeat_workers), so the worker starts at
sys-init whenever the persisted ``assist_laravel.enabled`` toggle is on.
"""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyctl.ai import generate_image
from pycore.pyctl.assist import (
    AssistWorker,
    get_assist_worker,
    load_assist_settings,
)
from pycore.pyctl.desktop.task_manager import get_task_manager
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)


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
        input_data: Dict[str, Any] = {"title": title, "_worker": "assist", "capability": capability}
        if isinstance(detail, dict):
            input_data.update({k: v for k, v in detail.items() if k != "title"})
        task_id = manager.create_task(task_type=f"assist_{capability}", input_data=input_data)
        if ok:
            manager.complete_task(task_id, {"ok": True, **(detail or {})})
        else:
            manager.fail_task(task_id, error or "failed")
    except Exception as e:  # noqa: BLE001 — history is best-effort
        ColorPrint.yellow(f"[AssistWiring] assist task record failed: {e}")


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
        section = get_user_data_store().get_section("laravel_api") or {}
        current = (section.get("current") or "").strip().rstrip("/")
        label = "selected" if base == current else "resolved"
        return {"base_url": base, "label": label}
    except Exception as e:  # noqa: BLE001 — resolver must never kill a cycle
        ColorPrint.yellow(f"[AssistWiring] Endpoint resolution failed: {e}")
        return None


def ensure_assist_worker_wired() -> AssistWorker:
    """Return the AssistWorker singleton with app-layer collaborators injected
    (idempotent — configure() just re-sets the same callables)."""
    worker = get_assist_worker()
    worker.configure(
        endpoint_resolver=resolve_selected_endpoint,
        image_generator=generate_image,
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
            ColorPrint.blue(
                "[AssistWiring] Assist worker registered but disabled "
                "(enable via POST /api/local/assist/config)")
    except Exception as e:  # noqa: BLE001 — startup must not be torn down by this
        ColorPrint.red(f"[AssistWiring] Failed to register assist worker: {e}")
