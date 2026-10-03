# -*- coding: utf-8 -*-
"""Video Extract application service over the processor and task layer."""

import functools
import os
import platform
import shutil
import subprocess
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.network_constants import NVIDIA_SMI_TIMEOUT_SECONDS
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_RESOURCES_TTL_SECONDS,
    STATUS_SNAPSHOT_SYSTEM_RESOURCES_KEY,
    status_snapshot_cache,
)
import pycore.pyfoundations.system_launcher as system_launcher
from pycore.pyutils.media_processing.video_extract_processor import VideoExtractProcessor
from pycore.pyutils.media_processing.whisper_runtime import whisper_capabilities
from pycore.pyutils.common.ffmpeg.ffmpeg_constants import AUDIO_CODECS, VIDEO_EXTENSIONS
# v3 multi-language subtitle correspondence view (SAME slot builders the ingest
# sync uses - bilingual cue split + multi-track time-overlap alignment). The read
# path and sync share ONE builder; no duplicated alignment logic here.
from pycore.pyctl.laravel.sync.media_sync_helpers import _read_text as _read_srt_text
from pycore.pyctl.laravel.sync.subtitle_payload import build_subtitle_segment_view
from pycore.pyctl.desktop.video_extract_models import (
    VideoExtractRequest,
    VideoExtractStartResponse,
    VideoExtractPreviewResponse,
    VideoExtractOpenRequest,
    VideoExtractOpenResponse,
    VideoExtractSegmentsRequest,
    VideoExtractSegmentsResponse,
)
from pycore.pyctl.runtime.user_data_service import user_data_service
from pycore.pyctl.desktop.task_manager import task_manager
from pycore.pyfoundations.tasks import TaskStatus
from pycore.pyfoundations.third_party.api import get_third_package_psutil
from pycore.pyfoundations.pygvar import IS_WINDOWS




# Common, broadly-useful container/video extensions offered as the default
# selection in the UI (intersected with the processor's actually-supported set).
_DEFAULT_EXTENSIONS = [".mp4", ".mkv", ".mov", ".avi", ".flv", ".webm", ".ts", ".m4v"]

# kinds that name a FILE to open with its default app vs. a FOLDER to reveal.
_OPEN_FILE_KINDS = {"file", "subtitle"}
_OPEN_DIR_KINDS = {"file_dir", "file_output_dir", "output"}
# Only media and subtitle files are handed to the OS default handler; any other
# file type (scripts, executables, launchers, documents) is never shell-executed.
_OPEN_SUBTITLE_EXTENSIONS = {".srt", ".vtt", ".ass", ".ssa"}
_OPEN_FILE_EXTENSIONS = (
    set(VIDEO_EXTENSIONS)
    | {str(codec["extension"]) for codec in AUDIO_CODECS.values()}
    | _OPEN_SUBTITLE_EXTENSIONS
)
_OPEN_ERROR_FILE_TYPE_FORBIDDEN = "open_file_type_forbidden"

# Request fields that are NOT per-path inputs - persisted as "last_options".
_OPTION_FIELDS = (
    "formats", "bitrate", "sample_rate", "stereo", "make_mp4", "subtitle",
    "lang", "engine", "whisper_model", "whisper_device", "whisper_compute", "translate",
    "auto_sync",
)


