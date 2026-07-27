# -*- coding: utf-8 -*-
"""
NotebookLM STT Router

Auto-converts audio files in www/notebooklm/ to text subtitles.
Saves results to www/notebooksubtitles/ with caching.
"""

import json
import hashlib
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from pycore import ColorPrint, THREAD_BUS
from pycore.pyfoundations.system_paths import map_web_path
from pycore.pyutils.whisper_stt import whisper_stt_provider


router = APIRouter(prefix="/notebooklm-stt", tags=["notebooklm-stt"])

NOTEBOOKLM_AUDIO_DIR = map_web_path("www") / "notebooklm"
SUBTITLE_OUTPUT_DIR = map_web_path("www") / "notebooksubtitles"
CACHE_FILE = SUBTITLE_OUTPUT_DIR / ".stt_cache.json"

AUDIO_EXTENSIONS = {'.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac', '.opus'}

_AUTO_CONVERT_SIGNAL = "notebooklm_stt.auto_convert_enabled"
THREAD_BUS.signal(_AUTO_CONVERT_SIGNAL, False)


def _auto_convert_enabled() -> bool:
    return bool(THREAD_BUS.get_signal(_AUTO_CONVERT_SIGNAL, False))


def apply_notebooklm_auto_convert(enabled: bool, run_scan: bool = False) -> bool:
    """Set auto-convert flag (used by system_settings boot + settings API)."""
    enabled = bool(enabled)
    THREAD_BUS.signal(_AUTO_CONVERT_SIGNAL, enabled)
    if enabled:
        ColorPrint.green("[NotebookLM STT] Auto-convert enabled")
        if run_scan:
            _auto_convert_all()
    else:
        ColorPrint.yellow("[NotebookLM STT] Auto-convert disabled")
    return enabled


class SettingsRequest(BaseModel):
    """Settings request model"""
    enabled: bool


class ConvertRequest(BaseModel):
    """Manual convert request"""
    audio_file: str  # Relative path from notebooklm directory


def _ensure_dirs():
    """Ensure required directories exist"""
    NOTEBOOKLM_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    SUBTITLE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _load_cache() -> Dict[str, Dict]:
    """
    Load STT cache

    Returns:
        dict: Cache data with file_hash -> subtitle_info mapping
    """
    if not CACHE_FILE.exists():
        return {}

    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        ColorPrint.yellow(f"[NotebookLM STT] Failed to load cache: {e}")
        return {}


def _save_cache(cache_data: Dict[str, Dict]):
    """
    Save STT cache

    Args:
        cache_data: Cache data to save
    """
    try:
        _ensure_dirs()
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        ColorPrint.red(f"[NotebookLM STT] Failed to save cache: {e}")


def _calculate_file_hash(file_path: Path) -> str:
    """
    Calculate MD5 hash of file for cache key

    Args:
        file_path: Path to audio file

    Returns:
        str: MD5 hash of file
    """
    hash_md5 = hashlib.md5()
    try:
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception as e:
        ColorPrint.red(f"[NotebookLM STT] Failed to hash file {file_path}: {e}")
        return ""


def _scan_audio_files() -> List[Path]:
    """
    Scan audio files in notebooklm directory

    Returns:
        list: List of audio file paths
    """
    _ensure_dirs()

    audio_files = []
    for ext in AUDIO_EXTENSIONS:
        audio_files.extend(NOTEBOOKLM_AUDIO_DIR.rglob(f'*{ext}'))

    ColorPrint.blue(f"[NotebookLM STT] Found {len(audio_files)} audio files")
    return audio_files


def _convert_audio_to_text(audio_path: Path, use_cache: bool = True) -> Dict:
    """
    Convert audio file to text using Whisper STT

    Args:
        audio_path: Path to audio file
        use_cache: Use cached result if available

    Returns:
        dict: Conversion result with success, text, subtitle_path, cached
    """
    relative_path = audio_path.relative_to(NOTEBOOKLM_AUDIO_DIR)
    subtitle_filename = audio_path.stem + '.txt'
    subtitle_path = SUBTITLE_OUTPUT_DIR / relative_path.parent / subtitle_filename

    file_hash = _calculate_file_hash(audio_path)
    if not file_hash:
        return {
            'success': False,
            'error': 'Failed to calculate file hash',
            'audio_file': str(relative_path)
        }

    cache = _load_cache()
    cache_key = str(relative_path)

    if use_cache and cache_key in cache:
        cached_info = cache[cache_key]
        if cached_info.get('file_hash') == file_hash:
            if subtitle_path.exists():
                ColorPrint.cyan(f"[NotebookLM STT] Using cached result: {relative_path}")
                return {
                    'success': True,
                    'text': cached_info.get('text', ''),
                    'subtitle_path': str(subtitle_path),
                    'audio_file': str(relative_path),
                    'cached': True
                }

    ColorPrint.blue(f"[NotebookLM STT] Converting: {relative_path}")

    if not whisper_stt_provider._initialized:
        whisper_stt_provider.initialize()

    result = whisper_stt_provider.recognize_from_file(audio_path)

    if not result.get('success'):
        error_msg = result.get('error', 'Unknown error')
        ColorPrint.red(f"[NotebookLM STT] Conversion failed: {error_msg}")
        return {
            'success': False,
            'error': error_msg,
            'audio_file': str(relative_path)
        }

    text = result.get('text', '')

    subtitle_path.parent.mkdir(parents=True, exist_ok=True)
    with open(subtitle_path, 'w', encoding='utf-8') as f:
        f.write(text)

    cache[cache_key] = {
        'file_hash': file_hash,
        'text': text,
        'subtitle_path': str(subtitle_path),
        'language': result.get('language', 'unknown'),
        'model': result.get('model', 'unknown')
    }
    _save_cache(cache)

    ColorPrint.green(f"[NotebookLM STT] Conversion complete: {relative_path}")
    return {
        'success': True,
        'text': text,
        'subtitle_path': str(subtitle_path),
        'audio_file': str(relative_path),
        'cached': False,
        'language': result.get('language'),
        'model': result.get('model')
    }


