# -*- coding: utf-8 -*-
"""Global TTS runtime profile — the startup-pinned configurator.

Computed ONCE at pyservice startup (pycore_module_caller pins it before any
service starts) and then FIXED in memory for the process lifetime:

  * GPU present -> word single: edge (the orchestrator's cooldown/circuit
                   automatically degrades to kokoro while edge is down),
                   word batch : kokoro (CPU-side sherpa-onnx; never competes
                   with qwen3tts for the GPU),
                   sentence / long text: qwen3tts.
  * CPU only    -> every capability pinned to kokoro.

Engines OUTSIDE the pinned set are never auto-scheduled or auto-started: the
pinned chains below replace the persisted/legacy engine orders for every
profile, so synthesis paths never lease another model. The only way a
non-pinned engine runs is an explicit UI test (/pycore-manager/ai ->
/api/local/tts/test or the server start button), and even that must pass the
RAM/VRAM scheduling gateway (pyutils.tts.memory_gate + the launch-time VRAM
floors in tts_service_manager) first.

With ``./pyservice.sh 1 --tts-selfcheck`` the standalone batch self-check
sweeps each local model first (load -> test -> release RAM/GPU), and the
worker pins THIS profile right after; without the flag the profile pins
directly at startup.

Config (environment):
  TTS_RUNTIME_PROFILE - "auto" (default: gpu when CUDA present, else cpu),
                        "gpu" / "cpu" force a plan, "off" restores the legacy
                        persisted engine chains.
"""

import os
import threading
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.model_tiers import gpu_present
from pycore.pyutils.tts.memory_gate import (
    BYTES_PER_GIB,
    free_ram_bytes,
    gpu_stats,
    memory_gate_allows,
    reclaim_vram,
)
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as QWEN3TTS_ENGINE

TTS_RUNTIME_PROFILE_ENV = "TTS_RUNTIME_PROFILE"

_EDGE_ENGINE = "edge"
WORD_BATCH_ENGINE = "kokoro"
WORD_BATCH_PROFILE = "word_batch"
WORD_BATCH_DEVICE = "cpu"
_GB = BYTES_PER_GIB

# Pinned engine chains per capability. The word chain is for explicit ad-hoc
# single-word requests. Queue Center and orchestration batch work always reads
# the static "word_batch" entry. GPU mode keeps kokoro (CPU) and qwen3tts (GPU)
# disjoint so the two pinned local models never fight over the card.
_GPU_PLAN: Dict[str, Tuple[str, ...]] = {
    "word": (_EDGE_ENGINE, WORD_BATCH_ENGINE),
    WORD_BATCH_PROFILE: (WORD_BATCH_ENGINE,),
    "sentence": (QWEN3TTS_ENGINE,),
}
_CPU_PLAN: Dict[str, Tuple[str, ...]] = {
    "word": (WORD_BATCH_ENGINE,),
    WORD_BATCH_PROFILE: (WORD_BATCH_ENGINE,),
    "sentence": (WORD_BATCH_ENGINE,),
}

# Orchestrator profile names that map onto a pinned capability chain.
_PROFILE_ALIASES = {
    "default": "word",
    "word": "word",
    WORD_BATCH_PROFILE: WORD_BATCH_PROFILE,
    "sentence": "sentence",
    "agent_history": "sentence",
}

_PIN_LOCK = threading.Lock()
_PROFILE: Optional[Dict[str, Any]] = None


def _detect_mode() -> str:
    override = (os.environ.get(TTS_RUNTIME_PROFILE_ENV) or "").strip().lower()
    if override in ("gpu", "cpu", "off"):
        return override
    return "gpu" if gpu_present() else "cpu"


def _fmt_gb(num_bytes: Optional[int]) -> str:
    return "unknown" if num_bytes is None else f"{num_bytes / _GB:.1f}GB"


