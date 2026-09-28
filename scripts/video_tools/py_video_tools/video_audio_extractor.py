#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
video_audio_extractor.py

Recursively scan a root folder for video files. For every video found:
  1. (optional) copy the source video into an output folder, and
  2. extract its audio track as a minimal-size MP3,
mirroring the original sub-directory structure under the output folder.

Behaviour:
  * The output folder is skipped while scanning (no infinite recursion / re-processing).
  * File / directory names that contain spaces or non-ASCII characters are
    sanitized to plain ASCII English:
        - spaces are removed entirely,
        - non-ASCII text is transliterated (or translated) to English.
    Transliteration / translation backends are tried in this order:
        translate (deep-translator, needs network, only with --translate)
        -> unidecode  -> pypinyin  -> built-in ASCII fallback.
    All backends are OPTIONAL; the script still runs (with a weaker fallback)
    when none are installed.
  * Idempotent: files that were already copied / extracted are skipped.

This module is normally launched by extract_audio.ps1 (via a relative path),
but it is fully usable on its own:

    python video_audio_extractor.py --root D:\\.tmp
"""

import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import unicodedata

# Make pycore importable so the HF cache path resolves via the centralized
# system_paths module (D:\www\cache on Windows, /var/_core_node on Linux) instead
# of a hardcoded home/cache path.
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)
from pycore.pyfoundations.system_paths import get_xdg_cache_home

# --------------------------------------------------------------------------- #
# Make stdout/stderr tolerant of non-ASCII paths on legacy Windows code pages. #
# --------------------------------------------------------------------------- #
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


# Common video container extensions (lower-case, with leading dot).
VIDEO_EXTENSIONS = {
    ".mp4", ".m4v", ".mkv", ".mov", ".avi", ".wmv", ".flv", ".webm",
    ".mpg", ".mpeg", ".mts", ".m2ts", ".ts", ".3gp", ".3g2", ".ogv",
    ".vob", ".rm", ".rmvb", ".asf", ".f4v", ".divx",
}

# Characters allowed verbatim in the final ASCII file/dir names.
_ALLOWED = set(
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789._-"
)

# Supported output audio codecs, ordered best-compression first.
# 'opus' (libopus) gives the smallest files at a given quality and is the default.
CODECS = {
    "opus":   {"encoder": "libopus",    "ext": ".opus", "default_bitrate": "24k"},
    "aac":    {"encoder": "aac",         "ext": ".m4a",  "default_bitrate": "32k"},
    "vorbis": {"encoder": "libvorbis",   "ext": ".ogg",  "default_bitrate": "48k"},
    "mp3":    {"encoder": "libmp3lame",  "ext": ".mp3",  "default_bitrate": "32k"},
}

# libopus only accepts these output sample rates; others must be snapped.
_OPUS_RATES = (8000, 12000, 16000, 24000, 48000)


def _format_duration(seconds):
    """Human elapsed time: 'Mm SSs' under an hour, 'Hh MMm SSs' from an hour up."""
    total = int(round(seconds))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return "%dh %02dm %02ds" % (h, m, s)
    return "%dm %02ds" % (m, s)


# --------------------------------------------------------------------------- #
# Optional transliteration / translation backends (loaded lazily & safely).   #
# --------------------------------------------------------------------------- #
def _load_backends(want_translate):
    """Probe optional libraries. Returns a dict describing what is available."""
    backends = {"translate": None, "unidecode": None, "pypinyin": None}

    if want_translate:
        try:
            from deep_translator import GoogleTranslator

            translator = GoogleTranslator(source="auto", target="en")

            def _translate(text):
                # deep-translator raises on empty / untranslatable input.
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


def _builtin_fallback(text):
    """
    Last-resort ASCII conversion using only the standard library.
    Normalizes accents away; any remaining non-ASCII run is replaced by a
    short, stable hash token so distinct names stay distinct and deterministic.
    """
    norm = unicodedata.normalize("NFKD", text)
    ascii_only = norm.encode("ascii", "ignore").decode("ascii")

    # Anything that survived as non-ASCII has been dropped above; if that
    # removed everything meaningful, fall back to a deterministic token.
    if not re.search(r"[A-Za-z0-9]", ascii_only):
        token = hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]
        return "u_" + token
    return ascii_only


def to_english_ascii(text, backends):
    """Convert an arbitrary text fragment to an ASCII, space-free English form."""
    if text is None:
        return ""

    # Already plain ASCII -> only strip spaces later, no transliteration needed.
    if all(ord(ch) < 128 for ch in text):
        converted = text
    else:
        converted = None
        # 1) translation (best readability, needs network)
        if backends.get("translate"):
            try:
                result = backends["translate"](text)
                if result and result.strip():
                    converted = result
            except Exception:
                converted = None
        # 2) unidecode
        if converted is None and backends.get("unidecode"):
            try:
                converted = backends["unidecode"](text)
            except Exception:
                converted = None
        # 3) pypinyin (CJK)
        if converted is None and backends.get("pypinyin"):
            try:
                converted = backends["pypinyin"](text)
            except Exception:
                converted = None
        # 4) stdlib fallback
        if converted is None or not converted.strip():
            converted = _builtin_fallback(text)

    return _clean_token(converted)


def _clean_token(text):
    """
    Final clean-up of one path component:
      * remove ALL spaces / whitespace,
      * replace any remaining disallowed char with '_',
      * collapse repeats and trim separators.
    """
    text = re.sub(r"\s+", "", text)  # remove every space (per spec)
    text = "".join(ch if ch in _ALLOWED else "_" for ch in text)
    text = re.sub(r"_{2,}", "_", text).strip("_.")
    return text


def sanitize_relpath(rel_path, backends):
    """Sanitize each component of a relative path; returns (dir_parts, stem, ext)."""
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
# ffmpeg helpers                                                              #
# --------------------------------------------------------------------------- #
def resolve_ffmpeg(explicit):
    """Locate ffmpeg; return its path or None."""
    if explicit and os.path.isfile(explicit):
        return explicit
    found = shutil.which("ffmpeg")
    return found


def resolve_ffprobe(ffmpeg):
    """Locate ffprobe (ships next to ffmpeg); return its path or None."""
    if ffmpeg:
        exe = "ffprobe.exe" if os.name == "nt" else "ffprobe"
        cand = os.path.join(os.path.dirname(ffmpeg), exe)
        if os.path.isfile(cand):
            return cand
    return shutil.which("ffprobe")


def has_audio_stream(ffprobe, src):
    """Return True/False if the file has an audio stream, or None if unknown."""
    if not ffprobe:
        return None  # cannot tell -> let ffmpeg try anyway
    try:
        out = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "a",
             "-show_entries", "stream=index", "-of", "csv=p=0", src],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        return bool((out.stdout or "").strip())
    except Exception:
        return None


def ffmpeg_version(ffmpeg):
    try:
        out = subprocess.run(
            [ffmpeg, "-version"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        first = (out.stdout or out.stderr or "").splitlines()
        return first[0].strip() if first else "(unknown)"
    except Exception as exc:
        return "(error: %s)" % exc


def _run_ffmpeg_live(cmd, dst):
    """
    Run ffmpeg with its output streamed LIVE to the console (no capture), so the
    user sees the -stats progress line in real time. Returns True on success.
    """
    sys.stdout.flush()
    sys.stderr.flush()
    proc = subprocess.run(cmd)         # inherits stdout/stderr -> live output
    if proc.returncode != 0:
        if os.path.isfile(dst) and os.path.getsize(dst) == 0:
            try:
                os.remove(dst)
            except OSError:
                pass
        return False
    return os.path.isfile(dst) and os.path.getsize(dst) > 0


def extract_audio(ffmpeg, src, dst, encoder, bitrate, sample_rate, mono):
    """Run ffmpeg to extract a minimal-size audio file. Returns True on success."""
    # Opus only supports a fixed set of sample rates; snap to the nearest one.
    ar = sample_rate
    if encoder == "libopus":
        ar = min(_OPUS_RATES, key=lambda r: abs(r - sample_rate))

    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "warning", "-stats", "-y",
        "-i", src,
        "-vn",                       # drop video
        "-map", "a:0?",              # first audio stream if present
        "-ac", "1" if mono else "2",
        "-ar", str(ar),
        "-c:a", encoder,
        "-b:a", bitrate,
        dst,                         # container inferred from extension
    ]
    return _run_ffmpeg_live(cmd, dst)


def is_already_tiny_mp4(ffprobe, path, src):
    """
    True only if `path` is already our compressed tiny mp4 (so it is safe to
    skip). A leftover full-size *copy* of the source returns False so it gets
    re-processed instead of skipped.
    """
    # Preferred check: our tiny mp4 always has a ~2x2 video stream.
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
    # Fallback (no ffprobe): a real copy is roughly the source size; the tiny
    # mp4 is a small fraction of it.
    try:
        return os.path.getsize(path) < max(64 * 1024, os.path.getsize(src) * 0.5)
    except OSError:
        return False


def make_tiny_mp4(ffmpeg, src, dst, bitrate, sample_rate, mono):
    """
    Produce a minimal but valid AI-acceptable MP4: a 2x2 black H.264 video
    (essentially "no video") muxed with the source audio (AAC). The video
    track is crushed to nothing (CRF 51, 1 fps, 2x2 px) so the file size is
    dominated by the small audio bitrate. Returns True on success.

    2x2 is used instead of 1x1 because H.264 / yuv420p requires even
    dimensions; 1x1 is rejected by the encoder.
    """
    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "warning", "-stats", "-y",
        "-i", src,
        "-f", "lavfi", "-i", "color=c=black:s=2x2:r=1",
        "-map", "1:v:0",             # tiny synthetic video
        "-map", "0:a:0",             # real audio from the source
        "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage",
        "-crf", "51", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", bitrate,
        "-ac", "1" if mono else "2", "-ar", str(sample_rate),
        "-shortest", "-movflags", "+faststart",
        dst,
    ]
    return _run_ffmpeg_live(cmd, dst)


# --------------------------------------------------------------------------- #
# Subtitles (optional, via faster-whisper)                                    #
# --------------------------------------------------------------------------- #
def has_nvidia_gpu():
    """Return True if a usable NVIDIA GPU is available for CTranslate2/whisper."""
    # Most reliable: ask CTranslate2 (the engine faster-whisper actually uses).
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return True
    except Exception:
        pass
    # Fallback: nvidia-smi present and exits cleanly.
    exe = shutil.which("nvidia-smi")
    if exe:
        try:
            return subprocess.run([exe], capture_output=True).returncode == 0
        except Exception:
            pass
    return False


def resolve_whisper_runtime(device, compute_type):
    """Resolve 'auto' device/compute into concrete values based on GPU presence."""
    if device == "auto":
        device = "cuda" if has_nvidia_gpu() else "cpu"
    if compute_type == "auto":
        compute_type = "float16" if device == "cuda" else "int8"
    return device, compute_type


def detect_gpu_vram_mb():
    """Total VRAM of the largest NVIDIA GPU in MiB, or 0 if unknown."""
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


def pick_whisper_model(device, vram_mb):
    """
    Choose a whisper model from the hardware, biased a bit larger for quality.
    VRAM needs (approx, float16): tiny/base ~1GB, small ~2GB, medium ~5GB,
    turbo ~6GB (near large-v3 accuracy, fast), large-v3 ~10GB.
    """
    if device == "cuda":
        if vram_mb >= 10000:
            return "large-v3"
        if vram_mb >= 6000:
            return "turbo"          # near-large accuracy, fits 8GB cards
        if vram_mb >= 4000:
            return "medium"
        if vram_mb >= 2500:
            return "small"
        return "base"
    # CPU: 'small' is a good quality/speed balance (CPU inference is slow, so a
    # larger model would be impractically slow for batch use).
    return "small"


def _add_nvidia_dll_dirs():
    """
    On Windows, make the pip-installed cuBLAS/cuDNN DLLs discoverable so
    CTranslate2 can use the GPU (they live under site-packages\\nvidia\\*\\bin).
    No-op on non-Windows or when the libs are absent.
    """
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


def _hf_cache_dir():
    """Resolve the Hugging Face hub cache directory."""
    if os.environ.get("HF_HUB_CACHE"):
        return os.environ["HF_HUB_CACHE"]
    if os.environ.get("HF_HOME"):
        return os.path.join(os.environ["HF_HOME"], "hub")
    # Centralized cache root (respects XDG_CACHE_HOME / CORE_NODE_CACHE_DIR;
    # D:\www\cache on Windows, /var/_core_node/cache on Linux) - see system_paths.
    return str(get_xdg_cache_home() / "huggingface" / "hub")


def _path_size_mb(path):
    """Total size (MiB) of all files under `path`."""
    total = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            try:
                total += os.path.getsize(os.path.join(root, name))
            except OSError:
                pass
    return total / (1024.0 * 1024.0)


def _has_incomplete(path):
    """True if any partial-download (*.incomplete) files exist under `path`."""
    for _root, _dirs, files in os.walk(path):
        for name in files:
            if name.endswith(".incomplete"):
                return True
    return False


def _mask_token(tok):
    """Show only the ends of a secret, e.g. 'hf_Xaq...johO'."""
    if not tok:
        return "(none)"
    if len(tok) <= 12:
        return tok[:3] + "..."
    return tok[:6] + "..." + tok[-4:]


def whisper_repo_and_cache(model_name):
    """
    Resolve a model name to its HF repo + local cache dir and whether it is fully
    cached. Does NOT download anything (installation/download is the launcher's
    job). Returns (repo_or_None, repo_dir_or_None, is_complete_bool).
    """
    repo = None
    try:
        from faster_whisper.utils import _MODELS
        repo = _MODELS.get(model_name)
    except Exception:
        repo = None
    if not repo:
        return None, None, False
    repo_dir = os.path.join(_hf_cache_dir(), "models--" + repo.replace("/", "--"))
    complete = (os.path.isdir(os.path.join(repo_dir, "snapshots"))
                and not _has_incomplete(repo_dir))
    return repo, repo_dir, complete


class _DownloadProgress(threading.Thread):
    """
    Background thread that prints how many MB of a model repo have landed in the
    HF cache, so download progress is visible even when the hf_xet/tqdm bar stays
    silent. Polls the cache dir every few seconds until stopped.
    """
    def __init__(self, repo):
        super().__init__(daemon=True)
        self.repo_dir = os.path.join(_hf_cache_dir(), "models--" + repo.replace("/", "--"))
        # NOTE: do NOT name this '_stop' - that shadows threading.Thread._stop()
        # and makes join() raise "'Event' object is not callable".
        self._cancel = threading.Event()

    def run(self):
        last = -1.0
        while not self._cancel.is_set():
            mb = _path_size_mb(self.repo_dir) if os.path.isdir(self.repo_dir) else 0.0
            if mb - last >= 1.0:
                print("    [model] downloading ... %.0f MB so far" % mb, flush=True)
                last = mb
            self._cancel.wait(3.0)

    def stop(self):
        self._cancel.set()
        self.join(timeout=2)


def load_whisper(model_name, device, compute_type):
    """
    Load a faster-whisper model once for reuse. Returns the model, or None
    (printing guidance) if the library is missing. Falls back to CPU/int8 if a
    requested GPU load fails (e.g. missing CUDA/cuDNN). Prints repo/cache info
    and live download progress so a slow first-time download is not silent.
    """
    _add_nvidia_dll_dirs()
    try:
        from faster_whisper import WhisperModel
    except Exception:
        sys.stderr.write(
            "[!] Subtitles requested but 'faster-whisper' is NOT installed.\n"
            "    Install it:  pip install faster-whisper\n"
            "    or re-run the launcher (it auto-installs by default).\n")
        return None

    # Resolve the HF repo and report cache state + live progress.
    repo = None
    try:
        from faster_whisper.utils import _MODELS
        repo = _MODELS.get(model_name)
    except Exception:
        repo = None

    monitor = None
    if repo:
        repo_dir = os.path.join(_hf_cache_dir(), "models--" + repo.replace("/", "--"))
        # "Complete" only if a snapshot exists AND there are no partial blobs.
        complete = (os.path.isdir(os.path.join(repo_dir, "snapshots"))
                    and not _has_incomplete(repo_dir))
        print("    [model] repo  : %s" % repo, flush=True)
        print("    [model] cache : %s" % repo_dir, flush=True)
        if complete:
            print("    [model] found in cache (%.0f MB)." % _path_size_mb(repo_dir), flush=True)
        else:
            tok = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
            print("    [model] downloading from HuggingFace (resuming if partial).", flush=True)
            if tok:
                print("    [model] HF_TOKEN=%s -> authenticated download." % _mask_token(tok), flush=True)
            else:
                print("    [model] HF_TOKEN not set -> unauthenticated (slower); "
                      "set it to speed up.", flush=True)
            monitor = _DownloadProgress(repo)
            monitor.start()

    model = None
    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
    except Exception as exc:
        sys.stderr.write("[!] Failed to load whisper on %s/%s: %s\n"
                         % (device, compute_type, exc))
        if device != "cpu":
            sys.stderr.write("[!] Falling back to CPU (int8).\n")
            try:
                model = WhisperModel(model_name, device="cpu", compute_type="int8")
            except Exception as exc2:
                sys.stderr.write("[!] CPU load also failed: %s\n" % exc2)
    finally:
        if monitor:
            monitor.stop()

    if model is not None:
        print("    [model] loaded and ready.", flush=True)
    return model


def _srt_timestamp(seconds):
    """Format seconds as an SRT timestamp HH:MM:SS,mmm."""
    if seconds < 0:
        seconds = 0
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return "%02d:%02d:%02d,%03d" % (h, m, s, ms)


def transcribe_to_srt(model, src, srt_path, language):
    """
    Transcribe `src` audio and write an SRT subtitle file, printing each segment
    in real time as it is decoded (the segments object is a lazy generator).
    Returns: True -> written, False -> error, None -> no speech segments.
    """
    try:
        segments, info = model.transcribe(
            src,
            language=(language or None),   # None => auto-detect
            vad_filter=True,               # skip long silences -> cleaner timing
            word_timestamps=False,
        )
        total = float(getattr(info, "duration", 0) or 0)
        det_lang = getattr(info, "language", None)
        det_prob = getattr(info, "language_probability", None)
        if det_lang:
            print("    [srt]   language=%s%s, duration=%.0fs" % (
                det_lang,
                (" (%.0f%%)" % (det_prob * 100)) if det_prob else "",
                total), flush=True)

        idx = 0
        # Write incrementally so progress is saved and visible live.
        with open(srt_path, "w", encoding="utf-8") as fh:
            for seg in segments:           # <-- decoding happens here, lazily
                text = (seg.text or "").strip()
                if not text:
                    continue
                idx += 1
                fh.write("%d\n%s --> %s\n%s\n\n" % (
                    idx, _srt_timestamp(seg.start), _srt_timestamp(seg.end), text))
                fh.flush()
                pct = ("%5.1f%%" % (min(seg.end, total) / total * 100)) if total else "  -  "
                snippet = text if len(text) <= 60 else text[:57] + "..."
                print("    [srt]   %s [%s -> %s] %s"
                      % (pct, _srt_timestamp(seg.start), _srt_timestamp(seg.end), snippet),
                      flush=True)

        if idx == 0:
            try:
                os.remove(srt_path)
            except OSError:
                pass
            return None
        return True
    except Exception as exc:
        sys.stderr.write("    [srt]   error: %s\n" % exc)
        if os.path.isfile(srt_path) and os.path.getsize(srt_path) == 0:
            try:
                os.remove(srt_path)
            except OSError:
                pass
        return False


# --------------------------------------------------------------------------- #
# Scanning                                                                    #
# --------------------------------------------------------------------------- #
def iter_videos(root, output_dir):
    """Yield absolute paths of video files under root, skipping output_dir."""
    output_abs = os.path.normcase(os.path.abspath(output_dir))
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune the output directory so we never scan our own results.
        dirnames[:] = [
            d for d in dirnames
            if os.path.normcase(os.path.abspath(os.path.join(dirpath, d))) != output_abs
        ]
        for name in filenames:
            if os.path.splitext(name)[1].lower() in VIDEO_EXTENSIONS:
                yield os.path.join(dirpath, name)


def unique_path(path, planned):
    """Avoid collisions inside a single run by appending _2, _3, ... if needed."""
    if path not in planned and not os.path.exists(path):
        planned.add(path)
        return path
    stem, ext = os.path.splitext(path)
    i = 2
    while True:
        cand = "%s_%d%s" % (stem, i, ext)
        if cand not in planned and not os.path.exists(cand):
            planned.add(cand)
            return cand
        i += 1


# --------------------------------------------------------------------------- #
# Main                                                                        #
# --------------------------------------------------------------------------- #
def main():
    parser = argparse.ArgumentParser(
        description="Copy videos and extract minimal-size audio, "
                    "mirroring sub-paths into an output folder. "
                    "Default codec is opus (best compression)."
    )
    parser.add_argument("--root", default="", help="Source root folder to scan (required unless --whisper-info).")
    parser.add_argument("--output", default="", help="Output folder. Default: <root>\\_compressed_result")
    parser.add_argument("--ffmpeg", default="", help="Path to ffmpeg executable.")
    parser.add_argument("--codecs", default="mp3",
                        help="Comma-separated audio formats to also extract. "
                             "Default: mp3 only. Others (opus,aac,vorbis) are "
                             "supported but skipped unless requested. Each format "
                             "is skipped if it already exists.")
    parser.add_argument("--bitrate", default="", help="Audio bitrate. Default: codec-specific small value.")
    parser.add_argument("--sample-rate", type=int, default=22050, help="Audio sample rate (default 22050).")
    parser.add_argument("--stereo", action="store_true", help="Keep stereo (default is mono = smaller).")
    parser.add_argument("--no-mp4", action="store_true",
                        help="Do not create the tiny AI-acceptable MP4 (audio + 2x2 video).")
    parser.add_argument("--subtitle", action="store_true",
                        help="Also generate an .srt subtitle via faster-whisper (speech-to-text).")
    parser.add_argument("--lang", default="en",
                        help="Subtitle language code (e.g. en, ja, zh). Default: en. Use 'auto' to detect.")
    parser.add_argument("--whisper-model", default="turbo",
                        help="faster-whisper model: turbo/auto/tiny/base/small/medium/large-v3 (default turbo).")
    parser.add_argument("--whisper-device", default="auto",
                        help="whisper device: auto/cpu/cuda. Default auto = use NVIDIA GPU if available.")
    parser.add_argument("--whisper-compute", default="auto",
                        help="whisper compute type: auto/int8/float16/... Default auto (float16 on GPU, int8 on CPU).")
    parser.add_argument("--whisper-info", action="store_true",
                        help="Resolve and print the effective whisper model/repo/cache state, then exit "
                             "(used by the launcher to decide what to install/download). Downloads nothing.")
    parser.add_argument("--translate", action="store_true",
                        help="Translate non-ASCII names to English via deep-translator (needs network).")
    parser.add_argument("--dry-run", action="store_true", help="Show planned actions without writing files.")
    args = parser.parse_args()

    # Lightweight reporter: resolve the effective model and report cache state so
    # the launcher can install/download it. No root/ffmpeg needed; downloads nothing.
    if args.whisper_info:
        wdevice, _wc = resolve_whisper_runtime(args.whisper_device, args.whisper_compute)
        wmodel = (pick_whisper_model(wdevice, detect_gpu_vram_mb())
                  if args.whisper_model == "auto" else args.whisper_model)
        repo, _repo_dir, cached = whisper_repo_and_cache(wmodel)
        print("model=%s" % wmodel)
        print("repo=%s" % (repo or ""))
        print("device=%s" % wdevice)
        print("cached=%s" % ("yes" if cached else "no"))
        return 0

    if not args.root:
        sys.stderr.write("[ERROR] --root is required (unless --whisper-info).\n")
        return 2
    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        sys.stderr.write("[ERROR] Root folder does not exist: %s\n" % root)
        return 2

    output_dir = os.path.abspath(args.output) if args.output else os.path.join(root, "_compressed_result")

    ffmpeg = resolve_ffmpeg(args.ffmpeg)
    if not ffmpeg:
        sys.stderr.write("[ERROR] ffmpeg not found on PATH. Install it or pass --ffmpeg <path>.\n")
        return 3
    ffprobe = resolve_ffprobe(ffmpeg)

    backends = _load_backends(args.translate)

    # Parse and validate the requested codec list (order preserved, de-duplicated).
    codecs = []
    for c in args.codecs.split(","):
        c = c.strip().lower()
        if not c:
            continue
        if c not in CODECS:
            sys.stderr.write("[ERROR] Unknown codec '%s'. Allowed: %s\n"
                             % (c, ", ".join(sorted(CODECS.keys()))))
            return 4
        if c not in codecs:
            codecs.append(c)
    if not codecs:
        sys.stderr.write("[ERROR] No codecs requested.\n")
        return 4

    print("=" * 64)
    print("Video Audio Extractor")
    print("  root      : %s" % root)
    print("  output    : %s" % output_dir)
    print("  ffmpeg    : %s  (%s)" % (ffmpeg, ffmpeg_version(ffmpeg)))
    print("  ffprobe   : %s" % (ffprobe if ffprobe else "(not found - silent videos can't be pre-skipped)"))
    fmt_desc = ", ".join(
        "%s/%s" % (c, (args.bitrate or CODECS[c]["default_bitrate"])) for c in codecs)
    print("  ai mp4    : %s (tiny 2x2 H.264 video + AAC audio)"
          % ("no" if args.no_mp4 else "yes"))
    print("  audio fmt : %s   (default: mp3 only; opus/aac/vorbis optional)" % fmt_desc)
    print("  audio     : %s Hz, %s" % (args.sample_rate, "stereo" if args.stereo else "mono"))
    naming = ("translate" if backends["translate"] else
              "unidecode" if backends["unidecode"] else
              "pypinyin" if backends["pypinyin"] else
              "builtin-ascii-fallback")
    print("  rename via: %s" % naming)
    wdevice, wcompute, wmodel = (args.whisper_device, args.whisper_compute, args.whisper_model)
    if args.subtitle:
        wdevice, wcompute = resolve_whisper_runtime(args.whisper_device, args.whisper_compute)
        vram = detect_gpu_vram_mb()
        # Auto-pick the model from hardware (biased a bit larger for quality).
        if wmodel == "auto":
            wmodel = pick_whisper_model(wdevice, vram)
        gpu_note = ("GPU %d MiB" % vram) if wdevice == "cuda" else "CPU (no NVIDIA GPU)"
        reason = "auto" if args.whisper_model == "auto" else "requested"
        print("  subtitle  : .srt via faster-whisper", flush=True)
        print("              system=%s/%s, %s" % (wdevice, wcompute, gpu_note), flush=True)
        print("              model=%s (%s), lang=%s" % (wmodel, reason, args.lang or "auto"), flush=True)
    if args.dry_run:
        print("  MODE      : DRY RUN (no files written)")
    print("=" * 64, flush=True)

    # Load the speech-to-text model once (reused for all videos).
    whisper_model = None
    if args.subtitle and not args.dry_run:
        print("[..] Loading whisper model '%s' on %s (first run downloads it) ..."
              % (wmodel, wdevice), flush=True)
        whisper_model = load_whisper(wmodel, wdevice, wcompute)
        if whisper_model is None:
            print("[!] Subtitles disabled for this run.", flush=True)

    if not args.dry_run:
        os.makedirs(output_dir, exist_ok=True)

    planned = set()
    stats = {"videos": 0, "mp4_done": 0, "mp4_skip": 0, "mp4_fail": 0, "no_audio": 0,
             "srt_done": 0, "srt_skip": 0, "srt_fail": 0, "srt_empty": 0}
    # Per-codec tallies and a count of how often each codec produced the smallest file.
    per_codec = {c: {"done": 0, "skip": 0, "fail": 0} for c in codecs}
    smallest_wins = {c: 0 for c in codecs}

    # Collect all videos up front so overall progress (i/N) can be shown.
    print("[..] Scanning for videos ...", flush=True)
    videos = list(iter_videos(root, output_dir))
    total = len(videos)
    print("[i] %d video(s) to process." % total, flush=True)
    run_start = time.perf_counter()

    for idx, src in enumerate(videos, 1):
        video_start = time.perf_counter()
        stats["videos"] += 1
        rel = os.path.relpath(src, root)
        dir_parts, stem, _src_ext = sanitize_relpath(rel, backends)
        src_ext = os.path.splitext(src)[1].lower()

        target_dir = os.path.join(output_dir, *dir_parts) if dir_parts else output_dir
        mp4_path = os.path.join(target_dir, stem + ".mp4")

        # Relative path after ASCII transcoding (dirs + stem), for comparison.
        clean_rel = os.path.join(*(dir_parts + [stem])) if dir_parts else stem

        print("\n- [%d/%d] src  : %s" % (idx, total, rel), flush=True)
        if clean_rel != os.path.splitext(rel)[0]:
            print("  ascii: %s" % clean_rel, flush=True)

        if not args.dry_run:
            os.makedirs(target_dir, exist_ok=True)

        # --- skip videos that have no audio track ------------------------ #
        # (a tiny mp4 / audio file would carry nothing useful for AI use).
        if has_audio_stream(ffprobe, src) is False:
            stats["no_audio"] += 1
            print("    [skip]  no audio track")
            print("    [time]  this video: %s | total elapsed: %s (%d/%d)"
                  % (_format_duration(time.perf_counter() - video_start),
                     _format_duration(time.perf_counter() - run_start), idx, total), flush=True)
            continue

        # --- tiny AI-acceptable MP4: real audio + 2x2 dummy video -------- #
        # An existing mp4 is only skipped if it is ALREADY the compressed tiny
        # version; a leftover full-size copy is re-processed (compressed) instead.
        if not args.no_mp4:
            exists = os.path.isfile(mp4_path) and os.path.getsize(mp4_path) > 0
            if exists and is_already_tiny_mp4(ffprobe, mp4_path, src):
                stats["mp4_skip"] += 1
                print("    [mp4]   skip (already tiny, %.0f KB)" % (os.path.getsize(mp4_path) / 1024.0))
            elif args.dry_run:
                if exists:
                    print("    [mp4]   would RE-COMPRESS (existing is not tiny, %.0f KB)"
                          % (os.path.getsize(mp4_path) / 1024.0))
                else:
                    print("    [mp4]   would create tiny ai-mp4")
            else:
                if exists:
                    print("    [mp4]   re-compressing (existing %.0f KB is uncompressed)"
                          % (os.path.getsize(mp4_path) / 1024.0))
                mp4_bitrate = args.bitrate or CODECS["aac"]["default_bitrate"]
                ok = make_tiny_mp4(ffmpeg, src, mp4_path, mp4_bitrate,
                                   args.sample_rate, not args.stereo)
                if ok:
                    stats["mp4_done"] += 1
                    print("    [mp4]   created (%.0f KB)" % (os.path.getsize(mp4_path) / 1024.0))
                else:
                    stats["mp4_fail"] += 1
                    print("    [mp4]   FAILED")

        # --- extract one file per codec (idempotent, then compare) ------- #
        sizes = {}  # codec -> size in bytes (existing or freshly produced)
        for c in codecs:
            info = CODECS[c]
            audio_path = os.path.join(target_dir, stem + info["ext"])
            bitrate = args.bitrate or info["default_bitrate"]

            if os.path.isfile(audio_path) and os.path.getsize(audio_path) > 0:
                per_codec[c]["skip"] += 1
                sizes[c] = os.path.getsize(audio_path)
                print("    [%-6s] skip (exists, %.0f KB)" % (c, sizes[c] / 1024.0))
            elif args.dry_run:
                print("    [%-6s] would extract %s" % (c, info["ext"]))
            else:
                ok = extract_audio(ffmpeg, src, audio_path, info["encoder"],
                                   bitrate, args.sample_rate, not args.stereo)
                if ok:
                    per_codec[c]["done"] += 1
                    sizes[c] = os.path.getsize(audio_path)
                    print("    [%-6s] extracted %s (%.0f KB)" % (c, info["ext"], sizes[c] / 1024.0))
                else:
                    per_codec[c]["fail"] += 1
                    print("    [%-6s] FAILED (no audio stream or ffmpeg error)" % c)

        # --- size comparison for this video (only when >1 format) -------- #
        if sizes:
            ordered = sorted(sizes.items(), key=lambda kv: kv[1])
            best_codec = ordered[0][0]
            smallest_wins[best_codec] += 1
            if len(sizes) > 1:
                cmp = " | ".join("%s %.0fKB" % (c, b / 1024.0) for c, b in ordered)
                print("    [compare] %s  (smallest: %s)" % (cmp, best_codec))

        # --- subtitles via faster-whisper (idempotent) ------------------- #
        if args.subtitle and whisper_model is not None:
            srt_path = os.path.join(target_dir, stem + ".srt")
            if os.path.isfile(srt_path) and os.path.getsize(srt_path) > 0:
                stats["srt_skip"] += 1
                print("    [srt]   skip (exists)")
            else:
                print("    [srt]   transcribing ...")
                res = transcribe_to_srt(whisper_model, src, srt_path, args.lang)
                if res is True:
                    stats["srt_done"] += 1
                    print("    [srt]   written %s" % os.path.relpath(srt_path, output_dir))
                elif res is None:
                    stats["srt_empty"] += 1
                    print("    [srt]   no speech detected")
                else:
                    stats["srt_fail"] += 1
                    print("    [srt]   FAILED")
        elif args.subtitle and args.dry_run:
            print("    [srt]   would transcribe -> %s.srt" % stem)

        # Per-video elapsed + running total across all videos.
        print("    [time]  this video: %s | total elapsed: %s (%d/%d)"
              % (_format_duration(time.perf_counter() - video_start),
                 _format_duration(time.perf_counter() - run_start), idx, total), flush=True)

    total_elapsed = time.perf_counter() - run_start
    print("\n" + "=" * 64)
    print("Done. videos=%d (%d had no audio) | ai-mp4: %d new, %d skipped, %d failed" %
          (stats["videos"], stats["no_audio"],
           stats["mp4_done"], stats["mp4_skip"], stats["mp4_fail"]))
    multi = len(codecs) > 1
    for c in codecs:
        pc = per_codec[c]
        tail = (" | smallest in %d file(s)" % smallest_wins[c]) if multi else ""
        print("  %-6s : %d new, %d skipped, %d failed%s"
              % (c, pc["done"], pc["skip"], pc["fail"], tail))
    if multi and any(smallest_wins.values()):
        overall = max(smallest_wins, key=lambda c: smallest_wins[c])
        print("  => best overall compression: %s" % overall)
    if args.subtitle:
        print("  srt    : %d written, %d skipped, %d empty, %d failed"
              % (stats["srt_done"], stats["srt_skip"], stats["srt_empty"], stats["srt_fail"]))
    print("  total time: %s" % _format_duration(total_elapsed))
    print("Output: %s" % output_dir)
    print("=" * 64)
    return 0


if __name__ == "__main__":
    sys.exit(main())
