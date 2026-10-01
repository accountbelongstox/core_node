# -*- coding: utf-8 -*-
"""FFmpeg presence check: resolve the shell-installed binary, report the installer step when missing."""

import shutil
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import Commander
from pycore.pyutils.common.prerequisite_steps import PREREQ_FFMPEG, report_missing

LISTING_SKIP_TOKENS = {"D", "E", "V", "codec", "format"}
LISTING_SKIP_HEADERS = ("Codecs:", "File formats:", "configuration:")


def resolve_ffmpeg() -> Optional[str]:
    """Path of a working ffmpeg (ffprobe must be on PATH too), or None (reported with the installer step)."""
    ffmpeg_path = shutil.which("ffmpeg")
    ffprobe_path = shutil.which("ffprobe")
    if ffmpeg_path is None or ffprobe_path is None:
        report_missing(PREREQ_FFMPEG, f"ffmpeg={ffmpeg_path} ffprobe={ffprobe_path} on PATH")
        return None
    result = Commander.exec_silent([str(ffmpeg_path), "-version"])
    if not result.success:
        report_missing(PREREQ_FFMPEG, f"{ffmpeg_path} does not run")
        return None
    ColorPrint.green(f"[FFmpeg] {result.get_output().splitlines()[0] if result.get_output() else ffmpeg_path}")
    return str(ffmpeg_path)


def _listing_names(output: str) -> list:
    names = []
    for line in output.splitlines():
        if not line.strip() or line.startswith((" ", "-")) or any(header in line for header in LISTING_SKIP_HEADERS):
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[1] not in LISTING_SKIP_TOKENS:
            names.append(parts[1])
    return names


def ffmpeg_info(ffmpeg_path: str) -> Dict[str, Any]:
    """Version line plus codec and format names reported by the given ffmpeg."""
    info: Dict[str, Any] = {"path": ffmpeg_path, "version": None, "codecs": [], "formats": []}
    version = Commander.exec_silent([ffmpeg_path, "-version"])
    if version.success and version.get_output():
        info["version"] = version.get_output().splitlines()[0]
    codecs = Commander.exec_silent([ffmpeg_path, "-codecs"])
    if codecs.success:
        info["codecs"] = _listing_names(codecs.get_output())
    formats = Commander.exec_silent([ffmpeg_path, "-formats"])
    if formats.success:
        info["formats"] = _listing_names(formats.get_output())
    return info