def pin_runtime_profile() -> Dict[str, Any]:
    """Compute the profile once and fix it in memory (idempotent)."""
    global _PROFILE
    with _PIN_LOCK:
        if _PROFILE is not None:
            return _PROFILE
        mode = _detect_mode()
        enabled = mode != "off"
        if mode == "gpu":
            # Startup policy: qwen3tts is the only GPU consumer by design, so
            # foreign processes holding the card are stopped when free VRAM is
            # below the recommended floor (6 GB) — before the snapshot below.
            reclaim_vram()
        plan = dict((_GPU_PLAN if mode == "gpu" else _CPU_PLAN)) if enabled else {}
        scheduled = frozenset(engine for chain in plan.values() for engine in chain)
        gpu_util, free_vram, total_vram = gpu_stats()
        _PROFILE = {
            "enabled": enabled,
            "mode": mode,
            "plan": plan,
            "scheduled": scheduled,
            "gpu_util_percent": gpu_util,
            "free_vram_bytes": free_vram,
            "total_vram_bytes": total_vram,
            "free_ram_bytes": free_ram_bytes(),
        }
    if not enabled:
        ColorPrint.yellow(
            f"[tts-profile] {TTS_RUNTIME_PROFILE_ENV}=off: legacy persisted engine chains active"
        )
        return _PROFILE
    ColorPrint.green(
        f"[tts-profile] pinned runtime profile: mode={mode} "
        f"(free VRAM {_fmt_gb(free_vram)} / {_fmt_gb(total_vram)}, "
        f"free RAM {_fmt_gb(_PROFILE['free_ram_bytes'])})"
    )
    ColorPrint.blue(
        f"[tts-profile] word: {' -> '.join(plan['word'])} | "
        f"word batch: {' -> '.join(plan['word_batch'])} | "
        f"sentence/long text: {' -> '.join(plan['sentence'])}"
    )
    ColorPrint.blue(
        f"[tts-profile] auto-scheduled engines: {', '.join(sorted(scheduled))}; "
        "other engines run only via explicit UI test through the RAM/VRAM gateway"
    )
    return _PROFILE


def profile_snapshot() -> Dict[str, Any]:
    """Read-only snapshot of the pinned profile (pins lazily when needed)."""
    snap = pin_runtime_profile()
    return {
        "enabled": bool(snap["enabled"]),
        "mode": snap["mode"],
        "plan": {key: list(chain) for key, chain in snap["plan"].items()},
        "scheduled": sorted(snap["scheduled"]),
        "gpu_util_percent": snap["gpu_util_percent"],
        "free_vram_bytes": snap["free_vram_bytes"],
        "total_vram_bytes": snap["total_vram_bytes"],
        "free_ram_bytes": snap["free_ram_bytes"],
    }


def profile_enabled() -> bool:
    return bool(pin_runtime_profile()["enabled"])


def pinned_chain(profile: str = "default") -> Tuple[str, ...]:
    """Pinned engine chain for one orchestrator profile; () when unpinned."""
    snap = pin_runtime_profile()
    if not snap["enabled"]:
        return ()
    capability = _PROFILE_ALIASES.get((profile or "default").strip().lower(), "word")
    return tuple(snap["plan"].get(capability) or ())


def pinned_sentence_engine() -> Optional[str]:
    """The pinned sentence/long-text engine (qwen3tts on GPU, kokoro on CPU)."""
    chain = pinned_chain("sentence")
    return chain[0] if chain else None


def pinned_engines() -> frozenset:
    return frozenset(pin_runtime_profile()["scheduled"])


def engine_start_allowed(engine: str, explicit: bool = False) -> Tuple[bool, str]:
    """Scheduling-gateway decision for starting/loading one engine.

    The RAM/VRAM gateway (memory_gate) decides first — an engine that does not
    fit is denied whoever asks. With the profile enabled, automatic scheduling
    is then restricted to the pinned set; an explicit UI test may run any
    engine the gateway admits. With the profile disabled every engine follows
    the gateway alone (legacy behavior).
    """
    name = (engine or "").strip().lower()
    if not name:
        return False, "unknown TTS engine"
    allowed, reason = memory_gate_allows(name)
    if not allowed:
        return False, reason or "blocked by the RAM/VRAM scheduling gateway"
    snap = pin_runtime_profile()
    if not snap["enabled"] or explicit or name in snap["scheduled"]:
        return True, ""
    return False, (
        f"{name} is not pinned by the startup TTS profile; "
        "only an explicit UI test may start it"
    )


__all__ = [
    "TTS_RUNTIME_PROFILE_ENV",
    "WORD_BATCH_DEVICE",
    "WORD_BATCH_ENGINE",
    "WORD_BATCH_PROFILE",
    "pin_runtime_profile",
    "profile_snapshot",
    "profile_enabled",
    "pinned_chain",
    "pinned_sentence_engine",
    "pinned_engines",
    "engine_start_allowed",
]
