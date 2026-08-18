# -*- coding: utf-8 -*-
"""
FFmpeg operations - ffmpeg/ffprobe wrappers + per-codec encoders for the Video
Extract feature.

Holds the shared codec/extension constants (VIDEO_EXTENSIONS, CODECS,
_OPUS_RATES) and the byte/size helpers (_mb, _file_size) used across the
feature. resolve_ffmpeg keeps its Windows scoop/ProgramFiles fallbacks (it is
richer than pyutils.whisper_stt.audio_utils.get_ffmpeg_path, which lacks them)
- do NOT swap to get_ffmpeg_path.

Pure business logic: no HTTP/FastAPI, no import back into the processors
package.
"""

import os
import re
import shutil
import subprocess
from typing import List, Optional


# --------------------------------------------------------------------------- #
# Constants (ported)                                                           #
# --------------------------------------------------------------------------- #
VIDEO_EXTENSIONS = {
    ".mp4", ".m4v", ".mkv", ".mov", ".avi", ".wmv", ".flv", ".webm",
    ".mpg", ".mpeg", ".mts", ".m2ts", ".ts", ".3gp", ".3g2", ".ogv",
    ".vob", ".rm", ".rmvb", ".asf", ".f4v", ".divx",
}

CODECS = {
    "opus":   {"encoder": "libopus",    "ext": ".opus", "default_bitrate": "24k"},
    "aac":    {"encoder": "aac",         "ext": ".m4a",  "default_bitrate": "32k"},
    "vorbis": {"encoder": "libvorbis",   "ext": ".ogg",  "default_bitrate": "48k"},
    "mp3":    {"encoder": "libmp3lame",  "ext": ".mp3",  "default_bitrate": "32k"},
}

_OPUS_RATES = (8000, 12000, 16000, 24000, 48000)


def _mb(num_bytes: int) -> float:
    """Bytes -> MiB."""
    return num_bytes / (1024.0 * 1024.0)


def _file_size(path: str) -> int:
    """Size in bytes, or 0 if the file is missing/unreadable."""
    if path and os.path.isfile(path):
        return os.path.getsize(path)
    return 0


# --------------------------------------------------------------------------- #
# ffmpeg helpers                                                               #
# --------------------------------------------------------------------------- #
def resolve_ffmpeg(explicit: str = "") -> Optional[str]:
    if explicit and os.path.isfile(explicit):
        return explicit
    found = shutil.which("ffmpeg")
    if found:
        return found
    # A few common Windows install locations (mirrors extract_audio.ps1).
    for p in (
        r"D:\applications\FFmpeg\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe",
        os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"), "ffmpeg", "bin", "ffmpeg.exe"),
        os.path.join(os.path.expanduser("~"), "scoop", "shims", "ffmpeg.exe"),
    ):
        if os.path.isfile(p):
            return p
    return None


def resolve_ffprobe(ffmpeg: Optional[str]) -> Optional[str]:
    if ffmpeg:
        exe = "ffprobe.exe" if os.name == "nt" else "ffprobe"
        cand = os.path.join(os.path.dirname(ffmpeg), exe)
        if os.path.isfile(cand):
            return cand
    return shutil.which("ffprobe")


def has_audio_stream(ffprobe: Optional[str], src: str):
    if not ffprobe:
        return None
    try:
        out = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "a",
             "-show_entries", "stream=index", "-of", "csv=p=0", src],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        return bool((out.stdout or "").strip())
    except Exception:
        return None


def _stderr_tail(text: Optional[str], lines: int = 6, max_chars: int = 600) -> str:
    """Last few non-empty lines of ffmpeg stderr, trimmed for a one-shot log."""
    if not text:
        return ""
    kept = [ln.strip() for ln in text.splitlines() if ln.strip()]
    tail = " | ".join(kept[-lines:])
    if len(tail) > max_chars:
        tail = "..." + tail[-max_chars:]
    return tail


