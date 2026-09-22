# -*- coding: utf-8 -*-
"""Shared resource monitor for the TTS batch libraries and the self-check.

Every real run logs the same resource line at model load — free RAM, GPU
utilization, free VRAM — and at model release a before/after comparison with
the actual decrease percentage. Built on memory_gate's subprocess-safe probes
(nvidia-smi / psutil; never torch in this process).
"""

from dataclasses import dataclass
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
import pycore.pyutils.tts.memory_gate as memory_gate

_GB = memory_gate.BYTES_PER_GIB


@dataclass
class ResourceSnapshot:
    free_ram_bytes: Optional[int]
    total_ram_bytes: Optional[int]
    gpu_util_percent: Optional[int]
    free_vram_bytes: Optional[int]
    total_vram_bytes: Optional[int]


def snapshot() -> ResourceSnapshot:
    util, free_vram, total_vram = memory_gate.gpu_stats()
    return ResourceSnapshot(
        free_ram_bytes=memory_gate.free_ram_bytes(),
        total_ram_bytes=memory_gate.total_ram_bytes(),
        gpu_util_percent=util,
        free_vram_bytes=free_vram,
        total_vram_bytes=total_vram,
    )


def _fmt_gb(num_bytes: Optional[int]) -> str:
    return "n/a" if num_bytes is None else f"{num_bytes / _GB:.1f}GB"


def _fmt_pct(value: Optional[int]) -> str:
    return "n/a" if value is None else f"{value}%"


def format_snapshot(snap: ResourceSnapshot) -> str:
    return (
        f"free RAM {_fmt_gb(snap.free_ram_bytes)} | "
        f"GPU util {_fmt_pct(snap.gpu_util_percent)} | "
        f"free VRAM {_fmt_gb(snap.free_vram_bytes)}"
    )


def _release_line(
    label: str,
    before_free: Optional[int],
    after_free: Optional[int],
    total: Optional[int],
) -> str:
    """'free RAM 3.1GB -> 5.2GB (freed 2.1GB, used down 66%)' — percent is the
    actual decrease of the USED share; 'n/a' when readings are unavailable."""
    if before_free is None or after_free is None or not total:
        return f"{label} {_fmt_gb(before_free)} -> {_fmt_gb(after_free)}"
    freed = after_free - before_free
    used_before = total - before_free
    decrease_pct = (freed / used_before * 100.0) if used_before > 0 else 0.0
    return (
        f"{label} {_fmt_gb(before_free)} -> {_fmt_gb(after_free)} "
        f"(freed {_fmt_gb(freed)}, used down {decrease_pct:.0f}%)"
    )


def log_model_loaded(engine: str, snap: ResourceSnapshot) -> None:
    ColorPrint.blue(f"[tts.batch] {engine} model loaded | {format_snapshot(snap)}")


def log_model_released(
    engine: str,
    before: ResourceSnapshot,
    after: ResourceSnapshot,
) -> None:
    ram_line = _release_line(
        "free RAM", before.free_ram_bytes, after.free_ram_bytes, after.total_ram_bytes
    )
    vram_line = _release_line(
        "free VRAM", before.free_vram_bytes, after.free_vram_bytes, after.total_vram_bytes
    )
    util_line = (
        f"GPU util {_fmt_pct(before.gpu_util_percent)} -> {_fmt_pct(after.gpu_util_percent)}"
    )
    ColorPrint.blue(f"[tts.batch] {engine} released | {ram_line} | {util_line} | {vram_line}")


def log_run(engine: str, start: ResourceSnapshot, end: ResourceSnapshot) -> None:
    """Compact start->end line for batch CLI runs."""
    ColorPrint.gray(
        f"[tts.batch] {engine} resources | {format_snapshot(start)}  ->  {format_snapshot(end)}"
    )


def release_metrics(
    before_free: Optional[int],
    after_free: Optional[int],
    total: Optional[int],
) -> Dict[str, Any]:
    """Report-friendly before/after numbers: freed bytes and the actual
    decrease percent of the USED share (None when readings are unavailable)."""
    freed = None
    decrease_pct = None
    if before_free is not None and after_free is not None:
        freed = after_free - before_free
        if total:
            used_before = total - before_free
            if used_before > 0:
                decrease_pct = round(freed / used_before * 100.0, 1)
    return {
        "before_free_gb": None if before_free is None else round(before_free / _GB, 2),
        "after_free_gb": None if after_free is None else round(after_free / _GB, 2),
        "freed_gb": None if freed is None else round(freed / _GB, 2),
        "used_decrease_pct": decrease_pct,
    }


__all__ = [
    "ResourceSnapshot",
    "snapshot",
    "format_snapshot",
    "log_model_loaded",
    "log_model_released",
    "log_run",
    "release_metrics",
]
