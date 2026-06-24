# -*- coding: utf-8 -*-
"""
Video Extract Processor - core logic for the "Video Extraction" feature.

This is a pycore port of scripts/video_tools/py_video_tools/video_audio_extractor.py.
It recursively scans a FOLDER (or processes a single FILE) of videos and, per video:
  1. (optional) creates a tiny AI-acceptable MP4 (2x2 H.264 + real audio),
  2. extracts the audio in one or more codecs (opus/aac/vorbis/mp3),
  3. (optional) generates an .srt subtitle via whisper speech-to-text,
sanitizing file/dir names to ASCII English and mirroring the directory tree under
an output folder. It is idempotent (already-produced outputs are skipped).

Architecture notes (pycore):
  * Pure business logic - no HTTP/FastAPI dependency. The controller/router and
    the async task_manager drive it.
  * Long-running: the public run() accepts a `progress_cb(percent, snapshot)` and
    a cooperative `should_stop()` so the task layer can report progress and cancel.
  * STT engine: **faster-whisper is the default**. The openai-whisper path (via
    pycore's WhisperSTTProvider) is intentionally preserved but COMMENTED OUT
    below; flip the engine handling there to re-enable it.
"""

import hashlib
import json
import os
import re
import shutil
import subprocess
import threading
import time
import unicodedata
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore import ColorPrint
# Movie/TV poster fetch (TMDB -> OMDB). Best-effort per video: parse title+year
# from the original filename, fetch a poster, save it into the output dir.
# Canonical: poly_apps/laravel_main/docs/MOVIE_POSTER_PIPELINE.md. This module only imports
# pyfoundations + the translator (no cycle back into this processor).
from pycore.pyutils.external_apis.movie_poster_client import (
    find_poster,
    parse_title_year,
    save_poster_file,
)


# --------------------------------------------------------------------------- #
# Constants (ported)                                                           #
# --------------------------------------------------------------------------- #
VIDEO_EXTENSIONS = {
    ".mp4", ".m4v", ".mkv", ".mov", ".avi", ".wmv", ".flv", ".webm",
    ".mpg", ".mpeg", ".mts", ".m2ts", ".ts", ".3gp", ".3g2", ".ogv",
    ".vob", ".rm", ".rmvb", ".asf", ".f4v", ".divx",
}

_ALLOWED = set(
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789._-"
)

CODECS = {
    "opus":   {"encoder": "libopus",    "ext": ".opus", "default_bitrate": "24k"},
    "aac":    {"encoder": "aac",         "ext": ".m4a",  "default_bitrate": "32k"},
    "vorbis": {"encoder": "libvorbis",   "ext": ".ogg",  "default_bitrate": "48k"},
    "mp3":    {"encoder": "libmp3lame",  "ext": ".mp3",  "default_bitrate": "32k"},
}

_OPUS_RATES = (8000, 12000, 16000, 24000, 48000)


def _format_duration(seconds: float) -> str:
    """Human elapsed time: 'Mm SSs' under an hour, 'Hh MMm SSs' from an hour up."""
    total = int(round(seconds))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return "%dh %02dm %02ds" % (h, m, s)
    return "%dm %02ds" % (m, s)


def _mb(num_bytes: int) -> float:
    """Bytes -> MiB."""
    return num_bytes / (1024.0 * 1024.0)


def _file_size(path: str) -> int:
    """Size in bytes, or 0 if the file is missing/unreadable."""
    if path and os.path.isfile(path):
        return os.path.getsize(path)
    return 0


# --------------------------------------------------------------------------- #
# Name sanitization backends (translate -> unidecode -> pypinyin -> stdlib)    #
# --------------------------------------------------------------------------- #
def _load_backends(want_translate: bool) -> Dict[str, Any]:
    backends = {"translate": None, "unidecode": None, "pypinyin": None}

    if want_translate:
        try:
            from deep_translator import GoogleTranslator
            translator = GoogleTranslator(source="auto", target="en")

            def _translate(text):
                return translator.translate(text)

            backends["translate"] = _translate
        except Exception:
            backends["translate"] = None

    try:
        from unidecode import unidecode as _unidecode
        backends["unidecode"] = _unidecode
    except Exception:
        backends["unidecode"] = None

    try:
        from pypinyin import lazy_pinyin as _lazy_pinyin

        def _pinyin(text):
            return " ".join(_lazy_pinyin(text))

        backends["pypinyin"] = _pinyin
    except Exception:
        backends["pypinyin"] = None

    return backends


def _builtin_fallback(text: str) -> str:
    norm = unicodedata.normalize("NFKD", text)
    ascii_only = norm.encode("ascii", "ignore").decode("ascii")
    if not re.search(r"[A-Za-z0-9]", ascii_only):
        return "u_" + hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]
    return ascii_only


def _clean_token(text: str) -> str:
    text = re.sub(r"\s+", "", text)
    text = "".join(ch if ch in _ALLOWED else "_" for ch in text)
    text = re.sub(r"_{2,}", "_", text).strip("_.")
    return text


def to_english_ascii(text: Optional[str], backends: Dict[str, Any]) -> str:
    if text is None:
        return ""
    if all(ord(ch) < 128 for ch in text):
        converted = text
    else:
        converted = None
        if backends.get("translate"):
            try:
                result = backends["translate"](text)
                if result and result.strip():
                    converted = result
            except Exception:
                converted = None
        if converted is None and backends.get("unidecode"):
            try:
                converted = backends["unidecode"](text)
            except Exception:
                converted = None
        if converted is None and backends.get("pypinyin"):
            try:
                converted = backends["pypinyin"](text)
            except Exception:
                converted = None
        if converted is None or not converted.strip():
            converted = _builtin_fallback(text)
    return _clean_token(converted)


