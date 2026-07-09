# -*- coding: utf-8 -*-
"""
Subtitle engine - faster-whisper engine + segment cutting + mapping.json for
the Video Extract feature.

Holds the faster-whisper STT engine (load_faster_whisper /
transcribe_to_srt_faster), the per-segment clip cutter (cut_segments), the
media duration probe (_probe_duration) and the mapping.json writer
(_write_segments_mapping, a module function).

transcribe_to_srt_faster + cut_segments run per-video/per-segment, so all
sibling imports are MODULE-LEVEL (not function-local) to keep per-call overhead
zero. load_faster_whisper/transcribe_to_srt_faster stay standalone here: the
SRT-with-resume contract (seek remaining audio, append offset-corrected
segments, keep partial .srt for next-run resume) does not fit
whisper_provider.WhisperSTTProvider, so they are intentionally NOT routed
through it.

Imports srt_utils + ffmpeg_ops + whisper_runtime (for _add_nvidia_dll_dirs);
no import back into the processors package otherwise (chain is one-directional).
"""

import json
import os
import subprocess
from typing import Any, Dict, List, Optional

from pycore import ColorPrint
# Module-level (hot path): transcribe_to_srt_faster + cut_segments call these per
# video/per segment - keep import overhead out of the per-call path.
from .srt_utils import _srt_timestamp, _parse_srt_resume, _clip_label
from .ffmpeg_ops import has_audio_stream, _run_ffmpeg
from .whisper_runtime import _add_nvidia_dll_dirs


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


def cut_segments(segments: List[Dict[str, Any]], tiny_mp4: str, mp3_path: str,
                 seg_dir: str, ffmpeg: str, full_mp4: Optional[str] = None,
                 log=None, ffprobe: Optional[str] = None) -> Dict[str, int]:
    """Cut each segment's [start, end] into THREE clips: the tiny 2x2 mp4, the
    compressed FULL video, and the mp3.

    Per segment (all idempotent - an existing clip with size>0 is skipped, missing
    ones are (re)generated):
      * ``seg_%03d.mp4``      from the TINY 2x2 mp4 (re-encoded for an accurate
                              seek - cheap at 2x2).
      * ``seg_%03d.full.mp4`` from the COMPRESSED FULL video (re-encoded
                              libx264 CRF 28 + AAC 96k for an accurate cut), ONLY
                              when ``full_mp4`` is given and exists. If it's
                              missing/None the full clip is skipped - the segment
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
        # faster-whisper transcribes LAZILY as segments are iterated - so emitting a
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
