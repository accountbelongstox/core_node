# -*- coding: utf-8 -*-
"""
Optional / special getters (azure, edge_tts, vosk, whisper, watchdog, tkinter,
pyside6, pyaudio, win32* family, windows_ocr, sherpa_onnx, melo, pywinauto,
pygetwindow, uiautomation, pyaudiowpatch, PIL_*_optional, speechsdk).
"""

import os
import sys
import importlib
import platform

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from ._cache import _PACKAGE_CACHE, _lazy_import
from ._deps import OPTIONAL_PACKAGES, WINDOWS_OCR_WINRT_PACKAGES
from ._pip_runner import (
    build_pip_install_command,
    run_pip_install_with_realtime_output,
    _is_pip_package_installed,
)
from ._torch_cuda import _ensure_sherpa_onnx_cpu_build_when_no_gpu


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


def _edge_tts_version_ge(version: str, minimum: str) -> bool:
    """True if dotted `version` >= `minimum` (numeric-aware, no packaging dep)."""
    def parts(v):
        out = []
        for p in str(v).split('.'):
            num = ''.join(ch for ch in p if ch.isdigit())
            out.append(int(num) if num else 0)
        return out
    a, b = parts(version), parts(minimum)
    a += [0] * (len(b) - len(a))
    b += [0] * (len(a) - len(b))
    return a >= b


def install_and_reimport_edge_tts():
    """
    Install / upgrade Edge TTS and import it. Targets the LATEST release.

    History: edge-tts 7.2.3 hit a server-side outage -> NoAudioReceived (issue
    #443); the same-day workaround was "pin 7.2.1". That fix shipped in 7.2.4
    ("Resolve NoAudioReceived issue"). Pinning an OLD version is now harmful: a
    stale Sec-MS-GEC handshake gets rejected with HTTP 403 (issues #290/#458).
    So we require >= 7.2.4 and upgrade to the latest otherwise. A 403 on the
    latest version is rate-limit / regional blocking (set EDGE_TTS_PROXY), not a
    version problem.

    Returns:
        The imported module if successful, None otherwise.
    """
    MIN_VERSION = "7.2.4"   # first release that resolved NoAudioReceived

    # Try direct hard import first.
    try:
        import edge_tts
        current_version = getattr(edge_tts, '__version__', '0')

        if _edge_tts_version_ge(current_version, MIN_VERSION):
            ColorPrint.green(f"[SUCCESS] Edge TTS {current_version} is compatible (>= {MIN_VERSION})")
            return edge_tts

        ColorPrint.yellow(f"[WARNING] Edge TTS {current_version} is too old (< {MIN_VERSION}); "
                          "old versions 403 on a stale Sec-MS-GEC handshake. Upgrading to latest...")
        pip_cmd = build_pip_install_command("edge-tts")
        pip_cmd.append("--upgrade")
        run_pip_install_with_realtime_output(pip_cmd, "edge-tts (latest)")

        importlib.invalidate_caches()
        if 'edge_tts' in sys.modules:
            del sys.modules['edge_tts']
        import edge_tts
        new_version = getattr(edge_tts, '__version__', 'unknown')
        ColorPrint.green(f"[SUCCESS] Edge TTS upgraded from {current_version} to {new_version}")
        return edge_tts

    except ImportError:
        ColorPrint.blue("[INFO] Edge TTS not installed")
    except AttributeError:
        ColorPrint.yellow("[WARNING] Edge TTS installed but version cannot be detected")

    # Install the latest version.
    ColorPrint.blue("[INFO] Installing latest Edge TTS...")
    pip_cmd = build_pip_install_command("edge-tts")
    pip_cmd.append("--upgrade")
    run_pip_install_with_realtime_output(pip_cmd, "edge-tts (latest)")

    importlib.invalidate_caches()
    try:
        import edge_tts
        installed_version = getattr(edge_tts, '__version__', 'unknown')
        ColorPrint.green(f"[SUCCESS] Successfully installed Edge TTS {installed_version}")
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
            # IMPORTANT: Import tkinter.ttk to ensure ttk becomes an attribute of tkinter
            # This is required because tkinter.ttk is a submodule and not automatically imported
            import tkinter.ttk  # noqa: F401
            import tkinter.font  # noqa: F401
            import tkinter.messagebox  # noqa: F401
            import tkinter.filedialog  # noqa: F401
            import tkinter.scrolledtext  # noqa: F401
            _PACKAGE_CACHE['tkinter'] = _tkinter_module
        except ImportError as e:
            # tkinter import failed - guide user to run installation script
            import sys
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
