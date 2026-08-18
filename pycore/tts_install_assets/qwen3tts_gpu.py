#!/usr/bin/env python3
"""GPU load snapshot and conservative Qwen3-TTS batch-size estimation."""
from __future__ import annotations

import os
import shutil
import subprocess
from typing import Any, Callable, Dict, List, Optional

BATCH_VRAM_MB: Dict[str, Dict[int, int]] = {
    "0.6B": {1: 4096, 4: 6144, 8: 9216, 16: 14336, 32: 24576},
    "1.7B": {1: 8192, 4: 12288, 8: 18432, 16: 28672, 32: 49152},
}
MAX_PARALLEL_CAP = 64
DEFAULT_RESERVE_RATIO = 0.12


def query_gpu_snapshot(device_index: int = 0) -> Dict[str, Any]:
    executable = _nvidia_smi_cmd()
    base = {
        "available": False,
        "util_percent": None,
        "mem_used_mb": 0,
        "mem_total_mb": 0,
    }
    if not executable:
        return base
    try:
        output = subprocess.run(
            [
                executable,
                "--query-gpu=index,name,utilization.gpu,memory.used,memory.total",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except Exception:  # noqa: BLE001
        return base
    if output.returncode != 0:
        return base
    rows: List[Dict[str, Any]] = []
    for line in (output.stdout or "").splitlines():
        parts = [part.strip() for part in line.strip().split(",") if part.strip()]
        if len(parts) < 5:
            continue
        rows.append({
            "index": _number(parts[0], int) or 0,
            "util_percent": _number(parts[2], float),
            "mem_used_mb": _number(parts[3], int) or 0,
            "mem_total_mb": _number(parts[4], int) or 0,
        })
    if not rows:
        return base
    selected = rows[device_index] if device_index < len(rows) else rows[0]
    selected["available"] = True
    return selected


def detect_model_variant(model_id: str) -> str:
    return "0.6B" if "0.6b" in (model_id or "").lower() else "1.7B"


def estimate_max_parallel(
    model_variant: str,
    gpu_total_mb: int,
    gpu_used_mb: int,
    gpu_util_percent: Optional[float] = None,
) -> int:
    curve = BATCH_VRAM_MB.get(model_variant) or BATCH_VRAM_MB["1.7B"]
    total_mb = max(int(gpu_total_mb or 0), 0)
    used_mb = max(int(gpu_used_mb or 0), 0)
    budget = int(total_mb * (1.0 - DEFAULT_RESERVE_RATIO)) if total_mb > 0 else 0
    max_by_vram = 1
    for batch_size, required_mb in sorted(curve.items()):
        if required_mb <= budget:
            max_by_vram = batch_size
    free_mb = max(0, total_mb - used_mb)
    max_by_free = 1
    base_mb = curve[1]
    if free_mb > 0 and 8 in curve:
        per_item = max(256, int((curve[8] - base_mb) / 7))
        extra = max(0, int((free_mb - max(0, base_mb - used_mb)) / per_item))
        max_by_free = max(1, 1 + extra)
    raw = max(1, min(max_by_vram, max_by_free, MAX_PARALLEL_CAP))
    adjusted = max(
        1,
        min(MAX_PARALLEL_CAP, int(raw * _load_factor(gpu_util_percent))),
    )
    env_cap = (os.environ.get("QWEN3TTS_MAX_PARALLEL") or "").strip()
    if env_cap.isdigit():
        adjusted = max(1, min(int(env_cap), MAX_PARALLEL_CAP))
    return adjusted


def _nvidia_smi_cmd() -> str:
    found = shutil.which("nvidia-smi")
    if found:
        return found
    candidates: List[str] = []
    if os.name == "nt":
        system_root = os.environ.get("SystemRoot") or r"C:\Windows"
        candidates.append(os.path.join(system_root, "System32", "nvidia-smi.exe"))
        for variable in ("ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"):
            program_files = os.environ.get(variable)
            if program_files:
                candidates.append(
                    os.path.join(program_files, "NVIDIA Corporation", "NVSMI", "nvidia-smi.exe")
                )
    else:
        candidates.extend(
            ["/usr/bin/nvidia-smi", "/usr/local/bin/nvidia-smi", "/bin/nvidia-smi"]
        )
    return next(
        (candidate for candidate in candidates if candidate and os.path.isfile(candidate)),
        "",
    )


def _number(token: str, cast: Callable) -> Any:
    try:
        return cast(token)
    except (TypeError, ValueError):
        return None


def _load_factor(gpu_util_percent: Optional[float]) -> float:
    if gpu_util_percent is None:
        return 1.0
    utilization = float(gpu_util_percent)
    if utilization >= 85.0:
        return 0.25
    if utilization >= 65.0:
        return 0.5
    if utilization >= 45.0:
        return 0.75
    return 1.0


__all__ = ["detect_model_variant", "estimate_max_parallel", "query_gpu_snapshot"]
