# -*- coding: utf-8 -*-
"""PipeWire virtual microphone: a loopback whose sink side receives a played file and whose
source side is what a recorder (PIPEWIRE_NODE=<source>) captures. Linux only."""

from __future__ import annotations

import os
import shutil
import subprocess
import wave
from pathlib import Path
from typing import List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import IS_WINDOWS

PIPEWIRE_SOCKET_NAME = "pipewire-0"
RUN_USER_DIR = Path("/run/user")
RUNTIME_DIR_ENV = "PIPEWIRE_RUNTIME_DIR"
XDG_RUNTIME_DIR_ENV = "XDG_RUNTIME_DIR"
LOOPBACK_BINARY = "pw-loopback"
PLAY_BINARY = "pw-play"
DECODER_BINARY = "ffmpeg"
REQUIRED_BINARIES = (LOOPBACK_BINARY, PLAY_BINARY, DECODER_BINARY)
SAMPLE_RATE = 48000
CHANNELS = 1
DECODE_TIMEOUT_SECONDS = 60
STOP_TIMEOUT_SECONDS = 3


def pipewire_runtime_dir() -> Optional[Path]:
    """Directory holding the PipeWire socket: the configured runtime dirs first, then the first user session."""
    configured = [os.environ.get(RUNTIME_DIR_ENV, ""), os.environ.get(XDG_RUNTIME_DIR_ENV, "")]
    candidates: List[Path] = [Path(value) for value in configured if value]
    if RUN_USER_DIR.is_dir():
        candidates.extend(sorted(RUN_USER_DIR.iterdir()))
    return next((path for path in candidates if (path / PIPEWIRE_SOCKET_NAME).is_socket()), None)


def available() -> bool:
    return (
        not IS_WINDOWS
        and pipewire_runtime_dir() is not None
        and all(shutil.which(binary) for binary in REQUIRED_BINARIES)
    )


def _environment() -> dict:
    env = dict(os.environ)
    runtime_dir = pipewire_runtime_dir()
    if runtime_dir is not None:
        env[RUNTIME_DIR_ENV] = str(runtime_dir)
    return env


def decode_to_wav(source: Path, target: Path) -> Optional[float]:
    """Decode any recording to mono PCM WAV for pw-play; returns its duration in seconds."""
    try:
        completed = subprocess.run(
            [DECODER_BINARY, "-loglevel", "error", "-y", "-i", str(source),
             "-ar", str(SAMPLE_RATE), "-ac", str(CHANNELS), str(target)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=DECODE_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        ColorPrint.yellow(f"[VirtualMicrophone] decode failed source={source}: {exc}")
        return None
    if completed.returncode != 0:
        ColorPrint.yellow(f"[VirtualMicrophone] decode failed source={source}: {completed.stderr.decode(errors='replace').strip()}")
        return None
    with wave.open(str(target), "rb") as reader:
        return reader.getnframes() / float(reader.getframerate())


class VirtualMicrophone:
    """Context manager owning the pw-loopback process for one source/sink pair."""

    def __init__(self, source_name: str, sink_name: str) -> None:
        self.source_name = source_name
        self.sink_name = sink_name
        self._loopback: Optional[subprocess.Popen] = None

    def __enter__(self) -> "VirtualMicrophone":
        self._loopback = subprocess.Popen(
            [LOOPBACK_BINARY,
             f"--capture-props=media.class=Audio/Sink node.name={self.sink_name} audio.channels={CHANNELS}",
             f"--playback-props=media.class=Audio/Source node.name={self.source_name} audio.channels={CHANNELS}"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=_environment(),
        )
        return self

    def __exit__(self, *_exc_info) -> None:
        _stop(self._loopback)
        self._loopback = None

    def play(self, wav_path: Path) -> subprocess.Popen:
        """Start playing into the sink; the caller polls the returned process."""
        return subprocess.Popen(
            [PLAY_BINARY, "--target", self.sink_name, str(wav_path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=_environment(),
        )


def _stop(process: Optional[subprocess.Popen]) -> None:
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=STOP_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