class VideoExtractService:
    def __init__(self):
        self.processor = VideoExtractProcessor()
        self.user_data = user_data_service
        self.store = user_data_store

    def capabilities(self) -> dict:
        """Installed whisper models + supported languages for the UI dropdowns."""
        extensions = sorted(VIDEO_EXTENSIONS)
        default_extensions = [e for e in _DEFAULT_EXTENSIONS if e in VIDEO_EXTENSIONS]
        caps = whisper_capabilities()
        caps["success"] = True
        caps["extensions"] = extensions
        caps["default_extensions"] = default_extensions
        return caps

    def open(self, request: VideoExtractOpenRequest) -> VideoExtractOpenResponse:
        """Reveal a path in the OS file manager / open a file with its default app."""
        path = (request.path or "").strip()
        if not path:
            return VideoExtractOpenResponse(success=False, error="path is required")
        kind = (request.kind or "").strip().lower()
        if kind in _OPEN_FILE_KINDS:
            if Path(path).resolve().suffix.lower() not in _OPEN_FILE_EXTENSIONS:
                return VideoExtractOpenResponse(success=False, error=_OPEN_ERROR_FILE_TYPE_FORBIDDEN)
            ok = system_launcher.open_file(path)
        elif kind in _OPEN_DIR_KINDS:
            ok = system_launcher.open_dir(path)
        else:
            return VideoExtractOpenResponse(success=False, error=f"unknown kind: {request.kind}")
        if not ok:
            return VideoExtractOpenResponse(success=False, error=f"could not open path: {path}")
        return VideoExtractOpenResponse(success=True)

    def segments(self, request: VideoExtractSegmentsRequest) -> VideoExtractSegmentsResponse:
        """Return the smart-segmentation mapping.json for a processed video.

        `request.path` may be the segments dir, the mapping.json file, or any dir
        containing one; the processor resolves it.

        For the v3 multi-language subtitle view (``request.languages``) the mapping
        is ENRICHED in place: every ``segments[].subtitles[]`` cue gains BookSlot
        fields (``corr_id``/``grain``/``seq``/``primary_language``/``langs``)
        alongside the legacy ``text``; the mapping also carries top-level
        ``selected_languages`` and a flat ``slots`` list (both grains). The slots
        are built by the SAME ``laravel_media_sync`` builder the ingest sync uses.
        """
        result = self.processor.read_segments(request.path)
        mapping = result.get("mapping")
        if result.get("success") and isinstance(mapping, dict):
            self._enrich_segments_v3(mapping, result.get("mapping_file"),
                                     request.languages)
        return VideoExtractSegmentsResponse(
            success=result.get("success", False),
            mapping=mapping,
            error=result.get("error"),
        )

    @staticmethod
    def _enrich_segments_v3(mapping: dict, mapping_file,
                            languages) -> None:
        """Attach v3 correspondence-slot fields to a mapping's cues (mutates it).

        Resolves the source video path + sibling .srt from the mapping_file's
        location (its PARENT dir holds files.* incl. the .srt), builds the v3
        per-cue view via ``build_subtitle_segment_view`` (bilingual split OR
        multi-track time-overlap - the same builder the sync uses), then merges
        each cue slot onto the matching ``segments[].subtitles[]`` entry by SRT
        index (``idx``), falling back to start-time order. Adds top-level
        ``selected_languages`` and a flat ``slots`` list. Best-effort: leaves the
        mapping unchanged if the .srt cannot be located.
        """
        if not mapping_file:
            return
        seg_dir = os.path.dirname(mapping_file)
        per_file_dir = os.path.dirname(seg_dir)  # files.* (incl. .srt) live here
        stem = mapping.get("stem") or os.path.basename(seg_dir).replace("_segments", "")
        srt_name = (mapping.get("files") or {}).get("srt") or (stem + ".srt")
        srt_path = os.path.join(per_file_dir, srt_name)
        srt_text = _read_srt_text(srt_path)
        if not (srt_text and srt_text.strip()):
            return

        # Reconstruct the absolute source video path for a stable source_key (the
        # video sits at <per_file_dir>/<mapping.video-basename> or <stem>.<ext>).
        rel_video = mapping.get("video") or ""
        src_abs = (os.path.normpath(os.path.join(per_file_dir, os.path.basename(rel_video)))
                   if rel_video else os.path.join(per_file_dir, stem))

        view = build_subtitle_segment_view(
            mapping, srt_text, src_abs, languages=languages,
            primary_srt_path=srt_path)
        cue_slots = view.get("cue_slots") or []
        mapping["selected_languages"] = view.get("selected_languages") or []
        mapping["primary_language"] = view.get("primary_language")
        mapping["slots"] = view.get("slots") or []

        # Index cue slots by SRT idx (sub_idx) for a robust per-cue merge; keep an
        # ordered list as a positional fallback.
        by_idx = {s.get("sub_idx"): s for s in cue_slots if s.get("sub_idx") is not None}
        ordered = list(cue_slots)
        pos = 0
        for seg in (mapping.get("segments") or []):
            for sub in (seg.get("subtitles") or []):
                slot = by_idx.get(sub.get("idx"))
                if slot is None and pos < len(ordered):
                    slot = ordered[pos]
                pos += 1
                if slot is None:
                    continue
                # Attach BookSlot fields; KEEP legacy `text` for back-compat.
                sub["corr_id"] = slot.get("corr_id")
                sub["grain"] = "cue"
                sub["seq"] = slot.get("seq")
                sub["primary_language"] = slot.get("primary_language")
                sub["langs"] = slot.get("langs") or {}

    def system_resources(self, refresh: bool = False) -> dict:
        """CPU / memory / GPU snapshot for the live resource meters."""
        return status_snapshot_cache.get(
            STATUS_SNAPSHOT_SYSTEM_RESOURCES_KEY,
            _collect_system_resources,
            refresh=refresh,
            ttl_seconds=STATUS_SNAPSHOT_RESOURCES_TTL_SECONDS,
        )

    def preview(self, request: VideoExtractRequest) -> VideoExtractPreviewResponse:
        """Dry-run scan: list what would be processed (no files written)."""
        result = self.processor.preview(request.model_dump())
        return VideoExtractPreviewResponse(
            success=result.get("success", False),
            message=result.get("message", ""),
            root=result.get("root"),
            output=result.get("output"),
            videos=result.get("videos", []),
            count=result.get("count", 0),
            ffmpeg_found=result.get("ffmpeg_found", False),
            engine=result.get("engine"),
            model=result.get("model"),
            device=result.get("device"),
            error=result.get("error"),
        )

    def start(self, request: VideoExtractRequest) -> VideoExtractStartResponse:
        """Queue an async extraction task (over one or many paths) and return its id."""
        config = request.model_dump()

        # Resolve the work list: explicit `paths` wins, else the single `path`.
        work_paths = request.paths or ([request.path] if request.path else [])
        work_paths = [p for p in (work_paths or []) if (p or "").strip()]
        if not work_paths:
            return VideoExtractStartResponse(success=False, error="No path(s) provided.")

        mode = (config.get("mode") or "folder").lower()

        # Persist history + last options to the user-data store.
        for p in work_paths:
            self.user_data.add_video_extract(p, mode)
        self.store.set("video_extract", "last_options",
                       {k: config.get(k) for k in _OPTION_FIELDS})

        # Build a shared base config (non-path options) for run_many.
        base_config = {k: config[k] for k in config if k not in ("path", "paths")}

        # Best-effort up-front total across all roots for the UI's "x/N".
        total = 0
        for p in work_paths:
            prev = self.processor.preview({**base_config, "path": p})
            if prev.get("success"):
                total += int(prev.get("count") or 0)

        tm = task_manager
        task_id = tm.create_task(
            task_type="video_extract",
            input_data={"paths": work_paths, "mode": mode,
                        "subtitle": config.get("subtitle"), "engine": config.get("engine")},
            estimated_time=None,
        )

        processor = self.processor

        def executor(task):
            def progress(pct, snapshot):
                task.update_progress(pct, TaskStatus.RUNNING.value)
                task.result = snapshot  # partial snapshot for live polling

            def should_stop():
                return bool(getattr(task, "_cancel", False))

            def should_pause():
                return bool(getattr(task, "_pause", False))

            return processor.run_many(
                work_paths, progress_cb=progress, should_stop=should_stop,
                should_pause=should_pause, base_config=base_config)

        tm.execute_task(task_id, executor)

        return VideoExtractStartResponse(
            success=True,
            message=f"Video extraction started ({len(work_paths)} root(s))",
            task_id=task_id,
            total=total,
        )


