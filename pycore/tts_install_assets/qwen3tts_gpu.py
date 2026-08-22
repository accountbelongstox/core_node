#!/usr/bin/env python3
"""Central startup GPU capacity planning for the Qwen3-TTS service."""
from __future__ import annotations

import os
import shutil
import subprocess
import time
from typing import Any, Callable, Dict, List

MODEL_CAPACITY_PROFILES: Dict[str, Dict[str, int]] = {
    "0.6B": {
        "incremental_vram_mb": 768,
        "multiprocessors_per_item": 6,
        "max_batch_size": 16,
    },
    "1.7B": {
        "incremental_vram_mb": 1536,
        "multiprocessors_per_item": 12,
        "max_batch_size": 8,
    },
}
DEFAULT_RESERVE_RATIO = 0.08
DEFAULT_RESERVE_MIN_MB = 512
MAX_BATCH_SIZE = 64


def query_gpu_snapshot(device_index: int = 0) -> Dict[str, Any]:
    executable = _nvidia_smi_cmd()
    base = {
        "available": False,
        "index": max(0, int(device_index or 0)),
        "uuid": None,
        "name": None,
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
                "--query-gpu=index,uuid,name,utilization.gpu,memory.used,memory.total",
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
        parts = [part.strip() for part in line.strip().split(",")]
        if len(parts) < 6:
            continue
        rows.append({
            "index": _number(parts[0], int) or 0,
            "uuid": parts[1] or None,
            "name": parts[2] or None,
            "util_percent": _number(parts[3], float),
            "mem_used_mb": _number(parts[4], int) or 0,
            "mem_total_mb": _number(parts[5], int) or 0,
        })
    if not rows:
        return base
    selected = next(
        (row for row in rows if int(row["index"]) == int(device_index)),
        rows[0],
    )
    selected["available"] = True
    return selected


def detect_model_variant(model_id: str) -> str:
    return "0.6B" if "0.6b" in (model_id or "").lower() else "1.7B"


def build_capacity_plan(
    model_variant: str,
    device: str,
    gpu_snapshot: Dict[str, Any],
    cuda_properties: Dict[str, Any],
) -> Dict[str, Any]:
    """Calculate one immutable native-batch plan after the model is loaded."""
    variant = model_variant if model_variant in MODEL_CAPACITY_PROFILES else "1.7B"
    profile = MODEL_CAPACITY_PROFILES[variant]
    logical_device = str(device or "cpu")
    physical_index = int(gpu_snapshot.get("index") or 0)
    total_mb = max(
        int(gpu_snapshot.get("mem_total_mb") or 0),
        int(cuda_properties.get("mem_total_mb") or 0),
    )
    used_mb = int(gpu_snapshot.get("mem_used_mb") or 0)
    free_mb = int(cuda_properties.get("mem_free_mb") or 0)
    if used_mb <= 0 and total_mb > 0 and free_mb > 0:
        used_mb = max(0, total_mb - free_mb)
    if free_mb <= 0 and total_mb > 0:
        free_mb = max(0, total_mb - used_mb)
    reserve_mb = (
        max(DEFAULT_RESERVE_MIN_MB, round(total_mb * DEFAULT_RESERVE_RATIO))
        if total_mb > 0
        else 0
    )
    usable_mb = max(0, free_mb - reserve_mb)
    incremental_mb = int(profile["incremental_vram_mb"])
    memory_limit = max(1, 1 + usable_mb // incremental_mb)
    multiprocessors = int(cuda_properties.get("multiprocessor_count") or 0)
    multiprocessors_per_item = int(profile["multiprocessors_per_item"])
    compute_limit = (
        max(1, multiprocessors // multiprocessors_per_item)
        if multiprocessors > 0
        else 1
    )
    major = int(cuda_properties.get("major") or 0)
    minor = int(cuda_properties.get("minor") or 0)
    profile_limit = min(int(profile["max_batch_size"]), MAX_BATCH_SIZE)
    calculated = min(memory_limit, compute_limit, profile_limit)
    if not logical_device.startswith("cuda"):
        calculated = 1
    elif major and major < 8:
        calculated = min(calculated, 2)
    environment_cap = (os.environ.get("QWEN3TTS_MAX_PARALLEL") or "").strip()
    requested_cap = int(environment_cap) if environment_cap.isdigit() else None
    if requested_cap is not None:
        calculated = min(calculated, max(1, min(requested_cap, MAX_BATCH_SIZE)))
    return {
        "initialized": True,
        "source": "startup_gpu_capacity",
        "calculated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model_variant": variant,
        "logical_device": logical_device,
        "physical_gpu_index": physical_index,
        "gpu_uuid": gpu_snapshot.get("uuid"),
        "gpu_name": gpu_snapshot.get("name") or cuda_properties.get("name"),
        "compute_capability": f"{major}.{minor}" if major else None,
        "multiprocessor_count": multiprocessors,
        "memory_total_mb": total_mb,
        "memory_used_at_start_mb": used_mb,
        "memory_free_at_start_mb": free_mb,
        "memory_reserve_mb": reserve_mb,
        "estimated_incremental_vram_mb": incremental_mb,
        "memory_batch_limit": memory_limit,
        "compute_batch_limit": compute_limit,
        "profile_batch_limit": profile_limit,
        "environment_batch_cap": requested_cap,
        "batch_size": max(1, int(calculated)),
    }


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


__all__ = ["build_capacity_plan", "detect_model_variant", "query_gpu_snapshot"]
