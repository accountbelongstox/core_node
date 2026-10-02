# -*- coding: utf-8 -*-
"""Global TTS runtime profile — the startup-pinned configurator.

Computed ONCE at pyservice startup (pycore_module_caller starts the pin in a
background thread right after the --tts-selfcheck gate, while the RPC server
and tray bind immediately; every reader goes through the locked, idempotent
``pin_runtime_profile()`` and waits for it) and then FIXED in memory for the
process lifetime:

  * GPU present -> word single: edge (the orchestrator's cooldown/circuit
                   automatically degrades to kokoro while edge is down),
                   word batch : kokoro (CPU-side sherpa-onnx; never competes
                   with qwen3tts for the GPU),
                   sentence / long text: qwen3tts.
  * CPU only    -> every capability pinned to kokoro.
  * Notebook platform with contract notebook_defaults.tts_engines (Colab:
    kokoro, qwen3tts) -> every chain keeps only those engines.

Engines OUTSIDE the pinned set are never auto-scheduled or auto-started: the
pinned chains below replace the persisted/legacy engine orders for every
profile, so synthesis paths never lease another model. The only way a
non-pinned engine runs is an explicit UI test (/pycore-manager/ai ->
/api/local/tts/test or the server start button), and even that must pass the
RAM/VRAM scheduling gateway (pyutils.tts.memory_gate + the launch-time VRAM
floors in tts_service_manager) first.

With ``./pyservice.sh 1 --tts-selfcheck`` the standalone batch self-check
sweeps each local model first (load -> test -> release RAM/GPU) before the
background pin starts; without the flag the background pin starts right
after startup, in parallel with the RPC server and tray binding.

Config (environment):
  TTS_RUNTIME_PROFILE - "auto" (default: gpu when CUDA present, else cpu),
                        "gpu" / "cpu" force a plan, "off" restores the legacy
                        persisted engine chains.
"""

import os
from typing import Any, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.notebook_policy import notebook_platform
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.service_contract import value as service_contract_value
from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, call_serialized
from pycore.pyutils.common.queue_center_contract import QUEUE_CENTER_WORD_AUDIO_BATCH
from pycore.pyutils.common.model_tiers import gpu_present
from pycore.pyutils.tts.memory_gate import (
    BYTES_PER_GIB,
    free_ram_bytes,
    gpu_stats,
    reclaim_vram,
)

TTS_RUNTIME_PROFILE_ENV = "TTS_RUNTIME_PROFILE"

_TTS_RUNTIME_PLAN_KEY = "tts_runtime_plan"
_PLATFORM_TTS_ENGINES_KEY = "notebook_defaults.tts_engines"
WORD_BATCH_PROFILE = str(QUEUE_CENTER_WORD_AUDIO_BATCH["profile"])
WORD_BATCH_DEVICE = str(QUEUE_CENTER_WORD_AUDIO_BATCH["device"])
_GB = BYTES_PER_GIB

# Pinned engine chains per capability and mode: service_contract
# ``tts_runtime_plan`` (also read by notebook_runtime.sh, Laravel and the UI).
# The word chain is for explicit ad-hoc single-word requests; Queue Center and
# orchestration batch work always reads the "word_batch" chain, whose one
# engine is the word-batch engine in every mode.
def _plan(mode: str) -> Dict[str, Tuple[str, ...]]:
    chains = service_contract_value(f"{_TTS_RUNTIME_PLAN_KEY}.{mode}")
    return {capability: tuple(str(engine) for engine in engines) for capability, engines in chains.items()}


_GPU_PLAN: Dict[str, Tuple[str, ...]] = _plan("gpu")
_CPU_PLAN: Dict[str, Tuple[str, ...]] = _plan("cpu")
if _GPU_PLAN[WORD_BATCH_PROFILE] != _CPU_PLAN[WORD_BATCH_PROFILE] or len(_CPU_PLAN[WORD_BATCH_PROFILE]) != 1:
    raise ValueError("tts_runtime_plan word_batch must be one engine, equal in every mode")
WORD_BATCH_ENGINE = _CPU_PLAN[WORD_BATCH_PROFILE][0]

