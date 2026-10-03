# -*- coding: utf-8 -*-
"""Voice messages typed by the agent's own hold-to-talk dictation (Claude Code /voice, hold mode).

claudeteam starts local sessions recording from the PipeWire virtual microphone named in
config/claude_voice_dictation.json. Here the recording is played into that microphone while
the push-to-talk key is repeated like keyboard auto-repeat; the transcript the agent types into
its input box is then submitted with the optional text. Any precondition that fails before a key
is sent reports ERROR_UNAVAILABLE, so the caller sends the recording as a file path instead."""

from __future__ import annotations

import json
import secrets
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.pyctl.terminal.terminal_agent_detector import framed_input_text
from pycore.pyctl.terminal.terminal_prompt_detector import waiting_prompt
from pycore.pyutils.audio_utils import virtual_microphone
from pycore.pyutils.audio_utils.virtual_microphone import VirtualMicrophone

VOICE_DICTATION_CONFIG_PATH = (get_core_node_root() / "config" / "claude_voice_dictation.json").resolve()
ERROR_UNAVAILABLE = "terminal_voice_dictation_unavailable"
ERROR_AUDIO_INVALID = "terminal_voice_audio_invalid"
ERROR_NO_TRANSCRIPT = "terminal_voice_no_transcript"
# Claude Code draws the live input level in the input box while recording.
LEVEL_GLYPHS = "▁▂▃▄▅▆▇█"
WORK_DIR_NAME = "terminal_voice"
MS_PER_SECOND = 1000.0


def _config() -> Dict[str, Any]:
    return json.loads(VOICE_DICTATION_CONFIG_PATH.read_text(encoding="utf-8"))


def transcript_text(input_text: Optional[str]) -> str:
    return (input_text or "").translate({ord(glyph): None for glyph in LEVEL_GLYPHS}).strip()


def resolve_recordings(references: List[str], voice_directory: Path) -> Optional[List[Path]]:
    """Recordings named by their attachment references; only files of the voice store are accepted."""
    root = voice_directory.resolve()
    paths: List[Path] = []
    for reference in references:
        path = Path(reference.strip().strip('"')).resolve()
        if path.parent != root or not path.is_file():
            return None
        paths.append(path)
    return paths or None


class TerminalVoiceDictation:
    """One dictation run; export/backend calls come from TerminalService (already serialized)."""

    def __init__(self, backend: Any, export_text: Callable[[], Dict[str, Any]]) -> None:
        self._backend = backend
        self._export_text = export_text
        self._config = _config()

    @staticmethod
    def available() -> bool:
        return virtual_microphone.available()

    def ready_input(self) -> Optional[str]:
        """Current input-box text when the terminal shows an agent input box and no prompt, else None."""
        exported = self._export_text()
        if not exported.get("success"):
            return None
        text = str(exported.get("text") or "")
        if waiting_prompt(text):
            return None
        return framed_input_text(text)

    def dictate(self, window_id: str, recording: Path) -> Dict[str, Any]:
        config = self._config
        work_dir = TMP_DIR / WORK_DIR_NAME
        work_dir.mkdir(parents=True, exist_ok=True)
        wav_path = work_dir / f"{secrets.token_hex(8)}.wav"
        try:
            if virtual_microphone.decode_to_wav(recording, wav_path) is None:
                return {"success": False, "error_code": ERROR_AUDIO_INVALID}
            with VirtualMicrophone(str(config["pipewire_source"]), str(config["pipewire_sink"])) as microphone:
                time.sleep(config["loopback_settle_ms"] / MS_PER_SECOND)
                return self._hold_while_playing(window_id, microphone, wav_path)
        finally:
            wav_path.unlink(missing_ok=True)

    def _hold_while_playing(self, window_id: str, microphone: VirtualMicrophone, wav_path: Path) -> Dict[str, Any]:
        config = self._config
        started = time.monotonic()
        warmup = config["recording_warmup_ms"] / MS_PER_SECOND
        tail = config["recording_tail_ms"] / MS_PER_SECOND
        state: Dict[str, Any] = {"player": None, "finished_at": None}

        def holding() -> bool:
            now = time.monotonic()
            if state["player"] is None:
                if now - started >= warmup:
                    state["player"] = microphone.play(wav_path)
                return True
            if state["player"].poll() is None:
                return True
            if state["finished_at"] is None:
                state["finished_at"] = now
            return now - state["finished_at"] < tail

        held = self._backend.hold_key(
            window_id,
            str(config["hold_key"]),
            holding,
            config["hold_key_interval_ms"] / MS_PER_SECOND,
        )
        player = state["player"]
        if player is not None and player.poll() is None:
            player.terminate()
            player.wait()
        return held

    def await_transcript(self, before: str) -> Optional[str]:
        """Poll the input box until it holds new, stable text; None on timeout."""
        config = self._config
        interval = config["transcript_poll_interval_ms"] / MS_PER_SECOND
        deadline = time.monotonic() + config["transcript_timeout_ms"] / MS_PER_SECOND
        baseline = transcript_text(before)
        candidate: Optional[str] = None
        while time.monotonic() < deadline:
            time.sleep(interval)
            current = transcript_text(self.ready_input())
            if not current or current == baseline:
                candidate = None
                continue
            if current == candidate:
                return current
            candidate = current
        return None