def sanitize_relpath(rel_path: str, backends: Dict[str, Any]):
    parts = [p for p in re.split(r"[\\/]+", rel_path) if p not in ("", ".", "..")]
    *dir_parts, file_name = parts
    stem, ext = os.path.splitext(file_name)
    clean_dirs = []
    for d in dir_parts:
        cd = to_english_ascii(d, backends)
        clean_dirs.append(cd or ("dir_" + hashlib.sha1(d.encode("utf-8")).hexdigest()[:8]))
    clean_stem = to_english_ascii(stem, backends)
    if not clean_stem:
        clean_stem = "file_" + hashlib.sha1(stem.encode("utf-8")).hexdigest()[:8]
    clean_ext = "." + re.sub(r"[^A-Za-z0-9]", "", ext.lstrip(".")).lower() if ext else ""
    return clean_dirs, clean_stem, clean_ext


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
    real cause instead of failing silently — even though we keep ``-loglevel
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
    source is taller than 720p (never upscales — the scale expression caps height
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


# --------------------------------------------------------------------------- #
# whisper runtime helpers (GPU detection / model auto-pick) - shared           #
# --------------------------------------------------------------------------- #
def has_nvidia_gpu() -> bool:
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return True
    except Exception:
        pass
    exe = shutil.which("nvidia-smi")
    if exe:
        try:
            return subprocess.run([exe], capture_output=True).returncode == 0
        except Exception:
            pass
    return False


def resolve_whisper_runtime(device: str, compute_type: str):
    if device == "auto":
        device = "cuda" if has_nvidia_gpu() else "cpu"
    if compute_type == "auto":
        compute_type = "float16" if device == "cuda" else "int8"
    return device, compute_type


def detect_gpu_vram_mb() -> int:
    exe = shutil.which("nvidia-smi")
    if not exe:
        return 0
    try:
        out = subprocess.run(
            [exe, "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        nums = [int(x) for x in re.findall(r"\d+", out.stdout or "")]
        return max(nums) if nums else 0
    except Exception:
        return 0


def pick_whisper_model(device: str, vram_mb: int) -> str:
    if device == "cuda":
        if vram_mb >= 10000:
            return "large-v3"
        if vram_mb >= 6000:
            return "turbo"
        if vram_mb >= 4000:
            return "medium"
        if vram_mb >= 2500:
            return "small"
        return "base"
    return "small"


# Whisper model sizes the UI offers, in ascending capability order. Only the ones
# actually downloaded on this backend are selectable (see list_installed_whisper_models).
WHISPER_MODEL_CANDIDATES = ("tiny", "base", "small", "medium", "large-v3", "turbo")


def _fw_model_repos() -> Dict[str, str]:
    """Map candidate model name -> HuggingFace repo id (from faster-whisper)."""
    repos: Dict[str, str] = {}
    try:
        from faster_whisper.utils import _MODELS
        for name in WHISPER_MODEL_CANDIDATES:
            if name in _MODELS:
                repos[name] = _MODELS[name]
    except Exception:
        pass
    return repos


def list_installed_whisper_models() -> List[str]:
    """
    Return the candidate model names whose weights are already downloaded in the
    local HuggingFace cache (so the UI only offers installed models). Empty list
    if the cache can't be read.
    """
    repos = _fw_model_repos()
    if not repos:
        return []
    try:
        from huggingface_hub import scan_cache_dir
        cached = {r.repo_id for r in scan_cache_dir().repos}
    except Exception:
        return []
    return [name for name in WHISPER_MODEL_CANDIDATES
            if repos.get(name) and repos[name] in cached]


def best_installed_model(installed: Optional[List[str]] = None) -> Optional[str]:
    """Pick the most capable installed model (rightmost in the candidate order)."""
    if installed is None:
        installed = list_installed_whisper_models()
    for name in reversed(WHISPER_MODEL_CANDIDATES):
        if name in installed:
            return name
    return None


def clamp_model_to_installed(name: str) -> str:
    """
    Keep a requested model if it's installed; otherwise fall back to the best
    installed model so 'auto' (or an API caller) never silently triggers a
    multi-GB download the user didn't choose. Returns the name unchanged when the
    installed set is unknown/empty.
    """
    installed = list_installed_whisper_models()
    if not installed or name in installed:
        return name
    fallback = best_installed_model(installed)
    if fallback and fallback != name:
        ColorPrint.yellow(
            f"[VideoExtract] model '{name}' not installed; using installed '{fallback}'.")
        return fallback
    return name


def list_supported_languages() -> List[Dict[str, str]]:
    """
    Supported transcription languages as [{code, name}], English first then the
    rest alphabetically by display name. Codes come from faster-whisper; human
    names from openai-whisper's table when available, else the code itself.
    """
    codes: List[str] = []
    try:
        from faster_whisper.tokenizer import _LANGUAGE_CODES
        codes = sorted(_LANGUAGE_CODES)
    except Exception:
        codes = ["en"]
    names: Dict[str, str] = {}
    try:
        from whisper.tokenizer import LANGUAGES
        names = {k: v.title() for k, v in LANGUAGES.items()}
    except Exception:
        names = {}
    langs = [{"code": c, "name": names.get(c, c)} for c in codes]
    langs.sort(key=lambda x: ("" if x["code"] == "en" else x["name"].lower()))
    return langs


def whisper_capabilities() -> Dict[str, Any]:
    """Aggregate UI capability info: full model catalog + installed set + languages.

    The UI shows EVERY candidate model (``all_models``) so users can see what
    exists; only those in ``installed_models`` are selectable (the rest render
    disabled). 'auto' is always selectable and resolves to the best installed
    model at run time.
    """
    installed = list_installed_whisper_models()
    # Kept for back-compat (older UI used this as the selectable set).
    models = ["auto"] + installed
    return {
        "models": models,
        "all_models": list(WHISPER_MODEL_CANDIDATES),  # full catalog, ascending capability
        "installed_models": installed,
        "default_model": best_installed_model(installed) or "auto",
        "languages": list_supported_languages(),
        "default_lang": "en",
        "ffmpeg_found": bool(resolve_ffmpeg()),
    }


def _add_nvidia_dll_dirs():
    """Make pip-installed cuBLAS/cuDNN DLLs discoverable for CTranslate2 (Windows)."""
    if os.name != "nt":
        return
    try:
        import importlib.util as u
        for mod in ("nvidia.cublas", "nvidia.cudnn"):
            spec = u.find_spec(mod)
            if spec and spec.submodule_search_locations:
                bin_dir = os.path.join(list(spec.submodule_search_locations)[0], "bin")
                if os.path.isdir(bin_dir):
                    os.add_dll_directory(bin_dir)
    except Exception:
        pass


def _srt_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return "%02d:%02d:%02d,%03d" % (h, m, s, ms)


# ===========================================================================
# STT engine: faster-whisper (DEFAULT)
# ===========================================================================
def load_faster_whisper(model_name: str, device: str, compute_type: str):
    """Load a faster-whisper model once for reuse. Returns model or None."""
    _add_nvidia_dll_dirs()
    try:
        from faster_whisper import WhisperModel
    except Exception:
        ColorPrint.yellow(
            "[VideoExtract] faster-whisper not installed. "
            "Install it (scripts/iniscripts/install_faster_whisper.*) or "
            "`pip install faster-whisper`. Subtitles disabled for this run.")
        return None
    try:
        return WhisperModel(model_name, device=device, compute_type=compute_type)
    except Exception as exc:
        ColorPrint.yellow(f"[VideoExtract] whisper load failed on {device}/{compute_type}: {exc}")
        if device != "cpu":
            ColorPrint.yellow("[VideoExtract] Falling back to CPU (int8).")
            try:
                return WhisperModel(model_name, device="cpu", compute_type="int8")
            except Exception as exc2:
                ColorPrint.yellow(f"[VideoExtract] CPU load also failed: {exc2}")
        return None


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


def _probe_duration(ffprobe, src: str) -> float:
    """Media duration in seconds via ffprobe (0.0 if unknown)."""
    if not ffprobe:
        return 0.0
    out = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    try:
        return float((out.stdout or "").strip())
    except ValueError:
        return 0.0


# --------------------------------------------------------------------------- #
# Smart segmentation (split long videos into <5-min, subtitle-aligned clips)   #
# --------------------------------------------------------------------------- #
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


def cut_segments(segments: List[Dict[str, Any]], tiny_mp4: str, mp3_path: str,
                 seg_dir: str, ffmpeg: str, full_mp4: Optional[str] = None,
                 log=None, ffprobe: Optional[str] = None) -> Dict[str, int]:
    """Cut each segment's [start, end] into THREE clips: the tiny 2x2 mp4, the
    compressed FULL video, and the mp3.

    Per segment (all idempotent — an existing clip with size>0 is skipped, missing
    ones are (re)generated):
      * ``seg_%03d.mp4``      from the TINY 2x2 mp4 (re-encoded for an accurate
                              seek — cheap at 2x2).
      * ``seg_%03d.full.mp4`` from the COMPRESSED FULL video (re-encoded
                              libx264 CRF 28 + AAC 96k for an accurate cut), ONLY
                              when ``full_mp4`` is given and exists. If it's
                              missing/None the full clip is skipped — the segment
                              does NOT fail. The audio is downmixed to stereo
                              (``-ac 2``) because the AAC encoder rejects bare
                              multichannel layouts (e.g. 5.1 "6 channels"), and is
                              dropped (``-an``) when the full video has no audio.
      * ``seg_%03d.mp3``      from the mp3 (stream-copy, re-encode fallback).

    On any clip FAILURE the tail of ffmpeg's stderr is emitted via ``log`` so the
    real cause is visible (we still pass ``-loglevel error`` to keep it short).
    Logs one line per segment naming all three. Returns {"made","skipped","failed"}.
    """
    os.makedirs(seg_dir, exist_ok=True)
    stats = {"made": 0, "skipped": 0, "failed": 0}
    n = len(segments)
    have_full = bool(full_mp4 and os.path.isfile(full_mp4) and os.path.getsize(full_mp4) > 0)
    # Probe the full video's audio ONCE: drop audio (-an) if it has none, else
    # downmix to stereo. None (no ffprobe) -> assume audio + downmix (safe).
    full_has_audio = has_audio_stream(ffprobe, full_mp4) if have_full else None

    def _emit(m):
        if log:
            log(m)

    for seg in segments:
        i = seg["index"]
        start = float(seg["start"])
        end = float(seg["end"])
        dur = max(0.0, end - start)
        mp4_out = os.path.join(seg_dir, "seg_%03d.mp4" % i)
        full_out = os.path.join(seg_dir, "seg_%03d.full.mp4" % i)
        mp3_out = os.path.join(seg_dir, "seg_%03d.mp3" % i)

        def _err_logger(kind, out_name):
            def _cb(tail):
                _emit("    seg %03d %s FAILED: %s" % (i, kind, tail))
            return _cb

        # mp4 clip (tiny -> accurate re-encode)
        if os.path.isfile(mp4_out) and os.path.getsize(mp4_out) > 0:
            mp4_status = "skip"
            stats["skipped"] += 1
        else:
            ok = _run_ffmpeg([
                ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                "-ss", "%.3f" % start, "-to", "%.3f" % end, "-i", tiny_mp4,
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
                "-c:a", "aac", "-b:a", "32k", mp4_out,
            ], mp4_out, on_error=_err_logger("mp4", mp4_out))
            if ok:
                mp4_status = "ok"
                stats["made"] += 1
            else:
                mp4_status = "fail"
                stats["failed"] += 1

        # full clip (compressed full video -> accurate re-encode); only if available.
        # Use the DURATION form (-ss start -i -t dur) + explicit stream maps +
        # -pix_fmt yuv420p + stereo downmix for a robust cut. The full video may
        # carry a 5.1 (6-channel) AAC track that the encoder can't re-open as-is,
        # so force -ac 2 (or -an when there's no audio at all).
        if not have_full:
            full_status = "n/a"
        elif os.path.isfile(full_out) and os.path.getsize(full_out) > 0:
            full_status = "skip"
            stats["skipped"] += 1
        else:
            full_cmd = [
                ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                "-ss", "%.3f" % start, "-i", full_mp4, "-t", "%.3f" % dur,
                "-map", "0:v:0",
            ]
            if full_has_audio is False:
                full_cmd += ["-an"]
            else:
                full_cmd += ["-map", "0:a:0?", "-c:a", "aac", "-b:a", "96k", "-ac", "2"]
            full_cmd += [
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", full_out,
            ]
            ok = _run_ffmpeg(full_cmd, full_out, on_error=_err_logger("full", full_out))
            if ok:
                full_status = "ok"
                stats["made"] += 1
            else:
                full_status = "fail"
                stats["failed"] += 1

        # mp3 clip (stream copy, re-encode fallback)
        if os.path.isfile(mp3_out) and os.path.getsize(mp3_out) > 0:
            mp3_status = "skip"
            stats["skipped"] += 1
        else:
            ok = _run_ffmpeg([
                ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                "-ss", "%.3f" % start, "-to", "%.3f" % end, "-i", mp3_path,
                "-c", "copy", mp3_out,
            ], mp3_out)
            if not ok:
                ok = _run_ffmpeg([
                    ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                    "-ss", "%.3f" % start, "-to", "%.3f" % end, "-i", mp3_path,
                    "-c:a", "libmp3lame", "-b:a", "32k", mp3_out,
                ], mp3_out, on_error=_err_logger("mp3", mp3_out))
            if ok:
                mp3_status = "ok"
                stats["made"] += 1
            else:
                mp3_status = "fail"
                stats["failed"] += 1

        _emit("    seg %03d/%02d [%s -> %s] mp4 %s / full %s / mp3 %s"
              % (i, n, _clip_label(start), _clip_label(end),
                 mp4_status, full_status, mp3_status))
    return stats


def transcribe_to_srt_faster(model, src: str, srt_path: str, language: str,
                             log=None, ffmpeg=None, duration: float = 0.0,
                             on_progress=None):
    """faster-whisper -> SRT, with per-segment progress AND resume.

    Idempotent + RESUMABLE: if a partial .srt already exists, transcription CONTINUES
    from its last segment's end (the prior work is kept, not redone) by seeking the
    audio with ffmpeg and appending offset-corrected segments. If it's already
    complete (last segment within ~2s of the media end), returns 'complete'.

    Returns 'complete' (already done) / True (written) / False (error) / None (no speech).
    ``log`` gets live detail: start, language/duration, one line per written segment.
    ``on_progress(pct)`` (optional) is called with the latest 0-100 transcription
    percent per written segment so callers can stash live progress.
    """
    def _emit(m):
        if log:
            log(m)

    start_index, resume_from = _parse_srt_resume(srt_path)
    # Already fully transcribed? (idempotent skip)
    if resume_from > 0 and duration and resume_from >= duration - 2.0:
        return "complete"

    audio_input = src
    temp_audio = None
    if resume_from > 0 and ffmpeg:
        # Resume: transcribe ONLY the remaining tail (don't redo the kept part).
        _emit(f"    [srt]: resuming from {_srt_timestamp(resume_from)} "
              f"(kept {start_index} segments)")
        temp_audio = srt_path + ".resume.wav"
        subprocess.run(
            [ffmpeg, "-y", "-ss", f"{resume_from:.3f}", "-i", src, "-vn",
             "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", temp_audio],
            capture_output=True)
        if os.path.isfile(temp_audio) and os.path.getsize(temp_audio) > 0:
            audio_input = temp_audio
        else:
            resume_from, start_index, temp_audio = 0.0, 0, None  # seek failed -> full pass
    elif resume_from > 0:
        resume_from, start_index = 0.0, 0  # no ffmpeg to seek -> redo from scratch

    try:
        # faster-whisper transcribes LAZILY as segments are iterated — so emitting a
        # line per segment below is genuine live progress, not after-the-fact.
        segments, info = model.transcribe(
            audio_input, language=(language or None), vad_filter=True, word_timestamps=False)
        det_lang = getattr(info, "language", language or "?")
        prob = getattr(info, "language_probability", None)
        _emit("    [srt]: transcribing ..." if resume_from == 0 else "    [srt]: transcribing (resume) ...")
        _emit(f"    [srt]: language={det_lang}"
              + (f" ({prob * 100:.0f}%)" if prob else "")
              + (f", duration={int(duration)}s" if duration else ""))
        idx = start_index
        wrote = 0
        with open(srt_path, "a" if resume_from > 0 else "w", encoding="utf-8") as fh:
            for seg in segments:
                text = (seg.text or "").strip()
                if not text:
                    continue
                idx += 1
                wrote += 1
                a_start = seg.start + resume_from   # offset tail timestamps back to absolute
                a_end = seg.end + resume_from
                fh.write("%d\n%s --> %s\n%s\n\n" % (
                    idx, _srt_timestamp(a_start), _srt_timestamp(a_end), text))
                fh.flush()
                pct = (a_end / duration * 100.0) if duration else 0.0
                if on_progress:
                    on_progress(max(0.0, min(100.0, pct)))
                _emit(f"    [srt]  {pct:5.1f}% [{_srt_timestamp(a_start)} -> "
                      f"{_srt_timestamp(a_end)}] {text}")
        if temp_audio and os.path.isfile(temp_audio):
            os.remove(temp_audio)
        if idx == 0:
            if os.path.isfile(srt_path):
                try:
                    os.remove(srt_path)
                except OSError:
                    pass
            return None
        return True
    except Exception as exc:
        if temp_audio and os.path.isfile(temp_audio):
            try:
                os.remove(temp_audio)
            except OSError:
                pass
        ColorPrint.yellow(f"[VideoExtract] srt error: {exc}")
        # Keep a partial .srt on failure so the NEXT run resumes from it.
        return False


# ===========================================================================
# STT engine: openai-whisper (DISABLED - preserved, commented out)
# ===========================================================================
# The openai-whisper path reuses pycore's WhisperSTTProvider. It is intentionally
# disabled per project decision (faster-whisper is the default). To re-enable,
# uncomment these and wire `engine == "whisper"` in _make_transcriber().
#
# def load_openai_whisper(model_name: str, device: str, compute_type: str):
#     """Load pycore's openai-whisper provider once for reuse. Returns provider or None."""
#     try:
#         from pycore.pyutils.whisper_stt import WhisperSTTProvider
#         provider = WhisperSTTProvider()
#         # provider.initialize(model_size=model_name, device=device)  # API: see whisper_provider.py
#         return provider
#     except Exception as exc:
#         ColorPrint.yellow(f"[VideoExtract] openai-whisper unavailable: {exc}")
#         return None
#
# def transcribe_to_srt_openai(provider, src: str, srt_path: str, language: str):
#     """openai-whisper (pycore WhisperSTTProvider) -> SRT.
#        Returns True written / False error / None no-speech."""
#     try:
#         res = provider.transcribe(src, language=(language or None))
#         segments = (res or {}).get("segments") or []
#         idx = 0
#         with open(srt_path, "w", encoding="utf-8") as fh:
#             for seg in segments:
#                 text = (seg.get("text") or "").strip()
#                 if not text:
#                     continue
#                 idx += 1
#                 fh.write("%d\n%s --> %s\n%s\n\n" % (
#                     idx, _srt_timestamp(seg.get("start", 0)),
#                     _srt_timestamp(seg.get("end", 0)), text))
#         if idx == 0:
#             try: os.remove(srt_path)
#             except OSError: pass
#             return None
#         return True
#     except Exception as exc:
#         ColorPrint.yellow(f"[VideoExtract] srt error (openai): {exc}")
#         return False


# --------------------------------------------------------------------------- #
# Scanning                                                                     #
# --------------------------------------------------------------------------- #
def _resolve_extensions(config: Optional[Dict[str, Any]]) -> set:
    """Effective extension allow-list: config['extensions'] intersected with
    VIDEO_EXTENSIONS, or all VIDEO_EXTENSIONS when absent/empty."""
    raw = (config or {}).get("extensions") or []
    wanted = set()
    for e in raw:
        e = (e or "").strip().lower()
        if not e:
            continue
        if not e.startswith("."):
            e = "." + e
        wanted.add(e)
    wanted &= VIDEO_EXTENSIONS
    return wanted or set(VIDEO_EXTENSIONS)


def iter_videos(root: str, output_dir: str, extensions: Optional[set] = None):
    exts = extensions or VIDEO_EXTENSIONS
    output_abs = os.path.normcase(os.path.abspath(output_dir))
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d for d in dirnames
            if os.path.normcase(os.path.abspath(os.path.join(dirpath, d))) != output_abs
        ]
        for name in filenames:
            if os.path.splitext(name)[1].lower() in exts:
                yield os.path.join(dirpath, name)


# --------------------------------------------------------------------------- #
# Processor                                                                    #
# --------------------------------------------------------------------------- #
class VideoExtractProcessor:
    """Batch / single video -> audio + tiny-mp4 + subtitle. pycore architecture."""

    def _resolve_io(self, config: Dict[str, Any]):
        """Return (root, output_dir, videos[], mode) or raise ValueError."""
        path = (config.get("path") or "").strip()
        if not path:
            raise ValueError("path is required")
        path = os.path.abspath(path)
        mode = (config.get("mode") or "folder").lower()
        exts = _resolve_extensions(config)

        if mode == "file" or os.path.isfile(path):
            if not os.path.isfile(path):
                raise ValueError(f"File not found: {path}")
            root = os.path.dirname(path)
            output_dir = os.path.abspath(config["output"]) if config.get("output") else root
            videos = [path] if os.path.splitext(path)[1].lower() in exts else []
            return root, output_dir, videos, "file"

        if not os.path.isdir(path):
            raise ValueError(f"Folder not found: {path}")
        root = path
        output_dir = (os.path.abspath(config["output"]) if config.get("output")
                      else os.path.join(root, "_compressed_result"))
        videos = list(iter_videos(root, output_dir, exts))
        return root, output_dir, videos, "folder"

    def _parse_codecs(self, formats) -> List[str]:
        codecs = []
        for c in (formats or ["mp3"]):
            c = (c or "").strip().lower()
            if c in CODECS and c not in codecs:
                codecs.append(c)
        return codecs or ["mp3"]

    @staticmethod
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

    @staticmethod
    def _fetch_video_poster(original_filename: str, out_dir: str, log):
        """Best-effort movie/TV poster for one video. Returns (poster_name, poster_info).

        Parses a clean title + year from ``original_filename`` (strip release/
        quality tokens, SxxExx, year), fetches a poster via the shared
        movie_poster_client (TMDB -> OMDB, CJK title translated first), and writes
        ``poster.jpg``/``.png`` into ``out_dir``. ``poster_name`` is the bare
        filename (for mapping.files.poster); ``poster_info`` is a small dict
        ({file, provider, source_id, meta}) for the per-item result. Returns
        ``(None, None)`` when no poster is found. NEVER raises.
        """
        try:
            title, year = parse_title_year(original_filename)
            if not (title and title.strip()):
                return None, None
            poster = find_poster(title.strip(), year=year)
            if not poster:
                return None, None
            saved = save_poster_file(
                poster.get("image_base64") or "",
                poster.get("mime") or "image/jpeg",
                os.path.join(out_dir, "poster"),
            )
            if not saved:
                return None, None
            poster_name = os.path.basename(saved)
            log(f"    poster: saved {poster_name} ({poster.get('provider')})")
            return poster_name, {
                "file": poster_name,
                "provider": poster.get("provider"),
                "source_id": poster.get("source_id"),
                "meta": poster.get("meta") or {},
            }
        except Exception as exc:  # noqa: BLE001 - never fail extraction
            log(f"    poster: skipped ({exc})")
            return None, None

    @staticmethod
    def _write_segments_mapping(seg_dir: str, src: str, root: str, stem: str,
                                duration: float, segments: List[Dict[str, Any]],
                                full_mp4: Optional[str] = None,
                                tiny_mp4: Optional[str] = None,
                                mp3_path: Optional[str] = None,
                                srt_path: Optional[str] = None,
                                original_name: Optional[str] = None,
                                poster_name: Optional[str] = None) -> str:
        """(Re)write mapping.json describing every segment + its subtitles.

        Always overwritten when segments are (re)generated so it reflects the
        current clips. Returns the mapping.json path.

        Path conventions for the consumer:
          * ``files.*`` (full_mp4 / tiny_mp4 / audio.mp3 / srt) are BARE filenames
            that live in the per-file OUTPUT dir (the seg_dir's PARENT), NOT in
            seg_dir. Resolve them relative to os.path.dirname(seg_dir).
          * ``segments[].full_mp4`` / ``mp4`` / ``mp3`` are BARE filenames that
            live INSIDE seg_dir (alongside this mapping.json).
        Any artifact that doesn't exist is recorded as null.
        """
        try:
            rel_src = os.path.relpath(src, root)
        except ValueError:
            rel_src = src

        def _exists(p):
            return bool(p and os.path.isfile(p) and os.path.getsize(p) > 0)

        def _seg_exists(name):
            return os.path.isfile(os.path.join(seg_dir, name)) and \
                os.path.getsize(os.path.join(seg_dir, name)) > 0

        if not original_name:
            original_name = os.path.basename(src)

        mapping = {
            "video": rel_src,
            "stem": stem,
            "filename": {
                "original": original_name,         # original (pre-sanitize) basename incl. ext
                "ascii": stem,                     # sanitized ascii stem
            },
            # files.* are BARE NAMES in the OUTPUT dir (seg_dir's parent), not seg_dir.
            # poster is the movie/TV poster filename (poster.jpg/.png) in that same
            # OUTPUT dir; null when no poster was fetched.
            "files": {
                "full_mp4": (stem + ".full.mp4") if _exists(full_mp4) else None,
                "tiny_mp4": (stem + ".mp4") if _exists(tiny_mp4) else None,
                "audio": {"mp3": (stem + ".mp3") if _exists(mp3_path) else None},
                "srt": (stem + ".srt") if _exists(srt_path) else None,
                "poster": poster_name if (poster_name and _exists(
                    os.path.join(os.path.dirname(seg_dir), poster_name))) else None,
            },
            "duration": float(duration),
            "max_segment_sec": 300,
            "segment_count": len(segments),
            "segments": [
                {
                    "index": seg["index"],
                    "start": float(seg["start"]),
                    "end": float(seg["end"]),
                    # bare names INSIDE seg_dir; null when that clip wasn't produced
                    "full_mp4": ("seg_%03d.full.mp4" % seg["index"])
                    if _seg_exists("seg_%03d.full.mp4" % seg["index"]) else None,
                    "mp4": ("seg_%03d.mp4" % seg["index"])
                    if _seg_exists("seg_%03d.mp4" % seg["index"]) else None,
                    "mp3": ("seg_%03d.mp3" % seg["index"])
                    if _seg_exists("seg_%03d.mp3" % seg["index"]) else None,
                    "subtitle_count": len(seg["subtitles"]),
                    "subtitles": [
                        {"idx": s["idx"], "start": float(s["start"]),
                         "end": float(s["end"]), "text": s["text"]}
                        for s in seg["subtitles"]
                    ],
                }
                for seg in segments
            ],
        }
        os.makedirs(seg_dir, exist_ok=True)
        mapping_path = os.path.join(seg_dir, "mapping.json")
        with open(mapping_path, "w", encoding="utf-8") as fh:
            json.dump(mapping, fh, ensure_ascii=False, indent=2)
        return mapping_path

    @staticmethod
    def _log_file_footer(log, idx: int, total: int, file_elapsed: float, elapsed_total: float):
        """Log the per-file timing + running total/pct/cumulative elapsed line."""
        pct = int(idx / total * 100) if total else 100
        log("    time: %s | total: %d/%d (%d%%) elapsed %s"
            % (_format_duration(file_elapsed), idx, total, pct,
               _format_duration(elapsed_total)))

    # ----- dry-run preview ------------------------------------------------- #
    def preview(self, config: Dict[str, Any]) -> Dict[str, Any]:
        try:
            root, output_dir, videos, mode = self._resolve_io(config)
        except ValueError as e:
            return {"success": False, "error": str(e)}

        ffmpeg = resolve_ffmpeg()
        engine = config.get("engine", "faster-whisper")
        wdevice, _wc = resolve_whisper_runtime(
            config.get("whisper_device", "auto"), config.get("whisper_compute", "auto"))
        wmodel = config.get("whisper_model", "auto")
        if config.get("subtitle"):
            if wmodel == "auto":
                wmodel = pick_whisper_model(wdevice, detect_gpu_vram_mb())
            wmodel = clamp_model_to_installed(wmodel)

        rels = [os.path.relpath(v, root) for v in videos]
        return {
            "success": True,
            "root": root,
            "output": output_dir,
            "videos": rels,
            "count": len(rels),
            "ffmpeg_found": bool(ffmpeg),
            "engine": engine,
            "model": wmodel,
            "device": wdevice,
            "message": f"{len(rels)} video(s) found ({mode} mode)."
                       + ("" if ffmpeg else " WARNING: ffmpeg not found."),
        }

    # ----- segments mapping lookup ----------------------------------------- #
    def read_segments(self, path: str) -> Dict[str, Any]:
        """Read a segmentation mapping.json for the FE 'segments' endpoint.

        `path` may be: the mapping.json file itself, the '<stem>_segments' dir,
        or any directory containing a (possibly nested) 'mapping.json'. Returns
        {"success": True, "mapping": <dict>} or {"success": False, "error": ...}.
        """
        path = (path or "").strip()
        if not path:
            return {"success": False, "error": "path is required"}
        path = os.path.abspath(path)

        mapping_file = None
        if os.path.isfile(path) and os.path.basename(path).lower() == "mapping.json":
            mapping_file = path
        elif os.path.isdir(path):
            direct = os.path.join(path, "mapping.json")
            if os.path.isfile(direct):
                mapping_file = direct
            else:
                # look one level down for '*/mapping.json'
                for entry in sorted(os.listdir(path)):
                    cand = os.path.join(path, entry, "mapping.json")
                    if os.path.isfile(cand):
                        mapping_file = cand
                        break

        if not (mapping_file and os.path.isfile(mapping_file)):
            return {"success": False, "error": "no segments"}
        try:
            with open(mapping_file, "r", encoding="utf-8", errors="replace") as fh:
                mapping = json.load(fh)
        except (OSError, ValueError) as exc:
            return {"success": False, "error": f"could not read mapping.json: {exc}"}
        # Expose the resolved mapping.json path so callers can locate the sibling
        # .srt (its PARENT dir holds files.* incl. the subtitle track) — used by
        # the v3 multi-language segments view.
        return {"success": True, "mapping": mapping, "mapping_file": mapping_file}

    # ----- full run -------------------------------------------------------- #
    def run(self, config: Dict[str, Any],
            progress_cb: Optional[Callable[[int, Dict[str, Any]], None]] = None,
            should_stop: Optional[Callable[[], bool]] = None,
            should_pause: Optional[Callable[[], bool]] = None,
            videos_override: Optional[List[str]] = None) -> Dict[str, Any]:
        start_time = time.time()
        logs: List[str] = []

        def log(msg: str):
            logs.append(msg)
            if len(logs) > 300:
                del logs[:len(logs) - 300]
            ColorPrint.blue("[VideoExtract] " + msg)

        def stopped() -> bool:
            return bool(should_stop and should_stop())

        def wait_if_paused():
            """Block (cooperatively) while should_pause() is true; bail on stop."""
            if not (should_pause and should_pause()):
                return
            log("Paused...")
            while should_pause and should_pause() and not stopped():
                time.sleep(0.3)
            if not stopped():
                log("Resumed")

        try:
            root, output_dir, videos, mode = self._resolve_io(config)
        except ValueError as e:
            return {"success": False, "error": str(e), "execution_time": time.time() - start_time}

        # run_many passes a pre-merged, de-duplicated subset of this root's videos.
        if videos_override is not None:
            videos = videos_override

        ffmpeg = resolve_ffmpeg()
        if not ffmpeg:
            return {"success": False, "error": "ffmpeg not found on PATH.",
                    "execution_time": time.time() - start_time}
        ffprobe = resolve_ffprobe(ffmpeg)

        codecs = self._parse_codecs(config.get("formats"))
        backends = _load_backends(bool(config.get("translate")))
        make_mp4 = bool(config.get("make_mp4", True))
        # Subtitles are ALWAYS generated (at least one language) per requirement —
        # the .srt is idempotent and resumable, so this is safe to force on.
        want_subtitle = True
        dry_run = bool(config.get("dry_run"))
        # Movie/TV poster fetch (best-effort, per the request option; default ON).
        fetch_poster = bool(config.get("fetch_poster", True))
        sample_rate = int(config.get("sample_rate", 22050))
        mono = not bool(config.get("stereo"))
        bitrate_override = config.get("bitrate") or None
        # Subtitle language. faster-whisper rejects the literal 'auto' (and "") —
        # default those to English instead of letting transcribe() raise
        # "'auto' is not a valid language code". A real code (en/zh/ja/...) is kept.
        lang = (config.get("lang") or "en").strip() or "en"
        if lang.lower() == "auto":
            lang = "en"
        engine = config.get("engine", "faster-whisper")

        # Resolve whisper runtime/model and load the model once.
        whisper_model = None
        wdevice, wcompute = resolve_whisper_runtime(
            config.get("whisper_device", "auto"), config.get("whisper_compute", "auto"))
        wmodel = config.get("whisper_model", "auto")
        if want_subtitle:
            if wmodel == "auto":
                wmodel = pick_whisper_model(wdevice, detect_gpu_vram_mb())
            wmodel = clamp_model_to_installed(wmodel)
        if want_subtitle and not dry_run:
            log(f"Loading STT engine={engine} model={wmodel} on {wdevice}/{wcompute} ...")
            # --- engine selection (faster-whisper default) ------------------ #
            if engine == "whisper":
                # openai-whisper path is DISABLED (see commented section above).
                log("engine 'whisper' (openai-whisper) is disabled; using faster-whisper.")
                whisper_model = load_faster_whisper(wmodel, wdevice, wcompute)
            else:
                whisper_model = load_faster_whisper(wmodel, wdevice, wcompute)
            if whisper_model is None:
                log("Subtitles disabled for this run (engine unavailable).")

        if not dry_run:
            os.makedirs(output_dir, exist_ok=True)

        total = len(videos)
        stats = {"videos": 0, "mp4_done": 0, "mp4_skip": 0, "mp4_fail": 0, "no_audio": 0,
                 "full_done": 0, "full_skip": 0, "full_fail": 0,
                 "srt_done": 0, "srt_skip": 0, "srt_fail": 0, "srt_empty": 0,
                 "seg_made": 0, "seg_skip": 0}
        per_codec = {c: {"done": 0, "skip": 0, "fail": 0} for c in codecs}
        items: List[Dict[str, Any]] = []

        log(f"{total} video(s) to process ({mode} mode). output={output_dir}")

        def emit(idx: int, current: Optional[Dict[str, Any]] = None):
            if not progress_cb:
                return
            pct = int(idx / total * 100) if total else 100
            elapsed_total = time.time() - start_time
            eta = (elapsed_total / idx * (total - idx)) if (idx and total and idx < total) else None
            progress_cb(pct, {
                "processed": idx, "total": total, "mode": mode,
                "root": root, "output": output_dir,
                "stats": dict(stats), "items": items[-50:], "logs": logs[-60:],
                "current": current,
                "elapsed_total": round(elapsed_total, 2),
                "eta": (round(eta, 2) if eta is not None else None),
            })

        for idx, src in enumerate(videos, 1):
            if stopped():
                log("Stop requested - aborting remaining videos.")
                break
            wait_if_paused()
            if stopped():
                log("Stop requested - aborting remaining videos.")
                break

            file_start = time.time()
            stats["videos"] += 1
            rel = os.path.relpath(src, root)
            src_size = _file_size(src)
            dir_parts, stem, _ext = sanitize_relpath(rel, backends)
            target_dir = os.path.join(output_dir, *dir_parts) if dir_parts else output_dir
            item: Dict[str, Any] = {"src": rel, "ascii": os.path.join(*(dir_parts + [stem])) if dir_parts else stem,
                                    "audio": {}, "mp4": None, "srt": None, "status": "ok"}
            current: Dict[str, Any] = {
                "rel": rel, "src_size": src_size, "out_dir": target_dir,
                "srt": None, "srt_pct": None, "audios": [], "mp4": None,
                "full_mp4": None,
                "segments_dir": None, "file_elapsed": 0.0,
            }

            log(f"[{idx}/{total}] {rel}")
            log(f"    original: {_mb(src_size):.2f} MB")

            if not dry_run:
                os.makedirs(target_dir, exist_ok=True)

            # no audio -> skip
            if has_audio_stream(ffprobe, src) is False:
                stats["no_audio"] += 1
                item["status"] = "no_audio"
                items.append(item)
                file_elapsed = time.time() - file_start
                current["file_elapsed"] = round(file_elapsed, 2)
                log("    skip: no audio track")
                self._log_file_footer(log, idx, total, file_elapsed, time.time() - start_time)
                emit(idx, current)
                continue

            def _pct_of_src(n: int) -> str:
                return ("%.1f%%" % (n / src_size * 100)) if src_size else "-"

            # tiny mp4
            if make_mp4:
                mp4_path = os.path.join(target_dir, stem + ".mp4")
                exists = os.path.isfile(mp4_path) and os.path.getsize(mp4_path) > 0
                if exists and is_already_tiny_mp4(ffprobe, mp4_path, src):
                    stats["mp4_skip"] += 1
                    item["mp4"] = mp4_path
                    sz = _file_size(mp4_path)
                    current["mp4"] = mp4_path
                    log(f"    mp4: skip (already tiny, {_mb(sz):.2f} MB)")
                elif dry_run:
                    item["mp4"] = "(would create)"
                    log("    mp4: would create tiny ai-mp4")
                else:
                    mp4_bitrate = bitrate_override or CODECS["aac"]["default_bitrate"]
                    if make_tiny_mp4(ffmpeg, src, mp4_path, mp4_bitrate, sample_rate, mono):
                        stats["mp4_done"] += 1
                        item["mp4"] = mp4_path
                        sz = _file_size(mp4_path)
                        current["mp4"] = mp4_path
                        log(f"    mp4: created ({_mb(sz):.2f} MB, {_pct_of_src(sz)} of original)")
                    else:
                        stats["mp4_fail"] += 1
                        item["status"] = "mp4_failed"
                        log("    mp4: FAILED")

            # compressed FULL-resolution video (idempotent) — a watchable
            # downscaled-to-720p H.264 copy, produced alongside the tiny 2x2 mp4
            # under the SAME make_mp4 condition. The tiny mp4 stays <stem>.mp4;
            # this one is <stem>.full.mp4.
            if make_mp4:
                full_mp4_path = os.path.join(target_dir, stem + ".full.mp4")
                if dry_run:
                    item["full_mp4"] = "(would create)"
                    log("    full: would create compressed full video")
                elif os.path.isfile(full_mp4_path) and os.path.getsize(full_mp4_path) > 0:
                    stats["full_skip"] += 1
                    item["full_mp4"] = full_mp4_path
                    current["full_mp4"] = full_mp4_path
                    compress_full_video(ffmpeg, ffprobe, src, full_mp4_path, log=log)
                elif compress_full_video(ffmpeg, ffprobe, src, full_mp4_path, log=log):
                    stats["full_done"] += 1
                    item["full_mp4"] = full_mp4_path
                    current["full_mp4"] = full_mp4_path
                else:
                    stats["full_fail"] += 1

            # audio per codec (idempotent)
            for c in codecs:
                info = CODECS[c]
                audio_path = os.path.join(target_dir, stem + info["ext"])
                bitrate = bitrate_override or info["default_bitrate"]
                if os.path.isfile(audio_path) and os.path.getsize(audio_path) > 0:
                    per_codec[c]["skip"] += 1
                    item["audio"][c] = audio_path
                    sz = _file_size(audio_path)
                    current["audios"].append({"path": audio_path, "size": sz})
                    log(f"    {c}: skip (exists, {_mb(sz):.2f} MB, {_pct_of_src(sz)} of original)")
                elif dry_run:
                    item["audio"][c] = "(would extract)"
                    log(f"    {c}: would extract {info['ext']}")
                else:
                    if extract_audio(ffmpeg, src, audio_path, info["encoder"], bitrate, sample_rate, mono):
                        per_codec[c]["done"] += 1
                        item["audio"][c] = audio_path
                        sz = _file_size(audio_path)
                        current["audios"].append({"path": audio_path, "size": sz})
                        log(f"    {c}: extracted {info['ext']} ({_mb(sz):.2f} MB, {_pct_of_src(sz)} of original)")
                    else:
                        per_codec[c]["fail"] += 1
                        log(f"    {c}: FAILED")

            # subtitle — ALWAYS generated; idempotent + RESUMABLE: a complete .srt is
            # skipped, a partial one CONTINUES from where it stopped (transcribe_to_srt_faster
            # handles both via the existing .srt + ffmpeg seek).
            srt_path = os.path.join(target_dir, stem + ".srt")
            vid_duration = 0.0
            if whisper_model is not None and not dry_run:
                vid_duration = _probe_duration(ffprobe, src)

                def _srt_progress(pct, _cur=current, _idx=idx):
                    _cur["srt_pct"] = round(pct, 1)
                    emit(_idx, _cur)

                res = transcribe_to_srt_faster(
                    whisper_model, src, srt_path, lang, log=log, ffmpeg=ffmpeg,
                    duration=vid_duration, on_progress=_srt_progress)
                if res == "complete":
                    stats["srt_skip"] += 1
                    item["srt"] = srt_path
                    current["srt"] = srt_path
                    current["srt_pct"] = 100.0
                    log("    srt: skip (complete)")
                elif res is True:
                    stats["srt_done"] += 1
                    item["srt"] = srt_path
                    current["srt"] = srt_path
                    current["srt_pct"] = 100.0
                    log(f"    srt: written ({self._count_srt_segments(srt_path)} segments)")
                elif res is None:
                    stats["srt_empty"] += 1
                    log("    srt: no speech detected")
                else:
                    stats["srt_fail"] += 1
                    log("    srt: FAILED (partial .srt kept for resume next run)")
            elif dry_run:
                item["srt"] = "(would transcribe)"
                log("    srt: would transcribe")
            elif whisper_model is None:
                log("    srt: SKIPPED — whisper engine failed to load")

            # movie/TV poster — best-effort: parse a clean title+year from the
            # ORIGINAL filename, fetch a poster (TMDB->OMDB), and save poster.jpg/.png
            # into this video's output dir. A failure NEVER fails extraction.
            poster_name: Optional[str] = None
            poster_info: Optional[Dict[str, Any]] = None
            if fetch_poster and not dry_run:
                poster_name, poster_info = self._fetch_video_poster(
                    os.path.basename(src), target_dir, log)
                if poster_name:
                    item["poster"] = poster_info
                    current["poster"] = poster_name

            # smart segmentation — split videos > 5 min into <5-min, subtitle-aligned
            # clips (cut from BOTH the tiny mp4 AND the mp3). Runs EVERY time so any
            # missing clip is (re)produced even when the .srt already exists; idempotent
            # (existing clips are skipped). mapping.json is always (re)written.
            seg_dir = os.path.join(target_dir, stem + "_segments")
            current["segments_dir"] = None
            tiny_mp4 = os.path.join(target_dir, stem + ".mp4")
            full_mp4 = os.path.join(target_dir, stem + ".full.mp4")
            mp3_path = os.path.join(target_dir, stem + ".mp3")
            if not vid_duration:
                vid_duration = _probe_duration(ffprobe, src)
            need_segments = (
                not dry_run
                and vid_duration > 300.0
                and os.path.isfile(srt_path) and os.path.getsize(srt_path) > 0
                and os.path.isfile(tiny_mp4) and os.path.getsize(tiny_mp4) > 0
                and os.path.isfile(mp3_path) and os.path.getsize(mp3_path) > 0
            )
            if need_segments:
                subs = _parse_srt_segments(srt_path)
                segments = plan_segments(subs, max_sec=300.0)
                if segments:
                    full_src = full_mp4 if (os.path.isfile(full_mp4)
                                            and os.path.getsize(full_mp4) > 0) else None
                    seg_stats = cut_segments(segments, tiny_mp4, mp3_path, seg_dir, ffmpeg,
                                             full_mp4=full_src, log=log, ffprobe=ffprobe)
                    self._write_segments_mapping(
                        seg_dir, src, root, stem, vid_duration, segments,
                        full_mp4=full_mp4, tiny_mp4=tiny_mp4, mp3_path=mp3_path,
                        srt_path=srt_path, original_name=os.path.basename(src),
                        poster_name=poster_name)
                    stats["seg_made"] += seg_stats.get("made", 0)
                    stats["seg_skip"] += seg_stats.get("skipped", 0)
                    current["segments_dir"] = seg_dir
                    item["segments_dir"] = seg_dir
                    log("    segments: %d clip(s) under %s_segments (made %d, skip %d)"
                        % (len(segments), stem, seg_stats.get("made", 0), seg_stats.get("skipped", 0)))
            elif (not dry_run and vid_duration > 300.0
                  and os.path.isfile(srt_path) and os.path.getsize(srt_path) > 0):
                # A >5-min video qualifies for segmentation but a required SOURCE is
                # absent. Clips are cut from BOTH the tiny mp4 AND the mp3, so if the
                # tiny mp4 was disabled or 'mp3' wasn't a selected format, surface WHY
                # no clips were produced instead of silently doing nothing.
                _missing = []
                if not (os.path.isfile(tiny_mp4) and os.path.getsize(tiny_mp4) > 0):
                    _missing.append("tiny mp4 (enable mp4 output)")
                if not (os.path.isfile(mp3_path) and os.path.getsize(mp3_path) > 0):
                    _missing.append("mp3 (add 'mp3' to Audio Formats)")
                if _missing:
                    log("    segments: SKIPPED for >5-min video — missing %s; no clips made."
                        % " and ".join(_missing))

            items.append(item)
            file_elapsed = time.time() - file_start
            current["file_elapsed"] = round(file_elapsed, 2)
            self._log_file_footer(log, idx, total, file_elapsed, time.time() - start_time)
            emit(idx, current)

        result = {
            "success": True,
            "mode": mode,
            "root": root,
            "output": output_dir,
            "total": total,
            "processed": stats["videos"],
            "stats": stats,
            "per_codec": per_codec,
            "items": items,
            "logs": logs[-60:],
            "dry_run": dry_run,
            "stopped": stopped(),
            "execution_time": time.time() - start_time,
            "message": f"Processed {stats['videos']}/{total} video(s).",
        }
        return result

    # ----- multi-root run (merged, de-duplicated across all paths) -------- #
    def run_many(self, configs_or_paths,
                 progress_cb: Optional[Callable[[int, Dict[str, Any]], None]] = None,
                 should_stop: Optional[Callable[[], bool]] = None,
                 should_pause: Optional[Callable[[], bool]] = None,
                 base_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Run over several paths as ONE merged, de-duplicated video set.

        `configs_or_paths` is a list whose items are either full config dicts or
        plain path strings. For strings, `base_config` (the shared non-path
        options) is merged in and the string becomes that config's `path`.

        All paths are scanned up front and merged into a single unique video list
        keyed by ``normcase(realpath(file))`` so a parent folder and its subfolder
        (or a folder and a file inside it) never process the same video twice.
        The merged set is then processed with ONE shared total/progress, while
        each file is still written under its own claiming root's output dir.
        """
        start_time = time.time()
        base_config = base_config or {}

        # Normalize items to per-root config dicts.
        configs: List[Dict[str, Any]] = []
        for item in (configs_or_paths or []):
            if isinstance(item, dict):
                configs.append(item)
            else:
                cfg = dict(base_config)
                cfg["path"] = item
                configs.append(cfg)

        n = len(configs)
        if n == 0:
            return {"success": False, "error": "no paths to process",
                    "execution_time": time.time() - start_time}

        # --- scan + merge + dedupe across ALL paths --------------------------
        # First config to claim a real-path owns the file (and its output dir).
        claimed: set = set()              # normcase(realpath) keys already taken
        per_root_videos: Dict[int, List[str]] = {ridx: [] for ridx in range(n)}
        roots: List[Dict[str, Any]] = []
        errors: List[str] = []
        raw_count = 0                     # total videos found before dedupe
        merged_total = 0                  # unique videos after dedupe

        for ridx, cfg in enumerate(configs):
            try:
                _root, _output_dir, videos, _mode = self._resolve_io(cfg)
            except ValueError as e:
                errors.append(f"{cfg.get('path')}: {e}")
                roots.append({"path": cfg.get("path"), "result": None})
                continue
            roots.append({"path": cfg.get("path"), "result": None})
            for src in videos:
                raw_count += 1
                key = os.path.normcase(os.path.realpath(src))
                if key in claimed:
                    continue
                claimed.add(key)
                per_root_videos[ridx].append(src)
                merged_total += 1

        deduped = raw_count - merged_total

        # Aggregated counters (mirror run()'s stats keys).
        agg_stats = {"videos": 0, "mp4_done": 0, "mp4_skip": 0, "mp4_fail": 0, "no_audio": 0,
                     "full_done": 0, "full_skip": 0, "full_fail": 0,
                     "srt_done": 0, "srt_skip": 0, "srt_fail": 0, "srt_empty": 0,
                     "seg_made": 0, "seg_skip": 0}
        agg_items: List[Dict[str, Any]] = []
        agg_logs: List[str] = []
        agg_processed = 0
        stopped = False

        # A header log line streamed via run()'s own ColorPrint isn't available
        # here, so emit it directly through ColorPrint and seed the agg log.
        merge_msg = (f"Merged {n} path(s) -> {merged_total} unique video(s) "
                     f"(deduped {deduped} overlapping)")
        ColorPrint.blue("[VideoExtract] " + merge_msg)
        agg_logs.append(merge_msg)

        # `base` accumulates how many unique videos finished in PRIOR roots, so the
        # overall progress/total reflects the single merged set (not per-root).
        base = 0
        for ridx, cfg in enumerate(configs):
            if should_stop and should_stop():
                stopped = True
                break
            videos = per_root_videos.get(ridx) or []
            if not videos:
                continue

            def _root_progress(pct, snapshot, _base=base):
                if not progress_cb:
                    return
                merged = dict(snapshot)
                # Re-base this root's per-root counters onto the merged set.
                merged["processed"] = _base + int(snapshot.get("processed", 0))
                merged["total"] = merged_total
                merged["root_index"] = ridx
                merged["root_count"] = n
                overall = int(merged["processed"] / merged_total * 100) if merged_total else 100
                progress_cb(overall, merged)

            res = self.run(cfg, progress_cb=_root_progress, should_stop=should_stop,
                           should_pause=should_pause, videos_override=videos)
            roots[ridx]["result"] = res

            if not res.get("success"):
                errors.append(f"{cfg.get('path')}: {res.get('error')}")
                continue

            for k in agg_stats:
                agg_stats[k] += int((res.get("stats") or {}).get(k, 0))
            agg_items.extend(res.get("items") or [])
            agg_logs.extend(res.get("logs") or [])
            agg_processed += int(res.get("processed", 0))
            base += len(videos)
            if res.get("stopped"):
                stopped = True
                break

        return {
            "success": len(errors) < n,
            "roots": roots,
            "total": merged_total,
            "raw_total": raw_count,
            "deduped": deduped,
            "processed": agg_processed,
            "stats": agg_stats,
            "items": agg_items[-200:],
            "logs": agg_logs[-120:],
            "errors": errors,
            "stopped": stopped,
            "execution_time": time.time() - start_time,
            "message": f"Processed {agg_processed}/{merged_total} unique video(s) across {n} path(s)"
                       + (f" (deduped {deduped})" if deduped else "") + "."
                       + (f" {len(errors)} path(s) failed." if errors else ""),
        }
