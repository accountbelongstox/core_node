"""
Audio helpers for the offline TTS engines.

Offline engines (sherpa-onnx, MeloTTS) emit float32 PCM / WAV, but the
voice-subtitle cache stores `.mp3`. These helpers write a WAV from raw samples
and transcode WAV -> MP3 via ffmpeg (already a runtime dependency for whisper).
"""

import shutil
import wave
from pathlib import Path
from typing import Any, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.safe_subprocess import subprocess

from pycore.pyfoundations.third_party import get_third_package_numpy



def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def write_wav(samples: Any, sample_rate: int, out_path: Path) -> bool:
    try:

        np = get_third_package_numpy()
        arr = np.asarray(samples, dtype=np.float32)
        arr = np.clip(arr, -1.0, 1.0)
        pcm16 = (arr * 32767.0).astype("<i2")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(out_path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(int(sample_rate))
            w.writeframes(pcm16.tobytes())
        return True
    except Exception as e:
        ColorPrint.red(f"[tts.audio] write_wav failed: {e}")
        return False


def wav_to_mp3(wav_path: Path, mp3_path: Path) -> bool:
    if not ffmpeg_available():
        ColorPrint.yellow("[tts.audio] ffmpeg not on PATH; cannot transcode WAV -> MP3")
        return False
    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(wav_path),
                "-codec:a",
                "libmp3lame",
                "-qscale:a",
                "2",
                str(mp3_path),
            ],
            capture_output=True,
            text=True,
        )
        if getattr(result, "returncode", 1) == 0 and mp3_path.exists():
            return True
        ColorPrint.red(
            f"[tts.audio] ffmpeg failed: {getattr(result, 'stderr', '')[:200]}"
        )
        return False
    except Exception as e:
        ColorPrint.red(f"[tts.audio] ffmpeg transcode error: {e}")
        return False


def samples_to_mp3(
    samples: Any,
    sample_rate: int,
    mp3_path: Path,
    tmp_wav: Optional[Path] = None,
) -> bool:
    tmp = tmp_wav or mp3_path.with_suffix(".tts.wav")
    if not write_wav(samples, sample_rate, tmp):
        return False
    try:
        return wav_to_mp3(tmp, mp3_path)
    finally:
        try:
            tmp.unlink()
        except OSError:
            pass


__all__ = ["ffmpeg_available", "write_wav", "wav_to_mp3", "samples_to_mp3"]
