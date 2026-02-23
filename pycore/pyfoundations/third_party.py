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
import platform
from typing import Optional

from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.cpu_gpu_packages import get_cnocr_pip_package
from pycore.pyfoundations.cuda_detector import CUDADetector
from pycore.pyfoundations.cuda_initializer import CudaInitializer
from pycore.pyfoundations.onnx_runtime_capability import last_ort_install_ran
from pycore.pyfoundations.ocr_initializer import OcrInitializer
from pycore.pyfoundations.safe_subprocess import subprocess
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
}

# Windows-only optional: WinRT OCR (Windows.Media.Ocr). Multiple pip packages required; loaded via get_third_package_windows_ocr().
WINDOWS_OCR_WINRT_PACKAGES = [
    "winrt-Windows.Foundation",
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

# PyTorch CUDA: install this first so "Found installed packages" lists CUDA build (see pytorch.org/get-started/locally)
PYTORCH_CUDA_INDEX_URL = "https://download.pytorch.org/whl/cu126"

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


def _ensure_torch_cuda_build_first():
    """
    Run before other package checks. Ensure torch is CUDA build only when system supports CUDA.
    System support: NVIDIA GPU + driver (nvidia-smi or CUDA env). Per PyTorch docs: is_available() for runtime.
    """
    _print_cuda_support_prompt()

    # Only skip CUDA install when system does not support CUDA
    if not CUDADetector.is_cuda_available():
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
    pip_cmd = [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio",
               "--index-url", PYTORCH_CUDA_INDEX_URL]
    if current_platform != "Windows":
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    else:
        pip_cmd.append("--no-user")
    if torch is not None and getattr(torch.version, "cuda", None) is None:
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


def install_and_reimport_edge_tts():
    """
    Install Edge TTS package and reimport it.

    Direct hard import, no string variables, no DEPENDENCY_MAP lookup.

    IMPORTANT: edge-tts 7.2.2+ has NoAudioReceived bug.
    Compatible versions: 7.2.1, 7.2.0, 7.1.0, 7.0.0
    Required version: 7.2.1
    Reference: https://github.com/rany2/edge-tts/issues/443

    Returns:
        The imported module if successful, None otherwise.
    """
    REQUIRED_VERSION = "7.2.1"
    COMPATIBLE_VERSIONS = ["7.2.1", "7.2.0", "7.1.0", "7.0.0"]

    # Try direct hard import first
    try:
        import edge_tts
        current_version = edge_tts.__version__

        # Check if current version is compatible
        if current_version in COMPATIBLE_VERSIONS:
            ColorPrint.green(f"[SUCCESS] Edge TTS {current_version} is compatible")
            return edge_tts
        else:
            ColorPrint.yellow(f"[WARNING] Edge TTS {current_version} is incompatible (has NoAudioReceived bug)")
            ColorPrint.yellow(f"[WARNING] Downgrading to {REQUIRED_VERSION}...")

            # Force reinstall with correct version
            pip_cmd = build_pip_install_command(f"edge-tts=={REQUIRED_VERSION}")
            pip_cmd.append("--force-reinstall")
            run_pip_install_with_realtime_output(pip_cmd, f"edge-tts=={REQUIRED_VERSION}")

            # Clear import cache and reimport
            importlib.invalidate_caches()
            # Remove from sys.modules to force reimport
            if 'edge_tts' in sys.modules:
                del sys.modules['edge_tts']

            import edge_tts
            new_version = edge_tts.__version__
            ColorPrint.green(f"[SUCCESS] Edge TTS downgraded from {current_version} to {new_version}")
            return edge_tts

    except ImportError:
        ColorPrint.blue("[INFO] Edge TTS not installed")
    except AttributeError:
        ColorPrint.yellow("[WARNING] Edge TTS installed but version cannot be detected")

    # Install required version
    ColorPrint.blue(f"[INFO] Installing Edge TTS {REQUIRED_VERSION}...")
    pip_cmd = build_pip_install_command(f"edge-tts=={REQUIRED_VERSION}")

    # Run installation with real-time output
    run_pip_install_with_realtime_output(pip_cmd, f"edge-tts=={REQUIRED_VERSION}")

    # Verify installation by trying to import (not by return code)
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
        if import_name_to_check and importlib.util.find_spec(import_name_to_check) is None:
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

        # Safely check if module can be imported (handle exceptions)
        try:
            module_spec = importlib.util.find_spec(import_name_to_check)
            is_installed = module_spec is not None
        except Exception as e:
            ColorPrint.yellow(f"[WARNING] Error checking '{import_name_to_check}': {e}")
            is_installed = False

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
                module_spec = importlib.util.find_spec(import_name_to_check)
                if module_spec is None:
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
    """Get pyautogui package (lazy load)"""
    return _lazy_import('pyautogui', 'import pyautogui')


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
]

# OCR/cnocr init is not run at import. Call init_third_party_cnocr() once (e.g. from cnocr_engine_registry) to download HF models and prewarm zh/en/cht.
