# -*- coding: utf-8 -*-
"""NotebookLM audio transcription backed by the shared Whisper runtime."""

import hashlib
import json
from pathlib import Path
from typing import Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.system_paths import map_web_path
from pycore.pyutils.whisper_stt.whisper_provider import whisper_stt_provider


NOTEBOOKLM_AUDIO_DIR = map_web_path("www") / "notebooklm"
SUBTITLE_OUTPUT_DIR = map_web_path("www") / "notebooksubtitles"
CACHE_FILE = SUBTITLE_OUTPUT_DIR / ".stt_cache.json"
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac", ".opus"}
AUTO_CONVERT_SIGNAL = "notebooklm_stt.auto_convert_enabled"

THREAD_BUS.signal(AUTO_CONVERT_SIGNAL, False)


def apply_notebooklm_auto_convert(enabled: bool, run_scan: bool = False) -> bool:
    """Apply the auto-convert setting and optionally scan existing audio."""
    enabled = bool(enabled)
    THREAD_BUS.signal(AUTO_CONVERT_SIGNAL, enabled)
    ColorPrint.green(
        f"[NotebookLM STT] Auto-convert {'enabled' if enabled else 'disabled'}"
    )
    if enabled and run_scan:
        convert_all_audio()
    return enabled


def get_status() -> Dict:
    """Return the current service state."""
    return {
        "success": True,
        "enabled": _auto_convert_enabled(),
        "audio_dir": str(NOTEBOOKLM_AUDIO_DIR),
        "subtitle_dir": str(SUBTITLE_OUTPUT_DIR),
        "whisper_initialized": whisper_stt_provider._initialized,
    }


def convert_all_audio() -> Dict:
    """Convert every supported audio file when auto-convert is enabled."""
    results = {"total": 0, "success": 0, "cached": 0, "failed": 0, "errors": []}
    if not _auto_convert_enabled():
        return {"success": False, "error": "Auto-convert is disabled"}

    audio_files = _scan_audio_files()
    results["total"] = len(audio_files)
    for audio_file in audio_files:
        try:
            result = convert_audio(audio_file)
            if result["success"]:
                results["success"] += 1
                if result.get("cached"):
                    results["cached"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({
                    "file": str(audio_file.relative_to(NOTEBOOKLM_AUDIO_DIR)),
                    "error": result.get("error", "Unknown error"),
                })
        except Exception as exc:
            results["failed"] += 1
            results["errors"].append({
                "file": str(audio_file.relative_to(NOTEBOOKLM_AUDIO_DIR)),
                "error": str(exc),
            })
            ColorPrint.red(f"[NotebookLM STT] Conversion failed ({exc})")

    return {"success": results["failed"] == 0, **results}


def convert_relative_audio(audio_file: str) -> Dict:
    """Convert one audio file identified relative to the NotebookLM directory."""
    requested_path = (NOTEBOOKLM_AUDIO_DIR / audio_file).resolve()
    audio_root = NOTEBOOKLM_AUDIO_DIR.resolve()
    try:
        requested_path.relative_to(audio_root)
    except ValueError:
        return {"success": False, "error": "Audio file must be inside the NotebookLM directory"}
    if not requested_path.is_file():
        return {"success": False, "error": f"Audio file not found: {audio_file}"}
    return convert_audio(requested_path)


def convert_audio(audio_path: Path, use_cache: bool = True) -> Dict:
    """Transcribe one audio file and cache its subtitle text."""
    relative_path = audio_path.relative_to(NOTEBOOKLM_AUDIO_DIR)
    subtitle_path = SUBTITLE_OUTPUT_DIR / relative_path.parent / f"{audio_path.stem}.txt"
    file_hash = _calculate_file_hash(audio_path)
    if not file_hash:
        return {"success": False, "error": "Failed to calculate file hash"}

    cache = _load_cache()
    cache_key = str(relative_path)
    cached_info = cache.get(cache_key, {})
    if use_cache and cached_info.get("file_hash") == file_hash and subtitle_path.exists():
        return {
            "success": True,
            "text": cached_info.get("text", ""),
            "subtitle_path": str(subtitle_path),
            "audio_file": str(relative_path),
            "cached": True,
        }

    if not whisper_stt_provider._initialized:
        whisper_stt_provider.initialize()
    result = whisper_stt_provider.recognize_from_file(audio_path)
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", "Unknown error"),
            "audio_file": str(relative_path),
        }

    text = result.get("text", "")
    subtitle_path.parent.mkdir(parents=True, exist_ok=True)
    subtitle_path.write_text(text, encoding="utf-8")
    cache[cache_key] = {
        "file_hash": file_hash,
        "text": text,
        "subtitle_path": str(subtitle_path),
        "language": result.get("language", "unknown"),
        "model": result.get("model", "unknown"),
    }
    _save_cache(cache)
    return {
        "success": True,
        "text": text,
        "subtitle_path": str(subtitle_path),
        "audio_file": str(relative_path),
        "cached": False,
        "language": result.get("language"),
        "model": result.get("model"),
    }


def list_audio_files() -> Dict:
    """List supported audio files and their cache state."""
    cache = _load_cache()
    files: List[Dict] = []
    for audio_file in _scan_audio_files():
        relative_path = audio_file.relative_to(NOTEBOOKLM_AUDIO_DIR)
        cache_key = str(relative_path)
        cached_info = cache.get(cache_key)
        file_info = {
            "path": cache_key,
            "size": audio_file.stat().st_size,
            "modified": audio_file.stat().st_mtime,
            "has_subtitle": cached_info is not None,
        }
        if cached_info:
            file_info["subtitle_exists"] = Path(cached_info["subtitle_path"]).exists()
            file_info["language"] = cached_info.get("language", "unknown")
        files.append(file_info)
    return {"success": True, "files": files, "total": len(files)}


def clear_cache() -> Dict:
    """Remove the transcription cache file."""
    try:
        if CACHE_FILE.exists():
            CACHE_FILE.unlink()
        return {"success": True, "message": "Cache cleared"}
    except OSError as exc:
        return {"success": False, "error": f"Failed to clear cache: {exc}"}


def _auto_convert_enabled() -> bool:
    return bool(THREAD_BUS.get_signal(AUTO_CONVERT_SIGNAL, False))


def _ensure_dirs() -> None:
    NOTEBOOKLM_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    SUBTITLE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _scan_audio_files() -> List[Path]:
    _ensure_dirs()
    return [
        path
        for path in NOTEBOOKLM_AUDIO_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS
    ]


def _load_cache() -> Dict[str, Dict]:
    if not CACHE_FILE.exists():
        return {}
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        ColorPrint.yellow(f"[NotebookLM STT] Failed to load cache ({exc})")
        return {}


def _save_cache(cache: Dict[str, Dict]) -> None:
    try:
        _ensure_dirs()
        CACHE_FILE.write_text(
            json.dumps(cache, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        ColorPrint.red(f"[NotebookLM STT] Failed to save cache ({exc})")


def _calculate_file_hash(file_path: Path) -> str:
    digest = hashlib.md5()
    try:
        with file_path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(4096), b""):
                digest.update(chunk)
        return digest.hexdigest()
    except OSError as exc:
        ColorPrint.red(f"[NotebookLM STT] Failed to hash {file_path} ({exc})")
        return ""


__all__ = [
    "apply_notebooklm_auto_convert",
    "clear_cache",
    "convert_all_audio",
    "convert_relative_audio",
    "get_status",
    "list_audio_files",
]
