# -*- coding: utf-8 -*-
"""
Sentence-audio router — auto-start toggle + status + run-once + queue snapshot.

Endpoints (prefix /api/local/sentence-audio):
  GET  /status
  POST /config   { auto_start: bool }
  POST /run-once
  GET  /queue    — missing rows + worker events + bump hub
"""

from typing import Any, Dict, List, Optional

import fastapi
from pydantic import BaseModel

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
from pycore.pyfoundations.third_party import get_third_package_requests

router = fastapi.APIRouter(prefix="/api/local/sentence-audio", tags=["Local Processing - Sentence Audio"])

# Larvel variant-specs CRUD surface (proxied so the pycore-manager UI edits
# laravel-owned data through pycore, matching the sentence-audio pattern).
VARIANT_SPECS_PATH = "/api/app_qy_v1/ai_tools/tts/variant-specs"
_VARIANT_TIMEOUT = 10


class SentenceAudioConfigRequest(BaseModel):
    auto_start: bool


class VariantSpecsReplaceRequest(BaseModel):
    lang: str
    specs: List[Dict[str, Any]]


@router.get("/status")
def status():
    return get_status()


@router.post("/config")
def config(req: SentenceAudioConfigRequest):
    return apply_auto_start(bool(req.auto_start))


@router.post("/run-once")
def run_once():
    """Trigger one claim+synth cycle immediately (manual assist)."""
    try:
        get_tts_sentence_worker_service().poll_and_process()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


@router.get("/queue")
def queue_snapshot():
    """Live sentence queue: Laravel missing rows, worker log, priority bumps.
    Never raises - returns a graceful JSON on any error (no 500/loading-stuck)."""
    try:
        worker = get_tts_sentence_worker_service().get_status()
        monitor = get_sentence_queue_monitor_service().get_snapshot()
        bumps = get_queue_bump_hub().snapshot()
        return {
            "success": True,
            "worker": worker,
            "queue": monitor,
            "bumps": bumps,
        }
    except Exception as exc:  # noqa: BLE001 - never 500; print full traceback
        import traceback
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


@router.get("/variants")
def variants_index(lang: str = "en"):
    """GET /variants?lang=en -> laravel variant-specs list for one language."""
    base = _laravel_base()
    if not base:
        return {"success": False, "error": "laravel endpoint not configured", "specs": []}
    requests = get_third_package_requests()
    try:
        resp = requests.get(
            base + VARIANT_SPECS_PATH, params={"lang": lang}, timeout=_VARIANT_TIMEOUT
        )
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc), "specs": []}
    if resp.status_code != 200:
        return {"success": False, "error": f"HTTP {resp.status_code}", "specs": []}
    try:
        return resp.json()
    except ValueError:
        return {"success": False, "error": "non-JSON response", "specs": []}


@router.post("/variants")
def variants_store(req: VariantSpecsReplaceRequest):
    """POST /variants { lang, specs[] } -> replace a language's variant specs."""
    base = _laravel_base()
    if not base:
        return {"success": False, "error": "laravel endpoint not configured", "specs": []}
    requests = get_third_package_requests()
    try:
        resp = requests.post(
            base + VARIANT_SPECS_PATH,
            json={"lang": req.lang, "specs": req.specs},
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


@router.delete("/variants")
def variants_destroy(lang: str, variant_key: str):
    """DELETE /variants?lang=&variant_key= -> remove one variant spec."""
    base = _laravel_base()
    if not base:
        return {"success": False, "error": "laravel endpoint not configured"}
    requests = get_third_package_requests()
    try:
        resp = requests.delete(
            base + VARIANT_SPECS_PATH,
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
