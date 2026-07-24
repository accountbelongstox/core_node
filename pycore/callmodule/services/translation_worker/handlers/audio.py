"""Shared TTS helper used by prompt-to-article translation."""

import base64
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.system_paths import get_edge_tts_voice_cache_dir
from pycore.pyutils.tts import tts_orchestrator


def synthesize_word_audio(
    text: str,
    language: str,
    accent: Optional[str] = None,
    gender: Optional[str] = None,
    priority_profile: str = "word",
) -> Tuple[str, str, str, Dict[str, Any]]:
    """Synthesize text and return base64 MP3, engine, accent and metadata."""
    voice_dir = get_edge_tts_voice_cache_dir(language)
    descriptor, temporary_path = tempfile.mkstemp(
        prefix="worker_tts_",
        suffix=".mp3",
        dir=str(voice_dir),
    )
    os.close(descriptor)
    temporary_file = Path(temporary_path)
    try:
        result = tts_orchestrator.synthesize(
            text,
            language,
            temporary_file,
            accent=accent,
            gender=gender,
            priority_profile=priority_profile,
        )
        if not result.get("success"):
            raise RuntimeError(result.get("error") or "TTS synthesis failed")
        audio = temporary_file.read_bytes() if temporary_file.exists() else b""
        if len(audio) < 100:
            raise RuntimeError(
                f"engine '{result.get('engine')}' produced {len(audio)} bytes"
            )
        metadata = {
            "synth_command": result.get("synth_command"),
            "tried": result.get("tried") or [],
        }
        return (
            base64.b64encode(audio).decode("ascii"),
            result.get("engine") or "unknown",
            result.get("accent") or "unknown",
            metadata,
        )
    finally:
        try:
            temporary_file.unlink()
        except OSError:
            pass
