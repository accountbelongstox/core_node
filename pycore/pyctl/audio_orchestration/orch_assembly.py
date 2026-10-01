# -*- coding: utf-8 -*-
"""ffmpeg assembly of orchestration segments: the inter-clip gap, the clip
timeline and the re-encoding concat."""

import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.ffmpeg.ffmpeg_probe import ffprobe_client

from pycore.pyctl.audio_orchestration import orch_messages as msg

GAP_SECONDS = 0.6


def ensure_gap_file(ffmpeg: str, staging: Path) -> Optional[Path]:
    gap = staging / "gap.mp3"
    if gap.is_file() and gap.stat().st_size > 0:
        return gap
    cmd = [
        ffmpeg, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-t", f"{GAP_SECONDS}", "-b:a", "128k", str(gap),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=60)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] gap synth failed ({gap}): {exc}")
        return None
    return gap if proc.returncode == 0 and gap.is_file() else None


def segment_timeline(
    items: List[Dict[str, Any]],
    files: List[Path],
    gap: Optional[Path],
    durations: Dict[Path, float],
) -> List[Dict[str, Any]]:
    """Clip offsets inside the assembled segment mp3 (concat order: clip,
    gap, clip, ...). Durations are probed once per clip file per run; an
    unprobeable clip yields an empty timeline instead of drifting offsets."""
    for path in [*files, *([gap] if gap is not None else [])]:
        if path not in durations:
            durations[path] = float(ffprobe_client.probe(path).duration or 0.0)
    if any(durations[path] <= 0 for path in files):
        return []
    gap_seconds = durations[gap] if gap is not None else 0.0
    timeline: List[Dict[str, Any]] = []
    cursor = 0.0
    for index, (item, path) in enumerate(zip(items, files)):
        entry: Dict[str, Any] = {
            "type": str(item.get("kind") or ""),
            "start_ms": int(round(cursor * 1000)),
            "end_ms": int(round((cursor + durations[path]) * 1000)),
        }
        if item.get("seq") is not None:
            entry["seq"] = item["seq"]
        timeline.append(entry)
        cursor += durations[path] + (gap_seconds if index < len(files) - 1 else 0.0)
    return timeline


def concat_segment(ffmpeg: str, gap: Optional[Path], files: List[Path], output: Path) -> Optional[str]:
    """Concatenate item files into one mp3 (re-encoded, mono 44.1kHz). Returns
    an error code or None on success; the detail goes to the terminal log."""
    list_file = output.with_suffix(".concat.txt")
    lines: List[str] = []
    for index, path in enumerate(files):
        lines.append("file '" + path.as_posix().replace("'", "'\\''") + "'")
        if gap is not None and index < len(files) - 1:
            lines.append("file '" + gap.as_posix().replace("'", "'\\''") + "'")
    try:
        list_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except OSError as exc:
        ColorPrint.yellow(f"[AudioOrch] concat list write failed for {output.name}: {exc}")
        return msg.ORCH_CONCAT_LIST_WRITE_FAILED
    cmd = [
        ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
        "-ar", "44100", "-ac", "1", "-b:a", "128k", str(output),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=3600)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AudioOrch] ffmpeg launch failed for {output.name}: {exc}")
        return msg.ORCH_FFMPEG_LAUNCH_FAILED
    if proc.returncode != 0 or not output.is_file() or output.stat().st_size == 0:
        tail = (proc.stderr or b"").decode("utf-8", "replace")[-400:]
        ColorPrint.yellow(f"[AudioOrch] ffmpeg concat failed for {output.name}: {tail or proc.returncode}")
        return msg.ORCH_FFMPEG_CONCAT_FAILED
    return None


__all__ = [
    "GAP_SECONDS",
    "concat_segment",
    "ensure_gap_file",
    "segment_timeline",
]
