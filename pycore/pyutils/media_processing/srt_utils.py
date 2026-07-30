# -*- coding: utf-8 -*-
"""
SRT utilities - pure SRT parse and planning helpers.

No third-party deps, no ffmpeg, no import back into the processors package.
Imported by subtitle_engine (for transcribe_to_srt_faster's resume logic and
cut_segments' clip labels) and by the orchestrator (for _parse_srt_segments /
plan_segments / _count_srt_segments). _parse_srt_segments and _srt_time_to_sec
are re-exported through the video_extract_processor facade for
laravel_media_sync.py.
"""

import os
from typing import Any, Dict, List


def _srt_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return "%02d:%02d:%02d,%03d" % (h, m, s, ms)


def _srt_time_to_sec(text: str) -> float:
    """Parse an SRT 'HH:MM:SS,mmm' timestamp to seconds (0.0 on malformed input)."""
    parts = text.strip().replace(",", ".").split(":")
    if len(parts) != 3 or not (parts[0].isdigit() and parts[1].isdigit()):
        return 0.0
    try:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    except ValueError:
        return 0.0


def _parse_srt_resume(srt_path: str):
    """Return (last_index, last_end_seconds) from an existing .srt, or (0, 0.0)."""
    if not (srt_path and os.path.isfile(srt_path) and os.path.getsize(srt_path) > 0):
        return 0, 0.0
    last_idx, last_end = 0, 0.0
    with open(srt_path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if line.isdigit():
                last_idx = int(line)
            elif "-->" in line:
                halves = line.split("-->")
                if len(halves) == 2:
                    last_end = _srt_time_to_sec(halves[1])
    return last_idx, last_end


def _parse_srt_segments(srt_path: str) -> List[Dict[str, Any]]:
    """Parse a standard .srt into [{"idx", "start", "end", "text"}, ...].

    Blocks are 'index / HH:MM:SS,mmm --> HH:MM:SS,mmm / text... / blank'. Times
    are parsed with _srt_time_to_sec; multi-line text is joined with spaces.
    Returns [] if the file is missing/empty.
    """
    subs: List[Dict[str, Any]] = []
    if not (srt_path and os.path.isfile(srt_path) and os.path.getsize(srt_path) > 0):
        return subs
    cur_idx = 0
    cur_start = 0.0
    cur_end = 0.0
    text_lines: List[str] = []
    have_time = False

    def _flush():
        if have_time:
            subs.append({
                "idx": cur_idx if cur_idx > 0 else len(subs) + 1,
                "start": cur_start, "end": cur_end,
                "text": " ".join(text_lines).strip(),
            })

    with open(srt_path, "r", encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            line = raw.strip()
            if "-->" in line:
                halves = line.split("-->")
                if len(halves) == 2:
                    cur_start = _srt_time_to_sec(halves[0])
                    cur_end = _srt_time_to_sec(halves[1])
                    have_time = True
                    text_lines = []
            elif line == "":
                _flush()
                cur_idx, cur_start, cur_end, text_lines, have_time = 0, 0.0, 0.0, [], False
            elif line.isdigit() and not have_time and not text_lines:
                cur_idx = int(line)
            else:
                text_lines.append(line)
    _flush()  # last block if file didn't end with a blank line
    return subs


def parse_srt_segments(srt_path: str) -> List[Dict[str, Any]]:
    """Return parsed SRT cues through the shared public media API."""
    return _parse_srt_segments(srt_path)


def write_srt_segments(srt_path: str, segments: List[Dict[str, Any]]) -> str:
    """Write normalized SRT cues and return the absolute output path."""
    output_path = os.path.abspath(srt_path)
    blocks = []
    for position, segment in enumerate(segments, 1):
        cue_index = int(segment.get("idx") or position)
        start = _srt_timestamp(float(segment.get("start") or 0.0))
        end = _srt_timestamp(float(segment.get("end") or 0.0))
        text = str(segment.get("text") or "").strip()
        blocks.append(f"{cue_index}\n{start} --> {end}\n{text}")
    with open(output_path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n\n".join(blocks))
        handle.write("\n" if blocks else "")
    return output_path


def plan_segments(subs: List[Dict[str, Any]], max_sec: float = 300.0) -> List[Dict[str, Any]]:
    """Greedily pack subtitles into segments each spanning <= max_sec.

    Splits ONLY between subtitles (at the silence gap) so no subtitle is ever
    split across two segments. A single subtitle longer than max_sec gets its own
    segment. Returns [{"index", "start", "end", "subtitles": [...]}, ...].
    """
    segments: List[Dict[str, Any]] = []
    cur: List[Dict[str, Any]] = []
    cur_start = None
    for sub in subs:
        s = float(sub.get("start", 0.0))
        e = float(sub.get("end", 0.0))
        if not cur:
            cur = [sub]
            cur_start = s
            continue
        # Would adding this sub exceed max_sec from the current segment's start?
        if (e - cur_start) > max_sec:
            segments.append({"index": len(segments) + 1, "start": cur_start,
                             "end": float(cur[-1].get("end", cur_start)),
                             "subtitles": cur})
            cur = [sub]
            cur_start = s
        else:
            cur.append(sub)
    if cur:
        segments.append({"index": len(segments) + 1, "start": cur_start,
                         "end": float(cur[-1].get("end", cur_start)),
                         "subtitles": cur})
    return segments


def _clip_label(seconds: float) -> str:
    """'MM:SS' (or 'HH:MM:SS' past an hour) for compact clip logs."""
    total = int(round(seconds))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return "%02d:%02d:%02d" % (h, m, s)
    return "%02d:%02d" % (m, s)


def _count_srt_segments(srt_path: str) -> int:
    """Number of subtitle blocks in an SRT (count of '-->' arrow lines)."""
    if not (srt_path and os.path.isfile(srt_path)):
        return 0
    count = 0
    with open(srt_path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if "-->" in line:
                count += 1
    return count
