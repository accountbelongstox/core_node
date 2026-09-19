# -*- coding: utf-8 -*-
"""Pyservice startup self-check for the batch-capable local TTS models.

Opt-in (env ``TTS_STARTUP_SELFCHECK=1`` or ``--tts-selfcheck``). Runs AFTER all
service registration / model init scripts: for each batch-capable engine in a
fixed order it (1) probes install state, config gates and the memory/VRAM gate
WITHOUT touching weights, (2) actually synthesizes one small word batch through
the engine's batch library into the shared cache dir, (3) verifies the outputs,
then (4) releases CPU/GPU — in-process models (kokoro, parler) are unloaded
explicitly; HTTP server engines (chattts, gptsovits) are never started by this
check, so a server that was already running keeps its own managed idle-shutdown
lifecycle.

The report is persisted to ``<batch cache>/selfcheck/report.json`` and published
on the THREAD_BUS signal ``pyutils.tts.batch.selfcheck`` for RPC/UI consumers.

Standalone:
  python -m pycore.pyctl.tts.batch_startup_selfcheck
"""

import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.tts.batch import batch_constants as const
from pycore.pyutils.tts.batch.batch_common import BatchResult
from pycore.pyutils.tts.batch import chattts_batch
from pycore.pyutils.tts.batch import gptsovits_batch
from pycore.pyutils.tts.batch import kokoro_batch
from pycore.pyutils.tts.batch import parler_batch
from pycore.pyutils.tts.engine_registry import tts_engine_registry
from pycore.pyutils.tts.memory_gate import memory_gate_allows
from pycore.pyutils.tts.tts_engine_probe import engine_installed, engine_unavailable_reason

_Synthesizer = Callable[..., BatchResult]

_BATCH_LIBRARIES: Dict[str, _Synthesizer] = {
    "kokoro": kokoro_batch.synthesize_words,
    "parler": parler_batch.synthesize_words,
    "chattts": chattts_batch.synthesize_words,
    "gptsovits": gptsovits_batch.synthesize_words,
}

_RUN_LOCK = threading.Lock()
_SELF_CHECK_THREAD_NAME = "TtsBatchStartupSelfCheck"


def selfcheck_enabled() -> bool:
    return (os.environ.get(const.TTS_STARTUP_SELFCHECK_ENV) or "").strip().lower() in (
        "1", "true", "yes", "on",
    )


def _probe_engine(name: str) -> Optional[str]:
    """Return a skip reason, or None when the engine may load and synthesize."""
    if not engine_installed(name):
        return "not installed"
    reason = engine_unavailable_reason(name)
    if reason:
        return reason
    allowed, gate_reason = memory_gate_allows(name)
    if not allowed:
        return gate_reason or "memory gate blocked"
    return None


def _release_engine(name: str) -> None:
    """Free CPU/GPU held by an in-process model after its check run.

    Server engines own a separate process with a managed idle shutdown; this
    check never starts one, so there is nothing of ours to stop here.
    """
    adapter = tts_engine_registry.get(name)
    if adapter is None:
        return
    try:
        if adapter.is_model_loaded():
            adapter.unload_model()
            ColorPrint.blue(f"[tts-selfcheck] {name}: model unloaded (CPU/GPU released)")
    except Exception as exc:  # noqa: BLE001 - release must never break the sweep
        ColorPrint.yellow(f"[tts-selfcheck] {name}: unload failed ({exc})")


def _check_engine(name: str, synthesize_words: _Synthesizer) -> Dict[str, Any]:
    began = time.time()
    entry: Dict[str, Any] = {"engine": name, "status": "skipped", "words_ok": 0}
    skip_reason = _probe_engine(name)
    if skip_reason:
        entry["reason"] = skip_reason
        ColorPrint.gray(f"[tts-selfcheck] {name}: skipped ({skip_reason})")
        return entry

    out_dir = const.selfcheck_dir() / name
    try:
        result = synthesize_words(list(const.SELFCHECK_WORDS), const.SELFCHECK_LANG, out_dir)
        words_ok = sum(1 for item in result.items if item.ok)
        entry.update({
            "status": "ok" if words_ok == len(const.SELFCHECK_WORDS) else "failed",
            "words_ok": words_ok,
            "words_total": len(const.SELFCHECK_WORDS),
            "merged_used": result.merged_used,
            "fallback_used": result.fallback_used,
            "output_dir": str(out_dir),
        })
        if entry["status"] != "ok":
            errors = [item.error for item in result.items if item.error]
            entry["error"] = "; ".join(errors[:3]) or "batch synthesis incomplete"
    except Exception as exc:  # noqa: BLE001 - one engine must never break the sweep
        entry.update({"status": "failed", "error": str(exc)})
        ColorPrint.red(f"[tts-selfcheck] {name}: check failed ({exc})")
    finally:
        _release_engine(name)
    entry["elapsed_ms"] = int((time.time() - began) * 1000)
    return entry


def run_selfcheck() -> Dict[str, Any]:
    """Sequentially probe + batch-synthesize + release every batch-capable engine."""
    if not _RUN_LOCK.acquire(blocking=False):
        ColorPrint.yellow("[tts-selfcheck] already running; ignoring duplicate request")
        return {"status": "busy"}
    began = time.time()
    try:
        ColorPrint.blue("[tts-selfcheck] starting batch-model self-check sweep")
        engines = [
            _check_engine(name, _BATCH_LIBRARIES[name])
            for name in const.SELFCHECK_ENGINE_ORDER
        ]
        report: Dict[str, Any] = {
            "status": "done",
            "elapsed_ms": int((time.time() - began) * 1000),
            "words": list(const.SELFCHECK_WORDS),
            "lang": const.SELFCHECK_LANG,
            "engines": engines,
        }
        try:
            const.selfcheck_dir().mkdir(parents=True, exist_ok=True)
            report_path = const.selfcheck_dir() / const.SELFCHECK_REPORT_NAME
            report_path.write_text(
                json.dumps(report, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            report["report_path"] = str(report_path)
        except OSError as exc:
            ColorPrint.yellow(f"[tts-selfcheck] report write failed: {exc}")
        THREAD_BUS.signal(const.SELFCHECK_BUS_SIGNAL, report)
        ok_count = sum(1 for engine in engines if engine.get("status") == "ok")
        ColorPrint.green(
            f"[tts-selfcheck] sweep done: {ok_count}/{len(engines)} engines ok "
            f"in {report['elapsed_ms']}ms"
        )
        return report
    finally:
        _RUN_LOCK.release()


def _selfcheck_main() -> None:
    try:
        run_selfcheck()
    except Exception as exc:  # noqa: BLE001 - self-check must never crash startup
        ColorPrint.red(f"[tts-selfcheck] sweep aborted: {exc}")


def start_selfcheck_thread() -> Optional[threading.Thread]:
    """Spawn the daemon self-check thread after startup; None when disabled."""
    if not selfcheck_enabled():
        return None
    thread = threading.Thread(
        target=_selfcheck_main,
        name=_SELF_CHECK_THREAD_NAME,
        daemon=True,
    )
    thread.start()
    ColorPrint.blue("[tts-selfcheck] startup self-check thread started")
    return thread


if __name__ == "__main__":
    print(json.dumps(run_selfcheck(), ensure_ascii=False, indent=2))


__all__ = ["selfcheck_enabled", "run_selfcheck", "start_selfcheck_thread"]
