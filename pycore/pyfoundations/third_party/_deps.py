# -*- coding: utf-8 -*-
"""
Dependency tables and constants for the third_party package.

Maps the required import name to the official PyPI package name.
All new third-party dependencies for any tool must be added here.

Version constraints: removed per project policy (no version pinning in
third_party; pip resolves dependencies automatically).

IMPORTANT: DO NOT MODIFY platform-specific package filtering logic in _dep_check.
Windows-only packages are automatically skipped on Linux/Mac systems.
"""

import os
import platform
import importlib.util
from typing import Optional

# Dependency Map
# Maps the required import name to the official PyPI package name.
# All new third-party dependencies for any tool must be added here.
#
# Version constraints can be specified using pip syntax (e.g., "package<2.0,>=1.5")
# Version constraints: removed per project policy (no version pinning in third_party; pip resolves dependencies automatically)
DEPENDENCY_MAP = {
    # PIL is the import name for the Pillow package (PyPI: Pillow). No version pin; use latest.
    # tkhtmlview 0.3.2 requires Pillow>=11,<13; pip resolves when both are installed.
    "PIL": "Pillow",

    # For computer vision tasks (use latest; 3.4->4.x has C API/constant changes)
    "cv2": "opencv-python",

    # For window automation and screenshots
    "pyautogui": "pyautogui",

    # For process management
    "psutil": "psutil",

    # For fast screenshots
    "mss": "mss",

    # For YOLO training and deep learning
    "torch": "torch",
    # ultralytics: YOLO (YOLOv8/YOLO26 etc.); latest 8.4.x, Predict/Export/Track/Benchmark
    "ultralytics": "ultralytics>=8.0",
    # numpy: no version constraint; use latest (pip resolves dependencies like opencv-python automatically)
    "numpy": "numpy",

    # For ADB communication
    "adb_shell": "adb-shell",

    # For video processing
    "av": "av",

    # For FastAPI web framework
    "uvicorn": "uvicorn[standard]",
    "websockets": "websockets",

    # For HTTP requests (2.x: timeout recommended, Session for pooling; GameAISDK uses via deps only)
    "requests": "requests>=2.28,<3",
    # urllib3 2.x: modern API (urllib3.request), connection pooling, TLS; requests depends on it
    "urllib3": "urllib3>=2.0,<3",
    # idna 3.x: Python 3-only, UTS 46, IDNA 2008; requests uses it for internationalized domains
    "idna": "idna>=3.0,<4",
    # chardet: universal encoding detector; requests uses it for response encoding
    "chardet": "chardet>=5.0,<6",
    # certifi: Mozilla CA bundle for TLS verification; requests uses it
    "certifi": "certifi>=2024.2.0",
    # zmq: import name "zmq", PyPI package "pyzmq"; ZeroMQ bindings for messaging
    "zmq": "pyzmq>=25,<28",
    # msgpack: binary serialization; 1.x uses use_bin_type=True by default, encoding option removed
    "msgpack": "msgpack>=1.0,<2",
    # werkzeug: WSGI library; tensorboard and others may depend on it; import name "werkzeug"
    "werkzeug": "Werkzeug>=3.0,<4",
    # h5py: HDF5 bindings; TF2/Keras often use 3.x; requires Python >=3.10 for 3.x
    "h5py": "h5py>=3.0,<4",
    # absl: Abseil Python; import name "absl", PyPI "absl-py"; TF and others may depend on it; 2.x requires Python >=3.10
    "absl": "absl-py>=2.0,<3",
    # protobuf: Protocol Buffers; import name "google.protobuf", PyPI "protobuf"; actual version constrained by tensorflow/grpcio
    # Latest 6.33.5 requires Python >=3.9; TF 2.20 requires >=5.28.0; current TF 1.10.0 may constrain to lower versions
    "google.protobuf": "protobuf>=3.7,<7",
    # grpc: gRPC Python; import name "grpc", PyPI "grpcio"; no version pin, use latest (tensorflow may also pull it)
    "grpc": "grpcio",
    # six: Python 2 and 3 compatibility library; latest 1.17.0; used by tensorflow/protobuf and others
    "six": "six>=1.17.0",
    "aiohttp": "aiohttp",
    "fastapi": "fastapi",
    # typing_extensions: transitive dep of pydantic/pydantic_core. Pin >=4.13.0
    # because recent pydantic_core imports `typing_extensions.Sentinel` (added in
    # 4.13.0). On Linux an OLD apt-packaged typing_extensions
    # (/usr/lib/python3/dist-packages) can shadow pip's and lacks Sentinel ->
    # "ImportError: cannot import name 'Sentinel'". Listing it here ensures a
    # compatible version is installed for fresh setups; existing boxes must
    # upgrade once: pip install -U "typing_extensions>=4.13".
    "typing_extensions": "typing_extensions>=4.13.0",

    # For GUI and HTML rendering (SDKTool uses PyQt5; pycore uses PySide6 for Qt6)
    "PyQt5": "PyQt5>=5.15,<6",
    # matplotlib: plotting; SDKTool uses pyplot/font_manager; do not limit version, use latest
    "matplotlib": "matplotlib",
    # labelme: image polygonal annotation (Qt GUI); SDKTool optional; no version pin, use latest
    "labelme": "labelme",
    # labelImg: VOC/YOLO bbox annotation (Qt GUI); TrainDetModel.md section 3, yolo_label_lib; no version pin
    "labelImg": "labelImg",
    "tkinterweb": "tkinterweb",
    "tkhtmlview": "tkhtmlview",
    "pystray": "pystray",

    # For logging
    "loguru": "loguru",

    # For YAML configuration
    "yaml": "pyyaml",

    # cnocr: do NOT add here. Load/install only via get_third_package_cnocr() (GPU/CPU by CUDADetector).
    # For CnOCR/CnSTD model auto-download; CLI is built-in as entry point "hf" (official: https://hf.co/docs/huggingface_hub/installation)
    "huggingface_hub": "huggingface_hub",

    # For OCR (Tesseract wrapper; tesseract-ocr system binary is installed by the
    # installers). Imported directly by ocr_processor.py.
    "pytesseract": "pytesseract",

    # For document processing
    "pypdf": "pypdf",
    "pdfplumber": "pdfplumber",
    "docx": "python-docx",
    "openpyxl": "openpyxl",
    "pptx": "python-pptx",

    # For HTML parsing
    "bs4": "beautifulsoup4",

    # For machine learning and color analysis
    "sklearn": "scikit-learn",

    # For browser automation (pybrowser)
    "selenium": "selenium",
    "webdriver_manager": "webdriver-manager",

    # For database operations
    "sqlalchemy": "sqlalchemy",

    # For MCP (Model Context Protocol) servers - FastMCP v2
    "fastmcp": "fastmcp",

    # For Azure Speech SDK (optional, but can be auto-installed)
    # Note: Import name uses dots (azure.cognitiveservices.speech)
    #       Package name uses hyphens (azure-cognitiveservices-speech)
    #       Install with: pip install azure-cognitiveservices-speech
    "azure.cognitiveservices.speech": "azure-cognitiveservices-speech",

    # For offline STT (local provider)
    "vosk": "vosk",

    # For global hotkey listening (keyboard and mouse)
    "pynput": "pynput",

    # For clipboard operations (cross-platform)
    "pyperclip": "pyperclip",

    # For Google Translate API (unofficial)
    "googletrans": "googletrans",
    "httpx": "httpx",

    # For OKX exchange API
    "okx": "python-okx",

    # For Redis cache
    "redis": "redis",

    # For Google Gemini API (google.genai)
    "google.genai": "google-genai",

    # For OpenAI-compatible AI providers (OpenAI, DeepSeek via base_url, etc.)
    # DeepSeek is OpenAI-API-compatible: same SDK, base_url=https://api.deepseek.com
    "openai": "openai",

    # For audio playback (cross-platform, supports MP3/OGG/WAV)
    "pygame": "pygame",

    # For native UI (cross-platform GUI framework)
    "PySide6": "PySide6",

    # For phonetic transcription (IPA - International Phonetic Alphabet)
    "eng_to_ipa": "eng-to-ipa",

    # For machine-bound password encryption (Fernet)
    "cryptography": "cryptography",
}

