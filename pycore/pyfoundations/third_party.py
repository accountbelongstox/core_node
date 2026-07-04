#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Third-Party Package Unified Import Manager

This module provides a unified interface for importing third-party packages
with automatic dependency checking and installation.

All third-party packages MUST be imported through this module.
Usage: from pycore.pyfoundations.third_party import aiohttp, netifaces, etc.
The module automatically checks and installs missing packages on first import.

Rule: This module must NOT import or reference pycore.pyutils (all imports at top are pyfoundations only).
""" 

import os
import sys
import importlib
import importlib.util
import importlib.metadata
import platform
import shutil
import zipfile
from pathlib import Path
from typing import Optional, List, Union, Tuple, Dict, Any, Callable

from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import (
    CUDADetector,
    CudaInitializer,
    get_cnocr_pip_package,
    get_ort_install_package,
    last_ort_install_ran,
    is_onnx_cuda_usable,
    ORT_CPU_PKG,
    ORT_GPU_PKG,
)
from pycore.pyfoundations.pybasecommon.safe_subprocess import subprocess
from pycore.pyfoundations.pybasecommon.commander import Commander

try:
    import torch
except ImportError:
    torch = None

# Dependency Map
# Maps the required import name to the official PyPI package name.
# All new third-party dependencies for any tool must be added here.
#
# Version constraints can be specified using pip syntax (e.g., "package<2.0,>=1.5")
# Version constraints: removed per project policy (no version pinning in third_party; pip resolves dependencies automatically)
#
# IMPORTANT: DO NOT MODIFY platform-specific package filtering logic below
# Windows-only packages are automatically skipped on Linux/Mac systems
DEPENDENCY_MAP = {
    # PIL is the import name for the Pillow package (PyPI: Pillow). No version pin; use latest.
    # tkhtmlview 0.3.2 requires Pillow>=11,<13; pip resolves when both are installed.
    "PIL": "Pillow",

    # For computer vision tasks (use latest; 3.4→4.x has C API/constant changes)
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
    # (/usr/lib/python3/dist-packages) can shadow pip's and lacks Sentinel →
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
    # labelImg: VOC/YOLO bbox annotation (Qt GUI); TrainDetModel.md §3, yolo_label_lib; no version pin
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
    # OcrResult.lines / line.words are WinRT collections — without this projection
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

# PyTorch CUDA wheel index — DRIVER-MATCHED (resolved by _resolve_pytorch_cuda_index_url),
# NOT hardcoded. A wheel built for a CUDA NEWER than the driver supports fails
# torch.cuda.is_available() ("driver too old"), and the import-time reinstall below would
# then LOOP, re-downloading hundreds of MB every launch. We pick the highest published wheel
# whose CUDA version <= the driver's CUDA version (nvidia-smi "CUDA Version: X.Y"). Driver ->
# max CUDA (NVIDIA CUDA compatibility): 550 -> 12.4, 560 -> 12.6, 570 -> 12.8, 580 -> 13.0.
# This env var, when set, overrides the auto-detection entirely.
PYTORCH_CUDA_INDEX_URL = os.environ.get("PYTORCH_CUDA_INDEX_URL", "").strip()
# KEEP IN SYNC with the shell SSOT scripts/shells/linux/common/base_libs/torch_cuda_index.sh
# (its cv-threshold ladder, lines ~23-29). This Python copy is consulted ONLY when that .sh is
# unreachable (e.g. Windows: no bash) — there it is authoritative — so an edit to one ladder
# MUST be mirrored here, or Windows and Linux would resolve different wheels.
_PYTORCH_CUDA_WHEELS = (  # (cuda_major, cuda_minor, wheel_tag), highest first
    (13, 0, "cu130"), (12, 8, "cu128"), (12, 6, "cu126"),
    (12, 4, "cu124"), (12, 1, "cu121"), (11, 8, "cu118"),
)
# Last-resort fallback ONLY (used when both the shell helper torch_cuda_index.sh AND
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

# ---------------------------------------------------------------------------
# Pip / command execution: SINGLE COMMON PATH (per Python subprocess docs)
# All third-party subprocess execution MUST go through run_third_party_command() only.
# - Stream mode (capture_output=False): Popen with stdout=None, stderr=None so output and
#   progress bar are real-time (docs: "With the default settings of None, no redirection will occur").
# - Capture mode (capture_output=True): subprocess.run(capture_output=True) for pip show etc.
# Ref: https://docs.python.org/3/library/subprocess.html
# ---------------------------------------------------------------------------


def run_third_party_command(
    cmd: list,
    description: str = "",
    capture_output: bool = False,
    timeout: Optional[int] = None,
) -> Optional[subprocess.CompletedProcess]:
    """
    THE SINGLE METHOD FOR ALL THIRD-PARTY SUBPROCESS EXECUTION IN THIS MODULE.
    Delegates to Commander.run_command (base implementation in pyfoundations).
    - capture_output=False (default): run with inherited stdout/stderr (real-time, progress bar).
    - capture_output=True: returns CompletedProcess (e.g. pip show).
    """
    if not capture_output:
        cmd_str = " ".join(str(x) for x in cmd)
        if description:
            print(f"[{description}] Executing: {cmd_str}")
        else:
            print(f"Executing command: {cmd_str}")
        sys.stdout.flush()
    return Commander.run_command(cmd, capture_output=capture_output, timeout=timeout)


def _is_pip_package_installed(package_name: str) -> bool:
    """Return True if the package is installed (pip show succeeds). Used to skip uninstall/install when no switch needed."""
    proc = run_third_party_command(
        [sys.executable, "-m", "pip", "show", package_name],
        capture_output=True,
        timeout=10,
    )
    return proc.returncode == 0 if proc is not None else False


def _run_pip_uninstall(package_name: str) -> None:
    """
    Run pip uninstall -y <package_name> with real-time output.
    Used before OCR init to clear the other ONNX runtime (onnxruntime vs onnxruntime-gpu mutually exclusive).
    Non-zero exit (e.g. package not installed) is ignored.
    """
    cmd = [sys.executable, "-m", "pip", "uninstall", "-y", package_name]
    run_third_party_command(cmd, "pip uninstall")


def _run_pip_install_for_ocr(package_name: str, index_url: Optional[str] = None) -> None:
    """
    Run pip install <package_name> with real-time output.
    Used to install onnxruntime-gpu[cuda,cudnn], onnxruntime, or nvidia-cublas-cu12. index_url optional.
    """
    pip_cmd = build_pip_install_command(package_name, index_url=index_url)
    run_pip_install_with_realtime_output(pip_cmd, package_name)


def _run_pip_install_for_ocr_force(package_name: str) -> None:
    """Run pip install <package_name> --force-reinstall. Used when ORT GPU is listed but import fails."""
    pip_cmd = build_pip_install_command(package_name) + ["--force-reinstall"]
    run_pip_install_with_realtime_output(pip_cmd, package_name)


def _fix_ort_dependency_conflicts() -> None:
    """
    Run only when ORT GPU was just installed (last_ort_install_ran()). Pip may then report numba/osam conflicts.
    Fix without version pinning: upgrade numba (may accept current numpy); reinstall osam --no-deps so it keeps using onnxruntime-gpu.
    """
    if not last_ort_install_ran():
        return
    if _is_pip_package_installed("numba"):
        ColorPrint.blue("[HF] Reinstalling numba (no version pin) after ORT install...")
        pip_cmd = build_pip_install_command("numba", upgrade=True)
        run_pip_install_with_realtime_output(pip_cmd, "numba")
    if _is_pip_package_installed("osam"):
        ColorPrint.blue("[HF] Reinstalling osam with --no-deps (onnxruntime-gpu satisfies runtime)...")
        pip_cmd = build_pip_install_command("osam", upgrade=True) + ["--no-deps"]
        run_pip_install_with_realtime_output(pip_cmd, "osam")


def _verify_onnx_import() -> bool:
    """Return True if 'import onnxruntime as ort; ort.get_available_providers()' succeeds in a subprocess."""
    proc = run_third_party_command(
        [sys.executable, "-c", "import onnxruntime as ort; ort.get_available_providers()"],
        capture_output=True,
        timeout=30,
    )
    return proc is not None and proc.returncode == 0


def _clear_cnocr_cache() -> None:
    """Remove cnocr from package cache and sys.modules so next get_cnocr re-imports with new ONNX runtime."""
    _PACKAGE_CACHE.pop("cnocr", None)
    for key in list(sys.modules.keys()):
        if key == "cnocr" or key.startswith("cnocr."):
            del sys.modules[key]
    importlib.invalidate_caches()


def _print_cuda_support_prompt():
    """
    Print whether current system supports CUDA (using CUDADetector).
    Official docs: https://pytorch.org/get-started/locally
    """
    info = CUDADetector.get_cuda_info()
    available = info.get("available", False)
    nvidia_smi_found = info.get("nvidia_smi_found", False)
    gpu_count = info.get("gpu_count", 0)
    driver_version = info.get("driver_version")
    gpus = info.get("gpus", [])
    cuda_env_vars = info.get("cuda_env_vars", {})

    ColorPrint.blue("[CUDA] Current system CUDA support check (see https://pytorch.org/get-started/locally):")
    if available:
        ColorPrint.blue("[CUDA] System supports CUDA.")
        if nvidia_smi_found:
            ColorPrint.blue(f"[CUDA] nvidia-smi: found. GPU count: {gpu_count}. Driver: {driver_version or 'N/A'}")
            for i, gpu in enumerate(gpus[:5], 1):
                name = gpu.get("name", "N/A")
                mem = gpu.get("memory_total", "")
                ColorPrint.blue(f"[CUDA]   GPU {i}: {name}" + (f" ({mem})" if mem else ""))
        if cuda_env_vars:
            ColorPrint.blue("[CUDA] CUDA env: " + " ".join(f"{k}={v}" for k, v in list(cuda_env_vars.items())[:3]))
    else:
        ColorPrint.yellow("[CUDA] System does NOT support CUDA (no nvidia-smi and no CUDA env).")
        if not nvidia_smi_found:
            ColorPrint.yellow("[CUDA] nvidia-smi not available. Install NVIDIA driver or see https://pytorch.org/get-started/locally")
        ColorPrint.yellow("[CUDA] Skipping PyTorch CUDA build; using CPU.")
    ColorPrint.blue("[CUDA] ---")


def _uninstall_orphan_nvidia_wheels():
    """Reclaim disk after switching torch to CPU on a no-GPU host: pip leaves the
    nvidia-* CUDA wheels (~4.3G) behind. Uninstall every nvidia-* and triton wheel."""
    proc = run_third_party_command(
        [sys.executable, "-m", "pip", "list", "--format=freeze"],
        capture_output=True,
        timeout=30,
    )
    if proc is None or proc.returncode != 0:
        return
    names = []
    for line in (proc.stdout or "").splitlines():
        name = line.split("==", 1)[0].strip()
        low = name.lower()
        if low.startswith("nvidia-") or low == "triton":
            names.append(name)
    if names:
        run_third_party_command(
            [sys.executable, "-m", "pip", "uninstall", "-y", *names],
            "pip uninstall nvidia-* (no GPU)",
        )


def _ensure_torch_cpu_build_when_no_gpu():
    """No NVIDIA GPU, but a CUDA build of torch is installed -> it dragged in ~4.3G of
    nvidia-* wheels for nothing. Reinstall the CPU build from the CPU index and remove
    the orphaned nvidia-* wheels. No-op if torch is absent or already the CPU build.
    Override: TORCH_FORCE_CUDA=1 leaves it alone."""
    if os.environ.get("TORCH_FORCE_CUDA") == "1":
        return
    if torch is None:
        return
    if getattr(torch.version, "cuda", None) is None:
        return  # already a CPU build
    ColorPrint.yellow(
        "[CUDA] No GPU detected, but torch is a CUDA build (pulls ~4.3G nvidia-*). "
        "Reinstalling the CPU build and removing nvidia-* wheels."
    )
    current_platform = platform.system()
    pip_cmd = [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio",
               "--index-url", PYTORCH_CPU_INDEX_URL, "--force-reinstall"]
    if current_platform != "Windows":
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    else:
        pip_cmd.append("--no-user")
    run_pip_install_with_realtime_output(pip_cmd, "torch (CPU, no GPU)")
    _uninstall_orphan_nvidia_wheels()
    importlib.invalidate_caches()
    if "torch" in sys.modules:
        del sys.modules["torch"]


_sherpa_onnx_build_checked = False


def _ensure_sherpa_onnx_cpu_build_when_no_gpu():
    """No NVIDIA GPU but a '+cuda' build of sherpa-onnx is installed -> switch to the
    CPU wheel from PyPI. Unlike torch, the sherpa-onnx CPU wheel is the DEFAULT and
    pulls no CUDA libs; the '+cuda' build needs the system CUDA Toolkit + cuDNN and
    is useless (often un-importable) without a GPU. Mirrors the install-time
    scripts/shells/linux/common/sherpa_onnx_cpu_guard.sh. Runs at most once / process.
    No-op if sherpa-onnx is absent, already CPU, or a GPU is present.
    Override: TORCH_FORCE_CUDA=1 / SHERPA_ONNX_FORCE_CUDA=1 leaves it alone."""
    global _sherpa_onnx_build_checked
    if _sherpa_onnx_build_checked:
        return
    _sherpa_onnx_build_checked = True
    if os.environ.get("TORCH_FORCE_CUDA") == "1" or os.environ.get("SHERPA_ONNX_FORCE_CUDA") == "1":
        return
    try:
        version = importlib.metadata.version("sherpa-onnx")
    except Exception:
        return  # not installed
    if "+cuda" not in (version or "").lower():
        return  # already the CPU build
    if CUDADetector.is_cuda_available():
        return  # GPU present -> keep the CUDA build
    ColorPrint.yellow(
        f"[sherpa] No GPU detected, but sherpa-onnx is a CUDA build ({version}); "
        "reinstalling the CPU wheel."
    )
    pip_cmd = [sys.executable, "-m", "pip", "install", "sherpa-onnx", "--force-reinstall"]
    if platform.system() != "Windows":
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    else:
        pip_cmd.append("--no-user")
    run_pip_install_with_realtime_output(pip_cmd, "sherpa-onnx (CPU, no GPU)")
    importlib.invalidate_caches()
    for _mod in list(sys.modules.keys()):
        if _mod == "sherpa_onnx" or _mod.startswith("sherpa_onnx."):
            del sys.modules[_mod]


def _detect_driver_cuda_version() -> Optional[Tuple[int, int]]:
    """The NVIDIA driver's MAX CUDA runtime version (major, minor) from `nvidia-smi`, or
    None. This bounds which torch CUDA wheel can actually initialize here — a wheel built for
    a newer CUDA than the driver supports trips torch.cuda.is_available()=False (the 'driver
    too old' UserWarning). nvidia-smi prints 'CUDA Version: X.Y' in its header."""
    if shutil.which("nvidia-smi") is None:
        return None
    proc = run_third_party_command(["nvidia-smi"], capture_output=True, timeout=15)
    out = (getattr(proc, "stdout", "") or "") if proc is not None else ""
    marker = "CUDA Version:"
    idx = out.find(marker)
    if idx == -1:
        return None
    try:
        frag = out[idx + len(marker):].strip().split()[0]  # e.g. "12.4"
        parts = frag.split(".")
        return (int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
    except (ValueError, IndexError):
        return None


def _resolve_pytorch_cuda_index_url() -> str:
    """Driver-matched PyTorch CUDA wheel index. Resolution order (so the default is NEVER a
    second hardcode — it auto-syncs from the system / the shell helper):
      1. env PYTORCH_CUDA_INDEX_URL — explicit override;
      2. the shared shell resolver scripts/shells/linux/common/base_libs/torch_cuda_index.sh
         — the SINGLE source of truth for the driver->wheel mapping AND the default, so this
         module and every *.sh installer always agree;
      3. in-process nvidia-smi parse (same mapping) only if that .sh is unreachable.
    """
    if PYTORCH_CUDA_INDEX_URL:
        return PYTORCH_CUDA_INDEX_URL
    # (2) Defer to the shell single-source-of-truth so Python + the *.sh installers can't
    # diverge (the default lives there, not here).
    try:
        helper = Path(__file__).resolve().parents[2] / "scripts/shells/linux/common/base_libs/torch_cuda_index.sh"
        if helper.is_file():
            proc = run_third_party_command(
                ["bash", "-c", '. "$1"; torch_cuda_index_url', "_", str(helper)],
                capture_output=True, timeout=20)
            url = (getattr(proc, "stdout", "") or "").strip() if proc is not None else ""
            if url.startswith("https://download.pytorch.org/whl/"):
                return url
    except Exception:
        pass
    # (3) Fallback only when the shell helper is missing: same driver->wheel mapping.
    drv = _detect_driver_cuda_version()
    tag = _PYTORCH_CUDA_DEFAULT_TAG
    if drv is not None:
        for cmaj, cmin, wheel in _PYTORCH_CUDA_WHEELS:
            if drv >= (cmaj, cmin):
                tag = wheel
                break
    return "https://download.pytorch.org/whl/" + tag


def _ensure_torch_cuda_build_first():
    """
    Run before other package checks. Ensure torch is CUDA build only when system supports CUDA.
    System support: NVIDIA GPU + driver (nvidia-smi or CUDA env). Per PyTorch docs: is_available() for runtime.
    On a host with NO GPU, ensure torch is the CPU build (not a stray CUDA build).
    """
    _print_cuda_support_prompt()

    # No CUDA support: make sure any stray CUDA-build torch is switched to CPU.
    if not CUDADetector.is_cuda_available():
        _ensure_torch_cpu_build_when_no_gpu()
        return

    if torch is not None and getattr(torch, "cuda", None) is not None and torch.cuda.is_available():
        return
    if torch is not None:
        if getattr(torch.version, "cuda", None) is None:
            ColorPrint.blue(
                "[INFO] Ensuring PyTorch CUDA build (current is CPU-only; system has NVIDIA GPU). "
                "See https://pytorch.org/get-started/locally"
            )
        else:
            if torch.cuda.is_available():
                return
            ColorPrint.blue("[INFO] Reinstalling PyTorch CUDA build (driver/runtime may need match)...")
    else:
        ColorPrint.blue("[INFO] Installing PyTorch with CUDA first (system has NVIDIA GPU)...")
    current_platform = platform.system()
    cuda_index_url = _resolve_pytorch_cuda_index_url()
    ColorPrint.blue("[INFO] PyTorch CUDA wheel index (driver-matched): " + cuda_index_url)
    # We only reach here when torch is missing OR present-but-cuda-unavailable (CPU-only build
    # OR a CUDA build too new for the driver, e.g. cu130 on a 12.4 driver). When REPLACING an
    # existing build, uninstall the importable torch stack FIRST and always --force-reinstall:
    # otherwise --ignore-installed merely drops the driver-matched wheel BESIDE the stale one,
    # the stale build keeps shadowing it, torch.cuda.is_available() stays False, and this
    # reinstall fires again on every launch (the ~5GB re-download loop). --ignore-installed is
    # still passed for the mpmath<1.4-no-RECORD case (Debian/Kali ship mpmath 1.4.x without a
    # RECORD file, which aborts a plain reinstall of torch's deps).
    if torch is not None:
        for _pkg in ("torch", "torchvision", "torchaudio"):
            _run_pip_uninstall(_pkg)
    pip_cmd = [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio",
               "--index-url", cuda_index_url]
    if current_platform != "Windows":
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    else:
        pip_cmd.append("--no-user")
    if torch is not None:
        pip_cmd.append("--force-reinstall")
    run_pip_install_with_realtime_output(pip_cmd, "torch (CUDA)")
    importlib.invalidate_caches()
    if "torch" in sys.modules:
        del sys.modules["torch"]

    # Verify CUDA torch actually loads (e.g. avoid WinError 127 from torch_cuda.dll). If not, install CPU build so app runs.
    proc = run_third_party_command(
        [sys.executable, "-c", "import torch"],
        capture_output=True,
        timeout=60,
    )
    if proc is not None and proc.returncode != 0:
        err = (proc.stderr or "").strip() or (proc.stdout or "").strip()
        ColorPrint.yellow(
            "[CUDA] PyTorch CUDA build failed to load (e.g. WinError 127 / missing DLL). Installing CPU build so the app can run."
        )
        if err:
            ColorPrint.yellow("[CUDA] Error: " + err[:400])
        pip_cpu = [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio", "--force-reinstall"]
        if current_platform != "Windows":
            pip_cpu.extend(["--break-system-packages", "--ignore-installed"])
        else:
            pip_cpu.append("--no-user")
        run_pip_install_with_realtime_output(pip_cpu, "torch (CPU fallback)")
        importlib.invalidate_caches()
        if "torch" in sys.modules:
            del sys.modules["torch"]


def build_pip_install_command(
    package_name: str,
    upgrade: bool = False,
    index_url: Optional[str] = None,
) -> list:
    """
    Build pip install command (list of args) with platform-specific flags.
    Callers must run it only via run_pip_install_with_realtime_output(pip_cmd, package_name).
    If upgrade is True, adds --upgrade. If index_url is set (e.g. ORT CUDA 11 feed), adds --index-url.
    """
    current_platform = platform.system()
    pip_cmd = [sys.executable, "-m", "pip", "install"]

    # On Linux/Mac, use --break-system-packages --ignore-installed for reliable installation
    # On Windows, use normal pip install
    if current_platform != 'Windows':
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    else:
        pip_cmd.append("--no-user")

    if upgrade:
        pip_cmd.append("--upgrade")
    if index_url:
        pip_cmd.extend(["--index-url", index_url])
    pip_cmd.append(package_name)
    return pip_cmd


def run_pip_install_with_realtime_output(pip_cmd: list, package_name: str) -> None:
    """
    THE SINGLE PUBLIC METHOD FOR ALL PIP EXECUTION IN THIS MODULE.
    Real-time output only, no ColorPrint; success/failure is entirely determined by pip.
    Every pip install (torch, deps, pip upgrade, optional packages) must call this only.
    """
    run_third_party_command(pip_cmd)


def run_command_with_realtime_output(cmd: list, description: str = "") -> None:
    """
    Run arbitrary command with same real-time behavior (inherited stdout/stderr, no ColorPrint).
    For pip, use run_pip_install_with_realtime_output instead.
    """
    run_third_party_command(cmd, description)


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


def check_and_install_dependencies():
    """
    Checks if all required packages are installed and installs them if not.
    Also performs GPU detection and setup. torch is a required package; ensure CUDA build first.
    """
    # Required package: ensure torch is CUDA build before any package list (not lazy)
    _ensure_torch_cuda_build_first()

    ColorPrint.blue("[INFO] Checking for required Python packages...")
    if ENCYCLOPEDIA.get("pycore_dependencies_checked", False):
        return

    if ENCYCLOPEDIA.get("pycore_dependencies_checking", False):
        return

    ENCYCLOPEDIA.add("pycore_dependencies_checking", True)

    # NOTE: System packages are now installed by shell scripts
    # See: scripts/shells/linux/debian/install_shells/13_ensure_python.sh

    installed_packages = set()
    missing_packages = set()
    installed_packages_list = []

    # Merge dependency maps based on platform
    # IMPORTANT: DO NOT MODIFY - Windows packages are automatically skipped on Linux/Mac
    current_platform = platform.system()

    # Required packages only (no optional packages during check)
    all_dependencies = dict(DEPENDENCY_MAP)
    if current_platform == 'Windows':
        all_dependencies.update(WINDOWS_ONLY_PACKAGES)
    else:
        ColorPrint.blue(f"[INFO] Skipping Windows-only packages on {current_platform}")

    # Headless Linux (no DISPLAY/Wayland): drop GUI-only Qt packages — there is no
    # display to use them and they are heavy (PySide6 ~629M, PyQt5 ~202M). They still
    # lazy-install on demand via their getters if a desktop feature actually runs.
    if _is_headless_linux():
        dropped = sorted({p for i, p in all_dependencies.items() if i in GUI_ONLY_IMPORTS})
        all_dependencies = {i: p for i, p in all_dependencies.items() if i not in GUI_ONLY_IMPORTS}
        if dropped:
            ColorPrint.blue(f"[INFO] Headless Linux (no display): skipping GUI-only packages: {', '.join(dropped)}")

    # Optional packages are not checked/installed automatically
    ColorPrint.blue("[INFO] Optional packages are not auto-installed")

    # Use a set to avoid checking/installing the same package multiple times (e.g., pywin32)
    packages_to_check = set(all_dependencies.values())

    # Check if any packages need installation/upgrade, and upgrade pip first if needed
    needs_installation = False
    for package_name in packages_to_check:
        import_name_to_check = None
        for imp, pkg in all_dependencies.items():
            if pkg == package_name:
                import_name_to_check = imp
                break
        if import_name_to_check and not _module_install_ok(import_name_to_check):
            needs_installation = True
            break
    
    # Upgrade pip first if any packages need installation
    if needs_installation:
        ColorPrint.blue("[INFO] Upgrading pip to latest version...")
        pip_upgrade_cmd = [sys.executable, "-m", "pip", "install", "--upgrade", "pip"]
        if current_platform != 'Windows':
            pip_upgrade_cmd.extend(["--break-system-packages", "--ignore-installed"])
        else:
            pip_upgrade_cmd.append("--no-user")
        run_pip_install_with_realtime_output(pip_upgrade_cmd, "pip")

    failed_packages = []
    
    for package_name in packages_to_check:
        # We check for the installation status of the package itself, not the import name.
        # A bit of a simplification, we assume the main importable module has a similar name
        # or that checking one is enough. For pywin32, checking 'win32gui' is a good proxy.

        # Find the import name associated with the package to check its spec
        import_name_to_check = None
        for imp, pkg in all_dependencies.items():
            if pkg == package_name:
                import_name_to_check = imp
                break

        # Probe importability; for split packages (PySide6) this checks a real submodule
        # so an incomplete top-level stub is not mistaken for a working install.
        is_installed = _module_install_ok(import_name_to_check)

        if not is_installed:
            missing_packages.add(package_name)
            ColorPrint.yellow(f"[INSTALL] Package for '{import_name_to_check}' ('{package_name}') not found. Installing...")

            # Build pip install command using reusable helper
            pip_cmd = build_pip_install_command(package_name)

            # Run installation with real-time output
            run_pip_install_with_realtime_output(pip_cmd, package_name)
            
            # Verify installation by checking if module can be imported (not by return code)
            importlib.invalidate_caches()
            try:
                if not _module_install_ok(import_name_to_check):
                    ColorPrint.yellow(f"[WARNING] Package {package_name} installed but import '{import_name_to_check}' still not available")
                    ColorPrint.yellow("[WARNING] This may require a Python restart or the package may need different import name")
                    failed_packages.append((package_name, import_name_to_check))
                else:
                    ColorPrint.green(f"[SUCCESS] Successfully installed {package_name}.")
                    installed_packages.add(package_name)
                    installed_packages_list.append(package_name)
            except Exception as e:
                ColorPrint.yellow(f"[WARNING] Error verifying '{import_name_to_check}' after installation: {e}")
                failed_packages.append((package_name, import_name_to_check))
        else:
            installed_packages.add(package_name)
            installed_packages_list.append(package_name)
    
    # Report failed packages if any
    if failed_packages:
        ColorPrint.yellow(f"[WARNING] {len(failed_packages)} package(s) failed to install or verify:")
        for pkg_name, import_name in failed_packages:
            ColorPrint.yellow(f"  - {import_name} ({pkg_name})")

    if installed_packages:
        ColorPrint.blue(f"[INFO] Found installed packages: {', '.join(sorted(installed_packages))}")
    ColorPrint.green("[INFO] All required packages are available.")


    # Mark as checked in ENCYCLOPEDIA (persists for entire Python process)
    ENCYCLOPEDIA.add("pycore_dependencies_checked", True)
    ENCYCLOPEDIA.add("pycore_installed_packages", sorted(installed_packages))
    # Remove checking flag
    ENCYCLOPEDIA.add("pycore_dependencies_checking", False)


# Auto-check dependencies when module is imported
# This ensures dependencies are available for all modules using third-party packages
# Uses ENCYCLOPEDIA for global caching - only runs once per Python process
# Can be disabled by setting PYCORE_SKIP_DEP_CHECK environment variable

if os.environ.get('PYCORE_SKIP_DEP_CHECK') != '1':
    try:
        check_and_install_dependencies()
    except Exception as e:
        ColorPrint.red(f"[ERROR] Failed to check dependencies during import: {e}")
        ColorPrint.yellow("[WARNING] Attempting to continue, but some packages may be missing")
        # Ensure checking flag is cleared even on error
        ENCYCLOPEDIA.add("pycore_dependencies_checking", False)
else:
    ColorPrint.blue("[INFO] Dependency check skipped (PYCORE_SKIP_DEP_CHECK=1)")
    ENCYCLOPEDIA.add("pycore_dependencies_checked", True)


# ============================================================================
# LAZY LOADING IMPLEMENTATION
# ============================================================================
# Packages are loaded only when first accessed via getter functions
# This significantly reduces initial import time (from ~12s to <1s)
# All packages are cached after first load to avoid repeated imports
# ============================================================================

# Global cache for loaded packages
_PACKAGE_CACHE = {}


def _lazy_import(package_name: str, import_statement: str):
    """
    Lazy import helper with caching and auto-install

    Args:
        package_name: Cache key for the package
        import_statement: Python import statement to execute

    Returns:
        The imported module/package
    """
    if package_name == 'cnocr':
        return get_third_package_cnocr()
    if package_name not in _PACKAGE_CACHE:
        local_vars = {}
        try:
            # Execute import statement and cache result
            exec(import_statement, globals(), local_vars)
            _PACKAGE_CACHE[package_name] = local_vars.get(package_name.split('.')[-1])
        except (ImportError, ModuleNotFoundError) as e:
            # Package not installed, try to install it
            pip_package = None
            # Look up in DEPENDENCY_MAP
            if package_name in DEPENDENCY_MAP:
                pip_package = DEPENDENCY_MAP[package_name]
            elif package_name in OPTIONAL_PACKAGES:
                pip_package = OPTIONAL_PACKAGES[package_name]
            elif package_name in WINDOWS_ONLY_PACKAGES:
                pip_package = WINDOWS_ONLY_PACKAGES[package_name]
            
            if pip_package:
                ColorPrint.yellow(f"[INSTALL] Package '{package_name}' not found. Installing '{pip_package}'...")
                pip_cmd = build_pip_install_command(pip_package)
                run_pip_install_with_realtime_output(pip_cmd, pip_package)
                importlib.invalidate_caches()
                try:
                    exec(import_statement, globals(), local_vars)
                    _PACKAGE_CACHE[package_name] = local_vars.get(package_name.split('.')[-1])
                except (ImportError, ModuleNotFoundError) as retry_e:
                    raise retry_e
            else:
                # Package not in any dependency map, re-raise original error
                raise e
    return _PACKAGE_CACHE[package_name]


# Standard packages getter functions
def get_third_package_aiohttp():
    """Get aiohttp package (lazy load)"""
    return _lazy_import('aiohttp', 'import aiohttp')


def get_third_package_aiohttp_web():
    """Get aiohttp.web (lazy load)"""
    if 'aiohttp_web' not in _PACKAGE_CACHE:
        from aiohttp import web as aiohttp_web
        _PACKAGE_CACHE['aiohttp_web'] = aiohttp_web
    return _PACKAGE_CACHE['aiohttp_web']


def get_third_package_yaml():
    """Get yaml package (lazy load)"""
    return _lazy_import('yaml', 'import yaml')


def get_third_package_cryptography():
    """Get cryptography package (lazy load, for Fernet)"""
    return _lazy_import('cryptography', 'import cryptography')


# PIL/Pillow packages
def get_third_package_PIL():
    """Get PIL (Pillow) package (lazy load)"""
    return _lazy_import('PIL', 'import PIL')


def get_third_package_PIL_Image():
    """Get PIL.Image module (lazy load)"""
    if 'PIL_Image' not in _PACKAGE_CACHE:
        from PIL import Image as PIL_Image
        _PACKAGE_CACHE['PIL_Image'] = PIL_Image
    return _PACKAGE_CACHE['PIL_Image']


def get_third_package_PIL_ImageDraw():
    """Get PIL.ImageDraw module (lazy load)"""
    if 'PIL_ImageDraw' not in _PACKAGE_CACHE:
        from PIL import ImageDraw as PIL_ImageDraw
        _PACKAGE_CACHE['PIL_ImageDraw'] = PIL_ImageDraw
    return _PACKAGE_CACHE['PIL_ImageDraw']


# Document-parsing packages (Books ingest). Used by book_processor / file_processor
# to extract plain text from .pdf/.docx/.html/.epub/.rtf. All are auto-installed
# from DEPENDENCY_MAP/OPTIONAL_PACKAGES on first use; the optional ones
# (ebooklib/striprtf) have stdlib fallbacks in the processor when unavailable.
def get_third_package_pdfplumber():
    """Get pdfplumber package (lazy load) for PDF text extraction."""
    return _lazy_import('pdfplumber', 'import pdfplumber')


def get_third_package_docx():
    """Get python-docx's Document class (lazy load) for .docx text extraction."""
    if 'docx_Document' not in _PACKAGE_CACHE:
        from docx import Document as docx_Document
        _PACKAGE_CACHE['docx_Document'] = docx_Document
    return _PACKAGE_CACHE['docx_Document']


def get_third_package_bs4():
    """Get BeautifulSoup class (lazy load) for HTML/EPUB text extraction."""
    if 'bs4_BeautifulSoup' not in _PACKAGE_CACHE:
        from bs4 import BeautifulSoup as bs4_BeautifulSoup
        _PACKAGE_CACHE['bs4_BeautifulSoup'] = bs4_BeautifulSoup
    return _PACKAGE_CACHE['bs4_BeautifulSoup']


def get_third_package_ebooklib():
    """Get ebooklib package (lazy load) for EPUB parsing (optional)."""
    return _lazy_import('ebooklib', 'import ebooklib')


def get_third_package_striprtf():
    """Get striprtf's rtf_to_text function (lazy load) for .rtf (optional)."""
    if 'striprtf_rtf_to_text' not in _PACKAGE_CACHE:
        from striprtf.striprtf import rtf_to_text as striprtf_rtf_to_text
        _PACKAGE_CACHE['striprtf_rtf_to_text'] = striprtf_rtf_to_text
    return _PACKAGE_CACHE['striprtf_rtf_to_text']


def get_third_package_PIL_ImageFont():
    """Get PIL.ImageFont module (lazy load)"""
    if 'PIL_ImageFont' not in _PACKAGE_CACHE:
        from PIL import ImageFont as PIL_ImageFont
        _PACKAGE_CACHE['PIL_ImageFont'] = PIL_ImageFont
    return _PACKAGE_CACHE['PIL_ImageFont']


def get_third_package_PIL_ImageTk():
    """Get PIL.ImageTk module (lazy load) - requires tkinter"""
    if 'PIL_ImageTk' not in _PACKAGE_CACHE:
        from PIL import ImageTk as PIL_ImageTk
        _PACKAGE_CACHE['PIL_ImageTk'] = PIL_ImageTk
    return _PACKAGE_CACHE['PIL_ImageTk']


def get_third_package_PIL_ImageGrab():
    """Get PIL.ImageGrab module (lazy load)"""
    if 'PIL_ImageGrab' not in _PACKAGE_CACHE:
        from PIL import ImageGrab as PIL_ImageGrab
        _PACKAGE_CACHE['PIL_ImageGrab'] = PIL_ImageGrab
    return _PACKAGE_CACHE['PIL_ImageGrab']


def get_third_package_PIL_ImageEnhance():
    """Get PIL.ImageEnhance module (lazy load)"""
    if 'PIL_ImageEnhance' not in _PACKAGE_CACHE:
        from PIL import ImageEnhance as PIL_ImageEnhance
        _PACKAGE_CACHE['PIL_ImageEnhance'] = PIL_ImageEnhance
    return _PACKAGE_CACHE['PIL_ImageEnhance']


def get_third_package_PIL_ImageFilter():
    """Get PIL.ImageFilter module (lazy load)"""
    if 'PIL_ImageFilter' not in _PACKAGE_CACHE:
        from PIL import ImageFilter as PIL_ImageFilter
        _PACKAGE_CACHE['PIL_ImageFilter'] = PIL_ImageFilter
    return _PACKAGE_CACHE['PIL_ImageFilter']


def get_third_package_PIL_ImageOps():
    """Get PIL.ImageOps module (lazy load)"""
    if 'PIL_ImageOps' not in _PACKAGE_CACHE:
        from PIL import ImageOps as PIL_ImageOps
        _PACKAGE_CACHE['PIL_ImageOps'] = PIL_ImageOps
    return _PACKAGE_CACHE['PIL_ImageOps']


def get_third_package_PIL_ImageStat():
    """Get PIL.ImageStat module (lazy load)"""
    if 'PIL_ImageStat' not in _PACKAGE_CACHE:
        from PIL import ImageStat as PIL_ImageStat
        _PACKAGE_CACHE['PIL_ImageStat'] = PIL_ImageStat
    return _PACKAGE_CACHE['PIL_ImageStat']


# Computer vision and automation packages
def get_third_package_cv2():
    """Get cv2 (OpenCV) package (lazy load)"""
    return _lazy_import('cv2', 'import cv2')


def get_third_package_pyautogui():
    """Get pyautogui package (lazy load); returns None when unusable.

    On a headless host (no X11 / no DISPLAY) importing pyautogui raises
    KeyError('DISPLAY') from its mouseinfo dependency — NOT an ImportError — so
    _lazy_import does not catch it and it would crash the whole worker at module
    import time. Swallow any such environment error and cache None instead;
    every caller must handle a None pyautogui.
    """
    try:
        return _lazy_import('pyautogui', 'import pyautogui')
    except (ImportError, ModuleNotFoundError):
        # No pip package mapped (or install failed) — treat as unavailable.
        _PACKAGE_CACHE['pyautogui'] = None
        return None
    except Exception as e:
        # Headless display errors (KeyError('DISPLAY'), Xlib errors, etc.).
        ColorPrint.yellow(f"[third_party] pyautogui unavailable (headless/no DISPLAY): {e}")
        _PACKAGE_CACHE['pyautogui'] = None
        return None


def get_third_package_psutil():
    """Get psutil package (lazy load)"""
    return _lazy_import('psutil', 'import psutil')


def get_third_package_mss():
    """Get mss package (lazy load)"""
    return _lazy_import('mss', 'import mss')


# Deep learning packages
def get_third_package_torch():
    """Get torch (PyTorch) package (lazy load) - Heavy package"""
    return _lazy_import('torch', 'import torch')


def get_third_package_ultralytics():
    """Get ultralytics (YOLO) package (lazy load) - Heavy package"""
    return _lazy_import('ultralytics', 'import ultralytics')


def get_third_package_numpy():
    """Get numpy package (lazy load)"""
    return _lazy_import('numpy', 'import numpy')


def get_third_package_matplotlib():
    """Get matplotlib package (lazy load). Used by SDKTool for pyplot/font_manager."""
    return _lazy_import('matplotlib', 'import matplotlib')


def get_third_package_labelme():
    """Get labelme package (lazy load). Image polygonal annotation tool; used by SDKTool when run from core_node."""
    return _lazy_import('labelme', 'import labelme')


def get_third_package_labelImg():
    """Get labelImg package (lazy load). VOC/YOLO bbox annotation; used by GameAISDK yolo_label_lib / d3-check step 3."""
    return _lazy_import('labelImg', 'import labelImg')


# Network and web packages
def get_third_package_websockets():
    """Get websockets package (lazy load)"""
    return _lazy_import('websockets', 'import websockets')


def get_third_package_requests():
    """Get requests package (lazy load)"""
    return _lazy_import('requests', 'import requests')


def get_third_package_urllib3():
    """Get urllib3 package (lazy load). Used by requests; also available for direct use."""
    return _lazy_import('urllib3', 'import urllib3')


def get_third_package_idna():
    """Get idna package (lazy load). Used by requests for internationalized domain names."""
    return _lazy_import('idna', 'import idna')


def get_third_package_chardet():
    """Get chardet package (lazy load). Used by requests for response encoding detection."""
    return _lazy_import('chardet', 'import chardet')


def get_third_package_certifi():
    """Get certifi package (lazy load). Used by requests for TLS CA bundle; certifi.where() returns path."""
    return _lazy_import('certifi', 'import certifi')


def get_third_package_zmq():
    """Get zmq package (lazy load). PyZMQ bindings for ZeroMQ; import name is zmq."""
    return _lazy_import('zmq', 'import zmq')


def get_third_package_msgpack():
    """Get msgpack package (lazy load). Binary serialization; packb/unpackb, use_bin_type in 1.x."""
    return _lazy_import('msgpack', 'import msgpack')


def get_third_package_werkzeug():
    """Get werkzeug package (lazy load). WSGI utilities; tensorboard and others may depend on it."""
    return _lazy_import('werkzeug', 'import werkzeug')


def get_third_package_h5py():
    """Get h5py package (lazy load). HDF5 bindings; TF2/Keras often use 3.x."""
    return _lazy_import('h5py', 'import h5py')


def get_third_package_absl():
    """Get absl package (lazy load). Abseil Python common libraries; tensorflow and others may depend on it."""
    return _lazy_import('absl', 'import absl')


def get_third_package_google_protobuf():
    """Get google.protobuf package (lazy load). Protocol Buffers; actual version constrained by tensorflow/grpcio."""
    return _lazy_import('google.protobuf', 'from google import protobuf')


def get_third_package_grpc():
    """Get grpc package (lazy load). gRPC Python; used by tensorflow and others when run from core_node."""
    return _lazy_import('grpc', 'import grpc')


def get_third_package_six():
    """Get six package (lazy load). Python 2 and 3 compatibility library; tensorflow/protobuf and others may depend on it."""
    return _lazy_import('six', 'import six')


def get_third_package_PyQt5():
    """Get PyQt5 package (lazy load). Qt5 bindings for Python; GameAISDK SDKTool uses it for GUI. Version >=5.15."""
    return _lazy_import('PyQt5', 'import PyQt5')


def get_third_package_uvicorn():
    """Get uvicorn package (lazy load)"""
    return _lazy_import('uvicorn', 'import uvicorn')


def get_third_package_fastapi():
    """Get fastapi package (lazy load)"""
    return _lazy_import('fastapi', 'import fastapi')


# Device and streaming packages
def get_third_package_adb_shell():
    """Get adb_shell package (lazy load)"""
    return _lazy_import('adb_shell', 'import adb_shell')


def get_third_package_av():
    """Get av (PyAV) package (lazy load)"""
    return _lazy_import('av', 'import av')


# Logging
def get_third_package_loguru():
    """Get loguru package (lazy load)"""
    return _lazy_import('loguru', 'import loguru')


# Browser automation
def get_third_package_selenium():
    """Get selenium package (lazy load)"""
    return _lazy_import('selenium', 'import selenium')


def get_third_package_selenium_by():
    """Get selenium.webdriver.common.by.By (lazy load). Returns None on failure."""
    try:
        selenium = get_third_package_selenium()
        return selenium.webdriver.common.by.By if selenium else None
    except Exception:
        return None


def get_third_package_webdriver_manager():
    """Get webdriver_manager package (lazy load)"""
    return _lazy_import('webdriver_manager', 'import webdriver_manager')


def get_third_package_webview():
    """Get webview package (lazy load)"""
    return _lazy_import('webview', 'import webview')


def get_third_package_tkinterweb():
    """Get tkinterweb package (lazy load)"""
    return _lazy_import('tkinterweb', 'import tkinterweb')


def get_third_package_tkhtmlview():
    """Get tkhtmlview package (lazy load)"""
    return _lazy_import('tkhtmlview', 'import tkhtmlview')


def get_third_package_pystray():
    """
    Get pystray package (lazy load)

    On Linux, pystray may fail to import if X11 display is not accessible.
    In this case, returns None instead of raising an exception.
    """
    if 'pystray' not in _PACKAGE_CACHE:
        try:
            import pystray
            _PACKAGE_CACHE['pystray'] = pystray
            return pystray
        except Exception as e:
            # Check if this is a display-related error (common on Linux when running as service or headless)
            error_msg = str(e)
            if 'Display' in error_msg or 'DISPLAY' in error_msg or 'X11' in error_msg or 'Xlib' in str(type(e)):
                ColorPrint.yellow(f"[WARN] pystray unavailable due to display error: {type(e).__name__}")
                ColorPrint.blue("[INFO] This is normal when running without X11 display access (e.g., systemd service)")
                ColorPrint.blue("[INFO] System tray features will be disabled")
                _PACKAGE_CACHE['pystray'] = None
                return None
            else:
                # Some other error, try lazy import (might trigger auto-install)
                try:
                    return _lazy_import('pystray', 'import pystray')
                except Exception as e2:
                    ColorPrint.yellow(f"[WARN] pystray import failed: {e2}")
                    _PACKAGE_CACHE['pystray'] = None
                    return None

    return _PACKAGE_CACHE['pystray']


def get_third_package_pythoncom():
    """
    Get pythoncom module (Windows COM, optional). Returns None on non-Windows or import failure.
    Same style as get_third_package_pystray(); callers must check for None.
    """
    if 'pythoncom' not in _PACKAGE_CACHE:
        if platform.system() != 'Windows':
            _PACKAGE_CACHE['pythoncom'] = None
        else:
            try:
                import pythoncom as _pythoncom
                _PACKAGE_CACHE['pythoncom'] = _pythoncom
            except Exception:
                _PACKAGE_CACHE['pythoncom'] = None
    return _PACKAGE_CACHE['pythoncom']


def get_third_package_runtime():
    """
    Get application runtime module (optional). Returns None when not available.
    Used for trigger_window_show, trigger_app_exit, etc. Callers must check for None.
    """
    if 'runtime' not in _PACKAGE_CACHE:
        try:
            _PACKAGE_CACHE['runtime'] = importlib.import_module('runtime')
        except Exception:
            _PACKAGE_CACHE['runtime'] = None
    return _PACKAGE_CACHE['runtime']


def get_third_package_PIL_Image_optional():
    """Get PIL.Image module or None on failure. For optional use (e.g. tray icon); callers must check for None."""
    if 'PIL_Image_optional' not in _PACKAGE_CACHE:
        try:
            from PIL import Image as PIL_Image
            _PACKAGE_CACHE['PIL_Image_optional'] = PIL_Image
        except Exception:
            _PACKAGE_CACHE['PIL_Image_optional'] = None
    return _PACKAGE_CACHE['PIL_Image_optional']


def get_third_package_PIL_ImageDraw_optional():
    """Get PIL.ImageDraw module or None on failure. For optional use; callers must check for None."""
    if 'PIL_ImageDraw_optional' not in _PACKAGE_CACHE:
        try:
            from PIL import ImageDraw as PIL_ImageDraw
            _PACKAGE_CACHE['PIL_ImageDraw_optional'] = PIL_ImageDraw
        except Exception:
            _PACKAGE_CACHE['PIL_ImageDraw_optional'] = None
    return _PACKAGE_CACHE['PIL_ImageDraw_optional']


def get_third_package_huggingface_hub():
    """
    Get huggingface_hub package (lazy load). For CnOCR/CnSTD model auto-download from Hugging Face.
    Package includes CLI as entry point 'hf'; use get_huggingface_cli_command() or ensure_huggingface_cli_prerequisite().
    Returns None if still unavailable after install attempt.
    """
    if 'huggingface_hub' not in _PACKAGE_CACHE:
        try:
            import huggingface_hub
            _PACKAGE_CACHE['huggingface_hub'] = huggingface_hub
        except (ImportError, ModuleNotFoundError):
            pip_package = DEPENDENCY_MAP.get('huggingface_hub', 'huggingface_hub')
            ColorPrint.yellow(f"[INSTALL] Package 'huggingface_hub' not found. Installing '{pip_package}' (required for CnOCR/CnSTD model download)...")
            pip_cmd = build_pip_install_command(pip_package)
            run_pip_install_with_realtime_output(pip_cmd, pip_package)
            importlib.invalidate_caches()
            try:
                import huggingface_hub
                _PACKAGE_CACHE['huggingface_hub'] = huggingface_hub
            except (ImportError, ModuleNotFoundError):
                _PACKAGE_CACHE['huggingface_hub'] = None
    return _PACKAGE_CACHE.get('huggingface_hub')


# Official PyPI latest (for init log); see https://pypi.org/pypi/cnocr/json
CNOCR_OFFICIAL_LATEST_VERSION = "2.3.2.3"


def _print_cnocr_init_info(cnocr_module):
    """Print GPU support and loaded versions at cnocr init (official: PyPI cnocr, ort-cpu/ort-gpu)."""
    gpu_available = CUDADetector.is_cuda_available()
    cnocr_ver = getattr(cnocr_module, '__version__', 'unknown')
    onnx_ver = 'N/A'
    try:
        import onnxruntime
        onnx_ver = getattr(onnxruntime, '__version__', 'unknown')
    except Exception:
        pass
    ColorPrint.blue(
        f"[CnOCR] GPU: {'yes' if gpu_available else 'no'} | cnocr: {cnocr_ver} | onnxruntime: {onnx_ver} | official latest: {CNOCR_OFFICIAL_LATEST_VERSION}"
    )


def get_third_package_cnocr():
    """
    Get cnocr package (lazy load). Official: https://cnocr.readthedocs.io/zh-cn/stable/install/
    GPU: pip install cnocr[ort-gpu], CPU: pip install cnocr[ort-cpu].
    When installing: uses get_cnocr_pip_package() (CUDADetector); installs latest (--upgrade).
    Returns None if still unavailable after install attempt. On first load prints GPU support and versions.
    """
    if 'cnocr' not in _PACKAGE_CACHE:
        try:
            import cnocr
            _PACKAGE_CACHE['cnocr'] = cnocr
            _print_cnocr_init_info(cnocr)
        except (ImportError, ModuleNotFoundError):
            pip_package = get_cnocr_pip_package()
            if pip_package:
                ColorPrint.yellow(f"[INSTALL] Package 'cnocr' not found. Installing latest '{pip_package}' (official)...")
                pip_cmd = build_pip_install_command(pip_package, upgrade=True)
                run_pip_install_with_realtime_output(pip_cmd, pip_package)
                importlib.invalidate_caches()
                try:
                    import cnocr
                    _PACKAGE_CACHE['cnocr'] = cnocr
                    _print_cnocr_init_info(cnocr)
                except (ImportError, ModuleNotFoundError):
                    _PACKAGE_CACHE['cnocr'] = None
            else:
                _PACKAGE_CACHE['cnocr'] = None
    return _PACKAGE_CACHE['cnocr']


def get_huggingface_cli_command():
    """
    Return command list to run Hugging Face CLI (for subprocess). Works without PATH.
    Official: pip install huggingface_hub; entry point is 'hf' (since 1.x). Use this instead of 'huggingface-cli'.
    """
    return [sys.executable, "-m", "huggingface_hub.cli.hf"]


def ensure_huggingface_cli_prerequisite() -> bool:
    """
    Prerequisite for CnOCR/CnSTD model download. Ensures huggingface_hub is installed and CLI is usable.
    - Installs huggingface_hub if missing.
    - Prepends Python Scripts to PATH so 'hf' is findable (Windows).
    - CLI is invoked as 'hf' or via python -m huggingface_hub.cli.hf (see get_huggingface_cli_command()).
    Official: https://hf.co/docs/huggingface_hub/installation  Windows standalone: powershell -ExecutionPolicy ByPass -c "irm https://hf.co/cli/install.ps1 | iex"
    Returns True if hub is importable (CLI can always be run via get_huggingface_cli_command()).
    """
    hub = get_third_package_huggingface_hub()
    if hub is None:
        return False
    try:
        import shutil
        exe_dir = os.path.dirname(os.path.abspath(sys.executable))
        scripts = os.path.join(exe_dir, "Scripts")
        if os.path.isdir(scripts):
            path_env = os.environ.get("PATH", "")
            if scripts not in path_env:
                os.environ["PATH"] = scripts + os.pathsep + path_env
                ColorPrint.gray(f"[HF] PATH prepended with {scripts} for 'hf' CLI")
        if shutil.which("hf"):
            ColorPrint.gray("[HF] CLI available as: hf")
            return True
        ColorPrint.gray("[HF] CLI not on PATH. Use: python -m huggingface_hub.cli.hf  or  get_huggingface_cli_command()")
        return True
    except Exception:
        pass
    return True


def _ensure_huggingface_cli_on_path():
    """
    Prepend Scripts to PATH and ensure hub is loaded. Prefer ensure_huggingface_cli_prerequisite() for explicit setup.
    CLI command name is 'hf' (not huggingface-cli); use get_huggingface_cli_command() for subprocess.
    """
    ensure_huggingface_cli_prerequisite()


# Official: if model file missing, manual download from https://huggingface.co/breezedeus/cnstd-cnocr-models or Baidu pan (pwd: nocr), put in ~/.cnocr/2.3 (Win: %APPDATA%\cnocr\2.3)
CNOCR_MODEL_DOWNLOAD_HINT = (
    "CnOCR model missing. Install: pip install huggingface_hub. CLI: python -m huggingface_hub.cli.hf  or  hf (Scripts on PATH). "
    "Or download from https://huggingface.co/breezedeus/cnstd-cnocr-models (or Baidu pan pwd nocr), put zip in ~/.cnocr/2.3 (Win: %APPDATA%\\cnocr\\2.3)."
)


# ===========================================================================
# Hugging Face Hub helpers + OCR model provisioning
# Merged in from the former huggingface_hub_helper / ocr_prewarm_spec /
# ocr_hf_models / ocr_initializer modules. Kept HERE (not as sibling
# pyfoundations modules) because the OCR provisioning chain depends on this
# module's get_third_package_* getters (a cycle), and pyfoundations top-level
# modules may import ONLY pybasecommon. Folding the chain into third_party
# removes the cycle and the sideways pyfoundations imports.
# ===========================================================================

# ---------------------------------------------------------------------------
# Hugging Face Hub base helpers. Native Python API only (no CLI/wget).
# Uses huggingface_hub.hf_hub_download and snapshot_download.
# Ref: https://huggingface.co/docs/huggingface_hub/guides/download
# ---------------------------------------------------------------------------
def ensure_huggingface_hub():
    """Return huggingface_hub module or None (installs via this module's getter)."""
    return get_third_package_huggingface_hub()


def hf_download_file(
    repo_id: str,
    filename: str,
    local_dir: Optional[Union[str, Path]] = None,
    revision: Optional[str] = None,
    force_download: bool = False,
) -> Optional[str]:
    """
    Download a single file from Hub. Native API, no CLI.
    Returns local path or None on failure.
    """
    hub = ensure_huggingface_hub()
    if hub is None:
        ColorPrint.yellow("[HF] huggingface_hub not available; pip install huggingface_hub")
        return None
    try:
        path = hub.hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=local_dir,
            revision=revision or "main",
            force_download=force_download,
        )
        return path
    except Exception as e:
        ColorPrint.red(f"[HF] hf_hub_download failed: {e}")
        return None


def hf_snapshot_to_dir(
    repo_id: str,
    local_dir: Union[str, Path],
    allow_patterns: Optional[Union[str, List[str]]] = None,
    ignore_patterns: Optional[Union[str, List[str]]] = None,
    revision: Optional[str] = None,
    force_download: bool = False,
) -> Optional[str]:
    """
    Download a snapshot of the repo (or filtered by patterns) to local_dir.
    Returns local_dir path or None on failure.
    """
    hub = ensure_huggingface_hub()
    if hub is None:
        return None
    try:
        path = hub.snapshot_download(
            repo_id=repo_id,
            local_dir=str(local_dir),
            allow_patterns=allow_patterns,
            ignore_patterns=ignore_patterns,
            revision=revision or "main",
            force_download=force_download,
        )
        return path
    except Exception as e:
        ColorPrint.red(f"[HF] snapshot_download failed: {e}")
        return None


def hf_download_zip_and_extract(
    repo_id: str,
    filename: str,
    extract_to: Union[str, Path],
    revision: Optional[str] = None,
) -> bool:
    """
    Download a zip from Hub (uses default cache; no re-download if already cached) and extract to extract_to.
    Returns True on success. Ref: https://huggingface.co/docs/huggingface_hub/guides/download
    """
    hub = ensure_huggingface_hub()
    if hub is None:
        return False
    try:
        path = hub.hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            revision=revision or "main",
        )
        if not path or not os.path.isfile(path):
            return False
        extract_to = Path(extract_to)
        extract_to.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(path, "r") as z:
            z.extractall(extract_to)
        return True
    except Exception as e:
        ColorPrint.red(f"[HF] download+extract failed: {e}")
        return False


def hf_list_repo_files(repo_id: str, path_in_repo: str = "", revision: Optional[str] = None) -> List[str]:
    """List files in a repo path. Returns list of relative file paths. Compatible with old HfApi (no path_in_repo)."""
    hub = ensure_huggingface_hub()
    if hub is None:
        return []
    rev = revision or "main"
    path_prefix = (path_in_repo or "").strip().rstrip("/")
    try:
        from huggingface_hub import HfApi
        api = HfApi()
        try:
            items = api.list_repo_files(repo_id=repo_id, path_in_repo=path_in_repo or None, revision=rev)
        except TypeError:
            # Old huggingface_hub: list_repo_files() has no path_in_repo -> list all and filter
            items = api.list_repo_files(repo_id=repo_id, revision=rev)
            if path_prefix and items:
                prefix = path_prefix + "/"
                items = [f for f in items if f == path_prefix or f.startswith(prefix)]
        return list(items) if items else []
    except Exception as e:
        ColorPrint.gray(f"[HF] list_repo_files: {e}")
        return []


def hf_get_collection_models(collection_slug: str) -> List[str]:
    """
    Get model repo_ids from a Hub collection (e.g. breezedeus/cnocr).
    Uses HfApi.get_collection; only items with item_type=='model' are returned.
    Ref: https://huggingface.co/docs/huggingface_hub/en/package_reference/collections
    """
    hub = ensure_huggingface_hub()
    if hub is None:
        return []
    try:
        api = hub.HfApi()
        coll = api.get_collection(collection_slug=collection_slug)
        return [it.item_id for it in (coll.items or []) if getattr(it, "item_type", None) == "model"]
    except Exception as e:
        ColorPrint.gray(f"[HF] get_collection {collection_slug}: {e}")
        return []


def hf_download_repo_latest(
    repo_id: str,
    local_dir: Union[str, Path],
    allow_patterns: Optional[Union[str, List[str]]] = None,
    revision: Optional[str] = None,
) -> Optional[str]:
    """
    Download latest revision of a repo (default main) to local_dir.
    Returns local_dir path or None. Use revision='main' or None for latest.
    """
    return hf_snapshot_to_dir(
        repo_id=repo_id,
        local_dir=local_dir,
        allow_patterns=allow_patterns,
        revision=revision or "main",
    )


# ---------------------------------------------------------------------------
# OCR prewarm spec: single source of truth for OCR prewarm (zh / en / cht),
# each with latest models per language. Drives both HF download and prewarm.
# Refs:
# - CnOCR install: https://cnocr.readthedocs.io/zh-cn/stable/install/
# - CnOCR models: https://cnocr.readthedocs.io/zh-cn/stable/models/
# - HF collection: https://huggingface.co/collections/breezedeus/cnocr
# ---------------------------------------------------------------------------
PREWARM_SPEC: Dict[str, Dict[str, Any]] = {
    "zh": {
        "det_repos": (
            "breezedeus/cnstd-ppocr-ch_PP-OCRv5_det",
            "breezedeus/cnstd-ppocr-ch_PP-OCRv5_det_server",
        ),
        "rec_repos": (
            "breezedeus/cnocr-ppocr-ch_PP-OCRv5",
            "breezedeus/cnocr-ppocr-ch_PP-OCRv5_server",
        ),
        "det_zips": (),
        "rec_zips": (),
        "prewarm_det": "ch_PP-OCRv5_det",
        "prewarm_det_server": "ch_PP-OCRv5_det_server",
        "prewarm_rec": "ch_PP-OCRv5",
        "prewarm_rec_server": "ch_PP-OCRv5_server",
    },
    "en": {
        "det_repos": ("breezedeus/cnstd-ppocr-en_PP-OCRv3_det",),
        "rec_repos": (
            "breezedeus/cnocr-ppocr-en_PP-OCRv4",
            "breezedeus/cnocr-ppocr-en_PP-OCRv3",
        ),
        "det_zips": (),
        "rec_zips": (),
        "prewarm_det": "en_PP-OCRv3_det",
        "prewarm_det_server": None,
        "prewarm_rec": "en_PP-OCRv4",
        "prewarm_rec_fallbacks": ("en_PP-OCRv3",),
    },
    "cht": {
        "det_repos": (),
        "rec_repos": (),
        "det_zips": ("ch_PP-OCRv3_det_infer-onnx.zip",),
        "rec_zips": ("chinese_cht_PP-OCRv3_rec_infer-onnx.zip",),
        "prewarm_det": "ch_PP-OCRv3_det",
        "prewarm_det_server": None,
        "prewarm_rec": "chinese_cht_PP-OCRv3",
        "prewarm_rec_fallbacks": (),
    },
}

PREWARM_LANGUAGES: Tuple[str, ...] = ("zh", "en", "cht")

# Single config for CnOcr(rec_more_configs=...). Used by prewarm (OcrInitializer) and by CnOCREngine.init()
# so that initialization and engine creation stay aligned. font_path=None lets rapidocr use default font.
REC_MORE_CONFIGS_CNOCR: Dict[str, Any] = {"font_path": None}


def all_cnstd_repos() -> Tuple[str, ...]:
    """Union of all det repos from spec (for download)."""
    seen: set = set()
    for lang in PREWARM_LANGUAGES:
        for r in PREWARM_SPEC[lang]["det_repos"]:
            seen.add(r)
    return tuple(sorted(seen))


def all_cnocr_repos() -> Tuple[str, ...]:
    """Union of all rec repos from spec (for download)."""
    seen: set = set()
    for lang in PREWARM_LANGUAGES:
        for r in PREWARM_SPEC[lang]["rec_repos"]:
            seen.add(r)
    return tuple(sorted(seen))


def all_cnstd_zips() -> Tuple[str, ...]:
    """Union of all det zips from spec (bundle allowlist)."""
    seen: set = set()
    for lang in PREWARM_LANGUAGES:
        for z in PREWARM_SPEC[lang]["det_zips"]:
            seen.add(z)
    return tuple(sorted(seen))


def all_cnocr_zips() -> Tuple[str, ...]:
    """Union of all rec zips from spec (bundle allowlist)."""
    seen: set = set()
    for lang in PREWARM_LANGUAGES:
        for z in PREWARM_SPEC[lang]["rec_zips"]:
            seen.add(z)
    return tuple(sorted(seen))


def prewarm_det_rec_for_lang(lang: str, use_gpu: bool) -> Tuple[str, Tuple[str, ...]]:
    """
    Return (det_model_name, (rec_primary, rec_fallback, ...)) for CnOcr(det_model_name=..., rec_model_name=...).
    When use_gpu and spec has _server, prefer server variant for zh.
    """
    s = PREWARM_SPEC.get(lang)
    if not s:
        return "ch_PP-OCRv5_det", ("ch_PP-OCRv5",)
    det = s["prewarm_det"]
    if use_gpu and s.get("prewarm_det_server"):
        det = s["prewarm_det_server"]
    rec_primary = s["prewarm_rec"]
    if use_gpu and s.get("prewarm_rec_server"):
        rec_primary = s["prewarm_rec_server"]
    fallbacks = s.get("prewarm_rec_fallbacks") or ()
    rec_order = (rec_primary,) + fallbacks
    return det, rec_order


# ---------------------------------------------------------------------------
# OCR model init: download CnSTD/CnOCR models from Hugging Face (native API).
# Download list is driven by PREWARM_SPEC (zh/en/cht latest per language).
# CnSTD root: ~/.cnstd, expects 1.2/ppocr/<model>/<model>_infer.onnx
# CnOCR root: ~/.cnocr, expects 2.3/ppocr/<model>/<model>_rec_infer.onnx
# ---------------------------------------------------------------------------
HF_OCR_REPO = "breezedeus/cnstd-cnocr-models"
CNSTD_SUBDIR = "models/cnstd/1.2"
CNOCR_SUBDIR = "models/cnocr/2.3"
CNSTD_COLLECTION_SLUG = "breezedeus/cnstd"
CNOCR_COLLECTION_SLUG = "breezedeus/cnocr"


def _appdata_root() -> Path:
    if os.name == "nt":
        return Path(os.environ.get("APPDATA", os.path.expanduser("~")))
    return Path.home()


def cnstd_root() -> Path:
    """CnSTD model root. Win: %APPDATA%\\cnstd, else ~/.cnstd."""
    if os.name == "nt":
        return _appdata_root() / "cnstd"
    return Path.home() / ".cnstd"


def cnocr_root() -> Path:
    """CnOCR model root. Win: %APPDATA%\\cnocr, else ~/.cnocr."""
    if os.name == "nt":
        return _appdata_root() / "cnocr"
    return Path.home() / ".cnocr"


def _model_name_from_ppocr_repo(repo_id: str) -> str:
    """breezedeus/cnstd-ppocr-ch_PP-OCRv5_det -> ch_PP-OCRv5_det; cnocr-ppocr-ch_PP-OCRv5 -> ch_PP-OCRv5."""
    name = repo_id.split("/", 1)[-1]
    for prefix in ("cnstd-ppocr-", "cnocr-ppocr-"):
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


def _repos_from_collection(collection_slug: str, name_prefix: str) -> List[str]:
    """
    Get model repo_ids from Hub collection (HfApi.get_collection).
    Only returns repos whose name (after owner/) starts with name_prefix (e.g. cnstd-ppocr- or cnocr-ppocr-).
    """
    repo_ids = hf_get_collection_models(collection_slug)
    return [r for r in repo_ids if r.split("/", 1)[-1].startswith(name_prefix)]


def _needed_det_model_names(use_gpu: bool) -> set:
    """Model names needed for CnSTD det by GPU/CPU: zh optimal (server vs non-server), en, cht from zip."""
    needed = set()
    zh = PREWARM_SPEC["zh"]
    if use_gpu and zh.get("prewarm_det_server"):
        needed.add(zh["prewarm_det_server"])
    else:
        needed.add(zh["prewarm_det"])
    for lang in ("en",):
        for r in PREWARM_SPEC[lang]["det_repos"]:
            needed.add(_model_name_from_ppocr_repo(r))
    return needed


def _needed_rec_model_names(use_gpu: bool) -> set:
    """Model names needed for CnOCR rec by GPU/CPU: zh optimal, en, cht from zip."""
    needed = set()
    zh = PREWARM_SPEC["zh"]
    if use_gpu and zh.get("prewarm_rec_server"):
        needed.add(zh["prewarm_rec_server"])
    else:
        needed.add(zh["prewarm_rec"])
    for lang in ("en",):
        for r in PREWARM_SPEC[lang]["rec_repos"]:
            needed.add(_model_name_from_ppocr_repo(r))
    for lang in ("zh", "en"):
        for rec in PREWARM_SPEC[lang].get("prewarm_rec_fallbacks") or ():
            needed.add(rec)
    return needed


def _repos_to_download_cnstd(use_gpu: bool) -> Tuple[str, ...]:
    """Optimal CnSTD repo list from static spec (zh V5 + en + cht). GPU: prefer _server for zh. Never rely on Hub collection alone (it may omit zh V5)."""
    needed = _needed_det_model_names(use_gpu)
    return tuple(sorted(r for r in all_cnstd_repos() if _model_name_from_ppocr_repo(r) in needed))


def _repos_to_download_cnocr(use_gpu: bool) -> Tuple[str, ...]:
    """Optimal CnOCR repo list from static spec (zh V5 + en + cht). GPU: prefer _server for zh. Never rely on Hub collection alone."""
    needed = _needed_rec_model_names(use_gpu)
    return tuple(sorted(r for r in all_cnocr_repos() if _model_name_from_ppocr_repo(r) in needed))


def _download_ppocr_single_model_repos(
    repos: Tuple[str, ...],
    version_subdir: str,
    root: Path,
    revision: Optional[str] = None,
) -> bool:
    """
    Download from single-model repos (e.g. breezedeus/cnstd-ppocr-ch_PP-OCRv5_det).
    Repo root contains .onnx and config.yaml; save to root/<version_subdir>/ppocr/<model_name>/.
    """
    if not repos:
        return True
    ColorPrint.blue("[HF] Single-model repos (V5/V4 etc.):")
    for repo_id in repos:
        print(f"  [HF]   - {repo_id}", flush=True)
    sys.stdout.flush()
    rev = revision or "main"
    ok = True
    for repo_id in repos:
        model_name = _model_name_from_ppocr_repo(repo_id)
        dest_dir = root / version_subdir / "ppocr" / model_name
        if dest_dir.is_dir() and any(dest_dir.glob("*.onnx")):
            continue
        files = hf_list_repo_files(repo_id, path_in_repo="", revision=rev)
        to_download = [f for f in files if f.endswith(".onnx") or f.endswith(".yaml")]
        if not to_download:
            ColorPrint.yellow(f"[HF] No .onnx in {repo_id}")
            continue
        dest_dir.mkdir(parents=True, exist_ok=True)
        got = False
        for filename in to_download:
            path = hf_download_file(repo_id, filename, local_dir=dest_dir, revision=rev)
            if path:
                got = True
            else:
                ok = False
        if got:
            ColorPrint.blue(f"[HF] Downloaded {repo_id} -> {dest_dir}")
    return ok


def _zip_basename_to_ppocr_model(basename: str, kind: str) -> Optional[str]:
    """
    Map zip basename to expected ppocr subdir (model name) for skip-if-present check.
    kind 'cnstd': *_det_infer-onnx.zip -> *_det; kind 'cnocr': *_rec_infer-onnx.zip -> model name before _rec.
    """
    if not basename.endswith(".zip"):
        return None
    name = basename[:-4]
    if kind == "cnstd" and name.endswith("_det_infer-onnx"):
        return name[: -len("_infer-onnx")]  # ch_PP-OCRv3_det_infer-onnx -> ch_PP-OCRv3_det
    if kind == "cnocr" and "_rec_infer-onnx" in name:
        return name.replace("_rec_infer-onnx", "")  # chinese_cht_PP-OCRv3_rec_infer-onnx -> chinese_cht_PP-OCRv3
    return None


def _dir_has_onnx(p: Path) -> bool:
    """True if path is a dir and contains at least one .onnx file (direct or nested)."""
    if not p.is_dir():
        return False
    return any(p.rglob("*.onnx"))


def _zip_already_extracted(
    target_root: Path,
    zip_basename: str,
    zip_to_ppocr_model: Optional[Callable[[str], Optional[str]]],
) -> bool:
    """
    Return True iff the model from this zip is already present so we can skip download.
    Checks: (1) target_root/ppocr/<model_name>/ (library path), (2) target_root/<stem>/,
    (3) target_root/models/cnstd/1.2/<stem>/, (4) target_root/models/cnocr/2.3/<stem>/,
    (5) any dir under target_root whose name contains model_name and has .onnx (HF zip layout may vary).
    """
    root = Path(target_root).resolve()
    if zip_to_ppocr_model is None:
        return False
    model_name = zip_to_ppocr_model(zip_basename)
    if not model_name:
        return False
    expect_dir = root / "ppocr" / model_name
    if _dir_has_onnx(expect_dir):
        return True
    stem = zip_basename[:-4] if zip_basename.endswith(".zip") else zip_basename
    candidates = [
        root / stem,
        root / CNSTD_SUBDIR / stem,
        root / CNOCR_SUBDIR / stem,
    ]
    for d in candidates:
        if d.is_dir() and _dir_has_onnx(d):
            return True
    if not root.is_dir():
        return False
    for d in root.rglob("*"):
        if d.is_dir() and model_name in d.name and _dir_has_onnx(d):
            return True
    return False


def _normalize_extract_to_ppocr(
    target_root: Path,
    zip_basename: str,
    zip_to_ppocr_model: Optional[Callable[[str], Optional[str]]],
) -> None:
    """
    After extracting a bundle zip, ensure the library path exists: target_root/ppocr/<model_name>/ with .onnx.
    If the zip did not create that layout, copy from wherever it extracted (e.g. target_root/<stem>/ or flat).
    """
    if zip_to_ppocr_model is None:
        return
    model_name = zip_to_ppocr_model(zip_basename)
    if not model_name:
        return
    root = Path(target_root).resolve()
    expect_dir = root / "ppocr" / model_name
    if _dir_has_onnx(expect_dir):
        return
    stem = zip_basename[:-4] if zip_basename.endswith(".zip") else zip_basename
    candidates: List[Path] = [
        root / stem,
        root / Path(CNSTD_SUBDIR) / stem,
        root / Path(CNOCR_SUBDIR) / stem,
    ]
    source_dir: Optional[Path] = None
    for c in candidates:
        if c.is_dir() and _dir_has_onnx(c):
            source_dir = c
            break
    if source_dir is None and root.is_dir():
        onnx_at_root = list(root.glob("*.onnx"))
        if onnx_at_root:
            expect_dir.mkdir(parents=True, exist_ok=True)
            for f in onnx_at_root:
                shutil.copy2(f, expect_dir / f.name)
            return
    if source_dir is None:
        for d in root.iterdir():
            if d.is_dir() and d.name != "ppocr" and _dir_has_onnx(d):
                source_dir = d
                break
    if source_dir is None and root.is_dir():
        for d in root.rglob("*"):
            if d.is_dir() and model_name in d.name and _dir_has_onnx(d):
                source_dir = d
                break
    if source_dir is not None:
        expect_dir.mkdir(parents=True, exist_ok=True)
        for f in source_dir.rglob("*"):
            if f.is_file():
                rel = f.relative_to(source_dir)
                dest = expect_dir / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest)