# Orchestrator profile names that map onto a pinned capability chain.
_PROFILE_ALIASES = {
    "default": "word",
    "word": "word",
    WORD_BATCH_PROFILE: WORD_BATCH_PROFILE,
    "sentence": "sentence",
    "agent_history": "sentence",
}



def _detect_mode() -> str:
    override = (os.environ.get(TTS_RUNTIME_PROFILE_ENV) or "").strip().lower()
    if override in ("gpu", "cpu", "off"):
        return override
    return "gpu" if gpu_present() else "cpu"


def _platform_engines() -> Optional[frozenset]:
    """Engines a notebook platform allows (contract notebook_defaults.tts_engines), else None."""
    platform = notebook_platform()
    engines = service_contract_value(_PLATFORM_TTS_ENGINES_KEY).get(platform) if platform else None
    return frozenset(str(engine) for engine in engines) if engines else None


def _restrict_plan(plan: Dict[str, Tuple[str, ...]], allowed: Optional[frozenset]) -> Dict[str, Tuple[str, ...]]:
    if allowed is None:
        return plan
    return {
        capability: tuple(engine for engine in chain if engine in allowed) or (WORD_BATCH_ENGINE,)
        for capability, chain in plan.items()
    }


def _fmt_gb(num_bytes: Optional[int]) -> str:
    return "unknown" if num_bytes is None else f"{num_bytes / _GB:.1f}GB"


def _compute_profile() -> Dict[str, Any]:
    mode = _detect_mode()
    enabled = mode != "off"
    if mode == "gpu":
        # Opt-in reclaim (QWEN3TTS_VRAM_RECLAIM=1) of pycore-started GPU
        # processes when free VRAM is below the recommended floor (6 GB),
        # before the snapshot below; other processes are never touched.
        reclaim_vram()
    plan = _restrict_plan(dict(_GPU_PLAN if mode == "gpu" else _CPU_PLAN), _platform_engines()) if enabled else {}
    scheduled = frozenset(engine for chain in plan.values() for engine in chain)
    gpu_util, free_vram, total_vram = gpu_stats()
    profile = {
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
        return profile
    ColorPrint.green(
        f"[tts-profile] pinned runtime profile: mode={mode} "
        f"(free VRAM {_fmt_gb(free_vram)} / {_fmt_gb(total_vram)}, "
        f"free RAM {_fmt_gb(profile['free_ram_bytes'])})"
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
    return profile


class TtsRuntimeProfile:
    """Owner of the pinned profile: computed once on its serialized worker,
    every concurrent reader waits for that one computation."""

    _QUEUE = "pyutils.tts.runtime_profile"

    def __init__(self) -> None:
        self._profile: Optional[Dict[str, Any]] = None
        self._worker = SerializedWorkerThread(self._QUEUE, "TtsRuntimeProfileThread")
        self._worker.start()

    def _pin_on_owner(self) -> Dict[str, Any]:
        if self._profile is None:
            self._profile = _compute_profile()
        return self._profile

    def pin(self) -> Dict[str, Any]:
        return call_serialized(self._QUEUE, self._pin_on_owner)


tts_runtime_profile = TtsRuntimeProfile()


def pin_runtime_profile() -> Dict[str, Any]:
    """Compute the profile once and fix it in memory (idempotent)."""
    return tts_runtime_profile.pin()


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


def engine_start_allowed(
    engine: str,
    load_gate: Callable[[], Tuple[bool, str]],
    explicit: bool = False,
) -> Tuple[bool, str]:
    """Scheduling-gateway decision for starting/loading one engine.

    The engine's RAM/VRAM load gate (``TTSEngine.load_gate``: memory_gate,
    passed while the model is already resident) decides first — an engine that does not
    fit is denied whoever asks. With the profile enabled, automatic scheduling
    is then restricted to the pinned set; an explicit UI test may run any
    engine the gateway admits. With the profile disabled every engine follows
    the gateway alone.
    """
    name = (engine or "").strip().lower()
    if not name:
        return False, "unknown TTS engine"
    allowed, reason = load_gate()
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
