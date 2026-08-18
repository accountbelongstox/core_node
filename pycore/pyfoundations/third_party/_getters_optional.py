# -*- coding: utf-8 -*-

"""
Optional / special getters (azure, edge_tts, vosk, whisper, faster-whisper, watchdog, tkinter,
pyside6, pyaudio, win32* family, windows_ocr, sherpa_onnx, melo, pywinauto,
pygetwindow, uiautomation, pyaudiowpatch, PIL_*_optional, speechsdk).
"""

import os
import sys
import importlib
import platform

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyfoundations.third_party._cache import _lazy_import
from pycore.pyfoundations.third_party._package_cache import _PACKAGE_CACHE
from pycore.pyfoundations.third_party._deps import OPTIONAL_PACKAGES, WINDOWS_OCR_WINRT_PACKAGES
from pycore.pyfoundations.third_party._pip_runner import (
    build_pip_install_command,
    run_pip_install_with_realtime_output,
    _is_pip_package_installed,
)
from pycore.pyfoundations.third_party._torch_cuda import _ensure_sherpa_onnx_cpu_build_when_no_gpu


def install_and_reimport_azure():
    """
    Install Azure Speech SDK package and reimport it.

    Direct hard import, no string variables, no DEPENDENCY_MAP lookup.

    Returns:
        The imported module if successful, None otherwise.
    """
    # Try direct hard import first
    try:
        import azure.cognitiveservices.speech
        return azure.cognitiveservices.speech
    except ImportError:
        pass

    # If import failed, install package directly
    ColorPrint.blue("[INFO] Installing Azure Speech SDK package...")
    pip_cmd = build_pip_install_command("azure-cognitiveservices-speech")
    run_pip_install_with_realtime_output(pip_cmd, "azure-cognitiveservices-speech")
    importlib.invalidate_caches()
    try:
        import azure.cognitiveservices.speech
        ColorPrint.green("[SUCCESS] Successfully installed and imported Azure Speech SDK")
        return azure.cognitiveservices.speech
    except ImportError as e:
        ColorPrint.yellow("[WARNING] Package installation completed but import still failed")
        ColorPrint.yellow("[WARNING] This may require a Python restart")
        return None


def install_and_reimport_edge_tts():
    """Import Edge TTS, installing it once only when pip metadata is absent."""
    try:
        import edge_tts
        ColorPrint.green("[SUCCESS] Edge TTS is available")
        return edge_tts
    except ImportError:
        pass

    if _is_pip_package_installed("edge-tts"):
        ColorPrint.yellow("[WARNING] Edge TTS metadata exists but import failed; preserving it for installer repair")
        return None

    ColorPrint.blue("[INFO] Installing missing Edge TTS...")
    pip_cmd = build_pip_install_command("edge-tts")
    run_pip_install_with_realtime_output(pip_cmd, "edge-tts")

    importlib.invalidate_caches()
    try:
        import edge_tts
        ColorPrint.green("[SUCCESS] Successfully installed Edge TTS")
        return edge_tts
    except ImportError as e:
        ColorPrint.yellow("[WARNING] Package installation completed but import still failed")
        ColorPrint.yellow("[WARNING] This may require a Python restart")
        return None


# Optional packages
def get_third_package_speechsdk():
    """Get Azure Speech SDK (lazy load, optional)"""
    skip_install = os.environ.get('PYCORE_SKIP_SPEECHSDK') == '1'
    if 'speechsdk' not in _PACKAGE_CACHE:
        if skip_install:
            try:
                import azure.cognitiveservices.speech as speechsdk
                _PACKAGE_CACHE['speechsdk'] = speechsdk
            except ImportError:
                ColorPrint.yellow("[WARNING] Azure Speech SDK not available (install skipped)")
                _PACKAGE_CACHE['speechsdk'] = None
        else:
            _PACKAGE_CACHE['speechsdk'] = install_and_reimport_azure()
    return _PACKAGE_CACHE['speechsdk']