def _download_and_extract_zips_to(
    repo_id: str,
    path_in_repo: str,
    target_root: Path,
    revision: Optional[str] = None,
    allowlist: Optional[Tuple[str, ...]] = None,
    zip_to_ppocr_model: Optional[Callable[[str], Optional[str]]] = None,
) -> bool:
    """
    List zip files under path_in_repo, optionally filter by allowlist (basename in allowlist),
    download each that is not already present, extract into target_root.
    When zip_to_ppocr_model(basename) returns ppocr model dir, skip download if target_root/ppocr/<dir> exists with .onnx.
    """
    files = hf_list_repo_files(repo_id, path_in_repo=path_in_repo or "", revision=revision)
    all_zips = [f for f in files if f.endswith(".zip")]
    if all_zips:
        ColorPrint.blue("[HF] Available zips (%s):" % path_in_repo)
        for z in all_zips:
            print(f"  [HF]   - {os.path.basename(z)}", flush=True)
        sys.stdout.flush()
    else:
        ColorPrint.yellow(f"[HF] No zip files under {path_in_repo}")
    zips = all_zips
    if allowlist:
        zips = [f for f in zips if os.path.basename(f) in allowlist]
        if zips:
            to_skip = [
                rel for rel in zips
                if _zip_already_extracted(Path(target_root), os.path.basename(rel), zip_to_ppocr_model)
            ]
            to_download = [rel for rel in zips if rel not in to_skip]
            for rel in to_skip:
                ColorPrint.blue("[HF] Skip (already present): %s" % os.path.basename(rel))
                _normalize_extract_to_ppocr(Path(target_root), os.path.basename(rel), zip_to_ppocr_model)
            if to_download:
                ColorPrint.blue("[HF] Will download (allowlist):")
                for z in to_download:
                    print(f"  [HF]   - {os.path.basename(z)}", flush=True)
                sys.stdout.flush()
            zips = to_download
        if not zips:
            return True
    if not zips:
        ColorPrint.yellow(f"[HF] No zip files to download under {path_in_repo}" + (" (allowlist)" if allowlist else ""))
        return False
    target_root = Path(target_root)
    target_root.mkdir(parents=True, exist_ok=True)
    prefix = (path_in_repo or "").rstrip("/")
    ok = False
    for rel in zips:
        filename = f"{prefix}/{rel}" if prefix and "/" not in rel else rel
        basename = os.path.basename(rel)
        ColorPrint.blue(f"[HF] Downloading {filename} -> {target_root}")
        if hf_download_zip_and_extract(repo_id, filename, target_root, revision=revision):
            _normalize_extract_to_ppocr(Path(target_root), basename, zip_to_ppocr_model)
            ok = True
        else:
            ColorPrint.red(f"[HF] Failed {filename}")
    return ok


