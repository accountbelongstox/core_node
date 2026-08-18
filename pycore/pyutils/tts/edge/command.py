# -*- coding: utf-8 -*-

from pathlib import Path
from typing import Optional


def build_edge_tts_command(
    binary: str,
    voice: str,
    text: str,
    output_path: Path,
    subtitle_path: Optional[Path] = None,
    proxy: Optional[str] = None,
) -> list[str]:
    executable_name = Path(binary).stem.lower()
    command = [binary]
    if executable_name.startswith("python"):
        command.extend(["-m", "edge_tts"])
    command.extend([
        "--voice",
        voice,
        "--text",
        text,
        "--write-media",
        str(output_path),
    ])
    if subtitle_path is not None:
        command.extend(["--write-subtitles", str(subtitle_path)])
    if proxy:
        command.extend(["--proxy", proxy])
    return command


__all__ = ["build_edge_tts_command"]
