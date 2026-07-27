# -*- coding: utf-8 -*-
"""
Sentence-audio router — auto-start toggle + status + run-once + queue snapshot.

Endpoints (prefix /api/local/sentence-audio):
  GET  /status
  POST /config   { auto_start: bool }
  POST /run-once
  GET  /queue    — missing rows + worker events + bump hub
"""

import traceback
from typing import Any, Dict, List, Optional

from pycore.callmodule.services import get_tts_sentence_worker_service
from pycore.callmodule.services.sentence_audio_auto import apply_auto_start, get_status
from pycore.callmodule.services.sentence_queue_monitor_service import (
    get_sentence_queue_monitor_service,
)
from pycore.callmodule.services.queue_bump_hub import get_queue_bump_hub
# Stored-first Laravel endpoint resolution + lazy requests - same plumbing the
# sentence worker uses to claim/report against laravel_main.
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# Unified pycore->Laravel HTTP gateway (times + logs + records every call).
from pycore.callmodule.services.sync.laravel_client import get_laravel_client

# Larvel variant-specs CRUD surface (proxied so the pycore-manager UI edits
# laravel-owned data through pycore, matching the sentence-audio pattern).
VARIANT_SPECS_PATH = "/api/app_qy_v1/ai_tools/tts/variant-specs"
# Remote variant endpoints can be slow — give the proxy room (was 10s).
_VARIANT_TIMEOUT = 30








def status():
    return get_status()


def config(auto_start: bool, concurrency=None):
    return apply_auto_start(bool(auto_start), concurrency=concurrency)


def run_once():
    """Trigger one claim+synth cycle immediately (manual assist)."""
    try:
        get_tts_sentence_worker_service().poll_and_process()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def queue_snapshot():
    """Live sentence queue: Laravel missing rows, worker log, priority bumps.
    Rows matching an in-flight worker task are flagged ``processing`` so the FE
    can show a per-row spinner. Never raises - returns a graceful JSON on any
    error (no 500/loading-stuck)."""
    try:
        worker = get_tts_sentence_worker_service().get_status()
        monitor = get_sentence_queue_monitor_service().get_snapshot()
        bumps = get_queue_bump_hub().snapshot()
        processing_keys = set(worker.get("current_keys") or [])
        if processing_keys:
            for row in monitor.get("items") or []:
                key = f"{row.get('language')}:{row.get('content_id')}"
                row["processing"] = key in processing_keys
        return {
            "success": True,
            "worker": worker,
            "queue": monitor,
            "bumps": bumps,
        }
    except Exception as exc:  # noqa: BLE001 - never 500; print full traceback
        ColorPrint.red(f"[SentenceAudio] /queue failed: {exc}\n{traceback.format_exc()}")
        return {
            "success": False,
            "error": f"queue error: {exc}",
            "worker": None,
            "queue": {"items": [], "total": 0, "laravel_reachable": False},
            "bumps": {"events": [], "active_bumps": 0},
        }


# -------------------- variant-specs proxy (-> laravel) --------------------

def _laravel_base() -> str:
    return get_laravel_endpoint_manager().resolve()


def variants_index(lang: str = "en"):
    """GET /variants?lang=en -> laravel variant-specs list for one language."""
    base = _laravel_base()
    if not base:
        return {"success": False, "error": "laravel endpoint not configured", "specs": []}
    try:
        resp = get_laravel_client().get(
            VARIANT_SPECS_PATH, base_url=base, params={"lang": lang}, timeout=_VARIANT_TIMEOUT
        )
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc), "specs": []}
    if resp.status_code != 200:
        return {"success": False, "error": f"HTTP {resp.status_code}", "specs": []}
    try:
        return resp.json()
    except ValueError:
        return {"success": False, "error": "non-JSON response", "specs": []}


def variants_store(lang: str, specs):
    """POST /variants { lang, specs[] } -> replace a language's variant specs."""
    base = _laravel_base()
    if not base:
        return {"success": False, "error": "laravel endpoint not configured", "specs": []}
    try:
        resp = get_laravel_client().post(
            VARIANT_SPECS_PATH,
            base_url=base,
            json={"lang": lang, "specs": specs},
            timeout=_VARIANT_TIMEOUT,
        )
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc), "specs": []}
    if resp.status_code != 200:
        return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}", "specs": []}
    try:
        return resp.json()
    except ValueError:
        return {"success": False, "error": "non-JSON response", "specs": []}


def variants_destroy(lang: str, variant_key: str):
    """DELETE /variants?lang=&variant_key= -> remove one variant spec."""
    base = _laravel_base()
    if not base:
        return {"success": False, "error": "laravel endpoint not configured"}
    try:
        resp = get_laravel_client().delete(
            VARIANT_SPECS_PATH,
            base_url=base,
            params={"lang": lang, "variant_key": variant_key},
            timeout=_VARIANT_TIMEOUT,
        )
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc)}
    if resp.status_code != 200:
        return {"success": False, "error": f"HTTP {resp.status_code}"}
    try:
        return resp.json()
    except ValueError:
        return {"success": False, "error": "non-JSON response"}
