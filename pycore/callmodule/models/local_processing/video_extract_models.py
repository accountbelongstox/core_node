# -*- coding: utf-8 -*-
"""
Video Extract models (request/response).

Backs the "Video Extraction" feature - a pycore port of
scripts/video_tools/py_video_tools/video_audio_extractor.py:

  * scan a FOLDER (recursively) or a single FILE of video(s)
  * per video: optional tiny AI-MP4, multi-codec audio extraction, optional
    .srt subtitle via whisper, ASCII name sanitization, idempotent, dir-mirrored

The heavy work runs as an async task (pycore task_manager); these models only
cover the synchronous request, the "start" acknowledgement, and the dry-run
"preview".
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Audio codecs the processor knows about (best-compression first).
VIDEO_EXTRACT_CODECS = ("opus", "aac", "vorbis", "mp3")
# Subtitle engines. faster-whisper is the DEFAULT; "whisper" (openai-whisper via
# pycore's WhisperSTTProvider) is currently disabled in the processor (kept,
# commented out) but the value is accepted for forward-compatibility.
VIDEO_EXTRACT_ENGINES = ("faster-whisper", "whisper")


class VideoExtractRequest(BaseModel):
    """Request to extract audio / tiny-mp4 / subtitles from video(s)."""

    # --- input / output ---------------------------------------------------- #
    path: str = Field(..., description="Absolute path to a video file or a folder of videos.")
    # Multi-root: process several absolute paths in one run. When provided this
    # takes precedence over the single `path` (which is kept for backward compat).
    paths: Optional[List[str]] = Field(
        None, description="Optional list of absolute paths (folders/files) to process in one run. "
                          "Overrides `path` when set.")
    mode: str = Field("folder", description="'folder' (recursive scan) or 'file' (single video).")
    output: Optional[str] = Field(
        None, description="Output folder. Default: <folder>/_compressed_result (folder mode) "
                          "or the file's own directory (file mode).")

    # --- audio extraction -------------------------------------------------- #
    formats: List[str] = Field(default_factory=lambda: ["mp3"],
                               description="Audio codecs to extract: opus/aac/vorbis/mp3.")
    bitrate: Optional[str] = Field(None, description="Audio bitrate override (e.g. '32k'). "
                                                     "Default: each codec's small default.")
    sample_rate: int = Field(22050, description="Audio sample rate in Hz.")
    stereo: bool = Field(False, description="Keep stereo (default mono = smaller).")

    # --- tiny AI-acceptable mp4 ------------------------------------------- #
    make_mp4: bool = Field(True, description="Also create a tiny 2x2 H.264 + AAC mp4 carrying the audio.")

    # --- subtitles (whisper STT) ------------------------------------------ #
    subtitle: bool = Field(True, description="Also generate an .srt subtitle via whisper.")
    lang: str = Field("en", description="Subtitle language code (e.g. en, zh, ja). 'auto' to detect.")
    engine: str = Field("faster-whisper", description="STT engine: 'faster-whisper' (default) or 'whisper'.")
    whisper_model: str = Field("auto", description="Model: auto/tiny/base/small/medium/large-v3/turbo.")
    whisper_device: str = Field("auto", description="auto/cpu/cuda.")
    whisper_compute: str = Field("auto", description="auto/int8/float16/...")

    # --- scanning ---------------------------------------------------------- #
    extensions: Optional[List[str]] = Field(
        None, description="Optional video extension allow-list (e.g. ['.mp4', '.mkv']). "
                          "Intersected with the processor's supported set; all supported "
                          "extensions are used when absent/empty.")

    # --- naming ------------------------------------------------------------ #
    translate: bool = Field(False, description="Translate non-ASCII names to English (needs network); "
                                              "otherwise transliterate offline.")

    # --- movie/TV poster --------------------------------------------------- #
    fetch_poster: bool = Field(True, description="Fetch a movie/TV poster (TMDB->OMDB) for each "
                                                 "video from its filename and save poster.jpg into "
                                                 "the output dir. Best-effort; never fails extraction.")

    # --- misc -------------------------------------------------------------- #
    dry_run: bool = Field(False, description="Plan only; write nothing.")
    # Persisted as part of "last_options" only; the FE drives the actual
    # post-run Laravel sync (video_extract.sync_source) when this is on.
    auto_sync: bool = Field(False, description="Auto-sync outputs to laravel_main after a run "
                                               "(FE-driven; persisted with last_options).")


class VideoExtractOpenRequest(BaseModel):
    """Ask the backend to reveal a path in the OS file manager / default app.

    `kind` selects intent (so the controller picks open_file vs open_dir):
      * "file" / "subtitle"        -> open the file with its default app
      * "file_dir" / "file_output_dir" / "output" -> open the (parent) folder
    `path` is the absolute path the frontend already resolved.
    """
    kind: str = Field(..., description="One of: output|file|file_dir|file_output_dir|subtitle.")
    path: Optional[str] = Field(None, description="Absolute path to open / reveal.")


class VideoExtractOpenResponse(BaseModel):
    """Result of an open/reveal request."""
    success: bool
    error: Optional[str] = None


class VideoExtractStartResponse(BaseModel):
    """Acknowledgement returned immediately after a job is queued."""
    success: bool
    message: str = ""
    task_id: Optional[str] = None
    total: Optional[int] = Field(None, description="Number of videos found (when known up front).")
    error: Optional[str] = None


class VideoExtractSegmentsRequest(BaseModel):
    """Request the smart-segmentation mapping for a processed video.

    `path` may be the source video's absolute path, its output `<stem>_segments`
    dir, or the `mapping.json` file directly. The backend resolves it to the
    segments' mapping.json.
    """
    path: str = Field(..., description="Absolute path to the source video, its "
                                       "'<stem>_segments' dir, or its mapping.json.")


class VideoExtractSegmentsResponse(BaseModel):
    """The parsed segmentation mapping.json (or an error when there are none)."""
    success: bool
    mapping: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class VideoExtractPreviewResponse(BaseModel):
    """Dry-run scan result: what WOULD be processed (no files written)."""
    success: bool
    message: str = ""
    root: Optional[str] = None
    output: Optional[str] = None
    videos: List[str] = Field(default_factory=list, description="Relative paths of videos found.")
    count: int = 0
    ffmpeg_found: bool = False
    engine: Optional[str] = None
    model: Optional[str] = None
    device: Optional[str] = None
    error: Optional[str] = None
