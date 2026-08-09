# -*- coding: utf-8 -*-

import os
from pathlib import Path
from typing import Optional


_DEFAULT_RATE = "-20%"


def normalize_edge_tts_rate(rate: Optional[str]) -> str:
    if rate is None:
        rate = (os.environ.get("EDGE_TTS_RATE") or "").strip() or _DEFAULT_RATE
    value = str(rate).strip()
    if not value:
        return "+0%"
    if not value.endswith("%"):
        value += "%"
    if value[0] not in "+-":
        value = "+" + value
    return value


def build_edge_tts_command(
    binary: str,
    voice: str,
    rate: Optional[str],
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
        f"--rate={normalize_edge_tts_rate(rate)}",
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


__all__ = ["build_edge_tts_command", "normalize_edge_tts_rate"]