def get_third_package_edge_tts():
    """Get Edge TTS (lazy load, optional)"""
    if 'edge_tts' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['edge_tts'] = install_and_reimport_edge_tts()
    return _PACKAGE_CACHE['edge_tts']


def get_third_package_vosk():
    """Get Vosk package (lazy load, optional)"""
    if 'vosk' not in _PACKAGE_CACHE:
        try:
            import vosk
            _PACKAGE_CACHE['vosk'] = vosk
        except ImportError:
            ColorPrint.yellow("[WARNING] Vosk not available")
            _PACKAGE_CACHE['vosk'] = None
    return _PACKAGE_CACHE['vosk']


def get_third_package_whisper():
    """Get OpenAI Whisper package (lazy load, optional)"""
    if 'whisper' not in _PACKAGE_CACHE:
        try:
            import whisper
            _PACKAGE_CACHE['whisper'] = whisper
        except ImportError:
            ColorPrint.yellow("[WARNING] Whisper not available")
            ColorPrint.yellow("[WARNING] Install with: pip install -U openai-whisper")
            _PACKAGE_CACHE['whisper'] = None
    return _PACKAGE_CACHE['whisper']


def get_third_package_faster_whisper():
    """Get Faster-Whisper package (lazy load, optional)."""
    if 'faster_whisper' not in _PACKAGE_CACHE:
        try:
            import faster_whisper
            _PACKAGE_CACHE['faster_whisper'] = faster_whisper
        except ImportError:
            ColorPrint.yellow("[WARNING] Faster-Whisper not available")
            _PACKAGE_CACHE['faster_whisper'] = None
    return _PACKAGE_CACHE['faster_whisper']


def get_third_package_easyocr():
    """Get EasyOCR package (lazy load, optional)."""
    if 'easyocr' not in _PACKAGE_CACHE:
        try:
            import easyocr
            _PACKAGE_CACHE['easyocr'] = easyocr
        except ImportError:
            ColorPrint.yellow("[WARNING] EasyOCR not available")
            _PACKAGE_CACHE['easyocr'] = None
    return _PACKAGE_CACHE['easyocr']


def _ensure_watchdog_submodules():
    """Load watchdog.observers and watchdog.events so callers can use Observer/FileSystemEventHandler.
    Official API: from watchdog.observers import Observer; from watchdog.events import FileSystemEventHandler."""
    import watchdog.observers  # noqa: F401
    import watchdog.events  # noqa: F401


def get_third_package_watchdog():
    """Get watchdog package (lazy load, optional). For file-change driven log monitor.
    On first use: try import; if missing, install via pip (OPTIONAL_PACKAGES) then retry; still fail -> cache None.
    Ensures observers/events submodules are loaded so .observers.Observer and .events.FileSystemEventHandler exist."""
    if 'watchdog' not in _PACKAGE_CACHE:
        try:
            import watchdog
            _PACKAGE_CACHE['watchdog'] = watchdog
            _ensure_watchdog_submodules()
        except ImportError:
            pip_package = OPTIONAL_PACKAGES.get('watchdog')
            if pip_package:
                ColorPrint.yellow(f"[INSTALL] watchdog not found. Installing '{pip_package}' for file-change driven log monitor...")
                pip_cmd = build_pip_install_command(pip_package)
                run_pip_install_with_realtime_output(pip_cmd, pip_package)
                importlib.invalidate_caches()
                try:
                    import watchdog
                    _PACKAGE_CACHE['watchdog'] = watchdog
                    _ensure_watchdog_submodules()
                except ImportError:
                    _PACKAGE_CACHE['watchdog'] = None
            else:
                _PACKAGE_CACHE['watchdog'] = None
    return _PACKAGE_CACHE['watchdog']