def _run_ffmpeg(cmd: List[str], dst: str, on_error=None) -> bool:
    """Run ffmpeg, capturing output (no live console). Returns True on success.

    On failure (non-zero exit or empty/missing output) calls ``on_error(tail)``
    with the tail of ffmpeg's stderr (if provided) so callers can surface the
    real cause instead of failing silently - even though we keep ``-loglevel
    error`` so stderr stays short.
    """
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              encoding="utf-8", errors="replace")
    except Exception as exc:
        if on_error:
            on_error(f"ffmpeg launch failed: {exc}")
        return False
    if proc.returncode != 0:
        if os.path.isfile(dst) and os.path.getsize(dst) == 0:
            try:
                os.remove(dst)
            except OSError:
                pass
        if on_error:
            on_error(_stderr_tail(proc.stderr) or f"exit {proc.returncode} (no stderr)")
        return False
    ok = os.path.isfile(dst) and os.path.getsize(dst) > 0
    if not ok and on_error:
        on_error(_stderr_tail(proc.stderr) or "output produced no data")
    return ok


def extract_audio(ffmpeg, src, dst, encoder, bitrate, sample_rate, mono) -> bool:
    ar = sample_rate
    if encoder == "libopus":
        ar = min(_OPUS_RATES, key=lambda r: abs(r - sample_rate))
    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "warning", "-y",
        "-i", src, "-vn", "-map", "a:0?",
        "-ac", "1" if mono else "2", "-ar", str(ar),
        "-c:a", encoder, "-b:a", bitrate, dst,
    ]
    return _run_ffmpeg(cmd, dst)


def is_already_tiny_mp4(ffprobe, path, src) -> bool:
    if ffprobe:
        try:
            out = subprocess.run(
                [ffprobe, "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
                capture_output=True, text=True, encoding="utf-8", errors="replace",
            )
            dims = [p for p in re.split(r"[,\sxX]+", (out.stdout or "").strip()) if p.isdigit()]
            if len(dims) >= 2:
                return int(dims[0]) <= 4 and int(dims[1]) <= 4
        except Exception:
            pass
    try:
        return os.path.getsize(path) < max(64 * 1024, os.path.getsize(src) * 0.5)
    except OSError:
        return False


def make_tiny_mp4(ffmpeg, src, dst, bitrate, sample_rate, mono) -> bool:
    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "warning", "-y",
        "-i", src,
        "-f", "lavfi", "-i", "color=c=black:s=2x2:r=1",
        "-map", "1:v:0", "-map", "0:a:0",
        "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage",
        "-crf", "51", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", bitrate,
        "-ac", "1" if mono else "2", "-ar", str(sample_rate),
        "-shortest", "-movflags", "+faststart", dst,
    ]
    return _run_ffmpeg(cmd, dst)


def compress_full_video(ffmpeg, ffprobe, src, dst, log=None) -> bool:
    """Produce a compressed, watchable FULL-resolution video at ``dst``.

    Downscales to at most 720p height KEEPING aspect ratio, and ONLY when the
    source is taller than 720p (never upscales - the scale expression caps height
    at min(720, ih)). Re-encodes H.264 (CRF 28, veryfast) + AAC 96k with
    +faststart so it plays/streams immediately.

    Idempotent: if ``dst`` already exists with size>0, it is left untouched and
    True is returned. Returns True on success (dst exists with size>0), else False.
    """
    def _emit(m):
        if log:
            log(m)

    if os.path.isfile(dst) and os.path.getsize(dst) > 0:
        sz = _file_size(dst)
        src_sz = _file_size(src)
        pct = ("%.0f%%" % (sz / src_sz * 100)) if src_sz else "-"
        _emit(f"    full: skip (exists, {_mb(sz):.2f} MB, {pct} of original)")
        return True

    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "warning", "-y",
        "-i", src,
        "-vf", "scale='-2:min(720,ih)'",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k",
        "-movflags", "+faststart", dst,
    ]
    ok = _run_ffmpeg(cmd, dst)
    if ok:
        sz = _file_size(dst)
        src_sz = _file_size(src)
        pct = ("%.0f%%" % (sz / src_sz * 100)) if src_sz else "-"
        _emit(f"    full: created ({_mb(sz):.2f} MB, {pct} of original)")
    else:
        _emit("    full: FAILED")
    return ok
