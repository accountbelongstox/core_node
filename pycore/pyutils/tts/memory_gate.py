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
  QWEN3TTS_MIN_FREE_VRAM_MB        - launch floor for auto->cuda (default 1024)
  QWEN3TTS_RECOMMENDED_FREE_VRAM_MB - below this, foreign GPU processes are
                                      forcibly stopped at startup/launch
                                      (default 6144; qwen3tts is the only GPU
                                      consumer by design)
  QWEN3TTS_VRAM_RECLAIM - set to 0 to disable the forcible VRAM reclaim
"""

import os
import time
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
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


def _qwen3tts_requirement() -> Tuple[int, int]:
    # Minimum host memory floor: 1 GB. VRAM is deliberately 0 here — the card
    # decision belongs to the launch path (tts_service_manager), which first
    # RECLAIMS VRAM from foreign processes (qwen3tts is the only engine that
    # needs the GPU by design) and then applies the 1 GB minimum free-VRAM
    # floor with CPU fallback.
    return 1 * _GB, 0


# qwen3tts VRAM launch policy (MiB). The ONLY engine that uses the GPU by
# design, so when free VRAM is below the recommended floor the launcher and
# the startup profile forcibly stop OTHER GPU-holding processes (see
# reclaim_vram). After reclaim, a GPU with at least the minimum free VRAM
# takes the model; below it the server starts on CPU.
# Env overrides: QWEN3TTS_MIN_FREE_VRAM_MB / QWEN3TTS_RECOMMENDED_FREE_VRAM_MB /
# QWEN3TTS_VRAM_RECLAIM=0 (disable the forcible reclaim).
QWEN3TTS_MIN_FREE_VRAM_MB = 1024
QWEN3TTS_RECOMMENDED_FREE_VRAM_MB = 6144
QWEN3TTS_MIN_FREE_VRAM_MB_ENV = "QWEN3TTS_MIN_FREE_VRAM_MB"
QWEN3TTS_RECOMMENDED_FREE_VRAM_MB_ENV = "QWEN3TTS_RECOMMENDED_FREE_VRAM_MB"
QWEN3TTS_VRAM_RECLAIM_ENV = "QWEN3TTS_VRAM_RECLAIM"


# engine -> callable returning (free RAM bytes, free VRAM bytes) required to
# LOAD the engine's current model tier. Cloud engines are absent (they
# allocate nothing locally). Class-C HTTP servers carry a RAM floor only:
# their VRAM floors with CPU fallback are decided at launch in
# tts_service_manager, so the gateway never masks them on a busy card.
_REQUIREMENTS = {
    "parler": _parler_requirement,
    "bark": _bark_requirement,
    "kokoro": lambda: _sherpa_kokoro_requirement("kokoro"),
    "sherpa": lambda: _sherpa_kokoro_requirement("sherpa"),
    "qwen3tts": _qwen3tts_requirement,
    "chattts": lambda: (4 * _GB, 0),
    "cosyvoice": lambda: (6 * _GB, 0),
    "fishspeech": lambda: (6 * _GB, 0),
    "gptsovits": lambda: (6 * _GB, 0),
    "f5tts": lambda: (4 * _GB, 0),
    "voxcpm2": lambda: (8 * _GB, 0),
    "melotts": lambda: (2 * _GB, 0),
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


def free_vram_bytes(device_index: Optional[int] = None) -> Optional[int]:
    """Free VRAM bytes of one GPU. None -> the emptiest GPU (a model tier loads
    onto ONE device, so the best case is what matters); an explicit index reads
    exactly that GPU (launchers that pin CUDA_VISIBLE_DEVICES need their own
    target's free memory, not the fleet's best)."""
    rows = _gpu_query()
    if not rows:
        return None
    if device_index is None:
        return int(max(rows, key=lambda row: row[1])[1])
    index = int(device_index)
    if 0 <= index < len(rows):
        return int(rows[index][1])
    return None


def _fmt(num_bytes: int) -> str:
    return f"{num_bytes / _GB:.1f}GB"


def _env_mib(name: str, default: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    return int(raw) if raw.isdigit() else default


def vram_reclaim_enabled() -> bool:
    return (os.environ.get(QWEN3TTS_VRAM_RECLAIM_ENV) or "1").strip() != "0"


def _gpu_compute_apps(device_index: Optional[int]) -> Optional[List[Tuple[int, int]]]:
    """(pid, used VRAM bytes) per GPU compute app via an nvidia-smi SUBPROCESS
    (same no-torch rule as _gpu_query). None when unreadable."""
    try:
        smi = CUDADetector._nvidia_smi_cmd()
        cmd = [smi]
        if device_index is not None:
            cmd += ["-i", str(int(device_index))]
        cmd += [
            "--query-compute-apps=pid,used_memory",
            "--format=csv,noheader,nounits",
        ]
        result = exec_silent(cmd, info=False)
        if result.return_code != 0:
            return None
        rows: List[Tuple[int, int]] = []
        for line in (result.stdout or "").strip().splitlines():
            parts = [part.strip() for part in line.split(",")]
            if len(parts) == 2 and all(part.isdigit() for part in parts):
                rows.append((int(parts[0]), int(parts[1]) * _MB))
        return rows
    except Exception:  # noqa: BLE001
        return None


def reclaim_vram(device_index: Optional[int] = None) -> Dict[str, Any]:
    """Forcibly stop OTHER processes holding the GPU when free VRAM is below
    the recommended floor (default 6 GB).

    By design qwen3tts is the ONLY engine that needs the card, so foreign
    compute apps are terminated (graceful terminate, then kill after a short
    grace) and the freed VRAM is reported. This process is never touched, and
    a GPU already above the recommended floor is left alone.
    QWEN3TTS_VRAM_RECLAIM=0 disables the reclaim.
    """
    report: Dict[str, Any] = {
        "enabled": vram_reclaim_enabled(),
        "reclaimed": False,
        "killed": [],
        "free_mb_before": None,
        "free_mb_after": None,
    }
    if not report["enabled"]:
        return report
    recommended_mb = _env_mib(
        QWEN3TTS_RECOMMENDED_FREE_VRAM_MB_ENV,
        QWEN3TTS_RECOMMENDED_FREE_VRAM_MB,
    )
    free_before = free_vram_bytes(device_index)
    if free_before is None:
        return report
    report["free_mb_before"] = free_before // _MB
    if free_before >= recommended_mb * _MB:
        report["free_mb_after"] = report["free_mb_before"]
        return report
    apps = _gpu_compute_apps(device_index) or []
    own_pid = os.getpid()
    victims = [(pid, used) for pid, used in apps if pid and pid != own_pid]
    if not victims:
        report["free_mb_after"] = report["free_mb_before"]
        return report
    ColorPrint.yellow(
        f"[tts-gpu] free VRAM {free_before // _MB} MiB < recommended "
        f"{recommended_mb} MiB; stopping {len(victims)} foreign GPU process(es) "
        "(qwen3tts is the only GPU consumer by design)"
    )
    psutil = get_third_package_psutil()
    if psutil is None:
        report["free_mb_after"] = report["free_mb_before"]
        return report
    for pid, used in victims:
        try:
            proc = psutil.Process(pid)
            name = proc.name()
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except psutil.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
            report["killed"].append({"pid": pid, "name": name, "used_mb": used // _MB})
            ColorPrint.yellow(
                f"[tts-gpu] stopped GPU process pid={pid} ({name}), "
                f"holding ~{used // _MB} MiB VRAM"
            )
        except psutil.NoSuchProcess:
            continue
        except Exception as exc:  # noqa: BLE001 - reclaim is best-effort per pid
            ColorPrint.yellow(f"[tts-gpu] failed to stop GPU process pid={pid}: {exc}")
    # Give the driver a moment to release the memory, then re-measure.
    time.sleep(1.0)
    free_after = free_vram_bytes(device_index)
    report["free_mb_after"] = (
        free_after // _MB if free_after is not None else report["free_mb_before"]
    )
    report["reclaimed"] = bool(report["killed"])
    return report


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
    "reclaim_vram",
    "vram_reclaim_enabled",
    "QWEN3TTS_MIN_FREE_VRAM_MB",
    "QWEN3TTS_RECOMMENDED_FREE_VRAM_MB",
    "QWEN3TTS_MIN_FREE_VRAM_MB_ENV",
    "QWEN3TTS_RECOMMENDED_FREE_VRAM_MB_ENV",
    "QWEN3TTS_VRAM_RECLAIM_ENV",
]
