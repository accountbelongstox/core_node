# -*- coding: utf-8 -*-
"""Pyservice startup self-check for the batch-capable local TTS models.

Opt-in (env ``TTS_STARTUP_SELFCHECK=1`` or ``--tts-selfcheck``). Preferred
entry: the STANDALONE process ``pycore.pyctl.tts.batch_selfcheck_main``, which
pyservice.ps1 / pyservice.sh run to completion BEFORE launching the main
worker, so the sweep owns the console (no interleaved service logs) and the
machine's RAM/VRAM. The ``pycore_module_caller --tts-selfcheck`` gate remains
as a fallback for direct invocation and sweeps synchronously before services.

For each batch-capable engine in a fixed order the sweep (1) probes install
state, config gates and the memory/VRAM gate WITHOUT touching weights, (2)
actually synthesizes one small word batch through the engine's batch library
into the shared cache dir, (3) verifies the outputs, then (4) releases CPU/GPU
— in-process models (kokoro, parler) are unloaded explicitly; HTTP server
engines (chattts, gptsovits) are never started by this check, so a server that
was already running keeps its own managed idle-shutdown lifecycle. GPT-SoVITS
additionally needs a reference clip (official zero-shot flow: a ~5s vocal
sample plus its transcript); when none is configured, the sweep synthesizes a
reusable clip with kokoro and points GPTSOVITS_REF_AUDIO /
GPTSOVITS_PROMPT_TEXT at it, so a down api_v2 server surfaces its real skip
reason instead of the missing-ref one.

The report is persisted to ``<batch cache>/selfcheck/report.json`` and published
on the THREAD_BUS signal ``pyutils.tts.batch.selfcheck`` for RPC/UI consumers.

Standalone:
  python -m pycore.pyctl.tts.batch_selfcheck_main
"""

import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Sequence

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import call_serialized
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.tts import audio_utils
import pycore.pyutils.tts.gptsovits_engine as gptsovits_engine
import pycore.pyutils.tts.kokoro_engine as kokoro_engine
from pycore.pyutils.tts.batch import batch_constants as const
from pycore.pyutils.tts.batch import resource_monitor
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

# GPT-SoVITS zero-shot reference: official flow clones from a ~5s vocal sample
# plus its transcript. Auto-provisioned with kokoro when the user has not
# configured GPTSOVITS_REF_AUDIO but the local api_v2 server answers.
_GPTSOVITS_REF_SENTENCE = (
    "The morning sun rises over the quiet hills, and the birds begin their gentle songs."
)
_GPTSOVITS_REF_WAV_NAME = "gptsovits_ref.wav"


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


def _release_engine(name: str, loaded_snap: resource_monitor.ResourceSnapshot) -> Dict[str, Any]:
    """Free CPU/GPU held by an in-process model after its check run and log the
    before/after comparison with the actual decrease percentages.

    Server engines own a separate process with a managed idle shutdown; this
    check never starts one, so there is nothing of ours to stop here.
    """
    adapter = tts_engine_registry.get(name)
    if adapter is None:
        return {}
    try:
        if not adapter.is_model_loaded():
            return {}
        adapter.unload_model()
        after_snap = resource_monitor.snapshot()
        resource_monitor.log_model_released(name, loaded_snap, after_snap)
        return {
            "ram": resource_monitor.release_metrics(
                loaded_snap.free_ram_bytes, after_snap.free_ram_bytes, after_snap.total_ram_bytes
            ),
            "vram": resource_monitor.release_metrics(
                loaded_snap.free_vram_bytes, after_snap.free_vram_bytes, after_snap.total_vram_bytes
            ),
            "gpu_util_before_pct": loaded_snap.gpu_util_percent,
            "gpu_util_after_pct": after_snap.gpu_util_percent,
        }
    except Exception as exc:  # noqa: BLE001 - release must never break the sweep
        ColorPrint.yellow(f"[tts-selfcheck] {name}: unload failed ({exc})")
        return {}


