# -*- coding: utf-8 -*-
"""
Speech (TTS/STT) history router — the audio sibling of the AI image-history
routes. Backs the unified Records timeline: list synthesized/recognized clips,
stream the audio bytes for inline playback, reveal a clip's folder in the file
manager, and delete/clear.

Endpoints (prefix /api/local/speech):
  GET    /history[?limit=50]      -> newest-first entries (incl. absolute path)
  GET    /history/file/{id}       -> raw audio bytes (Content-Type = stored mime)
  POST   /history/{id}/reveal     -> open the clip's folder in the OS file manager
  DELETE /history/{id}            -> remove one entry + its audio file
  POST   /history/clear           -> remove all entries + audio files
"""

import base64
import os

import pycore.pyctl.ai.speech_history as speech_history
import pycore.pyfoundations.system_launcher as system_launcher


def history(limit: int = 50):
    """Newest-first speech records (tts/stt) with absolute path for show-location."""
    return {"success": True, "entries": speech_history.list_history(limit)}


def history_file(audio_id: str):
    """Audio bytes for one record id as base64 (inline playback)."""
    data, mime = speech_history.read_audio(audio_id)
    if not data:
        return {"success": False, "error": "not found"}
    return {
        "success": True,
        "mime": mime or "audio/mpeg",
        "content_base64": base64.b64encode(data).decode("ascii"),
        "bytes": len(data),
    }


def history_reveal(audio_id: str):
    """Open the audio clip's containing folder in the OS file manager. The path is
    resolved from the store BY ID (never an arbitrary client path)."""
    path = speech_history.entry_path(audio_id)
    if not path or not os.path.exists(path):
        return {"success": False, "error": "file not found"}
    ok = system_launcher.open_dir(os.path.dirname(path))
    return {"success": bool(ok), "path": path}


def history_delete(audio_id: str):
    return {"success": speech_history.delete_entry(audio_id)}


def history_clear():
    return {"success": True, "removed": speech_history.clear_history()}