def ensure_cnstd_models(
    use_gpu: bool = False,
    det_model_name: Optional[str] = None,
) -> bool:
    """
    Ensure CnSTD 1.2 models under cnstd_root()/1.2.
    Uses HfApi.get_collection(breezedeus/cnstd) for repo list; only downloads optimal set for use_gpu.
    Zip from bundle only for cht (no single-model repo); skip if already present.
    """
    root = cnstd_root()
    dest = root / "1.2"
    dest.mkdir(parents=True, exist_ok=True)
    if det_model_name:
        expect_dir = dest / "ppocr" / det_model_name
        if expect_dir.is_dir() and any(expect_dir.iterdir()):
            return True
    repos = _repos_to_download_cnstd(use_gpu)
    ok = _download_ppocr_single_model_repos(repos, "1.2", root)
    zips_allow = all_cnstd_zips()
    if zips_allow:
        ok = _download_and_extract_zips_to(
            HF_OCR_REPO,
            CNSTD_SUBDIR,
            dest,
            allowlist=zips_allow,
            zip_to_ppocr_model=lambda b: _zip_basename_to_ppocr_model(b, "cnstd"),
        ) or ok
    return ok


def ensure_cnocr_models(
    use_gpu: bool = False,
    rec_model_name: Optional[str] = None,
) -> bool:
    """
    Ensure CnOCR 2.3 models under cnocr_root()/2.3.
    Uses HfApi.get_collection(breezedeus/cnocr) for repo list; only downloads optimal set for use_gpu.
    Zip from bundle only for cht; skip if already present.
    """
    root = cnocr_root()
    dest = root / "2.3"
    dest.mkdir(parents=True, exist_ok=True)
    if rec_model_name:
        expect_dir = dest / "ppocr" / rec_model_name
        if expect_dir.is_dir() and any(expect_dir.iterdir()):
            return True
    repos = _repos_to_download_cnocr(use_gpu)
    ok = _download_ppocr_single_model_repos(repos, "2.3", root)
    zips_allow = all_cnocr_zips()
    if zips_allow:
        ok = _download_and_extract_zips_to(
            HF_OCR_REPO,
            CNOCR_SUBDIR,
            dest,
            allowlist=zips_allow,
            zip_to_ppocr_model=lambda b: _zip_basename_to_ppocr_model(b, "cnocr"),
        ) or ok
    return ok


