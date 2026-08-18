# -*- coding: utf-8 -*-
"""
Video Extract Processor - reusable local video extraction workflow.

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
  * STT engine: **faster-whisper is the default** (see subtitle_engine).

SPLIT NOTE: the feature was decomposed into sibling sub-modules under this
package. This file is now the slim ORCHESTRATOR plus a FACADE: it re-exports the
public names sibling files already import from this path, so book_processor.py,
laravel_media_sync.py and video_extract_controller.py need NO import changes.
  * common/strtools/filename_sanitizer.py - ASCII filename transcoding.
  * ffmpeg_ops.py          - ffmpeg/ffprobe wrappers + codec constants
    (VIDEO_EXTENSIONS, CODECS, resolve_ffmpeg, ...).
  * whisper_runtime.py     - GPU detect + model/runtime resolution + UI caps
    (whisper_capabilities, resolve_whisper_runtime, ...).
  * srt_utils.py           - pure SRT parse/plan (_parse_srt_segments,
    _srt_time_to_sec, plan_segments, _count_srt_segments, ...).
  * subtitle_engine.py     - faster-whisper engine + segment cutting +
    mapping.json (load_faster_whisper, transcribe_to_srt_faster, cut_segments,
    _write_segments_mapping).
The import chain is one-directional (sub-modules never import back here).
"""

import json
import os
import time
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

# --- sub-module imports (one-directional; sub-modules never import back) ---- #
# Facade re-exports: the names below stay importable from THIS path so the
# sibling consumers (book_processor, laravel_media_sync, video_extract_controller)
# need no import changes.
from pycore.pyutils.common.strtools.filename_sanitizer import (  # re-exported
    sanitize_relpath,
    to_english_ascii,
    _load_backends,
)
from pycore.pyutils.media_processing.ffmpeg_ops import (  # VIDEO_EXTENSIONS re-exported
    VIDEO_EXTENSIONS,
    CODECS,
    resolve_ffmpeg,
    resolve_ffprobe,
    has_audio_stream,
    is_already_tiny_mp4,
    make_tiny_mp4,
    compress_full_video,
    extract_audio,
    _file_size,
    _mb,
)
from pycore.pyutils.media_processing.whisper_runtime import (  # whisper_capabilities re-exported
    resolve_whisper_runtime,
    detect_gpu_vram_mb,
    pick_whisper_model,
    clamp_model_to_installed,
    whisper_capabilities,
)
from pycore.pyutils.media_processing.srt_utils import (  # _parse_srt_segments, _srt_time_to_sec re-exported
    _parse_srt_segments,
    _srt_time_to_sec,
    plan_segments,
    _count_srt_segments,
)
from pycore.pyutils.media_processing.subtitle_engine import (
    load_faster_whisper,
    transcribe_to_srt_faster,
    _probe_duration,
    cut_segments,
    _write_segments_mapping,
)


def _format_duration(seconds: float) -> str:
    """Human elapsed time: 'Mm SSs' under an hour, 'Hh MMm SSs' from an hour up."""
    total = int(round(seconds))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return "%dh %02dm %02ds" % (h, m, s)
    return "%dm %02ds" % (m, s)


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
        # .srt (its PARENT dir holds files.* incl. the subtitle track) - used by
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
        # Subtitles are ALWAYS generated (at least one language) per requirement -
        # the .srt is idempotent and resumable, so this is safe to force on.
        want_subtitle = True
        dry_run = bool(config.get("dry_run"))
        sample_rate = int(config.get("sample_rate", 22050))
        mono = not bool(config.get("stereo"))
        bitrate_override = config.get("bitrate") or None
        # Subtitle language. faster-whisper rejects the literal 'auto' (and "") -
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
                # openai-whisper path is DISABLED (faster-whisper is the default;
                # see subtitle_engine.load_faster_whisper). Use faster-whisper.
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

            # compressed FULL-resolution video (idempotent) - a watchable
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

            # subtitle - ALWAYS generated; idempotent + RESUMABLE: a complete .srt is
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
                    log(f"    srt: written ({_count_srt_segments(srt_path)} segments)")
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
                log("    srt: SKIPPED - whisper engine failed to load")

            poster_name: Optional[str] = None

            # smart segmentation - split videos > 5 min into <5-min, subtitle-aligned
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
                    _write_segments_mapping(
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
                    log("    segments: SKIPPED for >5-min video - missing %s; no clips made."
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