# Optional packages - won't cause import failure if missing
# These packages are optional and the code handles their absence gracefully
OPTIONAL_PACKAGES = {
    # For Edge TTS (Microsoft Edge Text-to-Speech - optional)
    "edge_tts": "edge-tts",
    # For Whisper STT (OpenAI Whisper Speech-to-Text - optional)
    "whisper": "openai-whisper",
    # For filesystem/watch file change (log monitor - optional)
    "watchdog": "watchdog",

    # For native Linux system tray (Ubuntu/GNOME) - optional
    # Note: Requires system packages: gir1.2-appindicator3-0.1, libgirepository1.0-dev
    # Install with: sudo apt-get install python3-gi gir1.2-appindicator3-0.1
    # Or: ./scripts/install_ubuntu_tray_support.sh
    "gi": "PyGObject",

    # For EPUB ebook text extraction (Books ingest) - optional; book_processor
    # falls back to a stdlib zipfile + tag-strip when absent.
    "ebooklib": "ebooklib",
    # For legacy .rtf text extraction (Books ingest) - optional; book_processor
    # falls back to a stdlib control-word regex strip when absent.
    "striprtf": "striprtf",
    # Faster/robuster HTML/XML parser for BeautifulSoup (Books ingest) - optional;
    # bs4 falls back to the stdlib "html.parser" when lxml is absent.
    "lxml": "lxml",
    # For WordNet English definitions/synonyms in the offline dictionary
    # (pyutils/translator/dictionary) - optional; the dictionary works on ECDICT
    # alone. The WordNet *corpus* is fetched separately by install_dictionaries.sh
    # (nltk.download), this only ensures the nltk package.
    "nltk": "nltk",
}

