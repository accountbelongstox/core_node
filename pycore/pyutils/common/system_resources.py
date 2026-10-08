# -*- coding: utf-8 -*-
"""CPU / memory / GPU snapshot of this host: the one sampler behind the UI
resource meters and the work-lease node load.

The snapshot is single-flight cached for a second, so several readers (the
meters, three lane claims) share one psutil / NVML sample. A host without an
NVIDIA GPU (a CPU notebook, a laptop) or without NVML reports no GPUs and never
fails the snapshot."""

import functools
import os
import platform
import time
from pathlib import Path
from typing import Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import IS_WINDOWS
from pycore.pyfoundations.third_party.api import get_third_package_psutil, get_third_package_pynvml
from pycore.pyutils.common.model_tiers import gpu_present
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_RESOURCES_TTL_SECONDS,
    STATUS_SNAPSHOT_SYSTEM_RESOURCES_KEY,
    status_snapshot_cache,
)

BYTES_PER_MB = 1024 * 1024
NVML_RETRY_SECONDS = 300.0
CPU_NAME_REGISTRY_KEY = r"HARDWARE\DESCRIPTION\System\CentralProcessor\0"
CPU_NAME_REGISTRY_VALUE = "ProcessorNameString"
CPU_INFO_PATH = Path("/proc/cpuinfo")
CPU_INFO_MODEL_FIELD = "model name"


class _NvmlGpuProbe:
    """Per-GPU utilization/memory through NVML, in process (no nvidia-smi
    child per sample). NVML is initialized once; a host without an NVIDIA
    driver reports no GPUs and is not probed again for NVML_RETRY_SECONDS."""

    def __init__(self) -> None:
        self._initialized = False
        self._retry_at = 0.0
        self._error_logged = ""

    def query(self) -> List[Dict[str, Any]]:
        if not gpu_present() or time.monotonic() < self._retry_at:
            return []
        pynvml = get_third_package_pynvml()
        if pynvml is None:
            self._retry_at = time.monotonic() + NVML_RETRY_SECONDS
            return []
        try:
            if not self._initialized:
                pynvml.nvmlInit()
                self._initialized = True
            gpus = []
            for index in range(pynvml.nvmlDeviceGetCount()):
                handle = pynvml.nvmlDeviceGetHandleByIndex(index)
                utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
                memory = pynvml.nvmlDeviceGetMemoryInfo(handle)
                name = pynvml.nvmlDeviceGetName(handle)
                gpus.append({
                    "index": index,
                    "name": name.decode("utf-8", "replace") if isinstance(name, bytes) else str(name),
                    "util_percent": float(utilization.gpu),
                    "mem_used_mb": int(memory.used // BYTES_PER_MB),
                    "mem_total_mb": int(memory.total // BYTES_PER_MB),
                })
        except pynvml.NVMLError as exc:
            self._initialized = False
            self._retry_at = time.monotonic() + NVML_RETRY_SECONDS
            if str(exc) != self._error_logged:
                self._error_logged = str(exc)
                ColorPrint.yellow(f"[SystemResources] NVML GPU query failed: {exc}")
            return []
        return gpus


@functools.lru_cache(maxsize=1)
def _cpu_name() -> str:
    """Marketing name of the CPU (registry on Windows, /proc/cpuinfo on Linux); read once."""
    try:
        if IS_WINDOWS:
            import winreg

            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, CPU_NAME_REGISTRY_KEY) as key:
                return str(winreg.QueryValueEx(key, CPU_NAME_REGISTRY_VALUE)[0]).strip()
        if CPU_INFO_PATH.is_file():
            for line in CPU_INFO_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
                field, _, value = line.partition(":")
                if field.strip() == CPU_INFO_MODEL_FIELD:
                    return value.strip()
    except OSError:
        pass
    return platform.processor() or platform.machine()


def _cpu_info(psutil) -> Dict[str, Any]:
    return {
        "name": _cpu_name(),
        "logical_cores": int(psutil.cpu_count(logical=True) or 0) if psutil is not None else int(os.cpu_count() or 0),
    }


def _battery_info(psutil):
    """Battery charge of this host, or None when it has no battery (desktops, servers)."""
    try:
        battery = psutil.sensors_battery() if psutil is not None else None
    except (AttributeError, OSError):
        return None
    if battery is None or battery.percent is None:
        return None
    return {"percent": float(battery.percent), "charging": bool(battery.power_plugged)}


class SystemResources:
    """CPU%, memory and GPUs of this host."""

    def __init__(self) -> None:
        self._nvml = _NvmlGpuProbe()

    def _collect(self) -> Dict[str, Any]:
        psutil = get_third_package_psutil()
        if psutil is None:
            return {
                "success": False, "error": "psutil unavailable",
                "cpu_percent": 0.0,
                "cpu": _cpu_info(None),
                "mem": {"used_mb": 0, "total_mb": 0, "percent": 0.0},
                "gpus": self._nvml.query(),
            }
        cpu_percent = float(psutil.cpu_percent(interval=None))
        memory = psutil.virtual_memory()
        return {
            "success": True,
            "cpu_percent": cpu_percent,
            "cpu": _cpu_info(psutil),
            "mem": {
                "used_mb": int(memory.used / BYTES_PER_MB),
                "total_mb": int(memory.total / BYTES_PER_MB),
                "percent": float(memory.percent),
            },
            "battery": _battery_info(psutil),
            "gpus": self._nvml.query(),
        }

    def snapshot(self, refresh: bool = False) -> Dict[str, Any]:
        """The cached host snapshot (one second); ``refresh`` samples again."""
        return status_snapshot_cache.get(
            STATUS_SNAPSHOT_SYSTEM_RESOURCES_KEY,
            self._collect,
            refresh=refresh,
            ttl_seconds=STATUS_SNAPSHOT_RESOURCES_TTL_SECONDS,
        )


system_resources = SystemResources()


__all__ = ["SystemResources", "system_resources"]
