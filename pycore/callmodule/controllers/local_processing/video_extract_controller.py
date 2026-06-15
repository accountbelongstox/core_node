# -*- coding: utf-8 -*-
"""Video Extract Controller - bridges HTTP requests to the processor + task layer."""

from pycore import get_user_data_store
from pycore.pyutils.common import system_launcher
from ...services.processors import VideoExtractProcessor
from ...services.processors.video_extract_processor import whisper_capabilities, VIDEO_EXTENSIONS
from ...models.local_processing.video_extract_models import (
    VideoExtractRequest,
    VideoExtractStartResponse,
    VideoExtractPreviewResponse,
    VideoExtractOpenRequest,
    VideoExtractOpenResponse,
    VideoExtractSegmentsRequest,
    VideoExtractSegmentsResponse,
)
from .user_data_controller import UserDataController
from pycore.pyctl.desktop.task_manager import get_task_manager

# Common, broadly-useful container/video extensions offered as the default
# selection in the UI (intersected with the processor's actually-supported set).
_DEFAULT_EXTENSIONS = [".mp4", ".mkv", ".mov", ".avi", ".flv", ".webm", ".ts", ".m4v"]

# kinds that name a FILE to open with its default app vs. a FOLDER to reveal.
_OPEN_FILE_KINDS = {"file", "subtitle"}
_OPEN_DIR_KINDS = {"file_dir", "file_output_dir", "output"}

# Request fields that are NOT per-path inputs - persisted as "last_options".
_OPTION_FIELDS = (
    "formats", "bitrate", "sample_rate", "stereo", "make_mp4", "subtitle",
    "lang", "engine", "whisper_model", "whisper_device", "whisper_compute", "translate",
    "auto_sync",
)


class VideoExtractController:
    def __init__(self):
        self.processor = VideoExtractProcessor()
        self.user_data = UserDataController()
        self.store = get_user_data_store()

    def capabilities(self) -> dict:
        """Installed whisper models + supported languages for the UI dropdowns."""
        extensions = sorted(VIDEO_EXTENSIONS)
        default_extensions = [e for e in _DEFAULT_EXTENSIONS if e in VIDEO_EXTENSIONS]
        try:
            caps = whisper_capabilities()
            caps["success"] = True
            caps["extensions"] = extensions
            caps["default_extensions"] = default_extensions
            return caps
        except Exception as e:
            # Safe fallback so the UI still renders sane defaults.
            return {
                "success": False, "error": str(e),
                "models": ["auto"], "installed_models": [], "default_model": "auto",
                "languages": [{"code": "en", "name": "English"}], "default_lang": "en",
                "ffmpeg_found": False,
                "extensions": extensions, "default_extensions": default_extensions,
            }

    def open(self, request: VideoExtractOpenRequest) -> VideoExtractOpenResponse:
        """Reveal a path in the OS file manager / open a file with its default app."""
        path = (request.path or "").strip()
        if not path:
            return VideoExtractOpenResponse(success=False, error="path is required")
        kind = (request.kind or "").strip().lower()
        if kind in _OPEN_FILE_KINDS:
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
        """
        result = self.processor.read_segments(request.path)
        return VideoExtractSegmentsResponse(
            success=result.get("success", False),
            mapping=result.get("mapping"),
            error=result.get("error"),
        )

    def system_resources(self) -> dict:
        """CPU / memory / GPU snapshot for the live resource meters."""
        return _collect_system_resources()

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
        try:
            for p in work_paths:
                self.user_data.add_video_extract(p, mode)
            self.store.set("video_extract", "last_options",
                           {k: config.get(k) for k in _OPTION_FIELDS})
        except Exception:
            pass  # persistence is best-effort; never block the run.

        # Build a shared base config (non-path options) for run_many.
        base_config = {k: config[k] for k in config if k not in ("path", "paths")}

        # Best-effort up-front total across all roots for the UI's "x/N".
        total = 0
        try:
            for p in work_paths:
                cfg = dict(base_config)
                cfg["path"] = p
                prev = self.processor.preview(cfg)
                if prev.get("success"):
                    total += int(prev.get("count") or 0)
        except Exception:
            total = None

        tm = get_task_manager()
        task_id = tm.create_task(
            task_type="video_extract",
            input_data={"paths": work_paths, "mode": mode,
                        "subtitle": config.get("subtitle"), "engine": config.get("engine")},
            estimated_time=None,
        )

        processor = self.processor

        def executor(task):
            def progress(pct, snapshot):
                task.update_progress(pct, "processing")
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
def _get_psutil():
    """Resolve psutil via pycore's third-party loader, falling back to a direct
    import. Returns the module or None if unavailable."""
    try:
        from pycore.pyfoundations.third_party import get_third_package_psutil
        mod = get_third_package_psutil()
        if mod is not None:
            return mod
    except Exception:
        pass
    try:
        import psutil  # noqa: F401
        return psutil
    except Exception:
        return None


def _query_gpus():
    """Best-effort per-GPU utilization/memory via nvidia-smi. Returns [] when no
    NVIDIA GPU / nvidia-smi is present."""
    import shutil
    import subprocess

    exe = shutil.which("nvidia-smi")
    if not exe:
        return []
    try:
        out = subprocess.run(
            [exe, "--query-gpu=index,name,utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
    except Exception:
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


def _collect_system_resources() -> dict:
    """Snapshot of CPU%, memory, and GPUs for the UI's live resource meters."""
    psutil = _get_psutil()
    if psutil is None:
        return {
            "success": False, "error": "psutil unavailable",
            "cpu_percent": 0.0,
            "mem": {"used_mb": 0, "total_mb": 0, "percent": 0.0},
            "gpus": _query_gpus(),
        }
    cpu_percent = float(psutil.cpu_percent(interval=None))
    vm = psutil.virtual_memory()
    return {
        "success": True,
        "cpu_percent": cpu_percent,
        "mem": {
            "used_mb": int(vm.used / (1024 * 1024)),
            "total_mb": int(vm.total / (1024 * 1024)),
            "percent": float(vm.percent),
        },
        "gpus": _query_gpus(),
    }