# Windows-only optional: WinRT OCR (Windows.Media.Ocr). Multiple pip packages required; loaded via get_third_package_windows_ocr().
WINDOWS_OCR_WINRT_PACKAGES = [
    "winrt-Windows.Foundation",
    # OcrResult.lines / line.words are WinRT collections - without this projection
    # recognition raises "No module named 'winrt.windows.foundation.collections'".
    "winrt-Windows.Foundation.Collections",
    "winrt-Windows.Media.Ocr",
    "winrt-Windows.Graphics.Imaging",
    "winrt-Windows.Storage.Streams",
    "winrt-Windows.Globalization",
]

# Windows-only packages
# IMPORTANT: DO NOT MODIFY - These packages are only available on Windows
# The installation logic below automatically skips these on Linux/Mac
WINDOWS_ONLY_PACKAGES = {
    # For win_actor, tray_clicker, ui_analyzer
    "win32gui": "pywin32",
    "win32con": "pywin32",
    "win32api": "pywin32",
    "win32ui": "pywin32",

    # For tray_clicker, ui_analyzer
    "pywinauto": "pywinauto",

    # For window management (Windows-specific)
    "pygetwindow": "pygetwindow",

    # For UI automation (Windows-specific)
    "uiautomation": "uiautomation",

    # For audio with WASAPI loopback support (Windows-specific)
    "pyaudiowpatch": "pyaudiowpatch",

    # For audio input/output (Windows-only due to portaudio dependency issues on Linux)
    "pyaudio": "pyaudio",
}

# NOTE: System packages (python3-tk, python3-gi, etc.) are now installed by
# scripts/shells/linux/debian/install_shells/13_ensure_python.sh
# This file only handles Python packages installable via pip

