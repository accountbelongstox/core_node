# -*- coding: utf-8 -*-
"""Windows virtual microphone over a virtual audio cable (VB-CABLE, installed by the Step74
prerequisite script): a played file goes into the cable's playback device and comes out of its
capture device. Claude Code records from the default capture device (no per-process device is
known), so the cable is the default capture device for every role while the context is open and
the previous defaults are restored on exit. Device names come from config/claude_voice_dictation.json."""

from __future__ import annotations

import json
import threading
import wave
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.pyfoundations.third_party.api import get_third_package_pyaudio
from pycore.pyutils.audio_utils.windows_audio_endpoints import windows_audio_endpoints

VOICE_DICTATION_CONFIG_PATH = (get_core_node_root() / "config" / "claude_voice_dictation.json").resolve()
CAPTURE_DEVICE_KEY = "windows_capture_device"
PLAYBACK_DEVICE_KEY = "windows_playback_device"
PLAYBACK_FRAMES_PER_CHUNK = 1024


def _device_names() -> Dict[str, str]:
    config = json.loads(VOICE_DICTATION_CONFIG_PATH.read_text(encoding="utf-8"))
    return {CAPTURE_DEVICE_KEY: str(config[CAPTURE_DEVICE_KEY]), PLAYBACK_DEVICE_KEY: str(config[PLAYBACK_DEVICE_KEY])}


def playback_device_index(name_part: str) -> Optional[int]:
    """PortAudio index of the first output device of the default host API whose name contains name_part."""
    pyaudio = get_third_package_pyaudio()
    if pyaudio is None:
        return None
    audio = pyaudio.PyAudio()
    try:
        host_api = audio.get_default_host_api_info()["index"]
        lowered = name_part.lower()
        for index in range(audio.get_device_count()):
            info = audio.get_device_info_by_index(index)
            if info["hostApi"] == host_api and info["maxOutputChannels"] > 0 and lowered in str(info["name"]).lower():
                return index
        return None
    finally:
        audio.terminate()


def available() -> bool:
    names = _device_names()
    return (
        windows_audio_endpoints.policy_available()
        and windows_audio_endpoints.find_capture(names[CAPTURE_DEVICE_KEY]) is not None
        and playback_device_index(names[PLAYBACK_DEVICE_KEY]) is not None
    )


class CablePlaybackThread(threading.Thread):
    """Plays one WAV file into the cable; poll/terminate/wait mirror the subprocess player of Linux."""

    def __init__(self, wav_path: Path, device_index: Optional[int]) -> None:
        super().__init__(name="CablePlaybackThread", daemon=True)
        self.wav_path = wav_path
        self.device_index = device_index
        self.stopping = False

    def run(self) -> None:
        # Without the cable PortAudio would fall back to the speakers.
        if self.device_index is None:
            ColorPrint.yellow(f"[WindowsVirtualMicrophone] cable playback device missing; not playing {self.wav_path}")
            return
        pyaudio = get_third_package_pyaudio()
        audio = pyaudio.PyAudio()
        try:
            with wave.open(str(self.wav_path), "rb") as reader:
                stream = audio.open(
                    format=audio.get_format_from_width(reader.getsampwidth()),
                    channels=reader.getnchannels(),
                    rate=reader.getframerate(),
                    output=True,
                    output_device_index=self.device_index,
                )
                frames = reader.readframes(PLAYBACK_FRAMES_PER_CHUNK)
                while frames and not self.stopping:
                    stream.write(frames)
                    frames = reader.readframes(PLAYBACK_FRAMES_PER_CHUNK)
                stream.stop_stream()
                stream.close()
        except (OSError, wave.Error) as exc:
            ColorPrint.yellow(f"[WindowsVirtualMicrophone] playback failed wav={self.wav_path}: {exc}")
        finally:
            audio.terminate()

    def poll(self) -> Optional[int]:
        return None if self.is_alive() else 0

    def terminate(self) -> None:
        self.stopping = True

    def wait(self) -> int:
        self.join()
        return 0


class WindowsVirtualMicrophone:
    """Context manager: the cable is the default capture device inside, the previous defaults are restored on exit.
    The PipeWire names of the shared call are not used; the Windows device names come from the config."""

    def __init__(self, source_name: str, sink_name: str) -> None:
        self.source_name = source_name
        self.sink_name = sink_name
        self._names = _device_names()
        self._previous: Dict[int, str] = {}

    def __enter__(self) -> "WindowsVirtualMicrophone":
        cable = windows_audio_endpoints.find_capture(self._names[CAPTURE_DEVICE_KEY])
        self._previous = windows_audio_endpoints.default_captures()
        if cable is None or not windows_audio_endpoints.set_default(cable):
            ColorPrint.yellow(f"[WindowsVirtualMicrophone] could not make {self._names[CAPTURE_DEVICE_KEY]} the default capture device")
        return self

    def __exit__(self, *_exc_info) -> None:
        for role, endpoint in self._previous.items():
            if not windows_audio_endpoints.set_default(endpoint, (role,)):
                ColorPrint.yellow(f"[WindowsVirtualMicrophone] could not restore default capture device role={role} id={endpoint}")
        self._previous = {}

    def play(self, wav_path: Path) -> CablePlaybackThread:
        """Start playing into the cable; the caller polls the returned player."""
        player = CablePlaybackThread(wav_path, playback_device_index(self._names[PLAYBACK_DEVICE_KEY]))
        player.start()
        return player