def _provision_gptsovits_ref() -> None:
    """Auto-enable the gptsovits check when no reference clip is configured.

    No-op when GPTSOVITS_REF_AUDIO already points at a file. Otherwise
    synthesize a reusable ~5s reference clip with kokoro (official zero-shot
    flow: short vocal sample + transcript) and export the env vars the engine
    and the probe read. Runs BEFORE the sweep, so the kokoro model it warms up
    is reused by the kokoro engine check. With the ref blocker removed, a down
    api_v2 server surfaces its real skip reason ("server not running").
    """
    if gptsovits_engine._ref_audio() is not None:
        return
    ref_path = const.selfcheck_dir() / _GPTSOVITS_REF_WAV_NAME
    if not ref_path.exists():
        if not kokoro_engine.available():
            ColorPrint.yellow("[tts-selfcheck] gptsovits: kokoro unavailable; cannot build reference clip")
            return
        generated = call_serialized(
            kokoro_engine._MODEL_QUEUE,
            kokoro_batch._generate_merged_on_owner,
            _GPTSOVITS_REF_SENTENCE,
            1.0,
            timeout=300.0,
        )
        if generated is None:
            ColorPrint.yellow("[tts-selfcheck] gptsovits: reference clip synthesis failed")
            return
        samples, sample_rate = generated
        ref_path.parent.mkdir(parents=True, exist_ok=True)
        if not audio_utils.write_wav(samples, sample_rate, ref_path):
            ColorPrint.yellow("[tts-selfcheck] gptsovits: reference clip write failed")
            return
    os.environ["GPTSOVITS_REF_AUDIO"] = str(ref_path)
    os.environ.setdefault("GPTSOVITS_PROMPT_TEXT", _GPTSOVITS_REF_SENTENCE)
    os.environ.setdefault("GPTSOVITS_PROMPT_LANG", "en")
    ColorPrint.blue(f"[tts-selfcheck] gptsovits: auto reference clip -> {ref_path}")


def _check_engine(
    name: str,
    synthesize_words: _Synthesizer,
    words: Sequence[str],
    lang: str,
) -> Dict[str, Any]:
    began = time.time()
    entry: Dict[str, Any] = {"engine": name, "status": "skipped", "words_ok": 0}
    skip_reason = _probe_engine(name)
    if skip_reason:
        entry["reason"] = skip_reason
        ColorPrint.gray(f"[tts-selfcheck] {name}: skipped ({skip_reason})")
        return entry

    out_dir = const.selfcheck_dir() / name
    baseline_snap = resource_monitor.snapshot()
    try:
        result = synthesize_words(list(words), lang, out_dir)
        loaded_snap = resource_monitor.snapshot()
        resource_monitor.log_model_loaded(name, loaded_snap)
        entry["resources_loaded"] = resource_monitor.format_snapshot(loaded_snap)
        words_ok = sum(1 for item in result.items if item.ok)
        entry.update({
            "status": "ok" if words_ok == len(words) else "failed",
            "words_ok": words_ok,
            "words_total": len(words),
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
        loaded_snap = baseline_snap
    finally:
        released = _release_engine(name, loaded_snap)
        if released:
            entry["resources_released"] = released
    entry["elapsed_ms"] = int((time.time() - began) * 1000)
    return entry


def run_selfcheck(
    words: Optional[Sequence[str]] = None,
    lang: Optional[str] = None,
) -> Dict[str, Any]:
    """Sequentially probe + batch-synthesize + release every batch-capable engine."""
    if not _RUN_LOCK.acquire(blocking=False):
        ColorPrint.yellow("[tts-selfcheck] already running; ignoring duplicate request")
        return {"status": "busy"}
    began = time.time()
    check_words = [w.strip() for w in (words or const.SELFCHECK_WORDS) if w and w.strip()]
    check_lang = (lang or const.SELFCHECK_LANG).strip() or const.SELFCHECK_LANG
    try:
        ColorPrint.blue("[tts-selfcheck] starting batch-model self-check sweep")
        ColorPrint.blue(f"[tts-selfcheck] words ({check_lang}): {', '.join(check_words)}")
        ColorPrint.blue(f"[tts-selfcheck] batch cache dir: {const.batch_cache_dir()}")
        ColorPrint.blue(f"[tts-selfcheck] selfcheck dir:  {const.selfcheck_dir()}")
        for engine_name in const.SELFCHECK_ENGINE_ORDER:
            ColorPrint.gray(f"[tts-selfcheck] output dir[{engine_name}]: {const.selfcheck_dir() / engine_name}")
        _provision_gptsovits_ref()
        engines = [
            _check_engine(name, _BATCH_LIBRARIES[name], check_words, check_lang)
            for name in const.SELFCHECK_ENGINE_ORDER
        ]
        report: Dict[str, Any] = {
            "status": "done",
            "elapsed_ms": int((time.time() - began) * 1000),
            "words": check_words,
            "lang": check_lang,
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