# Audio packages
def get_third_package_pyaudio():
    """Get pyaudio package (lazy load, may be None if not installed)"""
    if 'pyaudio' not in _PACKAGE_CACHE:
        try:
            import pyaudio
            _PACKAGE_CACHE['pyaudio'] = pyaudio
        except ImportError:
            ColorPrint.yellow("[WARNING] pyaudio not available")
            _PACKAGE_CACHE['pyaudio'] = None
    return _PACKAGE_CACHE['pyaudio']


# GUI packages
def get_third_package_tkinter():
    """Get tkinter module (lazy load, requires system packages on Linux)"""
    if 'tkinter' not in _PACKAGE_CACHE:
        try:
            import tkinter as _tkinter_module
            import tkinter.ttk
            import tkinter.font
            import tkinter.messagebox
            import tkinter.filedialog
            import tkinter.scrolledtext
            _PACKAGE_CACHE['tkinter'] = _tkinter_module
        except ImportError as e:
            # tkinter import failed - guide user to run installation script
            ColorPrint.red("[ERROR] Failed to import tkinter")
            ColorPrint.yellow(f"[INFO] Python: {sys.executable} (version {sys.version_info.major}.{sys.version_info.minor})")
            ColorPrint.yellow("")
            ColorPrint.yellow("[FIX] System packages required for tkinter are missing")
            ColorPrint.yellow("[FIX] Run the Python setup script to install them:")
            ColorPrint.yellow("")

            if platform.system() == 'Linux':
                ColorPrint.cyan("      sudo bash scripts/shells/linux/debian/install_shells/13_ensure_python.sh")
            else:
                ColorPrint.cyan("      (tkinter should be included with Python on Windows/Mac)")

            ColorPrint.yellow("")
            ColorPrint.yellow("[INFO] Required packages: python3.{}-tk, tk-dev, tcl-dev".format(sys.version_info.minor))

            raise ImportError(
                f"tkinter not available for Python {sys.version_info.major}.{sys.version_info.minor}\n"
                f"Run installation script: scripts/shells/linux/debian/install_shells/13_ensure_python.sh"
            ) from e
    return _PACKAGE_CACHE['tkinter']


def get_third_package_pyside6():
    """Get PySide6 package (lazy load)"""
    return _lazy_import('PySide6', 'import PySide6')


# Windows-only packages
def get_third_package_win32gui():
    """Get win32gui package (lazy load, Windows only)"""
    if platform.system() != 'Windows':
        return None
    return _lazy_import('win32gui', 'import win32gui')


def get_third_package_win32con():
    """Get win32con package (lazy load, Windows only)"""
    if platform.system() != 'Windows':
        return None
    return _lazy_import('win32con', 'import win32con')


def get_third_package_win32api():
    """Get win32api package (lazy load, Windows only)"""
    if platform.system() != 'Windows':
        return None
    return _lazy_import('win32api', 'import win32api')


def get_third_package_win32process():
    """Get win32process package (lazy load, Windows only)"""
    if platform.system() != 'Windows':
        return None
    return _lazy_import('win32process', 'import win32process')


def get_third_package_win32ui():
    """Get win32ui package (lazy load, Windows only)"""
    if platform.system() != 'Windows':
        return None
    return _lazy_import('win32ui', 'import win32ui')


def get_third_package_win32com_client():
    """Get win32com.client (lazy load, Windows only)."""
    if platform.system() != 'Windows':
        return None
    return _lazy_import(
        'win32com_client',
        'from win32com import client as win32com_client',
    )


def get_third_package_win32com_propsys():
    """Get win32com.propsys.propsys (lazy load, Windows only)."""
    if platform.system() != 'Windows':
        return None
    return _lazy_import(
        'win32com_propsys',
        'from win32com.propsys import propsys as win32com_propsys',
    )


def get_third_package_win32com_pscon():
    """Get win32com.propsys.pscon (lazy load, Windows only)."""
    if platform.system() != 'Windows':
        return None
    return _lazy_import(
        'win32com_pscon',
        'from win32com.propsys import pscon as win32com_pscon',
    )