def init_ocr_models_from_hf(
    cnstd: bool = True,
    cnocr: bool = True,
    use_gpu: bool = False,
    det_model_name: Optional[str] = None,
    rec_model_name: Optional[str] = None,
) -> bool:
    """
    Initialize OCR models from Hugging Face (native download, no CLI).
    Uses get_collection(breezedeus/cnstd|cnocr) for repo list; only downloads optimal set for use_gpu.
    Zip from bundle only for cht (skip if already present).
    """
    ok = True
    if cnstd:
        ColorPrint.blue("[HF] Ensuring CnSTD models at " + str(cnstd_root()))
        if not ensure_cnstd_models(use_gpu=use_gpu, det_model_name=det_model_name):
            ColorPrint.yellow("[HF] CnSTD models incomplete; check " + str(cnstd_root() / "1.2"))
            ok = False
    if cnocr:
        ColorPrint.blue("[HF] Ensuring CnOCR models at " + str(cnocr_root()))
        if not ensure_cnocr_models(use_gpu=use_gpu, rec_model_name=rec_model_name):
            ColorPrint.yellow("[HF] CnOCR models incomplete; check " + str(cnocr_root() / "2.3"))
            ok = False
    return ok


# ---------------------------------------------------------------------------
# OcrInitializer: single entry for OCR init (HF download -> load cnocr -> prewarm).
# Assumes CudaInitializer.run() already done (ONNX switch + CUDA readiness).
# Callers inject get_cnocr, run_pip_uninstall, run_pip_install, clear_cnocr_cache,
# is_pip_package_installed.
# ---------------------------------------------------------------------------
class OcrInitializer:
    """
    Single entry for OCR init: download from HF -> load cnocr -> prewarm.
    ONNX switch and ensure_onnx_cuda_usable are done by CudaInitializer.run() (predecessor). Run once per process (guarded).
    Caller injects get_cnocr, run_pip_uninstall, run_pip_install, clear_cnocr_cache, is_pip_package_installed.
    """

    def __init__(
        self,
        *,
        get_cnocr: Callable[[], Any],
        run_pip_uninstall: Callable[[str], None],
        run_pip_install: Callable[[str, Optional[str]], None],  # (package_name, index_url=None)
        clear_cnocr_cache: Callable[[], None],
        is_pip_package_installed: Callable[[str], bool],
        verify_onnx_import: Optional[Callable[[], bool]] = None,
        run_pip_install_force: Optional[Callable[[str], None]] = None,
    ):
        self._get_cnocr = get_cnocr
        self._run_pip_uninstall = run_pip_uninstall
        self._run_pip_install = run_pip_install
        self._clear_cnocr_cache = clear_cnocr_cache
        self._is_pip_package_installed = is_pip_package_installed
        self._verify_onnx_import = verify_onnx_import if verify_onnx_import is not None else (lambda: True)
        self._run_pip_install_force = run_pip_install_force
        self._done = False
        self._prewarmed: Dict[str, Any] = {}

    def _use_gpu_for_ort(self) -> bool:
        """True if we should use GPU for OCR (install and context). Uses ORT CUDA capability when available."""
        return is_onnx_cuda_usable()

    def _need_onnx_runtime_switch(self) -> Tuple[bool, bool]:
        """
        Return (need_uninstall_other, need_install_target).
        When both False, no switch needed (target already active).
        Install choice: system GPU (CUDADetector) so we install onnxruntime-gpu when NVIDIA present.
        """
        use_gpu = CUDADetector.is_cuda_available()
        cpu_installed = self._is_pip_package_installed(ORT_CPU_PKG)
        gpu_installed = self._is_pip_package_installed(ORT_GPU_PKG)
        if use_gpu:
            need_uninstall = cpu_installed
            need_install = not gpu_installed
        else:
            need_uninstall = gpu_installed
            need_install = not cpu_installed
        return need_uninstall, need_install

    def _ensure_onnx_runtime_switch(self) -> None:
        """
        Uninstall the other runtime only if installed; install target only if missing.
        Target: OCR on CUDA 12 (PyPI onnxruntime-gpu). When installing gpu, always use PyPI (CUDA 12).
        CUDA 12 DLLs (cublasLt64_12 etc.) are provided by ensure_onnx_cuda_usable via nvidia-cublas-cu12.
        When switching to GPU: install (if needed) then verify import works; only then uninstall CPU so we never leave ORT broken.
        """
        use_gpu = CUDADetector.is_cuda_available()
        gpu_installed = self._is_pip_package_installed(ORT_GPU_PKG)

        need_uninstall, need_install = self._need_onnx_runtime_switch()
        target_pkg = get_ort_install_package()

        if not need_uninstall and not need_install:
            ColorPrint.blue("[HF] No ONNX runtime switch needed (target already active).")
            if use_gpu and not self._verify_onnx_import():
                ColorPrint.blue("[HF] ORT GPU import check failed; force-reinstalling onnxruntime-gpu...")
                if self._run_pip_install_force is not None:
                    self._run_pip_install_force(target_pkg)
                    if not self._verify_onnx_import():
                        ColorPrint.yellow("[HF] ORT GPU still not importable; installing onnxruntime (CPU) so app can run.")
                        self._run_pip_install(ORT_CPU_PKG)
                        self._clear_cnocr_cache()
                else:
                    ColorPrint.yellow("[HF] ORT GPU import check failed; install onnxruntime (CPU) manually if needed.")
            return

        if use_gpu and need_uninstall and need_install:
            # CPU installed, GPU not: pip usually requires uninstall CPU before installing GPU. Uninstall -> install -> verify; if verify fails restore CPU.
            ColorPrint.blue("[HF] Uninstalling CPU-only onnxruntime before installing ort-gpu...")
            self._run_pip_uninstall(ORT_CPU_PKG)
            ColorPrint.blue("[HF] Installing onnxruntime-gpu[cuda,cudnn] for ort-gpu (CUDA 12)...")
            self._run_pip_install(target_pkg)
            if not self._verify_onnx_import():
                ColorPrint.yellow("[HF] ORT GPU import check failed after install; restoring onnxruntime (CPU) so app can run.")
                self._run_pip_install(ORT_CPU_PKG)
            self._clear_cnocr_cache()
            return
        if need_install and not (use_gpu and need_uninstall):
            if use_gpu:
                ColorPrint.blue("[HF] Installing onnxruntime-gpu[cuda,cudnn] for ort-gpu (CUDA 12)...")
            else:
                ColorPrint.blue("[HF] Installing onnxruntime for ort-cpu...")
            self._run_pip_install(target_pkg)

        if need_uninstall and use_gpu and not need_install:
            # GPU already installed, CPU also listed by pip. Do NOT uninstall CPU here: both packages
            # provide the same module name "onnxruntime" and share the same site-packages path;
            # uninstalling onnxruntime (CPU) would remove the module files and break the current
            # process (e.g. module has no attribute get_available_providers). Ensure import works
            # and optionally force-reinstall GPU so disk state is correct; leave CPU package as-is.
            if not self._verify_onnx_import():
                if self._run_pip_install_force is not None:
                    ColorPrint.blue("[HF] ORT GPU import check failed; force-reinstalling onnxruntime-gpu...")
                    self._run_pip_install_force(target_pkg)
                    if not self._verify_onnx_import():
                        ColorPrint.yellow("[HF] ORT GPU still not importable after reinstall; installing onnxruntime (CPU) so app can run.")
                        self._run_pip_install(ORT_CPU_PKG)
                        self._clear_cnocr_cache()
                else:
                    ColorPrint.yellow("[HF] ORT GPU import check failed; install onnxruntime (CPU) manually if needed.")
            # Skip CPU uninstall: avoid breaking shared onnxruntime module used by ort-gpu.
        elif need_uninstall and not use_gpu:
            ColorPrint.blue("[HF] Uninstalling onnxruntime-gpu before using ort-cpu...")
            self._run_pip_uninstall(ORT_GPU_PKG)

        if need_uninstall or need_install:
            self._clear_cnocr_cache()

    def run(self) -> bool:
        """
        Run full OCR init once: HF download -> load cnocr -> prewarm.
        Assumes CudaInitializer.run() already called (ONNX switch + CUDA prompt and device line done there). Returns True if cnocr is available and prewarm completed.
        """
        if self._done:
            return self._get_cnocr() is not None
        self._done = True
        try:
            init_ocr_models_from_hf(
                cnstd=True,
                cnocr=True,
                use_gpu=self._use_gpu_for_ort(),
            )
        except Exception as e:
            ColorPrint.gray("[OcrInitializer] HF init: %s" % e)
        cnocr_module = self._get_cnocr()
        if cnocr_module is None:
            return False
        self._prewarm(cnocr_module)
        return True

    def _prewarm(self, cnocr_module: Any) -> None:
        """Build zh/en/cht CnOcr instances from spec. Use GPU context only when is_onnx_cuda_usable() is True.
        rec_more_configs from REC_MORE_CONFIGS_CNOCR so rapidocr has font_path."""
        CnOcr = cnocr_module.CnOcr
        use_gpu = self._use_gpu_for_ort()
        ctx = "gpu" if use_gpu else "cpu"
        for lang in PREWARM_LANGUAGES:
            det, rec_order = prewarm_det_rec_for_lang(lang, use_gpu)
            inst = None
            for rec in rec_order:
                try:
                    inst = CnOcr(
                        det_model_name=det,
                        rec_model_name=rec,
                        context=ctx,
                        rec_more_configs=REC_MORE_CONFIGS_CNOCR,
                    )
                    ColorPrint.blue("[CnOCR] Prewarmed %s: det=%s rec=%s context=%s" % (lang, det, rec, ctx))
                    break
                except Exception as e:
                    ColorPrint.gray("[CnOCR] Prewarm %s (%s+%s): %s" % (lang, det, rec, e))
            self._prewarmed[lang] = inst

    def get_prewarmed(self, lang: str) -> Optional[Any]:
        """Return prewarmed CnOcr for lang ('zh', 'en', 'cht') or None."""
        return self._prewarmed.get(lang)