def _auto_convert_all():
    """Auto-convert all audio files in background"""
    if not _auto_convert_enabled():
        ColorPrint.yellow("[NotebookLM STT] Auto-convert disabled, skipping")
        return

    ColorPrint.green("[NotebookLM STT] Starting auto-convert...")
    audio_files = _scan_audio_files()

    results = {
        'total': len(audio_files),
        'success': 0,
        'cached': 0,
        'failed': 0,
        'errors': []
    }

    for audio_file in audio_files:
        try:
            result = _convert_audio_to_text(audio_file, use_cache=True)
            if result['success']:
                results['success'] += 1
                if result.get('cached'):
                    results['cached'] += 1
            else:
                results['failed'] += 1
                results['errors'].append({
                    'file': str(audio_file.relative_to(NOTEBOOKLM_AUDIO_DIR)),
                    'error': result.get('error', 'Unknown error')
                })
        except Exception as e:
            results['failed'] += 1
            results['errors'].append({
                'file': str(audio_file.relative_to(NOTEBOOKLM_AUDIO_DIR)),
                'error': str(e)
            })
            ColorPrint.red(f"[NotebookLM STT] Exception: {e}")

    ColorPrint.green(f"[NotebookLM STT] Auto-convert complete: {results['success']}/{results['total']} successful ({results['cached']} cached), {results['failed']} failed")
    return results


@router.get("/status")
async def get_status():
    """Get STT service status"""
    return {
        'success': True,
        'enabled': _auto_convert_enabled(),
        'audio_dir': str(NOTEBOOKLM_AUDIO_DIR),
        'subtitle_dir': str(SUBTITLE_OUTPUT_DIR),
        'whisper_initialized': whisper_stt_provider._initialized
    }


@router.post("/settings")
async def update_settings(request: SettingsRequest, background_tasks: BackgroundTasks):
    """
    Update auto-convert settings

    Args:
        enabled: Enable/disable auto-convert
    """
    enabled = apply_notebooklm_auto_convert(
        request.enabled, run_scan=request.enabled
    )

    return {
        'success': True,
        'enabled': enabled,
        'message': f"Auto-convert {'enabled' if enabled else 'disabled'}"
    }


@router.post("/convert-all")
async def convert_all(background_tasks: BackgroundTasks):
    """Manually trigger convert all audio files"""
    if not _auto_convert_enabled():
        raise HTTPException(status_code=400, detail="Auto-convert is disabled")

    background_tasks.add_task(_auto_convert_all)

    return {
        'success': True,
        'message': 'Conversion started in background'
    }


@router.post("/convert")
async def convert_single(request: ConvertRequest):
    """
    Manually convert a single audio file

    Args:
        audio_file: Relative path from notebooklm directory
    """
    audio_path = NOTEBOOKLM_AUDIO_DIR / request.audio_file

    if not audio_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file not found: {request.audio_file}")

    if not audio_path.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {request.audio_file}")

    result = _convert_audio_to_text(audio_path, use_cache=True)

    if not result['success']:
        raise HTTPException(status_code=500, detail=result.get('error', 'Conversion failed'))

    return result


@router.get("/list")
async def list_audio_files():
    """List all audio files in notebooklm directory"""
    audio_files = _scan_audio_files()

    cache = _load_cache()

    file_list = []
    for audio_file in audio_files:
        relative_path = audio_file.relative_to(NOTEBOOKLM_AUDIO_DIR)
        cache_key = str(relative_path)

        file_info = {
            'path': str(relative_path),
            'size': audio_file.stat().st_size,
            'modified': audio_file.stat().st_mtime,
            'has_subtitle': cache_key in cache
        }

        if cache_key in cache:
            cached_info = cache[cache_key]
            subtitle_path = Path(cached_info['subtitle_path'])
            file_info['subtitle_exists'] = subtitle_path.exists()
            file_info['language'] = cached_info.get('language', 'unknown')

        file_list.append(file_info)

    return {
        'success': True,
        'files': file_list,
        'total': len(file_list)
    }


@router.delete("/cache")
async def clear_cache():
    """Clear STT cache"""
    try:
        if CACHE_FILE.exists():
            CACHE_FILE.unlink()
        ColorPrint.green("[NotebookLM STT] Cache cleared")
        return {
            'success': True,
            'message': 'Cache cleared'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {e}")