# PyTorch CUDA wheel index - DRIVER-MATCHED (resolved by _resolve_pytorch_cuda_index_url),
# NOT hardcoded. A wheel built for a CUDA NEWER than the driver supports fails
# torch.cuda.is_available() ("driver too old"), and the import-time reinstall below would
# then LOOP, re-downloading hundreds of MB every launch. We pick the highest published wheel
# whose CUDA version <= the driver's CUDA version (nvidia-smi "CUDA Version: X.Y"). Driver ->
# max CUDA (NVIDIA CUDA compatibility): 550 -> 12.4, 560 -> 12.6, 570 -> 12.8, 580 -> 13.0.
# This env var, when set, overrides the auto-detection entirely.
PYTORCH_CUDA_INDEX_URL = os.environ.get("PYTORCH_CUDA_INDEX_URL", "").strip()
# KEEP IN SYNC with the shell SSOT scripts/shells/linux/common/base_libs/cuda_index.sh
# (its cv-threshold ladder, lines ~23-29). This Python copy is consulted ONLY when that .sh is
# unreachable (e.g. Windows: no bash) - there it is authoritative - so an edit to one ladder
# MUST be mirrored here, or Windows and Linux would resolve different wheels.
_PYTORCH_CUDA_WHEELS = (  # (cuda_major, cuda_minor, wheel_tag), highest first
    (13, 0, "cu130"), (12, 8, "cu128"), (12, 6, "cu126"),
    (12, 4, "cu124"), (12, 1, "cu121"), (11, 8, "cu118"),
)
# Last-resort fallback ONLY (used when both the shell helper cuda_index.sh AND
# nvidia-smi are unreachable). Keep this value identical to that .sh's default so the two
# never disagree; normal resolution syncs from the system / the .sh, not from here.
_PYTORCH_CUDA_DEFAULT_TAG = "cu124"
# CPU-only PyTorch wheels (no nvidia-* CUDA deps). Used on hosts WITHOUT an NVIDIA
# GPU so torch does not drag in ~4.3G of nvidia-* wheels. See pytorch.org/get-started.
PYTORCH_CPU_INDEX_URL = "https://download.pytorch.org/whl/cpu"

# GUI/Qt-only packages. On HEADLESS Linux (no DISPLAY/Wayland) there is no display to
# render them, so they are skipped during the import-time auto-install to avoid heavy
# desktop deps (PySide6 ~629M, PyQt5 ~202M; labelme/labelImg pull Qt). They still
# lazy-install on demand via their getters if a desktop feature is actually invoked.
# Override: PYCORE_FORCE_GUI=1 installs them anyway; PYCORE_HEADLESS=1 forces skip.
GUI_ONLY_IMPORTS = {"PySide6", "PyQt5", "labelme", "labelImg"}

# Packages whose top-level is importable even when the real compiled modules are absent,
# so `find_spec(top_level)` is a false positive. On Debian/Kali PySide6 is split into
# per-module apt packages: the base `libpyside6-py3` ships PySide6/__init__.py (so
# `import PySide6` succeeds) while QtCore/QtWebEngine* live in separate packages that may
# be missing. Probe a representative submodule the app actually needs so an incomplete
# install is detected and the full PyPI wheel (Essentials + Addons) is (re)installed.
_INSTALL_PROBE_SUBMODULE = {
    "PySide6": "PySide6.QtWebEngineWidgets",  # Addons; the wheel install also brings QtCore
}


def _module_install_ok(import_name: Optional[str]) -> bool:
    """True if `import_name` is genuinely importable. For split packages it probes a real
    submodule (see _INSTALL_PROBE_SUBMODULE) instead of the empty top-level stub. Any
    find_spec error (e.g. ABI-broken .so) counts as not installed."""
    if not import_name:
        return False
    probe = _INSTALL_PROBE_SUBMODULE.get(import_name, import_name)
    try:
        return importlib.util.find_spec(probe) is not None
    except Exception:
        return False


def _is_headless_linux() -> bool:
    """True on Linux with no GUI display, so Qt/GUI auto-installs should be skipped."""
    if os.environ.get("PYCORE_FORCE_GUI") == "1":
        return False
    if os.environ.get("PYCORE_HEADLESS") == "1":
        return True
    if platform.system() != "Linux":
        return False
    return not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