def get_third_package_windows_ocr():
    """
    Get Windows native OCR (WinRT Windows.Media.Ocr) types. Windows only; optional.
    Returns a namespace-like object with: OcrEngine, SoftwareBitmap, BitmapPixelFormat,
    Buffer, Language, BitmapAlphaMode. None if not Windows or import/install fails.
    Ref: https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr
    """
    if platform.system() != 'Windows':
        return None
    cache_key = 'windows_ocr'
    if cache_key not in _PACKAGE_CACHE:
        try:
            from winrt.windows.media.ocr import OcrEngine, OcrResult, OcrLine, OcrWord
            from winrt.windows.graphics.imaging import (
                SoftwareBitmap,
                BitmapPixelFormat,
                BitmapAlphaMode,
            )
            from winrt.windows.storage.streams import Buffer
            from winrt.windows.globalization import Language
            from winrt.windows.foundation import IAsyncOperation
            _PACKAGE_CACHE[cache_key] = type('WindowsOcrNamespace', (), {
                'OcrEngine': OcrEngine,
                'OcrResult': OcrResult,
                'OcrLine': OcrLine,
                'OcrWord': OcrWord,
                'SoftwareBitmap': SoftwareBitmap,
                'BitmapPixelFormat': BitmapPixelFormat,
                'BitmapAlphaMode': BitmapAlphaMode,
                'Buffer': Buffer,
                'Language': Language,
                'IAsyncOperation': IAsyncOperation,
            })()
        except (ImportError, ModuleNotFoundError):
            for pkg in WINDOWS_OCR_WINRT_PACKAGES:
                if not _is_pip_package_installed(pkg):
                    ColorPrint.yellow(
                        "[INSTALL] Windows OCR (WinRT) not found. Installing '%s'..." % pkg
                    )
                    pip_cmd = build_pip_install_command(pkg)
                    run_pip_install_with_realtime_output(pip_cmd, pkg)
            importlib.invalidate_caches()
            try:
                from winrt.windows.media.ocr import OcrEngine, OcrResult, OcrLine, OcrWord
                from winrt.windows.graphics.imaging import (
                    SoftwareBitmap,
                    BitmapPixelFormat,
                    BitmapAlphaMode,
                )
                from winrt.windows.storage.streams import Buffer
                from winrt.windows.globalization import Language
                from winrt.windows.foundation import IAsyncOperation
                _PACKAGE_CACHE[cache_key] = type('WindowsOcrNamespace', (), {
                    'OcrEngine': OcrEngine,
                    'OcrResult': OcrResult,
                    'OcrLine': OcrLine,
                    'OcrWord': OcrWord,
                    'SoftwareBitmap': SoftwareBitmap,
                    'BitmapPixelFormat': BitmapPixelFormat,
                    'BitmapAlphaMode': BitmapAlphaMode,
                    'Buffer': Buffer,
                    'Language': Language,
                    'IAsyncOperation': IAsyncOperation,
                })()
            except (ImportError, ModuleNotFoundError):
                _PACKAGE_CACHE[cache_key] = None
    return _PACKAGE_CACHE[cache_key]


def get_third_package_sherpa_onnx():
    """
    Get sherpa-onnx (offline TTS/ASR) package (lazy load; optional).

    Installed by the edge-tts-sibling OCR/TTS prerequisite (install_tts_offline);
    NOT auto-installed here. Returns None when absent so the TTS orchestrator can
    fall through to the next engine. Pure-pip, identical on Windows/Linux.
    """
    if 'sherpa_onnx' not in _PACKAGE_CACHE:
        # CPU/GPU build guard: on a GPU-less host a stray '+cuda' wheel is switched
        # back to CPU before import (runs once; no-op when already CPU / GPU present).
        _ensure_sherpa_onnx_cpu_build_when_no_gpu()
        try:
            import sherpa_onnx
            _PACKAGE_CACHE['sherpa_onnx'] = sherpa_onnx
        except (ImportError, ModuleNotFoundError):
            _PACKAGE_CACHE['sherpa_onnx'] = None
    return _PACKAGE_CACHE['sherpa_onnx']