# --------------------------------------------------------------------------- #
# System resources (CPU / memory / GPU) - shared by the resources endpoint     #
# --------------------------------------------------------------------------- #
def _query_gpus():
    """Best-effort per-GPU utilization/memory via nvidia-smi. Returns [] when no
    NVIDIA GPU / nvidia-smi is present."""

    exe = shutil.which("nvidia-smi")
    if not exe:
        return []
    try:
        out = subprocess.run(
            [exe, "--query-gpu=index,name,utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=NVIDIA_SMI_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        ColorPrint.yellow(f"[VideoExtract] nvidia-smi query failed ({exe}): {exc}")
        return []
    if out.returncode != 0:
        return []

    def _num(token, cast):
        token = (token or "").strip()
        if not token or token.lower() in ("n/a", "[n/a]"):
            return None
        try:
            return cast(token)
        except (ValueError, TypeError):
            return None

    gpus = []
    for line in (out.stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 5:
            continue
        gpus.append({
            "index": _num(parts[0], int) or 0,
            "name": parts[1],
            "util_percent": _num(parts[2], float),
            "mem_used_mb": _num(parts[3], int),
            "mem_total_mb": _num(parts[4], int),
        })
    return gpus


CPU_NAME_REGISTRY_KEY = r"HARDWARE\DESCRIPTION\System\CentralProcessor\0"
CPU_NAME_REGISTRY_VALUE = "ProcessorNameString"
CPU_INFO_PATH = Path("/proc/cpuinfo")
CPU_INFO_MODEL_FIELD = "model name"


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


def _cpu_info(psutil) -> dict:
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


def _collect_system_resources() -> dict:
    """Snapshot of CPU%, memory, and GPUs for the UI's live resource meters."""
    psutil = get_third_package_psutil()
    if psutil is None:
        return {
            "success": False, "error": "psutil unavailable",
            "cpu_percent": 0.0,
            "cpu": _cpu_info(None),
            "mem": {"used_mb": 0, "total_mb": 0, "percent": 0.0},
            "gpus": _query_gpus(),
        }
    cpu_percent = float(psutil.cpu_percent(interval=None))
    vm = psutil.virtual_memory()
    return {
        "success": True,
        "cpu_percent": cpu_percent,
        "cpu": _cpu_info(psutil),
        "mem": {
            "used_mb": int(vm.used / (1024 * 1024)),
            "total_mb": int(vm.total / (1024 * 1024)),
            "percent": float(vm.percent),
        },
        "battery": _battery_info(psutil),
        "gpus": _query_gpus(),
    }


video_extract_service = VideoExtractService()
