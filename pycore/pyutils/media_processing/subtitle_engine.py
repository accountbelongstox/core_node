# -*- coding: utf-8 -*-
"""
Subtitle engine - faster-whisper transcription, segment cutting, and mapping for
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

Imports srt_utils + media_processor + whisper_runtime (for _add_nvidia_dll_dirs);
no import back into the processors package otherwise (chain is one-directional).
"""

import json
import os
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# Module-level (hot path): transcribe_to_srt_faster + cut_segments call these per
# video/per segment - keep import overhead out of the per-call path.
from pycore.pyutils.media_processing.srt_utils import _srt_timestamp, _parse_srt_resume, _clip_label
from pycore.pyutils.media_processing.media_processor import media_processor
from pycore.pyutils.media_processing.whisper_runtime import _add_nvidia_dll_dirs


# ===========================================================================
# STT engine: faster-whisper (DEFAULT)
# ===========================================================================
def load_faster_whisper(model_name: str, device: str, compute_type: str):
    """Load a faster-whisper model once for reuse. Returns model or None."""
    _add_nvidia_dll_dirs()
    try:
        pass
    except Exception:
        ColorPrint.yellow(
            "[VideoExtract] faster-whisper not installed. "
            "Install it (scripts/shells/win/install_powershells/Step11_InstallFasterWhisper.ps1) or "
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


def _probe_duration(src: str) -> float:
    """Media duration in seconds via the shared FFprobe client."""
    return media_processor.duration(src)


def cut_segments(segments: List[Dict[str, Any]], tiny_mp4: str, mp3_path: str,
                 seg_dir: str, full_mp4: Optional[str] = None,
                 log=None) -> Dict[str, int]:
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
    full_has_audio = media_processor.has_audio_stream(full_mp4) if have_full else None

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

        def _error_detail(result):
            process = result.process
            return (process.stderr or result.error_code or "")[-600:] if process else (result.error_code or "")

        # mp4 clip (tiny -> accurate re-encode)
        mp4_result = media_processor.cut_video(
            tiny_mp4, mp4_out, start, dur, quality=30,
            audio_bitrate="32k", include_audio=True)
        if mp4_result.success:
            mp4_status = "skip" if mp4_result.skipped else "ok"
            stats["skipped" if mp4_result.skipped else "made"] += 1
        else:
            mp4_status = "fail"
            stats["failed"] += 1
            _emit("    seg %03d mp4 FAILED: %s" % (i, _error_detail(mp4_result)))

        # full clip (compressed full video -> accurate re-encode); only if available.
        # Use the DURATION form (-ss start -i -t dur) + explicit stream maps +
        # -pix_fmt yuv420p + stereo downmix for a robust cut. The full video may
        # carry a 5.1 (6-channel) AAC track that the encoder can't re-open as-is,
        # so force -ac 2 (or -an when there's no audio at all).
        if not have_full:
            full_status = "n/a"
        else:
            full_result = media_processor.cut_video(
                full_mp4, full_out, start, dur, quality=28,
                audio_bitrate="96k", include_audio=full_has_audio is not False)
            if full_result.success:
                full_status = "skip" if full_result.skipped else "ok"
                stats["skipped" if full_result.skipped else "made"] += 1
            else:
                full_status = "fail"
                stats["failed"] += 1
                _emit("    seg %03d full FAILED: %s" % (i, _error_detail(full_result)))

        # mp3 clip (stream copy, re-encode fallback)
        mp3_result = media_processor.cut_audio(
            mp3_path, mp3_out, start, dur, copy_stream=True)
        if mp3_result.success:
            mp3_status = "skip" if mp3_result.skipped else "ok"
            stats["skipped" if mp3_result.skipped else "made"] += 1
        else:
            mp3_result = media_processor.cut_audio(
                mp3_path, mp3_out, start, dur, copy_stream=False)
            if mp3_result.success:
                mp3_status = "skip" if mp3_result.skipped else "ok"
                stats["skipped" if mp3_result.skipped else "made"] += 1
            else:
                mp3_status = "fail"
                stats["failed"] += 1
                _emit("    seg %03d mp3 FAILED: %s" % (i, _error_detail(mp3_result)))

        _emit("    seg %03d/%02d [%s -> %s] mp4 %s / full %s / mp3 %s"
              % (i, n, _clip_label(start), _clip_label(end),
                 mp4_status, full_status, mp3_status))
    return stats


def transcribe_to_srt_faster(model, src: str, srt_path: str, language: str,
                             log=None, duration: float = 0.0,
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
    if resume_from > 0 and media_processor.available():
        # Resume: transcribe ONLY the remaining tail (don't redo the kept part).
        _emit(f"    [srt]: resuming from {_srt_timestamp(resume_from)} "
              f"(kept {start_index} segments)")
        temp_audio = srt_path + ".resume.wav"
        resume_result = media_processor.convert_pcm(
            src, temp_audio, sample_rate=16000, channels=1, start=resume_from)
        if resume_result.success:
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