# CUDA init: single entry for whole project (system GPU info + ORT version switch + ensure ORT CUDA). Runs before OCR init.
def _run_ort_version_switch_for_cuda() -> None:
    """Run ONNX runtime switch once: uninstall the other (cpu/gpu), install target (gpu uses PyPI CUDA 12 with [cuda,cudnn])."""
    _ocr_initializer._ensure_onnx_runtime_switch()

_cuda_initializer = CudaInitializer(
    print_cuda_prompt=_print_cuda_support_prompt,
    run_pip_install=_run_pip_install_for_ocr,
    log=lambda msg: ColorPrint.blue(msg),
    run_ort_version_switch=_run_ort_version_switch_for_cuda,
    is_pip_package_installed=_is_pip_package_installed,
)

# OCR init: single entry via OcrInitializer (uninstall other / install target only when needed; skip when no switch). Requires CudaInitializer.run() as predecessor.
_ocr_initializer = OcrInitializer(
    get_cnocr=get_third_package_cnocr,
    run_pip_uninstall=_run_pip_uninstall,
    run_pip_install=_run_pip_install_for_ocr,
    clear_cnocr_cache=_clear_cnocr_cache,
    is_pip_package_installed=_is_pip_package_installed,
    verify_onnx_import=_verify_onnx_import,
    run_pip_install_force=_run_pip_install_for_ocr_force,
)


