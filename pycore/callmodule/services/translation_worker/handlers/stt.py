# -*- coding: utf-8 -*-
"""
STT lane handler (remote_stt): speech-to-text transcription.

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith: ``_process_stt_task`` + ``_stt_to_wav``. NOTE: ``_stt_to_wav`` already
uses the top-level ``pathlib.Path`` import (kept as-is).

CIRCULAR-IMPORT SAFE: imports stdlib + pyutils.stt (lazy) + ColorPrint + the sibling
``lane_gating`` module - never worker.py. The worker instance is passed at call time
(for ``_post_result`` + ``_requests``).
"""

import base64
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from .. import lane_gating


def process_stt_task(worker, task: Dict[str, Any]) -> None:
    """STT task: transcribe an audio clip to text via pyutils.stt.stt_orchestrator.

    Accepts audio as payload.file_path (local path), payload.audio_url (http(s)
    URL downloaded to a temp file), or payload.audio_base64 (base64-decoded to a
    temp file). Optional payload.language (BCP-47 or short code like 'en'/'zh').
    Result: {text, language, engine}. The orchestrator picks the best available
    engine (faster-whisper -> whisper -> vosk -> azure); vosk/azure need PCM wav
    so a non-wav input is converted via ffmpeg when one of those is chosen.

    Disabled / no audio / no engine / transcription failure -> 'failed'.
    """
    from pycore.pyutils.stt import stt_orchestrator

    task_id = task.get("task_id")
    if not lane_gating.stt_enabled():
        worker._post_result(task_id, "failed", error="stt disabled on this worker")
        return
    payload = task.get("payload") or {}
    language = (payload.get("language") or payload.get("source_language") or None)
    if isinstance(language, str):
        language = language.strip() or None

    tmp_path: Optional[str] = None
    owned_file = False  # True when we created the temp file (must clean up)
    try:
        file_path = (payload.get("file_path") or payload.get("audio_path") or "").strip()
        audio_url = (payload.get("audio_url") or payload.get("url") or "").strip()
        audio_b64 = payload.get("audio_base64") or payload.get("base64")

        if file_path and os.path.isfile(file_path):
            tmp_path = file_path
        elif audio_url:
            try:
                requests = worker._requests()
                fd, tmp_path = tempfile.mkstemp(prefix="worker_stt_", suffix=".mp3")
                os.close(fd)
                owned_file = True
                resp = requests.get(audio_url, timeout=60, stream=True)
                if resp.status_code != 200:
                    worker._post_result(task_id, "failed",
                                        error=f"stt audio download failed: HTTP {resp.status_code}")
                    return
                with open(tmp_path, "wb") as fh:
                    for chunk in resp.iter_content(8192):
                        if chunk:
                            fh.write(chunk)
            except Exception as e:
                worker._post_result(task_id, "failed", error=f"stt audio download error: {e}")
                return
        elif audio_b64:
            try:
                fd, tmp_path = tempfile.mkstemp(prefix="worker_stt_", suffix=".bin")
                os.close(fd)
                owned_file = True
                with open(tmp_path, "wb") as fh:
                    fh.write(base64.b64decode(audio_b64))
            except Exception as e:
                worker._post_result(task_id, "failed", error=f"stt base64 decode error: {e}")
                return
        else:
            worker._post_result(task_id, "failed",
                                error="stt task had no audio (file_path|audio_url|audio_base64)")
            return

        worker._post_result(task_id, "processing", progress=5, attempts=1)

        engine = stt_orchestrator.best_engine()
        if not engine:
            worker._post_result(task_id, "failed",
                                error="no STT engine available (install faster-whisper/whisper/vosk)")
            return

        audio_path = Path(tmp_path)
        # vosk/azure need 16k PCM wav; convert from compressed input via ffmpeg.
        needs_wav = engine in getattr(stt_orchestrator, "_NEEDS_WAV", set())
        if needs_wav and audio_path.suffix.lower() != ".wav":
            wav_path = _stt_to_wav(audio_path)
            if wav_path is None:
                # Fall back to an engine that decodes mp3 natively if possible.
                fallback = next(
                    (e for e in ("faster-whisper", "whisper")
                     if e != engine and stt_orchestrator.engine_available(e)), None)
                if not fallback:
                    worker._post_result(task_id, "failed",
                                        error=f"stt engine '{engine}' needs wav and ffmpeg is unavailable")
                    return
                engine = fallback
            else:
                audio_path = wav_path

        try:
            text = stt_orchestrator.transcribe(engine, audio_path, language)
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] stt task {task_id} failed: {e}")
            worker._post_result(task_id, "failed", error=f"stt transcription error: {e}")
            return

        if not text:
            worker._post_result(task_id, "failed", error="stt produced empty transcript")
            return

        result = {"text": text, "language": language or "auto", "engine": engine}
        worker._post_result(task_id, "completed", result=result, progress=100)
    finally:
        if owned_file and tmp_path and os.path.isfile(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def _stt_to_wav(src: Path) -> Optional[Path]:
    """Convert any audio file to a 16kHz mono PCM wav for vosk/azure via ffmpeg.

    Returns the wav path, or None when ffmpeg is unavailable / conversion fails.
    """
    import shutil
    import subprocess
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None
    fd, wav_path = tempfile.mkstemp(prefix="worker_stt_", suffix=".wav")
    os.close(fd)
    try:
        rc = subprocess.run(
            [ffmpeg, "-y", "-i", str(src), "-ar", "16000", "-ac", "1",
             "-f", "wav", str(wav_path)],
            capture_output=True, timeout=120,
        ).returncode
        if rc != 0 or not os.path.isfile(wav_path) or os.path.getsize(wav_path) == 0:
            return None
        return Path(wav_path)
    except Exception:
        return None