def get_third_package_melo():
    """
    Get MeloTTS (`melo`) package (lazy load; optional).

    Installed from git by the offline-TTS prerequisite (needs unidic-lite on
    Windows); NOT auto-installed here. Returns None when absent so the TTS
    orchestrator can fall through to the next engine.
    """
    if 'melo' not in _PACKAGE_CACHE:
        try:
            import melo
            _PACKAGE_CACHE['melo'] = melo
        except (ImportError, ModuleNotFoundError):
            _PACKAGE_CACHE['melo'] = None
        except Exception:
            # MeloTTS can raise non-ImportError at import (mecab/unidic on Windows).
            _PACKAGE_CACHE['melo'] = None
    return _PACKAGE_CACHE['melo']


def get_third_package_transformers():
    """Get transformers without runtime installation."""
    if 'transformers' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['transformers'] = (
            importlib.import_module('transformers')
            if importlib.util.find_spec('transformers') is not None
            else None
        )
    return _PACKAGE_CACHE['transformers']


def get_third_package_scipy():
    """Get scipy without runtime installation."""
    if 'scipy' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['scipy'] = (
            importlib.import_module('scipy')
            if importlib.util.find_spec('scipy') is not None
            else None
        )
    return _PACKAGE_CACHE['scipy']


def get_third_package_soundfile():
    """Get soundfile without runtime installation."""
    if 'soundfile' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['soundfile'] = (
            importlib.import_module('soundfile')
            if importlib.util.find_spec('soundfile') is not None
            else None
        )
    return _PACKAGE_CACHE['soundfile']


def get_third_package_parler_tts():
    """Get parler_tts without runtime installation."""
    if 'parler_tts' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['parler_tts'] = (
            importlib.import_module('parler_tts')
            if importlib.util.find_spec('parler_tts') is not None
            else None
        )
    return _PACKAGE_CACHE['parler_tts']


def get_third_package_voxcpm():
    """Get voxcpm without runtime installation."""
    if 'voxcpm' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['voxcpm'] = (
            importlib.import_module('voxcpm')
            if importlib.util.find_spec('voxcpm') is not None
            else None
        )
    return _PACKAGE_CACHE['voxcpm']


def get_third_package_pywinauto():
    """Get pywinauto package (lazy load, Windows only)"""
    if 'pywinauto' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import pywinauto
            _PACKAGE_CACHE['pywinauto'] = pywinauto
        else:
            _PACKAGE_CACHE['pywinauto'] = None
    return _PACKAGE_CACHE['pywinauto']


def get_third_package_pygetwindow():
    """Get pygetwindow package (lazy load, Windows only)"""
    if 'pygetwindow' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import pygetwindow
            _PACKAGE_CACHE['pygetwindow'] = pygetwindow
        else:
            _PACKAGE_CACHE['pygetwindow'] = None
    return _PACKAGE_CACHE['pygetwindow']


def get_third_package_uiautomation():
    """Get uiautomation package (lazy load, Windows only)"""
    if 'uiautomation' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import uiautomation
            _PACKAGE_CACHE['uiautomation'] = uiautomation
        else:
            _PACKAGE_CACHE['uiautomation'] = None
    return _PACKAGE_CACHE['uiautomation']


def get_third_package_pyaudiowpatch():
    """Get pyaudiowpatch package (lazy load, Windows only)"""
    if 'pyaudiowpatch' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            try:
                import pyaudiowpatch
                _PACKAGE_CACHE['pyaudiowpatch'] = pyaudiowpatch
            except ImportError:
                ColorPrint.yellow("[WARNING] pyaudiowpatch not available (Windows loopback may not work)")
                _PACKAGE_CACHE['pyaudiowpatch'] = None
        else:
            _PACKAGE_CACHE['pyaudiowpatch'] = None
    return _PACKAGE_CACHE['pyaudiowpatch']