def get_cnocr_prewarmed(lang: str):
    """Return prewarmed CnOcr for lang: 'zh', 'en', 'cht'. None if not available."""
    return _ocr_initializer.get_prewarmed(lang)


def init_third_party_cnocr() -> bool:
    """
    Ensure huggingface_hub then run CUDA init once (ONNX switch + system GPU + ensure_onnx_cuda_usable), then OCR init once:
    download from HF -> load cnocr -> prewarm zh/en/cht. Whole project has only this path for CUDA/ORT init.
    Official: det default ch_PP-OCRv5_det; zh v5/server, en en_PP-OCRv4/v3, cht chinese_cht_PP-OCRv3.
    """
    hub = get_third_package_huggingface_hub()
    if hub is not None:
        _ensure_huggingface_cli_on_path()
    _cuda_initializer.run()
    if last_ort_install_ran():
        _fix_ort_dependency_conflicts()
    return _ocr_initializer.run()


def get_third_package_pynput():
    """Get pynput package (lazy load)"""
    return _lazy_import('pynput', 'import pynput')


def get_third_package_pyperclip():
    """Get pyperclip package (lazy load)"""
    return _lazy_import('pyperclip', 'import pyperclip')


# Google Translate API packages
def get_third_package_googletrans():
    """Get googletrans package (lazy load)"""
    return _lazy_import('googletrans', 'import googletrans')


