# -*- coding: utf-8 -*-
"""Runtime memory gate for local TTS model engines.

Masks a local model engine before its weights are touched when the host does
not have enough free memory to load them. A naive fp32 parler-tts-large load
peaks at ~2x its 9.33 GB checkpoint and gets OOM-killed mid-shard
(huggingface/transformers#26283); selection-time gating keeps word/sentence
synthesis on engines that actually fit instead of dying inside
``from_pretrained``.

Config:
  TTS_MEMORY_GATE   - set to 0 to disable the gate (default: on)
"""

import os
from typing import List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.commander import exec_silent
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.third_party.api import (
    get_third_package_psutil,
)
from pycore.pyutils.common.model_tiers import gpu_present, runtime_engine_model

_GB = 1024 ** 3
_MB = 1024 ** 2


def _parler_requirement() -> Tuple[int, int]:
    explicit = (os.environ.get("PARLER_MODEL") or "").strip().lower()
    tier = str(runtime_engine_model("parler") or "").lower()
    if "mini" in (explicit or tier):
        return 4 * _GB, 0
    device = (os.environ.get("PARLER_DEVICE") or "auto").strip().lower()
    if device.startswith("cpu") or (device == "auto" and not gpu_present()):
        # fp32 flan-t5-xl + dac + decoder, low_cpu_mem_usage streaming.
        return 12 * _GB, 0
    # bf16 device_map load: weights stream to VRAM, but each fp32 shard
    # (~4.7 GB for the flan-t5-xl shard) still stages fully in RAM.
    return 6 * _GB, 5 * _GB


def _bark_requirement() -> Tuple[int, int]:
    explicit = (os.environ.get("BARK_MODEL") or "").strip().lower()
    tier = str(runtime_engine_model("bark") or "").lower()
    if "small" in (explicit or tier):
        return 3 * _GB, 0
    device = (os.environ.get("BARK_DEVICE") or "auto").strip().lower()
    if device.startswith("cpu") or (device == "auto" and not gpu_present()):
        return 6 * _GB, 0
    return 3 * _GB, 4 * _GB


def _sherpa_kokoro_requirement(engine: str) -> Tuple[int, int]:
    tier = str(runtime_engine_model(engine) or "").lower()
    if "int8" in tier:
        return 512 * _MB, 0
    return 1 * _GB, 0


# engine -> callable returning (free RAM bytes, free VRAM bytes) required to
# LOAD the engine's current model tier. Engines absent here are never gated
# (cloud engines and remote HTTP APIs allocate nothing locally).
_REQUIREMENTS = {
    "parler": _parler_requirement,
    "bark": _bark_requirement,
    "kokoro": lambda: _sherpa_kokoro_requirement("kokoro"),
    "sherpa": lambda: _sherpa_kokoro_requirement("sherpa"),
}


def gate_enabled() -> bool:
    return (os.environ.get("TTS_MEMORY_GATE") or "1").strip() != "0"


def free_ram_bytes() -> Optional[int]:
    try:
        psutil = get_third_package_psutil()
        if psutil is None:
            return None
        return int(psutil.virtual_memory().available)
    except Exception:  # noqa: BLE001
        return None


def total_ram_bytes() -> Optional[int]:
    try:
        psutil = get_third_package_psutil()
        if psutil is None:
            return None
        return int(psutil.virtual_memory().total)
    except Exception:  # noqa: BLE001
        return None


def _gpu_query() -> Optional[List[Tuple[int, int, int]]]:
    """(utilization %, free VRAM bytes, total VRAM bytes) per GPU via an
    nvidia-smi SUBPROCESS. Never torch here: torch.cuda.mem_get_info()
    initializes the CUDA driver in THIS process, so a faulting nvcuda64.dll
    kills the whole service with no traceback."""
    try:
        smi = CUDADetector._nvidia_smi_cmd()
        result = exec_silent(
            [smi, "--query-gpu=utilization.gpu,memory.free,memory.total",
             "--format=csv,noheader,nounits"],
            info=False,
        )
        if result.return_code != 0:
            return None
        rows: List[Tuple[int, int, int]] = []
        for line in (result.stdout or "").strip().splitlines():
            parts = [part.strip() for part in line.split(",")]
            if len(parts) == 3 and all(part.isdigit() for part in parts):
                util, free_mib, total_mib = (int(part) for part in parts)
                rows.append((util, free_mib * _MB, total_mib * _MB))
        return rows or None
    except Exception:  # noqa: BLE001
        return None


def gpu_stats() -> Tuple[Optional[int], Optional[int], Optional[int]]:
    """(max GPU utilization %, max free VRAM bytes, total VRAM bytes of the
    emptiest GPU). A model tier loads onto ONE device, so the best case is what
    matters; every element is None when no GPU/driver reading is available."""
    rows = _gpu_query()
    if not rows:
        return None, None, None
    emptiest = max(rows, key=lambda row: row[1])
    max_util = max(row[0] for row in rows)
    return max_util, int(emptiest[1]), int(emptiest[2])


def free_vram_bytes() -> Optional[int]:
    return gpu_stats()[1]


def _fmt(num_bytes: int) -> str:
    return f"{num_bytes / _GB:.1f}GB"


def memory_gate_allows(engine: str) -> Tuple[bool, str]:
    """(allowed, reason); reason is empty when allowed or the engine is ungated.

    Unknown memory readings (no psutil / no CUDA) never mask an engine."""
    name = (engine or "").strip().lower()
    resolver = _REQUIREMENTS.get(name)
    if resolver is None or not gate_enabled():
        return True, ""
    try:
        need_ram, need_vram = resolver()
    except Exception:  # noqa: BLE001
        return True, ""
    free_ram = free_ram_bytes()
    if need_ram and free_ram is not None and free_ram < need_ram:
        return False, (
            f"insufficient free RAM to load {name} "
            f"(need ~{_fmt(need_ram)}, free {_fmt(free_ram)})"
        )
    if need_vram:
        free_vram = free_vram_bytes()
        if free_vram is not None and free_vram < need_vram:
            return False, (
                f"insufficient free VRAM to load {name} "
                f"(need ~{_fmt(need_vram)}, free {_fmt(free_vram)})"
            )
    return True, ""


__all__ = [
    "gate_enabled",
    "memory_gate_allows",
    "free_ram_bytes",
    "total_ram_bytes",
    "gpu_stats",
    "free_vram_bytes",
]