def get_third_package_googletrans_Translator():
    """Get googletrans.Translator class (lazy load)"""
    if 'googletrans_Translator' not in _PACKAGE_CACHE:
        from googletrans import Translator as googletrans_Translator
        _PACKAGE_CACHE['googletrans_Translator'] = googletrans_Translator
    return _PACKAGE_CACHE['googletrans_Translator']


def get_third_package_httpx():
    """Get httpx package (lazy load) - Required by googletrans"""
    return _lazy_import('httpx', 'import httpx')


# Document processing packages
def get_third_package_pypdf():
    """Get pypdf package (lazy load)"""
    return _lazy_import('pypdf', 'import pypdf')


def get_third_package_pdfplumber():
    """Get pdfplumber package (lazy load)"""
    return _lazy_import('pdfplumber', 'import pdfplumber')


def get_third_package_docx():
    """Get docx package (lazy load)"""
    return _lazy_import('docx', 'import docx')


def get_third_package_python_docx():
    """Get python-docx package (alias for docx, lazy load)"""
    return get_third_package_docx()


def get_third_package_openpyxl():
    """Get openpyxl package (lazy load)"""
    return _lazy_import('openpyxl', 'import openpyxl')


def get_third_package_pptx():
    """Get pptx package (lazy load)"""
    return _lazy_import('pptx', 'import pptx')


def get_third_package_python_pptx():
    """Get python-pptx package (alias for pptx, lazy load)"""
    return get_third_package_pptx()


# HTML parsing
def get_third_package_bs4():
    """Get bs4 (BeautifulSoup4) package (lazy load)"""
    return _lazy_import('bs4', 'import bs4')


def get_third_package_BeautifulSoup():
    """Get BeautifulSoup class from bs4 (lazy load)"""
    if 'BeautifulSoup' not in _PACKAGE_CACHE:
        from bs4 import BeautifulSoup
        _PACKAGE_CACHE['BeautifulSoup'] = BeautifulSoup
    return _PACKAGE_CACHE['BeautifulSoup']


# Machine learning
def get_third_package_sklearn():
    """Get sklearn package (lazy load) - Heavy package"""
    return _lazy_import('sklearn', 'import sklearn')


# Database operations
def get_third_package_sqlalchemy():
    """Get sqlalchemy package (lazy load)"""
    return _lazy_import('sqlalchemy', 'import sqlalchemy')


# MCP (Model Context Protocol) - FastMCP v2
def get_third_package_fastmcp():
    """Get fastmcp package (lazy load)"""
    return _lazy_import('fastmcp', 'import fastmcp')


def get_third_package_FastMCP():
    """Get FastMCP class (lazy load)"""
    if 'FastMCP' not in _PACKAGE_CACHE:
        from fastmcp import FastMCP
        _PACKAGE_CACHE['FastMCP'] = FastMCP
    return _PACKAGE_CACHE['FastMCP']


def get_third_package_Context():
    """Get MCP Context class (lazy load)"""
    if 'Context' not in _PACKAGE_CACHE:
        from fastmcp import Context
        _PACKAGE_CACHE['Context'] = Context
    return _PACKAGE_CACHE['Context']


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
def get_third_package_pygame():
    """Get pygame package (lazy load)"""
    return _lazy_import('pygame', 'import pygame')


def get_third_package_eng_to_ipa():
    """Get eng_to_ipa package (lazy load)"""
    return _lazy_import('eng_to_ipa', 'import eng_to_ipa')


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
    if 'win32gui' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import win32gui
            _PACKAGE_CACHE['win32gui'] = win32gui
        else:
            _PACKAGE_CACHE['win32gui'] = None
    return _PACKAGE_CACHE['win32gui']


def get_third_package_win32con():
    """Get win32con package (lazy load, Windows only)"""
    if 'win32con' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import win32con
            _PACKAGE_CACHE['win32con'] = win32con
        else:
            _PACKAGE_CACHE['win32con'] = None
    return _PACKAGE_CACHE['win32con']


def get_third_package_win32api():
    """Get win32api package (lazy load, Windows only)"""
    if 'win32api' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import win32api
            _PACKAGE_CACHE['win32api'] = win32api
        else:
            _PACKAGE_CACHE['win32api'] = None
    return _PACKAGE_CACHE['win32api']


def get_third_package_win32process():
    """Get win32process package (lazy load, Windows only)"""
    if 'win32process' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import win32process
            _PACKAGE_CACHE['win32process'] = win32process
        else:
            _PACKAGE_CACHE['win32process'] = None
    return _PACKAGE_CACHE['win32process']


def get_third_package_win32ui():
    """Get win32ui package (lazy load, Windows only)"""
    if 'win32ui' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import win32ui
            _PACKAGE_CACHE['win32ui'] = win32ui
        else:
            _PACKAGE_CACHE['win32ui'] = None
    return _PACKAGE_CACHE['win32ui']


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


# OKX exchange API
def get_third_package_okx():
    """Get okx package (python-okx, lazy load)"""
    return _lazy_import('okx', 'import okx')


# Redis cache
def get_third_package_redis():
    """Get redis package (lazy load)"""
    return _lazy_import('redis', 'import redis')


# Google Gemini API
def get_third_package_google_genai():
    """Get google.genai package (lazy load)"""
    if 'google_genai' not in _PACKAGE_CACHE:
        from google import genai as google_genai
        _PACKAGE_CACHE['google_genai'] = google_genai
    return _PACKAGE_CACHE['google_genai']


def get_third_package_openai():
    """
    Get openai package (lazy load).

    Used by OpenAI-compatible providers (OpenAI, DeepSeek via base_url). The same
    SDK talks to any service that implements the OpenAI REST API: set base_url
    (e.g. https://api.deepseek.com for DeepSeek) and api_key on the client.
    """
    return _lazy_import('openai', 'import openai')


__all__ = [
    # Dependency management utilities
    'check_system_package_installed',
    'install_system_packages',

    # Lazy loading getter functions (use these instead of direct imports)
    'get_third_package_aiohttp',
    'get_third_package_aiohttp_web',
    'get_third_package_websockets',
    'get_third_package_requests',
    'get_third_package_urllib3',
    'get_third_package_idna',
    'get_third_package_chardet',
    'get_third_package_certifi',
    'get_third_package_zmq',
    'get_third_package_msgpack',
    'get_third_package_grpc',
    'get_third_package_werkzeug',
    'get_third_package_h5py',
    'get_third_package_absl',
    'get_third_package_six',
    'get_third_package_PyQt5',
    'get_third_package_uvicorn',
    'get_third_package_fastapi',
    'get_third_package_PIL',
    'get_third_package_PIL_Image',
    'get_third_package_PIL_ImageDraw',
    'get_third_package_PIL_ImageFont',
    'get_third_package_PIL_ImageTk',
    'get_third_package_PIL_ImageGrab',
    'get_third_package_PIL_ImageEnhance',
    'get_third_package_PIL_ImageFilter',
    'get_third_package_PIL_ImageOps',
    'get_third_package_PIL_ImageStat',
    'get_third_package_cv2',
    'get_third_package_pyautogui',
    'get_third_package_psutil',
    'get_third_package_mss',
    'get_third_package_torch',
    'get_third_package_ultralytics',
    'get_third_package_numpy',
    'get_third_package_matplotlib',
    'get_third_package_labelme',
    'get_third_package_labelImg',
    'get_third_package_adb_shell',
    'get_third_package_av',
    'get_third_package_loguru',
    'get_third_package_yaml',
    'get_third_package_webview',
    'get_third_package_tkinterweb',
    'get_third_package_tkhtmlview',
    'get_third_package_pystray',
    'get_third_package_huggingface_hub',
    'get_third_package_cnocr',
    'get_cnocr_prewarmed',
    'get_huggingface_cli_command',
    'ensure_huggingface_cli_prerequisite',
    'get_third_package_pynput',
    'get_third_package_pyperclip',
    # Google Translate API
    'get_third_package_googletrans',
    'get_third_package_googletrans_Translator',
    'get_third_package_httpx',
    # Document processing packages
    'get_third_package_pypdf',
    'get_third_package_pdfplumber',
    'get_third_package_docx',
    'get_third_package_python_docx',
    'get_third_package_openpyxl',
    'get_third_package_pptx',
    'get_third_package_python_pptx',
    # Machine learning
    'get_third_package_sklearn',
    # Database
    'get_third_package_sqlalchemy',
    # MCP (Model Context Protocol)
    'get_third_package_fastmcp',
    'get_third_package_FastMCP',
    'get_third_package_Context',
    # Optional packages
    'get_third_package_speechsdk',
    'get_third_package_edge_tts',
    'get_third_package_vosk',
    'get_third_package_whisper',
    'get_third_package_watchdog',
    # Audio packages
    'get_third_package_pygame',
    'get_third_package_eng_to_ipa',
    'get_third_package_pyaudio',
    # GUI packages
    'get_third_package_tkinter',
    'get_third_package_pyside6',
    # Windows-only packages
    'get_third_package_win32gui',
    'get_third_package_win32con',
    'get_third_package_win32api',
    'get_third_package_win32process',
    'get_third_package_win32ui',
    'get_third_package_windows_ocr',
    'get_third_package_sherpa_onnx',
    'get_third_package_melo',
    'get_third_package_pywinauto',
    'get_third_package_pygetwindow',
    'get_third_package_uiautomation',
    'get_third_package_pyaudiowpatch',
    # OKX exchange API
    'get_third_package_okx',
    # Redis cache
    'get_third_package_redis',
    # Google Gemini API
    'get_third_package_google_genai',
    # Hugging Face Hub helpers (merged from huggingface_hub_helper)
    'ensure_huggingface_hub',
    'hf_download_file',
    'hf_snapshot_to_dir',
    'hf_download_zip_and_extract',
    'hf_list_repo_files',
    'hf_get_collection_models',
    'hf_download_repo_latest',
    # OCR prewarm spec (merged from ocr_prewarm_spec)
    'PREWARM_SPEC',
    'PREWARM_LANGUAGES',
    'REC_MORE_CONFIGS_CNOCR',
    'all_cnstd_repos',
    'all_cnocr_repos',
    'all_cnstd_zips',
    'all_cnocr_zips',
    'prewarm_det_rec_for_lang',
    # OCR model provisioning (merged from ocr_hf_models)
    'cnstd_root',
    'cnocr_root',
    'ensure_cnstd_models',
    'ensure_cnocr_models',
    'init_ocr_models_from_hf',
    # OCR initializer (merged from ocr_initializer)
    'OcrInitializer',
    'init_third_party_cnocr',
]

# OCR/cnocr init is not run at import. Call init_third_party_cnocr() once (e.g. from cnocr_engine_registry) to download HF models and prewarm zh/en/cht.
